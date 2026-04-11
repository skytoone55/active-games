'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, Globe, Target, Gamepad2, PowerOff } from 'lucide-react'

interface OnlineOrdersSectionProps {
  isDark: boolean
  branchId?: string
}

interface OnlineSettings {
  online_orders_enabled: boolean
  active_game_enabled: boolean
  laser_enabled: boolean
}

export function OnlineOrdersSection({ isDark, branchId }: OnlineOrdersSectionProps) {
  const [settings, setSettings] = useState<OnlineSettings>({
    online_orders_enabled: true,
    active_game_enabled: true,
    laser_enabled: true,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!branchId) return
    setLoading(true)
    fetch(`/api/branch-online-settings?branch_id=${branchId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setSettings(data.settings)
      })
      .catch(() => setError('Erreur lors du chargement'))
      .finally(() => setLoading(false))
  }, [branchId])

  const toggle = (key: keyof OnlineSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  const save = async () => {
    if (!branchId) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/branch-online-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: branchId, ...settings }),
      })
      const data = await res.json()
      if (data.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(data.error || 'Erreur lors de la sauvegarde')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  const cardBase = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'

  const ToggleRow = ({
    icon: Icon,
    label,
    description,
    value,
    onToggle,
    disabled,
    danger,
  }: {
    icon: typeof Globe
    label: string
    description: string
    value: boolean
    onToggle: () => void
    disabled?: boolean
    danger?: boolean
  }) => (
    <div className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
      disabled
        ? isDark ? 'opacity-40 bg-gray-800/50 border-gray-700' : 'opacity-40 bg-gray-50 border-gray-200'
        : cardBase
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          value
            ? isDark ? 'bg-green-500/20' : 'bg-green-100'
            : danger
              ? isDark ? 'bg-red-500/20' : 'bg-red-100'
              : isDark ? 'bg-gray-700' : 'bg-gray-100'
        }`}>
          <Icon className={`w-5 h-5 ${
            value
              ? 'text-green-500'
              : danger ? 'text-red-500' : isDark ? 'text-gray-400' : 'text-gray-500'
          }`} />
        </div>
        <div>
          <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{label}</p>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{description}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${
          value
            ? 'bg-green-500'
            : danger ? 'bg-red-500' : isDark ? 'bg-gray-600' : 'bg-gray-300'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          value ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Réservations en ligne
        </h3>
        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Contrôlez ce qui est accessible aux clients pour cette branche sur la page de réservation en ligne.
        </p>
      </div>

      {!branchId && (
        <div className={`p-4 rounded-lg border ${isDark ? 'bg-yellow-900/20 border-yellow-700/50 text-yellow-300' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
          Sélectionnez une branche pour configurer les réservations en ligne.
        </div>
      )}

      {branchId && (
        <>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Master switch */}
              <ToggleRow
                icon={settings.online_orders_enabled ? Globe : PowerOff}
                label="Commandes en ligne activées"
                description={
                  settings.online_orders_enabled
                    ? 'Les clients peuvent passer des commandes en ligne sur cette branche'
                    : 'Aucune commande en ligne ne sera acceptée pour cette branche'
                }
                value={settings.online_orders_enabled}
                onToggle={() => toggle('online_orders_enabled')}
                danger={!settings.online_orders_enabled}
              />

              {/* Si commandes désactivées, afficher un message */}
              {!settings.online_orders_enabled && (
                <div className={`px-4 py-3 rounded-lg border text-sm flex items-center gap-2 ${
                  isDark ? 'bg-red-900/20 border-red-700/50 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  <PowerOff className="w-4 h-4 flex-shrink-0" />
                  Les clients verront un message indiquant que les réservations sont temporairement indisponibles pour cette branche.
                </div>
              )}

              <div className={`border-t pt-3 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <p className={`text-xs font-medium uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Types de jeux autorisés
                </p>

                <div className="space-y-2">
                  <ToggleRow
                    icon={Gamepad2}
                    label="Active Games autorisé"
                    description="Autoriser les réservations de type Active Games (laser tag, etc.)"
                    value={settings.active_game_enabled}
                    onToggle={() => toggle('active_game_enabled')}
                    disabled={!settings.online_orders_enabled}
                  />

                  <ToggleRow
                    icon={Target}
                    label="Laser City autorisé"
                    description="Autoriser les réservations de type Laser City"
                    value={settings.laser_enabled}
                    onToggle={() => toggle('laser_enabled')}
                    disabled={!settings.online_orders_enabled}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <div className="pt-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    saved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                  } disabled:opacity-50`}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saved ? 'Sauvegardé !' : 'Sauvegarder'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
