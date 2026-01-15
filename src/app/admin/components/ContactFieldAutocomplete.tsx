'use client'

import { useState, useEffect, useRef } from 'react'
import { User, Phone, Mail, Loader2 } from 'lucide-react'
import { useContacts } from '@/hooks/useContacts'
import type { Contact } from '@/lib/supabase/types'

interface ContactFieldAutocompleteProps {
  branchId: string
  value: string
  onChange: (value: string) => void
  onSelectContact: (contact: Contact) => void
  fieldType: 'firstName' | 'lastName' | 'email' | 'phone'
  placeholder?: string
  required?: boolean
  isDark: boolean
  inputType?: 'text' | 'tel' | 'email'
  disabled?: boolean // Désactive la recherche et rend le champ readonly
  isFocused?: boolean // Indique si ce champ a le focus (pour ne lancer la recherche que sur le champ actif)
}

export function ContactFieldAutocomplete({
  branchId,
  value,
  onChange,
  onSelectContact,
  fieldType,
  placeholder,
  required = false,
  isDark,
  inputType = 'text',
  disabled = false,
  isFocused = false,
}: ContactFieldAutocompleteProps) {
  const [showResults, setShowResults] = useState(false)
  const [searchResults, setSearchResults] = useState<Contact[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasFocus, setHasFocus] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { searchContacts } = useContacts(branchId)

  // Recherche avec debounce - SEULEMENT si le champ a le focus ET n'est pas désactivé
  useEffect(() => {
    // Ne pas lancer de recherche si :
    // - Le champ est désactivé
    // - Le champ n'a pas le focus
    // - Pas de branchId
    if (disabled || !hasFocus || !branchId) {
      setSearchResults([])
      setShowResults(false)
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      return
    }

    // Nettoyer le timeout précédent
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Si la recherche est vide, réinitialiser
    if (!value.trim()) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    // Debounce de 300ms
    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await searchContacts({
          query: value.trim(),
          branchId,
          includeArchived: false,
          page: 1,
          pageSize: 10, // Limiter à 10 résultats pour l'autocomplete
        })

        setSearchResults(result.contacts)
        setShowResults(true)
      } catch (error) {
        console.error('Error searching contacts:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [value, branchId, searchContacts, disabled, hasFocus])

  // Fermer les résultats si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Sélectionner un contact
  const handleSelectContact = (contact: Contact) => {
    onSelectContact(contact)
    setShowResults(false)
  }

  // Formater le nom complet
  const getDisplayName = (contact: Contact): string => {
    const parts = [contact.first_name, contact.last_name].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : contact.phone || 'Contact'
  }

  // Déterminer la position du dropdown selon le champ
  // Prénom et Téléphone : colonne gauche → dropdown aligné à gauche
  // Nom et Email : colonne droite → dropdown aligné à droite pour éviter de sortir
  const isLeftColumn = fieldType === 'firstName' || fieldType === 'phone'

  return (
    <div ref={containerRef} className="relative">
      {/* Input avec autocomplete */}
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={(e) => {
            if (!disabled) {
              onChange(e.target.value)
            }
          }}
          onFocus={() => {
            if (!disabled) {
              setHasFocus(true)
              if (value.trim() && searchResults.length > 0) {
                setShowResults(true)
              }
            }
          }}
          onBlur={() => {
            // Ne pas fermer immédiatement pour permettre le clic sur un résultat
            setTimeout(() => {
              setHasFocus(false)
            }, 200)
          }}
          required={required}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={disabled}
          className={`w-full px-3 py-2 rounded-lg border ${
            disabled
              ? isDark
                ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
              : isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
          } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
        />
        {isSearching && (
          <Loader2 className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
        )}
      </div>

      {/* Résultats de recherche */}
      {showResults && searchResults.length > 0 && (
        <div
          className={`absolute z-50 ${isLeftColumn ? 'left-0' : 'right-0'} mt-1 min-w-full w-max rounded-lg border shadow-lg max-h-64 overflow-y-auto ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-300'
          }`}
          style={{
            maxWidth: 'min(calc(100vw - 2rem), 600px)',
          }}
        >
          {searchResults.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => handleSelectContact(contact)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b whitespace-nowrap ${
                isDark
                  ? 'border-gray-700 text-gray-200'
                  : 'border-gray-200 text-gray-900'
              } first:rounded-t-lg last:rounded-b-lg last:border-b-0`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  isDark ? 'bg-gray-700' : 'bg-gray-100'
                }`}>
                  <User className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                </div>
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {getDisplayName(contact)}
                  </div>
                  {contact.phone && (
                    <div className={`flex items-center gap-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      <span>{contact.phone}</span>
                    </div>
                  )}
                  {contact.email && (
                    <div className={`flex items-center gap-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      <span>{contact.email}</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
