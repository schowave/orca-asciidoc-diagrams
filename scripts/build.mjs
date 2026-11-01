// Builds editor/index.html: one self-contained page
// (everything inlined, because the frame's CSP allows only inline scripts and styles).
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { gzipSync } from 'fflate'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'
import { selectedStdlib } from './stdlib-list.mjs'

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

// Payloads: classic scripts stored compressed + base64 in inert <script type="application/x-payload">
// blocks and only run when needed, which keeps the single entry HTML well under Orca's 10 MiB:
// - "app" (asciidoctor, DOMPurify, the preview, the brotli decoder) is gzip, because the browser can
//   inflate gzip natively; src/bootstrap.ts does that at startup.
// - Everything else is brotli (about 25 % smaller than gzip), decoded by the app (src/payloads.ts)
//   the first time a document needs it.
// fflate for gzip: node:zlib's gzip output differs between platforms. Brotli uses Node's bundled
// reference encoder; mise pins the Node version.
const gzip = (buf) => Buffer.from(gzipSync(buf, { level: 9, mtime: 0 }))
const brotli = (buf) =>
  zlib.brotliCompressSync(buf, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_LGWIN]: 24,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
    },
  })
const utf8 = (text) => Buffer.from(text, 'utf8')
const STDLIB = selectedStdlib()
const payloads = {
  // The engine is an ES module with many short top-level names (e.g. `CSS`, which would shadow
  // window.CSS). Run it in its own function scope, as a module would; it exports via globalThis.PlantUML.
  plantuml: brotli(utf8(nm('@plantuml/core/themes.js') + '\n;(function(){"use strict";\n' + plantumlClassic + '\n})();')),
  mermaid: brotli(utf8(nm('mermaid/dist/mermaid.min.js'))),
}
// PlantUML stdlib bundles, vendored gzip-compressed (scripts/fetch-stdlib.mjs). Each one is an IIFE
// that registers its files on window.PLANTUML_STDLIB.
for (const lib of STDLIB) {
  const file = path.join(ROOT, 'vendor/plantuml-stdlib', `${lib}.min.js.gz`)
  if (!fs.existsSync(file)) {
    console.error(`PlantUML stdlib "${lib}" is not vendored. Fetch it first with the same selection:\n` +
      `  PLANTUML_STDLIB=${STDLIB.join(',')} node scripts/fetch-stdlib.mjs`)
    process.exit(1)
  }
  payloads[`stdlib:${lib}`] = brotli(zlib.gunzipSync(fs.readFileSync(file)))
}
const payloadBlock = (id, buf) => `<script type="application/x-payload" data-payload="${id}">${buf.toString('base64')}</script>`

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

const bundle = async (entry, extra = {}) =>
  (
    await esbuild.build({
      entryPoints: [path.join(ROOT, entry)],
      bundle: true,
      write: false,
      format: 'iife',
      platform: 'browser',
      target: 'es2022',
      minify: true,
      legalComments: 'none',
      plugins: [nodeBuiltinStub],
      ...extra,
    })
  ).outputFiles[0].text
// KaTeX stylesheet with its woff2 fonts inlined as data: URIs (the frame CSP allows only data: fonts).
// The woff/ttf fallbacks stay external URLs that are never requested, because every browser Orca
// runs on picks the woff2 source first.
const katexCss = (
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'node_modules/katex/dist/katex.min.css')],
    bundle: true,
    write: false,
    minify: true,
    loader: { '.woff2': 'dataurl' },
    external: ['*.woff', '*.ttf'],
  })
).outputFiles[0].text
const katexCssModule = {
  name: 'katex-css',
  setup(build) {
    build.onResolve({ filter: /^\.\/katex-css$/ }, () => ({ path: 'katex-css', namespace: 'katex-css' }))
    build.onLoad({ filter: /.*/, namespace: 'katex-css' }, () => ({ contents: `export default ${JSON.stringify(katexCss)}`, loader: 'js' }))
  },
}

// Optional renderers, each loaded only when a document uses it.
payloads.hljs = brotli(utf8(await bundle('src/payloads/hljs.ts', { loader: { '.css': 'text' } })))
payloads.katex = brotli(utf8(await bundle('src/payloads/katex.ts', { plugins: [nodeBuiltinStub, katexCssModule] })))
// viz.js 2 (Graphviz compiled to asm.js, no wasm): it attaches render/Module to an existing global Viz.
payloads.graphviz = brotli(utf8('self.Viz={};\n' + nm('viz.js/full.render.js')))

const app = gzip(utf8(await bundle('src/editor.ts')))
const bootstrap = await bundle('src/bootstrap.ts')
const css = fs.readFileSync(path.join(ROOT, 'src/editor.css'), 'utf8')

const html = `<meta charset="utf-8">
<style>${css}</style>
<div id="content"></div>
${Object.entries(payloads).map(([id, buf]) => payloadBlock(id, buf)).join('\n')}
${payloadBlock('app', app)}
${script(bootstrap)}
`

// The plugin lives at the repository root (Orca installs from a Git commit): orca-plugin.json,
// editor/index.html (committed build output), images/, LICENSE, THIRD_PARTY_NOTICES.md.
fs.mkdirSync(path.join(ROOT, 'editor'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'editor/index.html'), html)

// dist/plugin mirrors only the plugin files, for Orca's "Development folders" (the repository root
// would also contain node_modules). Overwrite in place, never delete: Orca watches the folder.
const PLUGIN_FILES = ['orca-plugin.json', 'editor/index.html', 'LICENSE', 'THIRD_PARTY_NOTICES.md']
const images = fs.existsSync(path.join(ROOT, 'images')) ? fs.readdirSync(path.join(ROOT, 'images')).map((f) => `images/${f}`) : []
for (const rel of [...PLUGIN_FILES, ...images]) {
  fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true })
  fs.copyFileSync(path.join(ROOT, rel), path.join(OUT, rel))
}

const bytes = Buffer.byteLength(html)
console.log(`editor/index.html: ${(bytes / 1024 / 1024).toFixed(2)} MiB`)
for (const [id, buf] of Object.entries({ app, ...payloads })) console.log(`  ${id}: ${(buf.length * 4 / 3 / 1024).toFixed(0)} KiB`)
if (bytes > MAX_ENTRY_BYTES) {
  console.error(`Entry exceeds ${MAX_ENTRY_BYTES} bytes`)
  process.exit(1)
}
