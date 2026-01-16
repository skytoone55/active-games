'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ShoppingCart, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Phone,
  Mail,
  Users,
  Calendar,
  MapPin,
  Filter,
  RefreshCw,
  ChevronDown,
  ExternalLink,
  Gamepad2,
  Target,
  Cake
} from 'lucide-react'
import { useOrders } from '@/hooks/useOrders'
import { useBranches } from '@/hooks/useBranches'
import type { OrderWithRelations, OrderStatus } from '@/lib/supabase/types'

export default function OrdersPage() {
  const router = useRouter()
  const { branches, loading: branchesLoading } = useBranches()
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [isDark, setIsDark] = useState(true)
  
  const { 
    orders, 
    loading, 
    error, 
    stats, 
    pendingCount,
    confirmOrder, 
    cancelOrder,
    refresh 
  } = useOrders(selectedBranchId)

  // Sélectionner la première branche par défaut
  useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branches[0].id)
    }
  }, [branches, selectedBranchId])

  // Filtrer les commandes par statut
  const filteredOrders = statusFilter === 'all' 
    ? orders 
    : orders.filter(o => o.status === statusFilter)

  // Formater la date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  // Formater l'heure
  const formatTime = (time: string) => {
    return time.slice(0, 5)
  }

  // Obtenir l'icône et la couleur du statut
  const getStatusDisplay = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return { 
          icon: Clock, 
          color: 'text-yellow-500', 
          bg: 'bg-yellow-500/10', 
          border: 'border-yellow-500/30',
          label: 'En attente'
        }
      case 'auto_confirmed':
        return { 
          icon: CheckCircle, 
          color: 'text-green-500', 
          bg: 'bg-green-500/10', 
          border: 'border-green-500/30',
          label: 'Confirmé auto'
        }
      case 'manually_confirmed':
        return { 
          icon: CheckCircle, 
          color: 'text-blue-500', 
          bg: 'bg-blue-500/10', 
          border: 'border-blue-500/30',
          label: 'Confirmé manuel'
        }
      case 'cancelled':
        return { 
          icon: XCircle, 
          color: 'text-red-500', 
          bg: 'bg-red-500/10', 
          border: 'border-red-500/30',
          label: 'Annulé'
        }
      default:
        return { 
          icon: AlertCircle, 
          color: 'text-gray-500', 
          bg: 'bg-gray-500/10', 
          border: 'border-gray-500/30',
          label: status
        }
    }
  }

  // Obtenir l'icône du type de commande
  const getTypeIcon = (orderType: string, gameArea: string | null) => {
    if (orderType === 'EVENT') return Cake
    if (gameArea === 'LASER') return Target
    return Gamepad2
  }

  const handleConfirm = async (orderId: string) => {
    if (confirm('Confirmer cette commande et créer la réservation ?')) {
      await confirmOrder(orderId)
    }
  }

  const handleCancel = async (orderId: string) => {
    if (confirm('Annuler cette commande ?')) {
      await cancelOrder(orderId)
    }
  }

  if (branchesLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ShoppingCart className="w-6 h-6 text-cyan-500" />
            <h1 className="text-xl font-bold">Commandes en ligne</h1>
            {pendingCount > 0 && (
              <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full">
                {pendingCount} en attente
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Sélecteur de branche */}
            <select
              value={selectedBranchId || ''}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className={`px-3 py-2 rounded-lg border ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            
            {/* Bouton refresh */}
            <button
              onClick={() => refresh()}
              className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            
            {/* Navigation */}
            <nav className="flex items-center gap-2">
              <Link 
                href="/admin" 
                className={`px-3 py-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                Agenda
              </Link>
              <Link 
                href="/admin/clients" 
                className={`px-3 py-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                Clients
              </Link>
              <Link 
                href="/admin/orders" 
                className={`px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-400`}
              >
                Commandes
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total</div>
          </div>
          <div className={`p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30`}>
            <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
            <div className="text-sm text-yellow-500/70">En attente</div>
          </div>
          <div className={`p-4 rounded-xl bg-green-500/10 border border-green-500/30`}>
            <div className="text-2xl font-bold text-green-500">{stats.auto_confirmed}</div>
            <div className="text-sm text-green-500/70">Confirmés auto</div>
          </div>
          <div className={`p-4 rounded-xl bg-blue-500/10 border border-blue-500/30`}>
            <div className="text-2xl font-bold text-blue-500">{stats.manually_confirmed}</div>
            <div className="text-sm text-blue-500/70">Confirmés manuel</div>
          </div>
          <div className={`p-4 rounded-xl bg-red-500/10 border border-red-500/30`}>
            <div className="text-2xl font-bold text-red-500">{stats.cancelled}</div>
            <div className="text-sm text-red-500/70">Annulés</div>
          </div>
        </div>

        {/* Conversion Rate */}
        {stats.total > 0 && (
          <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Taux de conversion</span>
              <span className="text-2xl font-bold text-cyan-500">
                {Math.round(((stats.auto_confirmed + stats.manually_confirmed) / stats.total) * 100)}%
              </span>
            </div>
            <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-cyan-500 rounded-full"
                style={{ width: `${((stats.auto_confirmed + stats.manually_confirmed) / stats.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 mb-6">
          <Filter className="w-4 h-4 text-gray-400" />
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              statusFilter === 'all' 
                ? 'bg-cyan-500 text-white' 
                : isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              statusFilter === 'pending' 
                ? 'bg-yellow-500 text-black' 
                : isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
            }`}
          >
            En attente
          </button>
          <button
            onClick={() => setStatusFilter('auto_confirmed')}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              statusFilter === 'auto_confirmed' 
                ? 'bg-green-500 text-white' 
                : isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Confirmés auto
          </button>
          <button
            onClick={() => setStatusFilter('manually_confirmed')}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              statusFilter === 'manually_confirmed' 
                ? 'bg-blue-500 text-white' 
                : isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Confirmés manuel
          </button>
          <button
            onClick={() => setStatusFilter('cancelled')}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              statusFilter === 'cancelled' 
                ? 'bg-red-500 text-white' 
                : isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Annulés
          </button>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : filteredOrders.length === 0 ? (
          <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Aucune commande trouvée
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const statusDisplay = getStatusDisplay(order.status)
              const StatusIcon = statusDisplay.icon
              const TypeIcon = getTypeIcon(order.order_type, order.game_area)
              
              return (
                <div 
                  key={order.id}
                  className={`p-4 rounded-xl border ${statusDisplay.border} ${statusDisplay.bg} ${
                    isDark ? 'bg-opacity-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    {/* Left: Order Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <TypeIcon className={`w-5 h-5 ${statusDisplay.color}`} />
                        <span className="font-bold text-lg">
                          {order.customer_first_name} {order.customer_last_name}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusDisplay.bg} ${statusDisplay.color} border ${statusDisplay.border}`}>
                          <StatusIcon className="w-3 h-3 inline mr-1" />
                          {statusDisplay.label}
                        </span>
                        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {order.request_reference}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{formatDate(order.requested_date)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span>{formatTime(order.requested_time)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span>{order.participants_count} personnes</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TypeIcon className="w-4 h-4 text-gray-400" />
                          <span>
                            {order.order_type === 'EVENT' ? 'Événement' : order.game_area || 'Game'}
                            {order.number_of_games && order.number_of_games > 1 && ` (${order.number_of_games} parties)`}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <a 
                          href={`tel:${order.customer_phone}`}
                          className="flex items-center gap-1 text-cyan-400 hover:underline"
                        >
                          <Phone className="w-3 h-3" />
                          {order.customer_phone}
                        </a>
                        {order.customer_email && (
                          <a 
                            href={`mailto:${order.customer_email}`}
                            className="flex items-center gap-1 text-cyan-400 hover:underline"
                          >
                            <Mail className="w-3 h-3" />
                            {order.customer_email}
                          </a>
                        )}
                      </div>
                      
                      {order.pending_reason && (
                        <div className="mt-2 text-sm text-yellow-500">
                          <AlertCircle className="w-3 h-3 inline mr-1" />
                          Raison: {order.pending_reason}
                          {order.pending_details && ` - ${order.pending_details}`}
                        </div>
                      )}
                      
                      {order.customer_notes && (
                        <div className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Note: {order.customer_notes}
                        </div>
                      )}
                    </div>
                    
                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleConfirm(order.id)}
                            className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
                          >
                            Confirmer
                          </button>
                          <button
                            onClick={() => handleCancel(order.id)}
                            className="px-3 py-1.5 bg-red-500/20 text-red-500 rounded-lg text-sm font-medium hover:bg-red-500/30"
                          >
                            Annuler
                          </button>
                        </>
                      )}
                      
                      {(order.status === 'auto_confirmed' || order.status === 'manually_confirmed') && order.booking && (
                        <Link
                          href={`/admin?booking=${order.booking.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/30"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Voir réservation
                        </Link>
                      )}
                      
                      {order.contact && (
                        <Link
                          href={`/admin/clients?contact=${order.contact.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/30"
                        >
                          <Users className="w-3 h-3" />
                          Fiche client
                        </Link>
                      )}
                    </div>
                  </div>
                  
                  {/* Footer: Timestamps */}
                  <div className={`mt-3 pt-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Créée le {new Date(order.created_at).toLocaleString('fr-FR')}
                    {order.processed_at && ` • Traitée le ${new Date(order.processed_at).toLocaleString('fr-FR')}`}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
