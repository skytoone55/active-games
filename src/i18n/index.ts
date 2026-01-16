import en from './locales/en.json'
import he from './locales/he.json'

// Franchisé : seulement EN et HE
export const locales = ['he', 'en'] as const
export type Locale = (typeof locales)[number]

// Hébreu par défaut pour le franchisé en Israël
export const defaultLocale: Locale = 'he'

const translations = { en, he }

export function getTranslations(locale: Locale) {
  return translations[locale] || translations.he
}

export function getDirection(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'he' ? 'rtl' : 'ltr'
}

export const languageNames: Record<Locale, string> = {
  en: 'English',
  he: 'עברית',
}

export const languageFlags: Record<Locale, string> = {
  en: '🇺🇸',
  he: '🇮🇱',
}
