'use client'

import { useState, useEffect } from 'react'
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Plus,
  Edit2,
  Trash2,
  Package,
  Calculator,
  Home,
  Save,
  X,
  RefreshCw,
} from 'lucide-react'
import { useBranches } from '@/hooks/useBranches'
import { useTranslation } from '@/contexts/LanguageContext'

interface ICountCatalogSectionProps {
  isDark: boolean
}

// Types simplifiés
interface ICountProduct {
  id: string
  branch_id: string
  code: string
  name: string
  name_he: string | null
  name_en: string | null
  unit_price: number
  is_active: boolean
  sort_order: number
}

interface ICountRoom {
  id: string
  branch_id: string
  code: string
  name: string
  name_he: string | null
  name_en: string | null
  price: number
  is_active: boolean
  sort_order: number
}

interface ICountEventFormula {
  id: string
  branch_id: string
  name: string
  game_type: 'LASER' | 'ACTIVE' | 'BOTH'
  min_participants: number
  max_participants: number
  price_per_person: number
  room_id: string | null
  is_active: boolean
  priority: number
  // Joined
  room?: ICountRoom | null
}

type ActiveTab = 'products' | 'rooms' | 'formulas'

// Helper function to get localized name
function getLocalizedName(
  item: { name: string; name_he: string | null; name_en: string | null },
  locale: string
): string {
  if (locale === 'he' && item.name_he) return item.name_he
  if (locale === 'en' && item.name_en) return item.name_en
  return item.name // Default to French name
}

