/**
 * Système de cache intelligent pour ActiveLaser
 *
 * Stratégie :
 * - Cache les bookings J à J+45 (les plus utilisés)
 * - Cache les contacts avec bookings futurs
 * - Nettoyage automatique des données passées
 * - Affichage instantané au démarrage, sync en arrière-plan
 */

import type { BookingWithSlots } from '@/hooks/useBookings'
import type { Contact } from '@/lib/supabase/types'

// Clés de cache
const CACHE_KEYS = {
  BOOKINGS: 'activelaser_bookings_cache',
  CONTACTS: 'activelaser_contacts_cache',
  BRANCH_CONFIG: 'activelaser_branch_config',
  LAST_SYNC: 'activelaser_last_sync',
  VERSION: 'activelaser_cache_version',
}

// Version du cache (incrémenter si structure change)
const CACHE_VERSION = '1.0'

// Durée de validité du cache (en ms)
// Note: les bookings sont rafraîchis en temps réel via Supabase Realtime,
// donc le TTL peut être long — il sert uniquement de sécurité ultime.
// Un TTL trop court (ex: 5min) cause un écran gris + spinner quand l'utilisateur
// revient sur l'onglet après une pause, car le cache expire et force un rechargement complet.
const CACHE_TTL = {
  BOOKINGS: 30 * 60 * 1000,     // 30 minutes (realtime gère les mises à jour)
  CONTACTS: 30 * 60 * 1000,     // 30 minutes
  BRANCH_CONFIG: 60 * 60 * 1000, // 1 heure
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  branchId: string
}

interface BookingsCache {
  [dateKey: string]: BookingWithSlots[] // dateKey = "YYYY-MM-DD"
}

/**
 * Vérifie si le cache est valide (version + TTL)
 */
function isCacheValid(timestamp: number, ttl: number): boolean {
  return Date.now() - timestamp < ttl
}

/**
 * Vérifie la version du cache et le nettoie si obsolète
 */
function checkCacheVersion(): void {
  if (typeof window === 'undefined') return

  const storedVersion = localStorage.getItem(CACHE_KEYS.VERSION)
  if (storedVersion !== CACHE_VERSION) {
    // Nettoyer tout le cache si version différente
    clearAllCache()
    localStorage.setItem(CACHE_KEYS.VERSION, CACHE_VERSION)
  }
}

/**
 * Nettoie tout le cache
 */
