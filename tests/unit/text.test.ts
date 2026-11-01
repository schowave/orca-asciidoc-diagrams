import assert from 'node:assert/strict'
import { test } from 'node:test'
import { escapeHtml, notBundledMessage, unbundledStdlib } from '../../src/text.ts'

test('escapeHtml escapes the five HTML special characters', () => {
  assert.equal(
    escapeHtml(`<a href="x" title='y'>&</a>`),
    '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
  )
})

test('escapeHtml leaves plain text alone', () => {
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
