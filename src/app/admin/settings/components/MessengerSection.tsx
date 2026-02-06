'use client'

import { useState } from 'react'
import { useTranslation } from '@/contexts/LanguageContext'
import { SettingsPanel } from './messenger/SettingsPanel'
import { FAQSection } from './messenger/FAQSection'
import { ModulesLibrary } from './messenger/ModulesLibrary'
import { WorkflowsList } from './messenger/WorkflowsList'

interface MessengerSectionProps {
  isDark: boolean
}

export function MessengerSection({ isDark }: MessengerSectionProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'settings' | 'faq' | 'modules' | 'workflows'>('settings')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {t('messenger.title')}
        </h2>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {t('messenger.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b" style={{ borderColor: isDark ? '#374151' : '#E5E7EB' }}>
        {[
          { key: 'settings', label: t('messenger.settings.title') },
          { key: 'faq', label: t('messenger.faq.title') },
          { key: 'modules', label: t('messenger.modules.title') },
          { key: 'workflows', label: t('messenger.workflows.title') }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab.key
                ? isDark
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-blue-600 border-b-2 border-blue-600'
                : isDark
                ? 'text-gray-400 hover:text-gray-300'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'settings' && <SettingsPanel isDark={isDark} />}
        {activeTab === 'faq' && <FAQSection isDark={isDark} />}
        {activeTab === 'modules' && <ModulesLibrary isDark={isDark} />}
        {activeTab === 'workflows' && <WorkflowsList isDark={isDark} />}
      </div>
    </div>
  )
}
