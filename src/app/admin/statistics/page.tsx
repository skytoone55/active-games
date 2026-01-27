'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  TrendingUp,
  Users,
  CreditCard,
  Calendar,
  DollarSign,
  ShoppingCart,
  UserCheck,
  Clock,
  RefreshCw,
  Building2,
  Loader2,
  Target,
  PartyPopper,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Download
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'
import { useAuth } from '@/hooks/useAuth'
import { useBranches } from '@/hooks/useBranches'
import { useTranslation } from '@/contexts/LanguageContext'
import { AdminHeader } from '../components/AdminHeader'
import { createClient } from '@/lib/supabase/client'

// Types
interface StatsData {
  // Revenue
  totalRevenue: number
  totalOrders: number
  paidRevenue: number
  pendingRevenue: number
  averageOrderValue: number
  // Orders
  ordersByStatus: { status: string; count: number }[]
  ordersByType: { type: string; count: number }[]
  ordersByMonth: { month: string; count: number; revenue: number }[]
  ordersByBranch: { branch: string; count: number; revenue: number }[]
  // Clients
  totalClients: number
  newClientsThisMonth: number
  returningClients: number
  topClients: { name: string; orders: number; revenue: number }[]
  // Users
  ordersByUser: { user: string; count: number }[]
  // Time
  popularDays: { day: string; count: number }[]
  popularHours: { hour: string; count: number }[]
}

// Les DATE_RANGES seront définis dans le component pour utiliser t()

// Colors for charts
const CHART_COLORS = {
  light: ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ec4899', '#eab308'],
  dark: ['#60a5fa', '#fb923c', '#4ade80', '#c084fc', '#f472b6', '#facc15']
}

// STATUS_COLORS sera défini dans le component pour utiliser t()

