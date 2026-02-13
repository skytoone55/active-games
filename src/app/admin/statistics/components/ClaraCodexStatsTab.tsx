'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { AlertCircle, Loader2, Bot, ShieldAlert, HandHelping, Wrench, Activity } from 'lucide-react'
import { swrFetcher } from '@/lib/swr-fetcher'

interface ClaraCodexStatsTabProps {
  isDark: boolean
  selectedBranchId: string
  dateRange: string
  customStartDate: string
  customEndDate: string
}

interface CodexStatsResponse {
  success: boolean
  data: {
    kpis: {
      conversations: number
      turns: number
      replies: number
      escalations: number
      eventIntents: number
      toolsCalled: number
      toolErrors: number
      techFallbacks: number
      escalationNoAgent: number
    }
    rates: {
      replyRate: number
      escalationRate: number
      toolErrorRate: number
    }
    byDay: Array<{
      date: string
      turns: number
      replies: number
      escalations: number
      toolErrors: number
    }>
    branchBreakdown: Array<{
      branchId: string
      conversations: number
      escalations: number
      replies: number
      errors: number
    }>
    totalEvents: number
  }
}

function classNames(...items: Array<string | false | undefined>) {
  return items.filter(Boolean).join(' ')
}

function KPICard(props: {
  isDark: boolean
  title: string
  value: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  tone: 'blue' | 'orange' | 'red' | 'green' | 'purple'
}) {
  const toneMap = {
    blue: 'text-blue-500 bg-blue-500/10',
    orange: 'text-orange-500 bg-orange-500/10',
    red: 'text-red-500 bg-red-500/10',
    green: 'text-green-500 bg-green-500/10',
    purple: 'text-purple-500 bg-purple-500/10',
  } as const
  const Icon = props.icon
  return (
    <div className={classNames(
      'rounded-xl border p-4',
      props.isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    )}>
      <div className="flex items-center justify-between">
        <p className={classNames('text-sm', props.isDark ? 'text-gray-400' : 'text-gray-500')}>{props.title}</p>
        <div className={classNames('p-2 rounded-lg', toneMap[props.tone])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className={classNames('text-2xl font-semibold mt-1', props.isDark ? 'text-white' : 'text-gray-900')}>
        {props.value}
      </p>
      {props.subtitle && (
        <p className={classNames('text-xs mt-1', props.isDark ? 'text-gray-400' : 'text-gray-600')}>
          {props.subtitle}
        </p>
      )}
    </div>
  )
}

export function ClaraCodexStatsTab({
  isDark,
  selectedBranchId,
  dateRange,
  customStartDate,
  customEndDate,
}: ClaraCodexStatsTabProps) {
  const swrKey = useMemo(() => {
    let url = `/api/admin/statistics/clara-codex?range=${dateRange}&branch=${selectedBranchId}`
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      url += `&startDate=${customStartDate}&endDate=${customEndDate}`
    }
    return url
  }, [dateRange, selectedBranchId, customStartDate, customEndDate])

  const { data, error, isLoading } = useSWR<CodexStatsResponse>(swrKey, swrFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
    keepPreviousData: true,
  })

  if (isLoading && !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className={classNames('w-8 h-8 animate-spin', isDark ? 'text-blue-400' : 'text-blue-600')} />
      </div>
    )
  }

  if (error || !data?.success) {
    return (
      <div className={classNames('rounded-xl border p-6 flex items-center gap-3', isDark ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700')}>
        <AlertCircle className="w-5 h-5" />
        <p>Unable to load Clara Codex statistics.</p>
      </div>
    )
  }

  const stats = data.data

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-4">
        <KPICard
          isDark={isDark}
          title="Conversations"
          value={String(stats.kpis.conversations)}
          subtitle={`${stats.kpis.turns} turns`}
          icon={Bot}
          tone="blue"
        />
        <KPICard
          isDark={isDark}
          title="Escalations"
          value={String(stats.kpis.escalations)}
          subtitle={`${stats.rates.escalationRate}% conv rate`}
          icon={HandHelping}
          tone="orange"
        />
        <KPICard
          isDark={isDark}
          title="Tool Errors"
          value={String(stats.kpis.toolErrors)}
          subtitle={`${stats.rates.toolErrorRate}% of tool results`}
          icon={Wrench}
          tone="red"
        />
        <KPICard
          isDark={isDark}
          title="Tech Fallbacks"
          value={String(stats.kpis.techFallbacks)}
          subtitle={`No-agent escalations: ${stats.kpis.escalationNoAgent}`}
          icon={ShieldAlert}
          tone="purple"
        />
        <KPICard
          isDark={isDark}
          title="Reply Rate"
          value={`${stats.rates.replyRate}%`}
          subtitle={`${stats.kpis.replies}/${stats.kpis.turns}`}
          icon={Activity}
          tone="green"
        />
      </div>

      <div className={classNames(
        'rounded-xl border p-5',
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <h3 className={classNames('text-lg font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
          Daily Trend
        </h3>
        {stats.byDay.length === 0 ? (
          <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>No data in selected range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Turns</th>
                  <th className="text-left py-2">Replies</th>
                  <th className="text-left py-2">Escalations</th>
                  <th className="text-left py-2">Tool errors</th>
                </tr>
              </thead>
              <tbody>
                {stats.byDay.map(day => (
                  <tr key={day.date} className={classNames('border-t', isDark ? 'border-gray-700 text-gray-200' : 'border-gray-200 text-gray-800')}>
                    <td className="py-2">{day.date}</td>
                    <td className="py-2">{day.turns}</td>
                    <td className="py-2">{day.replies}</td>
                    <td className="py-2">{day.escalations}</td>
                    <td className="py-2">{day.toolErrors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={classNames(
        'rounded-xl border p-5',
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <h3 className={classNames('text-lg font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
          Branch Breakdown
        </h3>
        {stats.branchBreakdown.length === 0 ? (
          <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>No branch data in selected range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                  <th className="text-left py-2">Branch</th>
                  <th className="text-left py-2">Conversations</th>
                  <th className="text-left py-2">Replies</th>
                  <th className="text-left py-2">Escalations</th>
                  <th className="text-left py-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                {stats.branchBreakdown.map(item => (
                  <tr key={item.branchId} className={classNames('border-t', isDark ? 'border-gray-700 text-gray-200' : 'border-gray-200 text-gray-800')}>
                    <td className="py-2">{item.branchId}</td>
                    <td className="py-2">{item.conversations}</td>
                    <td className="py-2">{item.replies}</td>
                    <td className="py-2">{item.escalations}</td>
                    <td className="py-2">{item.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
