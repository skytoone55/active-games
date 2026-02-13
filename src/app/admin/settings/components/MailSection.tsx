'use client'

import { useState } from 'react'
import { Mail, Zap, ScrollText } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'
import { EmailTemplatesEditor } from './EmailTemplatesEditor'
import { EmailAutomationsSection } from './EmailAutomationsSection'
import { TermsConditionsSection } from './TermsConditionsSection'

interface MailSectionProps {
  isDark: boolean
}

type SubTab = 'templates' | 'automations' | 'terms'

export function MailSection({ isDark }: MailSectionProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<SubTab>('templates')

  const tabs = [
    {
      id: 'templates' as SubTab,
      icon: Mail,
      label: t('admin.settings.mail_tabs.templates') || 'Templates',
    },
    {
      id: 'automations' as SubTab,
      icon: Zap,
      label: t('admin.settings.mail_tabs.automations') || 'Automatisations',
    },
    {
      id: 'terms' as SubTab,
      icon: ScrollText,
      label: t('admin.settings.mail_tabs.terms') || 'CGV',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className={`flex gap-1 p-1 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                isActive
                  ? isDark
                    ? 'bg-gray-700 text-white'
                    : 'bg-white text-gray-900 shadow-sm'
                  : isDark
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {activeTab === 'templates' && <EmailTemplatesEditor isDark={isDark} />}
      {activeTab === 'automations' && <EmailAutomationsSection isDark={isDark} />}
      {activeTab === 'terms' && <TermsConditionsSection isDark={isDark} />}
    </div>
  )
}
