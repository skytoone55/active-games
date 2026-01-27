/**
 * Supabase Client - Browser
 * Utilisé côté client (composants React)
 */
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }
  )
}

// Singleton pour éviter de créer plusieurs instances
let client: ReturnType<typeof createClient> | null = null

export function getClient() {
  if (!client) {
    client = createClient()
  }
  return client
}
