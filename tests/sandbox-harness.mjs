// Loads dist/plugin/editor/index.html the way Orca 1.4.245 does: a srcdoc <iframe sandbox="allow-scripts">
// whose shell sets the exact plugin CSP, with a mocked window.orca. Fails on CSP violations, page
// errors or diagrams that did not render.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { shell as orcaShell } from './orca-frame.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'test-results')
fs.mkdirSync(OUT, { recursive: true })

const sample = fs.readFileSync(path.join(ROOT, 'tests/fixtures/sample.adoc'), 'utf8')
const shell = (dark, text = sample) => orcaShell(dark, text)

const browser = await chromium.launch()
let failed = false
for (const dark of [false, true]) {
  const name = dark ? 'dark' : 'light'
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
  const srcdoc = shell(dark).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><body style="margin:0">` +
      `<iframe sandbox="allow-scripts" style="width:100%;height:100vh;border:0" srcdoc="${srcdoc}"></iframe>`,
  )
  const frame = page.frames()[1]
  page.on('console', (m) => process.env.DEBUG && console.log('[console]', m.type(), m.text().slice(0, 300)))
  const wait = async (label, fn) => {
    try {
      await frame.waitForFunction(fn, null, { timeout: 30000 })
    } catch (e) {
      const state = await frame.evaluate(() => ({
        renderState: document.documentElement.dataset.renderState,
        h1: document.querySelector('h1')?.textContent,
        content: document.getElementById('content')?.innerHTML.slice(0, 600),
        violations: window.__violations,
        errors: window.__errors,
      }))
      throw new Error(`${name}: timeout waiting for ${label}: ${JSON.stringify(state, null, 1)}`)
    }
  }
  await wait('initial render', () => document.documentElement.dataset.renderState === 'done')

  // Live update: change the document and wait for the re-render.
  await frame.evaluate(() =>
    window.__setText(
      '= Updated\n\n[mermaid]\n----\ngraph LR\n  X --> Y\n----\n\n[plantuml]\n----\nA -> B : updated\n----\n',
    ),
  )
  await wait(
    'live update',
    () =>
      document.querySelector('h1')?.textContent === 'Updated' &&
      document.documentElement.dataset.renderState === 'done',
  )
  const live = await frame.evaluate(() => document.querySelectorAll('.diagram.rendered svg').length)
  await frame.evaluate((t) => window.__setText(t), sample)
  await wait(
    'second update',
    () =>
      document.querySelector('h1')?.textContent !== 'Updated' &&
      document.documentElement.dataset.renderState === 'done',
  )

  const r = await frame.evaluate(() => ({
    rendered: Array.from(document.querySelectorAll('.diagram.rendered')).map((e) => e.dataset.kind),
    failed: Array.from(document.querySelectorAll('.diagram.failed')).map(
      (e) => e.dataset.kind + ': ' + e.textContent.slice(0, 120),
    ),
    scriptsInContent: document.querySelectorAll('#content script').length,
    strayBodyElements: Array.from(document.body.children)
      .filter((e) => !['content'].includes(e.id) && !['SCRIPT', 'STYLE', 'META'].includes(e.tagName))
      .map((e) => e.tagName + '#' + e.id),
    pwned: !!window.__pwned,
    applyEdit: !!window.__applyEditCalled,
    violations: window.__violations,
    errors: window.__errors,
  }))
  await page.screenshot({ path: path.join(OUT, `sample-${name}.png`), fullPage: true })
  console.log(name, JSON.stringify({ ...r, live }, null, 1))

  const expectRendered = 4 // see tests/fixtures/sample.adoc
  const expectFailed = 1
  if (
    r.rendered.length !== expectRendered ||
    r.failed.length !== expectFailed ||
    r.violations.length ||
    r.errors.length ||
    r.strayBodyElements.length ||
    r.scriptsInContent ||
    r.pwned ||
    r.applyEdit ||
    live !== 2
  ) {
    failed = true
    console.error(`✗ ${name}: unexpected result`)
  } else console.log(`✓ ${name}`)
  await page.close()
}

// v1 features: toc sidebar, link handling, include/image placeholders, bundled stdlib.
{
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } })
  const features = fs.readFileSync(path.join(ROOT, 'tests/fixtures/features.adoc'), 'utf8')
  const srcdoc = shell(false, features).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><body style="margin:0">` +
      `<iframe sandbox="allow-scripts" style="width:100%;height:100vh;border:0" srcdoc="${srcdoc}"></iframe>`,
  )
  const frame = page.frames()[1]
  await frame.waitForFunction(() => document.documentElement.dataset.renderState === 'done', null, { timeout: 30000 })
  const before = await frame.evaluate(() => window.scrollY)
  await page.screenshot({ path: path.join(OUT, 'features.png') })
  await frame.click('#content .doc-main a.link-internal[data-href="#deep"]')
  await frame.waitForTimeout(200)
  const r = await frame.evaluate(() => {
    const d = Array.from(document.querySelectorAll('.diagram'))
    return {
      sidebar: !!document.querySelector('#content.with-toc-left > .toc-sidebar #toc'),
      hrefsLeft: document.querySelectorAll('#content a[href]').length,
      externalTitle: document.querySelector('a.link-external')?.title,
      include: document.querySelector('.unresolved-include')?.textContent.trim(),
      imagePlaceholders: document.querySelectorAll('.image-placeholder').length,
      nonDataImgs: Array.from(document.querySelectorAll('#content img')).filter((i) => !i.src.startsWith('data:'))
        .length,
      c4:
        d[0]?.classList.contains('rendered') &&
        /Uses/.test(d[0].innerHTML) &&
        !/not bundled|Error/i.test(d[0].textContent),
      tupadr3: d.some(
        (e) =>
          e.dataset.kind === 'plantuml' &&
          e.classList.contains('rendered') &&
          /Web Server/.test(e.innerHTML) &&
          !/cannot include|error/i.test(e.textContent),
      ),
      hljsTokens: document.querySelectorAll('pre.highlight code.hljs [class^="hljs-"]').length,
      katex: document.querySelectorAll('.katex').length,
      katexDisplay: document.querySelectorAll('.stemblock .katex-display').length,
      katexErrors: document.querySelectorAll('.katex-error').length,
      graphviz: Array.from(document.querySelectorAll('.diagram[data-kind="graphviz"]')).map(
        (e) => e.classList.contains('rendered') && !!e.querySelector('svg'),
      ),
      // Small mermaid diagrams must keep their natural size (not be scaled up to the column width).
      mermaidUpscaled: Array.from(document.querySelectorAll('.diagram[data-kind="mermaid"] svg')).filter((svg) => {
        const natural = parseFloat(svg.style.maxWidth)
        return natural && svg.getBoundingClientRect().width > natural + 1
      }).length,
      overflowing: d.filter((e) => e.scrollWidth > e.clientWidth + 1).length,
      thAlign: getComputedStyle(document.querySelector('th')).textAlign,
      notBundled: d.map((e) => e.textContent).find((t) => /awslib14/.test(t)) || '',
      scrollY: window.scrollY,
      violations: window.__violations,
      errors: window.__errors,
    }
  })
  console.log('features', JSON.stringify({ ...r, notBundled: r.notBundled.slice(0, 200), before }, null, 1))
  const ok =
    r.sidebar &&
    r.hrefsLeft === 0 &&
    r.externalTitle === 'https://example.com' &&
    /chapters\/intro\.adoc/.test(r.include || '') &&
    r.imagePlaceholders === 2 &&
    r.nonDataImgs === 0 &&
    r.c4 &&
    r.tupadr3 &&
    r.hljsTokens > 3 &&
    r.katex >= 3 &&
    r.katexDisplay === 1 &&
    r.katexErrors === 0 &&
    r.graphviz.length === 2 &&
    r.graphviz.every(Boolean) &&
    r.mermaidUpscaled === 0 &&
    r.overflowing === 0 &&
    r.thAlign === 'left' &&
    /not bundled/.test(r.notBundled) &&
    r.scrollY > before + 100 &&
    !r.violations.length &&
    !r.errors.length
  if (!ok) {
    failed = true
    console.error('✗ features: unexpected result')
  } else console.log('✓ features')
  await page.close()
}

await browser.close()
process.exit(failed ? 1 : 0)
