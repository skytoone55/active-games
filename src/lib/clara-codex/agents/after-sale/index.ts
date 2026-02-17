import { streamCodexResponse, toModelMessagesFromWhatsApp } from '../../llm'
import { getModelProvider } from '../../config'
import { trackCodexEvent } from '../../tracking'
import { buildAgentPrompt } from '../shared-prompt'
import { searchOrderByPhone } from './tools'
import { createEscalateToHumanTool } from '../escalation/index'
import type { AgentHandler, AgentResponse } from '../types'

export const afterSaleAgent: AgentHandler = {
  id: 'after_sale',

  async run({ context, config, history, supabase }): Promise<AgentResponse> {
    const systemPrompt = buildAgentPrompt({ config, context })
    const provider = getModelProvider(config.model)
    const modelMessages = toModelMessagesFromWhatsApp(history, 40)

    const tools = {
      searchOrderByPhone,
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
        await trackCodexEvent(supabase, context.conversationId, context.branchId, 'tool_called', { toolName, agentId: 'after_sale' })
      }
      if (part.type === 'tool-result') {
        const result = (part as { result?: { error?: string } }).result
        if (result?.error) toolErrors++
        else toolErrors = 0
      }
    }

    return { text: fullText.trim(), usedEscalationTool, toolErrors, agentId: 'after_sale' }
  },
}
