import { describe, it } from 'vitest'
import { SpokenReferenceResolver } from './referenceResolver'

describe('repro', () => {
  it('bare numbers after a committed chapter', () => {
    const out: any[] = []
    const r = new SpokenReferenceResolver((d) => out.push(d), { bareBookGate: () => true })
    r.process('romans eight one', true)
    console.log('AFTER1', JSON.stringify(out))
    out.length = 0
    r.process('six five', true)
    console.log('AFTER2', JSON.stringify(out))
    out.length = 0
    r.process('galatians six five', true)
    console.log('AFTER3', JSON.stringify(out))
  })
  it('partial then final', () => {
    const out: any[] = []
    const r = new SpokenReferenceResolver((d) => out.push(d), { bareBookGate: () => true })
    r.process('romans eight one', true)
    out.length = 0
    r.process('six', false)
    r.process('six five', true)
    console.log('PARTIALFLOW', JSON.stringify(out))
  })
})
