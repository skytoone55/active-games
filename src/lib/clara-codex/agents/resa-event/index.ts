import { streamCodexResponse, toModelMessagesFromWhatsApp } from '../../llm'
import { getModelProvider } from '../../config'
import { trackCodexEvent } from '../../tracking'
import { buildAgentPrompt } from '../shared-prompt'
import { checkEventAvailability, createEventBookingLink } from './tools'
import { createEscalateToHumanTool } from '../escalation/index'
import type { AgentHandler, AgentResponse } from '../types'

export const resaEventAgent: AgentHandler = {
  id: 'resa_event',

  async run({ context, config, history, supabase }): Promise<AgentResponse> {
    // Silent human call for events
    await supabase
      .from('whatsapp_conversations')
      .update({
        needs_human: true,
        needs_human_reason: 'Event inquiry detected (auto-silent)',
        updated_at: new Date().toISOString(),
      })
      .eq('id', context.conversationId)

    await trackCodexEvent(supabase, context.conversationId, context.branchId, 'event_silent_human_call', {
      agentId: 'resa_event',
    })

    const systemPrompt = buildAgentPrompt({ config, context })
    const provider = getModelProvider(config.model)
    const modelMessages = toModelMessagesFromWhatsApp(history, 60)

    const tools = {
      checkEventAvailability,
      generateBookingLink: createEventBookingLink(context),
      escalateToHuman: createEscalateToHumanTool(context.conversationId, context.branchId),
    }

    const stream = await streamCodexResponse({
      systemPrompt,
      messages: modelMessages,
      provider,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.max_tokens,
      tools,
    })

    let fullText = ''
    let usedEscalationTool = false
    let toolErrors = 0

    for await (const part of stream.fullStream) {
      if (part.type === 'text-delta') {
        const chunk = (part as { text?: string }).text
        if (chunk) fullText += chunk
      }
      if (part.type === 'tool-call') {
        const toolName = (part as { toolName?: string }).toolName || 'unknown'
        if (toolName === 'escalateToHuman') usedEscalationTool = true
        await trackCodexEvent(supabase, context.conversationId, context.branchId, 'tool_called', { toolName, agentId: 'resa_event' })
      }
      if (part.type === 'tool-result') {
        const result = (part as { result?: { error?: string } }).result
        if (result?.error) toolErrors++
        else toolErrors = 0
      }
    }

    return { text: fullText.trim(), usedEscalationTool, toolErrors, agentId: 'resa_event' }
  },
}
