export const EN_NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100
}

/** Table-driven spoken-number parser.
 *  Handles digits ("23"), atomic words ("dieciséis"), tens+unit
 *  ("twenty three", "treinta y cuatro"), and hundreds
 *  ("one hundred and nineteen", "cento e dezenove"). */
export function parseNumberWithTable(
  words: string[],
  i: number,
  table: Record<string, number>,
  connectors: Set<string>
): { value: number; consumed: number } | null {
  const w = words[i]
  if (w === undefined) return null

  if (/^\d{1,3}$/.test(w)) {
    return { value: parseInt(w, 10), consumed: 1 }
  }

  let total = 0
  let consumed = 0
  let j = i

  // hundreds: "[unit] hundred" | "a hundred" | bare hundred-word
  const v0 = table[words[j]]
  if (v0 !== undefined && v0 > 0 && v0 < 10 && table[words[j + 1]] === 100) {
    total = v0 * 100
    consumed = 2
    j += 2
  } else if (words[j] === 'a' && table[words[j + 1]] === 100) {
    total = 100
    consumed = 2
    j += 2
  } else if (table[words[j]] === 100) {
    total = 100
    consumed = 1
    j += 1
  }

  if (consumed > 0 && connectors.has(words[j])) {
    consumed += 1
    j += 1
  }

  const v = table[words[j]]
  if (v !== undefined && v >= 20 && v < 100 && v % 10 === 0) {
    // tens, optionally followed by (connector +) unit: "treinta y cuatro"
    total += v
    consumed += 1
    j += 1
    let k = j
    let extra = 0
    if (connectors.has(words[k]) && table[words[k + 1]] !== undefined) {
      k += 1
      extra = 1
    }
    const u = table[words[k]]
    if (u !== undefined && u > 0 && u < 10) {
      total += u
      consumed += 1 + extra
    }
    return { value: total, consumed }
  }

  if (v !== undefined && v < 100) {
    total += v
    consumed += 1
    return { value: total, consumed }
  }

  if (consumed > 0) return { value: total, consumed }
  return null
}

/** English-table parser — kept as the stable exported surface. */
export function parseSpokenNumber(
  words: string[],
  i: number
): { value: number; consumed: number } | null {
  return parseNumberWithTable(words, i, EN_NUMBER_WORDS, new Set(['and']))
}

