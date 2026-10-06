/**
 * Allusion matching against hand-written sentences. No microphone, no network.
 *
 *   node --import tsx evals/allusion-check.ts
 *
 * Runs the same AllusionFinder the app uses, with the bundled models, over
 * evals/recognition/allusions.json. "first" is the right chapter as the top
 * answer to the button; "in four" is anywhere in the four shown. The
 * automatic path either suggests (right or wrong) or stays silent.
 *
 * These sentences were typed by the people building the feature and several
 * lists were used to choose thresholds. Passing here is a regression check,
 * not an accuracy figure for real sermons.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AllusionFinder } from '../electron/engine/allusionFinder'
import { PassageMatcher } from '../electron/engine/passageMatcher'
import { SemanticMatcher, loadEmbedder, loadJudge } from '../electron/engine/semanticMatcher'

type Expected = [string, number][]
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILLER = 'now I want you to listen to me very carefully this morning because what I am about to say is important for somebody sitting here in this room today'
const CARRIED = ['David', 'Paul', 'Peter', 'Mary', 'Joseph', 'Moses', 'John', 'Abraham']

async function main() {
  const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'evals', 'recognition', 'allusions.json'), 'utf8'))
  const semantic = new SemanticMatcher()
  if (!semantic.loadVectors(path.join(root, 'electron', 'data', 'passages', 'bsb-vectors.bin'))) throw new Error('Vectors do not fit the corpus. Run npm run passages:vectors.')
  semantic.setEmbedder(await loadEmbedder(path.join(root, 'data', 'models', 'all-MiniLM-L6-v2')))
  const judge = process.argv.includes('--no-judge') ? null : await loadJudge(path.join(root, 'data', 'models', 'ms-marco-MiniLM-L-6-v2'))
  const stories = new PassageMatcher()
  const finder = new AllusionFinder({ semantic, judge, detectStory: text => stories.detect(text) })
  const fresh = () => { finder.names.reset(); finder.sermon.reset() }
  const ok = (hit: { book: string; chapter: number } | null | undefined, expected: Expected) => !!hit && expected.some(([book, chapter]) => book === hit.book && chapter === hit.chapter)
  const words = (text: string) => text.split(/\s+/).filter(Boolean)

  const button = async (label: string, cases: { said: string; expected: Expected; before?: () => void }[]) => {
    let first = 0, four = 0
    for (const c of cases) { fresh(); c.before?.(); const found = await finder.find(words(c.said)); if (ok(found[0], c.expected)) first++; if (found.slice(0, 4).some(hit => ok(hit, c.expected))) four++ }
    console.log(`${label.padEnd(52)} first ${String(first).padStart(2)}/${cases.length}   in four ${String(four).padStart(2)}/${cases.length}`)
  }
  const auto = async (label: string, cases: { said: string; expected?: Expected; before?: () => void }[]) => {
    let right = 0, wrong = 0; const loud: string[] = []
    for (const c of cases) { fresh(); c.before?.(); const hit = await finder.suggest(c.said); if (!hit) continue; if (c.expected && ok(hit, c.expected)) right++; else { wrong++; loud.push(`"${c.said.slice(0, 50)}" → ${hit.ref}`) } }
    console.log(`${label.padEnd(52)} ` + (cases[0]?.expected ? `right ${String(right).padStart(2)}, wrong ${wrong}, silent ${cases.length - right - wrong}  of ${cases.length}` : `suggested ${wrong} of ${cases.length}`))
    for (const line of loud) console.log('      ' + line)
  }

  const allusions = fixtures.allusions.map(([said, expected]: [string, Expected]) => ({ said, expected }))
  const freshAllusions = fixtures.freshAllusions.map(([said, expected]: [string, Expected]) => ({ said, expected }))
  const named = fixtures.afterAName as { before: string; said: string; expected: Expected }[]
  const sermon = fixtures.insideSermonPassage as { sermon: [string, number]; said: string; expected: Expected }[]

  console.log(`THE BUTTON${judge ? '' : '   (judge off)'}`)
  await button('allusions', allusions)
  await button('fresh allusions', freshAllusions)
  await button('he/she, name said earlier — name forgotten', named.map(c => ({ said: `${FILLER} ${c.said}`, expected: c.expected })))
  await button('he/she, name said earlier — name remembered', named.map(c => ({ said: `${FILLER} ${c.said}`, expected: c.expected, before: () => { finder.names.note(c.before); finder.names.note(FILLER) } })))
  await button('he/she, the WRONG name remembered', named.map((c, i) => ({ said: c.said, expected: c.expected, before: () => finder.names.note(named[(i + 7) % named.length].before) })))
  await button('inside the sermon passage — passage unknown', sermon.map(c => ({ said: c.said, expected: c.expected })))
  await button('inside the sermon passage — passage on the wall', sermon.map(c => ({ said: c.said, expected: c.expected, before: () => finder.sermon.noteLive(c.sermon[0], c.sermon[1]) })))
  await button('allusions while a DIFFERENT passage is on the wall', allusions.map((c: any, i: number) => ({ ...c, before: () => { let k = i; while (c.expected.some(([book]: [string]) => book === sermon[k % sermon.length].sermon[0])) k++; finder.sermon.noteLive(...sermon[k % sermon.length].sermon) } })))

  console.log('\nAUTOMATIC')
  await auto('allusions', allusions)
  await auto('fresh allusions', freshAllusions)
  await auto('he/she, no name known', named.map(c => ({ said: c.said, expected: c.expected })))
  await auto('he/she, name remembered', named.map(c => ({ said: c.said, expected: c.expected, before: () => finder.names.note(c.before) })))
  await auto('he/she, the WRONG name remembered', named.map((c, i) => ({ said: c.said, expected: c.expected, before: () => finder.names.note(named[(i + 7) % named.length].before) })))
  await auto('inside the sermon passage', sermon.map(c => ({ said: c.said, expected: c.expected })))
  await auto('not Scripture', fixtures.notScripture.map((said: string) => ({ said })))
  await auto('fresh plain talk', fixtures.freshPlainTalk.map((said: string) => ({ said })))
  await auto('fresh Bible-flavoured encouragement', fixtures.freshBibleFlavoured.map((said: string) => ({ said })))
  await auto('everyday he/she stories', fixtures.everydayStories.map((said: string) => ({ said })))
  await auto('everyday he/she stories after a Bible name', fixtures.everydayStories.flatMap((said: string) => CARRIED.map(name => ({ said, before: () => finder.names.note(`think about ${name}`) }))))
}
void main()
