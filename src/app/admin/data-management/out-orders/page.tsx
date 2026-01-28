'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileX, Loader2, AlertTriangle, ChevronDown, ChevronUp, RotateCcw, Trash2, CheckCircle, Search, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useBranches } from '@/hooks/useBranches'
import { useTranslation } from '@/contexts/LanguageContext'
import { AdminHeader } from '../../components/AdminHeader'

interface Order {
  id: string
  branch_id: string | null
  customer_first_name: string
  customer_last_name: string | null
  customer_phone: string
  customer_email: string | null
  request_reference: string
  created_at: string
  number_of_games: number | null
  contact_id: string | null
  source: 'admin_agenda' | 'public_booking' | null
  booking?: {
    id: string
    reference_code: string
    type: string
    participants_count: number
    start_datetime: string
    end_datetime: string
  }
  contact?: {
    id: string
    first_name: string
    last_name: string
    phone: string
    email: string
  }
}

interface Stats {
  totalOrders: number
  totalGames: number
  totalPlayers: number
  totalRevenue: number
}

type FilterPeriod = 'today' | 'week' | 'month' | 'custom' | 'all'

export default function OutOrdersPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user, loading: authLoading, signOut } = useAuth()
  const { branches, loading: branchesLoading, selectedBranch, selectBranch } = useBranches()

  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [showBranchSelector, setShowBranchSelector] = useState(false)
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingOrders, setLoadingOrders] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [deleteContact, setDeleteContact] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<1 | 2>(1)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('admin_theme') as 'light' | 'dark' | null
      if (savedTheme) setTheme(savedTheme)
    }
  }, [])

  // Redirect non super_admin users
  useEffect(() => {
    if (!authLoading && user && user.role !== 'super_admin') {
      router.push('/admin')
    }
  }, [user, authLoading, router])

  // Initialize selectedBranches with all branches
  useEffect(() => {
    if (branches.length > 0 && selectedBranches.length === 0) {
      setSelectedBranches(branches.map(b => b.id))
    }
  }, [branches])

  // Load orders when filters change
  useEffect(() => {
    if (selectedBranches.length > 0) {
      fetchOrders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranches, filterPeriod, customStartDate, customEndDate])

  const handleToggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('admin_theme', newTheme)
  }

  const handleBranchSelect = (branchId: string) => {
    selectBranch(branchId)
  }

  const toggleBranchSelection = (branchId: string) => {
    setSelectedBranches(prev =>
      prev.includes(branchId)
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    )
  }

  const selectAllBranches = () => {
    setSelectedBranches(branches.map(b => b.id))
  }

  const deselectAllBranches = () => {
    setSelectedBranches([])
  }

  const getDateRange = (): { startDate?: string; endDate?: string } => {
    const now = new Date()

    switch (filterPeriod) {
      case 'today':
        const todayStart = new Date(now.setHours(0, 0, 0, 0))
        return { startDate: todayStart.toISOString() }

      case 'week':
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - 7)
        return { startDate: weekStart.toISOString() }

      case 'month':
        const monthStart = new Date(now)
        monthStart.setMonth(now.getMonth() - 1)
        return { startDate: monthStart.toISOString() }

      case 'custom':
        return {
          startDate: customStartDate ? new Date(customStartDate).toISOString() : undefined,
          endDate: customEndDate ? new Date(customEndDate).toISOString() : undefined
        }

      case 'all':
      default:
        return {}
    }
  }

  const fetchOrders = async () => {
    setLoadingOrders(true)
    setErrorMessage(null)

    try {
      const dateRange = getDateRange()

      const response = await fetch('/api/admin/out-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchIds: selectedBranches,
          ...dateRange
        })
      })

      const data = await response.json()
      if (data.success) {
        setOrders(data.orders || [])
        setStats(data.stats)
      } else {
        setErrorMessage(data.error || t('admin.out_orders.error_loading'))
        setTimeout(() => setErrorMessage(null), 5000)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
      setErrorMessage(t('admin.out_orders.server_error'))
      setTimeout(() => setErrorMessage(null), 5000)
    } finally {
      setLoadingOrders(false)
    }
  }

  const handleToggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  const handleSelectAllOrders = () => {
    setSelectedOrders(new Set(orders.map(o => o.id)))
  }

  const handleDeselectAllOrders = () => {
    setSelectedOrders(new Set())
  }

  const handleToggleIn = async (orderId: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/toggle-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowToggleOff: true  // Flag spécial pour data-management
        })
      })

      if (!response.ok) {
        throw new Error('Failed to toggle IN')
      }

      // Remove from list
      setOrders(prev => prev.filter(o => o.id !== orderId))
      setSuccessMessage(t('admin.out_orders.toggle_in_success'))
      setTimeout(() => setSuccessMessage(null), 3000)

      // Refresh to update stats
      fetchOrders()
    } catch (error) {
      console.error('Error toggling IN:', error)
      setErrorMessage(t('admin.out_orders.toggle_in_error'))
      setTimeout(() => setErrorMessage(null), 3000)
    }
  }

  const handleDeleteClick = () => {
    if (selectedOrders.size === 0) return
    setShowDeleteModal(true)
    setDeleteConfirmStep(1)
    setDeleteContact(false)
  }

  const handleConfirmDelete = async () => {
    if (deleteConfirmStep === 1) {
      setDeleteConfirmStep(2)
      return
    }

    // Step 2: Execute deletion
    setIsDeleting(true)

    try {
      // Pour chaque order sélectionné, on doit:
      // 1. Supprimer les slots/sessions liés au booking
      // 2. Supprimer le booking
      // 3. Supprimer l'order
      // 4. Optionnellement supprimer le contact

      const orderIds = Array.from(selectedOrders)

      // Appel API pour supprimer (on va créer cette API)
      const response = await fetch('/api/admin/out-orders/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds,
          deleteContacts: deleteContact
        })
      })

      const data = await response.json()

      if (!data.success) {
        setErrorMessage(data.error || t('admin.out_orders.delete_error'))
        setIsDeleting(false)
        return
      }

      // Success
      setShowDeleteModal(false)
      setSelectedOrders(new Set())
      setSuccessMessage(t('admin.out_orders.delete_success', { count: orderIds.length }))
      setTimeout(() => setSuccessMessage(null), 3000)

      // Refresh
      fetchOrders()

    } catch (error) {
      console.error('Error deleting orders:', error)
      setErrorMessage(t('admin.out_orders.server_error'))
    } finally {
      setIsDeleting(false)
    }
  }

  const isDark = theme === 'dark'

  if (authLoading || branchesLoading || !user) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    )
  }

  if (user.role !== 'super_admin') {
    return null
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <AdminHeader
        user={user}
        branches={branches}
        selectedBranch={selectedBranch}
        onBranchSelect={handleBranchSelect}
        onSignOut={signOut}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-3 rounded-xl ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'}`}>
              <FileX className={`w-8 h-8 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('admin.out_orders.title')}
              </h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('admin.out_orders.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
          }`}>
            <CheckCircle className="w-5 h-5" />
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
          }`}>
            <AlertTriangle className="w-5 h-5" />
            {errorMessage}
          </div>
        )}

        {/* Filters */}
        <div className={`mb-6 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow space-y-4`}>
          {/* Branch Selector */}
          <div>
            <button
              onClick={() => setShowBranchSelector(!showBranchSelector)}
              className={`w-full flex items-center justify-between ${isDark ? 'text-white' : 'text-gray-900'}`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{t('admin.out_orders.branches_selected')}</span>
                <span className={`px-2 py-0.5 rounded text-sm ${
                  isDark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                }`}>
                  {selectedBranches.length} / {branches.length}
                </span>
              </div>
              {showBranchSelector ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {showBranchSelector && (
              <div className="mt-4 space-y-2">
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={selectAllBranches}
                    className={`px-3 py-1 rounded text-sm ${
                      isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    {t('admin.out_orders.select_all')}
                  </button>
                  <button
                    onClick={deselectAllBranches}
                    className={`px-3 py-1 rounded text-sm ${
                      isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    {t('admin.out_orders.deselect_all')}
                  </button>
                </div>
                {branches.map(branch => (
                  <label
                    key={branch.id}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer ${
                      isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedBranches.includes(branch.id)}
                      onChange={() => toggleBranchSelection(branch.id)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{branch.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Period Filter */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('admin.out_orders.filter_period')}
            </label>
            <div className="flex flex-wrap gap-2">
              {(['all', 'today', 'week', 'month', 'custom'] as FilterPeriod[]).map(period => (
                <button
                  key={period}
                  onClick={() => setFilterPeriod(period)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterPeriod === period
                      ? 'bg-purple-600 text-white'
                      : isDark
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  {t(`admin.out_orders.period_${period}`)}
                </button>
              ))}
            </div>

            {filterPeriod === 'custom' && (
              <div className="mt-3 flex gap-3">
                <div className="flex-1">
                  <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {t('admin.out_orders.start_date')}
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'border-gray-700 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-900'
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {t('admin.out_orders.end_date')}
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'border-gray-700 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-900'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className={`mb-6 grid grid-cols-2 md:grid-cols-4 gap-4`}>
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('admin.out_orders.total_orders')}
              </div>
              <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stats.totalOrders}
              </div>
            </div>
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('admin.out_orders.total_games')}
              </div>
              <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stats.totalGames}
              </div>
            </div>
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('admin.out_orders.total_players')}
              </div>
              <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stats.totalPlayers}
              </div>
            </div>
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('admin.out_orders.total_revenue')}
              </div>
              <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ₪{stats.totalRevenue.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        {orders.length > 0 && (
          <div className={`mb-4 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('admin.out_orders.search_placeholder')}
                className={`w-full pl-10 pr-10 py-2 rounded-lg border ${
                  isDark ? 'border-gray-700 bg-gray-900 text-white placeholder-gray-400' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Actions Bar */}
        {orders.length > 0 && (
          <div className={`mb-4 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAllOrders}
                className={`px-3 py-1 rounded text-sm ${
                  isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                {t('admin.out_orders.select_all')}
              </button>
              <button
                onClick={handleDeselectAllOrders}
                className={`px-3 py-1 rounded text-sm ${
                  isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                {t('admin.out_orders.deselect_all')}
              </button>
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {selectedOrders.size} {t('admin.out_orders.selected')}
              </span>
            </div>

            {selectedOrders.size > 0 && (
              <button
                onClick={handleDeleteClick}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t('admin.out_orders.delete_selected')}
              </button>
            )}
          </div>
        )}

        {/* Orders List */}
        {selectedBranches.length === 0 ? (
          <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('admin.out_orders.no_branch_selected')}
          </div>
        ) : loadingOrders ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          </div>
        ) : orders.length === 0 ? (
          <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('admin.out_orders.no_orders')}
          </div>
        ) : (() => {
          // Filter orders based on search query
          const filteredOrders = orders.filter(order => {
            if (!searchQuery) return true
            const query = searchQuery.toLowerCase()
            const clientName = `${order.customer_first_name} ${order.customer_last_name || ''}`.toLowerCase()
            const phone = order.customer_phone?.toLowerCase() || ''
            const email = order.customer_email?.toLowerCase() || ''
            const reference = order.request_reference?.toLowerCase() || ''

            return clientName.includes(query) ||
                   phone.includes(query) ||
                   email.includes(query) ||
                   reference.includes(query)
          })

          return filteredOrders.length === 0 ? (
            <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('admin.out_orders.no_results')}
            </div>
          ) : (
            <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
              {/* Header */}
              <div className={`grid grid-cols-12 gap-2 px-4 py-3 border-b ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'} text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <div className="col-span-1">Select</div>
                <div className="col-span-2">Référence</div>
                <div className="col-span-2">Client</div>
                <div className="col-span-1">Date</div>
                <div className="col-span-1">Joueurs</div>
                <div className="col-span-1">Parties</div>
                <div className="col-span-2">Source</div>
                <div className="col-span-2">Actions</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-gray-700">
                {filteredOrders.map(order => (
                <div
                  key={order.id}
                  className={`grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-700/30 transition-colors ${
                    selectedOrders.has(order.id) ? 'bg-purple-900/20' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <div className="col-span-1">
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(order.id)}
                      onChange={() => handleToggleOrderSelection(order.id)}
                      className="w-4 h-4"
                    />
                  </div>

                  {/* Référence */}
                  <div className={`col-span-2 font-mono text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    {order.request_reference}
                  </div>

                  {/* Client */}
                  <div className="col-span-2">
                    <div className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {order.customer_first_name} {order.customer_last_name || ''}
                    </div>
                    <div className="text-xs text-gray-500">{order.customer_phone}</div>
                  </div>

                  {/* Date */}
                  <div className={`col-span-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {order.booking ? new Date(order.booking.start_datetime).toLocaleDateString() : '-'}
                  </div>

                  {/* Players */}
                  <div className={`col-span-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {order.booking?.participants_count || '-'}
                  </div>

                  {/* Games */}
                  <div className={`col-span-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {order.number_of_games || '-'}
                  </div>

                  {/* Source */}
                  <div className="col-span-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      order.source === 'admin_agenda'
                        ? isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                        : order.source === 'public_booking'
                        ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                        : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {order.source === 'admin_agenda' ? 'Admin' : order.source === 'public_booking' ? 'Site' : 'N/A'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2">
                    <button
                      onClick={() => handleToggleIn(order.id)}
                      className="px-3 py-1 rounded text-xs bg-green-500 text-white hover:bg-green-600"
                    >
                      Mark IN
                    </button>
                  </div>
                </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-md mx-4 p-6 rounded-2xl shadow-2xl ${
            isDark ? 'bg-gray-900' : 'bg-white'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-xl bg-red-900/30`}>
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {deleteConfirmStep === 1 ? t('admin.out_orders.delete_confirm_title_1') : t('admin.out_orders.delete_confirm_title_2')}
                </h3>
              </div>
            </div>

            {deleteConfirmStep === 1 ? (
              <>
                <p className={`mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('admin.out_orders.delete_confirm_message', { count: selectedOrders.size })}
                </p>

                <div className={`mb-4 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteContact}
                      onChange={(e) => setDeleteContact(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-gray-300"
                    />
                    <div>
                      <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('admin.out_orders.delete_contact_too')}
                      </span>
                      <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {t('admin.out_orders.delete_contact_description')}
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                      isDark
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    {t('admin.out_orders.cancel')}
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    className="flex-1 py-2 px-4 rounded-lg font-medium bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {t('admin.out_orders.continue')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={`mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('admin.out_orders.delete_final_warning')}
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirmStep(1)}
                    disabled={isDeleting}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                      isDark
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    {t('admin.out_orders.back')}
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 ${
                      isDeleting
                        ? 'bg-gray-400 cursor-not-allowed text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('admin.out_orders.deleting')}
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        {t('admin.out_orders.confirm_delete')}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
