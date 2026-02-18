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
      },
      realtime: {
        params: {
          eventsPerSecond: 10,  // Allow bursts of realtime events
        },
        heartbeatIntervalMs: 15_000,  // More frequent heartbeat (default 30s) — detects disconnections faster
        reconnectAfterMs: (tries: number) => {
          // Aggressive reconnect: 1s, 2s, 4s, 5s, 5s, 5s...
          return Math.min(1000 * Math.pow(2, tries), 5000)
        },
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
