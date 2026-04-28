'use client'

import { useState } from 'react'
import { X, Plus, Trash2, Lock, RotateCcw, Calendar, Clock, Loader2, AlertCircle } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'
import { createIsraelDateTime } from '@/lib/dates'
import type { BlockedPeriod } from '@/lib/supabase/types'

interface BlockedPeriodsModalProps {
  blocks: BlockedPeriod[]
  loading: boolean
  branchId: string
  userId: string | null
  isDark: boolean
  onClose: () => void
  onCreateBlock: (data: Omit<BlockedPeriod, 'id' | 'created_at'>) => Promise<BlockedPeriod | null>
  onDeleteBlock: (id: string) => Promise<boolean>
}

function formatBlockSummary(
  block: BlockedPeriod,
  daysShort: string[],
  until: string
): string {
  if (!block.is_recurring) {
    if (!block.start_datetime || !block.end_datetime) return '—'
    const start = new Date(block.start_datetime)
    const end = new Date(block.end_datetime)
    const dateStr = start.toLocaleDateString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })
    const startTime = start.toLocaleTimeString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const endTime = end.toLocaleTimeString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    return `${dateStr} · ${startTime}–${endTime}`
  } else {
    const days = (block.recurrence_days || []).map(d => daysShort[d]).join(', ')
    const time = `${block.recurrence_start_time}–${block.recurrence_end_time}`
    const validity = block.recurrence_valid_until
      ? ` (${until} ${block.recurrence_valid_until})`
      : ''
    return `${days} · ${time}${validity}`
  }
}

