import type { ToolSet } from 'ai'

export type AgentId = 'router' | 'info' | 'resa_game' | 'resa_event' | 'after_sale' | 'escalation'

/** Conversation context profile — tracked across agent switches */
export interface ConversationProfile {
  resa_type?: 'game' | 'event' | null
  game_type?: 'laser' | 'active' | 'mix' | null
  participants?: number | null
  date?: string | null
  locale?: string | null
}

export interface AgentConfig {
  id: AgentId
  label: string
  description: string
  model: string
  temperature: number
  max_tokens: number
  prompt: string
  enabled: boolean
}

export interface AgentContext {
  conversationId: string
  branchId: string | null
  senderPhone: string
  contactName: string | null
  contactId: string | null
  locale: string
  nowISO: string
  nowLabel: string
  humanAvailable: boolean
  routerSummary?: string
  profile?: ConversationProfile
}

export interface RouterResult {
  agent: AgentId
  locale: string
  summary: string
  resa_type?: 'game' | 'event' | null
  game_type?: 'laser' | 'active' | 'mix' | null
}

export interface AgentResponse {
  text: string
  usedEscalationTool: boolean
  toolErrors: number
  agentId: AgentId
}

export interface AgentHandler {
  id: AgentId
  run: (params: {
    context: AgentContext
    config: AgentConfig
    history: Array<{ direction: 'inbound' | 'outbound'; content: string | null }>
    messageText: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any
  }) => Promise<AgentResponse>
  getTools?: (context: AgentContext) => ToolSet
}

export const AGENT_LABELS: Record<AgentId, string> = {
  router: 'Router',
  info: 'Information',
  resa_game: 'Réservation Game',
  resa_event: 'Réservation Event',
  after_sale: 'Après-vente',
  escalation: 'Escalade',
}

export const AGENT_DESCRIPTIONS: Record<AgentId, string> = {
  router: 'Analyse le message et route vers le bon agent. Détecte la langue.',
  info: 'Répond aux questions générales : horaires, prix, accès, FAQ.',
  resa_game: 'Gère les réservations de jeux (Active, Laser). Vérifie les disponibilités.',
  resa_event: 'Gère les réservations événements/anniversaires. Vérifie salles + jeux.',
  after_sale: 'Gère les demandes de clients ayant déjà réservé (modification, annulation, infos).',
  escalation: 'Transfère la conversation à un agent humain.',
}
