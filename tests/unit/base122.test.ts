import assert from 'node:assert/strict'
import { randomBytes as nodeRandomBytes } from 'node:crypto'
import { test } from 'node:test'
import { decode, encode } from '../../src/base122.ts'

const randomBytes = (n: number) => new Uint8Array(nodeRandomBytes(n))
const roundTrip = (bytes: Uint8Array) => assert.deepEqual(decode(encode(bytes), bytes.length), bytes)

test('round-trips empty, short and random data', () => {
  roundTrip(new Uint8Array(0))
  for (let n = 1; n <= 32; n++) roundTrip(randomBytes(n))
  roundTrip(randomBytes(100_003))
})

test('round-trips every byte value and runs of forbidden groups', () => {
  roundTrip(Uint8Array.from({ length: 256 }, (_, i) => i))
  roundTrip(new Uint8Array(64)) // all zero bits: every group is NUL
  roundTrip(new Uint8Array([0x78])) // 0111100|0: the only group is '<', with nothing after it
  roundTrip(new Uint8Array([0x1a])) // 0001101|0: the only group is CR
})

test('output contains no NUL, CR or "<", and only one- or two-byte UTF-8 characters', () => {
  const text = encode(randomBytes(50_000))
  assert.ok(!/[\0\r<]/.test(text))
  for (let i = 0; i < text.length; i++) assert.ok(text.charCodeAt(i) < 0x200)
})

test('needs about 8/7 bytes of UTF-8 per input byte', () => {
  const bytes = randomBytes(200_000)
  const ratio = Buffer.byteLength(encode(bytes), 'utf8') / bytes.length
  assert.ok(ratio < 1.17, `ratio ${ratio}`)
})

test('decode rejects a wrong length', () => {
  const text = encode(new Uint8Array([1, 2, 3]))
  assert.throws(() => decode(text, 10), /expected 10/)
})
