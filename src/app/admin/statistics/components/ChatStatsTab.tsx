'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import {
  Clock,
  MessageCircle,
  MessagesSquare,
  Zap,
  AlertCircle,
  Loader2,
  Users,
  Bot,
  TrendingUp,
  Link2,
  HandHelping,
} from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { swrFetcher } from '@/lib/swr-fetcher'
import type { Branch } from '@/lib/supabase/types'

interface ChatStatsTabProps {
  isDark: boolean
  branches: Branch[]
  selectedBranchId: string
  dateRange: string
  customStartDate: string
  customEndDate: string
}

interface ClaraFunnelData {
  funnel: {
    conversations: number
    simulateCalled: number
    simulateSuccess: number
    simulateError: number
    linkGenerated: number
    linkSuccess: number
    escalated: number
  }
  rates: {
    simulateRate: number
    simulateSuccessRate: number
    linkRate: number
    escalateRate: number
  }
  branchBreakdown: {
    branchId: string
    conversations: number
    simulateCalled: number
    simulateSuccess: number
    linkGenerated: number
    linkSuccess: number
    escalated: number
  }[]
  dailyTrend: {
    date: string
    conversations: number
    simulations: number
    links: number
    escalations: number
  }[]
  escaladeReasons: Record<string, number>
  totalEvents: number
}

interface ChatStatsData {
  avgResponseTime: number
  medianResponseTime: number
  totalConversations: number
  totalMessages: number
  under5minPercent: number
  unreadConversations: number
  whatsapp: {
    inboundCount: number
    outboundCount: number
    activeConversations: number
    totalConversations: number
  }
  messenger: {
    totalConversations: number
    byStatus: { active: number; completed: number; abandoned: number }
    totalMessages: number
    userMessages: number
    assistantMessages: number
  }
  responseTimeDistribution: {
    under5min: number
    under15min: number
    under1h: number
    under4h: number
    over4h: number
  }
  totalResponses: number
  activityByHour: { hour: string; inbound: number; outbound: number }[]
  activityByDay: { day: string; count: number }[]
  agentPerformance: {
    agentId: string
    name: string
    messagesSent: number
    avgResponseTime: number
    minResponseTime: number
    maxResponseTime: number
  }[]
}

// Colors for charts
const CHART_COLORS = {
  light: ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ec4899', '#eab308', '#06b6d4'],
  dark: ['#60a5fa', '#fb923c', '#4ade80', '#c084fc', '#f472b6', '#facc15', '#22d3ee']
}

const DISTRIBUTION_COLORS = {
  light: ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'],
  dark: ['#4ade80', '#a3e635', '#facc15', '#fb923c', '#f87171']
}

// Format seconds to readable string
function formatTime(seconds: number): string {
  if (seconds === 0) return '-'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }
  const hours = Math.floor(seconds / 3600)
  const mins = Math.round((seconds % 3600) / 60)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

