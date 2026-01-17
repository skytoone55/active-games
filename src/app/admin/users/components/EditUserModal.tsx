'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, User, Phone, Shield, Building2, AlertCircle, Save, Mail, Lock } from 'lucide-react'
import type { UserWithBranches, UserRole, Branch } from '@/lib/supabase/types'
import { validateIsraeliPhone, validateEmail, VALIDATION_MESSAGES } from '@/lib/validation'
import { CustomSelect } from '../../components/CustomSelect'

interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (userId: string, data: {
    first_name?: string
    last_name?: string
    phone?: string
    email?: string
    password?: string
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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('agent')
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{ phone?: string; email?: string; password?: string }>({})

  // Initialiser avec les données de l'utilisateur
  useEffect(() => {
    if (isOpen && user) {
      setFirstName(user.first_name)
      setLastName(user.last_name)
      setPhone(user.phone)
      setEmail(user.email || '')
      setPassword('') // Toujours vide au départ (optionnel)
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
    const newValidationErrors: { phone?: string; email?: string; password?: string } = {}

    // Validation téléphone
    if (!validateIsraeliPhone(phone)) {
      newValidationErrors.phone = VALIDATION_MESSAGES.phone.israeliFormat
    }

    // Validation email si modifié
    if (email.trim() && email.trim() !== user.email) {
      if (!validateEmail(email.trim())) {
        newValidationErrors.email = VALIDATION_MESSAGES.email.invalid
      }
    }

    // Validation mot de passe si fourni (minimum 6 caractères)
    if (password.trim()) {
      if (password.length < 6) {
        newValidationErrors.password = 'Le mot de passe doit contenir au moins 6 caractères'
      }
    }

    if (Object.keys(newValidationErrors).length > 0) {
      setValidationErrors(newValidationErrors)
      return
    }

    if (selectedBranchIds.length === 0) {
      setError('Veuillez sélectionner au moins une branche')
      return
    }

    setLoading(true)

    const submitData: {
      first_name?: string
      last_name?: string
      phone?: string
      email?: string
      password?: string
      role?: UserRole
      branch_ids?: string[]
    } = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone,
      role,
      branch_ids: selectedBranchIds,
    }

    // Ajouter email seulement si modifié
    if (email.trim() && email.trim() !== user.email) {
      submitData.email = email.trim()
    }

    // Ajouter password seulement si fourni
    if (password.trim()) {
      submitData.password = password
    }

    const result = await onSubmit(user.id, submitData)

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
                const newErrors = { ...validationErrors }
                if (newPhone.trim() && !validateIsraeliPhone(newPhone)) {
                  newErrors.phone = VALIDATION_MESSAGES.phone.israeliFormat
                } else {
                  delete newErrors.phone
                }
                setValidationErrors(newErrors)
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
              <Mail className="w-4 h-4 inline mr-1" />
              Email (identifiant)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                const newEmail = e.target.value
                setEmail(newEmail)
                const newErrors = { ...validationErrors }
                if (newEmail.trim() && newEmail.trim() !== user.email && !validateEmail(newEmail.trim())) {
                  newErrors.email = VALIDATION_MESSAGES.email.invalid
                } else {
                  delete newErrors.email
                }
                setValidationErrors(newErrors)
              }}
              className={`w-full px-3 py-2 rounded-lg border ${
                validationErrors.email
                  ? 'border-red-500'
                  : isDark
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="exemple@email.com"
            />
            {validationErrors.email && (
              <div className="flex items-center gap-1 mt-1 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{validationErrors.email}</span>
              </div>
            )}
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Laissez vide pour ne pas modifier. L'email sert d'identifiant de connexion.
            </p>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <Lock className="w-4 h-4 inline mr-1" />
              Nouveau mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                const newPassword = e.target.value
                setPassword(newPassword)
                const newErrors = { ...validationErrors }
                if (newPassword.trim() && newPassword.length < 6) {
                  newErrors.password = 'Le mot de passe doit contenir au moins 6 caractères'
                } else {
                  delete newErrors.password
                }
                setValidationErrors(newErrors)
              }}
              className={`w-full px-3 py-2 rounded-lg border ${
                validationErrors.password
                  ? 'border-red-500'
                  : isDark
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="Laissez vide pour ne pas modifier"
            />
            {validationErrors.password && (
              <div className="flex items-center gap-1 mt-1 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{validationErrors.password}</span>
              </div>
            )}
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Laissez vide pour ne pas modifier le mot de passe. Minimum 6 caractères.
            </p>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <Shield className="w-4 h-4 inline mr-1" />
              Rôle *
            </label>
            <CustomSelect
              value={role}
              onChange={(value) => setRole(value as UserRole)}
              options={availableRoles}
              isDark={isDark}
            />
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
