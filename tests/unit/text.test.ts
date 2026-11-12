import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  anchorId,
  cssLength,
  diagramKey,
  escapeHtml,
  notBundledMessage,
  splitMath,
  unbundledStdlib,
  wrapPlantUml,
} from '../../src/text.ts'

test('escapeHtml escapes the five HTML special characters', () => {
  assert.equal(
    escapeHtml(`<a href="x" title='y'>&</a>`),
    '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
  )
})

test('escapeHtml escapes arrows, as in diagram sources', () => {
  assert.equal(escapeHtml('Order -> Payment'), 'Order -&gt; Payment')
  assert.equal(escapeHtml('plain'), 'plain')
})

test('notBundledMessage lists the bundled libraries', () => {
  assert.equal(
    notBundledMessage('awslib14', ['c4', 'azure']),
    'PlantUML library <awslib14> is not bundled in this preview. Bundled: c4, azure.',
  )
})

test('notBundledMessage says none when nothing is bundled', () => {
  assert.match(notBundledMessage('c4', []), /Bundled: none\.$/)
})

test('unbundledStdlib returns the first library that is not bundled', () => {
  const bundled = new Set(['c4', 'azure'])
  assert.equal(unbundledStdlib('!include <C4/C4_Context>\n!include <awslib14/AWSCommon>', bundled), 'awslib14')
})

test('unbundledStdlib ignores bundled libraries, case-insensitively, and local includes', () => {
  const bundled = new Set(['c4'])
  assert.equal(unbundledStdlib('  !include_once <C4/C4_Container>\n!include local.puml', bundled), undefined)
})

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

test('cssLength accepts numbers, px and %, and nothing else', () => {
  assert.equal(cssLength('300'), '300px')
  assert.equal(cssLength(' 12.5px '), '12.5px')
  assert.equal(cssLength('40%'), '40%')
  for (const bad of [undefined, '', '0', '3em', '1px;color:red', 'auto']) assert.equal(cssLength(bad), undefined)
})
