import { describe, it, expect } from 'vitest'
import { ScriptureSession } from './scriptureSession'

const s: any = new ScriptureSession(() => {})

describe('navigation commands: ordinary preaching must not navigate', () => {
  const preaching = [
    'the earth also was corrupt before god',
    'let us continue in the faith',
    'and he said go back to your house',
    'we must move on to the next thing god has for us',
    'jesus went before them',
    'keep going in prayer beloved',
    'the lord will go before you',
    'god said i will never go back on my word',
    'in the next chapter paul writes',
    'he was before all things and in him all things consist',
  ]
  for (const p of preaching) {
    it(`does not navigate: "${p}"`, () => {
      expect(s.isNextCommand(p), 'next').toBe(false)
      expect(s.isPreviousCommand(p), 'prev').toBe(false)
    })
  }
})

describe('navigation commands: real instructions must still work', () => {
  const nextCmds = ['next verse', 'next', 'please next', 'okay next verse', 'continue', 'go on', 'keep going', 'move on']
  const prevCmds = ['previous verse', 'go back', 'back', 'previous', 'last verse']
  for (const c of nextCmds) {
    it(`next: "${c}"`, () => expect(s.isNextCommand(c)).toBe(true))
  }
  for (const c of prevCmds) {
    it(`prev: "${c}"`, () => expect(s.isPreviousCommand(c)).toBe(true))
  }
})

describe('navigation commands: punctuation and natural asks', () => {
  for (const c of ['Next verse.', 'next verse, please', "What's next?", "what's the next thing there", 'read the next one']) {
    it(`next: "${c}"`, () => {
      const t: any = new ScriptureSession(() => {})
      t.configureCommands({ navNext: ['next verse', 'read the next one', 'whats next', 'whats the next'], navPrevious: ['previous verse'] })
      expect(t.isNextCommand(c)).toBe(true)
    })
  }
  it('only multi-word phrases may fire from a partial', () => {
    expect(s.isUnambiguousNav('next verse')).toBe('next')
    expect(s.isUnambiguousNav('next')).toBe(null)
    expect(s.isUnambiguousNav('next week we will')).toBe(null)
  })
})
