'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, AlertCircle, Save, Shield, Users, UserCog, Crown, User, Lock } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'
import type { Role } from '@/lib/supabase/types'

interface RoleModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: Partial<Role>) => Promise<{ success: boolean; error?: string }>
  role?: Role | null
  userLevel: number
  isDark: boolean
  mode: 'create' | 'edit'
}

// Available icons
const AVAILABLE_ICONS = [
  { name: 'Shield', icon: Shield },
  { name: 'UserCog', icon: UserCog },
  { name: 'Users', icon: Users },
  { name: 'Crown', icon: Crown },
  { name: 'User', icon: User },
  { name: 'Lock', icon: Lock },
]

// Preset colors
const PRESET_COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#14B8A6', // teal
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#6B7280', // gray
]

export function RoleModal({
  isOpen,
  onClose,
  onSubmit,
  role,
  userLevel,
  isDark,
  mode,
}: RoleModalProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState(5)
  const [color, setColor] = useState('#3B82F6')
  const [icon, setIcon] = useState('User')

  // Initialize form
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && role) {
        setName(role.name)
        setDisplayName(role.display_name)
        setDescription(role.description || '')
        setLevel(role.level)
        setColor(role.color)
        setIcon(role.icon)
      } else {
        setName('')
        setDisplayName('')
        setDescription('')
        setLevel(userLevel + 1 > 10 ? 10 : userLevel + 1)
        setColor('#3B82F6')
        setIcon('User')
      }
      setError(null)
    }
  }, [isOpen, mode, role, userLevel])

  // Generate slug from display name
  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value)
    if (mode === 'create') {
      const slug = value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
      setName(slug)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!name.trim()) {
      setError('L\'identifiant est requis')
      return
    }

    if (!displayName.trim()) {
      setError('Le nom affiché est requis')
      return
    }

    // Le super_admin (level 1) peut assigner n'importe quel level >= 2
    // Les autres doivent avoir un level > leur propre level
    if (userLevel !== 1 && level <= userLevel) {
      setError(`Le niveau doit être supérieur à ${userLevel}`)
      return
    }

    // Le level 1 est toujours réservé au super_admin
    if (level === 1) {
      setError('Le niveau 1 est réservé au super_admin')
      return
    }

    setLoading(true)

    const data: Partial<Role> = {
      display_name: displayName.trim(),
      description: description.trim() || null,
      level,
      color,
      icon,
    }

    if (mode === 'create') {
      data.name = name.trim()
    }

    const result = await onSubmit(data)

    setLoading(false)

    if (!result.success) {
      setError(result.error || 'Erreur lors de l\'enregistrement')
    }
  }

  if (!isOpen) return null

  // Minimum level user can assign
  // Super_admin (level 1) peut assigner à partir de 2, les autres à partir de leur level + 1
  const minLevel = userLevel === 1 ? 2 : userLevel + 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className={`relative w-full max-w-xl my-8 rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {mode === 'create' ? t('admin.roles.create_title') : t('admin.roles.edit_title')}
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            } disabled:opacity-50`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className={`p-4 rounded-lg border flex items-start gap-2 ${
              isDark
                ? 'bg-red-500/10 border-red-500/50 text-red-400'
                : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Display Name */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('admin.roles.display_name')} *
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              required
              className={`w-full px-3 py-2 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="Ex: Superviseur"
            />
          </div>

          {/* Slug (Name) */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('admin.roles.name')} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={mode === 'edit'}
              className={`w-full px-3 py-2 rounded-lg border font-mono ${
                mode === 'edit' ? 'opacity-50 cursor-not-allowed' : ''
              } ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="ex: superviseur"
            />
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {t('admin.roles.name_help')}
            </p>
          </div>

          {/* Description */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('admin.roles.description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`w-full px-3 py-2 rounded-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="Description optionnelle..."
            />
          </div>

          {/* Level */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('admin.roles.level')} *
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={minLevel}
                max={10}
                value={level}
                onChange={(e) => setLevel(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className={`w-12 text-center text-2xl font-bold ${
                level <= 3 ? 'text-red-500' : level <= 5 ? 'text-yellow-500' : 'text-blue-500'
              }`}>
                {level}
              </span>
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {t('admin.roles.level_help')}
            </p>
          </div>

          {/* Color */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('admin.roles.color')}
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => setColor(presetColor)}
                  className={`w-8 h-8 rounded-lg transition-transform ${
                    color === presetColor ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''
                  } ${isDark ? 'ring-offset-gray-800' : 'ring-offset-white'}`}
                  style={{ backgroundColor: presetColor }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('admin.roles.icon')}
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              {AVAILABLE_ICONS.map(({ name: iconName, icon: IconComponent }) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                    icon === iconName
                      ? 'ring-2 ring-offset-2 ring-blue-500 scale-110'
                      : ''
                  } ${isDark ? 'bg-gray-700 ring-offset-gray-800' : 'bg-gray-100 ring-offset-white'}`}
                >
                  <IconComponent className="w-5 h-5" style={{ color: color }} />
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className={`p-4 rounded-lg border ${isDark ? 'border-gray-700 bg-gray-700/50' : 'border-gray-200 bg-gray-50'}`}>
            <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('admin.roles.preview')}
            </p>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${color}20` }}
              >
                {(() => {
                  const IconComponent = AVAILABLE_ICONS.find(i => i.name === icon)?.icon || User
                  return <IconComponent className="w-5 h-5" style={{ color }} />
                })()}
              </div>
              <div>
                <div className="font-medium" style={{ color }}>
                  {displayName || 'Nom du rôle'}
                </div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Level {level}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-end gap-3 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`px-4 py-2 rounded-lg transition-colors ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              } disabled:opacity-50`}
            >
              {t('admin.common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('admin.common.saving')}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {mode === 'create' ? t('admin.roles.create') : t('admin.common.save')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
