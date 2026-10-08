/**
 * Which installed Bible a read actually uses.
 *
 * The one asked for when this computer has it, else the church's saved
 * default, else KJV, else whatever is installed. A default naming a Bible
 * that is not here (a .tri package can set one; so could a phone) used to
 * make every catch fail without a word — readVersePreview found no rows and
 * each caller just returned. Now the verse comes in the fallback and
 * `missing` names what was asked for, so the service log can say why.
 *
 * Pure, so the rule is tested without a database (versionChoice.test.ts).
 */
export function chooseVersion(
  requested: unknown,
  saved: unknown,
  installed: readonly string[],
): { version: string; missing: string | null } {
  const want = typeof requested === 'string' ? requested.trim().toUpperCase() : ''
  if (want && installed.includes(want)) return { version: want, missing: null }
  const fallbackDefault = typeof saved === 'string' ? saved.trim().toUpperCase() : ''
  const version = installed.includes(fallbackDefault) ? fallbackDefault
    : installed.includes('KJV') ? 'KJV'
      : installed[0] ?? 'KJV'
  return { version, missing: want || null }
}