export default function StatisticsPage() {
  const router = useRouter()
  const { user, loading: authLoading, signOut } = useAuth()
  const { branches, selectedBranch, selectBranch, loading: branchesLoading } = useBranches()
  const { t } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [dateRange, setDateRange] = useState('month')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'clients' | 'revenue' | 'team'>('overview')
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  // Charger le thème depuis localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('admin_theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('admin_theme', newTheme)
  }

  const isDark = theme === 'dark'
  const colors = isDark ? CHART_COLORS.dark : CHART_COLORS.light

  // Date range options with translations
  const DATE_RANGES = useMemo(() => [
    { label: t('admin.stats.date_range.today'), value: 'today' },
    { label: t('admin.stats.date_range.week'), value: 'week' },
    { label: t('admin.stats.date_range.month'), value: 'month' },
    { label: t('admin.stats.date_range.year'), value: 'year' },
    { label: t('admin.stats.date_range.custom'), value: 'custom' },
  ], [t])

  // Status colors with translated labels
  const STATUS_COLORS = useMemo(() => ({
    pending: { light: 'bg-yellow-100 text-yellow-700', dark: 'bg-yellow-500/20 text-yellow-400', label: t('admin.stats.status.pending') },
    auto_confirmed: { light: 'bg-green-100 text-green-700', dark: 'bg-green-500/20 text-green-400', label: t('admin.stats.status.auto_confirmed') },
    manually_confirmed: { light: 'bg-blue-100 text-blue-700', dark: 'bg-blue-500/20 text-blue-400', label: t('admin.stats.status.manually_confirmed') },
    cancelled: { light: 'bg-red-100 text-red-700', dark: 'bg-red-500/20 text-red-400', label: t('admin.stats.status.cancelled') },
    closed: { light: 'bg-purple-100 text-purple-700', dark: 'bg-purple-500/20 text-purple-400', label: t('admin.stats.status.closed') },
  }), [t])

  // Charger les stats
  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      let url = `/api/admin/statistics?range=${dateRange}&branch=${selectedBranchId}`
      if (dateRange === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${customStartDate}&endDate=${customEndDate}`
      }
      const response = await fetch(url)
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }, [dateRange, selectedBranchId, customStartDate, customEndDate])

  // Auth check et chargement initial
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/admin/login')
        return
      }
      await loadStats()
    }
    checkAuth()
  }, [router, loadStats])

  // Recharger quand les filtres changent
  useEffect(() => {
    if (!loading) {
      // Pour les dates custom, attendre que les deux soient renseignées
      if (dateRange === 'custom') {
        if (customStartDate && customEndDate) {
          loadStats()
        }
      } else {
        loadStats()
      }
    }
  }, [dateRange, selectedBranchId, customStartDate, customEndDate])

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(amount)
  }

  // Format number
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num)
  }

  // Calculer effectiveSelectedBranch
  const effectiveSelectedBranch = selectedBranch || (branches.length > 0 ? branches[0] : null)

  // Export CSV
  const handleExportCSV = () => {
    if (!stats) return

    const rows = [
      [t('admin.stats.title'), dateRange, new Date().toLocaleDateString('fr-FR')],
      [],
      [t('admin.stats.overview.total_revenue'), formatCurrency(stats.totalRevenue)],
      [t('admin.stats.overview.paid_revenue'), formatCurrency(stats.paidRevenue)],
      [t('admin.stats.overview.pending_revenue'), formatCurrency(stats.pendingRevenue)],
      [t('admin.stats.overview.average_order'), formatCurrency(stats.averageOrderValue)],
      [t('admin.stats.overview.total_orders'), stats.totalOrders],
      [t('admin.stats.overview.total_clients'), stats.totalClients],
      [t('admin.stats.overview.new_clients'), stats.newClientsThisMonth],
      [t('admin.stats.overview.returning_clients'), stats.returningClients],
      [],
      [t('admin.stats.overview.top_clients')],
      [t('admin.stats.overview.name'), t('admin.stats.overview.orders'), t('admin.stats.overview.revenue')],
      ...stats.topClients.map(c => [c.name, c.orders, formatCurrency(c.revenue)]),
    ]

    const csvContent = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `statistiques_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  if (authLoading || branchesLoading || !user) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      {/* Header */}
      <AdminHeader
        user={user}
        branches={branches}
        selectedBranch={effectiveSelectedBranch}
        onBranchSelect={selectBranch}
        onSignOut={signOut}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Sous-header */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
              <BarChart3 className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('admin.stats.title')}
              </h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('admin.stats.subtitle')}
              </p>
            </div>
          </div>

          {/* Filtres */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Range */}
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className={`appearance-none rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-400'
                } border`}
              >
                {DATE_RANGES.map(range => (
                  <option key={range.value} value={range.value}>{range.label}</option>
                ))}
              </select>
              <Calendar className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`} />
            </div>

            {/* Custom Date Range */}
            {dateRange === 'custom' && (
              <>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className={`rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-400'
                  } border`}
                />
                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>à</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className={`rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-400'
                  } border`}
                />
              </>
            )}

            {/* Branch Filter */}
            <div className="relative">
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className={`appearance-none rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-400'
                } border`}
              >
                <option value="all">Toutes les branches</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
              <Building2 className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`} />
            </div>

            {/* Refresh */}
            <button
              onClick={loadStats}
              disabled={loading}
              className={`rounded-lg px-4 py-2 flex items-center gap-2 transition-colors ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>

            {/* Export */}
            <button
              onClick={handleExportCSV}
              disabled={!stats}
              className={`rounded-lg px-4 py-2 flex items-center gap-2 transition-colors ${
                isDark
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-50'} px-6 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex gap-2 overflow-x-auto">
          {[
            { id: 'overview', label: t('admin.stats.tabs.overview'), icon: BarChart3 },
            { id: 'revenue', label: t('admin.stats.tabs.revenue'), icon: DollarSign },
            { id: 'orders', label: t('admin.stats.tabs.orders'), icon: ShoppingCart },
            { id: 'clients', label: t('admin.stats.tabs.clients'), icon: Users },
            { id: 'team', label: t('admin.stats.tabs.team'), icon: UserCheck },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors font-medium ${
                activeTab === tab.id
                  ? isDark
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-500 text-white'
                  : isDark
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="p-6">
        {loading && !stats ? (
          <div className="flex justify-center py-20">
            <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
        ) : stats ? (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard
                    title="Chiffre d'affaires"
                    value={formatCurrency(stats.totalRevenue)}
                    icon={DollarSign}
                    trend={stats.paidRevenue > 0 ? `${Math.round((stats.paidRevenue / stats.totalRevenue) * 100)}% encaissé` : undefined}
                    trendUp={true}
                    isDark={isDark}
                    color="green"
                  />
                  <KPICard
                    title="Commandes"
                    value={formatNumber(stats.totalOrders)}
                    icon={ShoppingCart}
                    trend={`${formatCurrency(stats.averageOrderValue)} / commande`}
                    isDark={isDark}
                    color="blue"
                  />
                  <KPICard
                    title="Clients"
                    value={formatNumber(stats.totalClients)}
                    icon={Users}
                    trend={`+${stats.newClientsThisMonth} ce mois`}
                    trendUp={true}
                    isDark={isDark}
                    color="purple"
                  />
                  <KPICard
                    title="Taux fidélité"
                    value={stats.totalClients > 0 ? `${Math.round((stats.returningClients / stats.totalClients) * 100)}%` : '0%'}
                    icon={UserCheck}
                    trend={`${stats.returningClients} récurrents`}
                    isDark={isDark}
                    color="orange"
                  />
                </div>

                {/* Charts Row */}
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Revenue Evolution */}
                  <ChartCard title="Évolution du CA" isDark={isDark}>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={stats.ordersByMonth}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colors[0]} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={colors[0]} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                        <XAxis dataKey="month" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                        <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} tickFormatter={(v) => `₪${v}`} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? '#1f2937' : '#ffffff',
                            border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                            borderRadius: '8px',
                            color: isDark ? '#ffffff' : '#000000'
                          }}
                          formatter={(value) => [formatCurrency(value as number), 'CA']}
                        />
                        <Area type="monotone" dataKey="revenue" stroke={colors[0]} fill="url(#colorRevenue)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {/* Orders by Type */}
                  <ChartCard title="Répartition par type" isDark={isDark}>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={stats.ordersByType}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="count"
                          nameKey="type"
                          label={({ name, percent }) => `${name === 'GAME' ? 'Jeux' : 'Événements'} ${((percent || 0) * 100).toFixed(0)}%`}
                        >
                          {stats.ordersByType.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? '#1f2937' : '#ffffff',
                            border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                            borderRadius: '8px',
                            color: isDark ? '#ffffff' : '#000000'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>

                {/* Popular Times */}
                <div className="grid lg:grid-cols-2 gap-6">
                  <ChartCard title="Jours populaires" isDark={isDark}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={stats.popularDays}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                        <XAxis dataKey="day" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                        <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? '#1f2937' : '#ffffff',
                            border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                            borderRadius: '8px',
                            color: isDark ? '#ffffff' : '#000000'
                          }}
                        />
                        <Bar dataKey="count" fill={colors[0]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Heures populaires" isDark={isDark}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={stats.popularHours}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                        <XAxis dataKey="hour" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                        <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? '#1f2937' : '#ffffff',
                            border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                            borderRadius: '8px',
                            color: isDark ? '#ffffff' : '#000000'
                          }}
                        />
                        <Bar dataKey="count" fill={colors[3]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              </div>
            )}

            {/* Revenue Tab */}
            {activeTab === 'revenue' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard title="CA Total" value={formatCurrency(stats.totalRevenue)} icon={DollarSign} isDark={isDark} color="green" />
                  <KPICard title="CA Encaissé" value={formatCurrency(stats.paidRevenue)} icon={CreditCard} isDark={isDark} color="blue" />
                  <KPICard title="CA En attente" value={formatCurrency(stats.pendingRevenue)} icon={Clock} isDark={isDark} color="orange" />
                  <KPICard title="Panier moyen" value={formatCurrency(stats.averageOrderValue)} icon={ShoppingCart} isDark={isDark} color="purple" />
                </div>

                {/* Revenue by Branch */}
                <ChartCard title="CA par branche" isDark={isDark}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.ordersByBranch} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                      <XAxis type="number" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} tickFormatter={(v) => `₪${v}`} />
                      <YAxis type="category" dataKey="branch" stroke={isDark ? '#9ca3af' : '#6b7280'} width={100} fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#1f2937' : '#ffffff',
                          border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          color: isDark ? '#ffffff' : '#000000'
                        }}
                        formatter={(value) => [formatCurrency(value as number), 'CA']}
                      />
                      <Bar dataKey="revenue" fill={colors[2]} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Monthly Evolution with dual axis */}
                <ChartCard title="Évolution mensuelle" isDark={isDark}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stats.ordersByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                      <XAxis dataKey="month" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                      <YAxis yAxisId="left" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} tickFormatter={(v) => `₪${v}`} />
                      <YAxis yAxisId="right" orientation="right" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#1f2937' : '#ffffff',
                          border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          color: isDark ? '#ffffff' : '#000000'
                        }}
                      />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="revenue" name="CA" stroke={colors[0]} strokeWidth={2} dot={{ fill: colors[0] }} />
                      <Line yAxisId="right" type="monotone" dataKey="count" name="Commandes" stroke={colors[3]} strokeWidth={2} dot={{ fill: colors[3] }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard title="Total commandes" value={formatNumber(stats.totalOrders)} icon={ShoppingCart} isDark={isDark} color="blue" />
                  <KPICard title="Panier moyen" value={formatCurrency(stats.averageOrderValue)} icon={DollarSign} isDark={isDark} color="green" />
                  <KPICard
                    title="Jeux"
                    value={formatNumber(stats.ordersByType.find(t => t.type === 'GAME')?.count || 0)}
                    icon={Target}
                    isDark={isDark}
                    color="purple"
                  />
                  <KPICard
                    title="Événements"
                    value={formatNumber(stats.ordersByType.find(t => t.type === 'EVENT')?.count || 0)}
                    icon={PartyPopper}
                    isDark={isDark}
                    color="orange"
                  />
                </div>

                {/* Orders by Status */}
                <ChartCard title="Statut des commandes" isDark={isDark}>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4">
                    {stats.ordersByStatus.map((status) => {
                      const statusStyle = STATUS_COLORS[status.status] || STATUS_COLORS.pending
                      return (
                        <div
                          key={status.status}
                          className={`rounded-lg p-4 text-center ${isDark ? statusStyle.dark : statusStyle.light}`}
                        >
                          <p className="text-3xl font-bold">{formatNumber(status.count)}</p>
                          <p className="text-sm opacity-80">{statusStyle.label}</p>
                        </div>
                      )
                    })}
                  </div>
                </ChartCard>

                {/* Orders Evolution */}
                <ChartCard title="Évolution des commandes" isDark={isDark}>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={stats.ordersByMonth}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={colors[3]} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={colors[3]} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                      <XAxis dataKey="month" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                      <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#1f2937' : '#ffffff',
                          border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          color: isDark ? '#ffffff' : '#000000'
                        }}
                      />
                      <Area type="monotone" dataKey="count" stroke={colors[3]} fill="url(#colorCount)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            )}

            {/* Clients Tab */}
            {activeTab === 'clients' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard title="Total clients" value={formatNumber(stats.totalClients)} icon={Users} isDark={isDark} color="blue" />
                  <KPICard title="Nouveaux ce mois" value={formatNumber(stats.newClientsThisMonth)} icon={UserCheck} trendUp={true} isDark={isDark} color="green" />
                  <KPICard title="Clients récurrents" value={formatNumber(stats.returningClients)} icon={TrendingUp} isDark={isDark} color="purple" />
                  <KPICard
                    title="Taux fidélité"
                    value={stats.totalClients > 0 ? `${Math.round((stats.returningClients / stats.totalClients) * 100)}%` : '0%'}
                    icon={Percent}
                    isDark={isDark}
                    color="orange"
                  />
                </div>

                {/* Top Clients */}
                <ChartCard title="Meilleurs clients" isDark={isDark}>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                          <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>#</th>
                          <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Client</th>
                          <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Commandes</th>
                          <th className={`text-right py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>CA généré</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.topClients.map((client, i) => (
                          <tr key={i} className={`border-b ${isDark ? 'border-gray-700/50 hover:bg-gray-800' : 'border-gray-100 hover:bg-gray-50'}`}>
                            <td className={`py-3 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{i + 1}</td>
                            <td className={`py-3 px-4 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{client.name}</td>
                            <td className={`py-3 px-4 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{client.orders}</td>
                            <td className={`py-3 px-4 text-right font-semibold ${isDark ? 'text-green-400' : 'text-green-600'}`}>{formatCurrency(client.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ChartCard>
              </div>
            )}

            {/* Team Tab */}
            {activeTab === 'team' && (
              <div className="space-y-6">
                <ChartCard title="Commandes par utilisateur" isDark={isDark}>
                  <ResponsiveContainer width="100%" height={Math.max(300, stats.ordersByUser.length * 50)}>
                    <BarChart data={stats.ordersByUser} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                      <XAxis type="number" stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
                      <YAxis type="category" dataKey="user" stroke={isDark ? '#9ca3af' : '#6b7280'} width={150} fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#1f2937' : '#ffffff',
                          border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          color: isDark ? '#ffffff' : '#000000'
                        }}
                      />
                      <Bar dataKey="count" fill={colors[0]} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            )}
          </>
        ) : (
          <div className={`text-center py-20 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Aucune donnée disponible
          </div>
        )}
      </main>
    </div>
  )
}

// KPI Card Component
function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  isDark,
  color = 'blue'
}: {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  trend?: string
  trendUp?: boolean
  isDark: boolean
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red'
}) {
  const colorClasses = {
    blue: {
      light: 'bg-blue-100 text-blue-600',
      dark: 'bg-blue-500/20 text-blue-400',
      value: isDark ? 'text-blue-400' : 'text-blue-600'
    },
    green: {
      light: 'bg-green-100 text-green-600',
      dark: 'bg-green-500/20 text-green-400',
      value: isDark ? 'text-green-400' : 'text-green-600'
    },
    purple: {
      light: 'bg-purple-100 text-purple-600',
      dark: 'bg-purple-500/20 text-purple-400',
      value: isDark ? 'text-purple-400' : 'text-purple-600'
    },
    orange: {
      light: 'bg-orange-100 text-orange-600',
      dark: 'bg-orange-500/20 text-orange-400',
      value: isDark ? 'text-orange-400' : 'text-orange-600'
    },
    red: {
      light: 'bg-red-100 text-red-600',
      dark: 'bg-red-500/20 text-red-400',
      value: isDark ? 'text-red-400' : 'text-red-600'
    }
  }

  const c = colorClasses[color]

  return (
    <div className={`rounded-xl p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{title}</span>
        <div className={`p-2 rounded-lg ${isDark ? c.dark : c.light}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className={`text-2xl font-bold ${c.value}`}>{value}</p>
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {trendUp !== undefined && (
            trendUp ? (
              <ArrowUpRight className="w-3 h-3 text-green-500" />
            ) : (
              <ArrowDownRight className="w-3 h-3 text-red-500" />
            )
          )}
          {trend}
        </div>
      )}
    </div>
  )
}

// Chart Card Component
function ChartCard({
  title,
  isDark,
  children
}: {
  title: string
  isDark: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-xl p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border`}>
      <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
      {children}
    </div>
  )
}
