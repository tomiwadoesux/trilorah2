/** Bounded readers for interchange text. They never resolve external entities or execute markup. */
export function rtfText(value: string | Buffer): string {
  // RTF is a byte format. Decoding a binary RTF blob as UTF-8 first irreversibly
  // replaces legacy code-page characters before its ansicpg declaration is read.
  const binary = Buffer.isBuffer(value)
  const input = binary ? value.toString('latin1') : value
  if (!input.trimStart().startsWith('{\\rtf')) return (binary ? value.toString('utf8') : input).replace(/\r\n?/g, '\n')
  const stack: Array<{ skip: boolean; uc: number; encoding: string }> = []
  let state = { skip: false, uc: 1, encoding: 'windows-1252' }, output = '', fallback = 0
  const destinations = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'header', 'footer', 'fldinst', 'listtable', 'listoverridetable', 'generator', 'xmlopen', 'xmlclose'])
  const emit = (text: string) => { if (fallback) fallback--; else if (!state.skip) output += text }
  for (let i = 0; i < input.length;) {
    const char = input[i++]
    if (char === '{') {
      fallback = 0
      if (stack.length > 128) throw new Error('The rich text is nested too deeply.')
      stack.push({ ...state })
    } else if (char === '}') {
      fallback = 0
      const parent = stack.pop()
      if (!parent) throw new Error('The rich text has an unmatched closing group.')
      state = parent
    } else if (char !== '\\') {
      if (char !== '\r' && char !== '\n') {
        if (!binary) emit(char)
        else {
          const start = i - 1
          while (i < input.length && !/[{}\\\r\n]/.test(input[i])) i++
          const run = input.slice(start, i), skipped = Math.min(fallback, run.length)
          fallback -= skipped
          if (!state.skip) output += new TextDecoder(state.encoding).decode(Buffer.from(run.slice(skipped), 'latin1'))
        }
      }
    } else {
      const next = input[i++]
      if (next === '*' ) { state.skip = true; continue }
      if (next === '\\' || next === '{' || next === '}') { emit(next); continue }
      if (next === '\r' || next === '\n') {
        if (next === '\r' && input[i] === '\n') i++
        emit('\n'); continue
      }
      if (next === "'") {
        const bytes: number[] = []
        i -= 2
        while (input.slice(i, i + 2) === "\\'" && /^[0-9a-f]{2}$/i.test(input.slice(i + 2, i + 4))) {
          bytes.push(parseInt(input.slice(i + 2, i + 4), 16)); i += 4
        }
        if (!bytes.length) throw new Error('Invalid rich-text character escape.')
        const skipped = Math.min(fallback, bytes.length)
        fallback -= skipped
        if (!state.skip) output += new TextDecoder(state.encoding).decode(Uint8Array.from(bytes.slice(skipped)))
        continue
      }
      if (next === '~') { emit('\u00a0'); continue }
      if (!next || !/[a-z]/i.test(next)) continue
      i--
      const match = /^[a-z]+(-?\d+)? ?/i.exec(input.slice(i))!
      const word = /^[a-z]+/i.exec(match[0])![0]
      const number = match[1] === undefined ? undefined : Number(match[1])
      i += match[0].length
      if (destinations.has(word)) state.skip = true
      if (word === 'uc' && number !== undefined) state.uc = Math.max(0, Math.min(16, number))
      else if (word === 'ansicpg' && number) {
        const candidate = ({ 65001: 'utf-8', 932: 'shift_jis', 936: 'gbk', 949: 'euc-kr', 950: 'big5' } as Record<number, string>)[number] || `windows-${number}`
        try { new TextDecoder(candidate); state.encoding = candidate } catch { /* Default Windows encoding. */ }
      } else if (word === 'bin' && number !== undefined) {
        if (number < 0 || i + number > input.length) throw new Error('Invalid rich-text binary block.')
        i += number
      } else if (word === 'u' && number !== undefined) {
        if (!state.skip) output += String.fromCharCode(number & 0xffff)
        fallback = state.uc
      } else if (['par', 'line', 'page'].includes(word)) emit('\n')
      else if (word === 'tab') emit('\t')
      else if (word === 'emdash') emit('—')
      else if (word === 'endash') emit('–')
      else if (word === 'bullet') emit('•')
      else if (word === 'lquote') emit('‘')
      else if (word === 'rquote') emit('’')
      else if (word === 'ldblquote') emit('“')
      else if (word === 'rdblquote') emit('”')
    }
  }
  if (stack.length) throw new Error('The rich text is incomplete.')
  return output.replace(/\r\n?/g, '\n').trim()
}

