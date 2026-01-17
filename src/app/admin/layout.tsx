'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Skip auth check for login page
    if (pathname === '/admin/login') {
      setIsAuthenticated(true) // Allow access to login page
      setIsChecking(false)
      return
    }

    const checkAuth = async () => {
      const supabase = getClient()
      
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error || !user) {
          setIsAuthenticated(false)
          console.log('No authenticated user found')
        } else {
          setIsAuthenticated(true)
        }
      } catch (err) {
        console.error('Error checking auth:', err)
        setIsAuthenticated(false)
      } finally {
        setIsChecking(false)
      }
    }

    checkAuth()

    // Écouter les changements d'authentification
    const supabase = getClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN') {
          setIsAuthenticated(true)
        } else if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false)
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Session refreshed successfully')
          setIsAuthenticated(true)
        }
      }
    )

    // Refresh automatique de la session toutes les 5 minutes
    const refreshInterval = setInterval(async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (session && !error) {
        // La session existe, forcer un refresh
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          console.error('Erreur refresh session:', refreshError)
          // Si le refresh échoue, rediriger vers login
          setIsAuthenticated(false)
        } else {
          console.log('Session rafraîchie automatiquement')
        }
      }
    }, 5 * 60 * 1000) // 5 minutes

    return () => {
      subscription.unsubscribe()
      clearInterval(refreshInterval)
    }
  }, [pathname])

  // Pendant la vérification de l'auth
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          <p className="text-gray-400">Chargement...</p>
        </div>
      </div>
    )
  }

  // Non authentifié - rediriger vers login
  if (!isAuthenticated) {
    router.push('/admin/login')
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          <p className="text-gray-400">Redirection vers la connexion...</p>
        </div>
      </div>
    )
  }

  // Authentifié - afficher le contenu
  return <>{children}</>
}
