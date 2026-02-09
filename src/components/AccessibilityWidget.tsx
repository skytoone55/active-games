'use client'

import { useState, useEffect } from 'react'
import { Settings, X, Type, Eye, Link as LinkIcon, Space, Pause } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'

interface A11ySettings {
  fontSize: 'normal' | 'large' | 'larger'
  highContrast: boolean
  underlineLinks: boolean
  letterSpacing: boolean
  pauseAnimations: boolean
}

const DEFAULT_SETTINGS: A11ySettings = {
  fontSize: 'normal',
  highContrast: false,
  underlineLinks: false,
  letterSpacing: false,
  pauseAnimations: false,
}

export function AccessibilityWidget() {
  const { t, isRTL } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [settings, setSettings] = useState<A11ySettings>(DEFAULT_SETTINGS)

  // Charger depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem('a11y-settings')
    if (saved) {
      try {
        setSettings(JSON.parse(saved))
      } catch {
        setSettings(DEFAULT_SETTINGS)
      }
    }
  }, [])

  // Sauvegarder et appliquer
  useEffect(() => {
    localStorage.setItem('a11y-settings', JSON.stringify(settings))
    applySettings(settings)
  }, [settings])

  const applySettings = (s: A11ySettings) => {
    const root = document.documentElement

    // Taille de police
    root.classList.remove('a11y-font-large', 'a11y-font-larger')
    if (s.fontSize === 'large') root.classList.add('a11y-font-large')
    if (s.fontSize === 'larger') root.classList.add('a11y-font-larger')

    // Contraste élevé
    root.classList.toggle('a11y-high-contrast', s.highContrast)

    // Souligner les liens
    root.classList.toggle('a11y-underline-links', s.underlineLinks)

    // Espacement des lettres
    root.classList.toggle('a11y-letter-spacing', s.letterSpacing)

    // Pause animations
    root.classList.toggle('a11y-pause-animations', s.pauseAnimations)
  }

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS)
  }

  const toggleSetting = (key: keyof Omit<A11ySettings, 'fontSize'>) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const setFontSize = (size: 'normal' | 'large' | 'larger') => {
    setSettings(prev => ({ ...prev, fontSize: size }))
  }

  return (
    <>
      {/* Bouton toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('accessibility.toggle')}
        aria-expanded={isOpen}
        className={`fixed ${isRTL ? 'right-0' : 'left-0'} top-1/2 -translate-y-1/2 z-50 bg-primary text-dark p-3 ${isRTL ? 'rounded-l-lg' : 'rounded-r-lg'} shadow-lg hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-labelledby="a11y-title"
          aria-modal="false"
          className={`fixed ${isRTL ? 'right-0' : 'left-0'} top-1/2 -translate-y-1/2 z-40 bg-dark-100 border-2 border-primary ${isRTL ? 'rounded-l-xl' : 'rounded-r-xl'} p-6 shadow-2xl w-80 max-h-[80vh] overflow-y-auto`}
          style={{ backdropFilter: 'blur(10px)' }}
        >
          <h2 id="a11y-title" className="text-xl font-bold mb-6 text-primary flex items-center gap-2">
            <Settings className="w-6 h-6" />
            {t('accessibility.title')}
          </h2>

          <div className="space-y-5">
            {/* Taille de police */}
            <div>
              <label className="block mb-3 font-medium text-white flex items-center gap-2">
                <Type className="w-4 h-4" />
                {t('accessibility.font_size')}
              </label>
              <div className="flex gap-2">
                {(['normal', 'large', 'larger'] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    className={`flex-1 px-3 py-2 rounded font-bold transition-colors ${
                      settings.fontSize === size
                        ? 'bg-primary text-dark'
                        : 'bg-dark-200 text-white hover:bg-dark-300'
                    }`}
                    aria-pressed={settings.fontSize === size}
                  >
                    <span className={size === 'normal' ? 'text-sm' : size === 'large' ? 'text-base' : 'text-lg'}>
                      A
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Contraste élevé */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.highContrast}
                onChange={() => toggleSetting('highContrast')}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="flex-1 text-white group-hover:text-primary transition-colors">
                <Eye className="w-4 h-4 inline mr-2" />
                {t('accessibility.high_contrast')}
              </span>
            </label>

            {/* Souligner les liens */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.underlineLinks}
                onChange={() => toggleSetting('underlineLinks')}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="flex-1 text-white group-hover:text-primary transition-colors">
                <LinkIcon className="w-4 h-4 inline mr-2" />
                {t('accessibility.underline_links')}
              </span>
            </label>

            {/* Espacement des lettres */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.letterSpacing}
                onChange={() => toggleSetting('letterSpacing')}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="flex-1 text-white group-hover:text-primary transition-colors">
                <Space className="w-4 h-4 inline mr-2" />
                {t('accessibility.letter_spacing')}
              </span>
            </label>

            {/* Pause animations */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={settings.pauseAnimations}
                onChange={() => toggleSetting('pauseAnimations')}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="flex-1 text-white group-hover:text-primary transition-colors">
                <Pause className="w-4 h-4 inline mr-2" />
                {t('accessibility.pause_animations')}
              </span>
            </label>
          </div>

          {/* Reset button */}
          <button
            onClick={resetSettings}
            className="mt-6 w-full bg-dark-200 hover:bg-dark-300 text-white px-4 py-2 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {t('accessibility.reset')}
          </button>
        </div>
      )}
    </>
  )
}
