/**
 * Clara AI Service
 * Handles natural language processing for messenger modules
 */

import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { detectMessageLanguage } from './language-detect'

// Type definitions
export interface ClaraConfig {
  enabled: boolean
  prompt: string
  personality?: string  // Customizable personality section
  rules?: string        // Customizable rules section
  model: string
  temperature: number
  timeout_ms: number
}

export interface ClaraRequest {
  userMessage: string
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  collectedData: Record<string, any>
  config: ClaraConfig
  locale?: string  // User's language: 'fr', 'en', 'he'
  moduleContext?: {
    content: string  // The question/message of the current module
    choices?: Array<{ id: string; label: any }>  // Available choices if choix_multiples
    validationFormat?: string  // Expected format (email, phone, date, etc.)
  }
  systemContext?: {
    branches?: string[]  // Available branches
    faqItems?: Array<{ question: string; answer: string }>  // FAQ for off-topic questions
  }
}

export interface ClaraResponse {
  success: boolean
  reply?: string
  show_buttons?: Array<{
    id: string
    label: string | { he?: string; fr?: string; en?: string }
  }>
  collected_data?: Record<string, any>
  is_complete?: boolean
  error?: string
  timeout?: boolean
}

/**
 * Robustly parse JSON from AI response (handles markdown backticks, text around JSON, etc.)
 */
