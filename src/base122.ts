// Binary-to-text encoding for the payloads embedded in editor/index.html: about 14 % overhead instead of
// base64's 33 %. Variant of base-122 (https://blog.kevinalbs.com/base122) for text inside a <script>
// element of a UTF-8 page:
// - The bytes are read as 7-bit groups. A group becomes one ASCII character, unless it is one of the
//   characters the HTML parser would change or that could end the script element:
//   NUL (turned into U+FFFD), CR (turned into LF) and '<' (could start "</script").
// - Such a group is merged with the following group into one two-byte character:
//   U+0080 + (index of the forbidden character) * 128 + (following group).
// - The byte length is stored separately; the zero bits that pad the last group are cut off.
// No DOM and no imports: the build (Node) and the frame (browser) share this file.

const FORBIDDEN = [0x00, 0x0d, 0x3c]

export function encode(bytes: Uint8Array): string {
  const groups: number[] = []
  let acc = 0
  let bits = 0
  for (const byte of bytes) {
    acc = (acc << 8) | byte
    bits += 8
    while (bits >= 7) {
      bits -= 7
      groups.push((acc >> bits) & 0x7f)
    }
    acc &= (1 << bits) - 1
  }
  if (bits > 0) groups.push((acc << (7 - bits)) & 0x7f)

  let out = ''
  for (let i = 0; i < groups.length; i++) {
    const forbidden = FORBIDDEN.indexOf(groups[i])
    if (forbidden < 0) {
      out += String.fromCharCode(groups[i])
    } else {
      const next = i + 1 < groups.length ? groups[++i] : 0 // past the end: padding, cut off on decode
      out += String.fromCharCode(0x80 + forbidden * 128 + next)
    }
  }
  return out
}

export function decode(text: string, length: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(length)
  let pos = 0
  let acc = 0
  let bits = 0
  const push = (group: number) => {
    acc = (acc << 7) | group
    bits += 7
    if (bits >= 8) {
      bits -= 8
      if (pos < length) out[pos++] = (acc >> bits) & 0xff
      acc &= (1 << bits) - 1
    }
  }
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c < 0x80) {
      push(c)
    } else {
      const t = c - 0x80
      push(FORBIDDEN[t >> 7])
      push(t & 0x7f)
    }
  }
  if (pos !== length) throw new Error(`payload decodes to ${pos} bytes, expected ${length}`)
  return out
}
