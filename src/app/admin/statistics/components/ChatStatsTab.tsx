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
  TrendingUp
} from 'lucide-react'
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
        <p>Erreur lors du chargement des statistiques chat</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className={`text-center py-20 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        Aucune donnée disponible
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Temps de réponse moyen"
          value={formatTime(stats.avgResponseTime)}
          subtitle={`Médian : ${formatTime(stats.medianResponseTime)}`}
          icon={Clock}
          isDark={isDark}
          color="blue"
        />
        <KPICard
          title="Conversations"
          value={stats.totalConversations.toString()}
          subtitle={`WA: ${stats.whatsapp.activeConversations} · Messenger: ${stats.messenger.totalConversations}`}
          icon={MessagesSquare}
          isDark={isDark}
          color="green"
        />
        <KPICard
          title="Messages total"
          value={stats.totalMessages.toString()}
          subtitle={`↓ ${stats.whatsapp.inboundCount} · ↑ ${stats.whatsapp.outboundCount} (WA)`}
          icon={MessageCircle}
          isDark={isDark}
          color="purple"
        />
        <KPICard
          title="Réponses < 5min"
          value={`${stats.under5minPercent}%`}
          subtitle={`${stats.responseTimeDistribution.under5min} / ${stats.totalResponses} réponses`}
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
            <StatItem label="Messages entrants" value={stats.whatsapp.inboundCount} isDark={isDark} />
            <StatItem label="Messages sortants" value={stats.whatsapp.outboundCount} isDark={isDark} />
            <StatItem label="Conversations actives" value={stats.whatsapp.activeConversations} isDark={isDark} />
            <StatItem label="Non lues" value={stats.unreadConversations} isDark={isDark} highlight={stats.unreadConversations > 0} />
          </div>
        </div>

        {/* Messenger Summary */}
        <div className={`rounded-xl p-5 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-3 h-3 rounded-full bg-blue-500`} />
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Messenger</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <StatItem label="Conversations" value={stats.messenger.totalConversations} isDark={isDark} />
            <StatItem label="Messages" value={stats.messenger.totalMessages} isDark={isDark} />
            <StatItem label="Actives" value={stats.messenger.byStatus.active} isDark={isDark} />
            <StatItem label="Terminées" value={stats.messenger.byStatus.completed} isDark={isDark} />
          </div>
        </div>
      </div>

      {/* Charts Row: Distribution + Activity by Hour */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Response Time Distribution */}
        <ChartCard title="Distribution des temps de réponse" isDark={isDark}>
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
            <EmptyChart isDark={isDark} />
          )}
        </ChartCard>

        {/* Activity by Hour */}
        <ChartCard title="Activité par heure" isDark={isDark}>
          {stats.activityByHour.some(h => h.inbound > 0 || h.outbound > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.activityByHour}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="hour" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={11} />
                <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="inbound" name="Entrants" fill={colors[0]} radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="outbound" name="Sortants" fill={colors[2]} radius={[4, 4, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart isDark={isDark} />
          )}
        </ChartCard>
      </div>

      {/* Activity by Day */}
      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Activité par jour" isDark={isDark}>
          {stats.activityByDay.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.activityByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="day" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Messages" fill={colors[3]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart isDark={isDark} />
          )}
        </ChartCard>

        {/* Agent Performance Chart */}
        <ChartCard title="Performance agents (temps moyen)" isDark={isDark}>
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
                  formatter={(value) => [formatTime(value as number), 'Temps moyen']}
                />
                <Bar dataKey="avgResponseTime" fill={colors[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart isDark={isDark} message="Aucune donnée agent" />
          )}
        </ChartCard>
      </div>

      {/* Agent Ranking Table */}
      {agentData.length > 0 && (
        <div className={`rounded-xl p-5 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Classement agents
            </div>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <th className={`text-left py-3 px-4 font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>#</th>
                  <th className={`text-left py-3 px-4 font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Agent</th>
                  <th className={`text-center py-3 px-4 font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Messages</th>
                  <th className={`text-center py-3 px-4 font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Temps moyen</th>
                  <th className={`text-center py-3 px-4 font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Plus rapide</th>
                  <th className={`text-center py-3 px-4 font-medium text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Plus lent</th>
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

function EmptyChart({ isDark, message = 'Aucune donnée' }: { isDark: boolean; message?: string }) {
  return (
    <div className={`flex items-center justify-center h-[220px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
      <p className="text-sm">{message}</p>
    </div>
  )
}