export function clearAllCache(): void {
  if (typeof window === 'undefined') return

  Object.values(CACHE_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
}

/**
 * Nettoie les bookings passés du cache
 */
export function cleanOldBookings(): void {
  if (typeof window === 'undefined') return

  try {
    const cached = localStorage.getItem(CACHE_KEYS.BOOKINGS)
    if (!cached) return

    const entry: CacheEntry<BookingsCache> = JSON.parse(cached)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    // Filtrer pour ne garder que les dates >= aujourd'hui
    const cleanedData: BookingsCache = {}
    Object.entries(entry.data).forEach(([dateKey, bookings]) => {
      if (dateKey >= todayStr) {
        cleanedData[dateKey] = bookings
      }
    })

    entry.data = cleanedData
    localStorage.setItem(CACHE_KEYS.BOOKINGS, JSON.stringify(entry))
  } catch (e) {
    console.warn('Error cleaning old bookings cache:', e)
  }
}

// ============================================
// BOOKINGS CACHE
// ============================================

/**
 * Récupère les bookings depuis le cache pour une date donnée
 */
export function getCachedBookings(branchId: string, date: string): BookingWithSlots[] | null {
  if (typeof window === 'undefined') return null

  checkCacheVersion()

  try {
    const cached = localStorage.getItem(CACHE_KEYS.BOOKINGS)
    if (!cached) return null

    const entry: CacheEntry<BookingsCache> = JSON.parse(cached)

    // Vérifier branche et validité
    if (entry.branchId !== branchId) return null
    if (!isCacheValid(entry.timestamp, CACHE_TTL.BOOKINGS)) return null

    return entry.data[date] || null
  } catch (e) {
    console.warn('Error reading bookings cache:', e)
    return null
  }
}

/**
 * Sauvegarde les bookings dans le cache
 */
export function setCachedBookings(branchId: string, date: string, bookings: BookingWithSlots[]): void {
  if (typeof window === 'undefined') return

  try {
    let entry: CacheEntry<BookingsCache>
    const cached = localStorage.getItem(CACHE_KEYS.BOOKINGS)

    if (cached) {
      entry = JSON.parse(cached)
      // Si branche différente, reset le cache
      if (entry.branchId !== branchId) {
        entry = { data: {}, timestamp: Date.now(), branchId }
      }
    } else {
      entry = { data: {}, timestamp: Date.now(), branchId }
    }

    entry.data[date] = bookings
    entry.timestamp = Date.now()

    localStorage.setItem(CACHE_KEYS.BOOKINGS, JSON.stringify(entry))
  } catch (e) {
    console.warn('Error writing bookings cache:', e)
  }
}

/**
 * Met à jour un booking spécifique dans le cache
 */
export function updateCachedBooking(branchId: string, booking: BookingWithSlots): void {
  if (typeof window === 'undefined') return

  try {
    const cached = localStorage.getItem(CACHE_KEYS.BOOKINGS)
    if (!cached) return

    const entry: CacheEntry<BookingsCache> = JSON.parse(cached)
    if (entry.branchId !== branchId) return

    const bookingDate = new Date(booking.start_datetime).toISOString().split('T')[0]

    if (entry.data[bookingDate]) {
      const index = entry.data[bookingDate].findIndex(b => b.id === booking.id)
      if (index >= 0) {
        entry.data[bookingDate][index] = booking
      } else {
        entry.data[bookingDate].push(booking)
      }
      localStorage.setItem(CACHE_KEYS.BOOKINGS, JSON.stringify(entry))
    }
  } catch (e) {
    console.warn('Error updating booking cache:', e)
  }
}

/**
 * Supprime un booking du cache
 */
export function removeCachedBooking(branchId: string, bookingId: string, date: string): void {
  if (typeof window === 'undefined') return

  try {
    const cached = localStorage.getItem(CACHE_KEYS.BOOKINGS)
    if (!cached) return

    const entry: CacheEntry<BookingsCache> = JSON.parse(cached)
    if (entry.branchId !== branchId) return

    if (entry.data[date]) {
      entry.data[date] = entry.data[date].filter(b => b.id !== bookingId)
      localStorage.setItem(CACHE_KEYS.BOOKINGS, JSON.stringify(entry))
    }
  } catch (e) {
    console.warn('Error removing booking from cache:', e)
  }
}

/**
 * Invalide le cache des bookings pour forcer un refresh
 */
export function invalidateBookingsCache(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CACHE_KEYS.BOOKINGS)
}

// ============================================
// CONTACTS CACHE (contacts avec bookings futurs)
// ============================================

/**
 * Récupère les contacts actifs depuis le cache
 */
export function getCachedContacts(branchId: string): Contact[] | null {
  if (typeof window === 'undefined') return null

  try {
    const cached = localStorage.getItem(CACHE_KEYS.CONTACTS)
    if (!cached) return null

    const entry: CacheEntry<Contact[]> = JSON.parse(cached)

    if (entry.branchId !== branchId) return null
    if (!isCacheValid(entry.timestamp, CACHE_TTL.CONTACTS)) return null

    return entry.data
  } catch (e) {
    console.warn('Error reading contacts cache:', e)
    return null
  }
}

/**
 * Sauvegarde les contacts dans le cache
 */
