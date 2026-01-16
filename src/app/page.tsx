'use client'

import { useState, useEffect } from 'react'
import {
  Header,
  HeroSection,
  ConceptSection,
  GamesSection,
  PricingSection,
  BranchesSection,
  ContactSection,
  Footer,
  WhatsAppButton,
} from '@/components'
import { getTranslations, getDirection, Locale, defaultLocale } from '@/i18n'

export default function Home() {
  const [locale, setLocale] = useState<Locale>(defaultLocale)
  const [translations, setTranslations] = useState(getTranslations(defaultLocale))

  useEffect(() => {
    // Check for saved locale preference
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem('locale') as Locale
      if (savedLocale && ['en', 'he'].includes(savedLocale)) {
        setLocale(savedLocale)
        setTranslations(getTranslations(savedLocale))
      }
    }
  }, [])

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale)
    setTranslations(getTranslations(newLocale))
    localStorage.setItem('locale', newLocale)
    
    // Update document direction for RTL support
    document.documentElement.dir = getDirection(newLocale)
    document.documentElement.lang = newLocale
  }

  const isRTL = locale === 'he'

  return (
    <div dir={getDirection(locale)}>
      <Header 
        translations={translations} 
        locale={locale} 
        onLocaleChange={handleLocaleChange} 
      />
      
      <main>
        <HeroSection translations={translations} />
        <ConceptSection translations={translations} />
        <GamesSection translations={translations} />
        <PricingSection translations={translations} isRTL={isRTL} />
        <BranchesSection translations={translations} />
        <ContactSection translations={translations} />
      </main>

      <Footer translations={translations} />
      <WhatsAppButton />
    </div>
  )
}
