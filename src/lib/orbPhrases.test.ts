import { describe, expect, it } from 'vitest';
import { nextOrbPhrase, ORB_PHRASES } from './orbPhrases';

describe('orb hover wording', () => {
  it('cycles through every variant before repeating for every state', () => {
    for (const [state, phrases] of Object.entries(ORB_PHRASES)) {
      let previous: string | undefined;
      const seen: string[] = [];
      for (let i = 0; i < phrases.length; i++) {
        const next = nextOrbPhrase(state, previous);
        expect(next).not.toBe(previous);
        seen.push(next); previous = next;
      }
      expect(new Set(seen).size).toBe(phrases.length);
      expect(nextOrbPhrase(state, previous)).toBe(seen[0]);
    }
  });
  it('uses a safe idle phrase for an unknown state', () => {
    expect(nextOrbPhrase('unknown')).toBe(ORB_PHRASES.idle[0]);
  });
});
