'use client'

import { useState } from 'react'
import {
  Loader2,
  AlertCircle,
  Settings,
  FileText,
  ChevronRight,
  CreditCard,
  Package,
  Sparkles,
  MessageSquare,
  Phone
} from 'lucide-react'
import { useAdmin } from '@/contexts/AdminContext'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import { useTranslation } from '@/contexts/LanguageContext'
import { TemplatesSection } from './components/TemplatesSection'
import { CredentialsSection } from './components/CredentialsSection'
import { ICountCatalogSection } from './components/ICountCatalogSection'
import { ClaraSection } from './components/ClaraSection'
import { MessengerSection } from './components/MessengerSection'
import { WhatsAppSection } from './components/WhatsAppSection'

type SettingsSection = 'templates' | 'credentials' | 'catalog' | 'messenger' | 'whatsapp' | 'clara'

export default function SettingsPage() {
  const { t } = useTranslation()
  const { user, branches, selectedBranch, isDark } = useAdmin()
  const { hasPermission, loading: permissionsLoading } = useUserPermissions(user?.role || 'agent')

  const [activeSection, setActiveSection] = useState<SettingsSection>('templates')

  // Check permissions for settings access
  const canViewSettings = user && hasPermission('settings', 'can_view')

  if (user && !permissionsLoading && !canViewSettings) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('admin.settings.access_denied')}
          </h1>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            {t('admin.settings.access_denied_message')}
          </p>
        </div>
      </div>
    )
  }

  // Loading state
  if (permissionsLoading || !user || !selectedBranch) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    )
  }

  const allSections: { id: SettingsSection; icon: typeof FileText; label: string; description: string; requiredPermission?: 'settings' | 'messenger' }[] = [
    {
      id: 'templates',
      icon: FileText,
      label: t('admin.settings.sections.templates'),
      description: t('admin.settings.sections.templates_desc'),
      requiredPermission: 'settings'
    },
    {
      id: 'credentials',
      icon: CreditCard,
      label: t('admin.settings.sections.credentials'),
      description: t('admin.settings.sections.credentials_desc'),
      requiredPermission: 'settings'
    },
    {
      id: 'catalog',
      icon: Package,
      label: 'Catalogue iCount',
      description: 'Produits et formules',
      requiredPermission: 'settings'
    },
    {
      id: 'messenger',
      icon: MessageSquare,
      label: 'Messenger',
      description: 'Messagerie automatisée',
      requiredPermission: 'messenger'
    },
    {
      id: 'whatsapp',
      icon: Phone,
      label: 'WhatsApp',
      description: t('admin.settings.sections.whatsapp_desc'),
      requiredPermission: 'settings'
    },
    {
      id: 'clara',
      icon: Sparkles,
      label: 'Clara AI',
      description: t('admin.settings.sections.clara_desc'),
      requiredPermission: 'settings'
    }
  ]

  // Filter sections based on permissions
  const sections = allSections.filter(section => {
    if (!section.requiredPermission) return true
    return hasPermission(section.requiredPermission, 'can_view')
  })

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      {/* Sub-header with title */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isDark ? 'bg-orange-500/20' : 'bg-orange-100'
          }`}>
            <Settings className={`w-6 h-6 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('admin.settings.title')}
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('admin.settings.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Main content with sidebar */}
      <div className="flex">
        {/* Sidebar */}
        <div className={`w-64 min-h-[calc(100vh-140px)] border-r ${
          isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <nav className="p-4 space-y-1">
            {sections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id

              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors ${
                    isActive
                      ? isDark
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-orange-100 text-orange-700'
                      : isDark
                        ? 'hover:bg-gray-700 text-gray-300'
                        : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{section.label}</p>
                    <p className={`text-xs truncate ${
                      isActive
                        ? isDark ? 'text-orange-300/70' : 'text-orange-600/70'
                        : isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      {section.description}
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`} />
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content area */}
        <div className="flex-1 p-6">
          {activeSection === 'templates' && (
            <TemplatesSection isDark={isDark} />
          )}
          {activeSection === 'credentials' && (
            <CredentialsSection isDark={isDark} />
          )}
          {activeSection === 'catalog' && (
            <ICountCatalogSection isDark={isDark} />
          )}
          {activeSection === 'messenger' && (
            <MessengerSection isDark={isDark} />
          )}
          {activeSection === 'whatsapp' && (
            <WhatsAppSection isDark={isDark} />
          )}
          {activeSection === 'clara' && (
            <ClaraSection isDark={isDark} />
          )}
        </div>
      </div>
    </div>
  )
}
