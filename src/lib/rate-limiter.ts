/**
 * Rate Limiter simple in-memory pour les API publiques
 *
 * Limite : 5 requêtes par minute par IP
 * Reset au redéploiement Vercel (suffisant pour bloquer le spam basique)
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// Map en mémoire pour stocker les compteurs par IP
const rateLimitMap = new Map<string, RateLimitEntry>()

// Nettoyer les entrées expirées toutes les 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanupExpiredEntries() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key)
    }
  }
  lastCleanup = now
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Vérifie et incrémente le compteur de rate limit pour une IP
 * @param ip - Adresse IP du client
 * @param limit - Nombre max de requêtes (défaut: 5)
 * @param windowMs - Fenêtre de temps en ms (défaut: 60000 = 1 minute)
 * @returns { success: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  ip: string,
  limit: number = 5,
  windowMs: number = 60 * 1000
): RateLimitResult {
  cleanupExpiredEntries()

  const now = Date.now()
  const key = `ratelimit:${ip}`
  const entry = rateLimitMap.get(key)

  // Si pas d'entrée ou entrée expirée, créer une nouvelle
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + windowMs,
    })
    return {
      success: true,
      remaining: limit - 1,
      resetAt: now + windowMs,
    }
  }

  // Incrémenter le compteur
  entry.count++

  // Vérifier si limite atteinte
  if (entry.count > limit) {
    console.warn(`[RATE-LIMIT] IP ${ip} exceeded limit: ${entry.count}/${limit} requests`)
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  return {
    success: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Helper pour extraire l'IP depuis les headers Next.js
 */
export function getClientIp(headers: Headers): string {
  // Vercel/Cloudflare headers
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  return 'unknown'
}