export function BlockedPeriodsModal({
  blocks,
  loading,
  branchId,
  userId,
  isDark,
  onClose,
  onCreateBlock,
  onDeleteBlock,
}: BlockedPeriodsModalProps) {
  const { t, tArray } = useTranslation()
  const [activeTab, setActiveTab] = useState<'list' | 'new'>('list')
  const [mode, setMode] = useState<'once' | 'recurring'>('once')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Formulaire ponctuel
  const [onceDate, setOnceDate] = useState('')
  const [onceEndDate, setOnceEndDate] = useState('')
  const [onceStart, setOnceStart] = useState('09:00')
  const [onceEnd, setOnceEnd] = useState('18:00')
  const [onceLabel, setOnceLabel] = useState('')
  const [multiDay, setMultiDay] = useState(false)

  // Formulaire récurrent
  const [recurDays, setRecurDays] = useState<number[]>([])
  const [recurStart, setRecurStart] = useState('09:00')
  const [recurEnd, setRecurEnd] = useState('18:00')
  const [recurLabel, setRecurLabel] = useState('')
  const [recurFrom, setRecurFrom] = useState('')
  const [recurUntil, setRecurUntil] = useState('')

  // Noms des jours localisés
  const daysShort = tArray('admin.blocked_periods.days_short')
  const daysFull = tArray('admin.blocked_periods.days_full')

  const toggleDay = (d: number) =>
    setRecurDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()
    )

  const handleCreate = async () => {
    setError(null)
    setSaving(true)

    try {
      let blockData: Omit<BlockedPeriod, 'id' | 'created_at'>

      if (mode === 'once') {
        if (!onceDate || !onceStart || !onceEnd) {
          setError(t('admin.blocked_periods.error_fill_date_time'))
          setSaving(false)
          return
        }
        const endDateStr = multiDay && onceEndDate ? onceEndDate : onceDate
        const startDt = createIsraelDateTime(onceDate, onceStart)
        const endDt = createIsraelDateTime(endDateStr, onceEnd)

        if (endDt <= startDt) {
          setError(t('admin.blocked_periods.error_end_after_start'))
          setSaving(false)
          return
        }

        blockData = {
          branch_id: branchId,
          label: onceLabel || t('admin.blocked_periods.default_label'),
          is_recurring: false,
          start_datetime: startDt.toISOString(),
          end_datetime: endDt.toISOString(),
          recurrence_days: null,
          recurrence_start_time: null,
          recurrence_end_time: null,
          recurrence_valid_from: null,
          recurrence_valid_until: null,
          created_by: userId,
        }
      } else {
        if (recurDays.length === 0 || !recurStart || !recurEnd) {
          setError(t('admin.blocked_periods.error_fill_days_time'))
          setSaving(false)
          return
        }
        if (recurEnd <= recurStart) {
          setError(t('admin.blocked_periods.error_end_after_start'))
          setSaving(false)
          return
        }

        blockData = {
          branch_id: branchId,
          label: recurLabel || t('admin.blocked_periods.default_label'),
          is_recurring: true,
          start_datetime: null,
          end_datetime: null,
          recurrence_days: recurDays,
          recurrence_start_time: recurStart,
          recurrence_end_time: recurEnd,
          recurrence_valid_from: recurFrom || null,
          recurrence_valid_until: recurUntil || null,
          created_by: userId,
        }
      }

      const result = await onCreateBlock(blockData)
      if (result) {
        // Reset formulaire
        setOnceDate(''); setOnceEndDate(''); setOnceStart('09:00')
        setOnceEnd('18:00'); setOnceLabel(''); setMultiDay(false)
        setRecurDays([]); setRecurStart('09:00'); setRecurEnd('18:00')
        setRecurLabel(''); setRecurFrom(''); setRecurUntil('')
        setActiveTab('list')
      } else {
        setError(t('admin.blocked_periods.error_create'))
      }
    } catch {
      setError(t('admin.blocked_periods.error_unexpected'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await onDeleteBlock(id)
    setDeletingId(null)
  }

  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm ${
    isDark
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
  } focus:outline-none focus:ring-1 focus:ring-blue-500`

  const labelCls = `block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      {/* Panel latéral */}
      <div
        className={`relative h-full w-full max-w-sm flex flex-col shadow-2xl ${
          isDark ? 'bg-gray-900 border-l border-gray-700' : 'bg-white border-l border-gray-200'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Lock className={`w-4 h-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
            <h2 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('admin.blocked_periods.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark
                ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {(['list', 'new'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setError(null) }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? isDark
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-blue-600 border-b-2 border-blue-600'
                  : isDark
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'list'
                ? t('admin.blocked_periods.tab_active').replace('{count}', String(blocks.length))
                : t('admin.blocked_periods.tab_new')}
            </button>
          ))}
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto">

          {/* ── LISTE ── */}
          {activeTab === 'list' && (
            <div className="p-4 space-y-2">
              {loading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              )}
              {!loading && blocks.length === 0 && (
                <div
                  className={`text-center py-10 text-sm ${
                    isDark ? 'text-gray-500' : 'text-gray-400'
                  }`}
                >
                  {t('admin.blocked_periods.no_blocks')}
                </div>
              )}
              {!loading && blocks.map(block => (
                <div
                  key={block.id}
                  className={`rounded-lg p-3 flex items-start gap-3 ${
                    isDark
                      ? 'bg-gray-800 border border-gray-700'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div
                    className={`mt-0.5 flex-shrink-0 ${
                      block.is_recurring ? 'text-purple-400' : 'text-orange-400'
                    }`}
                  >
                    {block.is_recurring
                      ? <RotateCcw className="w-4 h-4" />
                      : <Calendar className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {block.label || t('admin.blocked_periods.default_label')}
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                    >
                      {formatBlockSummary(block, daysShort, t('admin.blocked_periods.until'))}
                    </p>
                    <span
                      className={`inline-block text-[10px] mt-1 px-1.5 py-0.5 rounded font-medium ${
                        block.is_recurring
                          ? isDark
                            ? 'bg-purple-900/50 text-purple-300'
                            : 'bg-purple-100 text-purple-700'
                          : isDark
                            ? 'bg-orange-900/50 text-orange-300'
                            : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {block.is_recurring
                        ? t('admin.blocked_periods.type_recurring')
                        : t('admin.blocked_periods.type_once')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(block.id)}
                    disabled={deletingId === block.id}
                    className={`flex-shrink-0 p-1.5 rounded transition-colors ${
                      isDark
                        ? 'text-gray-500 hover:text-red-400 hover:bg-red-900/30'
                        : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                    }`}
                  >
                    {deletingId === block.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── NOUVEAU BLOCAGE ── */}
          {activeTab === 'new' && (
            <div className="p-4 space-y-5">

              {/* Toggle ponctuel / récurrent */}
              <div className={`flex rounded-lg p-1 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                {(['once', 'recurring'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      mode === m
                        ? isDark
                          ? 'bg-gray-600 text-white'
                          : 'bg-white text-gray-900 shadow-sm'
                        : isDark
                          ? 'text-gray-400'
                          : 'text-gray-500'
                    }`}
                  >
                    {m === 'once'
                      ? t('admin.blocked_periods.mode_once')
                      : t('admin.blocked_periods.mode_recurring')}
                  </button>
                ))}
              </div>

              {/* ─ FORMULAIRE PONCTUEL ─ */}
              {mode === 'once' && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>{t('admin.blocked_periods.label_field')}</label>
                    <input
                      type="text"
                      value={onceLabel}
                      onChange={e => setOnceLabel(e.target.value)}
                      placeholder={t('admin.blocked_periods.label_placeholder_once')}
                      className={inputCls}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="multi-day"
                      checked={multiDay}
                      onChange={e => setMultiDay(e.target.checked)}
                      className="rounded"
                    />
                    <label
                      htmlFor="multi-day"
                      className={`text-xs cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
                    >
                      {t('admin.blocked_periods.multi_day')}
                    </label>
                  </div>

                  <div>
                    <label className={labelCls}>
                      {multiDay
                        ? t('admin.blocked_periods.start_day')
                        : t('admin.blocked_periods.date')}
                    </label>
                    <input
                      type="date"
                      value={onceDate}
                      onChange={e => setOnceDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>

                  {multiDay && (
                    <div>
                      <label className={labelCls}>{t('admin.blocked_periods.end_day')}</label>
                      <input
                        type="date"
                        value={onceEndDate}
                        onChange={e => setOnceEndDate(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>{t('admin.blocked_periods.start_time')}</label>
                      <input
                        type="time"
                        value={onceStart}
                        onChange={e => setOnceStart(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>{t('admin.blocked_periods.end_time')}</label>
                      <input
                        type="time"
                        value={onceEnd}
                        onChange={e => setOnceEnd(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ─ FORMULAIRE RÉCURRENT ─ */}
              {mode === 'recurring' && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>{t('admin.blocked_periods.label_field')}</label>
                    <input
                      type="text"
                      value={recurLabel}
                      onChange={e => setRecurLabel(e.target.value)}
                      placeholder={t('admin.blocked_periods.label_placeholder_recurring')}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>{t('admin.blocked_periods.weekdays')}</label>
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {daysShort.map((name, d) => (
                        <button
                          key={d}
                          onClick={() => toggleDay(d)}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            recurDays.includes(d)
                              ? 'bg-blue-600 text-white'
                              : isDark
                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                    {recurDays.length > 0 && (
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {recurDays.map(d => daysFull[d]).join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>{t('admin.blocked_periods.start_time')}</label>
                      <input
                        type="time"
                        value={recurStart}
                        onChange={e => setRecurStart(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>{t('admin.blocked_periods.end_time')}</label>
                      <input
                        type="time"
                        value={recurEnd}
                        onChange={e => setRecurEnd(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>
                      {t('admin.blocked_periods.valid_from')}{' '}
                      <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                        ({t('admin.blocked_periods.optional')})
                      </span>
                    </label>
                    <input
                      type="date"
                      value={recurFrom}
                      onChange={e => setRecurFrom(e.target.value)}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>
                      {t('admin.blocked_periods.valid_until')}{' '}
                      <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                        ({t('admin.blocked_periods.optional_forever')})
                      </span>
                    </label>
                    <input
                      type="date"
                      value={recurUntil}
                      onChange={e => setRecurUntil(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {/* Erreur */}
              {error && (
                <div className="flex items-center gap-2 text-red-500 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — bouton Créer uniquement sur l'onglet "new" */}
        {activeTab === 'new' && (
          <div className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving
                ? t('admin.blocked_periods.creating')
                : t('admin.blocked_periods.create')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
