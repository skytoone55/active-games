'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Database, Loader2, AlertTriangle, FileX } from 'lucide-react'
import { useAdmin } from '@/contexts/AdminContext'
import { useTranslation } from '@/contexts/LanguageContext'

export default function DataManagementPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user, isDark } = useAdmin()

  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Redirect non super_admin users
  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      router.push('/admin')
    }
  }, [user, router])

  const handleVerifyPassword = async () => {
    if (!password) {
      setPasswordError(t('admin.data_management.password_required'))
      return
    }

    setPasswordError(null)
    setIsVerifying(true)

    try {
      const response = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      const data = await response.json()

      if (!data.success) {
        setPasswordError(data.error || t('admin.data_management.password_incorrect'))
        setIsVerifying(false)
        return
      }

      // Success - show the menu
      setIsAuthenticated(true)
    } catch (error) {
      console.error('Error verifying password:', error)
      setPasswordError(t('admin.data_management.server_error'))
    } finally {
      setIsVerifying(false)
    }
  }

  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    )
  }

  if (user.role !== 'super_admin') {
    return null
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {!isAuthenticated ? (
          // Password Screen
          <div className={`p-8 rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-6">
              <div className={`p-3 rounded-xl ${isDark ? 'bg-red-900/30' : 'bg-red-100'}`}>
                <Database className={`w-8 h-8 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {t('admin.data_management.title')}
                </h1>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('admin.data_management.access_restricted')}
                </p>
              </div>
            </div>

            <div className={`mb-6 p-4 rounded-xl border-2 ${
              isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                  {t('admin.data_management.password_warning')}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('admin.data_management.enter_password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleVerifyPassword()}
                placeholder={t('admin.data_management.password_placeholder')}
                className={`w-full px-4 py-3 rounded-lg border ${
                  passwordError
                    ? 'border-red-500'
                    : isDark ? 'border-gray-700 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-900'
                }`}
                autoFocus
              />
              {passwordError && (
                <p className="mt-2 text-sm text-red-500">{passwordError}</p>
              )}
            </div>

            <button
              onClick={handleVerifyPassword}
              disabled={!password || isVerifying}
              className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 ${
                !password || isVerifying
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('admin.data_management.verifying')}
                </>
              ) : (
                t('admin.data_management.access_button')
              )}
            </button>
          </div>
        ) : (
          // Menu with 2 buttons
          <div className="space-y-4">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-3 rounded-xl ${isDark ? 'bg-red-900/30' : 'bg-red-100'}`}>
                  <Database className={`w-8 h-8 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                </div>
                <div>
                  <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {t('admin.data_management.title')}
                  </h1>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {t('admin.data_management.choose_section')}
                  </p>
                </div>
              </div>
            </div>

            {/* Button 1: Data Management Cleanup */}
            <button
              onClick={() => router.push('/admin/data-management/cleanup')}
              className={`w-full p-6 rounded-xl shadow-lg transition-all ${
                isDark
                  ? 'bg-gray-800 hover:bg-gray-750 border border-gray-700'
                  : 'bg-white hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-xl ${
                  isDark ? 'bg-orange-900/30' : 'bg-orange-100'
                }`}>
                  <Database className={`w-8 h-8 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                </div>
                <div className="text-left flex-1">
                  <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {t('admin.data_management.cleanup_title')}
                  </h3>
                  <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {t('admin.data_management.cleanup_description')}
                  </p>
                </div>
              </div>
            </button>

            {/* Button 2: OUT Orders */}
            <button
              onClick={() => router.push('/admin/data-management/out-orders')}
              className={`w-full p-6 rounded-xl shadow-lg transition-all ${
                isDark
                  ? 'bg-gray-800 hover:bg-gray-750 border border-gray-700'
                  : 'bg-white hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-xl ${
                  isDark ? 'bg-purple-900/30' : 'bg-purple-100'
                }`}>
                  <FileX className={`w-8 h-8 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                </div>
                <div className="text-left flex-1">
                  <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {t('admin.data_management.out_orders_title')}
                  </h3>
                  <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {t('admin.data_management.out_orders_description')}
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
