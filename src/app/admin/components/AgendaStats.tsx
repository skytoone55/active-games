'use client'

import { useTranslation } from '@/contexts/LanguageContext'

interface StatsData {
  day: {
    withRoom: number
    withoutRoom: number
    totalParticipants: number
    dateStr: string
  }
  week: {
    withRoom: number
    withoutRoom: number
    totalParticipants: number
    period: string
  }
  month: {
    withRoom: number
    withoutRoom: number
    totalParticipants: number
    period: string
  }
}

interface AgendaStatsProps {
  stats: StatsData
  isDark: boolean
}

export function AgendaStats({ stats, isDark }: AgendaStatsProps) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Jour */}
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

      {/* Semaine */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-4 border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-base mb-2`}>
          {t('admin.agenda.week')} ({stats.week.period})
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>{t('admin.agenda.stats.with_room')}:</span>
            <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.week.withRoom}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>{t('admin.agenda.stats.without_room')}:</span>
            <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.week.withoutRoom}</span>
          </div>
          <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm font-semibold`}>{t('admin.agenda.stats.total_people')}:</span>
            <span className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{stats.week.totalParticipants}</span>
          </div>
        </div>
      </div>

      {/* Mois */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-4 border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-base mb-2`}>
          {t('admin.agenda.month')} ({stats.month.period})
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>{t('admin.agenda.stats.with_room')}:</span>
            <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.month.withRoom}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>{t('admin.agenda.stats.without_room')}:</span>
            <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.month.withoutRoom}</span>
          </div>
          <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm font-semibold`}>{t('admin.agenda.stats.total_people')}:</span>
            <span className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{stats.month.totalParticipants}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
