'use client'

import { ChevronDown, Building2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import type { Branch } from '@/lib/supabase/types'

interface BranchSelectorProps {
  branches: Branch[]
  selectedBranch: Branch | null
  onSelect: (branchId: string) => void
  disabled?: boolean
  theme?: 'light' | 'dark'
}

export function BranchSelector({
  branches,
  selectedBranch,
  onSelect,
  disabled = false,
  theme = 'dark',
}: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Éviter les problèmes d'hydratation
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fermer le dropdown quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const isDark = theme === 'dark'

  if (branches.length === 0) {
    return (
      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
        isDark
          ? 'bg-gray-800 text-gray-400'
          : 'bg-gray-100 text-gray-600'
      }`}>
        <Building2 className="w-5 h-5" />
        <span>Aucune agence disponible</span>
      </div>
    )
  }

  if (branches.length === 1) {
    return (
      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
        isDark
          ? 'bg-gray-800 text-white'
          : 'bg-gray-100 text-gray-900'
      }`}>
        <Building2 className={`w-5 h-5 ${
          isDark ? 'text-blue-400' : 'text-blue-600'
        }`} />
        <span>{selectedBranch?.name || branches[0].name}</span>
      </div>
    )
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
          isDark
            ? 'bg-gray-800 hover:bg-gray-700 text-white'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <Building2 className={`w-5 h-5 ${
          isDark ? 'text-blue-400' : 'text-blue-600'
        }`} />
        <span>{selectedBranch?.name || 'Sélectionner une agence'}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${
          isDark ? 'text-gray-400' : 'text-gray-600'
        } ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {mounted && isOpen && (
        <div className={`absolute top-full left-0 mt-2 w-64 rounded-lg shadow-xl z-50 overflow-hidden ${
          isDark
            ? 'bg-gray-800 border border-gray-700'
            : 'bg-white border border-gray-200'
        }`}>
          {branches.map((branch) => (
            <button
              key={branch.id}
              onClick={() => {
                onSelect(branch.id)
                setIsOpen(false)
              }}
              className={`w-full px-4 py-3 text-left transition-colors ${
                selectedBranch?.id === branch.id
                  ? isDark
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'bg-blue-100 text-blue-700'
                  : isDark
                  ? 'text-white hover:bg-gray-700'
                  : 'text-gray-900 hover:bg-gray-100'
              }`}
            >
              <div className="font-medium">{branch.name}</div>
              {branch.name_en && branch.name_en !== branch.name && (
                <div className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>{branch.name_en}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
