import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
// @ts-expect-error plain JavaScript module without types
import { selectedStdlib } from '../../scripts/stdlib-list.mjs'

const original = process.env.PLANTUML_STDLIB
afterEach(() => {
  if (original === undefined) delete process.env.PLANTUML_STDLIB
  else process.env.PLANTUML_STDLIB = original
})

test('selectedStdlib returns the default list without PLANTUML_STDLIB', () => {
  delete process.env.PLANTUML_STDLIB
  const libs: string[] = selectedStdlib()
  assert.ok(libs.includes('c4'))
  assert.ok(libs.every((l) => l === l.toLowerCase()))
})

test('selectedStdlib takes PLANTUML_STDLIB, trimmed and lower-cased', () => {
  process.env.PLANTUML_STDLIB = ' C4, AWSLib14 ,,'
  assert.deepEqual(selectedStdlib(), ['c4', 'awslib14'])
})
