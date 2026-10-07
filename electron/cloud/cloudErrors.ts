/**
 * What to do with a queued cloud write that just failed.
 *
 * The queue is strictly ordered, so the head op blocks everything behind it.
 * That is right for a network outage — the next attempt will work and order is
 * kept — and disastrous for a write that can never succeed: a missing column,
 * a constraint, a policy that refuses it. One such op at the head stopped
 * every transcript chunk, verse and note behind it, for that service and every
 * later one, because the queue is persisted across restarts. The app went on
 * transcribing and the congregation's page stayed empty.
 *
 * - `done`  — the row is already there (a retry after a reply that was lost).
 * - `drop`  — Postgres or PostgREST rejected the write itself; it will fail
 *             the same way forever.
 * - `retry` — the network, a timeout, a rate limit, an expired session or a
 *             server error; worth trying again, in order.
 */
export type CloudErrorVerdict = 'done' | 'drop' | 'retry'

export function classifyCloudError(err: unknown): CloudErrorVerdict {
  const e = (err ?? {}) as { code?: unknown; status?: unknown }
  const code = typeof e.code === 'string' ? e.code : ''
  const status = typeof e.status === 'number' ? e.status : 0

  // unique_violation: an earlier attempt landed and only its reply was lost.
  if (code === '23505') return 'done'
  // Data exceptions (22), integrity constraints (23), syntax, undefined
  // column/table and insufficient privilege incl. row-level security (42).
  if (/^(22|23|42)/.test(code)) return 'drop'
  // PostgREST: malformed request (PGRST1xx) or a table/column it does not know (PGRST2xx).
  if (/^PGRST[12]/.test(code)) return 'drop'
  // Any other refusal by the server — except the ones that clear on their own.
  if (status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429) return 'drop'
  return 'retry'
}
