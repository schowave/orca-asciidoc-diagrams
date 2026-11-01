// Payload "hljs": highlight.js with its common languages and the GitHub light/dark themes.
// Exposes globalThis.hljs; the theme follows the `dark` class Orca sets on <html>.
import hljs from 'highlight.js/lib/common'
import light from 'highlight.js/styles/github.css'
import dark from 'highlight.js/styles/github-dark.css'

const scope = (css: string, prefix: string) =>
  css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\})\s*([^{}@]+)\{/g, (_m, close, selectors: string) =>
    `${close}${selectors.split(',').map((s) => `${prefix} ${s.trim()}`).join(',')}{`)

const style = document.createElement('style')
style.textContent = scope(light, 'html:not(.dark)') + scope(dark, 'html.dark') +
  // Keep our own code-block background; only the token colors come from the theme.
  'pre code.hljs{background:transparent!important;padding:0!important}'
document.head.appendChild(style)
;(globalThis as any).hljs = hljs
