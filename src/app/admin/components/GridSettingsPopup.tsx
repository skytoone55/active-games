'use client'

import { useTranslation } from '@/contexts/LanguageContext'

interface GridWidths {
  active: number
  laser: number
  rooms: number
}

interface GridSettingsPopupProps {
  isOpen: boolean
  onClose: () => void
  gridWidths: GridWidths
  setGridWidths: (widths: GridWidths) => void
  rowHeight: number
  setRowHeight: (height: number) => void
  selectedBranchId: string | null
  isDark: boolean
}

export function GridSettingsPopup({
  isOpen,
  onClose,
  gridWidths,
  setGridWidths,
  rowHeight,
  setRowHeight,
  selectedBranchId,
  isDark,
}: GridSettingsPopupProps) {
  const { t } = useTranslation()

  if (!isOpen) return null

  const handleWidthChange = (key: keyof GridWidths, value: number) => {
    const newWidths = { ...gridWidths, [key]: value }
    setGridWidths(newWidths)
    if (selectedBranchId) {
      localStorage.setItem(`gridSettings_${selectedBranchId}`, JSON.stringify({
        gridWidths: newWidths,
        rowHeight
      }))
    }
  }

  const handleRowHeightChange = (value: number) => {
    setRowHeight(value)
    if (selectedBranchId) {
      localStorage.setItem(`gridSettings_${selectedBranchId}`, JSON.stringify({
        gridWidths,
        rowHeight: value
      }))
    }
  }

  const handleReset = () => {
    const defaultWidths = { active: 100, laser: 100, rooms: 100 }
    const defaultRowHeight = 20
    setGridWidths(defaultWidths)
    setRowHeight(defaultRowHeight)
    if (selectedBranchId) {
      localStorage.setItem(`gridSettings_${selectedBranchId}`, JSON.stringify({
        gridWidths: defaultWidths,
        rowHeight: defaultRowHeight
      }))
    }
  }

  return (
    <>
      {/* Zone cliquable transparente pour fermer */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div className="fixed top-20 left-4 z-50 w-80">
        <div className={`rounded-xl shadow-2xl border-2 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('admin.agenda.settings.settings_title')}
              </h3>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                }}
                className={`p-1 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Largeur ACTIVE */}
            <div className="mb-3">
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('admin.agenda.settings.active_width')}: {gridWidths.active}%
              </label>
              <input
                type="range"
                min="5"
                max="500"
                step="5"
                value={gridWidths.active}
                onChange={(e) => handleWidthChange('active', parseInt(e.target.value))}
                className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className={`flex justify-between text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <span>5%</span>
                <span>100% ({t('admin.agenda.settings.normal')})</span>
                <span>500%</span>
              </div>
            </div>

            {/* Largeur LASER */}
            <div className="mb-3">
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('admin.agenda.settings.laser_width')}: {gridWidths.laser}%
              </label>
              <input
                type="range"
                min="5"
                max="800"
                step="5"
                value={gridWidths.laser}
                onChange={(e) => handleWidthChange('laser', parseInt(e.target.value))}
                className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className={`flex justify-between text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <span>5%</span>
                <span>100% ({t('admin.agenda.settings.normal')})</span>
                <span>800%</span>
              </div>
            </div>

            {/* Largeur ROOMS */}
            <div className="mb-3">
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('admin.agenda.settings.rooms_width')}: {gridWidths.rooms}%
              </label>
              <input
                type="range"
                min="5"
                max="500"
                step="5"
                value={gridWidths.rooms}
                onChange={(e) => handleWidthChange('rooms', parseInt(e.target.value))}
                className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className={`flex justify-between text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <span>5%</span>
                <span>100% ({t('admin.agenda.settings.normal')})</span>
                <span>500%</span>
              </div>
            </div>

            {/* Hauteur des lignes */}
            <div className="mb-4">
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('admin.agenda.settings.row_height')}: {rowHeight}px
              </label>
              <input
                type="range"
                min="10"
                max="50"
                value={rowHeight}
                onChange={(e) => handleRowHeightChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Bouton Réinitialiser */}
            <button
              onClick={handleReset}
              className={`w-full px-3 py-2 rounded-lg text-sm ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              {t('admin.agenda.settings.reset')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
