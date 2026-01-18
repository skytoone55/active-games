'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, User, Phone, Mail, Shield, Building2, AlertCircle, Eye, EyeOff, Copy, Check } from 'lucide-react'
import type { UserRole, Branch, Role } from '@/lib/supabase/types'
import { validateEmail, validateIsraeliPhone, VALIDATION_MESSAGES } from '@/lib/validation'
import { CustomSelect } from '../../components/CustomSelect'
import { useRoles } from '@/hooks/useRoles'

interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    email: string
    first_name: string
    last_name: string
    phone: string
    role_id: string
    branch_ids: string[]
    password?: string
  }) => Promise<{ success: boolean; error?: string; temporaryPassword?: string }>
  branches: Branch[]
  currentUserRole: UserRole
  currentUserBranchIds: string[]
  currentUserLevel?: number
  isDark: boolean
}

export function CreateUserModal({
  isOpen,
  onClose,
  onSubmit,
  branches,
  currentUserRole,
  currentUserBranchIds,
  currentUserLevel = 10,
  isDark,
}: CreateUserModalProps) {
  const { roles, getAssignableRoles, loading: rolesLoading } = useRoles()

  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{ email?: string; phone?: string }>({})
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordCopied, setPasswordCopied] = useState(false)

  // Get available roles for assignment based on user level
  const assignableRoles = useMemo(() => {
    return getAssignableRoles(currentUserLevel)
  }, [getAssignableRoles, currentUserLevel])

  // Set default role when assignable roles are loaded
  useEffect(() => {
    if (assignableRoles.length > 0 && !selectedRoleId) {
      // Default to the role with highest level (lowest authority) among assignable
      const defaultRole = assignableRoles[assignableRoles.length - 1]
      setSelectedRoleId(defaultRole.id)
    }
  }, [assignableRoles, selectedRoleId])

  // Réinitialiser le formulaire à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setEmail('')
      setFirstName('')
      setLastName('')
      setPhone('')
      // Reset role to default (will be set by above effect)
      setSelectedRoleId('')
      setSelectedBranchIds([])
      setError(null)
      setValidationErrors({})
      setTemporaryPassword(null)
      setShowPassword(false)
      setPasswordCopied(false)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation finale
    if (!validateEmail(email)) {
      setError(VALIDATION_MESSAGES.email.invalid)
      return
    }

    if (!validateIsraeliPhone(phone)) {
      setError(VALIDATION_MESSAGES.phone.israeliFormat)
      return
    }

    if (selectedBranchIds.length === 0) {
      setError('Veuillez sélectionner au moins une branche')
      return
    }

    if (!selectedRoleId) {
      setError('Veuillez sélectionner un rôle')
      return
    }

    setLoading(true)

    const result = await onSubmit({
      email: email.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone,
      role_id: selectedRoleId,
      branch_ids: selectedBranchIds,
    })

    setLoading(false)

    if (result.success) {
      if (result.temporaryPassword) {
        setTemporaryPassword(result.temporaryPassword)
      } else {
        onClose()
      }
    } else {
      setError(result.error || 'Erreur lors de la création')
    }
  }

  const handleCopyPassword = () => {
    if (temporaryPassword) {
      navigator.clipboard.writeText(temporaryPassword)
      setPasswordCopied(true)
      setTimeout(() => setPasswordCopied(false), 2000)
    }
  }

  const handleToggleBranch = (branchId: string) => {
    setSelectedBranchIds(prev =>
      prev.includes(branchId)
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    )
  }

  // Filtrer les branches disponibles selon le niveau
  // Level < 5 peut voir toutes les branches
  const availableBranches = currentUserLevel < 5
    ? branches
    : branches.filter(b => currentUserBranchIds.includes(b.id))

  // Build role options from dynamic roles
  const roleOptions = useMemo(() => {
    return assignableRoles.map(role => ({
      value: role.id,
      label: role.display_name,
      color: role.color
    }))
  }, [assignableRoles])

  if (!isOpen) return null

  // Loading state for roles
  if (rolesLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className={`relative w-full max-w-md rounded-2xl shadow-2xl p-8 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex items-center justify-center">
            <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          </div>
        </div>
      </div>
    )
  }

  // Si mot de passe temporaire généré, afficher l'écran de confirmation
  if (temporaryPassword) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className={`relative w-full max-w-md rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Utilisateur créé !
                </h2>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {email}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className={`p-4 rounded-lg ${isDark ? 'bg-yellow-900/20 border border-yellow-700' : 'bg-yellow-50 border border-yellow-200'}`}>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>
                    Mot de passe temporaire généré
                  </p>
                  <p className={`text-sm mt-1 ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                    Copiez ce mot de passe et communiquez-le à l'utilisateur. Il devra le changer à sa première connexion.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Mot de passe temporaire
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={temporaryPassword}
                  readOnly
                  className={`flex-1 px-3 py-2 rounded-lg border font-mono text-sm ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-gray-50 border-gray-300 text-gray-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark
                      ? 'hover:bg-gray-700 text-gray-400'
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                  title={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    passwordCopied
                      ? 'bg-green-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {passwordCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copié
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copier
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className={`p-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              onClick={onClose}
              className="w-full px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className={`relative w-full max-w-2xl my-8 rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Créer un utilisateur
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

        {/* Form */}
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

          {/* Email */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <Mail className="w-4 h-4 inline mr-1" />
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                const newEmail = e.target.value
                setEmail(newEmail)
                if (newEmail.trim() && !validateEmail(newEmail)) {
                  setValidationErrors({ ...validationErrors, email: VALIDATION_MESSAGES.email.invalid })
                } else {
                  const { email: _, ...rest } = validationErrors
                  setValidationErrors(rest)
                }
              }}
              required
              className={`w-full px-3 py-2 rounded-lg border ${
                validationErrors.email
                  ? 'border-red-500'
                  : isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="utilisateur@example.com"
            />
            {validationErrors.email && (
              <div className="flex items-center gap-1 mt-1 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{validationErrors.email}</span>
              </div>
            )}
          </div>

          {/* Prénom et Nom */}
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
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Prénom"
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
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Nom"
              />
            </div>
          </div>

          {/* Téléphone */}
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
                  setValidationErrors({ ...validationErrors, phone: VALIDATION_MESSAGES.phone.israeliFormat })
                } else {
                  const { phone: _, ...rest } = validationErrors
                  setValidationErrors(rest)
                }
              }}
              required
              className={`w-full px-3 py-2 rounded-lg border ${
                validationErrors.phone
                  ? 'border-red-500'
                  : isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
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

          {/* Rôle */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <Shield className="w-4 h-4 inline mr-1" />
              Rôle *
            </label>
            <CustomSelect
              value={selectedRoleId}
              onChange={(value) => setSelectedRoleId(value)}
              options={roleOptions}
              isDark={isDark}
            />
            {assignableRoles.length === 0 && (
              <p className={`text-xs mt-1 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                Aucun rôle disponible pour l'assignation
              </p>
            )}
          </div>

          {/* Branches */}
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
            {selectedBranchIds.length === 0 && (
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Veuillez sélectionner au moins une branche
              </p>
            )}
          </div>

          {/* Footer */}
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
                  Création...
                </>
              ) : (
                'Créer l\'utilisateur'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
