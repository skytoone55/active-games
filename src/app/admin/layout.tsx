'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { LanguageProvider, useTranslation } from '@/contexts/LanguageContext'

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
  const hasCheckedRef = useRef(false)
  const isLoginPage = pathname === '/admin/login'

  // Fonction de vérification stable
  const checkAuth = useCallback(async () => {
    if (isLoginPage) {
      setIsAuthenticated(true)
      setIsChecking(false)
      return
    }

    // Si déjà vérifié et authentifié, ne pas revérifier
    if (hasCheckedRef.current) {
      setIsChecking(false)
      return
    }

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
  }, [isLoginPage])

  // Vérification initiale - UNE SEULE FOIS au montage
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Écouter les changements d'authentification (login/logout)
  useEffect(() => {
    if (isLoginPage) {
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

    return () => {
      subscription.unsubscribe()
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

  // Authentifié - afficher le contenu
  return <>{children}</>
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <LanguageProvider isAdmin={true}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </LanguageProvider>
  )
}
