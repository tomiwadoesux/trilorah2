import { getSupabase, isCloudConfigured } from './supabaseClient'
import { enqueue, size, flush } from './offlineQueue'
import type { CloudOp } from './offlineQueue'

let activeServiceId: string | null = null
/** When this service's transcript clock started — see pushTranscriptChunk. */
let serviceStartedAt: number | null = null
let activeAccountId: string | null = null
let flushInterval: NodeJS.Timeout | null = null
const FLUSH_INTERVAL_MS = 15000

export interface StartServiceOpts {
  preacherId?: string | null
  sermonTitle?: string | null
  isPublic?: boolean
  publishTranscript?: boolean
  audienceTrainingEnabled?: boolean
}

async function loadCurrentAccountId(): Promise<string | null> {
  if (activeAccountId) return activeAccountId
  const supa = getSupabase()
  if (!supa) return null
  const { data: userResp } = await supa.auth.getUser()
  if (!userResp.user) return null
  const { data, error } = await supa
    .from('accounts')
    .select('id')
    .eq('owner_user_id', userResp.user.id)
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  activeAccountId = data.id
  return activeAccountId
}

async function applyOp(op: CloudOp): Promise<void> {
  const supa = getSupabase()
  if (!supa) throw new Error('Supabase client unavailable')
  const { table, op: kind, payload } = op
  // The HTTP status rides along on the error so the queue can tell a refusal
  // that will repeat forever from a network blip (see cloudErrors).
  const fail = (error: unknown, status: number) => Object.assign(error as object, { status })
  if (kind === 'insert') {
    const { error, status } = await supa.from(table).insert(payload)
    if (error) throw fail(error, status)
  } else if (kind === 'update') {
    const { id, ...rest } = payload
    const { error, status } = await supa.from(table).update(rest).eq('id', id)
    if (error) throw fail(error, status)
  } else if (kind === 'upsert') {
    const { error, status } = await supa.from(table).upsert(payload)
    if (error) throw fail(error, status)
  }
}

function startFlushLoop(): void {
  if (flushInterval) return
  flushInterval = setInterval(async () => {
    if (!isCloudConfigured()) return
    if (size() === 0) return
    const result = await flush(applyOp)
    if (result.flushed > 0) {
      console.log(
        `☁️  Flushed ${result.flushed} cloud event(s); ${result.remaining} remaining`
      )
    }
  }, FLUSH_INTERVAL_MS)
}

/**
 * Push the queue now rather than at the next 15s tick.
 *
 * The flush loop alone is fine for notes and attendance, but it is the whole
 * reason a congregant's phone lagged the room: a verse the operator put on the
 * wall sat in the local queue for up to fifteen seconds before it existed in
 * the cloud at all, so realtime had nothing to deliver and the page only caught
 * up on the next reload. Transcript chunks had the same problem, arriving in
 * fifteen-second bursts instead of as they were spoken.
 *
 * Coalesced on a short timer so a burst of chunks still travels as one round
 * trip, and silent on failure — the periodic loop remains the retry path, and
 * flush() itself is a no-op while a flush is already in flight.
 */
let nudgeTimer: NodeJS.Timeout | null = null
const NUDGE_MS = 250

function flushSoon(): void {
  if (!isCloudConfigured()) return
  if (nudgeTimer) return
  nudgeTimer = setTimeout(() => {
    nudgeTimer = null
    void flush(applyOp).catch(() => {
      /* the periodic loop retries */
    })
  }, NUDGE_MS)
}

export function initCloudSync(): void {
  if (!isCloudConfigured()) {
    console.log('☁️  CloudSync inactive — Supabase not configured')
    return
  }
  startFlushLoop()
}

