'use client'

import { useState, useEffect, useRef } from 'react'
import { LogOut, User, Settings, ChevronDown, Sun, Moon, Users, Calendar, LayoutDashboard } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { AuthUser } from '@/hooks/useAuth'
import type { Branch } from '@/lib/supabase/types'
import { BranchSelector } from './BranchSelector'

interface AdminHeaderProps {
  user: AuthUser
  branches: Branch[]
  selectedBranch: Branch | null
  onBranchSelect: (branchId: string) => void
  onSignOut: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export function AdminHeader({
  user,
  branches,
  selectedBranch,
  onBranchSelect,
  onSignOut,
  theme,
  onToggleTheme,
}: AdminHeaderProps) {
  const pathname = usePathname()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNavMenu, setShowNavMenu] = useState(false)
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navMenuRef = useRef<HTMLDivElement>(null)

  // Éviter les problèmes d'hydratation
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fermer les menus quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
      if (navMenuRef.current && !navMenuRef.current.contains(event.target as Node)) {
        setShowNavMenu(false)
      }
    }

    if (showUserMenu || showNavMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUserMenu, showNavMenu])

  const getRoleBadge = () => {
    switch (user.role) {
      case 'super_admin':
        return (
          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
            Super Admin
          </span>
        )
      case 'branch_admin':
        return (
          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
            Admin Agence
          </span>
        )
      case 'agent':
        return (
          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
            Agent
          </span>
        )
      default:
        return null
    }
  }

  return (
    <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Logo et titre */}
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-white">
            Active Games
            <span className="text-blue-400 ml-2">Admin</span>
          </h1>

          {/* Sélecteur d'agence */}
          <BranchSelector
            branches={branches}
            selectedBranch={selectedBranch}
            onSelect={onBranchSelect}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Menu Navigation */}
          <div ref={navMenuRef} className="relative">
            <button
              onClick={() => setShowNavMenu(!showNavMenu)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Navigation</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showNavMenu ? 'rotate-180' : ''}`} />
            </button>

            {mounted && showNavMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="py-2">
                  <Link
                    href="/admin"
                    className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                      pathname === '/admin'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                    onClick={() => setShowNavMenu(false)}
                  >
                    <Calendar className="w-4 h-4" />
                    Agenda
                  </Link>
                  <Link
                    href="/admin/clients"
                    className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                      pathname === '/admin/clients'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                    onClick={() => setShowNavMenu(false)}
                  >
                    <Users className="w-4 h-4" />
                    Clients (CRM)
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Toggle thème */}
          <button
            onClick={onToggleTheme}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title={theme === 'light' ? 'Mode sombre' : 'Mode clair'}
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </button>

          {/* Menu utilisateur */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-sm text-white font-medium">
                  {user.profile?.full_name || user.email}
                </div>
                {getRoleBadge()}
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {mounted && showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-700">
                  <div className="text-sm text-white font-medium">
                    {user.profile?.full_name || 'Utilisateur'}
                  </div>
                  <div className="text-xs text-gray-400">{user.email}</div>
                </div>

                <div className="py-2">
                  <button
                    onClick={() => {
                      setShowUserMenu(false)
                      // TODO: Ouvrir les paramètres
                    }}
                    className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Paramètres
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false)
                      onSignOut()
                    }}
                    className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-700 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Déconnexion
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
