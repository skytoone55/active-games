'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { SWRConfig } from 'swr'
import { getClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { LanguageProvider, useTranslation } from '@/contexts/LanguageContext'
import { useSessionPersistence } from '@/hooks/useSessionPersistence'
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout'
import { ClaraProvider } from '@/components/Clara'
import { swrFetcher } from '@/lib/swr-fetcher'

function AdminLayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const hasCheckedRef = useRef(false)
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)
  const isLoginPage = pathname === '/admin/login'

  // Écouter les changements de thème depuis localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('admin_theme') as 'light' | 'dark' | null
    if (savedTheme) setTheme(savedTheme)

    // Écouter les changements de storage (cross-tab)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'admin_theme' && e.newValue) {
        setTheme(e.newValue as 'light' | 'dark')
      }
    }
    window.addEventListener('storage', handleStorage)

    // Intercept localStorage.setItem to detect same-page theme changes
    const origSetItem = localStorage.setItem.bind(localStorage)
    localStorage.setItem = (key: string, value: string) => {
      origSetItem(key, value)
      if (key === 'admin_theme') {
        setTheme(value as 'light' | 'dark')
      }
    }

    return () => {
      window.removeEventListener('storage', handleStorage)
      localStorage.setItem = origSetItem
    }
  }, [])

  // Maintenir la session active en arrière-plan
  useSessionPersistence()

  // Déconnexion automatique après 5 minutes d'inactivité (sauf sur page login)
  useInactivityTimeout()

  // Vérification initiale - UNE SEULE FOIS au montage
  useEffect(() => {
    // Skip si page login
    if (isLoginPage) {
      setIsAuthenticated(true)
      setIsChecking(false)
      return
    }

    // Skip si déjà vérifié
    if (hasCheckedRef.current) {
      setIsChecking(false)
      return
    }

    const checkAuth = async () => {
      const supabase = getClient()

      try {
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error || !user) {
          setIsAuthenticated(false)
        } else {
          setIsAuthenticated(true)
          hasCheckedRef.current = true
        }
      } catch {
        setIsAuthenticated(false)
      } finally {
        setIsChecking(false)
      }
    }

    checkAuth()
  }, [isLoginPage])

  // Écouter les changements d'authentification (login/logout) - UNE SEULE FOIS
  useEffect(() => {
    // Skip si page login ou déjà souscrit
    if (isLoginPage || subscriptionRef.current) {
      return
    }

    const supabase = getClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_IN') {
          setIsAuthenticated(true)
          hasCheckedRef.current = true
          setIsChecking(false)
        } else if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false)
          hasCheckedRef.current = false
        }
        // Ne pas réagir à TOKEN_REFRESHED pour éviter les déconnexions intempestives
      }
    )

    subscriptionRef.current = subscription

    return () => {
      subscription.unsubscribe()
      subscriptionRef.current = null
    }
  }, [isLoginPage])

  // Redirection vers login si non authentifié
  useEffect(() => {
    if (!isChecking && isAuthenticated === false && !isLoginPage) {
      router.push('/admin/login')
    }
  }, [isChecking, isAuthenticated, isLoginPage, router])

  // Pendant la vérification de l'auth ou redirection en cours
  if (isChecking || isAuthenticated === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          <p className="text-gray-400">{t('admin.common.loading')}</p>
        </div>
      </div>
    )
  }

  // Authentifié - afficher le contenu avec Clara disponible
  return (
    <ClaraProvider theme={theme}>
      {children}
    </ClaraProvider>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 10000,
        errorRetryCount: 2,
      }}
    >
      <LanguageProvider isAdmin={true}>
        <AdminLayoutContent>{children}</AdminLayoutContent>
      </LanguageProvider>
    </SWRConfig>
  )
}
