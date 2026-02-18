'use client'

import { useState, useEffect } from 'react'
import {
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  RefreshCw,
  CreditCard,
  Save,
  Trash2
} from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'
import { useBranches } from '@/hooks/useBranches'

interface CredentialsSectionProps {
  isDark: boolean
}

interface PaymentCredentials {
  id?: string
  branch_id: string
  provider: string
  cid: string
  username: string
  password: string
  is_active: boolean
  last_connection_test?: string
  last_connection_status?: boolean
  last_connection_error?: string
}

export function CredentialsSection({ isDark }: CredentialsSectionProps) {
  const { t } = useTranslation()
  const { branches, selectedBranch } = useBranches()

  const [credentials, setCredentials] = useState<PaymentCredentials | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown')

  // Form state
  const [formData, setFormData] = useState({
    cid: '',
    username: '',
    password: ''
  })

  // Fetch credentials for selected branch
  const fetchCredentials = async () => {
    if (!selectedBranch) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/payment-credentials?branch_id=${selectedBranch.id}`)

      if (!response.ok) {
        throw new Error('Failed to fetch credentials')
      }

      const data = await response.json()

      if (data) {
        setCredentials(data)
        setFormData({
          cid: data.cid || '',
          username: data.username || '',
          password: '' // Don't show masked password in form
        })

        // Set connection status based on last test
        if (data.last_connection_status === true) {
          setConnectionStatus('connected')
        } else if (data.last_connection_status === false) {
          setConnectionStatus('error')
        } else {
          setConnectionStatus('unknown')
        }
      } else {
        setCredentials(null)
        setFormData({ cid: '', username: '', password: '' })
        setConnectionStatus('unknown')
      }
    } catch (err) {
      console.error('Error fetching credentials:', err)
      setError('Failed to load credentials')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCredentials()
  }, [selectedBranch?.id])

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // Test connection
  const handleTestConnection = async () => {
    if (!formData.cid || !formData.username) {
      setError('Please fill in Company ID and Username to test connection')
      return
    }
    // If no password in form AND no existing credentials, require password
    if (!formData.password && !credentials) {
      setError('Please enter the password to test connection')
      return
    }

    setTesting(true)
    setError(null)

    try {
      const response = await fetch('/api/payment-credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cid: formData.cid,
          username: formData.username,
          password: formData.password || '', // Backend reads from DB if empty
          branch_id: selectedBranch?.id
        })
      })

      const result = await response.json()

      if (result.success) {
        setConnectionStatus('connected')
        setSuccessMessage(`Connected successfully! Company: ${result.company}, User: ${result.user}`)
      } else {
        setConnectionStatus('error')
        setError(result.message || 'Connection failed')
      }
    } catch (err) {
      console.error('Connection test error:', err)
      setConnectionStatus('error')
      setError('Connection test failed')
    } finally {
      setTesting(false)
    }
  }

  // Save credentials
  const handleSave = async () => {
    if (!selectedBranch) return
    if (!formData.cid || !formData.username) {
      setError('Company ID and Username are required')
      return
    }
    if (!credentials && !formData.password) {
      setError('Password is required for new credentials')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/payment-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: selectedBranch.id,
          cid: formData.cid,
          username: formData.username,
          password: formData.password || '' // Backend preserves existing password if empty
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save credentials')
      }

      const data = await response.json()
      setCredentials(data)
      setFormData(prev => ({ ...prev, password: '' }))
      setSuccessMessage('Credentials saved successfully')
    } catch (err) {
      console.error('Error saving credentials:', err)
      setError('Failed to save credentials')
    } finally {
      setSaving(false)
    }
  }

  // Delete credentials
  const handleDelete = async () => {
    if (!selectedBranch || !credentials) return

    if (!confirm('Are you sure you want to delete these credentials?')) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/payment-credentials?branch_id=${selectedBranch.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete credentials')
      }

      setCredentials(null)
      setFormData({ cid: '', username: '', password: '' })
      setConnectionStatus('unknown')
      setSuccessMessage('Credentials deleted successfully')
    } catch (err) {
      console.error('Error deleting credentials:', err)
      setError('Failed to delete credentials')
    } finally {
      setSaving(false)
    }
  }

  // Status indicator component
  const StatusIndicator = () => {
    if (connectionStatus === 'connected') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <span className="text-green-500 text-sm font-medium">Connected</span>
        </div>
      )
    } else if (connectionStatus === 'error') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-red-500 text-sm font-medium">Connection Error</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isDark ? 'bg-gray-600' : 'bg-gray-400'}`} />
        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Not tested</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Payment Provider Credentials
          </h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Configure iCount API credentials for {selectedBranch?.name || 'this branch'}
          </p>
        </div>
        <StatusIndicator />
      </div>

      {/* Error message */}
      {error && (
        <div className={`flex items-center gap-2 p-3 rounded-lg ${
          isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'
        }`}>
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className={`flex items-center gap-2 p-3 rounded-lg ${
          isDark ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'
        }`}>
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-green-500 text-sm">{successMessage}</p>
        </div>
      )}

      {/* Credentials Form */}
      <div className={`rounded-xl border ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        {/* Card Header */}
        <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isDark ? 'bg-blue-500/20' : 'bg-blue-100'
            }`}>
              <CreditCard className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                iCount API
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Israeli payment and invoicing provider
              </p>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="p-6 space-y-4">
          {/* Company ID */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Company ID (cid)
            </label>
            <input
              type="text"
              value={formData.cid}
              onChange={(e) => setFormData(prev => ({ ...prev, cid: e.target.value }))}
              placeholder="e.g., activelaser"
              className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            />
          </div>

          {/* Username */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Username (email)
            </label>
            <input
              type="email"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              placeholder="e.g., contact@activegames.co.il"
              className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            />
          </div>

          {/* Password */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Password {credentials && <span className="text-gray-500 font-normal">(leave empty to keep current)</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder={credentials ? '••••••••' : 'Enter password'}
                className={`w-full px-4 py-2.5 pr-12 rounded-lg border transition-colors ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded ${
                  isDark ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Last connection info */}
          {credentials?.last_connection_test && (
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Last tested: {new Date(credentials.last_connection_test).toLocaleString()}
              {credentials.last_connection_error && (
                <span className="text-red-500 ml-2">- {credentials.last_connection_error}</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={`px-6 py-4 border-t ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            {/* Test Connection Button */}
            <button
              onClick={handleTestConnection}
              disabled={testing || !formData.cid || !formData.username || (!formData.password && !credentials)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-white disabled:bg-gray-800 disabled:text-gray-600'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-800 disabled:bg-gray-100 disabled:text-gray-400'
              } disabled:cursor-not-allowed`}
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Test Connection
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Delete Button */}
            {credentials && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isDark
                    ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                    : 'bg-red-100 hover:bg-red-200 text-red-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving || !formData.cid || !formData.username}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                isDark
                  ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-700 disabled:text-gray-500'
                  : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500'
              } disabled:cursor-not-allowed`}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Credentials
            </button>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className={`rounded-lg p-4 ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
        <h4 className={`font-medium mb-2 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
          About iCount Integration
        </h4>
        <ul className={`text-sm space-y-1 ${isDark ? 'text-blue-300/80' : 'text-blue-600'}`}>
          <li>• Credentials are stored securely and encrypted</li>
          <li>• Each branch can have different iCount accounts</li>
          <li>• Used for online payments, invoicing, and client sync</li>
          <li>• Test connection to verify your credentials are valid</li>
        </ul>
      </div>
    </div>
  )
}
