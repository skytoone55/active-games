'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { SWRConfig } from 'swr'
import { getClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { LanguageProvider, useTranslation } from '@/contexts/LanguageContext'
import { useSessionPersistence } from '@/hooks/useSessionPersistence'
import { ClaraProvider } from '@/components/Clara'
import { swrFetcher } from '@/lib/swr-fetcher'
import { AdminProvider, useAdmin } from '@/contexts/AdminContext'
import { AdminHeader } from './components/AdminHeader'

/**
 * AdminHeader rendu dans le layout — lit user/branches/signOut depuis AdminContext.
 * Persiste entre les navigations car il est dans le layout, pas dans les pages.
 */
function AdminHeaderInLayout({ theme, toggleTheme }: { theme: 'light' | 'dark'; toggleTheme: () => void }) {
  const { user, branches, selectedBranch, selectBranch, signOut } = useAdmin()

  if (!user) return null

  return (
    <AdminHeader
      user={user}
      branches={branches}
      selectedBranch={selectedBranch}
      onBranchSelect={selectBranch}
      onSignOut={signOut}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  )
}

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

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem('admin_theme', newTheme)
      return newTheme
    })
  }, [])

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

    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  // Maintenir la session active en arrière-plan
  useSessionPersistence()

  // Le middleware vérifie déjà l'auth côté serveur.
  // Si on arrive dans ce layout, c'est que le middleware a validé la session.
  // Pas besoin de refaire getUser() côté client (économise 300ms-3s réseau).
  // L'auth listener ci-dessous gère les cas de déconnexion en temps réel.
  useEffect(() => {
    setIsAuthenticated(true)
    hasCheckedRef.current = true
    setIsChecking(false)
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
  // Login page: pas de header, pas de AdminProvider
  if (isLoginPage) {
    return (
      <ClaraProvider theme={theme}>
        {children}
      </ClaraProvider>
    )
  }

  return (
    <AdminProvider theme={theme} toggleTheme={toggleTheme}>
      <ClaraProvider theme={theme}>
        <div className="admin-layout">
          <AdminHeaderInLayout theme={theme} toggleTheme={toggleTheme} />
          {children}
        </div>
      </ClaraProvider>
    </AdminProvider>
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
