/**
 * Clara Service - Service principal d'orchestration
 * Gère les conversations, le rate limiting, et l'intégration multi-LLM
 */

import { createClient } from '@supabase/supabase-js'
import { streamLLMResponse, convertToAIMessages, truncateHistory, createLLMOptionsFromSettings } from './llm-provider'
import { publicTools, crmTools } from './tools'
import { generatePublicSystemPrompt, CRM_SYSTEM_PROMPT, getWelcomeMessage, getQuickReplies } from './prompts'
import type { ClaraSettings, AIConversation, AIMessage, PublicConversation, PublicMessage } from '../supabase/types'
import type { ModelMessage } from 'ai'

// Client Supabase avec service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Cache des settings Clara
let claraSettingsCache: ClaraSettings | null = null
let settingsCacheTime = 0
const SETTINGS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Cache du prompt et knowledge personnalisés
let customPromptCache: string | null = null
let customKnowledgeCache: string | null = null
let promptCacheTime = 0
const PROMPT_CACHE_TTL = 2 * 60 * 1000 // 2 minutes (plus court pour refléter les changements rapidement)

/**
 * Récupère les settings Clara (avec cache)
 */
export async function getClaraSettings(): Promise<ClaraSettings> {
  const now = Date.now()

  if (claraSettingsCache && now - settingsCacheTime < SETTINGS_CACHE_TTL) {
    return claraSettingsCache
  }

  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'clara')
    .single()

  if (data?.value) {
    claraSettingsCache = data.value as unknown as ClaraSettings
    settingsCacheTime = now
    return claraSettingsCache
  }

  // Settings par défaut si non trouvés
  return {
    enabled: true,
    provider: 'gemini',
    model: 'gemini-2.0-flash-lite',
    max_tokens: 4096,
    temperature: 0.7,
    rate_limit_per_minute: 30,
    rate_limit_per_hour: 200,
    session_timeout_minutes: 30,
    max_conversation_messages: 150,
    public_chat: {
      enabled: true,
      welcome_message: 'שלום! אני קלרה, העוזרת הווירטואלית של Active Games.',
      quick_replies: [],
    },
    crm_chat: {
      enabled: true,
      features: ['search', 'stats', 'actions'],
    },
  }
}

/**
 * Récupère le prompt et knowledge personnalisés (avec cache)
 */
export async function getCustomPromptAndKnowledge(): Promise<{
  customPrompt: string | null
  customKnowledge: string | null
}> {
  const now = Date.now()

  if (promptCacheTime && now - promptCacheTime < PROMPT_CACHE_TTL) {
    return {
      customPrompt: customPromptCache,
      customKnowledge: customKnowledgeCache,
    }
  }

  // Récupérer les deux en parallèle
  const [promptResult, knowledgeResult] = await Promise.all([
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'clara_public_prompt')
      .single(),
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'clara_knowledge')
      .single(),
  ])

  customPromptCache = promptResult.data?.value?.prompt || null
  customKnowledgeCache = knowledgeResult.data?.value?.knowledge || null
  promptCacheTime = now

  return {
    customPrompt: customPromptCache,
    customKnowledge: customKnowledgeCache,
  }
}

/**
 * Construit le prompt système pour le chat public
 * Utilise le prompt personnalisé si disponible, sinon le défaut
 * IMPORTANT: Appelle generatePublicSystemPrompt() à chaque fois pour avoir la date/heure à jour
 */
export async function getPublicSystemPrompt(): Promise<string> {
  const { customPrompt, customKnowledge } = await getCustomPromptAndKnowledge()

  // Import dynamique pour éviter les dépendances circulaires
  const { CLARA_KNOWLEDGE } = await import('./knowledge')

  // Si un prompt personnalisé existe, l'utiliser avec le knowledge approprié
  if (customPrompt) {
    const knowledge = customKnowledge || CLARA_KNOWLEDGE
    // Injecter le knowledge à la fin du prompt personnalisé
    return `${customPrompt}

## BASE DE CONNAISSANCES
${knowledge}`
  }

  // Générer le prompt par défaut avec la date/heure actuelle
  const defaultPrompt = generatePublicSystemPrompt()

  // Si knowledge personnalisé, remplacer la section knowledge
  if (customKnowledge) {
    return defaultPrompt.replace(
      /## BASE DE CONNAISSANCES[\s\S]*?(?=Sois utile|$)/,
      `## BASE DE CONNAISSANCES
${customKnowledge}

`
    )
  }

  // Tout par défaut (avec date/heure à jour)
  return defaultPrompt
}

/**
 * Vérifie le rate limiting
 */
export async function checkRateLimit(identifier: string): Promise<{ allowed: boolean; remaining: number }> {
  const settings = await getClaraSettings()
  const now = new Date()
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)

  // Compter les requêtes dans la dernière minute
  const { count } = await supabase
    .from('clara_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('identifier', identifier)
    .gte('window_start', oneMinuteAgo.toISOString())

  const currentCount = count || 0
  const allowed = currentCount < settings.rate_limit_per_minute

  if (allowed) {
    // Enregistrer cette requête
    await supabase.from('clara_rate_limits').insert({
      identifier,
      window_start: now.toISOString(),
    })
  }

  return {
    allowed,
    remaining: Math.max(0, settings.rate_limit_per_minute - currentCount - 1),
  }
}

// ============================================
// CONVERSATIONS CRM (Utilisateurs authentifiés)
// ============================================

/**
 * Crée une nouvelle conversation CRM
 */
