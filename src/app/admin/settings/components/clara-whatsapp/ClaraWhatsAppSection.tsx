'use client'

import { useState } from 'react'
import { Bot } from 'lucide-react'
import { GeneralTab } from './GeneralTab'
import { FAQTab } from './FAQTab'
import { AgentsTab } from './AgentsTab'
import { OnboardingTab } from './OnboardingTab'

type TabId = 'general' | 'faq' | 'agents' | 'onboarding'

interface ClaraWhatsAppSectionProps {
  isDark: boolean
}

export function ClaraWhatsAppSection({ isDark }: ClaraWhatsAppSectionProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general')

  const tabs: { id: TabId; label: string }[] = [
    { id: 'general', label: 'Général' },
    { id: 'faq', label: 'FAQ' },
    { id: 'agents', label: 'Agents' },
    { id: 'onboarding', label: 'Onboarding' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Bot className={`w-6 h-6 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Clara WhatsApp
          </h2>
        </div>
        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Configuration de l&apos;assistant IA WhatsApp multi-agent
        </p>
      </div>

      {/* Horizontal Tabs */}
      <div className="flex space-x-1 border-b" style={{ borderColor: isDark ? '#374151' : '#E5E7EB' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab.id
                ? isDark
                  ? 'text-orange-400 border-b-2 border-orange-400'
                  : 'text-orange-600 border-b-2 border-orange-600'
                : isDark
                ? 'text-gray-400 hover:text-gray-300'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'general' && <GeneralTab isDark={isDark} />}
        {activeTab === 'faq' && <FAQTab isDark={isDark} />}
        {activeTab === 'agents' && <AgentsTab isDark={isDark} />}
        {activeTab === 'onboarding' && <OnboardingTab isDark={isDark} />}
      </div>
    </div>
  )
}
