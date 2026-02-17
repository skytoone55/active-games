import { tool } from 'ai'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { getAvailableHumanStatus, trackCodexEvent } from '../../tracking'
import { resolveLocalizedCodexText } from '../../config'
import type { AgentHandler, AgentResponse, AgentContext, AgentConfig } from '../types'
import type { CodexLocalizedText } from '../../config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export function createEscalateToHumanTool(conversationId: string, branchId: string | null) {
  return tool({
    description: 'Flag this conversation for human follow-up. Use for complaints, uncertainty, complex context, tool failure, or explicit user request.',
    inputSchema: z.object({
      reason: z.string().min(2).describe('Short reason for escalation'),
      silent: z.boolean().optional().describe('If true, keep escalation internal'),
    }),
    execute: async ({ reason, silent }) => {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({
          needs_human: true,
          needs_human_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)

      if (error) return { success: false, error: error.message }

      const availability = await getAvailableHumanStatus(branchId)
      await trackCodexEvent(supabase, conversationId, branchId, 'escalated_to_human', {
        reason, silent: !!silent,
        humanAvailable: availability.available,
        connectedCount: availability.connectedCount,
      })

      return {
        success: true,
        humanAvailable: availability.available,
        connectedCount: availability.connectedCount,
        message: 'Conversation flagged for human follow-up.',
      }
    },
  })
}

export const escalationAgent: AgentHandler = {
  id: 'escalation',

  async run({ context, config, supabase }): Promise<AgentResponse> {
    // Direct escalation - no LLM needed
    await supabase
      .from('whatsapp_conversations')
      .update({
        needs_human: true,
        needs_human_reason: 'Routed to escalation agent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', context.conversationId)

    const availability = await getAvailableHumanStatus(context.branchId)

    await trackCodexEvent(supabase, context.conversationId, context.branchId, 'escalated_to_human', {
      reason: 'router_escalation',
      humanAvailable: availability.available,
      connectedCount: availability.connectedCount,
    })

    // Return appropriate message - will be resolved by the handler using fallback messages
    return {
      text: '',
      usedEscalationTool: true,
      toolErrors: 0,
      agentId: 'escalation',
    }
  },
}
