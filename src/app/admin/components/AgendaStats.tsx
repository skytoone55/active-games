'use client'

import { useTranslation } from '@/contexts/LanguageContext'
import type { AgendaStatsData } from '@/hooks/useAgendaStats'

interface AgendaStatsProps {
  stats: AgendaStatsData
  isDark: boolean
  loading?: boolean
}

function StatValue({ value, loading, isDark, large }: { value: number; loading?: boolean; isDark: boolean; large?: boolean }) {
  if (loading) {
    return (
      <span className={`${large ? 'h-8 w-12' : 'h-6 w-8'} inline-block rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'} animate-pulse`} />
    )
  }
  return (
    <span className={`${large ? 'text-2xl font-bold' : 'text-lg font-semibold'} ${large ? (isDark ? 'text-blue-400' : 'text-blue-600') : (isDark ? 'text-white' : 'text-gray-900')}`}>
      {value}
    </span>
  )
}

export function AgendaStats({ stats, isDark, loading }: AgendaStatsProps) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Jour — jamais en loading (calculé depuis les bookings déjà chargés) */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-4 border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-base mb-2`}>
          {stats.day.dateStr}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>{t('admin.agenda.stats.with_room')}:</span>
            <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.day.withRoom}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>{t('admin.agenda.stats.without_room')}:</span>
            <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.day.withoutRoom}</span>
          </div>
          <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm font-semibold`}>{t('admin.agenda.stats.total_people')}:</span>
            <span className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{stats.day.totalParticipants}</span>
          </div>
        </div>
      </div>

      {/* Semaine — loading indépendant */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-4 border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-base mb-2`}>
          {t('admin.agenda.week')} ({stats.week.period})
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>{t('admin.agenda.stats.with_room')}:</span>
            <StatValue value={stats.week.withRoom} loading={loading} isDark={isDark} />
          </div>
          <div className="flex items-center justify-between">
            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>{t('admin.agenda.stats.without_room')}:</span>
            <StatValue value={stats.week.withoutRoom} loading={loading} isDark={isDark} />
          </div>
          <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm font-semibold`}>{t('admin.agenda.stats.total_people')}:</span>
            <StatValue value={stats.week.totalParticipants} loading={loading} isDark={isDark} large />
          </div>
        </div>
      </div>

      {/* Mois — loading indépendant */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-4 border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-base mb-2`}>
          {t('admin.agenda.month')} ({stats.month.period})
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>{t('admin.agenda.stats.with_room')}:</span>
            <StatValue value={stats.month.withRoom} loading={loading} isDark={isDark} />
          </div>
          <div className="flex items-center justify-between">
            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>{t('admin.agenda.stats.without_room')}:</span>
            <StatValue value={stats.month.withoutRoom} loading={loading} isDark={isDark} />
          </div>
          <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm font-semibold`}>{t('admin.agenda.stats.total_people')}:</span>
            <StatValue value={stats.month.totalParticipants} loading={loading} isDark={isDark} large />
          </div>
        </div>
      </div>
    </div>
  )
}