function parseJsonResponse(text: string): any {
  // Try direct parse first
  try { return JSON.parse(text) } catch {}
  // Try extracting JSON from markdown code block
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()) } catch {}
  }
  // Try extracting first { ... } block
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(text.slice(firstBrace, lastBrace + 1)) } catch {}
  }
  throw new Error(`Failed to parse JSON from response: ${text.slice(0, 200)}`)
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

    console.log('[Clara] OpenAI raw response:', response.slice(0, 300))
    const parsed = parseJsonResponse(response)
    return {
      success: true,
      reply: parsed.reply_to_user || parsed.reply,
      show_buttons: parsed.show_buttons || undefined,
      collected_data: parsed.collected_data,
      is_complete: parsed.is_complete ?? false
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[Clara] OpenAI TIMEOUT after', timeoutMs, 'ms')
      return { success: false, timeout: true, error: 'OpenAI timeout' }
    }
    console.error('[Clara] OpenAI error:', error.message, error.status || '')
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
    }, { signal: controller.signal })

    clearTimeout(timeoutId)

    const response = completion.content[0]
    if (response.type !== 'text') throw new Error('Invalid Claude response type')

    const parsed = parseJsonResponse(response.text)
    return {
      success: true,
      reply: parsed.reply_to_user || parsed.reply,
      show_buttons: parsed.show_buttons || undefined,
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

    const chat = geminiModel.startChat({
      history: chatHistory,
      generationConfig: {
        temperature,
        maxOutputTokens: 1024
      }
    })

    // Gemini SDK does not support AbortController — use Promise.race with a timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini timeout')), timeoutMs)
    )

    const result = await Promise.race([
      chat.sendMessage(
        systemPrompt ? `${systemPrompt}\n\n${lastUserMessage}` : lastUserMessage
      ),
      timeoutPromise
    ])

    const response = result.response.text()
    const parsed = parseJsonResponse(response)

    return {
      success: true,
      reply: parsed.reply_to_user || parsed.reply,
      show_buttons: parsed.show_buttons || undefined,
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
  const { userMessage, conversationHistory, collectedData, config, moduleContext, systemContext, locale } = request

  if (!config.enabled) {
    return { success: false, error: 'Clara not enabled for this module' }
  }

  // Detect user language from their actual message (not locale which is site language)
  const detectedLang = detectMessageLanguage(userMessage)
  const langMap: Record<string, string> = { fr: 'français', en: 'English', he: 'עברית' }
  const userLang = langMap[detectedLang] || langMap[locale || 'he'] || 'עברית'

  // Build optimized system prompt — ALL IN ENGLISH to avoid French bias
  // Personality and rules come from DB (customizable) or use defaults
  const personality = config.personality || 'You are a warm, friendly, and natural assistant. Be conversational and personable.'
  const rules = config.rules || '- Answer questions briefly then continue with the module question'

  let enhancedPrompt = `ABSOLUTE RULE #1: You MUST respond in the SAME LANGUAGE as the user's last message. Detected language: ${userLang}. French→French, English→English, עברית→עברית. Default: ${userLang}.

` + config.prompt + `

## YOUR PERSONALITY
${personality}

## MANDATORY JSON RESPONSE
{"reply_to_user": "text", "is_complete": true/false, "collected_data": {"KEY": "value"}}

## RULES
${rules}
- CRITICAL LANGUAGE RULE: Your ENTIRE response must be in ONE language only: ${userLang}. The module question is provided in that language. Do NOT mix languages. Do NOT add translations. Every word must be in ${userLang}.`

  // Module context
  if (moduleContext) {
    enhancedPrompt += `\n\n## CURRENT MODULE: "${moduleContext.content}"`

    if (moduleContext.choices && moduleContext.choices.length > 0) {
      enhancedPrompt += `\nOptions:`
      moduleContext.choices.forEach((choice, idx) => {
        const label = typeof choice.label === 'string' ? choice.label :
                     choice.label[detectedLang] || choice.label[locale || 'he'] || choice.label.he || choice.label.fr || choice.label.en || ''
        enhancedPrompt += ` ${idx + 1}."${choice.id}"="${label}"`
      })
      enhancedPrompt += `\nValid choice→is_complete:true. Unclear→is_complete:false, remind options naturally.`
    }

    if (moduleContext.validationFormat) {
      enhancedPrompt += `\nFormat: ${moduleContext.validationFormat}`
    }
  }

  // System context (branches + FAQ pertinentes seulement)
  if (systemContext) {
    if (systemContext.branches && systemContext.branches.length > 0) {
      enhancedPrompt += `\nBranches: ${systemContext.branches.join(', ')}`
    }

    if (systemContext.faqItems && systemContext.faqItems.length > 0) {
      enhancedPrompt += `\n\n## RELEVANT FAQ`
      systemContext.faqItems.forEach(faq => {
        enhancedPrompt += `\nQ: ${faq.question}\nA: ${faq.answer}`
      })
    }
  }

  if (Object.keys(collectedData).length > 0) {
    enhancedPrompt += `\n\nAlready collected: ${JSON.stringify(collectedData)}`
  }

  // Build messages array
  // Note: conversationHistory already includes the current user message (inserted in engine.ts before calling Clara)
  // So we do NOT add userMessage again to avoid duplication
  const lastMsg = conversationHistory[conversationHistory.length - 1]
  const historyAlreadyHasCurrentMsg = lastMsg && lastMsg.role === 'user' && lastMsg.content === userMessage

  const messages = [
    {
      role: 'system',
      content: enhancedPrompt
    },
    ...conversationHistory,
    // Only add userMessage if it's not already the last message in history
    ...(!historyAlreadyHasCurrentMsg ? [{ role: 'user', content: userMessage }] : [])
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
 * Strict format validation for critical fields
 * This runs AFTER Clara to ensure formats are EXACTLY correct
 */
export function validateCriticalFormats(collectedData: Record<string, any>): {
  isValid: boolean
  invalidFields: Array<{ field: string; issue: string }>
} {
  const invalidFields: Array<{ field: string; issue: string }> = []

  // WELCOME (branch) - no hardcoded validation; branches come from DB choices
  // The user selects from workflow buttons, so the value is always valid

  // NUMBER (phone) - MUST be exactly 10 digits starting with 0
  if (collectedData.NUMBER || collectedData.phone) {
    const phone = collectedData.NUMBER || collectedData.phone
    const phoneRegex = /^0[0-9]{9}$/
    if (!phoneRegex.test(phone)) {
      invalidFields.push({
        field: 'phone',
        issue: `Must be 10 digits starting with 0, got: "${phone}"`
      })
    }
  }

  // DATE - MUST be YYYY-MM-DD format
  if (collectedData.DATE || collectedData.date) {
    const date = collectedData.DATE || collectedData.date
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      invalidFields.push({
        field: 'date',
        issue: `Must be YYYY-MM-DD format, got: "${date}"`
      })
    }
  }

  // TIME - MUST be HH:MM format (24h)
  if (collectedData.TIME || collectedData.time) {
    const time = collectedData.TIME || collectedData.time
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(time)) {
      invalidFields.push({
        field: 'time',
        issue: `Must be HH:MM format (24h), got: "${time}"`
      })
    }
  }

  // RESERVATION1 (gameArea) - MUST be exact
  if (collectedData.RESERVATION1 || collectedData.gameArea) {
    const gameArea = collectedData.RESERVATION1 || collectedData.gameArea
    if (gameArea !== 'LASER' && gameArea !== 'ACTIVE_TIME' && gameArea !== 'MIX') {
      invalidFields.push({
        field: 'gameArea',
        issue: `Must be exactly "LASER", "ACTIVE_TIME", or "MIX", got: "${gameArea}"`
      })
    }
  }

  // RESERVATION2 (participants) - MUST be a number
  if (collectedData.RESERVATION2 || collectedData.participants) {
    const participants = collectedData.RESERVATION2 || collectedData.participants
    const participantsNum = parseInt(participants)
    if (isNaN(participantsNum) || participantsNum < 1 || participantsNum > 100) {
      invalidFields.push({
        field: 'participants',
        issue: `Must be a number between 1-100, got: "${participants}"`
      })
    }
  }

  // NAME - Should have at least a first name
  if (collectedData.NAME || collectedData.firstName) {
    const name = collectedData.NAME || collectedData.firstName
    if (typeof name !== 'string' || name.trim().length < 2) {
      invalidFields.push({
        field: 'name',
        issue: `Must be at least 2 characters, got: "${name}"`
      })
    }
  }

  return {
    isValid: invalidFields.length === 0,
    invalidFields
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
