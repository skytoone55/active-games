/**
 * WhatsApp Business API Webhook Handler v4.0
 *
 * GET  - Webhook verification (Meta sends a challenge to verify the endpoint)
 * POST - Receive incoming messages and status updates from WhatsApp
 *        Stores conversations and messages in Supabase
 *        Auto-links contacts by phone number
 *        Generic step-based onboarding flow (N configurable steps)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  getClaraSettings,
  getOrCreatePublicConversation,
  getPublicMessages,
  addPublicMessage,
  getPublicSystemPrompt,
} from '@/lib/clara/service'
import { streamLLMResponse, convertToAIMessages, truncateHistory, createLLMOptionsFromSettings } from '@/lib/clara/llm-provider'
import { publicTools } from '@/lib/clara/tools'

// Normalize phone: 972XXXXXXXXX -> 0XXXXXXXXX (Israeli format)
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '')
  if (cleaned.startsWith('972')) return '0' + cleaned.substring(3)
  if (cleaned.startsWith('05')) return cleaned
  return cleaned
}

// ============================================================
// WhatsApp API Helpers
// ============================================================

async function sendTextMessage(to: string, text: string): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken || !text.trim()) return null

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
      }),
    }
  )
  const result = await res.json()
  return result.messages?.[0]?.id || null
}

async function sendInteractiveButtons(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
): Promise<string | null> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken || buttons.length === 0) return null

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map(btn => ({
              type: 'reply',
              reply: { id: btn.id, title: btn.title.substring(0, 20) }
            }))
          }
        }
      }),
    }
  )
  const result = await res.json()
  return result.messages?.[0]?.id || null
}

// Store an outbound message in DB
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function storeOutboundMessage(supabase: any, conversationId: string, content: string, msgType: string, waMessageId: string | null) {
  await supabase
    .from('whatsapp_messages')
    .insert({
      conversation_id: conversationId,
      direction: 'outbound',
      message_type: msgType,
      content,
      whatsapp_message_id: waMessageId,
      status: 'sent',
      sent_by: null, // null = automated message
    })
}

// Get multilingual text by language key
function getLocalizedText(multilingual: Record<string, string> | string | undefined, language: string): string {
  if (!multilingual) return ''
  if (typeof multilingual === 'string') return multilingual
  return multilingual[language] || multilingual.he || multilingual.fr || multilingual.en || ''
}

// ============================================================
// Generic Step Helpers
// ============================================================

// Get enabled steps sorted by order (must have at least 1 option)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getEnabledSteps(config: any): any[] {
  return (config.steps || [])
    .filter((s: { enabled: boolean; options?: unknown[] }) => s.enabled && s.options && s.options.length > 0)
    .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
}

// Get the first enabled step
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getFirstStep(config: any): any | null {
  const steps = getEnabledSteps(config)
  return steps.length > 0 ? steps[0] : null
}

// Get the next enabled step after currentStepId
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNextStep(config: any, currentStepId: string): any | null {
  const steps = getEnabledSteps(config)
  const idx = steps.findIndex((s: { id: string }) => s.id === currentStepId)
  if (idx === -1 || idx >= steps.length - 1) return null
  return steps[idx + 1]
}

// Get step by ID
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getStepById(config: any, stepId: string): any | null {
  return (config.steps || []).find((s: { id: string }) => s.id === stepId) || null
}

// Parse onboarding_status: "waiting:activity" → { waiting: true, stepId: 'activity' }
// Backward compatible with old format: "waiting_activity" → { waiting: true, stepId: 'activity' }
function parseOnboardingStatus(status: string | null): { waiting: boolean; stepId: string | null } {
  if (!status) return { waiting: false, stepId: null }
  if (status === 'completed') return { waiting: false, stepId: null }
  // New format: "waiting:step_id"
  if (status.startsWith('waiting:')) return { waiting: true, stepId: status.substring(8) }
  // Legacy format: "waiting_activity", "waiting_branch"
  if (status === 'waiting_activity') return { waiting: true, stepId: 'activity' }
  if (status === 'waiting_branch') return { waiting: true, stepId: 'branch' }
  return { waiting: false, stepId: null }
}

// Send buttons for a given step
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendStepButtons(supabase: any, conversationId: string, senderPhone: string, step: any, language: string) {
  const promptText = getLocalizedText(step.prompt, language)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buttons = (step.options || []).map((opt: any) => ({
    id: step.type === 'branch' ? (opt.branch_id || opt.id) : opt.id,
    title: `${opt.emoji || ''} ${getLocalizedText(opt.label, language)}`.trim()
  }))

  if (promptText && buttons.length > 0) {
    const waId = await sendInteractiveButtons(senderPhone, promptText, buttons)
    await storeOutboundMessage(supabase, conversationId, promptText, 'interactive', waId)
    console.log(`[WHATSAPP] Onboarding: step "${step.id}" buttons sent to`, senderPhone)
  }
}

// Match user reply against step options
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function matchOption(step: any, buttonReplyId: string | null, messageText: string): any | null {
  const options = step.options || []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return options.find((opt: any) => {
    const optId = step.type === 'branch' ? (opt.branch_id || opt.id) : opt.id
    if (buttonReplyId && buttonReplyId === optId) return true
    // Fallback: text matching
    const labels = Object.values(opt.label || {}) as string[]
    return labels.some((l: string) => l && messageText.toLowerCase().includes(l.toLowerCase()))
  }) || null
}

// ============================================================
// GET - Webhook Verification
// ============================================================
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[WHATSAPP WEBHOOK] Verification successful')
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ============================================================
// POST - Receive messages and status updates
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const entry = body?.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value) {
      return NextResponse.json({ received: true })
    }

    const supabase = createServiceRoleClient()

    // ---- Status updates (sent, delivered, read) ----
    if (value.statuses) {
      for (const status of value.statuses) {
        if (status.id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('whatsapp_messages')
            .update({ status: status.status })
            .eq('whatsapp_message_id', status.id)
        }
      }
      return NextResponse.json({ received: true })
    }

    // ---- Load onboarding config once ----
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: msSettings } = await (supabase as any)
      .from('messenger_settings')
      .select('settings')
      .single()

    const onboardingConfig = msSettings?.settings?.whatsapp_onboarding
    const isOnboardingEnabled = onboardingConfig?.enabled === true
    const onboardingLang = onboardingConfig?.language || 'he'
    const hasEnabledSteps = isOnboardingEnabled && getEnabledSteps(onboardingConfig).length > 0

    // Legacy auto-reply fallback
    const legacyAutoReply = msSettings?.settings?.whatsapp_auto_reply

    // ---- Incoming messages ----
    if (value.messages) {
      for (const message of value.messages) {
        const senderPhone = message.from
        const messageId = message.id
        const messageType = message.type

        let messageText = ''
        let buttonReplyId: string | null = null

        switch (messageType) {
          case 'text':
            messageText = message.text?.body || ''
            break
          case 'interactive':
            messageText = message.interactive?.button_reply?.title
              || message.interactive?.list_reply?.title || ''
            buttonReplyId = message.interactive?.button_reply?.id
              || message.interactive?.list_reply?.id || null
            break
          case 'button':
            messageText = message.button?.text || ''
            break
          default:
            messageText = `[${messageType}]`
        }

        const contactName = value.contacts?.[0]?.profile?.name || ''
        const normalizedPhone = normalizePhone(senderPhone)

        console.log('[WHATSAPP] Message from', senderPhone, ':', messageText)

        // 1. Find or create conversation
        let isNewConversation = false
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let { data: conversation } = await (supabase as any)
          .from('whatsapp_conversations')
          .select('id, contact_id, contact_name, onboarding_status, activity, branch_id, onboarding_data')
          .eq('phone', senderPhone)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (!conversation) {
          // Auto-link contact by phone
          let contactId: string | null = null
          let branchId: string | null = null

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: contacts } = await (supabase as any)
            .from('contacts')
            .select('id, branch_id_main')
            .or(`phone.eq.${normalizedPhone},phone.eq.${senderPhone}`)

          if (contacts && contacts.length === 1) {
            contactId = contacts[0].id
            branchId = contacts[0].branch_id_main
          } else if (contacts && contacts.length > 1) {
            console.log(`[WHATSAPP] Multiple contacts found for ${senderPhone} (${contacts.length}), skipping auto-link`)
          }

          // Determine initial onboarding status
          const firstStep = hasEnabledSteps ? getFirstStep(onboardingConfig) : null
          const initialStatus = firstStep ? `waiting:${firstStep.id}` : null

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: newConv } = await (supabase as any)
            .from('whatsapp_conversations')
            .insert({
              phone: senderPhone,
              contact_name: contactName || null,
              contact_id: contactId,
              branch_id: branchId,
              status: 'active',
              unread_count: 1,
              last_message_at: new Date().toISOString(),
              onboarding_status: initialStatus,
            })
            .select('id, contact_id, onboarding_status, activity, branch_id, onboarding_data')
            .single()

          conversation = newConv
          isNewConversation = true
        } else {
          // Update existing conversation
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('whatsapp_conversations')
            .update({
              last_message_at: new Date().toISOString(),
              unread_count: (conversation.unread_count || 0) + 1,
              contact_name: contactName || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', conversation.id)
        }

        if (!conversation) {
          console.error('[WHATSAPP] Failed to create/find conversation')
          continue
        }

        // 2. Store the inbound message
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('whatsapp_messages')
          .insert({
            conversation_id: conversation.id,
            direction: 'inbound',
            message_type: messageType,
            content: messageText,
            whatsapp_message_id: messageId,
            status: 'delivered',
          })

        // 3. Onboarding flow / auto-reply / Clara AI
        const claraWhatsAppConfig = msSettings?.settings?.whatsapp_clara
        try {
          if (hasEnabledSteps) {
            await handleOnboarding(
              supabase, conversation, senderPhone, isNewConversation,
              messageText, buttonReplyId, onboardingConfig, onboardingLang
            )
            // After onboarding just completed, Clara does NOT reply yet (welcome message was just sent)
          } else if (isNewConversation && legacyAutoReply?.enabled && legacyAutoReply?.message) {
            // Legacy auto-reply fallback (plain text)
            let replyText = ''
            if (typeof legacyAutoReply.message === 'string') {
              replyText = legacyAutoReply.message
            } else {
              replyText = legacyAutoReply.message.fr || legacyAutoReply.message.he || legacyAutoReply.message.en || ''
            }
            if (replyText.trim()) {
              const waId = await sendTextMessage(senderPhone, replyText)
              await storeOutboundMessage(supabase, conversation.id, replyText, 'text', waId)
              console.log('[WHATSAPP] Legacy auto-reply sent to', senderPhone)
            }
          }
        } catch (onboardingError) {
          console.error('[WHATSAPP] Onboarding/auto-reply error:', onboardingError)
        }

        // 4. Clara AI — responds after onboarding is completed
        // Re-read conversation to get the latest onboarding_status (it may have changed during handleOnboarding)
        const currentStatus = conversation.onboarding_status
        const isOnboardingDone = !hasEnabledSteps || currentStatus === 'completed' || currentStatus === null
        const isNotWaiting = !currentStatus?.startsWith('waiting:')

        // Check Clara pause status (human takeover)
        let claraPaused = conversation.clara_paused === true
        if (claraPaused && conversation.clara_paused_until) {
          const pauseExpiry = new Date(conversation.clara_paused_until)
          if (pauseExpiry <= new Date()) {
            // Pause expired → auto-resume Clara
            claraPaused = false
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from('whatsapp_conversations')
              .update({ clara_paused: false, clara_paused_until: null })
              .eq('id', conversation.id)
            console.log('[WHATSAPP CLARA] Auto-resumed after timeout for conversation', conversation.id)
          }
        }

        if (claraWhatsAppConfig?.enabled && isOnboardingDone && isNotWaiting && !claraPaused && !isNewConversation && messageText && messageText !== `[${messageType}]`) {
          try {
            await handleClaraWhatsApp(
              supabase, conversation, senderPhone, messageText,
              claraWhatsAppConfig, onboardingLang
            )
          } catch (claraErr) {
            console.error('[WHATSAPP] Clara error (non-blocking):', claraErr)
          }
        }
      }
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('[WHATSAPP WEBHOOK] Error:', error)
    return NextResponse.json({ received: true, error: 'Internal error' })
  }
}

// ============================================================
// Generic Onboarding State Machine
// ============================================================
async function handleOnboarding(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conversation: any,
  senderPhone: string,
  isNewConversation: boolean,
  messageText: string,
  buttonReplyId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
  language: string
) {
  const { waiting, stepId } = parseOnboardingStatus(conversation.onboarding_status)

  // --- NEW CONVERSATION: send first step buttons ---
  if (isNewConversation && waiting && stepId) {
    const firstStep = getStepById(config, stepId) || getFirstStep(config)
    if (firstStep) {
      await sendStepButtons(supabase, conversation.id, senderPhone, firstStep, language)
    }
    return
  }

  // --- WAITING FOR A STEP RESPONSE ---
  if (waiting && stepId) {
    const currentStep = getStepById(config, stepId)

    // Step removed/disabled mid-onboarding → complete immediately
    if (!currentStep || !currentStep.enabled) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('whatsapp_conversations')
        .update({ onboarding_status: 'completed' })
        .eq('id', conversation.id)
      console.log('[WHATSAPP] Onboarding: step not found, auto-completing for', senderPhone)
      return
    }

    // Try to match the user's reply
    const matched = matchOption(currentStep, buttonReplyId, messageText)

    if (matched) {
      // Save the answer based on step type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateFields: Record<string, any> = {}

      if (currentStep.type === 'activity') {
        updateFields.activity = matched.id
      } else if (currentStep.type === 'branch') {
        const selectedBranchId = matched.branch_id || matched.id
        updateFields.branch_id = selectedBranchId

        // Auto-create/link contact when branch is selected (if not already linked)
        if (!conversation.contact_id) {
          try {
            const normalizedPhone = normalizePhone(senderPhone)

            // Check if contact with this phone already exists in the branch
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: existingContacts } = await (supabase as any)
              .from('contacts')
              .select('id')
              .eq('branch_id_main', selectedBranchId)
              .eq('phone', normalizedPhone)
              .eq('status', 'active')
              .limit(1)

            if (existingContacts && existingContacts.length > 0) {
              // Contact exists → link it
              updateFields.contact_id = existingContacts[0].id
              console.log('[WHATSAPP] Auto-linked existing contact', existingContacts[0].id, 'for', senderPhone)
            } else {
              // Create new contact from WhatsApp info
              const contactName = conversation.contact_name || ''
              const nameParts = contactName.trim().split(/\s+/)
              const firstName = nameParts[0] || normalizedPhone
              const lastName = nameParts.slice(1).join(' ') || null

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { data: newContact, error: createErr } = await (supabase as any)
                .from('contacts')
                .insert({
                  branch_id_main: selectedBranchId,
                  first_name: firstName,
                  last_name: lastName,
                  phone: normalizedPhone,
                  source: 'whatsapp',
                  client_type: 'individual',
                  status: 'active',
                })
                .select('id')
                .single()

              if (newContact && !createErr) {
                updateFields.contact_id = newContact.id
                console.log('[WHATSAPP] Auto-created contact', newContact.id, 'for', senderPhone)
              } else {
                console.error('[WHATSAPP] Failed to auto-create contact:', createErr)
              }
            }
          } catch (autoLinkErr) {
            console.error('[WHATSAPP] Auto-link error (non-blocking):', autoLinkErr)
          }
        }
      } else {
        // Custom step → store in onboarding_data JSONB
        const existingData = conversation.onboarding_data || {}
        updateFields.onboarding_data = { ...existingData, [currentStep.id]: matched.id }
      }

      // Check for next step
      const nextStep = getNextStep(config, stepId)

      if (nextStep) {
        // Advance to next step
        updateFields.onboarding_status = `waiting:${nextStep.id}`
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('whatsapp_conversations')
          .update(updateFields)
          .eq('id', conversation.id)

        await sendStepButtons(supabase, conversation.id, senderPhone, nextStep, language)
      } else {
        // All steps done → completed
        updateFields.onboarding_status = 'completed'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('whatsapp_conversations')
          .update(updateFields)
          .eq('id', conversation.id)

        console.log('[WHATSAPP] Onboarding completed for', senderPhone)

        // Send welcome message if enabled
        if (config.welcome_message_enabled && config.welcome_message) {
          const welcomeText = getLocalizedText(config.welcome_message, language)
          if (welcomeText.trim()) {
            const waId = await sendTextMessage(senderPhone, welcomeText)
            await storeOutboundMessage(supabase, conversation.id, welcomeText, 'text', waId)
            console.log('[WHATSAPP] Welcome message sent to', senderPhone)
          }
        }
      }
    } else {
      // No match → resend current step buttons
      await sendStepButtons(supabase, conversation.id, senderPhone, currentStep, language)
    }
    return
  }

  // --- COMPLETED or NULL: Clara AI handles conversation ---
}

// ============================================================
// Clara AI for WhatsApp
// ============================================================
async function handleClaraWhatsApp(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conversation: any,
  senderPhone: string,
  messageText: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  claraConfig: any,
  language: string
) {
  console.log('[WHATSAPP CLARA] Processing message from', senderPhone, ':', messageText.substring(0, 100))

  // Get Clara settings (global)
  const globalSettings = await getClaraSettings()
  if (!globalSettings.enabled) {
    console.log('[WHATSAPP CLARA] Clara globally disabled, skipping')
    return
  }

  // Use WhatsApp-specific model/temperature if set, otherwise global
  const model = claraConfig.model || globalSettings.model
  const temperature = claraConfig.temperature ?? globalSettings.temperature
  const provider = model.startsWith('gpt') ? 'openai' : model.startsWith('claude') ? 'anthropic' : 'gemini'

  // Get or create Clara conversation for this WhatsApp thread
  // Use whatsapp conversation ID as session to keep context
  const claraConv = await getOrCreatePublicConversation(
    `whatsapp:${conversation.id}`,
    conversation.branch_id || undefined,
    { locale: language }
  )

  // Save user message to Clara conversation
  await addPublicMessage(claraConv.id, 'user', messageText)

  // Get conversation history
  const messages = await getPublicMessages(claraConv.id, 150)
  const aiMessages = convertToAIMessages(messages)
  const truncatedMessages = truncateHistory(aiMessages, 50000)

  // Build system prompt
  let systemPrompt = ''
  if (claraConfig.prompt && claraConfig.prompt.trim()) {
    // Custom WhatsApp prompt
    systemPrompt = claraConfig.prompt
  } else {
    // Default Clara public prompt
    systemPrompt = await getPublicSystemPrompt()
  }

  // Add WhatsApp-specific instructions
  systemPrompt += `\n\n## WHATSAPP CONTEXT
- This is a WhatsApp conversation. Keep responses concise (max 300 words).
- Do NOT use markdown formatting (no **, no #, no bullet points with *). Use plain text only.
- Use line breaks for readability.
- The user's language is: ${language === 'he' ? 'Hebrew' : language === 'fr' ? 'French' : 'English'}.
- Respond in the same language as the user's message.`

  // Load FAQ if enabled
  if (claraConfig.faq_enabled) {
    try {
      const { data: faqs } = await supabase
        .from('messenger_faq')
        .select('question, answer')
        .eq('is_active', true)
        .order('order_index')

      if (faqs && faqs.length > 0) {
        systemPrompt += '\n\n## FAQ\n'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        faqs.forEach((faq: any) => {
          const q = faq.question?.[language] || faq.question?.he || faq.question?.fr || faq.question?.en || ''
          const a = faq.answer?.[language] || faq.answer?.he || faq.answer?.fr || faq.answer?.en || ''
          if (q && a) {
            systemPrompt += `Q: ${q}\nA: ${a}\n\n`
          }
        })
      }
    } catch (faqErr) {
      console.error('[WHATSAPP CLARA] FAQ load error (non-blocking):', faqErr)
    }
  }

  // Call LLM
  const result = await streamLLMResponse({
    messages: truncatedMessages,
    systemPrompt,
    provider: provider as 'gemini' | 'openai' | 'anthropic',
    model,
    maxTokens: globalSettings.max_tokens || 4096,
    temperature,
    tools: publicTools,
  })

  // Collect full response (no streaming for WhatsApp — we send the complete message)
  let fullResponse = ''
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      const textContent = (part as { text?: string }).text
      if (textContent) {
        fullResponse += textContent
      }
    } else if (part.type === 'tool-call') {
      console.log('[WHATSAPP CLARA] Tool call:', (part as { toolName?: string }).toolName)
    }
  }

  if (fullResponse.trim()) {
    // Save assistant response to Clara conversation
    await addPublicMessage(claraConv.id, 'assistant', fullResponse)

    // Send via WhatsApp
    const waId = await sendTextMessage(senderPhone, fullResponse)
    await storeOutboundMessage(supabase, conversation.id, fullResponse, 'text', waId)
    console.log('[WHATSAPP CLARA] Reply sent to', senderPhone, ':', fullResponse.substring(0, 100))
  } else {
    console.warn('[WHATSAPP CLARA] Empty response from LLM for message:', messageText)
  }
}
