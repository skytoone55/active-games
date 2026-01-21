'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
  Send,
  Sparkles,
  Loader2,
  RefreshCw,
  ChevronDown,
  Filter,
  Building2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Bot
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

interface ProposedAction {
  name: string
  params: Record<string, unknown>
  description: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  data?: unknown
  proposedAction?: ProposedAction
  actionExecuted?: boolean
  actionResult?: {
    success: boolean
    message: string
    details?: Record<string, unknown>
  }
}

// Date range options
const DATE_RANGES = [
  { label: 'Aujourd\'hui', value: 'today' },
  { label: 'Cette semaine', value: 'week' },
  { label: 'Ce mois', value: 'month' },
  { label: 'Ce trimestre', value: 'quarter' },
  { label: 'Cette année', value: 'year' },
  { label: 'Tout', value: 'all' },
]

// Colors for charts
const COLORS = ['#00f0ff', '#f97316', '#22c55e', '#a855f7', '#ec4899', '#eab308']

export default function StatisticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [dateRange, setDateRange] = useState('month')
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'clients' | 'revenue' | 'team'>('overview')

  // AI Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/admin/login')
        return
      }

      // Load branches
      const { data: branchesData } = await supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)

      if (branchesData) {
        setBranches(branchesData)
      }

      await loadStats()
    }
    checkAuth()
  }, [router])

  // Reload stats when filters change
  useEffect(() => {
    if (!loading) {
      loadStats()
    }
  }, [dateRange, selectedBranch])

  const loadStats = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/statistics?range=${dateRange}&branch=${selectedBranch}`)
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  // AI Chat handler
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || chatLoading) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setChatLoading(true)

    try {
      const response = await fetch('/api/admin/statistics/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage,
          dateRange,
          branchId: selectedBranch !== 'all' ? selectedBranch : undefined
        })
      })

      const data = await response.json()
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer || '',
        proposedAction: data.proposedAction
      }])
    } catch (error) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Désolé, une erreur est survenue. Réessayez.'
      }])
    } finally {
      setChatLoading(false)
    }
  }

  // Execute proposed action
  const handleExecuteAction = async (action: ProposedAction, messageIndex: number) => {
    setChatLoading(true)
    try {
      const response = await fetch('/api/admin/statistics/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executeActions: true,
          pendingAction: {
            name: action.name,
            params: action.params
          }
        })
      })

      const data = await response.json()

      // Update the message with the action result
      setChatMessages(prev => prev.map((msg, i) => {
        if (i === messageIndex) {
          return {
            ...msg,
            actionExecuted: true,
            actionResult: data.actionResult
          }
        }
        return msg
      }))

      // Reload stats if action was successful
      if (data.actionResult?.success) {
        await loadStats()
      }
    } catch (error) {
      setChatMessages(prev => prev.map((msg, i) => {
        if (i === messageIndex) {
          return {
            ...msg,
            actionExecuted: true,
            actionResult: { success: false, message: 'Erreur lors de l\'exécution' }
          }
        }
        return msg
      }))
    } finally {
      setChatLoading(false)
    }
  }

  // Cancel proposed action
  const handleCancelAction = (messageIndex: number) => {
    setChatMessages(prev => prev.map((msg, i) => {
      if (i === messageIndex) {
        return {
          ...msg,
          actionExecuted: true,
          actionResult: { success: false, message: 'Action annulée par l\'utilisateur' }
        }
      }
      return msg
    }))
  }

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(amount)
  }

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-dark-300 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-300 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              <BarChart3 className="w-8 h-8 text-primary" />
              Statistiques
            </h1>
            <p className="text-gray-400 mt-1">Analysez vos données et posez vos questions</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
            {/* Date Range */}
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="appearance-none bg-dark-200 border border-primary/30 rounded-lg px-4 py-2 pr-10 text-white focus:outline-none focus:border-primary"
              >
                {DATE_RANGES.map(range => (
                  <option key={range.value} value={range.value}>{range.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Branch Filter */}
            <div className="relative">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="appearance-none bg-dark-200 border border-primary/30 rounded-lg px-4 py-2 pr-10 text-white focus:outline-none focus:border-primary"
              >
                <option value="all">Toutes les branches</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
              <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Refresh */}
            <button
              onClick={loadStats}
              disabled={loading}
              className="bg-dark-200 border border-primary/30 rounded-lg px-4 py-2 text-white hover:border-primary transition-colors flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>

        {/* AI Assistant */}
        <div className="bg-dark-200/50 rounded-2xl border border-primary/30 p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-purple-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Assistant IA Admin</h2>
              <p className="text-sm text-gray-400">Analyse, actions et aide - demandez en français</p>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="bg-dark-300/50 rounded-xl p-4 mb-4 max-h-80 overflow-y-auto">
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 py-4">
                <p className="mb-3 text-sm">Je peux analyser vos données ET effectuer des actions. Exemples :</p>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 justify-center">
                    <span className="text-xs text-primary/50">📊 Stats:</span>
                    {[
                      "Quel est mon CA ce mois ?",
                      "Qui sont mes meilleurs clients ?",
                    ].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => setChatInput(q)}
                        className="text-xs bg-dark-200 px-3 py-1 rounded-full text-gray-400 hover:text-primary hover:border-primary border border-transparent transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <span className="text-xs text-orange-400/50">⚡ Actions:</span>
                    {[
                      "Ferme les commandes payées",
                      "Y a-t-il des incohérences à corriger ?",
                      "Nettoie les commandes non payées depuis 30 jours",
                    ].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => setChatInput(q)}
                        className="text-xs bg-dark-200 px-3 py-1 rounded-full text-gray-400 hover:text-orange-400 hover:border-orange-400 border border-transparent transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <span className="text-xs text-green-400/50">❓ Aide:</span>
                    {[
                      "Comment créer une commande ?",
                      "Comment faire un remboursement ?",
                    ].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => setChatInput(q)}
                        className="text-xs bg-dark-200 px-3 py-1 rounded-full text-gray-400 hover:text-green-400 hover:border-green-400 border border-transparent transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-primary/20 text-white'
                        : 'bg-dark-200 text-gray-200'
                    }`}>
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-2 text-xs text-primary/70">
                          <Bot className="w-3 h-3" />
                          Assistant IA
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Proposed Action Card */}
                      {msg.proposedAction && !msg.actionExecuted && (
                        <div className="mt-3 p-3 bg-dark-300/80 rounded-lg border border-orange-500/30">
                          <div className="flex items-center gap-2 text-orange-400 text-sm font-medium mb-2">
                            <AlertTriangle className="w-4 h-4" />
                            Action proposée
                          </div>
                          <p className="text-white text-sm mb-3">{msg.proposedAction.description}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleExecuteAction(msg.proposedAction!, i)}
                              disabled={chatLoading}
                              className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 border border-green-500 rounded-lg text-green-400 text-sm hover:bg-green-600/30 transition-colors disabled:opacity-50"
                            >
                              <Play className="w-3 h-3" />
                              Exécuter
                            </button>
                            <button
                              onClick={() => handleCancelAction(i)}
                              disabled={chatLoading}
                              className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 border border-red-500 rounded-lg text-red-400 text-sm hover:bg-red-600/30 transition-colors disabled:opacity-50"
                            >
                              <XCircle className="w-3 h-3" />
                              Annuler
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Action Result */}
                      {msg.actionExecuted && msg.actionResult && (
                        <div className={`mt-3 p-3 rounded-lg border ${
                          msg.actionResult.success
                            ? 'bg-green-900/20 border-green-500/30'
                            : 'bg-red-900/20 border-red-500/30'
                        }`}>
                          <div className={`flex items-center gap-2 text-sm font-medium mb-1 ${
                            msg.actionResult.success ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {msg.actionResult.success ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            {msg.actionResult.success ? 'Action effectuée' : 'Action non effectuée'}
                          </div>
                          <p className="text-gray-300 text-sm">{msg.actionResult.message}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-dark-200 rounded-xl px-4 py-2 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-sm text-gray-400">Réflexion en cours...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleChatSubmit} className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Posez votre question..."
              className="flex-1 bg-dark-300 border border-primary/30 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="bg-primary/20 border border-primary rounded-xl px-4 py-3 text-primary hover:bg-primary/30 transition-colors disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
            { id: 'revenue', label: 'Chiffre d\'affaires', icon: DollarSign },
            { id: 'orders', label: 'Commandes', icon: ShoppingCart },
            { id: 'clients', label: 'Clients', icon: Users },
            { id: 'team', label: 'Équipe', icon: UserCheck },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary/20 text-primary border border-primary'
                  : 'bg-dark-200/50 text-gray-400 border border-transparent hover:border-primary/30'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {stats && (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KPICard
                    title="Chiffre d'affaires"
                    value={formatCurrency(stats.totalRevenue)}
                    icon={DollarSign}
                    color="text-green-400"
                    trend={stats.paidRevenue > 0 ? `${Math.round((stats.paidRevenue / stats.totalRevenue) * 100)}% encaissé` : undefined}
                  />
                  <KPICard
                    title="Commandes"
                    value={stats.totalOrders.toString()}
                    icon={ShoppingCart}
                    color="text-primary"
                    trend={`${formatCurrency(stats.averageOrderValue)} / commande`}
                  />
                  <KPICard
                    title="Clients"
                    value={stats.totalClients.toString()}
                    icon={Users}
                    color="text-purple-400"
                    trend={`+${stats.newClientsThisMonth} ce mois`}
                  />
                  <KPICard
                    title="Taux fidélité"
                    value={stats.totalClients > 0 ? `${Math.round((stats.returningClients / stats.totalClients) * 100)}%` : '0%'}
                    icon={UserCheck}
                    color="text-orange-400"
                    trend={`${stats.returningClients} récurrents`}
                  />
                </div>

                {/* Charts Row */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Revenue by Month */}
                  <div className="bg-dark-200/50 rounded-xl border border-primary/20 p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Évolution du CA</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={stats.ordersByMonth}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#00f0ff" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="month" stroke="#666" />
                        <YAxis stroke="#666" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #00f0ff', borderRadius: '8px' }}
                          formatter={(value) => [formatCurrency(value as number), 'CA']}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#00f0ff" fill="url(#colorRevenue)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Orders by Type */}
                  <div className="bg-dark-200/50 rounded-xl border border-primary/20 p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Répartition par type</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={stats.ordersByType}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="count"
                          nameKey="type"
                          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                        >
                          {stats.ordersByType.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #00f0ff', borderRadius: '8px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Popular Times */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-dark-200/50 rounded-xl border border-primary/20 p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Jours populaires</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={stats.popularDays}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="day" stroke="#666" />
                        <YAxis stroke="#666" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #00f0ff', borderRadius: '8px' }}
                        />
                        <Bar dataKey="count" fill="#00f0ff" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-dark-200/50 rounded-xl border border-primary/20 p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Heures populaires</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={stats.popularHours}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="hour" stroke="#666" />
                        <YAxis stroke="#666" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #00f0ff', borderRadius: '8px' }}
                        />
                        <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Revenue Tab */}
            {activeTab === 'revenue' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KPICard
                    title="CA Total"
                    value={formatCurrency(stats.totalRevenue)}
                    icon={DollarSign}
                    color="text-green-400"
                  />
                  <KPICard
                    title="CA Encaissé"
                    value={formatCurrency(stats.paidRevenue)}
                    icon={CreditCard}
                    color="text-primary"
                  />
                  <KPICard
                    title="CA En attente"
                    value={formatCurrency(stats.pendingRevenue)}
                    icon={Clock}
                    color="text-orange-400"
                  />
                  <KPICard
                    title="Panier moyen"
                    value={formatCurrency(stats.averageOrderValue)}
                    icon={ShoppingCart}
                    color="text-purple-400"
                  />
                </div>

                {/* Revenue by Branch */}
                <div className="bg-dark-200/50 rounded-xl border border-primary/20 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">CA par branche</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.ordersByBranch} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis type="number" stroke="#666" />
                      <YAxis type="category" dataKey="branch" stroke="#666" width={100} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #00f0ff', borderRadius: '8px' }}
                        formatter={(value) => [formatCurrency(value as number), 'CA']}
                      />
                      <Bar dataKey="revenue" fill="#00f0ff" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Monthly Evolution */}
                <div className="bg-dark-200/50 rounded-xl border border-primary/20 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Évolution mensuelle</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stats.ordersByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="month" stroke="#666" />
                      <YAxis yAxisId="left" stroke="#666" />
                      <YAxis yAxisId="right" orientation="right" stroke="#666" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #00f0ff', borderRadius: '8px' }}
                      />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="revenue" name="CA" stroke="#00f0ff" strokeWidth={2} />
                      <Line yAxisId="right" type="monotone" dataKey="count" name="Commandes" stroke="#a855f7" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KPICard
                    title="Total commandes"
                    value={stats.totalOrders.toString()}
                    icon={ShoppingCart}
                    color="text-primary"
                  />
                  <KPICard
                    title="Panier moyen"
                    value={formatCurrency(stats.averageOrderValue)}
                    icon={DollarSign}
                    color="text-green-400"
                  />
                  <KPICard
                    title="Games"
                    value={stats.ordersByType.find(t => t.type === 'GAME')?.count.toString() || '0'}
                    icon={Calendar}
                    color="text-purple-400"
                  />
                  <KPICard
                    title="Events"
                    value={stats.ordersByType.find(t => t.type === 'EVENT')?.count.toString() || '0'}
                    icon={Users}
                    color="text-orange-400"
                  />
                </div>

                {/* Orders by Status */}
                <div className="bg-dark-200/50 rounded-xl border border-primary/20 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Statut des commandes</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {stats.ordersByStatus.map((status, i) => (
                      <div key={status.status} className="bg-dark-300/50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold" style={{ color: COLORS[i % COLORS.length] }}>{status.count}</p>
                        <p className="text-sm text-gray-400 capitalize">{status.status.replace('_', ' ')}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Orders Evolution */}
                <div className="bg-dark-200/50 rounded-xl border border-primary/20 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Évolution des commandes</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={stats.ordersByMonth}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="month" stroke="#666" />
                      <YAxis stroke="#666" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #00f0ff', borderRadius: '8px' }}
                      />
                      <Area type="monotone" dataKey="count" stroke="#a855f7" fill="url(#colorCount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Clients Tab */}
            {activeTab === 'clients' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KPICard
                    title="Total clients"
                    value={stats.totalClients.toString()}
                    icon={Users}
                    color="text-primary"
                  />
                  <KPICard
                    title="Nouveaux ce mois"
                    value={stats.newClientsThisMonth.toString()}
                    icon={UserCheck}
                    color="text-green-400"
                  />
                  <KPICard
                    title="Clients récurrents"
                    value={stats.returningClients.toString()}
                    icon={TrendingUp}
                    color="text-purple-400"
                  />
                  <KPICard
                    title="Taux fidélité"
                    value={stats.totalClients > 0 ? `${Math.round((stats.returningClients / stats.totalClients) * 100)}%` : '0%'}
                    icon={UserCheck}
                    color="text-orange-400"
                  />
                </div>

                {/* Top Clients */}
                <div className="bg-dark-200/50 rounded-xl border border-primary/20 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Meilleurs clients</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-primary/20">
                          <th className="text-left py-3 px-4 text-gray-400 font-medium">Client</th>
                          <th className="text-center py-3 px-4 text-gray-400 font-medium">Commandes</th>
                          <th className="text-right py-3 px-4 text-gray-400 font-medium">CA généré</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.topClients.map((client, i) => (
                          <tr key={i} className="border-b border-dark-100/50 hover:bg-dark-300/30">
                            <td className="py-3 px-4 text-white">{client.name}</td>
                            <td className="py-3 px-4 text-center text-gray-300">{client.orders}</td>
                            <td className="py-3 px-4 text-right text-primary font-medium">{formatCurrency(client.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Team Tab */}
            {activeTab === 'team' && (
              <div className="space-y-6">
                <div className="bg-dark-200/50 rounded-xl border border-primary/20 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Commandes par utilisateur</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.ordersByUser} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis type="number" stroke="#666" />
                      <YAxis type="category" dataKey="user" stroke="#666" width={120} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #00f0ff', borderRadius: '8px' }}
                      />
                      <Bar dataKey="count" fill="#00f0ff" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// KPI Card Component
function KPICard({
  title,
  value,
  icon: Icon,
  color = 'text-primary',
  trend
}: {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  color?: string
  trend?: string
}) {
  return (
    <div className="bg-dark-200/50 rounded-xl border border-primary/20 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">{title}</span>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {trend && <p className="text-xs text-gray-500 mt-1">{trend}</p>}
    </div>
  )
}
