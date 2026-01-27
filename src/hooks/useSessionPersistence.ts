'use client'

/**
 * Hook pour maintenir la session active
 *
 * Ce hook garantit que :
 * - La session ne expire pas pendant l'utilisation
 * - Le token est rafraîchi silencieusement en arrière-plan
 * - L'utilisateur reste connecté tant qu'il utilise l'app
 */

import { useEffect, useRef, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'

// Intervalle de rafraîchissement du token (toutes les 10 minutes)
const REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes

// Intervalle de vérification de session (toutes les 30 secondes)
const CHECK_INTERVAL = 30 * 1000 // 30 secondes

export function useSessionPersistence() {
  const lastActivityRef = useRef(Date.now())
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const checkTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Met à jour le timestamp de dernière activité
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  // Rafraîchit le token silencieusement
  const refreshSession = useCallback(async () => {
    const supabase = getClient()

    try {
      // D'abord vérifier si on a une session active
      const { data: { session: currentSession } } = await supabase.auth.getSession()

      if (!currentSession) {
        console.warn('No active session to refresh')
        return false
      }

      // Essayer de rafraîchir
      const { data: { session }, error } = await supabase.auth.refreshSession()

      if (error) {
        console.warn('Session refresh failed:', error.message)
        // Si le refresh échoue, la session est probablement invalide
        // Supabase va automatiquement déclencher SIGNED_OUT
        return false
      }

      if (session) {
        return true
      }
    } catch (e) {
      console.warn('Session refresh exception:', e)
    }

    return false
  }, [])

  // Vérifie si la session est toujours valide
  const checkSession = useCallback(async () => {
    const supabase = getClient()

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        // Essayer de rafraîchir
        await refreshSession()
      }
    } catch (e) {
      console.warn('Session check failed:', e)
    }
  }, [refreshSession])

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

  // Configurer le rafraîchissement périodique du token
  useEffect(() => {
    // Rafraîchir le token toutes les 10 minutes
    refreshTimerRef.current = setInterval(async () => {
      // Seulement si l'utilisateur a été actif dans les 30 dernières minutes
      const timeSinceActivity = Date.now() - lastActivityRef.current
      if (timeSinceActivity < 30 * 60 * 1000) {
        await refreshSession()
      }
    }, REFRESH_INTERVAL)

    // Vérifier la session toutes les 30 secondes
    checkTimerRef.current = setInterval(async () => {
      await checkSession()
    }, CHECK_INTERVAL)

    // Premier refresh immédiat
    refreshSession()

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
      if (checkTimerRef.current) {
        clearInterval(checkTimerRef.current)
      }
    }
  }, [refreshSession, checkSession])

  // Gérer la visibilité de la page (quand l'utilisateur revient sur l'onglet)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // L'utilisateur est revenu - vérifier et rafraîchir la session
        updateActivity()
        await checkSession()
        await refreshSession()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [updateActivity, checkSession, refreshSession])

  // Gérer le focus de la fenêtre
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleFocus = async () => {
      updateActivity()
      await checkSession()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [updateActivity, checkSession])

  return {
    updateActivity,
    refreshSession,
    checkSession,
  }
}
