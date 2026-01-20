'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'

const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 minutes en millisecondes
const LAST_ACTIVITY_KEY = 'last_activity_timestamp'

export function useInactivityTimeout() {
  const router = useRouter()
  const pathname = usePathname()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isLoggingOutRef = useRef(false)
  const isLoginPage = pathname === '/admin/login'

  const logout = useCallback(async () => {
    // Éviter les appels multiples
    if (isLoggingOutRef.current) return
    isLoggingOutRef.current = true

    const supabase = getClient()

    // Nettoyer le timestamp
    localStorage.removeItem(LAST_ACTIVITY_KEY)

    // Logger la déconnexion pour inactivité
    try {
      await fetch('/api/auth/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout_inactivity' })
      })
    } catch (e) {
      console.error('Failed to log inactivity logout:', e)
    }

    await supabase.auth.signOut()
    router.push('/admin/login')
  }, [router])

  const updateLastActivity = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
  }, [])

  const checkInactivity = useCallback(() => {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY)
    if (lastActivity) {
      const elapsed = Date.now() - parseInt(lastActivity, 10)
      if (elapsed > INACTIVITY_TIMEOUT) {
        // Plus de 5 minutes d'inactivité - déconnecter
        logout()
        return true
      }
    }
    return false
  }, [logout])

  const resetTimer = useCallback(() => {
    // Mettre à jour le timestamp de dernière activité
    updateLastActivity()

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      logout()
    }, INACTIVITY_TIMEOUT)
  }, [logout, updateLastActivity])

  useEffect(() => {
    // Skip sur la page login
    if (isLoginPage) return

    // Vérifier immédiatement si la session a expiré (fermeture navigateur, etc.)
    if (checkInactivity()) {
      return // Déjà en cours de déconnexion
    }

    // Events qui indiquent une activité utilisateur
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

    // Reset timer on any activity
    const handleActivity = () => {
      resetTimer()
    }

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    // Start initial timer
    resetTimer()

    // Handle visibility change (tab switch, browser minimize)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab redevient visible - vérifier si on a dépassé le timeout
        if (!checkInactivity()) {
          resetTimer()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      events.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [resetTimer, checkInactivity, isLoginPage])
}
