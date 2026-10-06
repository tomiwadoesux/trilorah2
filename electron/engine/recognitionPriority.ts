import type { NamedPassage } from './namedPassages'
import type { QuoteMatch } from './quoteMatcher'

/** Matchers must supply quotation evidence from the current utterance. A
 * named passage then limits the choice to quotations inside that passage:
 * its own words can identify one verse more precisely than its title, while
 * a newly named passage still wins over an unrelated quotation in context. */
export function quotesForNamedPassage(matches: QuoteMatch[], named: NamedPassage | null): QuoteMatch[] {
  if (!named) return matches
  const prefix = `${named.book} ${named.chapter}:`
  return matches.filter(match => match.ref.startsWith(prefix) &&
    match.verse >= named.verse && match.verse <= named.end)
}
