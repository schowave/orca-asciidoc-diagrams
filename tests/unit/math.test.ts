import assert from 'node:assert/strict'
import { test } from 'node:test'
import { anchorId, diagramKey, splitMath, wrapPlantUml } from '../../src/text.ts'

test('splitMath returns undefined for text without formulas', () => {
  assert.equal(splitMath('a $5 price and (parentheses)', false), undefined)
})

test('splitMath finds asciimath and latexmath inline', () => {
  assert.deepEqual(splitMath(String.raw`E \(mc^2\) and \$sum_i\$.`, false), [
    'E ',
    { tex: 'mc^2', notation: 'latexmath', display: false },
    ' and ',
    { tex: 'sum_i', notation: 'asciimath', display: false },
    '.',
  ])
})

test('splitMath treats \\[…\\] and everything in a stem block as display math', () => {
  assert.deepEqual(splitMath(String.raw`\[x\]`, false), [{ tex: 'x', notation: 'latexmath', display: true }])
  assert.deepEqual(splitMath(String.raw`\$x\$`, true), [{ tex: 'x', notation: 'asciimath', display: true }])
})

test('splitMath spans line breaks inside a formula', () => {
  assert.deepEqual(splitMath('\\(a\n+ b\\)', false), [{ tex: 'a\n+ b', notation: 'latexmath', display: false }])
})

test('wrapPlantUml adds @startuml only when the source has no @start line', () => {
  assert.equal(wrapPlantUml('A -> B'), '@startuml\nA -> B\n@enduml')
  assert.equal(wrapPlantUml('  @startmindmap\n* a\n@endmindmap'), '  @startmindmap\n* a\n@endmindmap')
})

test('diagramKey carries the theme only for Mermaid', () => {
  const g = { kind: 'graphviz' as const, src: 'digraph{}', layout: 'neato' }
  assert.equal(diagramKey(g, true), diagramKey(g, false))
  const m = { kind: 'mermaid' as const, src: 'graph LR' }
  assert.notEqual(diagramKey(m, true), diagramKey(m, false))
  assert.notEqual(diagramKey({ ...g, layout: 'dot' }, false), diagramKey(g, false))
})

test('anchorId decodes percent escapes and keeps a stray percent sign', () => {
  assert.equal(anchorId('#caf%C3%A9'), 'café')
  assert.equal(anchorId('#100%'), '100%')
})
