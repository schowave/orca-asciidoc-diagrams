// Property-based tests (fuzzing): fast-check generates many random inputs, including edge cases such as empty
// strings, lone surrogates and very long runs, and shrinks a failure to the smallest input that still fails.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LoggerManager, NullLogger } from '@asciidoctor/core'
import fc from 'fast-check'
import { decode, encode } from '../../src/base122.ts'
import { convertAdoc } from '../../src/convert.ts'
import { anchorId, cssLength, escapeHtml, splitMath } from '../../src/text.ts'

test('base-122 round-trips any bytes and never emits NUL, CR or "<"', () => {
  fc.assert(
    fc.property(fc.uint8Array({ maxLength: 4096, size: 'max' }), (bytes) => {
      const text = encode(bytes)
      assert.ok(!/[\0\r<]/.test(text))
      assert.deepEqual(decode(text, bytes.length), bytes)
    }),
    { numRuns: 500 },
  )
})

test('escapeHtml leaves no markup characters and can be reversed', () => {
  const unescape = (s: string) =>
    s.replace(
      /&(amp|lt|gt|quot|#39);/g,
      (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e as string]!,
    )
  fc.assert(
    fc.property(fc.string({ unit: 'binary', size: 'large' }), (s) => {
      const out = escapeHtml(s)
      assert.ok(!/[<>"']/.test(out))
      assert.equal(unescape(out), s)
    }),
  )
})

test('cssLength lets only a positive number with px or % through', () => {
  const values = fc.oneof(fc.string(), fc.stringMatching(/^\s*\d{1,4}(\.\d{1,2})?\s*(px|%|em)?\s*$/), fc.anything())
  fc.assert(
    fc.property(values, (v) => {
      const out = cssLength(v)
      if (out !== undefined) assert.match(out, /^\d+(\.\d+)?(px|%)$/)
    }),
  )
})

test('anchorId never throws', () => {
  fc.assert(fc.property(fc.string({ unit: 'binary' }), (s) => void anchorId('#' + s)))
})

test('splitMath keeps all text outside the formulas, in order', () => {
  const piece = fc.oneof(fc.string(), fc.constantFrom('\\$', '\\(', '\\)', '\\[', '\\]', 'x^2', ' '))
  fc.assert(
    fc.property(
      fc.array(piece, { maxLength: 12 }).map((p) => p.join('')),
      fc.boolean(),
      (text, inBlock) => {
        const parts = splitMath(text, inBlock)
        if (!parts) return
        let at = 0
        for (const p of parts) {
          if (typeof p !== 'string') continue
          at = text.indexOf(p, at)
          assert.ok(at >= 0, 'text parts appear in the input, in order')
          at += p.length
        }
      },
    ),
  )
})

// Random documents built from AsciiDoc fragments, with diagram blocks among them.
const FRAGMENTS = [
  '= Title\n',
  ':stem:\n',
  ':toc: left\n',
  '== Section\n',
  '.Caption\n',
  '[[anchor]]\n',
  '[mermaid]\n----\ngraph LR\n  A --> B\n----\n',
  '[plantuml, width=50%, align=center]\n----\nAlice -> Bob\n----\n',
  '[graphviz, layout=neato]\n----\ndigraph { a -> b }\n----\n',
  'plantuml::missing.puml[]\n',
  'include::other.adoc[]\n',
  '[source,ts]\n----\nconst x = 1\n----\n',
  '|===\n| a | b\n|===\n',
  '<<anchor>>\n',
  'stem:[x^2]\n',
  '----\n',
  '\n',
]

// Random documents are full of warnings (unterminated blocks and the like); keep them out of the test output.
LoggerManager.setLogger(new NullLogger())

test('convertAdoc handles any mix of fragments and numbers every diagram placeholder', async () => {
  const doc = fc
    .array(fc.oneof(fc.constantFrom(...FRAGMENTS), fc.string({ unit: 'binary', maxLength: 40 })), {
      maxLength: 15,
      size: 'max',
    })
    .map((p) => p.join('\n'))
  await fc.assert(
    fc.asyncProperty(doc, async (text) => {
      const r = await convertAdoc(text)
      const idx = [...r.html.matchAll(/class="diagram" data-kind="\w+" data-idx="(\d+)"/g)].map((m) => Number(m[1]))
      assert.deepEqual(idx, [...r.diagrams.keys()])
    }),
    { numRuns: 150 },
  )
})
