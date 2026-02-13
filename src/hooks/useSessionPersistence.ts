'use client'

/**
 * Hook pour maintenir la session active
 *
 * Ce hook garantit que :
 * - La session ne expire pas pendant l'utilisation
 * - Le token est rafraîchi silencieusement en arrière-plan
 * - L'utilisateur reste connecté tant qu'il utilise l'app
 *
 * Coordonné avec useInactivityTimeout via localStorage LAST_ACTIVITY_KEY
 * Removed the 30s check interval to reduce unnecessary API calls.
 */

import { useEffect, useRef, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'

// Intervalle de rafraîchissement du token (toutes les 10 minutes)
const REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes

// Clé partagée avec useInactivityTimeout
const LAST_ACTIVITY_KEY = 'last_activity_timestamp'
const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 minutes — same as useInactivityTimeout

export function useSessionPersistence() {
  const lastActivityRef = useRef(Date.now())
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Met à jour le timestamp de dernière activité
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  // Check if user is still active (not timed out by inactivity)
  const isUserActive = useCallback(() => {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY)
    if (lastActivity) {
      const elapsed = Date.now() - parseInt(lastActivity, 10)
      if (elapsed > INACTIVITY_TIMEOUT) {
        return false // User is inactive, don't refresh
      }
    }
    return true
  }, [])

  // Rafraîchit le token silencieusement
  const refreshSession = useCallback(async () => {
    // Don't refresh if user is considered inactive — let useInactivityTimeout handle logout
    if (!isUserActive()) {
      return false
    }

    const supabase = getClient()

    try {
      // D'abord vérifier si on a une session active
      const { data: { session: currentSession } } = await supabase.auth.getSession()

      if (!currentSession) {
        return false
      }

      // Essayer de rafraîchir
      const { data: { session }, error } = await supabase.auth.refreshSession()

      if (error) {
        console.warn('Session refresh failed:', error.message)
        return false
      }

      if (session) {
        return true
      }
    } catch (e) {
      console.warn('Session refresh exception:', e)
    }

    return false
  }, [isUserActive])

  // Configurer les listeners d'activité utilisateur
  useEffect(() => {
    if (typeof window === 'undefined') return

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']

    // Throttle les mises à jour d'activité (max 1 par seconde)
    let lastUpdate = 0
    const throttledUpdate = () => {
      const now = Date.now()
      if (now - lastUpdate > 1000) {
        lastUpdate = now
        updateActivity()
      }
    }

    events.forEach(event => {
      window.addEventListener(event, throttledUpdate, { passive: true })
    })

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, throttledUpdate)
      })
    }
  }, [updateActivity])

  // Configurer le rafraîchissement périodique du token (every 10 min, no more 30s check)
  useEffect(() => {
    // Rafraîchir le token toutes les 10 minutes (only if user is active)
    refreshTimerRef.current = setInterval(async () => {
      const timeSinceActivity = Date.now() - lastActivityRef.current
      if (timeSinceActivity < 30 * 60 * 1000 && isUserActive()) {
        await refreshSession()
      }
    }, REFRESH_INTERVAL)

    // Premier refresh immédiat
    refreshSession()

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [refreshSession, isUserActive])

  // Gérer la visibilité de la page (quand l'utilisateur revient sur l'onglet)
  // Note: autoRefreshToken: true dans la config Supabase gère déjà le refresh des tokens.
  // On ne fait que mettre à jour l'activité ici — pas de refreshSession() qui cause
  // des appels réseau inutiles et des cascades de re-render (spinner gris sur l'agenda).
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateActivity()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [updateActivity])

  return {
    updateActivity,
    refreshSession,
  }
}
