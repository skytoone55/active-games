/**
 * Clara AI Service
 * Handles natural language processing for messenger modules
 */

import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Type definitions
export interface ClaraConfig {
  enabled: boolean
  prompt: string
  model: string
  temperature: number
  timeout_ms: number
}

export interface ClaraRequest {
  userMessage: string
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  collectedData: Record<string, any>
  config: ClaraConfig
}

export interface ClaraResponse {
  success: boolean
  reply?: string
  collected_data?: Record<string, any>
  is_complete?: boolean
  error?: string
  timeout?: boolean
}

// Initialize AI clients (lazy loading)
let openaiClient: OpenAI | null = null
let anthropicClient: Anthropic | null = null
let geminiClient: GoogleGenerativeAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured')
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
    anthropicClient = new Anthropic({ apiKey })
  }
  return anthropicClient
}

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured')
    geminiClient = new GoogleGenerativeAI(apiKey)
  }
  return geminiClient
}

/**
 * Call OpenAI models (GPT-4o, GPT-4o-mini, GPT-3.5-turbo)
 */
async function callOpenAI(
  messages: Array<{ role: string; content: string }>,
  model: string,
  temperature: number,
  timeoutMs: number
): Promise<ClaraResponse> {
  try {
    const client = getOpenAIClient()

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const completion = await client.chat.completions.create({
      model,
      messages: messages as any,
      temperature,
      response_format: { type: 'json_object' }
    }, { signal: controller.signal })

    clearTimeout(timeoutId)

    const response = completion.choices[0]?.message?.content
    if (!response) throw new Error('Empty response from OpenAI')

    const parsed = JSON.parse(response)
    return {
      success: true,
      reply: parsed.reply_to_user || parsed.reply,
      collected_data: parsed.collected_data,
      is_complete: parsed.is_complete ?? false
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, timeout: true, error: 'OpenAI timeout' }
    }
    console.error('[Clara] OpenAI error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Call Anthropic Claude models (Claude 3.5 Sonnet, Claude 3 Haiku)
 */
async function callAnthropic(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  model: string,
  temperature: number,
  timeoutMs: number
): Promise<ClaraResponse> {
  try {
    const client = getAnthropicClient()

    // Filter out system messages and convert to Claude format
    const claudeMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const completion = await client.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: claudeMessages,
      temperature
    })

    clearTimeout(timeoutId)

    const response = completion.content[0]
    if (response.type !== 'text') throw new Error('Invalid Claude response type')

    const parsed = JSON.parse(response.text)
    return {
      success: true,
      reply: parsed.reply_to_user || parsed.reply,
      collected_data: parsed.collected_data,
      is_complete: parsed.is_complete ?? false
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, timeout: true, error: 'Claude timeout' }
    }
    console.error('[Clara] Claude error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Call Google Gemini models (Gemini 1.5 Pro, Gemini 1.5 Flash)
 */
async function callGemini(
  messages: Array<{ role: string; content: string }>,
  model: string,
  temperature: number,
  timeoutMs: number
): Promise<ClaraResponse> {
  try {
    const client = getGeminiClient()
    const geminiModel = client.getGenerativeModel({ model })

    // Convert messages to Gemini format
    const systemPrompt = messages.find(m => m.role === 'system')?.content || ''
    const history = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }))

    const lastUserMessage = history[history.length - 1]?.parts[0]?.text || ''
    const chatHistory = history.slice(0, -1)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const chat = geminiModel.startChat({
      history: chatHistory,
      generationConfig: {
        temperature,
        maxOutputTokens: 1024
      }
    })

    const result = await chat.sendMessage(
      systemPrompt ? `${systemPrompt}\n\n${lastUserMessage}` : lastUserMessage
    )

    clearTimeout(timeoutId)

    const response = result.response.text()
    const parsed = JSON.parse(response)

    return {
      success: true,
      reply: parsed.reply_to_user || parsed.reply,
      collected_data: parsed.collected_data,
      is_complete: parsed.is_complete ?? false
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, timeout: true, error: 'Gemini timeout' }
    }
    console.error('[Clara] Gemini error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Main Clara processing function
 */
export async function processWithClara(request: ClaraRequest): Promise<ClaraResponse> {
  const { userMessage, conversationHistory, collectedData, config } = request

  if (!config.enabled) {
    return { success: false, error: 'Clara not enabled for this module' }
  }

  // Build messages array
  const messages = [
    {
      role: 'system',
      content: `${config.prompt}

IMPORTANT: You must respond ONLY with valid JSON in this exact format:
{
  "reply_to_user": "Your natural response to the user",
  "collected_data": {
    "field_name": "extracted_value"
  },
  "is_complete": false
}

Current collected data: ${JSON.stringify(collectedData)}

Rules:
- Extract information from user messages and add to collected_data
- Set is_complete to true only when ALL required fields are collected
- Be conversational and natural in reply_to_user
- If user asks off-topic questions, answer briefly then guide back to booking`
    },
    ...conversationHistory.slice(-5), // Last 5 messages for context
    { role: 'user', content: userMessage }
  ]

  // Route to appropriate AI provider
  const model = config.model.toLowerCase()

  try {
    if (model.startsWith('gpt')) {
      return await callOpenAI(messages, config.model, config.temperature, config.timeout_ms)
    } else if (model.startsWith('claude')) {
      const systemPrompt = messages.find(m => m.role === 'system')?.content || ''
      return await callAnthropic(messages, systemPrompt, config.model, config.temperature, config.timeout_ms)
    } else if (model.startsWith('gemini')) {
      return await callGemini(messages, config.model, config.temperature, config.timeout_ms)
    } else {
      return { success: false, error: `Unknown model: ${config.model}` }
    }
  } catch (error: any) {
    console.error('[Clara] Processing error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Validate that all required fields are collected before check_availability
 */
export function validateRequiredFields(collectedData: Record<string, any>): {
  isValid: boolean
  missingFields: string[]
} {
  const requiredFields = [
    'branch',
    'firstName',
    'phone',
    'date',
    'time',
    'participants',
    'gameArea'
  ]

  const missingFields = requiredFields.filter(field => !collectedData[field])

  return {
    isValid: missingFields.length === 0,
    missingFields
  }
}