export function ICountCatalogSection({ isDark }: ICountCatalogSectionProps) {
  const { selectedBranch } = useBranches()
  const { t, locale } = useTranslation()

  const GAME_TYPES = [
    { value: 'LASER', label: t('admin.icount_catalog.game_types.laser'), color: 'bg-blue-500' },
    { value: 'ACTIVE', label: t('admin.icount_catalog.game_types.active'), color: 'bg-green-500' },
    { value: 'BOTH', label: t('admin.icount_catalog.game_types.both'), color: 'bg-purple-500' },
  ]

  const [activeTab, setActiveTab] = useState<ActiveTab>('products')
  const [products, setProducts] = useState<ICountProduct[]>([])
  const [rooms, setRooms] = useState<ICountRoom[]>([])
  const [formulas, setFormulas] = useState<ICountEventFormula[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Modal states
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ICountProduct | null>(null)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<ICountRoom | null>(null)
  const [showFormulaModal, setShowFormulaModal] = useState(false)
  const [editingFormula, setEditingFormula] = useState<ICountEventFormula | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Sync all products to iCount
  const handleSyncToICount = async () => {
    if (!selectedBranch) return

    setSyncing(true)
    setError(null)

    try {
      const response = await fetch('/api/icount-products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: selectedBranch.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur de synchronisation')
      }

      if (result.synced > 0 || result.failed > 0) {
        if (result.failed > 0) {
          setSuccessMessage(t('admin.icount_catalog.sync.success_with_failures', { synced: result.synced, failed: result.failed }))
        } else {
          setSuccessMessage(t('admin.icount_catalog.sync.success', { synced: result.synced }))
        }
      } else {
        setSuccessMessage(t('admin.icount_catalog.sync.no_products'))
      }

      // Refresh data to show updated sync status
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSyncing(false)
    }
  }

  // Fetch data
  const fetchData = async () => {
    if (!selectedBranch) return

    setLoading(true)
    setError(null)

    try {
      // Add cache-busting timestamp to prevent stale data
      const ts = Date.now()
      const [productsRes, roomsRes, formulasRes] = await Promise.all([
        fetch(`/api/icount-products?branchId=${selectedBranch.id}&includeInactive=true&_t=${ts}`),
        fetch(`/api/icount-rooms?branchId=${selectedBranch.id}&includeInactive=true&_t=${ts}`),
        fetch(`/api/icount-event-formulas?branchId=${selectedBranch.id}&includeInactive=true&_t=${ts}`),
      ])

      const productsData = productsRes.ok ? await productsRes.json() : { data: [] }
      const roomsData = roomsRes.ok ? await roomsRes.json() : { data: [] }
      const formulasData = formulasRes.ok ? await formulasRes.json() : { data: [] }

      setProducts(productsData.data || [])
      setRooms(roomsData.data || [])
      setFormulas(formulasData.data || [])
    } catch (err) {
      console.error('Error fetching catalog data:', err)
      setError('Erreur lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedBranch?.id])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // Save handlers
  const handleSaveProduct = async (data: Partial<ICountProduct>) => {
    if (!selectedBranch) return
    setSaving(true)
    setError(null)

    try {
      const isNew = !editingProduct?.id
      const url = isNew ? '/api/icount-products' : `/api/icount-products/${editingProduct.id}`

      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, branch_id: selectedBranch.id }),
      })

      if (!response.ok) {
        const res = await response.json()
        throw new Error(res.error || 'Erreur')
      }

      setSuccessMessage(isNew ? 'Produit créé' : 'Produit mis à jour')
      setShowProductModal(false)
      setEditingProduct(null)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRoom = async (data: Partial<ICountRoom>) => {
    if (!selectedBranch) return
    setSaving(true)
    setError(null)

    try {
      const isNew = !editingRoom?.id
      const url = isNew ? '/api/icount-rooms' : `/api/icount-rooms/${editingRoom.id}`

      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, branch_id: selectedBranch.id }),
      })

      if (!response.ok) {
        const res = await response.json()
        throw new Error(res.error || 'Erreur')
      }

      setSuccessMessage(isNew ? 'Salle créée' : 'Salle mise à jour')
      setShowRoomModal(false)
      setEditingRoom(null)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveFormula = async (data: Partial<ICountEventFormula>) => {
    if (!selectedBranch) return
    setSaving(true)
    setError(null)

    try {
      const isNew = !editingFormula?.id
      const url = isNew ? '/api/icount-event-formulas' : `/api/icount-event-formulas/${editingFormula.id}`

      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, branch_id: selectedBranch.id }),
      })

      if (!response.ok) {
        const res = await response.json()
        throw new Error(res.error || 'Erreur')
      }

      setSuccessMessage(isNew ? 'Formule créée' : 'Formule mise à jour')
      setShowFormulaModal(false)
      setEditingFormula(null)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  // Delete handlers
  const handleDelete = async (type: 'product' | 'room' | 'formula', id: string) => {
    if (!confirm('Voulez-vous désactiver cet élément?')) return

    try {
      const endpoints = {
        product: '/api/icount-products',
        room: '/api/icount-rooms',
        formula: '/api/icount-event-formulas',
      }
      const response = await fetch(`${endpoints[type]}/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Erreur')
      setSuccessMessage('Élément désactivé')
      fetchData()
    } catch {
      setError('Erreur lors de la suppression')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {t('admin.icount_catalog.title')}
        </h2>
        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {t('admin.icount_catalog.subtitle', { branch: selectedBranch?.name || '' })}
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className={`flex items-center gap-2 p-3 rounded-lg ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className={`flex items-center gap-2 p-3 rounded-lg ${isDark ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'}`}>
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <p className="text-green-500 text-sm">{successMessage}</p>
        </div>
      )}

      {/* Tabs */}
      <div className={`flex gap-1 p-1 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <TabButton
          active={activeTab === 'products'}
          onClick={() => setActiveTab('products')}
          isDark={isDark}
          icon={<Package className="w-4 h-4" />}
          label={`${t('admin.icount_catalog.tabs.products')} (${products.length})`}
        />
        <TabButton
          active={activeTab === 'rooms'}
          onClick={() => setActiveTab('rooms')}
          isDark={isDark}
          icon={<Home className="w-4 h-4" />}
          label={`${t('admin.icount_catalog.tabs.rooms')} (${rooms.length})`}
        />
        <TabButton
          active={activeTab === 'formulas'}
          onClick={() => setActiveTab('formulas')}
          isDark={isDark}
          icon={<Calculator className="w-4 h-4" />}
          label={`${t('admin.icount_catalog.tabs.formulas')} (${formulas.length})`}
        />
      </div>

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setEditingProduct(null); setShowProductModal(true) }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Plus className="w-4 h-4" />
              {t('admin.icount_catalog.products.add')}
            </button>
            <button
              onClick={handleSyncToICount}
              disabled={syncing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${isDark ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white disabled:opacity-50`}
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {syncing ? t('admin.icount_catalog.sync.syncing') : t('admin.icount_catalog.sync.button')}
            </button>
          </div>

          <div className={`rounded-xl border-2 overflow-hidden ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
            <table className="w-full">
              <thead>
                <tr className={isDark ? 'bg-gray-700/50' : 'bg-gray-50'}>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.icount_catalog.products.code')}</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.icount_catalog.products.price_per_person')}</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.icount_catalog.products.status')}</th>
                  <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.icount_catalog.products.actions')}</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {products.map(product => (
                  <tr key={product.id} className={!product.is_active ? 'opacity-50' : ''}>
                    <td className={`px-4 py-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <div className="font-medium" dir={locale === 'he' ? 'rtl' : 'ltr'}>
                        {getLocalizedName(product, locale)}
                      </div>
                      <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {product.code}
                      </div>
                    </td>
                    <td className={`px-4 py-3 font-semibold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                      ₪{product.unit_price}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={product.is_active} isDark={isDark} activeLabel={t('admin.icount_catalog.status.active')} inactiveLabel={t('admin.icount_catalog.status.inactive')} />
                    </td>
                    <td className="px-4 py-3">
                      <ActionButtons
                        isDark={isDark}
                        onEdit={() => { setEditingProduct(product); setShowProductModal(true) }}
                        onDelete={() => handleDelete('product', product.id)}
                      />
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={4} className={`px-4 py-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {t('admin.icount_catalog.products.none')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rooms Tab */}
      {activeTab === 'rooms' && (
        <div className="space-y-4">
          <button
            onClick={() => { setEditingRoom(null); setShowRoomModal(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="w-4 h-4" />
            {t('admin.icount_catalog.rooms.add')}
          </button>

          <div className={`rounded-xl border-2 overflow-hidden ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
            <table className="w-full">
              <thead>
                <tr className={isDark ? 'bg-gray-700/50' : 'bg-gray-50'}>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.icount_catalog.rooms.code')}</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.icount_catalog.rooms.price')}</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.icount_catalog.rooms.status')}</th>
                  <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.icount_catalog.rooms.actions')}</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {rooms.map(room => (
                  <tr key={room.id} className={!room.is_active ? 'opacity-50' : ''}>
                    <td className={`px-4 py-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <div className="font-medium" dir={locale === 'he' ? 'rtl' : 'ltr'}>
                        {getLocalizedName(room, locale)}
                      </div>
                      <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {room.code}
                      </div>
                    </td>
                    <td className={`px-4 py-3 font-semibold ${room.price > 0 ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-gray-500' : 'text-gray-400')}`}>
                      {room.price > 0 ? `₪${room.price}` : t('admin.icount_catalog.rooms.free')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={room.is_active} isDark={isDark} activeLabel={t('admin.icount_catalog.status.active')} inactiveLabel={t('admin.icount_catalog.status.inactive')} />
                    </td>
                    <td className="px-4 py-3">
                      <ActionButtons
                        isDark={isDark}
                        onEdit={() => { setEditingRoom(room); setShowRoomModal(true) }}
                        onDelete={() => handleDelete('room', room.id)}
                      />
                    </td>
                  </tr>
                ))}
                {rooms.length === 0 && (
                  <tr>
                    <td colSpan={4} className={`px-4 py-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {t('admin.icount_catalog.rooms.none')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Formulas Tab */}
      {activeTab === 'formulas' && (
        <div className="space-y-4">
          <button
            onClick={() => { setEditingFormula(null); setShowFormulaModal(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="w-4 h-4" />
            {t('admin.icount_catalog.formulas.add')}
          </button>

          <div className={`rounded-xl border-2 overflow-hidden ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
            <table className="w-full">
              <thead>
                <tr className={isDark ? 'bg-gray-700/50' : 'bg-gray-50'}>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.icount_catalog.formulas.game_type')}</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.icount_catalog.formulas.participants')}</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.icount_catalog.formulas.price_per_person')}</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.icount_catalog.formulas.room')}</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.icount_catalog.formulas.status')}</th>
                  <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.icount_catalog.formulas.actions')}</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {formulas.map(formula => {
                  const room = rooms.find(r => r.id === formula.room_id)
                  const gameType = GAME_TYPES.find(g => g.value === formula.game_type)

                  return (
                    <tr key={formula.id} className={!formula.is_active ? 'opacity-50' : ''}>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full text-white ${gameType?.color || 'bg-gray-500'}`}>
                          {gameType?.label || formula.game_type}
                        </span>
                      </td>
                      <td className={`px-4 py-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {formula.min_participants} - {formula.max_participants === 999 ? '∞' : formula.max_participants}
                      </td>
                      <td className={`px-4 py-3 font-semibold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                        ₪{formula.price_per_person}
                      </td>
                      <td className={`px-4 py-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {room ? (
                          <span>
                            {room.name}
                            {room.price > 0 && <span className={`ml-1 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>(+₪{room.price})</span>}
                          </span>
                        ) : (
                          <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge active={formula.is_active} isDark={isDark} activeLabel={t('admin.icount_catalog.status.active')} inactiveLabel={t('admin.icount_catalog.status.inactive')} />
                      </td>
                      <td className="px-4 py-3">
                        <ActionButtons
                          isDark={isDark}
                          onEdit={() => { setEditingFormula(formula); setShowFormulaModal(true) }}
                          onDelete={() => handleDelete('formula', formula.id)}
                        />
                      </td>
                    </tr>
                  )
                })}
                {formulas.length === 0 && (
                  <tr>
                    <td colSpan={6} className={`px-4 py-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {t('admin.icount_catalog.formulas.none')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Formulas explanation */}
          <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800/50 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('admin.icount_catalog.formulas.calculation')}
            </p>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              {t('admin.icount_catalog.formulas.priority_info')}
            </p>
          </div>
        </div>
      )}

      {/* Modals */}
      {showProductModal && (
        <ProductModal
          isDark={isDark}
          product={editingProduct}
          saving={saving}
          onSave={handleSaveProduct}
          onClose={() => { setShowProductModal(false); setEditingProduct(null) }}
        />
      )}

      {showRoomModal && (
        <RoomModal
          isDark={isDark}
          room={editingRoom}
          saving={saving}
          onSave={handleSaveRoom}
          onClose={() => { setShowRoomModal(false); setEditingRoom(null) }}
        />
      )}

      {showFormulaModal && (
        <FormulaModal
          isDark={isDark}
          formula={editingFormula}
          rooms={rooms.filter(r => r.is_active)}
          gameTypes={GAME_TYPES}
          saving={saving}
          onSave={handleSaveFormula}
          onClose={() => { setShowFormulaModal(false); setEditingFormula(null) }}
        />
      )}
    </div>
  )
}

// Helper Components
function TabButton({ active, onClick, isDark, icon, label }: { active: boolean; onClick: () => void; isDark: boolean; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? isDark ? 'bg-orange-500 text-white' : 'bg-white text-orange-600 shadow'
          : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function StatusBadge({ active, isDark, activeLabel, inactiveLabel }: { active: boolean; isDark: boolean; activeLabel: string; inactiveLabel: string }) {
  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
      active
        ? isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
        : isDark ? 'bg-gray-600 text-gray-400' : 'bg-gray-200 text-gray-500'
    }`}>
      {active ? activeLabel : inactiveLabel}
    </span>
  )
}

function ActionButtons({ isDark, onEdit, onDelete }: { isDark: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={onEdit}
        className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
      >
        <Edit2 className="w-4 h-4" />
      </button>
      <button
        onClick={onDelete}
        className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'hover:bg-red-100 text-gray-500 hover:text-red-600'}`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

// Product Modal
function ProductModal({ isDark, product, saving, onSave, onClose }: {
  isDark: boolean
  product: ICountProduct | null
  saving: boolean
  onSave: (data: Partial<ICountProduct>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    code: product?.code || '',
    name: product?.name || '',
    name_he: product?.name_he || '',
    name_en: product?.name_en || '',
    unit_price: product?.unit_price?.toString() || '',
    sort_order: product?.sort_order?.toString() || '0',
    is_active: product?.is_active ?? true,
  })

  // Code is read-only for existing products (code is the key linking everything)
  const isEventProduct = product?.code?.startsWith('event_') || false
  const isEditing = !!product?.id

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      code: form.code,
      name: form.name,
      name_he: form.name_he || null,
      name_en: form.name_en || null,
      unit_price: parseFloat(form.unit_price),
      sort_order: parseInt(form.sort_order) || 0,
      is_active: form.is_active,
    })
  }

  return (
    <Modal isDark={isDark} title={product ? 'Edit Product' : 'New Product'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            isDark={isDark}
            label="Code"
            value={form.code}
            onChange={v => setForm(p => ({ ...p, code: v }))}
            required
            placeholder="laser_1"
            readOnly={isEditing}
            hint={isEditing ? (isEventProduct ? 'Auto-generated from formula' : 'Code cannot be changed') : undefined}
          />
          <Input isDark={isDark} label="Price/person (₪)" type="number" value={form.unit_price} onChange={v => setForm(p => ({ ...p, unit_price: v }))} required placeholder="70" />
        </div>
        <Input isDark={isDark} label="Name (EN)" value={form.name_en} onChange={v => setForm(p => ({ ...p, name_en: v }))} placeholder="Laser 1 game" />
        <Input isDark={isDark} label="Name (HE)" value={form.name_he} onChange={v => setForm(p => ({ ...p, name_he: v }))} placeholder="לייזר משחק 1" dir="rtl" />
        <Input isDark={isDark} label="Name (FR)" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} required placeholder="Laser 1 partie" />
        <div className="flex items-center gap-4">
          <Input isDark={isDark} label="Order" type="number" value={form.sort_order} onChange={v => setForm(p => ({ ...p, sort_order: v }))} className="w-24" />
          <Checkbox isDark={isDark} label="Active" checked={form.is_active} onChange={v => setForm(p => ({ ...p, is_active: v }))} />
        </div>
        <ModalFooter isDark={isDark} saving={saving} onClose={onClose} />
      </form>
    </Modal>
  )
}

// Room Modal
function RoomModal({ isDark, room, saving, onSave, onClose }: {
  isDark: boolean
  room: ICountRoom | null
  saving: boolean
  onSave: (data: Partial<ICountRoom>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    code: room?.code || '',
    name: room?.name || '',
    name_he: room?.name_he || '',
    name_en: room?.name_en || '',
    price: room?.price?.toString() || '0',
    sort_order: room?.sort_order?.toString() || '0',
    is_active: room?.is_active ?? true,
  })

  const isEditing = !!room?.id

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      code: form.code,
      name: form.name,
      name_he: form.name_he || null,
      name_en: form.name_en || null,
      price: parseFloat(form.price) || 0,
      sort_order: parseInt(form.sort_order) || 0,
      is_active: form.is_active,
    })
  }

  return (
    <Modal isDark={isDark} title={room ? 'Edit Room' : 'New Room'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input isDark={isDark} label="Code" value={form.code} onChange={v => setForm(p => ({ ...p, code: v }))} required placeholder="room_1" readOnly={isEditing} hint={isEditing ? 'Code cannot be changed' : undefined} />
          <Input isDark={isDark} label="Price (₪)" type="number" value={form.price} onChange={v => setForm(p => ({ ...p, price: v }))} placeholder="0 = free" />
        </div>
        <Input isDark={isDark} label="Name (EN)" value={form.name_en} onChange={v => setForm(p => ({ ...p, name_en: v }))} placeholder="Room 1" />
        <Input isDark={isDark} label="Name (HE)" value={form.name_he} onChange={v => setForm(p => ({ ...p, name_he: v }))} placeholder="חדר 1" dir="rtl" />
        <Input isDark={isDark} label="Name (FR)" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} required placeholder="Salle 1" />
        <div className="flex items-center gap-4">
          <Input isDark={isDark} label="Order" type="number" value={form.sort_order} onChange={v => setForm(p => ({ ...p, sort_order: v }))} className="w-24" />
          <Checkbox isDark={isDark} label="Active" checked={form.is_active} onChange={v => setForm(p => ({ ...p, is_active: v }))} />
        </div>
        <ModalFooter isDark={isDark} saving={saving} onClose={onClose} />
      </form>
    </Modal>
  )
}

// Formula Modal
function FormulaModal({ isDark, formula, rooms, gameTypes, saving, onSave, onClose }: {
  isDark: boolean
  formula: ICountEventFormula | null
  rooms: ICountRoom[]
  gameTypes: Array<{ value: string; label: string; color: string }>
  saving: boolean
  onSave: (data: Partial<ICountEventFormula>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    name: formula?.name || '',
    game_type: formula?.game_type || 'LASER',
    min_participants: formula?.min_participants?.toString() || '15',
    max_participants: formula?.max_participants?.toString() || '999',
    price_per_person: formula?.price_per_person?.toString() || '',
    room_id: formula?.room_id || '',
    priority: formula?.priority?.toString() || '0',
    is_active: formula?.is_active ?? true,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: form.name,
      game_type: form.game_type as 'LASER' | 'ACTIVE' | 'BOTH',
      min_participants: parseInt(form.min_participants) || 1,
      max_participants: parseInt(form.max_participants) || 999,
      price_per_person: parseFloat(form.price_per_person),
      room_id: form.room_id || null,
      priority: parseInt(form.priority) || 0,
      is_active: form.is_active,
    })
  }

  return (
    <Modal isDark={isDark} title={formula ? 'Edit Formula' : 'New EVENT Formula'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input isDark={isDark} label="Name" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} required placeholder="Laser 15-29 pers" />

        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Game Type
          </label>
          <div className="flex gap-2">
            {gameTypes.map(gt => (
              <button
                key={gt.value}
                type="button"
                onClick={() => setForm(p => ({ ...p, game_type: gt.value as 'LASER' | 'ACTIVE' | 'BOTH' }))}
                className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors ${
                  form.game_type === gt.value
                    ? `${gt.color} text-white`
                    : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {gt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input isDark={isDark} label="Min participants" type="number" value={form.min_participants} onChange={v => setForm(p => ({ ...p, min_participants: v }))} required />
          <Input isDark={isDark} label="Max participants" type="number" value={form.max_participants} onChange={v => setForm(p => ({ ...p, max_participants: v }))} placeholder="999 = unlimited" />
        </div>

        <Input isDark={isDark} label="Price per person (₪)" type="number" value={form.price_per_person} onChange={v => setForm(p => ({ ...p, price_per_person: v }))} required placeholder="110" />

        <div>
          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Room (optional)
          </label>
          <select
            value={form.room_id}
            onChange={e => setForm(p => ({ ...p, room_id: e.target.value }))}
            className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
          >
            <option value="">No room</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>
                {r.name} {r.price > 0 ? `(+₪${r.price})` : '(free)'}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <Input isDark={isDark} label="Priority" type="number" value={form.priority} onChange={v => setForm(p => ({ ...p, priority: v }))} className="w-24" />
          <Checkbox isDark={isDark} label="Active" checked={form.is_active} onChange={v => setForm(p => ({ ...p, is_active: v }))} />
        </div>

        <ModalFooter isDark={isDark} saving={saving} onClose={onClose} />
      </form>
    </Modal>
  )
}

// Shared Modal Components
function Modal({ isDark, title, onClose, children }: { isDark: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative w-full max-w-lg mx-4 rounded-xl shadow-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
          <button onClick={onClose} className={`p-1 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function Input({ isDark, label, value, onChange, required, placeholder, type = 'text', dir, className, readOnly, hint }: {
  isDark: boolean; label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string; type?: string; dir?: string; className?: string; readOnly?: boolean; hint?: string
}) {
  return (
    <div className={className}>
      <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        dir={dir}
        step={type === 'number' ? '0.01' : undefined}
        readOnly={readOnly}
        className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
      {hint && <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{hint}</p>}
    </div>
  )
}

function Checkbox({ isDark, label, checked, onChange }: { isDark: boolean; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer pt-6">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4 rounded" />
      <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{label}</span>
    </label>
  )
}

function ModalFooter({ isDark, saving, onClose }: { isDark: boolean; saving: boolean; onClose: () => void }) {
  return (
    <div className="flex justify-end gap-3 pt-4">
      <button
        type="button"
        onClick={onClose}
        className={`px-4 py-2 rounded-lg font-medium ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save
      </button>
    </div>
  )
}
