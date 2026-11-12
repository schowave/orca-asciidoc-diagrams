import assert from 'node:assert/strict'
import { test } from 'node:test'
import { convertAdoc } from '../../src/convert.ts'

test('diagram blocks become indexed placeholders, sources stay out of the HTML', async () => {
  const r = await convertAdoc(
    '= Doc\n\n.Flow\n[mermaid]\n----\ngraph LR\n  A --> B\n----\n\n[graphviz, layout=neato]\n----\ndigraph { a -> b }\n----\n',
  )
  assert.deepEqual(r.diagrams, [
    { kind: 'mermaid', src: 'graph LR\n  A --> B', layout: undefined },
    { kind: 'graphviz', src: 'digraph { a -> b }', layout: 'neato' },
  ])
  assert.match(
    r.html,
    /<div class="diagram" data-kind="mermaid" data-idx="0"><\/div><div class="title">Figure 1\. Flow<\/div>/,
  )
  assert.match(r.html, /data-kind="graphviz" data-idx="1"/)
  assert.doesNotMatch(r.html, /A --> B/)
})

test('each conversion numbers its diagrams from zero', async () => {
  await convertAdoc('[plantuml]\n----\nA -> B\n----\n')
  const r = await convertAdoc('[plantuml]\n----\nC -> D\n----\n')
  assert.deepEqual(r.diagrams, [{ kind: 'plantuml', src: 'C -> D', layout: undefined }])
  assert.match(r.html, /data-idx="0"/)
})

test('include:: becomes a visible placeholder', async () => {
  const r = await convertAdoc('include::chapters/intro.adoc[]\n')
  assert.match(r.html, /unresolved-include/)
  assert.match(r.html, /chapters\/intro\.adoc/)
})

test('reports the TOC position and whether :stem: is set', async () => {
  assert.deepEqual(await convertAdoc(':toc: left\n:stem: latexmath\n\n== A\n').then((r) => [r.tocPosition, r.stem]), [
    'left',
    true,
  ])
  assert.deepEqual(await convertAdoc('== A\n').then((r) => [r.tocPosition, r.stem]), [undefined, false])
})

test('a diagram is a figure: id, caption number shared with images, role and align', async () => {
  const r = await convertAdoc(
    '.Photo\nimage::data:image/png;base64,AA[x]\n\n[[ctx]]\n.Context *map*\n[plantuml, ctx, png, align=center, role=wide]\n----\nA -> B\n----\n\nSee <<ctx>>.\n',
  )
  assert.match(r.html, /Figure 1\. Photo/)
  assert.match(r.html, /<div id="ctx" class="diagramblock text-center wide" data-kind="plantuml">/)
  assert.match(r.html, /<div class="title">Figure 2\. Context <strong>map<\/strong><\/div>/)
  assert.match(r.html, /<a href="#ctx">Context <strong>map<\/strong><\/a>/)
  assert.deepEqual(r.diagrams, [{ kind: 'plantuml', src: 'A -> B', layout: undefined }])
})

test('figure-caption and caption= control the caption, an untitled diagram has none', async () => {
  const doc = (head: string, attrs = '') => `${head}\n\n.T\n[mermaid${attrs}]\n----\ngraph LR\n----\n`
  assert.match((await convertAdoc(doc(':figure-caption: Abbildung'))).html, /class="title">Abbildung 1\. T</)
  assert.match((await convertAdoc(doc(':figure-caption!:'))).html, /class="title">T</)
  assert.match((await convertAdoc(doc('', ', caption="Fig A: "'))).html, /class="title">Fig A: T</)
  assert.doesNotMatch((await convertAdoc('[mermaid]\n----\ngraph LR\n----\n')).html, /class="title"/)
})

test('width and height become checked CSS lengths', async () => {
  const r = await convertAdoc(
    '[graphviz, width=300, height=40%]\n----\ndigraph {}\n----\n\n[graphviz, width="1px;x"]\n----\ndigraph {}\n----\n',
  )
  assert.match(r.html, /data-idx="0" data-width="300px" data-height="40%"/)
  assert.match(r.html, /data-idx="1"><\/div>/)
})

test('a diagram block macro becomes a placeholder that keeps its figure', async () => {
  const r = await convertAdoc('.Deploy\n[#dep]\nplantuml::diagrams/deploy.puml[]\n\nmermaid::flow.mmd[]\n')
  assert.match(
    r.html,
    /<div id="dep" class="diagramblock" data-kind="plantuml">.*diagrams\/deploy\.puml.*Figure 1\. Deploy/,
  )
  assert.match(r.html, /data-kind="mermaid">.*not resolvable.*flow\.mmd/)
  assert.deepEqual(r.diagrams, [])
})
