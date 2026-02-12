'use client'

import { useState, useEffect, useRef, memo, useCallback, startTransition } from 'react'
import { LogOut, User, ChevronDown, Sun, Moon, Users, Calendar, Menu, X, ShoppingCart, Shield, Globe, FileText, Lock, Crown, Settings, Trash2, BarChart3, Phone, MessageCircle, HandHelping } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import type { AuthUser } from '@/hooks/useAuth'
import type { Branch, UserRole } from '@/lib/supabase/types'
import { BranchSelector } from './BranchSelector'
import { usePendingOrdersCount, useUnseenAbortedOrdersCount } from '@/hooks/useOrders'
import { useUnreadContactRequestsCount } from '@/hooks/useContactRequests'
import { useUnreadChatsCount } from '@/hooks/useUnreadChatsCount'
import { useNeedsHumanCount } from '@/hooks/useNeedsHumanCount'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import { useTranslation } from '@/contexts/LanguageContext'
import type { Locale } from '@/i18n'

interface AdminHeaderProps {
  user: AuthUser
  branches: Branch[]
  selectedBranch: Branch | null
  onBranchSelect: (branchId: string) => void
  onSignOut: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

const languageFlags: Record<Locale, { flag: string; key: string }> = {
  fr: { flag: '🇫🇷', key: 'admin.header.language_french' },
  en: { flag: '🇬🇧', key: 'admin.header.language_english' },
  he: { flag: '🇮🇱', key: 'admin.header.language_hebrew' }
}

function AdminHeaderComponent({
  user,
  branches,
  selectedBranch,
  onBranchSelect,
  onSignOut,
  theme,
  onToggleTheme,
}: AdminHeaderProps) {
  const pathname = usePathname()
  const { t, locale, setLocale } = useTranslation()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const langMenuRef = useRef<HTMLDivElement>(null)

  // Permissions de l'utilisateur pour conditionner l'affichage des menus
  const { hasPermission } = useUserPermissions(user.role as UserRole)

  // Close menus via startTransition to avoid blocking navigation paint (INP fix)
  const closeUserMenu = useCallback(() => {
    startTransition(() => setShowUserMenu(false))
  }, [])
  const closeMobileMenu = useCallback(() => {
    startTransition(() => setShowMobileMenu(false))
  }, [])

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
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLanguageMenu(false)
      }
    }

    if (showUserMenu || showLanguageMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUserMenu, showLanguageMenu])

  // Compteur de commandes en attente pour le badge (visible partout)
  const pendingOrdersCount = usePendingOrdersCount(selectedBranch?.id || null)
  const hasPendingOrders = pendingOrdersCount > 0

  // Compteur de commandes aborted non vues (badge orange sur Commandes)
  const { count: unseenAbortedCount } = useUnseenAbortedOrdersCount(selectedBranch?.id || null)
  const hasUnseenAborted = unseenAbortedCount > 0

  // Compteur de demandes de contact non lues (badge sur Clients)
  const unreadContactRequests = useUnreadContactRequestsCount(selectedBranch?.id || null)
  const hasUnreadRequests = unreadContactRequests > 0

  // Compteur de conversations non lues WhatsApp + Messenger (badge sur Chat)
  const unreadChatsCount = useUnreadChatsCount(branches)
  const hasUnreadChats = unreadChatsCount > 0

  // Compteur de conversations WhatsApp nécessitant un humain (pastille orange sur Chat)
  const needsHumanCount = useNeedsHumanCount(branches)
  const hasNeedsHuman = needsHumanCount > 0

  // Construire le nom complet à partir du profil
  const getUserDisplayName = () => {
    if (!user.profile) return user.email

    // Utiliser full_name si disponible, sinon construire à partir de first_name et last_name
    if (user.profile.full_name) {
      return user.profile.full_name
    }

    const firstName = user.profile.first_name || ''
    const lastName = user.profile.last_name || ''
    const fullName = `${firstName} ${lastName}`.trim()

    return fullName || user.email
  }

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
            {t('admin.roles.super_admin')}
          </span>
        )
      case 'branch_admin':
        return (
          <span className={`${baseClasses} ${
            theme === 'dark'
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {t('admin.roles.manager')}
          </span>
        )
      case 'agent':
        return (
          <span className={`${baseClasses} ${
            theme === 'dark'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-green-100 text-green-700'
          }`}>
            {t('admin.roles.employee')}
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

        {/* Navigation - Agenda, Clients, Commandes
             900px-1100px : icônes seules (compact) avec tooltip
             1100px+      : icônes + labels */}
        <div className="hidden min-[900px]:flex items-center gap-1 min-[1100px]:gap-3 flex-1 justify-center min-w-0">
          {hasPermission('agenda', 'can_view') && (
            <Link
              href="/admin"
              title={t('admin.header.agenda')}
              className={`px-3 min-[1100px]:px-4 py-2 rounded-lg transition-colors flex items-center gap-2 relative ${
                pathname === '/admin'
                  ? 'bg-blue-600 text-white'
                  : theme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden min-[1100px]:inline">{t('admin.header.agenda')}</span>
              {/* Pastille rouge critique pour commandes en attente */}
              {hasPendingOrders && pathname !== '/admin/orders' && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse shadow-lg">
                  !
                </span>
              )}
            </Link>
          )}
          {hasPermission('clients', 'can_view') && (
            <Link
              href="/admin/clients"
              title={t('admin.header.clients')}
              className={`px-3 min-[1100px]:px-4 py-2 rounded-lg transition-colors flex items-center gap-2 relative ${
                pathname === '/admin/clients'
                  ? 'bg-blue-600 text-white'
                  : theme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="hidden min-[1100px]:inline">{t('admin.header.clients')}</span>
              {/* Pastille rouge pour demandes de contact non traitées */}
              {hasUnreadRequests && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center animate-pulse shadow-lg">
                  {unreadContactRequests}
                </span>
              )}
            </Link>
          )}
          {hasPermission('orders', 'can_view') && (
            <Link
              href="/admin/orders"
              title={t('admin.header.orders')}
              className={`px-3 min-[1100px]:px-4 py-2 rounded-lg transition-colors flex items-center gap-2 relative ${
                pathname === '/admin/orders'
                  ? 'bg-blue-600 text-white'
                  : theme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden min-[1100px]:inline">{t('admin.header.orders')}</span>
              {/* Pastille rouge critique pour commandes en attente */}
              {hasPendingOrders && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse shadow-lg">
                  {pendingOrdersCount > 9 ? '9+' : pendingOrdersCount}
                </span>
              )}
              {/* Pastille orange pour commandes aborted non vues */}
              {hasUnseenAborted && !hasPendingOrders && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center animate-pulse shadow-lg">
                  {unseenAbortedCount > 9 ? '9+' : unseenAbortedCount}
                </span>
              )}
              {hasUnseenAborted && hasPendingOrders && (
                <span className="absolute -bottom-1 -right-1 bg-orange-500 text-white text-[10px] font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center shadow-lg">
                  {unseenAbortedCount > 9 ? '9+' : unseenAbortedCount}
                </span>
              )}
            </Link>
          )}
          {hasPermission('chat', 'can_view') && (
            <Link
              href="/admin/chat"
              title={t('admin.header.chat')}
              className={`relative px-3 min-[1100px]:px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                pathname === '/admin/chat'
                  ? 'bg-blue-600 text-white'
                  : theme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden min-[1100px]:inline">{t('admin.header.chat')}</span>
              {hasUnreadChats && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center animate-pulse shadow-lg">
                  {unreadChatsCount > 9 ? '9+' : unreadChatsCount}
                </span>
              )}
              {hasNeedsHuman && (
                <span className={`absolute ${hasUnreadChats ? '-bottom-1' : '-top-1'} -left-1 bg-orange-500 text-white text-[10px] font-bold h-5 px-1 rounded-full flex items-center justify-center animate-pulse shadow-lg gap-0.5`}>
                  <HandHelping className="w-3 h-3" />
                  {needsHumanCount > 1 ? needsHumanCount : ''}
                </span>
              )}
            </Link>
          )}
          {hasPermission('calls', 'can_view') && (
            <Link
              href="/admin/calls"
              title={t('admin.header.calls') || 'Appels'}
              className={`px-3 min-[1100px]:px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                pathname === '/admin/calls'
                  ? 'bg-blue-600 text-white'
                  : theme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <Phone className="w-4 h-4" />
              <span className="hidden min-[1100px]:inline">{t('admin.header.calls') || 'Appels'}</span>
            </Link>
          )}
        </div>

        {/* Actions - À droite : Branch, Langue, Thème, Profil */}
        <div className="hidden min-[900px]:flex items-center gap-2 flex-shrink-0">
          {/* Sélecteur d'agence */}
          <BranchSelector
            branches={branches}
            selectedBranch={selectedBranch}
            onSelect={onBranchSelect}
            theme={theme}
          />

          {/* Sélecteur de langue */}
          <div ref={langMenuRef} className="relative">
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
              title={t('admin.layout.language')}
            >
              <Globe className="w-4 h-4 min-[1100px]:hidden" />
              <span>{languageFlags[locale].flag}</span>
              <ChevronDown className={`w-3 h-3 transition-transform hidden min-[1100px]:block ${showLanguageMenu ? 'rotate-180' : ''}`} />
            </button>

            {mounted && showLanguageMenu && (
              <div className={`absolute right-0 top-full mt-2 w-40 rounded-lg shadow-xl z-50 overflow-hidden ${
                theme === 'dark'
                  ? 'bg-gray-800 border border-gray-700'
                  : 'bg-white border border-gray-200'
              }`}>
                {(Object.keys(languageFlags) as Locale[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      setLocale(lang)
                      setShowLanguageMenu(false)
                    }}
                    className={`w-full px-4 py-2 text-left flex items-center gap-3 transition-colors ${
                      locale === lang
                        ? theme === 'dark'
                          ? 'bg-blue-600/20 text-blue-400'
                          : 'bg-blue-50 text-blue-600'
                        : theme === 'dark'
                          ? 'text-gray-300 hover:bg-gray-700'
                          : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-lg">{languageFlags[lang].flag}</span>
                    <span>{t(languageFlags[lang].key)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

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
              <div className="text-left hidden min-[1100px]:block">
                <div className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {getUserDisplayName()}
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
                    {getUserDisplayName()}
                  </div>
                  <div className={`text-xs ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>{user.email}</div>
                </div>

                {/* Liens administration - basés sur les permissions */}
                {(hasPermission('users', 'can_view') || hasPermission('logs', 'can_view') || hasPermission('permissions', 'can_view')) && (
                  <div className={`py-2 border-b ${
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  }`}>
                    {hasPermission('users', 'can_view') && (
                      <Link
                        href="/admin/users"
                        onClick={closeUserMenu}
                        className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                          pathname === '/admin/users'
                            ? 'bg-blue-600 text-white'
                            : theme === 'dark'
                              ? 'text-gray-300 hover:bg-gray-700'
                              : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        {t('admin.header.users')}
                      </Link>
                    )}
                    {hasPermission('logs', 'can_view') && (
                      <Link
                        href="/admin/logs"
                        onClick={closeUserMenu}
                        className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                          pathname === '/admin/logs'
                            ? 'bg-blue-600 text-white'
                            : theme === 'dark'
                              ? 'text-gray-300 hover:bg-gray-700'
                              : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                        {t('admin.header.logs')}
                      </Link>
                    )}
                    {hasPermission('permissions', 'can_view') && (
                      <Link
                        href="/admin/permissions"
                        onClick={closeUserMenu}
                        className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                          pathname === '/admin/permissions'
                            ? 'bg-blue-600 text-white'
                            : theme === 'dark'
                              ? 'text-gray-300 hover:bg-gray-700'
                              : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Lock className="w-4 h-4" />
                        {t('admin.header.permissions')}
                      </Link>
                    )}
                  </div>
                )}

                {/* Liens admin (statistics, settings, permissions, roles) */}
                {(hasPermission('settings', 'can_view') || user.role === 'super_admin') && (
                  <div className={`py-2 border-b ${
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  }`}>
                    <Link
                      href="/admin/statistics"
                      onClick={closeUserMenu}
                      className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                        pathname === '/admin/statistics'
                          ? 'bg-blue-600 text-white'
                          : theme === 'dark'
                            ? 'text-gray-300 hover:bg-gray-700'
                            : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <BarChart3 className="w-4 h-4" />
                      {t('admin.header.statistics')}
                    </Link>
                    <Link
                      href="/admin/settings"
                      onClick={closeUserMenu}
                      className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                        pathname === '/admin/settings'
                          ? 'bg-blue-600 text-white'
                          : theme === 'dark'
                            ? 'text-gray-300 hover:bg-gray-700'
                            : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Settings className="w-4 h-4" />
                      {t('admin.header.settings')}
                    </Link>
                    <Link
                      href="/admin/data-management"
                      onClick={closeUserMenu}
                      className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                        pathname === '/admin/data-management'
                          ? 'bg-red-600 text-white'
                          : theme === 'dark'
                            ? 'text-red-400 hover:bg-gray-700'
                            : 'text-red-600 hover:bg-gray-100'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('admin.header.data_management')}
                    </Link>
                  </div>
                )}

                <div className="py-2">
                  {/* Toggle thème */}
                  <button
                    onClick={() => {
                      onToggleTheme()
                    }}
                    className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                      theme === 'dark'
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {theme === 'light' ? (
                      <Moon className="w-4 h-4" />
                    ) : (
                      <Sun className="w-4 h-4" />
                    )}
                    {theme === 'light' ? t('admin.header.dark_mode') || 'Mode sombre' : t('admin.header.light_mode') || 'Mode clair'}
                  </button>
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
                    {t('admin.layout.logout')}
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
              {hasPermission('agenda', 'can_view') && (
                <Link
                  href="/admin"
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors relative ${
                    pathname === '/admin'
                      ? 'bg-blue-600 text-white'
                      : theme === 'dark'
                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>{t('admin.header.agenda')}</span>
                  {hasPendingOrders && pathname !== '/admin/orders' && (
                    <span className="bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full ml-auto animate-pulse">
                      !
                    </span>
                  )}
                </Link>
              )}
              {hasPermission('clients', 'can_view') && (
                <Link
                  href="/admin/clients"
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname === '/admin/clients'
                      ? 'bg-blue-600 text-white'
                      : theme === 'dark'
                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>{t('admin.header.clients')}</span>
                  {hasUnreadRequests && (
                    <span className="bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full ml-auto animate-pulse">
                      {unreadContactRequests}
                    </span>
                  )}
                </Link>
              )}
              {hasPermission('orders', 'can_view') && (
                <Link
                  href="/admin/orders"
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors relative ${
                    pathname === '/admin/orders'
                      ? 'bg-blue-600 text-white'
                      : theme === 'dark'
                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>{t('admin.header.orders')}</span>
                  <span className="flex items-center gap-1 ml-auto">
                    {hasPendingOrders && (
                      <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                        {pendingOrdersCount}
                      </span>
                    )}
                    {hasUnseenAborted && (
                      <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                        {unseenAbortedCount}
                      </span>
                    )}
                  </span>
                </Link>
              )}
              {hasPermission('chat', 'can_view') && (
                <Link
                  href="/admin/chat"
                  onClick={closeMobileMenu}
                  className={`relative flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname === '/admin/chat'
                      ? 'bg-blue-600 text-white'
                      : theme === 'dark'
                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{t('admin.header.chat')}</span>
                  <span className="flex items-center gap-1 ml-auto">
                    {hasNeedsHuman && (
                      <span className="bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-0.5">
                        <HandHelping className="w-3 h-3" />
                        {needsHumanCount}
                      </span>
                    )}
                    {hasUnreadChats && (
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                        {unreadChatsCount > 9 ? '9+' : unreadChatsCount}
                      </span>
                    )}
                  </span>
                </Link>
              )}
              {hasPermission('calls', 'can_view') && (
                <Link
                  href="/admin/calls"
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname === '/admin/calls'
                      ? 'bg-blue-600 text-white'
                      : theme === 'dark'
                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  <span>{t('admin.header.calls') || 'Appels'}</span>
                </Link>
              )}
            </div>

            {/* Sélecteur de langue mobile */}
            <div className={`pt-3 border-t ${
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className={`px-4 py-2 text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('admin.layout.language')}
              </div>
              <div className="flex gap-2 px-4">
                {(Object.keys(languageFlags) as Locale[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      setLocale(lang)
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      locale === lang
                        ? 'bg-blue-600 text-white'
                        : theme === 'dark'
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span>{languageFlags[lang].flag}</span>
                    <span className="text-sm">{t(languageFlags[lang].key)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Utilisateur mobile */}
            <div className={`pt-3 border-t ${
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className={`px-4 py-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <div className="text-sm font-medium">
                  {getUserDisplayName()}
                </div>
                <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {user.email}
                </div>
                {getRoleBadge()}
              </div>
              {/* Liens administration mobile - basés sur les permissions */}
              {hasPermission('users', 'can_view') && (
                <Link
                  href="/admin/users"
                  onClick={closeMobileMenu}
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname === '/admin/users'
                      ? 'bg-blue-600 text-white'
                      : theme === 'dark'
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>{t('admin.header.users')}</span>
                </Link>
              )}
              {hasPermission('logs', 'can_view') && (
                <Link
                  href="/admin/logs"
                  onClick={closeMobileMenu}
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname === '/admin/logs'
                      ? 'bg-blue-600 text-white'
                      : theme === 'dark'
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>{t('admin.header.logs')}</span>
                </Link>
              )}
              {hasPermission('permissions', 'can_view') && (
                <Link
                  href="/admin/permissions"
                  onClick={closeMobileMenu}
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    pathname === '/admin/permissions'
                      ? 'bg-blue-600 text-white'
                      : theme === 'dark'
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <span>{t('admin.header.permissions')}</span>
                </Link>
              )}
              {/* Liens admin mobile (statistics, settings, permissions, roles) */}
              {(hasPermission('settings', 'can_view') || user.role === 'super_admin') && (
                <>
                  <Link
                    href="/admin/statistics"
                    onClick={closeMobileMenu}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                      pathname === '/admin/statistics'
                        ? 'bg-blue-600 text-white'
                        : theme === 'dark'
                          ? 'text-gray-300 hover:bg-gray-700'
                          : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>{t('admin.header.statistics')}</span>
                  </Link>
                  <Link
                    href="/admin/settings"
                    onClick={closeMobileMenu}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                      pathname === '/admin/settings'
                        ? 'bg-blue-600 text-white'
                        : theme === 'dark'
                          ? 'text-gray-300 hover:bg-gray-700'
                          : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span>{t('admin.header.settings')}</span>
                  </Link>
                </>
              )}
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
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
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
                <span>{t('admin.layout.logout')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

// Memoize pour éviter les re-renders inutiles
export const AdminHeader = memo(AdminHeaderComponent)