export function setCachedContacts(branchId: string, contacts: Contact[]): void {
  if (typeof window === 'undefined') return

  try {
    const entry: CacheEntry<Contact[]> = {
      data: contacts,
      timestamp: Date.now(),
      branchId,
    }
    localStorage.setItem(CACHE_KEYS.CONTACTS, JSON.stringify(entry))
  } catch (e) {
    console.warn('Error writing contacts cache:', e)
  }
}

/**
 * Invalide le cache des contacts
 */
export function invalidateContactsCache(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CACHE_KEYS.CONTACTS)
}

// ============================================
// BRANCH CONFIG CACHE
// ============================================

interface BranchConfig {
  rooms: unknown[]
  settings: unknown
  laserRooms: unknown[]
}

/**
 * Récupère la config de branche depuis le cache
 */
export function getCachedBranchConfig(branchId: string): BranchConfig | null {
  if (typeof window === 'undefined') return null

  try {
    const cached = localStorage.getItem(CACHE_KEYS.BRANCH_CONFIG)
    if (!cached) return null

    const entry: CacheEntry<BranchConfig> = JSON.parse(cached)

    if (entry.branchId !== branchId) return null
    if (!isCacheValid(entry.timestamp, CACHE_TTL.BRANCH_CONFIG)) return null

    return entry.data
  } catch (e) {
    console.warn('Error reading branch config cache:', e)
    return null
  }
}

/**
 * Sauvegarde la config de branche dans le cache
 */
export function setCachedBranchConfig(branchId: string, config: BranchConfig): void {
  if (typeof window === 'undefined') return

  try {
    const entry: CacheEntry<BranchConfig> = {
      data: config,
      timestamp: Date.now(),
      branchId,
    }
    localStorage.setItem(CACHE_KEYS.BRANCH_CONFIG, JSON.stringify(entry))
  } catch (e) {
    console.warn('Error writing branch config cache:', e)
  }
}

// ============================================
// PREFETCH (charger les prochaines semaines)
// ============================================

/**
 * Génère les dates des X prochains jours
 */
export function getUpcomingDates(days: number = 45): string[] {
  const dates: string[] = []
  const today = new Date()

  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    dates.push(date.toISOString().split('T')[0])
  }

  return dates
}

/**
 * Vérifie quelles dates manquent dans le cache
 */
export function getMissingDates(branchId: string, dates: string[]): string[] {
  if (typeof window === 'undefined') return dates

  try {
    const cached = localStorage.getItem(CACHE_KEYS.BOOKINGS)
    if (!cached) return dates

    const entry: CacheEntry<BookingsCache> = JSON.parse(cached)
    if (entry.branchId !== branchId) return dates

    return dates.filter(date => !entry.data[date])
  } catch (e) {
    return dates
  }
}

// ============================================
// LAST SYNC TRACKING
// ============================================

/**
 * Récupère le timestamp de la dernière sync
 */
export function getLastSyncTime(branchId: string): number | null {
  if (typeof window === 'undefined') return null

  try {
    const cached = localStorage.getItem(CACHE_KEYS.LAST_SYNC)
    if (!cached) return null

    const data = JSON.parse(cached)
    return data[branchId] || null
  } catch (e) {
    return null
  }
}

/**
 * Met à jour le timestamp de sync
 */
export function setLastSyncTime(branchId: string): void {
  if (typeof window === 'undefined') return

  try {
    let data: Record<string, number> = {}
    const cached = localStorage.getItem(CACHE_KEYS.LAST_SYNC)
    if (cached) {
      data = JSON.parse(cached)
    }
    data[branchId] = Date.now()
    localStorage.setItem(CACHE_KEYS.LAST_SYNC, JSON.stringify(data))
  } catch (e) {
    console.warn('Error setting last sync time:', e)
  }
}

// Nettoyage automatique au chargement du module (côté client)
if (typeof window !== 'undefined') {
  // Nettoyer les vieux bookings au démarrage
  setTimeout(() => {
    cleanOldBookings()
  }, 1000)
}
