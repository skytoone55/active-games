/**
 * Clara AI - Module d'export principal
 *
 * Clara est l'assistante IA d'Active Games, utilisant Gemini 1.5 Flash
 *
 * INSTALLATION REQUISE:
 * npm install ai @ai-sdk/google zod
 *
 * VARIABLES D'ENVIRONNEMENT:
 * GOOGLE_AI_API_KEY=your_api_key
 */

// Service principal
export {
  getClaraSettings,
  getChatInitData,
  checkRateLimit,
  cleanupRateLimits,
  // CRM
  createCRMConversation,
  getCRMMessages,
  addCRMMessage,
  streamCRMResponse,
  // Public
  getOrCreatePublicConversation,
  getPublicMessages,
  addPublicMessage,
  streamPublicResponse,
} from './service'

// Gemini
export {
  streamGeminiResponse,
  generateGeminiResponse,
  testGeminiConnection,
  convertToAIMessages,
  truncateHistory,
  estimateTokens,
} from './gemini'

// Tools
export { publicTools, crmTools } from './tools'
export type { PublicToolName, CRMToolName } from './tools'

// Prompts
export {
  PUBLIC_SYSTEM_PROMPT,
  CRM_SYSTEM_PROMPT,
  getWelcomeMessage,
  getQuickReplies,
} from './prompts'

// Schema documentation
export { SUPABASE_SCHEMA_DOCUMENTATION, CLARA_SCHEMA_SUMMARY } from './supabase-schema'
