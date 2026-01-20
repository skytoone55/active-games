'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { Loader2, Lock as LockIcon, Mail, AlertCircle, Globe, ChevronDown } from 'lucide-react'
import Image from 'next/image'
import { useTranslation } from '@/contexts/LanguageContext'
import type { Locale } from '@/i18n'

const languageFlags: Record<Locale, { flag: string; label: string }> = {
  fr: { flag: '🇫🇷', label: 'Français' },
  en: { flag: '🇬🇧', label: 'English' },
  he: { flag: '🇮🇱', label: 'עברית' }
}

export default function LoginPage() {
  const router = useRouter()
  const { t, locale, setLocale } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  // Charger les identifiants sauvegardés au montage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('remembered_email')
      const savedPassword = localStorage.getItem('remembered_password')
      if (savedEmail && savedPassword) {
        setEmail(savedEmail)
        setPassword(savedPassword)
        setRememberMe(true)
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = getClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setError(t('admin.login.error_invalid'))
        } else if (authError.message.includes('Email not confirmed')) {
          setError(t('admin.login.error_generic'))
        } else {
          setError(authError.message)
        }
        setLoading(false)
        return
      }

      // Sauvegarder ou supprimer les identifiants selon "Se souvenir de moi"
      if (rememberMe) {
        localStorage.setItem('remembered_email', email)
        localStorage.setItem('remembered_password', password)
      } else {
        localStorage.removeItem('remembered_email')
        localStorage.removeItem('remembered_password')
      }

      // Connexion réussie - redirection vers admin
      // Note: ne pas setLoading(false) ici car on redirige
      router.push('/admin')
    } catch (err) {
      console.error('Login error:', err)
      setError(t('admin.login.error_generic'))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4 relative">
      {/* Language Selector - Top Right */}
      <div className="absolute top-4 right-4">
        <div className="relative">
          <button
            onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          >
            <Globe className="w-4 h-4" />
            <span>{languageFlags[locale].flag}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showLanguageMenu ? 'rotate-180' : ''}`} />
          </button>

          {showLanguageMenu && (
            <div className="absolute right-0 top-full mt-2 w-40 rounded-lg shadow-xl z-50 overflow-hidden bg-gray-800 border border-gray-700">
              {(Object.keys(languageFlags) as Locale[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    setLocale(lang)
                    setShowLanguageMenu(false)
                  }}
                  className={`w-full px-4 py-2 text-left flex items-center gap-3 transition-colors ${
                    locale === lang
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span className="text-lg">{languageFlags[lang].flag}</span>
                  <span>{languageFlags[lang].label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-6 mb-6">
            <Image
              src="/images/logo-activegames.png"
              alt="Active Games"
              width={160}
              height={60}
              className="h-16 w-auto object-contain"
              priority
            />
            <Image
              src="/images/logo_laser_city.png"
              alt="Laser City"
              width={160}
              height={60}
              className="h-16 w-auto object-contain"
              priority
            />
          </div>
          <p className="text-gray-400 mt-2">{t('admin.login.subtitle')}</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-8 shadow-xl border border-gray-700">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Email Field */}
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              {t('admin.login.email')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder={t('admin.login.email_placeholder')}
                className="w-full pl-11 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              {t('admin.login.password')}
            </label>
            <div className="relative">
              <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-gray-800"
              />
              <span className="text-sm text-gray-300">{t('admin.login.remember_me')}</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('admin.login.logging_in')}
              </>
            ) : (
              t('admin.login.submit')
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Active Games World &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
