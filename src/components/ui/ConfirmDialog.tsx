'use client'

import { X, AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  isDark: boolean
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  isDark,
  variant = 'danger',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const variantColors = {
    danger: {
      icon: 'text-red-500',
      iconBg: 'bg-red-500/10',
      button: 'bg-red-600 hover:bg-red-700'
    },
    warning: {
      icon: 'text-orange-500',
      iconBg: 'bg-orange-500/10',
      button: 'bg-orange-600 hover:bg-orange-700'
    },
    info: {
      icon: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
      button: 'bg-blue-600 hover:bg-blue-700'
    }
  }

  const colors = variantColors[variant]

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="max-w-md w-full rounded-xl shadow-2xl"
        style={{ backgroundColor: isDark ? '#1F2937' : 'white' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-start space-x-3">
            <div className={`p-2 rounded-lg ${colors.iconBg}`}>
              <AlertTriangle className={`w-6 h-6 ${colors.icon}`} />
            </div>
            <div>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {title}
              </h3>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-gray-500/10"
          >
            <X className="w-5 h-5" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }} />
          </button>
        </div>

        {/* Message */}
        <div className="px-6 pb-6">
          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 p-6 pt-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg"
            style={{
              backgroundColor: isDark ? '#374151' : '#E5E7EB',
              color: isDark ? '#9CA3AF' : '#6B7280'
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-lg ${colors.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
