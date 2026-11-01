// Reproduces how Orca 1.4.245 hosts a custom editor: a srcdoc <iframe sandbox="allow-scripts"> whose
// shell sets the exact plugin CSP, cancels clicks on <a href>, and provides window.orca (mocked here).
// Used by the tests and by scripts/media.mjs.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pluginHtml = () => fs.readFileSync(path.join(ROOT, 'dist/plugin/editor/index.html'), 'utf8')

// Copied from Orca src/shared/plugins/frames/plugin-panel-shell.ts (PLUGIN_PANEL_CSP).
const CSP =
  "default-src 'none'; connect-src 'none'; script-src 'unsafe-inline'; " +
  "style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"

const mockOrca = (text) => `<script>
window.__violations = [];
document.addEventListener('securitypolicyviolation', e => __violations.push(e.violatedDirective + ' ' + (e.blockedURI || '')));
window.__errors = [];
window.addEventListener('error', e => __errors.push(String(e.message)));
window.addEventListener('unhandledrejection', e => __errors.push('unhandled: ' + String(e.reason)));
(function () {
  const listeners = { change: [], theme: [] };
  const doc = { version: 1, readOnly: false, content: { kind: 'text', text: ${JSON.stringify(text).replace(/</g, '\\u003c')} } };
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

// Subset of Orca's shell script: it cancels every click on <a href> (plugin-panel-shell.ts).
const ORCA_SHELL_POLICY = `<script>
window.addEventListener('click', function (event) {
  var node = event.target
  while (node && node !== document) {
    if (node.nodeType === 1 && node.tagName === 'A' && node.hasAttribute('href')) {
      event.preventDefault(); event.stopImmediatePropagation(); return
    }
    node = node.parentNode
  }
}, true)
</script>`

export const shell = (dark, text) =>
  `<!doctype html>\n<html class="${dark ? 'dark' : 'light'}">\n<head>\n<meta charset="utf-8">\n` +
  `<meta http-equiv="Content-Security-Policy" content="${CSP}">\n` +
  `<style>:root{--orca-background:${dark ? '#1e1e1e' : '#ffffff'};--orca-foreground:${dark ? '#d4d4d4' : '#1f2328'};--orca-primary:#3b82f6}</style>\n` +
  mockOrca(text) +
  ORCA_SHELL_POLICY +
  `</head>\n` +
  pluginHtml()

/** Outer page that hosts the plugin frame like Orca does. */
export const hostPage = (dark, text, frameStyle = 'width:100%;height:100vh;border:0') =>
  `<!doctype html><meta charset="utf-8"><body style="margin:0">` +
  `<iframe sandbox="allow-scripts" style="${frameStyle}" srcdoc="${shell(dark, text).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe>`