export async function createCRMConversation(userId: string, branchId?: string): Promise<AIConversation | null> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({
      user_id: userId,
      branch_id: branchId || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    console.error('[Clara] Error creating CRM conversation:', error)
    return null
  }

  return data
}

/**
 * Récupère les messages d'une conversation CRM
 */
export async function getCRMMessages(conversationId: string, limit = 150): Promise<AIMessage[]> {
  const { data } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  return data || []
}

/**
 * Ajoute un message à une conversation CRM
 */
export async function addCRMMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<AIMessage | null> {
  const { data, error } = await supabase
    .from('ai_messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      metadata,
    })
    .select()
    .single()

  if (error) {
    console.error('[Clara] Error adding CRM message:', error)
    return null
  }

  return data
}

/**
 * Envoie un message et obtient la réponse en streaming (CRM)
 */
export async function streamCRMResponse(
  conversationId: string,
  userMessage: string,
  userId: string
) {
  const settings = await getClaraSettings()

  // Vérifier que le CRM chat est activé
  if (!settings.crm_chat.enabled) {
    throw new Error('CRM chat is disabled')
  }

  // Sauvegarder le message utilisateur
  await addCRMMessage(conversationId, 'user', userMessage)

  // Récupérer l'historique
  const messages = await getCRMMessages(conversationId)
  const aiMessages = convertToAIMessages(messages)
  const truncatedMessages = truncateHistory(aiMessages)

  // Préparer les options LLM depuis les settings
  const llmOptions = createLLMOptionsFromSettings(settings)

  // Streamer la réponse
  const result = await streamLLMResponse({
    messages: truncatedMessages,
    systemPrompt: CRM_SYSTEM_PROMPT,
    provider: llmOptions.provider,
    model: llmOptions.model,
    maxTokens: llmOptions.maxTokens,
    temperature: llmOptions.temperature,
    tools: crmTools,
    onToolCall: (toolName, args) => {
      console.log(`[Clara CRM] Tool called: ${toolName}`, args)
    },
  })

  return result
}

// ============================================
// CONVERSATIONS PUBLIQUES (Visiteurs)
// ============================================

/**
 * Crée ou récupère une conversation publique
 */
export async function getOrCreatePublicConversation(
  sessionId: string,
  branchId?: string,
  metadata?: { ip?: string; userAgent?: string; locale?: string }
): Promise<PublicConversation> {
  // Chercher une conversation existante
  const { data: existing } = await supabase
    .from('public_conversations')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existing) {
    return existing
  }

  // Créer une nouvelle conversation
  const { data: created, error } = await supabase
    .from('public_conversations')
    .insert({
      session_id: sessionId,
      branch_id: branchId || null,
      ip_address: metadata?.ip || null,
      user_agent: metadata?.userAgent || null,
      locale: metadata?.locale || 'he',
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`)
  }

  return created
}

/**
 * Récupère les messages d'une conversation publique
 */
export async function getPublicMessages(conversationId: string, limit = 150): Promise<PublicMessage[]> {
  const { data } = await supabase
    .from('public_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  return data || []
}

/**
 * Ajoute un message à une conversation publique
 */
export async function addPublicMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<PublicMessage | null> {
  const { data, error } = await supabase
    .from('public_messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      metadata,
    })
    .select()
    .single()

  if (error) {
    console.error('[Clara] Error adding public message:', error)
    return null
  }

  return data
}

/**
 * Envoie un message et obtient la réponse en streaming (Public)
 */
export async function streamPublicResponse(
  conversationId: string,
  userMessage: string,
  identifier: string // IP ou session pour rate limiting
) {
  const settings = await getClaraSettings()

  // Vérifier que le chat public est activé
  if (!settings.public_chat.enabled) {
    throw new Error('Public chat is disabled')
  }

  // Rate limiting
  const rateLimit = await checkRateLimit(identifier)
  if (!rateLimit.allowed) {
    throw new Error('Rate limit exceeded. Please wait a moment.')
  }

  // Sauvegarder le message utilisateur
  await addPublicMessage(conversationId, 'user', userMessage)

  // Récupérer l'historique
  const messages = await getPublicMessages(conversationId)
  const aiMessages = convertToAIMessages(messages)
  const truncatedMessages = truncateHistory(aiMessages, 20000) // Limite plus basse pour public

  // Préparer les options LLM depuis les settings
  const llmOptions = createLLMOptionsFromSettings(settings)

  // Récupérer le prompt système avec la date/heure actuelle
  const systemPrompt = await getPublicSystemPrompt()

  // Streamer la réponse
  const result = await streamLLMResponse({
    messages: truncatedMessages,
    systemPrompt,
    provider: llmOptions.provider,
    model: llmOptions.model,
    maxTokens: llmOptions.maxTokens,
    temperature: llmOptions.temperature,
    tools: publicTools,
    onToolCall: (toolName, args) => {
      console.log(`[Clara Public] Tool called: ${toolName}`, args)
    },
  })

  return result
}

// ============================================
// UTILITAIRES
// ============================================

/**
 * Récupère les infos de bienvenue pour initialiser le chat
 */
export async function getChatInitData(context: 'public' | 'crm', locale: string = 'he') {
  const settings = await getClaraSettings()

  return {
    enabled: context === 'public' ? settings.public_chat.enabled : settings.crm_chat.enabled,
    welcomeMessage: getWelcomeMessage(context, locale),
    quickReplies: getQuickReplies(context, locale),
  }
}

/**
 * Nettoie les anciennes entrées de rate limiting
 */
export async function cleanupRateLimits(): Promise<void> {
  await supabase.rpc('cleanup_old_rate_limits')
}
