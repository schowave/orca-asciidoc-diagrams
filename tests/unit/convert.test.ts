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
  assert.match(r.html, /<div class="diagram" data-kind="mermaid" data-idx="0"><\/div><div class="title">Flow<\/div>/)
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