export function ChatStatsTab({
  isDark,
  branches,
  selectedBranchId,
  dateRange,
  customStartDate,
  customEndDate
}: ChatStatsTabProps) {
  const { t } = useTranslation()

  // Build SWR key from filters — SWR only fetches when component is mounted
  const swrKey = useMemo(() => {
    let url = `/api/admin/statistics/chat?range=${dateRange}&branch=${selectedBranchId}`
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      url += `&startDate=${customStartDate}&endDate=${customEndDate}`
    }
    return url
  }, [dateRange, selectedBranchId, customStartDate, customEndDate])

  const { data, error, isLoading } = useSWR<{ success: boolean; data: ChatStatsData }>(
    swrKey,
    swrFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true
    }
  )

  const stats = data?.data

  // Clara WhatsApp funnel stats (separate SWR)
  const claraSwrKey = useMemo(() => {
    let url = `/api/admin/statistics/clara-whatsapp?range=${dateRange}&branch=${selectedBranchId}`
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      url += `&startDate=${customStartDate}&endDate=${customEndDate}`
    }
    return url
  }, [dateRange, selectedBranchId, customStartDate, customEndDate])

  const { data: claraData } = useSWR<{ success: boolean; data: ClaraFunnelData }>(
    claraSwrKey,
    swrFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000, keepPreviousData: true }
  )
  const claraStats = claraData?.data

  const colors = isDark ? CHART_COLORS.dark : CHART_COLORS.light
  const distColors = isDark ? DISTRIBUTION_COLORS.dark : DISTRIBUTION_COLORS.light

  // Prepare response time distribution chart data
  const distributionData = useMemo(() => {
    if (!stats) return []
    return [
      { label: '< 5min', value: stats.responseTimeDistribution.under5min, color: distColors[0] },
      { label: '5-15min', value: stats.responseTimeDistribution.under15min, color: distColors[1] },
      { label: '15min-1h', value: stats.responseTimeDistribution.under1h, color: distColors[2] },
      { label: '1h-4h', value: stats.responseTimeDistribution.under4h, color: distColors[3] },
      { label: '> 4h', value: stats.responseTimeDistribution.over4h, color: distColors[4] },
    ]
  }, [stats, distColors])

  // Agent performance sorted by avg response time
  const agentData = useMemo(() => {
    if (!stats?.agentPerformance) return []
    return stats.agentPerformance.map(agent => ({
      ...agent,
      avgResponseTimeFormatted: formatTime(agent.avgResponseTime)
    }))
  }, [stats])

  // Tooltip style
  const tooltipStyle = {
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
    borderRadius: '8px',
    color: isDark ? '#ffffff' : '#000000'
  }

  // Loading state
  if (isLoading && !stats) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`flex flex-col items-center gap-3 py-20 ${isDark ? 'text-red-400' : 'text-red-500'}`}>
        <AlertCircle className="w-8 h-8" />
        <p>{t('admin.chat_stats.error_loading')}</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className={`text-center py-20 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        {t('admin.chat_stats.no_data')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={t('admin.chat_stats.avg_response_time')}
          value={formatTime(stats.avgResponseTime)}
          subtitle={t('admin.chat_stats.median_label', { time: formatTime(stats.medianResponseTime) })}
          icon={Clock}
          isDark={isDark}
          color="blue"
        />
        <KPICard
          title={t('admin.chat_stats.conversations')}
          value={stats.totalConversations.toString()}
          subtitle={`WA: ${stats.whatsapp.activeConversations} · Messenger: ${stats.messenger.totalConversations}`}
          icon={MessagesSquare}
          isDark={isDark}
          color="green"
        />
        <KPICard
          title={t('admin.chat_stats.total_messages')}
          value={stats.totalMessages.toString()}
          subtitle={`↓ ${stats.whatsapp.inboundCount} · ↑ ${stats.whatsapp.outboundCount} (WA)`}
          icon={MessageCircle}
          isDark={isDark}
          color="purple"
        />
        <KPICard
          title={t('admin.chat_stats.responses_under_5min')}
          value={`${stats.under5minPercent}%`}
          subtitle={t('admin.chat_stats.responses_count', { count: stats.responseTimeDistribution.under5min, total: stats.totalResponses })}
          icon={Zap}
          isDark={isDark}
          color="orange"
        />
      </div>

      {/* WhatsApp + Messenger Summary */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* WhatsApp Summary */}
        <div className={`rounded-xl p-5 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-3 h-3 rounded-full bg-green-500`} />
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>WhatsApp</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <StatItem label={t('admin.chat_stats.inbound_messages')} value={stats.whatsapp.inboundCount} isDark={isDark} />
            <StatItem label={t('admin.chat_stats.outbound_messages')} value={stats.whatsapp.outboundCount} isDark={isDark} />
            <StatItem label={t('admin.chat_stats.active_conversations')} value={stats.whatsapp.activeConversations} isDark={isDark} />
            <StatItem label={t('admin.chat_stats.unread')} value={stats.unreadConversations} isDark={isDark} highlight={stats.unreadConversations > 0} />
          </div>
        </div>

        {/* Messenger Summary */}
        <div className={`rounded-xl p-5 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-3 h-3 rounded-full bg-blue-500`} />
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Messenger</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <StatItem label={t('admin.chat_stats.messenger_conversations')} value={stats.messenger.totalConversations} isDark={isDark} />
            <StatItem label={t('admin.chat_stats.messenger_messages')} value={stats.messenger.totalMessages} isDark={isDark} />
            <StatItem label={t('admin.chat_stats.messenger_active')} value={stats.messenger.byStatus.active} isDark={isDark} />
            <StatItem label={t('admin.chat_stats.messenger_completed')} value={stats.messenger.byStatus.completed} isDark={isDark} />
          </div>
        </div>
      </div>

      {/* Charts Row: Distribution + Activity by Hour */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Response Time Distribution */}
        <ChartCard title={t('admin.chat_stats.response_time_distribution')} isDark={isDark}>
          {stats.totalResponses > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={distributionData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="label" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart isDark={isDark} message={t('admin.chat_stats.no_data_chart')} />
          )}
        </ChartCard>

        {/* Activity by Hour */}
        <ChartCard title={t('admin.chat_stats.activity_by_hour')} isDark={isDark}>
          {stats.activityByHour.some(h => h.inbound > 0 || h.outbound > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.activityByHour}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="hour" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={11} />
                <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="inbound" name={t('admin.chat_stats.inbound')} fill={colors[0]} radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="outbound" name={t('admin.chat_stats.outbound')} fill={colors[2]} radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart isDark={isDark} message={t('admin.chat_stats.no_data_chart')} />
          )}
        </ChartCard>
      </div>

      {/* Activity by Day */}
      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title={t('admin.chat_stats.activity_by_day')} isDark={isDark}>
          {stats.activityByDay.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.activityByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="day" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name={t('admin.chat_stats.messages')} fill={colors[3]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart isDark={isDark} message={t('admin.chat_stats.no_data_chart')} />
          )}
        </ChartCard>

        {/* Agent Performance Chart */}
        <ChartCard title={t('admin.chat_stats.agent_performance')} isDark={isDark}>
          {agentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(220, agentData.length * 50)}>
              <BarChart data={agentData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                <XAxis
                  type="number"
                  stroke={isDark ? '#9ca3af' : '#6b7280'}
                  fontSize={12}
                  tickFormatter={(v) => formatTime(v)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke={isDark ? '#9ca3af' : '#6b7280'}
                  width={120}
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [formatTime(value as number), t('admin.chat_stats.avg_time_label')]}
                />
                <Bar dataKey="avgResponseTime" fill={colors[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart isDark={isDark} message={t('admin.chat_stats.no_agent_data')} />
          )}
        </ChartCard>
      </div>

      {/* Agent Ranking Table */}
      {agentData.length > 0 && (
        <div className={`rounded-xl p-5 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t('admin.chat_stats.agent_ranking')}
            </div>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <th className={`text-left py-3 px-4 font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>#</th>
                  <th className={`text-left py-3 px-4 font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.chat_stats.col_agent')}</th>
                  <th className={`text-center py-3 px-4 font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.chat_stats.col_messages')}</th>
                  <th className={`text-center py-3 px-4 font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.chat_stats.col_avg_time')}</th>
                  <th className={`text-center py-3 px-4 font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.chat_stats.col_fastest')}</th>
                  <th className={`text-center py-3 px-4 font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.chat_stats.col_slowest')}</th>
                </tr>
              </thead>
              <tbody>
                {agentData.map((agent, i) => (
                  <tr
                    key={agent.agentId}
                    className={`border-b ${isDark ? 'border-gray-700/50 hover:bg-gray-700/50' : 'border-gray-100 hover:bg-gray-50'}`}
                  >
                    <td className={`py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td className={`py-3 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {agent.name}
                    </td>
                    <td className={`py-3 px-4 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {agent.messagesSent}
                    </td>
                    <td className={`py-3 px-4 text-center font-semibold ${
                      agent.avgResponseTime < 300
                        ? isDark ? 'text-green-400' : 'text-green-600'
                        : agent.avgResponseTime < 900
                          ? isDark ? 'text-yellow-400' : 'text-yellow-600'
                          : isDark ? 'text-red-400' : 'text-red-600'
                    }`}>
                      {formatTime(agent.avgResponseTime)}
                    </td>
                    <td className={`py-3 px-4 text-center ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                      {formatTime(agent.minResponseTime)}
                    </td>
                    <td className={`py-3 px-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {formatTime(agent.maxResponseTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clara WhatsApp Funnel */}
      {claraStats && claraStats.totalEvents > 0 && (
        <div className="space-y-4">
          <h2 className={`text-xl font-bold flex items-center gap-2 mt-8 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Bot className="w-6 h-6 text-cyan-500" />
            {t('admin.chat_stats.clara_funnel_title')}
          </h2>

          {/* Clara Funnel KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title={t('admin.chat_stats.clara_conversations')}
              value={claraStats.funnel.conversations.toString()}
              subtitle={t('admin.chat_stats.clara_total_events', { count: claraStats.totalEvents })}
              icon={MessageCircle}
              isDark={isDark}
              color="blue"
            />
            <KPICard
              title={t('admin.chat_stats.clara_simulations')}
              value={claraStats.funnel.simulateCalled.toString()}
              subtitle={`${claraStats.rates.simulateRate}% ${t('admin.chat_stats.clara_of_conversations')}`}
              icon={TrendingUp}
              isDark={isDark}
              color="green"
            />
            <KPICard
              title={t('admin.chat_stats.clara_links')}
              value={claraStats.funnel.linkGenerated.toString()}
              subtitle={`${claraStats.rates.linkRate}% ${t('admin.chat_stats.clara_of_simulations')}`}
              icon={Link2}
              isDark={isDark}
              color="purple"
            />
            <KPICard
              title={t('admin.chat_stats.clara_escalations')}
              value={claraStats.funnel.escalated.toString()}
              subtitle={`${claraStats.rates.escalateRate}% ${t('admin.chat_stats.clara_of_conversations')}`}
              icon={HandHelping}
              isDark={isDark}
              color="orange"
            />
          </div>

          {/* Clara Funnel Visualization */}
          <div className={`rounded-xl p-5 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('admin.chat_stats.clara_funnel_visual')}
            </h3>
            <div className="space-y-3">
              <FunnelStep
                label={t('admin.chat_stats.clara_step_conversations')}
                value={claraStats.funnel.conversations}
                maxValue={claraStats.funnel.conversations}
                color="bg-cyan-500"
                isDark={isDark}
              />
              <FunnelStep
                label={t('admin.chat_stats.clara_step_simulate')}
                value={claraStats.funnel.simulateCalled}
                maxValue={claraStats.funnel.conversations}
                color="bg-blue-500"
                isDark={isDark}
                rate={claraStats.rates.simulateRate}
              />
              <FunnelStep
                label={t('admin.chat_stats.clara_step_simulate_ok')}
                value={claraStats.funnel.simulateSuccess}
                maxValue={claraStats.funnel.conversations}
                color="bg-green-500"
                isDark={isDark}
                rate={claraStats.funnel.simulateCalled > 0
                  ? Math.round((claraStats.funnel.simulateSuccess / claraStats.funnel.simulateCalled) * 100) : 0}
              />
              <FunnelStep
                label={t('admin.chat_stats.clara_step_link')}
                value={claraStats.funnel.linkGenerated}
                maxValue={claraStats.funnel.conversations}
                color="bg-purple-500"
                isDark={isDark}
                rate={claraStats.rates.linkRate}
              />
              <FunnelStep
                label={t('admin.chat_stats.clara_step_escalated')}
                value={claraStats.funnel.escalated}
                maxValue={claraStats.funnel.conversations}
                color="bg-orange-500"
                isDark={isDark}
                rate={claraStats.rates.escalateRate}
              />
            </div>
          </div>

          {/* Clara Daily Trend */}
          {claraStats.dailyTrend.length > 1 && (
            <ChartCard title={t('admin.chat_stats.clara_daily_trend')} isDark={isDark}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={claraStats.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="date" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={11}
                    tickFormatter={(v) => v.slice(5)} />
                  <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="conversations" name={t('admin.chat_stats.clara_conversations')} fill={colors[6]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="simulations" name={t('admin.chat_stats.clara_simulations')} fill={colors[0]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="links" name={t('admin.chat_stats.clara_links')} fill={colors[3]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Clara Branch Breakdown */}
          {claraStats.branchBreakdown.length > 0 && (
            <div className={`rounded-xl p-5 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('admin.chat_stats.clara_by_branch')}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <th className={`text-left py-3 px-4 font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {t('admin.chat_stats.clara_col_branch')}
                      </th>
                      <th className={`text-center py-3 px-4 font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {t('admin.chat_stats.clara_conversations')}
                      </th>
                      <th className={`text-center py-3 px-4 font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {t('admin.chat_stats.clara_simulations')}
                      </th>
                      <th className={`text-center py-3 px-4 font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {t('admin.chat_stats.clara_links')}
                      </th>
                      <th className={`text-center py-3 px-4 font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {t('admin.chat_stats.clara_escalations')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {claraStats.branchBreakdown.map((row) => {
                      const branch = branches.find(b => b.id === row.branchId)
                      return (
                        <tr
                          key={row.branchId}
                          className={`border-b ${isDark ? 'border-gray-700/50 hover:bg-gray-700/50' : 'border-gray-100 hover:bg-gray-50'}`}
                        >
                          <td className={`py-3 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {branch?.name || row.branchId.slice(0, 8)}
                          </td>
                          <td className={`py-3 px-4 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {row.conversations}
                          </td>
                          <td className={`py-3 px-4 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {row.simulateCalled}
                          </td>
                          <td className={`py-3 px-4 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {row.linkGenerated}
                          </td>
                          <td className={`py-3 px-4 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {row.escalated}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- Sub-components ---

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  isDark,
  color = 'blue'
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  isDark: boolean
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red'
}) {
  const colorClasses = {
    blue: { light: 'bg-blue-100 text-blue-600', dark: 'bg-blue-500/20 text-blue-400', value: isDark ? 'text-blue-400' : 'text-blue-600' },
    green: { light: 'bg-green-100 text-green-600', dark: 'bg-green-500/20 text-green-400', value: isDark ? 'text-green-400' : 'text-green-600' },
    purple: { light: 'bg-purple-100 text-purple-600', dark: 'bg-purple-500/20 text-purple-400', value: isDark ? 'text-purple-400' : 'text-purple-600' },
    orange: { light: 'bg-orange-100 text-orange-600', dark: 'bg-orange-500/20 text-orange-400', value: isDark ? 'text-orange-400' : 'text-orange-600' },
    red: { light: 'bg-red-100 text-red-600', dark: 'bg-red-500/20 text-red-400', value: isDark ? 'text-red-400' : 'text-red-600' },
  }
  const c = colorClasses[color]

  return (
    <div className={`rounded-xl p-5 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{title}</span>
        <div className={`p-2 rounded-lg ${isDark ? c.dark : c.light}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className={`text-2xl font-bold ${c.value}`}>{value}</p>
      {subtitle && (
        <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{subtitle}</p>
      )}
    </div>
  )
}

function ChartCard({ title, isDark, children }: { title: string; isDark: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl p-5 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
      {children}
    </div>
  )
}

function StatItem({ label, value, isDark, highlight }: { label: string; value: number; isDark: boolean; highlight?: boolean }) {
  return (
    <div>
      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-xl font-bold ${
        highlight
          ? isDark ? 'text-orange-400' : 'text-orange-600'
          : isDark ? 'text-white' : 'text-gray-900'
      }`}>
        {value}
      </p>
    </div>
  )
}

function EmptyChart({ isDark, message = '-' }: { isDark: boolean; message?: string }) {
  return (
    <div className={`flex items-center justify-center h-[220px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
      <p className="text-sm">{message}</p>
    </div>
  )
}

function FunnelStep({
  label,
  value,
  maxValue,
  color,
  isDark,
  rate,
}: {
  label: string
  value: number
  maxValue: number
  color: string
  isDark: boolean
  rate?: number
}) {
  const width = maxValue > 0 ? Math.max((value / maxValue) * 100, 2) : 0

  return (
    <div className="flex items-center gap-3">
      <div className={`w-40 text-sm font-medium truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
        {label}
      </div>
      <div className="flex-1 flex items-center gap-2">
        <div className={`h-7 rounded-md flex items-center ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`} style={{ width: '100%' }}>
          <div
            className={`h-full rounded-md ${color} transition-all duration-300 flex items-center justify-end pr-2`}
            style={{ width: `${width}%`, minWidth: value > 0 ? '2rem' : 0 }}
          >
            {value > 0 && (
              <span className="text-xs font-bold text-white">{value}</span>
            )}
          </div>
        </div>
        {rate !== undefined && (
          <span className={`text-xs font-medium w-12 text-right ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {rate}%
          </span>
        )}
      </div>
    </div>
  )
}
