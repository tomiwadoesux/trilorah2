import { bibleNamesIn } from './bibleNames'

const THIRD_PERSON = /\b(?:he|she|him|her|his|hers|they|them|their)\b/i
const HE = /\b(?:he|him|his)\b/i
const SHE = /\b(?:she|her|hers)\b/i
// The women a sermon is likely to name. The name list is read off the Bible
// text and has no genders, and without these "he waited two more days" picked
// up Naomi from the sentence before.
const WOMEN = new Set(('sarah sarai hagar rebekah rachel leah dinah tamar zilpah bilhah keturah asenath miriam zipporah jochebed rahab deborah jael delilah naomi ruth orpah ' +
  'hannah peninnah michal abigail bathsheba rizpah jezebel athaliah huldah esther vashti mary martha elizabeth anna joanna susanna salome magdalene ' +
  'herodias tabitha dorcas lydia priscilla phoebe eunice lois rhoda sapphira damaris bernice drusilla euodia syntyche').split(' '))
/** After this, "he" is whoever the preacher is talking about now. */
const MEMORY_MS = 90_000

/**
 * Who "he" is.
 *
 * A preacher names the person once and then says "he" for a minute: "Think
 * about Jacob. ... He wrestled all night and would not let go." The second
 * sentence, searched alone, has no idea it is about Jacob.
 *
 * This keeps the names from the last sentence that had any. `carry` hands
 * them to a later sentence only when that sentence talks about a he/she/they
 * and names nobody itself. It is a guess and is treated as one: callers
 * search with AND without the name, so a wrong guess costs a place in the
 * list rather than the right answer.
 */
export class NameMemory {
  private last: { names: string[]; at: number } | null = null

  /** Call with every finished sentence, in order. */
  note(text: string, now = Date.now()): void {
    const names = bibleNamesIn(text)
    if (names.length) { this.last = { names, at: now }; return }
    // "Jesus went to the cross. He died for us." — he is no longer David.
    if (/\b(?:jesus|christ)\b/i.test(text)) this.last = null
  }

  /** Names to read into `text`, or '' when it needs none or none is fresh. */
  carry(text: string, now = Date.now()): string {
    if (!this.last || now - this.last.at > MEMORY_MS) return ''
    if (!THIRD_PERSON.test(text) || bibleNamesIn(text).length) return ''
    // "he" is not Naomi and "she" is not Boaz; "they" could be anyone.
    const he = HE.test(text), she = SHE.test(text)
    return this.last.names.filter(name => WOMEN.has(name) ? she || !he : he || !she).join(' ')
  }

  reset(): void { this.last = null }
}
