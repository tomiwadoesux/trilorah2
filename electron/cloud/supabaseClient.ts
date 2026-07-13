import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import StoreModule from 'electron-store'

// electron-store ships dual CJS/ESM builds — grab the constructor either way.
const StoreCtor: any =
  typeof (StoreModule as any).default === 'function' ? (StoreModule as any).default : StoreModule
const sessionStore = new StoreCtor({ name: 'trilorah-session' })

let client: SupabaseClient | null = null

interface CloudConfig {
  url: string
  publishableKey: string
}

function readConfig(): CloudConfig | null {
  const url = process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || ''
  if (!url || !key) return null
  return { url, publishableKey: key }
}

export function getSupabase(): SupabaseClient | null {
  if (client) return client
  const cfg = readConfig()
  if (!cfg) {
    console.warn(
      '⚠️  Supabase env vars missing — cloud sync disabled. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.local'
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
        getItem: (k) => sessionStore.get(k) ?? null,
        setItem: (k, v) => sessionStore.set(k, v),
        removeItem: (k) => sessionStore.delete(k)
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
