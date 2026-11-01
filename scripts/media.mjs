// Generates the listing images (images/) and the README demo GIF (docs/media/demo.gif) from the real
// build, rendered in the same Orca-like sandboxed frame the tests use. Run after `npm run build`:
//   node scripts/media.mjs
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { hostPage } from '../tests/orca-frame.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const IMAGES = path.join(ROOT, 'images')
const MEDIA = path.join(ROOT, 'docs/media')
fs.mkdirSync(IMAGES, { recursive: true })
fs.mkdirSync(MEDIA, { recursive: true })
const demo = fs.readFileSync(path.join(ROOT, 'docs/demo.adoc'), 'utf8')

const browser = await chromium.launch()

async function waitRendered(frame) {
  await frame.waitForFunction(() => document.documentElement.dataset.renderState === 'done', null, { timeout: 60000 })
}

// --- Screenshots (1280×800 CSS px at 2×, i.e. 2560×1600; light and dark) ----------------------------
// Orca's minimum screenshot size is 1280×800; using it as the CSS viewport keeps text readable in the
// listing's thumbnails, and the 2× pixel ratio keeps it sharp.
async function screenshot(dark, file, viewport = { width: 1280, height: 800 }, deviceScaleFactor = 2, scrollTo) {
  const page = await browser.newPage({ viewport, deviceScaleFactor })
  await page.setContent(hostPage(dark, demo))
  const frame = page.frames()[1]
  await waitRendered(frame)
  if (scrollTo) await frame.evaluate((id) => document.getElementById(id).scrollIntoView(), scrollTo)
  await page.screenshot({ path: file })
  await page.close()
  return file
}
await screenshot(false, path.join(IMAGES, 'screenshot-light.png'))
// The dark shot shows the second half of the demo: Graphviz, highlighted code and math.
await screenshot(true, path.join(IMAGES, 'screenshot-dark.png'), undefined, 2, '_order_pipeline')
// Narrower shot for the cover, so the document fills the card.
const tmpShot = path.join(os.tmpdir(), `adoc-cover-${process.pid}.png`)
const light = await screenshot(false, tmpShot, { width: 900, height: 900 }, 2)

// --- Icon (256×256) --------------------------------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 256, height: 256 } })
  await page.setContent(`<body style="margin:0;background:transparent">
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs>
  <rect x="8" y="8" width="240" height="240" rx="52" fill="url(#g)"/>
  <path d="M70 46h82l38 38v126a10 10 0 0 1-10 10H70a10 10 0 0 1-10-10V56a10 10 0 0 1 10-10z" fill="#fff"/>
  <path d="M152 46v28a10 10 0 0 0 10 10h28" fill="#dbeafe"/>
  <rect x="78" y="98" width="38" height="26" rx="5" fill="#2563eb"/>
  <rect x="134" y="98" width="38" height="26" rx="5" fill="#7c3aed"/>
  <path d="M116 111h14" stroke="#1e293b" stroke-width="5" stroke-linecap="round"/>
  <path d="M126 104l7 7-7 7" fill="none" stroke="#1e293b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="106" y="150" width="38" height="26" rx="5" fill="#0ea5e9"/>
  <path d="M97 124v15h28v11M153 124v15h-28" fill="none" stroke="#1e293b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="128" y="206" text-anchor="middle" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="22" font-weight="700" fill="#334155">.adoc</text>
</svg></body>`)
  await page.screenshot({ path: path.join(IMAGES, 'icon.png'), omitBackground: true })
  await page.close()
}

