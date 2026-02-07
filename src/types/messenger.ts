/**
 * Types TypeScript pour le système Messenger
 * Architecture propre - v2.0
 */

// ============================================================================
// Types de base
// ============================================================================

export type Locale = 'fr' | 'en' | 'he'

export interface MultilingualText {
  fr: string
  en: string
  he: string
}

// ============================================================================
// Messenger Settings
// ============================================================================

export interface MessengerSettings {
  id: string
  is_active: boolean
  welcome_delay_seconds: number
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

// ============================================================================
// FAQ
// ============================================================================

export interface FAQ {
  id: string
  category: string
  question: MultilingualText
  answer: MultilingualText
  order_index: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================================================
// Validation Formats
// ============================================================================

export interface ValidationFormat {
  id: string
  format_code: string
  format_name: string
  validation_regex: string | null
  validation_function: string | null
  error_message: MultilingualText
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================================================
// Modules
// ============================================================================

export type ModuleType = 'message_text' | 'collect' | 'choix_multiples' | 'clara_llm' | 'availability_check' | 'availability_suggestions' | 'order_generation' | 'message_auto'

export interface ModuleChoice {
  id: string
  label: MultilingualText
}

export interface ClaraLLMConfig {
  system_prompt?: string
  model?: string
  max_tokens?: number
  temperature?: number
  use_faq_context?: boolean
  enable_workflow_navigation?: boolean // Permettre à Clara de changer de workflow
  available_workflows?: string[] // IDs des workflows que Clara peut activer
}

export interface Module {
  id: string
  ref_code: string
  name: string
  module_type: ModuleType
  content: MultilingualText
  params: Record<string, any>

  // Spécifique à "collect"
  validation_format_code?: string | null
  custom_error_message?: MultilingualText | null

  // Spécifique à "choix_multiples"
  choices?: ModuleChoice[] | null

  // Spécifique à "clara_llm"
  llm_config?: ClaraLLMConfig | null

  // Spécifique à "availability_check"
  success_message?: MultilingualText | null
  failure_message?: MultilingualText | null
  metadata?: Record<string, any> | null

  category: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================================================
// Workflows
// ============================================================================

export interface Workflow {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WorkflowStep {
  id: string
  workflow_id: string
  step_ref: string
  step_name: string
  module_ref: string
  is_entry_point: boolean
  order_index: number
  created_at: string
  updated_at: string
}

export type OutputDestinationType = 'step' | 'workflow' | 'end'

export interface WorkflowOutput {
  id: string
  workflow_id: string
  from_step_ref: string
  output_type: string // "success" | "choice_1" | "choice_2" | etc.
  output_label: string | null
  destination_type: OutputDestinationType
  destination_ref: string | null // step_ref, workflow_id, ou NULL si "end"
  priority: number
  delay_seconds?: number | null // Délai avant transition (pour message_auto)
  created_at: string
}

// ============================================================================
// Conversations & Messages
// ============================================================================

export type ConversationStatus = 'active' | 'completed' | 'abandoned'

export interface Conversation {
  id: string
  session_id: string
  branch_id: string | null
  contact_id: string | null
  current_step_ref: string | null
  current_workflow_id: string | null
  collected_data: Record<string, any>
  status: ConversationStatus
  locale: string
  started_at: string
  last_activity_at: string
  completed_at: string | null
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  step_ref: string | null
  metadata: Record<string, any>
  created_at: string
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// Formulaires d'édition (pour l'admin)
// ============================================================================

export interface FAQFormData {
  category: string
  question: MultilingualText
  answer: MultilingualText
  order_index: number
  is_active: boolean
}

export interface ModuleFormData {
  ref_code: string
  name: string
  module_type: ModuleType
  content: MultilingualText
  validation_format_code?: string
  custom_error_message?: MultilingualText
  choices?: ModuleChoice[]
  llm_config?: ClaraLLMConfig
  success_message?: MultilingualText
  failure_message?: MultilingualText
  metadata?: Record<string, any>
  category: string
  is_active: boolean
}

export interface WorkflowFormData {
  name: string
  description?: string
  is_active: boolean
}

export interface WorkflowStepFormData {
  step_ref: string
  step_name: string
  module_ref: string
  is_entry_point?: boolean
}

export interface WorkflowOutputFormData {
  from_step_ref: string
  output_type: string
  output_label?: string
  destination_type: OutputDestinationType
  destination_ref?: string
}
