import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import StoreModule from 'electron-store'
import { SUPABASE_DEFAULTS } from './supabaseDefaults'

// electron-store ships dual CJS/ESM builds — grab the constructor either way.
const StoreCtor: any =
  typeof (StoreModule as any).default === 'function' ? (StoreModule as any).default : StoreModule
// Constructed on first use, not at import. electron-store needs a project
// name, which it takes from app.getName() — unavailable when this module is
// loaded before `app` is ready, or when Electron boots as plain Node
// (ELECTRON_RUN_AS_NODE), where it threw "Please specify the `projectName`
// option." and killed the whole main process at startup.
let sessionStore: any = null
function getSessionStore(): any {
  if (!sessionStore) sessionStore = new StoreCtor({ name: 'trilorah-session' })
  return sessionStore
}

let client: SupabaseClient | null = null
let publicClient: SupabaseClient | null = null

/** Read checks using the same anonymous access as a congregation's phone. */
export function getPublicSupabase(): SupabaseClient | null {
  const cfg = readConfig()
  if (!cfg) return null
  return publicClient ??= createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
}

interface CloudConfig {
  url: string
  publishableKey: string
}

/**
 * The environment wins where it is set, and the compiled-in project is the
 * fallback.
 *
 * That order matters in both directions. A developer with their own Supabase
 * in `.env.local` keeps pointing at it. And a PACKAGED app — which has no
 * `.env.local`, because it is not shipped — now has an address instead of
 * nothing, which is the whole reason the Cloud tab used to read "cloud is not
 * configured in this build" on every install.
 */
function readConfig(): CloudConfig | null {
  const url = process.env.SUPABASE_URL || SUPABASE_DEFAULTS.url
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || SUPABASE_DEFAULTS.publishableKey
  if (!url || !key) return null
  return { url, publishableKey: key }
}

export function getSupabase(): SupabaseClient | null {
  if (client) return client
  const cfg = readConfig()
  if (!cfg) {
    console.warn(
      '⚠️  No Supabase project — cloud sync disabled. The build should carry one (cloud/supabaseDefaults.ts); ' +
        'override with SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.local'
    )
    return null
  }
  client = createClient(cfg.url, cfg.publishableKey, {
    auth: {
      // Electron main is a Node-ish env — we manage session persistence
      // explicitly via electron-store rather than localStorage.
      persistSession: true,
      autoRefreshToken: true,
      storage: {
        getItem: (k) => getSessionStore().get(k) ?? null,
        setItem: (k, v) => getSessionStore().set(k, v),
        removeItem: (k) => getSessionStore().delete(k)
      }
    }
  })
  console.log('☁️  Supabase client initialized')
  return client
}

export function isCloudConfigured(): boolean {
  return readConfig() !== null
}

export async function signIn(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  const supa = getSupabase()
  if (!supa) return { success: false, error: 'Cloud not configured' }
  const { data, error } = await supa.auth.signInWithPassword({ email, password })
  if (error) return { success: false, error: error.message }
  return { success: true, userId: data.user?.id }
}

export async function signUp(
  email: string,
  password: string,
  accountName: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  const supa = getSupabase()
  if (!supa) return { success: false, error: 'Cloud not configured' }
  const { data, error } = await supa.auth.signUp({
    email,
    password,
    options: { data: { account_name: accountName } }
  })
  if (error) return { success: false, error: error.message }
  return { success: true, userId: data.user?.id }
}

export async function signOut(): Promise<{ success: boolean }> {
  const supa = getSupabase()
  if (!supa) return { success: true }
  await supa.auth.signOut()
  return { success: true }
}

export async function getCurrentUser(): Promise<User | null> {
  const supa = getSupabase()
  if (!supa) return null
  const { data } = await supa.auth.getUser()
  return data.user
}
