'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Cache de DÉMARRAGE de l'admin (localStorage).
//
// Problème mesuré : à chaque chargement complet (F5), l'admin faisait jusqu'à
// 9 allers-retours réseau EN SÉRIE avant d'afficher quoi que ce soit
// (layout getUser → useAuth getUser+profil+branches → useBranches qui REFAIT
// la même chaîne + réglages/salles). À ~150 ms le trajet (base aux USA),
// ≈ 1 seconde de spinner plein écran — pire pour les non-super-admins (+2 trajets).
//
// Solution : mémoriser le résultat (profil enrichi + branches détaillées) par
// utilisateur. Au démarrage suivant : affichage IMMÉDIAT depuis le cache, puis
// re-validation en arrière-plan (les données fraîches remplacent silencieusement).
// La sécurité réelle reste côté serveur (middleware + RLS) — ce cache ne sert
// qu'à peindre l'interface sans attendre le réseau.
// ─────────────────────────────────────────────────────────────────────────────

const AUTH_KEY = 'admin_auth_cache_v1'
const BRANCHES_KEY = 'admin_branches_cache_v1'
const TTL_MS = 24 * 60 * 60 * 1000 // 24 h — simple garde-fou anti-obsolescence

interface CacheEntry<T> {
  userId: string
  ts: number
  data: T
}

function read<T>(key: string, userId: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (entry.userId !== userId) return null
    if (Date.now() - entry.ts > TTL_MS) return null
    return entry.data
  } catch {
    return null
  }
}

function write<T>(key: string, userId: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { userId, ts: Date.now(), data }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // quota plein / mode privé — non bloquant
  }
}

export function readAuthCache<T>(userId: string): T | null {
  return read<T>(AUTH_KEY, userId)
}

export function writeAuthCache<T>(userId: string, data: T): void {
  write(AUTH_KEY, userId, data)
}

export function readBranchesCache<T>(userId: string): T | null {
  return read<T>(BRANCHES_KEY, userId)
}

export function writeBranchesCache<T>(userId: string, data: T): void {
  write(BRANCHES_KEY, userId, data)
}

/** À appeler à la déconnexion — évite de peindre l'UI d'un autre compte. */
export function clearAdminBootCache(): void {
  try {
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(BRANCHES_KEY)
  } catch {
    // ignore
  }
}
