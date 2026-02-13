'use client'

/**
 * Hook pour maintenir la session active
 *
 * Ce hook garantit que :
 * - La session ne expire pas pendant l'utilisation
 * - Le token est rafraîchi silencieusement en arrière-plan
 * - L'utilisateur reste connecté tant qu'il utilise l'app
 *
 * Pas de déconnexion automatique pour inactivité — les employés ont besoin
 * que leur session reste ouverte. Supabase autoRefreshToken gère le gros
 * du travail, ce hook est un filet de sécurité.
 */

import { useEffect, useRef, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'

// Intervalle de rafraîchissement du token (toutes les 10 minutes)
const REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes

export function useSessionPersistence() {
  const lastActivityRef = useRef(Date.now())
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

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
  }, [])

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

  // Configurer le rafraîchissement périodique du token (every 10 min)
  useEffect(() => {
    // Rafraîchir le token toutes les 10 minutes si activité récente (< 1h)
    refreshTimerRef.current = setInterval(async () => {
      const timeSinceActivity = Date.now() - lastActivityRef.current
      if (timeSinceActivity < 60 * 60 * 1000) {
        await refreshSession()
      }
    }, REFRESH_INTERVAL)

    // Pas de refresh immédiat — autoRefreshToken: true dans la config Supabase
    // gère déjà le refresh. Le timer ci-dessus est un filet de sécurité.

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [refreshSession])

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