export async function startService(
  opts: StartServiceOpts = {}
): Promise<{ success: boolean; serviceId?: string | null; error?: string }> {
  if (!isCloudConfigured()) return { success: true }
  const accountId = await loadCurrentAccountId()
  if (!accountId) return { success: false, error: 'Not signed in' }
  const supa = getSupabase()!
  try {
    const { data, error } = await supa
      .from('services')
      .insert({
        account_id: accountId,
        preacher_id: opts.preacherId ?? null,
        sermon_title: opts.sermonTitle ?? null,
        is_public: opts.isPublic ?? true,
        publish_transcript: opts.publishTranscript ?? true,
        audience_training_enabled: opts.audienceTrainingEnabled ?? false
      })
      .select('id')
      .single()
    if (error) throw error
    activeServiceId = data.id
    serviceStartedAt = Date.now()
    console.log(`☁️  Service created in cloud: ${activeServiceId}`)
    return { success: true, serviceId: activeServiceId }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function endService(): Promise<{ success: boolean }> {
  if (!activeServiceId || !isCloudConfigured()) return { success: true }
  enqueue({
    table: 'services',
    op: 'update',
    payload: { id: activeServiceId, ended_at: new Date().toISOString() }
  })
  enqueue({
    table: 'sermon_notes',
    op: 'upsert',
    payload: { service_id: activeServiceId, is_live: false }
  })
  await flush(applyOp)
  const id = activeServiceId
  activeServiceId = null
  serviceStartedAt = null
  console.log(`☁️  Service ended: ${id}`)
  return { success: true }
}

export function getActiveServiceId(): string | null {
  return activeServiceId
}

/*
 * While the practice sermon plays (asr/practiceSermon.ts) the engine runs for
 * real, but none of it is a service: nothing goes to the phone page or the
 * service record, even when a real service is open.
 */
let rehearsal = false
export function setRehearsal(on: boolean): void {
  rehearsal = on
}

export function pushSegment(type: string, confidence = 1): void {
  if (!activeServiceId || rehearsal) return
  enqueue({
    table: 'segments',
    op: 'insert',
    payload: {
      service_id: activeServiceId,
      type,
      confidence,
      started_at: new Date().toISOString()
    }
  })
  flushSoon()
}

export function pushTranscriptChunk(
  text: string,
  isFinal: boolean,
  segmentType: string,
  /** Per-word timings, when the recogniser gave any (Deepgram; not whisper). */
  words?: { w: string; s: number; e: number }[] | null
): void {
  if (!activeServiceId || rehearsal) return
  if (!text.trim()) return
  enqueue({
    table: 'transcript_chunks',
    op: 'insert',
    payload: {
      service_id: activeServiceId,
      text,
      is_final: isFinal,
      segment_type: segmentType,
      words: words && words.length > 0 ? words : null,
      // Where this sits in the service, so a phone watching a stream that is
      // half a minute behind can line the words up with what it is hearing.
      offset_ms: serviceStartedAt ? Date.now() - serviceStartedAt : null,
      timestamp: new Date().toISOString()
    }
  })
  flushSoon()
}

export function pushDetectedVerse(
  ref: string,
  source: string,
  confidence = 0.5,
  pushedToLive = false
): string | null {
  if (!activeServiceId || rehearsal) return null
  const id = crypto.randomUUID()
  enqueue({
    table: 'detected_verses',
    op: 'insert',
    payload: {
      id,
      service_id: activeServiceId,
      ref,
      source,
      confidence,
      pushed_to_live: pushedToLive,
      pushed_at: pushedToLive ? new Date().toISOString() : null
    }
  })
  flushSoon()
  return id
}

export function markVersePushed(verseId: string): void {
  if (!activeServiceId || rehearsal) return
  enqueue({
    table: 'detected_verses',
    op: 'update',
    payload: {
      id: verseId,
      pushed_to_live: true,
      pushed_at: new Date().toISOString()
    }
  })
  flushSoon()
}

export function upsertNotes(notes: any): void {
  if (!activeServiceId || rehearsal) return
  enqueue({
    table: 'sermon_notes',
    op: 'upsert',
    payload: {
      service_id: activeServiceId,
      title: notes.title ?? '',
      theme: notes.theme ?? '',
      main_points: notes.mainPoints ?? [],
      definitions: notes.definitions ?? [],
      applications: notes.applications ?? [],
      memorable_quotes: notes.memorableQuotes ?? [],
      all_scriptures: notes.allScriptures ?? [],
      is_live: notes.isLive ?? true
    }
  })
}

export async function syncGivingMethods(methods: any): Promise<void> {
  const supa = getSupabase()
  if (!supa) return
  const accountId = await loadCurrentAccountId()
  if (!accountId) return
  await supa.from('accounts').update({ giving_methods: methods }).eq('id', accountId)
}

export async function generateLinkCode(): Promise<{
  success: boolean
  code?: string
  error?: string
}> {
  const supa = getSupabase()
  if (!supa) return { success: false, error: 'Cloud not configured' }
  const { data, error } = await supa.rpc('generate_link_code')
  if (error) return { success: false, error: error.message }
  return { success: true, code: data }
}

export async function redeemLinkCode(code: string): Promise<{
  success: boolean
  orgId?: string
  error?: string
}> {
  const supa = getSupabase()
  if (!supa) return { success: false, error: 'Cloud not configured' }
  const { data, error } = await supa.rpc('redeem_link_code', { p_code: code })
  if (error) return { success: false, error: error.message }
  activeAccountId = null
  return { success: true, orgId: data }
}

export async function completeAccountSetup(
  churchName: string,
  slug: string
): Promise<{ success: boolean; orgId?: string; accountId?: string; error?: string }> {
  const supa = getSupabase()
  if (!supa) return { success: false, error: 'Cloud not configured' }
  const cleanSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const { data, error } = await supa.rpc('complete_account_setup', {
    p_church_name: churchName,
    p_slug: cleanSlug
  })
  if (error) return { success: false, error: error.message }
  const row = Array.isArray(data) ? data[0] : data
  activeAccountId = null
  return { success: true, orgId: row?.org_id, accountId: row?.account_id }
}

export async function hasAccount(): Promise<boolean> {
  const supa = getSupabase()
  if (!supa) return false
  const { data: userResp } = await supa.auth.getUser()
  if (!userResp.user) return false
  const { data } = await supa
    .from('accounts')
    .select('id')
    .eq('owner_user_id', userResp.user.id)
    .limit(1)
    .maybeSingle()
  return !!data
}

export async function fetchMyAccount(): Promise<{
  id: string
  slug: string
  name: string
  organizationId: string
  isOrgAdmin: boolean
} | null> {
  const supa = getSupabase()
  if (!supa) return null
  const { data: userResp } = await supa.auth.getUser()
  if (!userResp.user) return null
  const { data, error } = await supa
    .from('accounts')
    .select('id, slug, name, organization_id, is_org_admin')
    .eq('owner_user_id', userResp.user.id)
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    organizationId: data.organization_id,
    isOrgAdmin: data.is_org_admin
  }
}

export async function fetchPastors(): Promise<any[]> {
  const supa = getSupabase()
  if (!supa) return []
  const { data } = await supa
    .from('preachers')
    .select(
      'id, name, detection_accuracy, learned_false_positive_phrases, favorite_verse_refs'
    )
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function fetchCampuses(): Promise<any[]> {
  const supa = getSupabase()
  if (!supa) return []
  const account = await fetchMyAccount()
  if (!account) return []
  const { data } = await supa
    .from('accounts')
    .select('id, name, slug, is_org_admin')
    .eq('organization_id', account.organizationId)
  return data ?? []
}

export async function fetchRecentServices(): Promise<any[]> {
  const supa = getSupabase()
  if (!supa) return []
  const account = await fetchMyAccount()
  if (!account) return []
  const { data } = await supa
    .from('services')
    .select('id, sermon_title, started_at, ended_at')
    .eq('account_id', account.id)
    .order('started_at', { ascending: false })
    .limit(10)
  return data ?? []
}

export async function fetchRecentNotes(): Promise<any[]> {
  const supa = getSupabase()
  if (!supa) return []
  const account = await fetchMyAccount()
  if (!account) return []
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
  const { data: services } = await supa
    .from('services')
    .select('id, sermon_title, started_at, ended_at, preacher_id')
    .eq('account_id', account.id)
    .gte('started_at', fourWeeksAgo)
    .order('started_at', { ascending: false })
  if (!services || services.length === 0) return []
  const ids = services.map((s) => s.id)
  const { data: notes } = await supa.from('sermon_notes').select('*').in('service_id', ids)
  const byServiceId = new Map()
  for (const n of notes ?? []) byServiceId.set(n.service_id, n)
  return services.map((s) => ({
    ...s,
    notes: byServiceId.get(s.id) ?? null
  }))
}

export async function fetchAudienceSessions(): Promise<any[]> {
  const supa = getSupabase()
  if (!supa) return []
  const account = await fetchMyAccount()
  if (!account) return []
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supa
    .from('audience_sessions')
    .select(
      'id, service_id, city, country, device_label, first_seen, last_seen, user_agent'
    )
    .eq('account_id', account.id)
    .gte('last_seen', fourWeeksAgo)
    .order('last_seen', { ascending: false })
    .limit(200)
  return data ?? []
}

export async function runRetentionCleanup(): Promise<{ success: boolean; error?: string }> {
  const supa = getSupabase()
  if (!supa) return { success: false, error: 'Cloud not configured' }
  const { error } = await supa.rpc('run_retention_cleanup')
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function verifyPassword(
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const supa = getSupabase()
  if (!supa) return { ok: false, error: 'Cloud not configured' }
  const { data: userResp } = await supa.auth.getUser()
  const email = userResp.user?.email
  if (!email) return { ok: false, error: 'Not signed in' }
  const { error } = await supa.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function signOutAllDevices(): Promise<{ success: boolean; error?: string }> {
  const supa = getSupabase()
  if (!supa) return { success: false, error: 'Cloud not configured' }
  const { error } = await supa.auth.signOut({ scope: 'global' })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
