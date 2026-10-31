// Builds dist/plugin/: the manifest plus one self-contained editor/index.html
// (everything inlined, because the frame's CSP allows only inline scripts and styles).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'dist/plugin')
const MAX_ENTRY_BYTES = 9.5 * 1024 * 1024
const nm = (p) => fs.readFileSync(path.join(ROOT, 'node_modules', p), 'utf8')

// Keep the HTML parser from ending or escaping the inline <script> early.
const safeScript = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')
const script = (js) => `<script>${safeScript(js)}</script>`

const plantumlJs = nm('@plantuml/core/plantuml.js')
const exportStmt = /export\{(\w+) as render,(\w+) as renderToString\};?\s*$/
if (!exportStmt.test(plantumlJs)) throw new Error('Unexpected @plantuml/core export footer; update build.mjs')
const plantumlClassic = plantumlJs.replace(exportStmt, 'globalThis.PlantUML={render:$1,renderToString:$2};')

// PlantUML stdlib bundles (vendor/plantuml-stdlib, see scripts/fetch-stdlib.mjs). Each bundle is an
// IIFE that registers itself on window; we wrap it in a function so it only runs when a diagram needs it.
const STDLIB = ['c4', 'kubernetes', 'azure']
const stdlibJs = 'window.__pumlStdlib={' + STDLIB.map((lib) =>
  `${JSON.stringify(lib)}:function(){${fs.readFileSync(path.join(ROOT, 'vendor/plantuml-stdlib', `${lib}.min.js`), 'utf8')}\n}`
).join(',') + '};'

// asciidoctor's browser build still has guarded `import('node:…')` calls (fs, path). Left external,
// they trigger a CSP script-src violation in the frame. Resolve them to a module that throws on load,
// which is exactly the "not in Node" case asciidoctor already handles.
const nodeBuiltinStub = {
  name: 'node-builtin-stub',
  setup(build) {
    build.onResolve({ filter: /^node:/ }, (args) => ({ path: args.path, namespace: 'node-stub' }))
    build.onLoad({ filter: /.*/, namespace: 'node-stub' }, (args) => ({
      contents: `throw new Error(${JSON.stringify(args.path + ' is not available in the preview')})`,
      loader: 'js',
    }))
  },
}

const app = await esbuild.build({
  entryPoints: [path.join(ROOT, 'src/editor.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  plugins: [nodeBuiltinStub],
})
const css = fs.readFileSync(path.join(ROOT, 'src/editor.css'), 'utf8')

const html = `<meta charset="utf-8">
<style>${css}</style>
<div id="content"></div>
${script(nm('@plantuml/core/themes.js'))}
${script(plantumlClassic)}
${script(nm('mermaid/dist/mermaid.min.js'))}
${script(stdlibJs)}
${script(app.outputFiles[0].text)}
`

// Overwrite in place, never delete OUT: Orca watches it as a development folder.
fs.mkdirSync(path.join(OUT, 'editor'), { recursive: true })
fs.copyFileSync(path.join(ROOT, 'plugin/orca-plugin.json'), path.join(OUT, 'orca-plugin.json'))
fs.copyFileSync(path.join(ROOT, 'LICENSE'), path.join(OUT, 'LICENSE'))
fs.copyFileSync(path.join(ROOT, 'THIRD_PARTY_NOTICES.md'), path.join(OUT, 'THIRD_PARTY_NOTICES.md'))
fs.writeFileSync(path.join(OUT, 'editor/index.html'), html)

const bytes = Buffer.byteLength(html)
console.log(`editor/index.html: ${(bytes / 1024 / 1024).toFixed(2)} MiB`)
if (bytes > MAX_ENTRY_BYTES) {
  console.error(`Entry exceeds ${MAX_ENTRY_BYTES} bytes`)
  process.exit(1)
}
