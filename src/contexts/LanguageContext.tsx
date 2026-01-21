'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import {
  Locale,
  locales,
  defaultLocale,
  defaultAdminLocale,
  getTranslations,
  getDirection,
  languageNames,
  languageFlags,
  PUBLIC_LOCALE_KEY,
  ADMIN_LOCALE_KEY,
} from '@/i18n'

// Type pour les traductions (structure flexible pour supporter les JSON imbriqués)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Translations = Record<string, any>

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
  tArray: (key: string) => string[]
  direction: 'ltr' | 'rtl'
  isRTL: boolean
  languageNames: Record<Locale, string>
  languageFlags: Record<Locale, string>
  availableLocales: readonly Locale[]
}

const LanguageContext = createContext<LanguageContextType | null>(null)

interface LanguageProviderProps {
  children: ReactNode
  isAdmin?: boolean // Pour distinguer site public vs CRM
  initialLocale?: Locale
}

export function LanguageProvider({ children, isAdmin = false, initialLocale }: LanguageProviderProps) {
  const storageKey = isAdmin ? ADMIN_LOCALE_KEY : PUBLIC_LOCALE_KEY
  const defaultLang = isAdmin ? defaultAdminLocale : defaultLocale

  const [locale, setLocaleState] = useState<Locale>(initialLocale || defaultLang)
  const [translations, setTranslations] = useState<Translations>(() => getTranslations(initialLocale || defaultLang))
  const [isInitialized, setIsInitialized] = useState(false)

  // Charger la langue depuis localStorage au montage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem(storageKey) as Locale | null
      if (savedLocale && locales.includes(savedLocale)) {
        setLocaleState(savedLocale)
        setTranslations(getTranslations(savedLocale))
      }
      setIsInitialized(true)
    }
  }, [storageKey])

  // Mettre à jour les attributs HTML quand la langue change
  useEffect(() => {
    if (typeof window !== 'undefined' && isInitialized) {
      const dir = getDirection(locale)
      document.documentElement.dir = dir
      document.documentElement.lang = locale
    }
  }, [locale, isInitialized])

  // Fonction pour changer de langue
  const setLocale = useCallback((newLocale: Locale) => {
    if (locales.includes(newLocale)) {
      setLocaleState(newLocale)
      setTranslations(getTranslations(newLocale))
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, newLocale)
      }
    }
  }, [storageKey])

  // Fonction de traduction avec support des clés nested (ex: "admin.sidebar.agenda")
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = translations

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        // Clé non trouvée, retourner la clé elle-même
        return key
      }
    }

    if (typeof value !== 'string') {
      return key
    }

    // Remplacer les paramètres {{param}}
    if (params) {
      let result = value
      for (const [paramKey, paramValue] of Object.entries(params)) {
        result = result.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramValue))
      }
      return result
    }

    return value
  }, [translations])

  // Fonction pour récupérer des tableaux de traductions
  const tArray = useCallback((key: string): string[] => {
    const keys = key.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = translations

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return []
      }
    }

    if (Array.isArray(value)) {
      return value
    }
    return []
  }, [translations])

  const direction = useMemo(() => getDirection(locale), [locale])
  const isRTL = useMemo(() => direction === 'rtl', [direction])

  const contextValue = useMemo<LanguageContextType>(() => ({
    locale,
    setLocale,
    t,
    tArray,
    direction,
    isRTL,
    languageNames,
    languageFlags,
    availableLocales: locales,
  }), [locale, setLocale, t, tArray, direction, isRTL])

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  )
}

// Hook personnalisé pour utiliser les traductions
export function useTranslation() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider')
  }
  return context
}

// Hook pour accéder seulement à la fonction t (optimisation)
export function useT() {
  const { t } = useTranslation()
  return t
}
