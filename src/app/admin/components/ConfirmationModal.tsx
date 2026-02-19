'use client'

import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  type?: 'warning' | 'info' | 'success'
  confirmText?: string
  cancelText?: string
  isDark: boolean
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'warning',
  confirmText,
  cancelText,
  isDark,
}: ConfirmationModalProps) {
  const { t } = useTranslation()
  if (!isOpen) return null

  const handleConfirm = async () => {
    await onConfirm()
    onClose()
  }

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-yellow-400" />
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-400" />
      case 'info':
        return <Info className="w-6 h-6 text-blue-400" />
      default:
        return <AlertTriangle className="w-6 h-6 text-yellow-400" />
    }
  }

  const getConfirmButtonColor = () => {
    switch (type) {
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700'
      case 'success':
        return 'bg-green-600 hover:bg-green-700'
      case 'info':
        return 'bg-blue-600 hover:bg-blue-700'
      default:
        return 'bg-yellow-600 hover:bg-yellow-700'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`w-full max-w-md rounded-lg shadow-xl max-h-[90vh] overflow-y-auto ${
        isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        {/* Header */}
        <div className={`flex items-center gap-3 p-6 border-b ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          <h3 className={`text-lg font-semibold flex-1 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className={`text-sm whitespace-pre-line ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className={`flex items-center justify-end gap-3 p-6 border-t ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          {type === 'info' ? (
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg transition-colors text-white ${getConfirmButtonColor()}`}
            >
              {t('admin.common.ok')}
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                {cancelText || t('admin.common.cancel')}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-lg transition-colors text-white ${getConfirmButtonColor()}`}
              >
                {confirmText || t('admin.common.confirm')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
