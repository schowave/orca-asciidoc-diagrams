// Loads dist/plugin/editor/index.html the way Orca 1.4.245 does: a srcdoc <iframe sandbox="allow-scripts">
// whose shell sets the exact plugin CSP, with a mocked window.orca. Fails on CSP violations, page
// errors or diagrams that did not render.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'test-results')
fs.mkdirSync(OUT, { recursive: true })

// Copied from Orca src/shared/plugins/frames/plugin-panel-shell.ts (PLUGIN_PANEL_CSP).
const CSP =
  "default-src 'none'; connect-src 'none'; script-src 'unsafe-inline'; " +
  "style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"

const sample = fs.readFileSync(path.join(ROOT, 'tests/fixtures/sample.adoc'), 'utf8')
const pluginHtml = fs.readFileSync(path.join(ROOT, 'dist/plugin/editor/index.html'), 'utf8')

const mockOrca = (text, dark) => `<script>
window.__violations = [];
document.addEventListener('securitypolicyviolation', e => __violations.push(e.violatedDirective + ' ' + (e.blockedURI || '')));
window.__errors = [];
window.addEventListener('error', e => __errors.push(String(e.message)));
window.addEventListener('unhandledrejection', e => __errors.push('unhandled: ' + String(e.reason)));
(function () {
  const listeners = { change: [], theme: [] };
  const doc = { version: 1, readOnly: false, content: { kind: 'text', text: ${JSON.stringify(text).replace(/</g, "\\u003c")} } };
  window.__setText = (t) => { doc.version++; doc.content = { kind: 'text', text: t }; listeners.change.forEach(f => f(doc)); };
  window.orca = Object.freeze({
    api: { major: 1, minor: 0 },
    host: { has: () => false, call: () => Promise.reject(new Error('not_permitted')) },
    on: (ev, f) => { (listeners[ev] ||= []).push(f); return { dispose() {} } },
    document: Object.freeze({
      get: async () => doc,
      // Like Orca: deliver the current document right away, then each change.
      onDidChange: (f) => { listeners.change.push(f); f(doc); return { dispose() {} } },
      applyEdit: async () => { window.__applyEditCalled = true },
    }),
  });
})();
</script>`

const shell = (dark) =>
  `<!doctype html>\n<html class="${dark ? 'dark' : 'light'}">\n<head>\n<meta charset="utf-8">\n` +
  `<meta http-equiv="Content-Security-Policy" content="${CSP}">\n` +
  `<style>:root{--orca-background:${dark ? '#1e1e1e' : '#ffffff'};--orca-foreground:${dark ? '#d4d4d4' : '#1f2328'};--orca-primary:#3b82f6}</style>\n` +
  mockOrca(sample, dark) +
  `</head>\n` +
  pluginHtml

const browser = await chromium.launch()
let failed = false
for (const dark of [false, true]) {
  const name = dark ? 'dark' : 'light'
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
  const srcdoc = shell(dark).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0">` +
    `<iframe sandbox="allow-scripts" style="width:100%;height:100vh;border:0" srcdoc="${srcdoc}"></iframe>`)
  const frame = page.frames()[1]
  page.on('console', (m) => process.env.DEBUG && console.log('[console]', m.type(), m.text().slice(0, 300)))
  const wait = async (label, fn) => {
    try { await frame.waitForFunction(fn, null, { timeout: 30000 }) } catch (e) {
      const state = await frame.evaluate(() => ({
        renderState: document.documentElement.dataset.renderState,
        h1: document.querySelector('h1')?.textContent,
        content: document.getElementById('content')?.innerHTML.slice(0, 600),
        violations: window.__violations, errors: window.__errors,
      }))
      throw new Error(`${name}: timeout waiting for ${label}: ${JSON.stringify(state, null, 1)}`)
    }
  }
  await wait('initial render', () => document.documentElement.dataset.renderState === 'done')

  // Live update: change the document and wait for the re-render.
  await frame.evaluate(() => window.__setText(
    '= Updated\n\n[mermaid]\n----\ngraph LR\n  X --> Y\n----\n\n[plantuml]\n----\nA -> B : updated\n----\n'))
  await wait('live update', () => document.querySelector('h1')?.textContent === 'Updated' &&
    document.documentElement.dataset.renderState === 'done')
  const live = await frame.evaluate(() => document.querySelectorAll('.diagram.rendered svg').length)
  await frame.evaluate((t) => window.__setText(t), sample)
  await wait('second update', () => document.querySelector('h1')?.textContent !== 'Updated' &&
    document.documentElement.dataset.renderState === 'done')

  const r = await frame.evaluate(() => ({
    rendered: Array.from(document.querySelectorAll('.diagram.rendered')).map(e => e.dataset.kind),
    failed: Array.from(document.querySelectorAll('.diagram.failed')).map(e => e.dataset.kind + ': ' + e.textContent.slice(0, 120)),
    scriptsInContent: document.querySelectorAll('#content script').length,
    strayBodyElements: Array.from(document.body.children).filter(e => !['content'].includes(e.id) && !['SCRIPT', 'STYLE', 'META'].includes(e.tagName)).map(e => e.tagName + '#' + e.id),
    pwned: !!window.__pwned,
    applyEdit: !!window.__applyEditCalled,
    violations: window.__violations,
    errors: window.__errors,
  }))
  await page.screenshot({ path: path.join(OUT, `sample-${name}.png`), fullPage: true })
  console.log(name, JSON.stringify({ ...r, live }, null, 1))

  const expectRendered = 4 // see tests/fixtures/sample.adoc
  const expectFailed = 1
  if (r.rendered.length !== expectRendered || r.failed.length !== expectFailed || r.violations.length ||
      r.errors.length || r.strayBodyElements.length || r.scriptsInContent || r.pwned || r.applyEdit || live !== 2) {
    failed = true
    console.error(`✗ ${name}: unexpected result`)
  } else console.log(`✓ ${name}`)
  await page.close()
}
await browser.close()
process.exit(failed ? 1 : 0)
