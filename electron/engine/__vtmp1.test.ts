import { describe, it } from 'vitest'
import { SpokenReferenceResolver } from './referenceResolver'

describe('claim', () => {
  it('bare numbers after a committed ref', () => {
    let t = 1000
    const out: any[] = []
    const r = new SpokenReferenceResolver((d) => { out.push(d); console.log('EMIT', JSON.stringify(d)) }, { now: () => t })
    r.process('romans eight one', true)
    console.log('--- after first utterance')
    t += 1500
    r.process('six five', true)
    console.log('total', out.length)
  })
  it('partials then final', () => {
    let t = 1000
    const out: any[] = []
    const r = new SpokenReferenceResolver((d) => { out.push(d); console.log('P-EMIT', JSON.stringify(d)) }, { now: () => t })
    r.process('romans eight one', false); t+=200
    r.process('romans eight one', true); t+=1500
    r.process('six', false); t+=200
    r.process('six five', false); t+=200
    r.process('six five', true)
    console.log('total', out.length)
  })
})
