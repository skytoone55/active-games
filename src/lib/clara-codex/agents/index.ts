import type { AgentHandler, AgentId } from './types'
import { infoAgent } from './info/index'
import { resaGameAgent } from './resa-game/index'
import { resaEventAgent } from './resa-event/index'
import { afterSaleAgent } from './after-sale/index'
import { escalationAgent } from './escalation/index'

export const AGENTS: Record<AgentId, AgentHandler> = {
  router: null as unknown as AgentHandler, // Router is not an agent handler
  info: infoAgent,
  resa_game: resaGameAgent,
  resa_event: resaEventAgent,
  after_sale: afterSaleAgent,
  escalation: escalationAgent,
}

export function getAgent(agentId: AgentId): AgentHandler | null {
  if (agentId === 'router') return null
  return AGENTS[agentId] || null
}

export * from './types'
export * from './defaults'
