/**
 * Supabase Client - Browser
 * Utilisé côté client (composants React)
 */
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// FIX "17 secondes de chargement" (verrou multi-onglets gelé) :
// supabase-js protège la session par un verrou navigateur PARTAGÉ entre tous
// les onglets (navigator.locks), attendu SANS LIMITE par défaut. Quand Chrome
// gèle un onglet en arrière-plan qui détenait le verrou, TOUS les autres
// onglets restent bloqués (agenda qui "charge" 10-17 s, boutons sans effet,
// puis ça remarche en sortant/re-rentrant). Les employés — plein d'onglets
// ouverts toute la journée — étaient les plus touchés.
//
// Ici : attente bornée à 5 s, puis RÉCUPÉRATION FORCÉE du verrou (steal) —
// l'onglet gelé le perd, l'onglet actif reprend la main immédiatement.
// Pire cas théorique : deux rafraîchissements de session simultanés, géré
// côté serveur par la fenêtre de réutilisation du refresh token.
// ─────────────────────────────────────────────────────────────────────────────
async function boundedNavigatorLock<R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return await fn()
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)

  try {
    return await navigator.locks.request(name, { signal: controller.signal }, async () => {
      clearTimeout(timer)
      return await fn()
    })
  } catch (err) {
    clearTimeout(timer)
    // Verrou détenu par un onglet gelé → le reprendre de force pour débloquer
    if ((err as Error)?.name === 'AbortError') {
      console.warn('[Supabase] Verrou de session bloqué >5s — récupération forcée (onglet gelé ?)')
      return await navigator.locks.request(name, { steal: true }, fn)
    }
    throw err
  }
}

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        lock: boundedNavigatorLock,
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
