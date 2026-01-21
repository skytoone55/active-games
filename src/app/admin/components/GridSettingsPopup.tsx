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
  visibleHoursStart: number
  setVisibleHoursStart: (hour: number) => void
  visibleHoursEnd: number
  setVisibleHoursEnd: (hour: number) => void
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
  visibleHoursStart,
  setVisibleHoursStart,
  visibleHoursEnd,
  setVisibleHoursEnd,
  selectedBranchId,
  isDark,
}: GridSettingsPopupProps) {
  const { t } = useTranslation()

  if (!isOpen) return null

  const saveSettings = (updates: Partial<{
    gridWidths: GridWidths
    rowHeight: number
    visibleHoursStart: number
    visibleHoursEnd: number
  }>) => {
    if (selectedBranchId) {
      localStorage.setItem(`gridSettings_${selectedBranchId}`, JSON.stringify({
        gridWidths: updates.gridWidths ?? gridWidths,
        rowHeight: updates.rowHeight ?? rowHeight,
        visibleHoursStart: updates.visibleHoursStart ?? visibleHoursStart,
        visibleHoursEnd: updates.visibleHoursEnd ?? visibleHoursEnd
      }))
    }
  }

  const handleWidthChange = (key: keyof GridWidths, value: number) => {
    const newWidths = { ...gridWidths, [key]: value }
    setGridWidths(newWidths)
    saveSettings({ gridWidths: newWidths })
  }

  const handleRowHeightChange = (value: number) => {
    setRowHeight(value)
    saveSettings({ rowHeight: value })
  }

  const handleVisibleHoursStartChange = (value: number) => {
    // S'assurer que start < end
    const newStart = Math.min(value, visibleHoursEnd - 1)
    setVisibleHoursStart(newStart)
    saveSettings({ visibleHoursStart: newStart })
  }

  const handleVisibleHoursEndChange = (value: number) => {
    // S'assurer que end > start
    const newEnd = Math.max(value, visibleHoursStart + 1)
    setVisibleHoursEnd(newEnd)
    saveSettings({ visibleHoursEnd: newEnd })
  }

  const handleReset = () => {
    const defaultWidths = { active: 100, laser: 100, rooms: 100 }
    const defaultRowHeight = 20
    const defaultVisibleHoursStart = 10
    const defaultVisibleHoursEnd = 23
    setGridWidths(defaultWidths)
    setRowHeight(defaultRowHeight)
    setVisibleHoursStart(defaultVisibleHoursStart)
    setVisibleHoursEnd(defaultVisibleHoursEnd)
    saveSettings({
      gridWidths: defaultWidths,
      rowHeight: defaultRowHeight,
      visibleHoursStart: defaultVisibleHoursStart,
      visibleHoursEnd: defaultVisibleHoursEnd
    })
  }

  // Générer les options d'heures (0-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i)

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

            {/* Séparateur */}
            <div className={`border-t my-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`} />

            {/* Heures visibles */}
            <div className="mb-4">
              <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('admin.agenda.settings.visible_hours') || 'Heures visibles'}
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={visibleHoursStart}
                  onChange={(e) => handleVisibleHoursStartChange(parseInt(e.target.value))}
                  className={`flex-1 px-2 py-1 text-sm rounded border ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  {hourOptions.map((h) => (
                    <option key={h} value={h} disabled={h >= visibleHoursEnd}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>→</span>
                <select
                  value={visibleHoursEnd}
                  onChange={(e) => handleVisibleHoursEndChange(parseInt(e.target.value))}
                  className={`flex-1 px-2 py-1 text-sm rounded border ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  {hourOptions.map((h) => (
                    <option key={h} value={h} disabled={h <= visibleHoursStart}>
                      {String(h).padStart(2, '0')}:45
                    </option>
                  ))}
                </select>
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {t('admin.agenda.settings.visible_hours_hint') || 'Extension automatique si réservation hors plage'}
              </p>
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