export interface XmlNode { name: string; attrs: Record<string, string>; children: XmlNode[]; text: string }
export function xmlText(value: string): string {
  if (/&(?!#x[0-9a-fA-F]+;|#\d+;|amp;|lt;|gt;|quot;|apos;)/.test(value)) throw new Error('Invalid XML entity.')
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, entity: string) => {
    if (entity[0] !== '#') return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[entity]
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
    if (!Number.isInteger(code) || !(code === 9 || code === 10 || code === 13 || code >= 0x20 && code <= 0xd7ff || code >= 0xe000 && code <= 0xfffd || code >= 0x10000 && code <= 0x10ffff)) throw new Error('Invalid XML character.')
    return String.fromCodePoint(code)
  })
}
export function readXml(input: string): XmlNode {
  if (/<!DOCTYPE|<!ENTITY/i.test(input)) throw new Error('XML with document types or entities is not supported.')
  const root: XmlNode = { name: '#document', attrs: {}, children: [], text: '' }
  const stack = [root]
  let count = 0, end = 0
  const tokens = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<(?:[^<>"']|"[^"<]*"|'[^'<]*')*>|[^<]+/g
  for (const token of input.matchAll(tokens)) {
    if (token.index !== end) throw new Error('Malformed XML.')
    end += token[0].length
    const value = token[0], parent = stack[stack.length - 1]
    if (value.startsWith('<!--') || value.startsWith('<?')) continue
    if (value.startsWith('<![CDATA[')) { parent.text += value.slice(9, -3); continue }
    if (!value.startsWith('<')) {
      if (parent === root && value.trim()) throw new Error('Text outside the XML document.')
      parent.text += xmlText(value); continue
    }
    if (value.startsWith('</')) {
      if (stack.length < 2 || value.slice(2, -1).trim() !== parent.name) throw new Error('Unmatched XML element.')
      stack.pop(); continue
    }
    const name = /^<([A-Za-z_:][\w:.-]*)/.exec(value)?.[1]
    if (!name || ++count > 100_000 || stack.length > 64) throw new Error('Invalid or overly complex XML.')
    const attrs: Record<string, string> = Object.create(null)
    const attributes = value.slice(1 + name.length).replace(/\/?\s*>$/, '')
    const attribute = /\s+([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gy
    let at = 0
    while (at < attributes.length && attributes.slice(at).trim()) {
      attribute.lastIndex = at
      const attr = attribute.exec(attributes)
      if (!attr || Object.hasOwn(attrs, attr[1])) throw new Error('Invalid or duplicate XML attribute.')
      attrs[attr[1]] = xmlText(attr[2] ?? attr[3]); at = attribute.lastIndex
    }
    const child = { name, attrs, children: [], text: '' }
    parent.children.push(child)
    if (!/\/\s*>$/.test(value)) stack.push(child)
  }
  if (end !== input.length || stack.length !== 1 || root.children.length !== 1) throw new Error('Incomplete XML document.')
  return root.children[0]
}
export function descendants(node: XmlNode, name: string): XmlNode[] {
  return node.children.flatMap(child => [...(child.name === name ? [child] : []), ...descendants(child, name)])
}

/** Minimal protobuf wire reader; field numbers live in the format-specific adapter. */
export class Proto {
  fields = new Map<number, Array<Buffer | number>>()
  constructor(buffer: Buffer) {
    let at = 0, count = 0
    const uint = () => {
      let result = 0n, shift = 0n
      for (let n = 0; n < 10; n++) {
        if (at >= buffer.length) throw new Error('Truncated ProPresenter data.')
        const byte = buffer[at++]
        result |= BigInt(byte & 127) << shift
        if (!(byte & 128)) return result
        shift += 7n
      }
      throw new Error('Invalid ProPresenter integer.')
    }
    while (at < buffer.length) {
      if (++count > 100_000) throw new Error('ProPresenter data has too many fields.')
      const tag = Number(uint()), field = Math.floor(tag / 8), wire = tag % 8
      if (field < 1 || field > 536870911) throw new Error('Invalid ProPresenter field.')
      let value: number | Buffer
      if (wire === 0) value = Number(uint())
      else if ([1, 2, 5].includes(wire)) {
        const size = wire === 2 ? Number(uint()) : wire === 1 ? 8 : 4
        if (!Number.isSafeInteger(size) || size < 0 || at + size > buffer.length) throw new Error('Truncated ProPresenter field.')
        value = buffer.subarray(at, at + size); at += size
      } else throw new Error('Unsupported ProPresenter wire format.')
      const values = this.fields.get(field) ?? []
      values.push(value); this.fields.set(field, values)
    }
  }
  buffers(field: number) { return (this.fields.get(field) ?? []).filter((v): v is Buffer => Buffer.isBuffer(v)) }
  messages(field: number) { return this.buffers(field).map(buffer => new Proto(buffer)) }
  message(field: number) { return this.messages(field)[0] ?? new Proto(Buffer.alloc(0)) }
  text(field: number) { return this.buffers(field)[0]?.toString('utf8') ?? '' }
  number(field: number) { const value = this.fields.get(field)?.[0]; return typeof value === 'number' ? value : 0 }
  has(field: number) { return this.fields.has(field) }
}
