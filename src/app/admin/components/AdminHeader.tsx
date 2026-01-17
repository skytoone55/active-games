'use client'

import { useState, useEffect, useRef } from 'react'
import { LogOut, User, ChevronDown, Sun, Moon, Users, Calendar, Menu, X, ShoppingCart, Shield } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import type { AuthUser } from '@/hooks/useAuth'
import type { Branch } from '@/lib/supabase/types'
import { BranchSelector } from './BranchSelector'
import { usePendingOrdersCount } from '@/hooks/useOrders'

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
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Éviter les problèmes d'hydratation
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fermer le menu quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUserMenu])

  // Compteur de commandes en attente pour le badge (visible partout)
  const pendingOrdersCount = usePendingOrdersCount(selectedBranch?.id || null)
  const hasPendingOrders = pendingOrdersCount > 0

  const getRoleBadge = () => {
    const baseClasses = "px-2 py-0.5 text-xs rounded-full"
    switch (user.role) {
      case 'super_admin':
        return (
          <span className={`${baseClasses} ${
            theme === 'dark'
              ? 'bg-purple-500/20 text-purple-400'
              : 'bg-purple-100 text-purple-700'
          }`}>
            Super Admin
          </span>
        )
      case 'branch_admin':
        return (
          <span className={`${baseClasses} ${
            theme === 'dark'
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-blue-100 text-blue-700'
          }`}>
            Admin Agence
          </span>
        )
      case 'agent':
        return (
          <span className={`${baseClasses} ${
            theme === 'dark'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-green-100 text-green-700'
          }`}>
            Agent
          </span>
        )
      default:
        return null
    }
  }

  return (
    <header className={`sticky top-0 z-40 ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} border-b px-4 sm:px-6 py-4 shadow-md`}>
      <div className="flex items-center justify-between">
        {/* Logos - À gauche */}
        <div className="flex items-center min-w-0 flex-shrink-0 gap-3">
          <Link href="/admin" className="flex items-center">
            <Image
              src="/images/logo-activegames.png"
              alt="Active Games"
              width={142}
              height={54}
              className="h-14 w-auto object-contain"
              priority
            />
          </Link>
          <Link href="/admin" className="flex items-center">
            <Image
              src="/images/logo_laser_city.png"
              alt="Laser City"
              width={142}
              height={54}
              className="h-14 w-auto object-contain"
              priority
            />
          </Link>
        </div>

        {/* Navigation - Agenda, Clients, Commandes - Se rapproche du logo quand on réduit */}
        <div className="hidden min-[900px]:flex items-center gap-3 flex-1 justify-center min-w-0">
          <Link
            href="/admin"
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 relative ${
              pathname === '/admin'
                ? 'bg-blue-600 text-white'
                : theme === 'dark' 
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Agenda</span>
            {/* Pastille rouge critique pour commandes en attente */}
            {hasPendingOrders && pathname !== '/admin/orders' && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse shadow-lg">
                !
              </span>
            )}
          </Link>
          <Link
            href="/admin/clients"
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              pathname === '/admin/clients'
                ? 'bg-blue-600 text-white'
                : theme === 'dark' 
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Clients</span>
          </Link>
          <Link
            href="/admin/orders"
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 relative ${
              pathname === '/admin/orders'
                ? 'bg-blue-600 text-white'
                : theme === 'dark' 
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Commandes</span>
            {/* Pastille rouge critique pour commandes en attente */}
            {hasPendingOrders && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse shadow-lg">
                {pendingOrdersCount > 9 ? '9+' : pendingOrdersCount}
              </span>
            )}
          </Link>
          {/* Bouton Utilisateurs - visible uniquement pour super_admin et branch_admin */}
          {(user.role === 'super_admin' || user.role === 'branch_admin') && (
            <Link
              href="/admin/users"
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                pathname === '/admin/users'
                  ? 'bg-blue-600 text-white'
                  : theme === 'dark' 
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Utilisateurs</span>
            </Link>
          )}
        </div>

        {/* Actions - À droite : Branch, Thème, Profil - Se rapprochent de l'Agenda quand on réduit */}
        <div className="hidden min-[900px]:flex items-center gap-2 flex-shrink-0">
          {/* Sélecteur d'agence */}
          <BranchSelector
            branches={branches}
            selectedBranch={selectedBranch}
            onSelect={onBranchSelect}
            theme={theme}
          />

          {/* Toggle thème */}
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
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
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-800 hover:bg-gray-700'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="text-left hidden min-[900px]:block">
                <div className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {user.profile?.full_name || user.email}
                </div>
                {getRoleBadge()}
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              } ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {mounted && showUserMenu && (
              <div className={`absolute right-0 top-full mt-2 w-56 rounded-lg shadow-xl z-50 overflow-hidden ${
                theme === 'dark'
                  ? 'bg-gray-800 border border-gray-700'
                  : 'bg-white border border-gray-200'
              }`}>
                <div className={`px-4 py-3 border-b ${
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                }`}>
                  <div className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {user.profile?.full_name || 'Utilisateur'}
                  </div>
                  <div className={`text-xs ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>{user.email}</div>
                </div>

                <div className="py-2">
                  <button
                    onClick={() => {
                      setShowUserMenu(false)
                      onSignOut()
                    }}
                    className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                      theme === 'dark'
                        ? 'text-red-400 hover:bg-gray-700'
                        : 'text-red-600 hover:bg-gray-100'
                    }`}
                  >
                    <LogOut className="w-4 h-4" />
                    Déconnexion
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Menu Hamburger - Seulement quand il n'y a vraiment plus d'espace */}
        <div className="min-[900px]:hidden">
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {showMobileMenu ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Menu Mobile/Tablette - Visible quand hamburger est affiché */}
      {showMobileMenu && (
        <div className={`min-[900px]:hidden border-t ${
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        }`}>
          <div className="px-4 py-3 space-y-3">
            {/* Sélecteur de branche mobile */}
            <div className="pb-3 border-b border-gray-200 dark:border-gray-700">
              <BranchSelector
                branches={branches}
                selectedBranch={selectedBranch}
                onSelect={(branchId) => {
                  onBranchSelect(branchId)
                  setShowMobileMenu(false)
                }}
                theme={theme}
              />
            </div>

            {/* Navigation mobile */}
            <div className="space-y-2">
              <Link
                href="/admin"
                onClick={() => setShowMobileMenu(false)}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors relative ${
                  pathname === '/admin'
                    ? 'bg-blue-600 text-white'
                    : theme === 'dark' 
                      ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Agenda</span>
                {hasPendingOrders && pathname !== '/admin/orders' && (
                  <span className="bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full ml-auto animate-pulse">
                    !
                  </span>
                )}
              </Link>
              <Link
                href="/admin/clients"
                onClick={() => setShowMobileMenu(false)}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  pathname === '/admin/clients'
                    ? 'bg-blue-600 text-white'
                    : theme === 'dark' 
                      ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Clients</span>
              </Link>
              <Link
                href="/admin/orders"
                onClick={() => setShowMobileMenu(false)}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors relative ${
                  pathname === '/admin/orders'
                    ? 'bg-blue-600 text-white'
                    : theme === 'dark' 
                      ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Commandes</span>
                {hasPendingOrders && (
                  <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-auto animate-pulse">
                    {pendingOrdersCount}
                  </span>
                )}
              </Link>
              {/* Bouton Utilisateurs mobile - visible uniquement pour super_admin et branch_admin */}
              {(user.role === 'super_admin' || user.role === 'branch_admin') && (
                <Link
                  href="/admin/users"
                  onClick={() => setShowMobileMenu(false)}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname === '/admin/users'
                      ? 'bg-blue-600 text-white'
                      : theme === 'dark' 
                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Utilisateurs</span>
                </Link>
              )}
            </div>

            {/* Utilisateur mobile */}
            <div className={`pt-3 border-t ${
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className={`px-4 py-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <div className="text-sm font-medium">
                  {user.profile?.full_name || user.email}
                </div>
                <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {user.email}
                </div>
                {getRoleBadge()}
              </div>
              <button
                onClick={() => {
                  setShowMobileMenu(false)
                  onToggleTheme()
                }}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'text-gray-300 hover:bg-gray-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {theme === 'light' ? (
                  <>
                    <Moon className="w-4 h-4" />
                    <span>Mode sombre</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-4 h-4" />
                    <span>Mode clair</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowMobileMenu(false)
                  onSignOut()
                }}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'text-red-400 hover:bg-gray-700'
                    : 'text-red-600 hover:bg-gray-100'
                }`}
              >
                <LogOut className="w-4 h-4" />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
