// Loads dist/plugin/editor/index.html the way Orca does (verified on 1.4.245): a srcdoc <iframe sandbox="allow-scripts">
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
    } catch {
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
  const live = await frame.evaluate(() => document.querySelectorAll('.diagram.rendered > svg').length)
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
    katex: document.querySelectorAll('.katex').length, // sample.adoc has no :stem:
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
    r.katex ||
    r.applyEdit ||
    live !== 2
  ) {
    failed = true
    console.error(`✗ ${name}: unexpected result`)
  } else console.log(`✓ ${name}`)
  await page.close()
}

const features = fs.readFileSync(path.join(ROOT, 'tests/fixtures/features.adoc'), 'utf8')

// tests/fixtures/features.adoc in the replica frame, rendered completely.
async function openFeatures() {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } })
  const srcdoc = shell(false, features).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><body style="margin:0">` +
      `<iframe sandbox="allow-scripts" style="width:100%;height:100vh;border:0" srcdoc="${srcdoc}"></iframe>`,
  )
  const frame = page.frames()[1]
  await frame.waitForFunction(() => document.documentElement.dataset.renderState === 'done', null, { timeout: 30000 })
  return { page, frame }
}

// v1 features: toc sidebar, link handling, include/image placeholders, bundled stdlib.
{
  const { page, frame } = await openFeatures()
  const before = await frame.evaluate(() => window.scrollY)
  await page.screenshot({ path: path.join(OUT, 'features.png') })
  await frame.click('#content .doc-main a.link-internal[data-href="#deep"]')
  await frame.waitForTimeout(200)
  const r = await frame.evaluate(() => {
    const d = Array.from(document.querySelectorAll('.diagram'))
    return {
      sidebar: !!document.querySelector('#content.with-toc-left > .toc-sidebar #toc'),
      // HTML and SVG links (href or xlink:href), including the one inside a PlantUML diagram
      hrefsLeft: Array.from(document.querySelectorAll('#content a')).filter(
        (a) => a.hasAttribute('href') || a.hasAttributeNS('http://www.w3.org/1999/xlink', 'href'),
      ).length,
      diagramLink: document.querySelector('.diagram > svg a.link-external')?.dataset.href,
      // SVG ignores title=; the tooltip is a <title> child (the engine's own or ours)
      diagramLinkTooltip: document.querySelector('.diagram > svg a.link-external > title')?.textContent,
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
        (e) => e.classList.contains('rendered') && !!e.querySelector(':scope > svg'),
      ),
      // Small mermaid diagrams must keep their natural size (not be scaled up to the column width).
      // (A diagram with width= may be scaled up, as in Asciidoctor; it is checked below.)
      mermaidUpscaled: Array.from(
        document.querySelectorAll('.diagram[data-kind="mermaid"]:not([data-width]) > svg'),
      ).filter((svg) => {
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
  // Figures: id, caption, width=, align= and the placeholder of a block macro; then a cross reference to the figure.
  await frame.click('#content a.link-internal[data-href="#fig-flow"]')
  await frame.waitForTimeout(200)
  const fig = await frame.evaluate(() => {
    const block = document.getElementById('fig-flow')
    const macro = Array.from(document.querySelectorAll('.diagramblock')).find((b) => /Deployment/.test(b.textContent))
    return {
      top: Math.round(block?.getBoundingClientRect().top ?? -1),
      title: block?.querySelector('.title')?.textContent,
      width: Math.round(block?.querySelector('.diagram > svg')?.getBoundingClientRect().width ?? 0),
      align: block && getComputedStyle(block.querySelector('.diagram')).textAlign,
      macro: macro?.textContent,
    }
  })
  console.log('figures', JSON.stringify(fig))
  const figOk =
    Math.abs(fig.top) <= 2 &&
    /^Figure \d+\. Order flow$/.test(fig.title ?? '') &&
    Math.abs(fig.width - 480) <= 1 &&
    fig.align === 'center' &&
    /diagrams\/deploy\.puml/.test(fig.macro ?? '') &&
    /^Figure \d+\. Deployment/.test(fig.macro?.split('puml').pop() ?? '')
  console.log('features', JSON.stringify({ ...r, notBundled: r.notBundled.slice(0, 200), before }, null, 1))
  const ok =
    figOk &&
    r.sidebar &&
    r.hrefsLeft === 0 &&
    r.diagramLink === 'https://example.com/diagram-link' &&
    !!r.diagramLinkTooltip &&
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
  // An edit re-renders the page; the reader must stay where they were, also below a changed diagram.
  // Scroll to the very end: an incomplete page would be shorter there and the browser would clip the position.
  const scrollBeforeEdit = await frame.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight)
    // Chromium's scroll anchoring may repair the position later; record every intermediate one too.
    window.__minScrollY = window.scrollY
    window.addEventListener('scroll', () => (window.__minScrollY = Math.min(window.__minScrollY, window.scrollY)))
    return window.scrollY
  })
  // The edit changes the first diagram, so it is rendered anew while the reader is below it.
  await frame.evaluate(
    (t) => window.__setText(t.replace('System(sys, "System")', 'System(sys, "System 2")') + '\nAppended paragraph.\n'),
    features,
  )
  await frame.waitForFunction(
    () =>
      /Appended paragraph/.test(document.body.textContent) && document.documentElement.dataset.renderState === 'done',
    null,
    { timeout: 30000 },
  )
  const scrollAfterEdit = await frame.evaluate(() => Math.min(window.scrollY, window.__minScrollY))
  console.log('scroll after edit', { before: scrollBeforeEdit, after: scrollAfterEdit })
  if (!ok) {
    failed = true
    console.error('✗ features: unexpected result')
  } else if (Math.abs(scrollAfterEdit - scrollBeforeEdit) > 2) {
    failed = true
    console.error(`✗ features: scroll position moved from ${scrollBeforeEdit} to ${scrollAfterEdit} during an edit`)
  } else console.log('✓ features')
  await page.close()
}

// Diagram toolbar and zoom overlay. The clipboard is not reachable from a page on about:blank, so execCommand is
// stubbed to record what would be copied.
{
  const { page, frame } = await openFeatures()
  const problems = []
  const check = (ok, what) => ok || problems.push(what)
  const overlay = () =>
    frame.evaluate(() => {
      const o = document.querySelector('.zoom-overlay')
      return (
        o && {
          role: o.getAttribute('role'),
          svg: !!o.querySelector('.zoom-canvas > svg'),
          scale: Number(o.querySelector('.zoom-canvas')?.dataset.scale),
          focusInside: o.contains(document.activeElement),
        }
      )
    })
  const zoomButton = '.diagram.rendered[data-kind="graphviz"] .diagram-tools button[data-action="zoom"]'

  await frame.click(zoomButton)
  const opened = await overlay()
  check(
    opened?.role === 'dialog' && opened.svg && opened.focusInside,
    `zoom opens a focused dialog: ${JSON.stringify(opened)}`,
  )
  const box = await page.locator('iframe').boundingBox()
  await page.mouse.move(box.x + 550, box.y + 350)
  await page.mouse.wheel(0, -400)
  const zoomed = await overlay()
  check(zoomed?.scale > opened?.scale, `the wheel zooms in: ${opened?.scale} → ${zoomed?.scale}`)
  await frame.press('.zoom-overlay', 'Escape')
  const afterEsc = await frame.evaluate(() => ({
    open: !!document.querySelector('.zoom-overlay'),
    focus: document.activeElement?.dataset.action,
  }))
  check(!afterEsc.open && afterEsc.focus === 'zoom', `Esc closes and returns focus: ${JSON.stringify(afterEsc)}`)

  await frame.dblclick('.diagram.rendered[data-kind="mermaid"] > svg')
  check((await overlay())?.svg, 'a double click opens the zoom')
  await frame.click('.zoom-bar button[data-action="close"]')
  check(!(await overlay()), 'the close button closes the zoom')

  await frame.evaluate(() => {
    window.__copyResult = true
    document.execCommand = (cmd) => {
      if (cmd === 'copy') window.__copied = document.activeElement?.value
      return window.__copyResult
    }
  })
  const copy = async (selector) => {
    await frame.click(selector)
    return frame.evaluate(
      (sel) => ({
        text: window.__copied,
        status: document.querySelector(sel).closest('.diagram-tools').querySelector('.diagram-tools-status')
          .textContent,
        leftovers: document.querySelectorAll('body > textarea').length,
      }),
      selector,
    )
  }
  const graphviz = '.diagram.rendered[data-kind="graphviz"] .diagram-tools'
  const src = await copy(`${graphviz} button[data-action="source"]`)
  check(
    /Order -> Payment -> Shipping/.test(src.text) && src.status === 'Copied' && !src.leftovers,
    `copy source: ${JSON.stringify(src)}`,
  )
  const svg = await copy(`${graphviz} button[data-action="svg"]`)
  check(/<svg[\s\S]*Payment/.test(svg.text ?? ''), `copy SVG: ${(svg.text ?? '').slice(0, 80)}`)
  await frame.evaluate(() => (window.__copyResult = false))
  const denied = await copy(`${graphviz} button[data-action="source"]`)
  check(denied.status === 'Copy not available', `a refused copy is reported: ${denied.status}`)

  const failedTools = await frame.evaluate(() =>
    Array.from(document.querySelectorAll('.diagram.failed .diagram-tools button')).map((b) => b.dataset.action),
  )
  check(
    failedTools.length > 0 && failedTools.every((a) => a === 'source'),
    `a failed diagram offers only copy source: ${failedTools}`,
  )
  const errors = await frame.evaluate(() => [...window.__violations, ...window.__errors])
  check(!errors.length, `no errors or CSP violations: ${errors}`)
  if (problems.length) {
    failed = true
    console.error(`✗ diagram tools:\n  ${problems.join('\n  ')}`)
  } else console.log('✓ diagram tools')
  await page.close()
}

await browser.close()
process.exit(failed ? 1 : 0)