// --- Cover (1600×1000) -----------------------------------------------------------------------------
// Orca shows the cover as a wide banner, cropped to roughly the middle third (y ≈ 330–670), so all
// content sits in that band; the rest is background.
{
  const shot = fs.readFileSync(light).toString('base64')
  fs.rmSync(light)
  const icon = fs.readFileSync(path.join(IMAGES, 'icon.png')).toString('base64')
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  await page.setContent(`<body style="margin:0;width:1600px;height:1000px;overflow:hidden;position:relative;
    background:radial-gradient(1200px 600px at 75% 50%,rgba(124,58,237,.45),transparent 70%),linear-gradient(135deg,#0b1224 0%,#1e3a8a 60%,#4c1d95 100%);
    font-family:-apple-system,Helvetica,Arial,sans-serif;color:#fff">
  <div style="position:absolute;left:90px;top:360px;width:700px;height:280px;display:flex;flex-direction:column;justify-content:center">
    <div style="display:flex;align-items:center;gap:22px">
      <img src="data:image/png;base64,${icon}" style="width:84px;height:84px">
      <div style="font-size:66px;font-weight:800;line-height:1">AsciiDoc Preview</div>
    </div>
    <div style="font-size:30px;margin-top:26px;line-height:1.3;opacity:.92">Diagrams, code and math, live and fully offline</div>
    <div style="margin-top:28px;display:flex;gap:12px;font-size:22px">
      ${['PlantUML', 'Mermaid', 'Graphviz', 'Code', 'Math', 'Offline'].map((t) => `<span style="padding:7px 16px;border-radius:999px;background:rgba(255,255,255,.15)">${t}</span>`).join('')}
    </div>
  </div>
  <div style="position:absolute;left:860px;top:345px;width:660px;height:310px;overflow:hidden;border-radius:16px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.5)">
    <img src="data:image/png;base64,${shot}" style="position:absolute;left:-170px;top:-245px;width:900px">
  </div>
</body>`)
  await page.screenshot({ path: path.join(IMAGES, 'cover.png') })
  // What Orca's banner shows: the middle band.
  await page.screenshot({
    path: path.join(os.tmpdir(), 'adoc-cover-band.png'),
    clip: { x: 0, y: 330, width: 1600, height: 340 },
  })
  await page.close()
}

// --- Demo GIF: typing AsciiDoc on the left, live preview on the right ------------------------------
{
  const W = 1280
  const H = 720
  const intro = '= Online Shop\n\nThe shop takes orders and ships parcels.\n\n'
  const steps = [
    '== Checkout\n\n',
    '[plantuml]\n----\n',
    'actor Customer\n',
    'Customer -> Shop : Place order\n',
    'Shop -> Payment : Authorize\n',
    'Payment --> Shop : OK\n',
    'Shop --> Customer : Confirmed\n',
    '----\n\n',
    '== Order states\n\n',
    '[mermaid]\n----\n',
    'stateDiagram-v2\n',
    '  [*] --> Placed\n',
    '  Placed --> Paid\n',
    '  Paid --> Shipped\n',
    '  Shipped --> [*]\n',
    '----\n',
  ]
  const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const page = await browser.newPage({ viewport: { width: W, height: H } })
  const html = hostPage(false, intro, 'position:absolute;left:520px;top:0;width:760px;height:720px;border:0').replace(
    '<body style="margin:0">',
    `<body style="margin:0;background:#fff">
      <pre id="src" style="position:absolute;left:0;top:0;width:520px;height:720px;margin:0;box-sizing:border-box;
        padding:28px 24px;background:#1e1e2e;color:#cdd6f4;font:15px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;
        white-space:pre-wrap;overflow:hidden;border-right:1px solid #313244"></pre>`,
  )
  await page.setContent(html)
  const frame = page.frames()[1]
  await waitRendered(frame)

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adoc-gif-'))
  const frames = []
  const snap = async (seconds) => {
    const file = path.join(dir, `f${String(frames.length).padStart(3, '0')}.png`)
    await page.screenshot({ path: file })
    frames.push({ file, seconds })
  }
  const showSource = (text) =>
    page.evaluate(
      ([t]) => {
        document.getElementById('src').innerHTML = t + '<span style="background:#f5c2e7;color:#1e1e2e">&nbsp;</span>'
      },
      [escape(text)],
    )

  let text = intro
  await showSource(text)
  await snap(1.2)
  for (const step of steps) {
    text += step
    await showSource(text)
    await snap(0.35) // the keystrokes land in the source...
    await frame.evaluate((t) => window.__setText(t), text)
    await page.waitForTimeout(350) // ...the preview re-renders after its 250 ms debounce
    await waitRendered(frame)
    // Keep the newest part of the document in view, like following along while writing.
    await frame.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
    await snap(0.45)
  }
  frames[frames.length - 1].seconds = 3

  const list =
    frames.map((f) => `file '${f.file}'\nduration ${f.seconds}`).join('\n') + `\nfile '${frames.at(-1).file}'\n`
  fs.writeFileSync(path.join(dir, 'frames.txt'), list)
  const gif = path.join(MEDIA, 'demo.gif')
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    path.join(dir, 'frames.txt'),
    '-vf',
    'scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
    '-loop',
    '0',
    gif,
  ])
  fs.rmSync(dir, { recursive: true, force: true })
  await page.close()
}

await browser.close()
for (const f of [...fs.readdirSync(IMAGES).map((f) => path.join(IMAGES, f)), path.join(MEDIA, 'demo.gif')]) {
  console.log(`${path.relative(ROOT, f)}: ${(fs.statSync(f).size / 1024).toFixed(0)} KiB`)
}
