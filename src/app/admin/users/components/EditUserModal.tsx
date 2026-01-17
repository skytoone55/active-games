'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, User, Phone, Shield, Building2, AlertCircle, Save } from 'lucide-react'
import type { UserWithBranches, UserRole, Branch } from '@/lib/supabase/types'
import { validateIsraeliPhone, VALIDATION_MESSAGES } from '@/lib/validation'

interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (userId: string, data: {
    first_name?: string
    last_name?: string
    phone?: string
    role?: UserRole
    branch_ids?: string[]
  }) => Promise<{ success: boolean; error?: string }>
  user: UserWithBranches | null
  branches: Branch[]
  currentUserRole: UserRole
  currentUserBranchIds: string[]
  isDark: boolean
}

export function EditUserModal({
  isOpen,
  onClose,
  onSubmit,
  user,
  branches,
  currentUserRole,
  currentUserBranchIds,
  isDark,
}: EditUserModalProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<UserRole>('agent')
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{ phone?: string }>({})

  // Initialiser avec les données de l'utilisateur
  useEffect(() => {
    if (isOpen && user) {
      setFirstName(user.first_name)
      setLastName(user.last_name)
      setPhone(user.phone)
      setRole(user.role)
      setSelectedBranchIds(user.branches.map(b => b.id))
      setError(null)
      setValidationErrors({})
    }
  }, [isOpen, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setError(null)

    // Validation
    if (!validateIsraeliPhone(phone)) {
      setError(VALIDATION_MESSAGES.phone.israeliFormat)
      return
    }

    if (selectedBranchIds.length === 0) {
      setError('Veuillez sélectionner au moins une branche')
      return
    }

    setLoading(true)

    const result = await onSubmit(user.id, {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone,
      role,
      branch_ids: selectedBranchIds,
    })

    setLoading(false)

    if (result.success) {
      onClose()
    } else {
      setError(result.error || 'Erreur lors de la modification')
    }
  }

  const handleToggleBranch = (branchId: string) => {
    setSelectedBranchIds(prev =>
      prev.includes(branchId)
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    )
  }

  const availableBranches = currentUserRole === 'super_admin'
    ? branches
    : branches.filter(b => currentUserBranchIds.includes(b.id))

  const availableRoles: { value: UserRole; label: string }[] = currentUserRole === 'super_admin'
    ? [
        { value: 'branch_admin', label: 'Admin Agence' },
        { value: 'agent', label: 'Agent' },
      ]
    : [
        { value: 'agent', label: 'Agent' },
      ]

  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className={`relative w-full max-w-2xl my-8 rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Modifier l'utilisateur
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            } disabled:opacity-50`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className={`p-4 rounded-lg border flex items-start gap-2 ${
              isDark
                ? 'bg-red-500/10 border-red-500/50 text-red-400'
                : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <User className="w-4 h-4 inline mr-1" />
                Prénom *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Nom *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <Phone className="w-4 h-4 inline mr-1" />
              Téléphone *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                const newPhone = e.target.value
                setPhone(newPhone)
                if (newPhone.trim() && !validateIsraeliPhone(newPhone)) {
                  setValidationErrors({ phone: VALIDATION_MESSAGES.phone.israeliFormat })
                } else {
                  setValidationErrors({})
                }
              }}
              required
              className={`w-full px-3 py-2 rounded-lg border ${
                validationErrors.phone
                  ? 'border-red-500'
                  : isDark
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="05XXXXXXXX"
            />
            {validationErrors.phone && (
              <div className="flex items-center gap-1 mt-1 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{validationErrors.phone}</span>
              </div>
            )}
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <Shield className="w-4 h-4 inline mr-1" />
              Rôle *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              required
              className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDark
                  ? 'border-gray-600 text-white'
                  : 'border-gray-300 text-gray-900'
              }`}
            >
              {availableRoles.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <Building2 className="w-4 h-4 inline mr-1" />
              Branche(s) *
            </label>
            <div className={`border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto ${
              isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'
            }`}>
              {availableBranches.map(branch => (
                <label
                  key={branch.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedBranchIds.includes(branch.id)}
                    onChange={() => handleToggleBranch(branch.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>
                    {branch.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className={`flex items-center justify-end gap-3 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`px-4 py-2 rounded-lg transition-colors ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              } disabled:opacity-50`}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || Object.keys(validationErrors).length > 0}
              className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
