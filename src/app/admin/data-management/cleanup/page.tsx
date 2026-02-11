'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, Loader2, CheckCircle, Database, Users, Calendar, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { useAdmin } from '@/contexts/AdminContext'
import { useTranslation } from '@/contexts/LanguageContext'

interface DataCounts {
  logs: number
  emails: number
  orders: number
  bookings: number
  game_sessions: number
  booking_slots: number
  contacts: number
}

interface DeletionGroup {
  id: 'logs' | 'reservations' | 'contacts'
  label: string
  description: string
  icon: React.ReactNode
  tables: string[]
  color: string
  requiresReservationsDeletion?: boolean
}

export default function DataCleanupPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user, branches, isDark } = useAdmin()

  const [counts, setCounts] = useState<DataCounts | null>(null)
  const [loadingCounts, setLoadingCounts] = useState(true)
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [showBranchSelector, setShowBranchSelector] = useState(false)

  // Deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<DeletionGroup | null>(null)
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<1 | 2>(1)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletionSuccess, setDeletionSuccess] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // Redirect non super_admin users
  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      router.push('/admin')
    }
  }, [user, router])

  // Load counts when branches are selected
  useEffect(() => {
    if (selectedBranches.length > 0) {
      fetchCounts()
    } else {
      setCounts(null)
    }
  }, [selectedBranches])

  // Initialize selectedBranches with all branches
  useEffect(() => {
    if (branches.length > 0 && selectedBranches.length === 0) {
      setSelectedBranches(branches.map(b => b.id))
    }
  }, [branches])

  const fetchCounts = async () => {
    setLoadingCounts(true)
    try {
      const response = await fetch('/api/admin/data-management/counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchIds: selectedBranches })
      })
      const data = await response.json()
      if (data.success) {
        setCounts(data.counts)
      }
    } catch (error) {
      console.error('Error fetching counts:', error)
    } finally {
      setLoadingCounts(false)
    }
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

  const deletionGroups: DeletionGroup[] = [
    {
      id: 'logs',
      label: t('admin.data_management.logs_group'),
      description: t('admin.data_management.logs_description'),
      icon: <FileText className="w-6 h-6" />,
      tables: ['activity_logs', 'email_logs'],
      color: 'yellow'
    },
    {
      id: 'reservations',
      label: t('admin.data_management.reservations_group'),
      description: t('admin.data_management.reservations_description'),
      icon: <Calendar className="w-6 h-6" />,
      tables: ['orders', 'bookings', 'game_sessions', 'booking_slots'],
      color: 'orange'
    },
    {
      id: 'contacts',
      label: t('admin.data_management.contacts_group'),
      description: t('admin.data_management.contacts_description'),
      icon: <Users className="w-6 h-6" />,
      tables: ['contacts'],
      color: 'red',
      requiresReservationsDeletion: true
    }
  ]

  const handleDeleteClick = (group: DeletionGroup) => {
    // Check if contacts deletion requires reservations to be deleted first
    if (group.requiresReservationsDeletion && counts) {
      const hasReservations = (counts.orders + counts.bookings + counts.game_sessions + counts.booking_slots) > 0
      if (hasReservations) {
        setErrorMessage(t('admin.data_management.delete_reservations_first'))
        setTimeout(() => setErrorMessage(null), 5000)
        return
      }
    }

    // Open modal for confirmation
    setSelectedGroup(group)
    setDeleteConfirmStep(1)
    setShowDeleteModal(true)
  }

  const handleConfirmDeletion = async () => {
    if (!selectedGroup) return

    if (deleteConfirmStep === 1) {
      setDeleteConfirmStep(2)
      return
    }

    // Step 2 - Validate password and delete
    if (!password) {
      setPasswordError(t('admin.data_management.password_required'))
      return
    }

    setPasswordError('')
    setIsDeleting(true)

    try {
      const response = await fetch('/api/admin/data-management/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group: selectedGroup.id,
          branchIds: selectedBranches,
          password: password
        })
      })

      const data = await response.json()

      if (!data.success) {
        if (data.error?.includes('Mot de passe')) {
          setPasswordError(data.error)
          setIsDeleting(false)
        } else {
          setErrorMessage(data.error || t('admin.data_management.error'))
          setIsDeleting(false)
          setShowDeleteModal(false)
          setTimeout(() => setErrorMessage(null), 5000)
        }
        return
      }

      // Calculate total deleted
      const deleted = data.deleted || {}
      const totalDeleted = Object.values(deleted).reduce((sum: number, val) => sum + (val as number), 0)

      // Success
      setDeletionSuccess(t('admin.data_management.deletion_success', {
        label: selectedGroup.label,
        count: totalDeleted.toString()
      }))

      // Refresh counts
      await fetchCounts()

      // Hide success message after 3 seconds
      setTimeout(() => setDeletionSuccess(null), 3000)

    } catch (error) {
      console.error('Error deleting data:', error)
      setErrorMessage(t('admin.data_management.server_error'))
      setTimeout(() => setErrorMessage(null), 5000)
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
      setDeleteConfirmStep(1)
      setSelectedGroup(null)
      setPassword('')
      setPasswordError('')
    }
  }

  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    )
  }

  if (user.role !== 'super_admin') {
    return null
  }

  const getGroupCount = (group: DeletionGroup): number => {
    if (!counts) return 0
    switch (group.id) {
      case 'logs':
        return counts.logs + counts.emails
      case 'reservations':
        return counts.orders + counts.bookings + counts.game_sessions + counts.booking_slots
      case 'contacts':
        return counts.contacts
      default:
        return 0
    }
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-3 rounded-xl ${isDark ? 'bg-red-900/30' : 'bg-red-100'}`}>
              <Database className={`w-8 h-8 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('admin.data_management.cleanup_title')}
              </h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('admin.data_management.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        <div className={`mb-6 p-4 rounded-xl border-2 ${
          isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-6 h-6 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
            <div>
              <h3 className={`font-semibold ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                {t('admin.data_management.warning_title')}
              </h3>
              <p className={`text-sm mt-1 ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                {t('admin.data_management.warning_message')}
              </p>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {deletionSuccess && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
          }`}>
            <CheckCircle className="w-5 h-5" />
            {deletionSuccess}
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
          }`}>
            <AlertTriangle className="w-5 h-5" />
            {errorMessage}
          </div>
        )}

        {/* Branch Selector */}
        <div className={`mb-6 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <button
            onClick={() => setShowBranchSelector(!showBranchSelector)}
            className={`w-full flex items-center justify-between ${isDark ? 'text-white' : 'text-gray-900'}`}
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{t('admin.data_management.branches_selected')}</span>
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
                  {t('admin.data_management.select_all')}
                </button>
                <button
                  onClick={deselectAllBranches}
                  className={`px-3 py-1 rounded text-sm ${
                    isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  {t('admin.data_management.deselect_all')}
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

        {/* Deletion Groups */}
        {selectedBranches.length === 0 ? (
          <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('admin.data_management.no_branch_selected')}
          </div>
        ) : loadingCounts ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
        ) : (
          <div className="space-y-4">
            {deletionGroups.map(group => {
              const count = getGroupCount(group)
              const isDisabled = count === 0 || (group.requiresReservationsDeletion && counts &&
                (counts.orders + counts.bookings + counts.game_sessions + counts.booking_slots) > 0)

              return (
                <div
                  key={group.id}
                  className={`p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${
                        group.color === 'yellow'
                          ? isDark ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-600'
                          : group.color === 'orange'
                            ? isDark ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-600'
                            : isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600'
                      }`}>
                        {group.icon}
                      </div>
                      <div>
                        <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {group.label}
                        </h3>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {group.description}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {t('admin.data_management.tables')}: {group.tables.join(', ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className={`text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <span className="text-2xl font-bold">{count.toLocaleString()}</span>
                        <span className="text-sm ml-1">{t('admin.data_management.items')}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteClick(group)}
                        disabled={isDisabled || isDeleting}
                        className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                          isDisabled
                            ? 'bg-gray-400 cursor-not-allowed opacity-50 text-white'
                            : isDeleting
                              ? 'bg-red-400 cursor-wait text-white'
                              : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        {t('admin.data_management.delete_button')}
                      </button>
                    </div>
                  </div>

                  {group.requiresReservationsDeletion && counts &&
                    (counts.orders + counts.bookings + counts.game_sessions + counts.booking_slots) > 0 && (
                    <p className={`mt-2 text-sm ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                      {t('admin.data_management.delete_reservations_first_warning')}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Counts Details */}
        {counts && selectedBranches.length > 0 && (
          <div className={`mt-6 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('admin.data_management.data_details')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                <span className="font-medium">{t('admin.data_management.activity_logs')}:</span> {counts.logs.toLocaleString()}
              </div>
              <div className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                <span className="font-medium">{t('admin.data_management.email_logs')}:</span> {counts.emails.toLocaleString()}
              </div>
              <div className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                <span className="font-medium">{t('admin.data_management.orders')}:</span> {counts.orders.toLocaleString()}
              </div>
              <div className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                <span className="font-medium">{t('admin.data_management.bookings')}:</span> {counts.bookings.toLocaleString()}
              </div>
              <div className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                <span className="font-medium">{t('admin.data_management.game_sessions')}:</span> {counts.game_sessions.toLocaleString()}
              </div>
              <div className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                <span className="font-medium">{t('admin.data_management.booking_slots')}:</span> {counts.booking_slots.toLocaleString()}
              </div>
              <div className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                <span className="font-medium">{t('admin.data_management.contacts')}:</span> {counts.contacts.toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedGroup && (
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
                  {deleteConfirmStep === 1
                    ? t('admin.data_management.confirm_title')
                    : t('admin.data_management.confirm_title')}
                </h3>
              </div>
            </div>

            {deleteConfirmStep === 1 ? (
              <>
                <p className={`mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('admin.data_management.confirm_message')}
                </p>

                <div className={`mb-4 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <div className="flex justify-between items-center">
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {selectedGroup.label}
                    </span>
                    <span className={`font-bold text-lg ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                      {getGroupCount(selectedGroup).toLocaleString()} {t('admin.data_management.items')}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false)
                      setDeleteConfirmStep(1)
                      setSelectedGroup(null)
                      setPassword('')
                      setPasswordError('')
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                      isDark
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    {t('admin.data_management.cancel')}
                  </button>
                  <button
                    onClick={handleConfirmDeletion}
                    className="flex-1 py-2 px-4 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white"
                  >
                    {t('admin.data_management.confirm_delete')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={`mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('admin.data_management.confirm_message')}
                </p>

                <div className={`mb-4 p-3 rounded-lg border-2 ${
                  isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
                }`}>
                  <p className={`font-bold ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                    {getGroupCount(selectedGroup).toLocaleString()} {selectedGroup.label}
                  </p>
                </div>

                <div className="mb-4">
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('admin.data_management.enter_password')}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setPasswordError('')
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleConfirmDeletion()}
                    placeholder={t('admin.data_management.password_placeholder')}
                    className={`w-full px-4 py-3 rounded-lg border ${
                      passwordError
                        ? 'border-red-500'
                        : isDark ? 'border-gray-700 bg-gray-800 text-white' : 'border-gray-300 bg-white text-gray-900'
                    }`}
                    autoFocus
                  />
                  {passwordError && (
                    <p className="mt-2 text-sm text-red-500">{passwordError}</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setDeleteConfirmStep(1)
                      setPassword('')
                      setPasswordError('')
                    }}
                    disabled={isDeleting}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                      isDark
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    {t('admin.data_management.cancel')}
                  </button>
                  <button
                    onClick={handleConfirmDeletion}
                    disabled={isDeleting || !password}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 ${
                      isDeleting || !password
                        ? 'bg-red-400 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700'
                    } text-white`}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('admin.data_management.deleting')}
                      </>
                    ) : (
                      t('admin.data_management.confirm_delete')
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
