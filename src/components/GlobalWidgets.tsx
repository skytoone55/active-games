'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { ClaraWidget } from './Clara/ClaraWidget'
import WhatsAppButton from './WhatsAppButton'
import { Locale, defaultLocale } from '@/i18n'

/**
 * GlobalWidgets - Composant qui affiche Clara et WhatsApp sur les pages publiques uniquement
 * Ce composant gère la locale de manière autonome via localStorage
 * Ne s'affiche PAS sur les pages admin
 */
export function GlobalWidgets() {
  const pathname = usePathname()
  const [locale, setLocale] = useState<Locale>(defaultLocale)

  // Ne pas afficher les widgets sur les pages admin
  const isAdminPage = pathname?.startsWith('/admin')

  useEffect(() => {
    // Écouter les changements de locale depuis localStorage
    const updateLocale = () => {
      const savedLocale = localStorage.getItem('locale') as Locale
      if (savedLocale && ['en', 'he', 'fr'].includes(savedLocale)) {
        setLocale(savedLocale)
      }
    }

    // Charger la locale initiale
    updateLocale()

    // Écouter les changements (pour quand l'utilisateur change de langue)
    window.addEventListener('storage', updateLocale)

    // Écouter aussi un événement custom pour les changements dans la même fenêtre
    window.addEventListener('localeChange', updateLocale)

    return () => {
      window.removeEventListener('storage', updateLocale)
      window.removeEventListener('localeChange', updateLocale)
    }
  }, [])

  // Ne pas rendre les widgets sur les pages admin
  if (isAdminPage) {
    return null
  }

  // Convertir la locale pour Clara (he, en, fr)
  const claraLocale = locale === 'he' ? 'he' : locale === 'fr' ? 'fr' : 'en'

  return (
    <>
      <WhatsAppButton />
      <ClaraWidget locale={claraLocale} />
    </>
  )
}
