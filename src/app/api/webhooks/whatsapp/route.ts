/**
 * WhatsApp Business API Webhook Handler v4.0
 *
 * GET  - Webhook verification (Meta sends a challenge to verify the endpoint)
 * POST - Receive incoming messages and status updates from WhatsApp
 *        Stores conversations and messages in Supabase
 *        Auto-links contacts by phone number
 *        Generic step-based onboarding flow (N configurable steps)
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createHmac } from 'crypto'
import { sendWhatsAppText, storeOutboundMessage, triggerCodexTechnicalFallback, sendTypingIndicator as sendTypingIndicatorShared, createTypingIndicatorLoop } from '@/lib/whatsapp/messaging'
import { getClaraCodexSettings } from '@/lib/clara-codex'
import { handleClaraCodexWhatsAppResponseV2 } from '@/lib/clara-codex/whatsapp-handler-v2'
import { downloadAndStoreMedia } from '@/lib/whatsapp/media'

/**
 * Verify Meta webhook signature (X-Hub-Signature-256)
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) {
    // If no secret configured, log warning but allow (backward compatible)
    console.warn('[WHATSAPP WEBHOOK] WHATSAPP_APP_SECRET not configured — skipping signature verification')
    return true
  }
  if (!signatureHeader) {
    return false
  }
  const expectedSignature = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')
  return signatureHeader === expectedSignature
}

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

// sendTypingIndicator imported from @/lib/whatsapp/messaging (shared utility)
const sendTypingIndicator = sendTypingIndicatorShared

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
    // Read raw body for signature verification, then parse
    const rawBody = await request.text()
    const signature = request.headers.get('x-hub-signature-256')

    if (!verifyMetaSignature(rawBody, signature)) {
      console.error('[WHATSAPP WEBHOOK] Invalid signature — rejecting request')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const body = JSON.parse(rawBody)
    const entry = body?.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value) {
      return NextResponse.json({ received: true })
    }

    const supabase = createServiceRoleClient()

    // ---- Status updates (sent, delivered, read, failed) ----
    if (value.statuses) {
      for (const status of value.statuses) {
        if (status.id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updateData: any = { status: status.status }
          // Capture WhatsApp error details for failed messages
          if (status.status === 'failed' && status.errors) {
            updateData.metadata = { errors: status.errors }
            console.error('[WHATSAPP WEBHOOK] Message failed:', status.id, JSON.stringify(status.errors))
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('whatsapp_messages')
            .update(updateData)
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

    // Clara Codex settings (isolated engine)
    let codexSettingsRecord: Awaited<ReturnType<typeof getClaraCodexSettings>> | null = null
    try {
      codexSettingsRecord = await getClaraCodexSettings()
    } catch (codexErr) {
      console.error('[WHATSAPP CODEX] Failed to load settings, fallback to legacy Clara:', codexErr)
    }

    // ---- Incoming messages ----
    if (value.messages) {
      for (const message of value.messages) {
        const senderPhone = message.from
        const messageId = message.id
        const messageType = message.type

        let messageText = ''
        let buttonReplyId: string | null = null
        let mediaInfo: { mediaId: string; mimeType: string; filename?: string } | null = null

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
          case 'image':
          case 'audio':
          case 'video':
          case 'document': {
            const mediaPayload = message[messageType]
            if (mediaPayload?.id) {
              mediaInfo = {
                mediaId: mediaPayload.id,
                mimeType: mediaPayload.mime_type || '',
                filename: mediaPayload.filename || undefined,
              }
            }
            messageText = mediaPayload?.caption || mediaPayload?.filename || `[${messageType}]`
            break
          }
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
          .select('id, contact_id, contact_name, unread_count, onboarding_status, activity, branch_id, onboarding_data, clara_paused, clara_paused_until')
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

        // 2. Download media if present (non-blocking on failure)
        let mediaUrl: string | null = null
        let mediaType: string | null = null
        let mediaMimeType: string | null = null
        let mediaFilename: string | null = null

        if (mediaInfo) {
          try {
            const stored = await downloadAndStoreMedia(mediaInfo)
            if (stored) {
              mediaUrl = stored.publicUrl
              mediaType = messageType
              mediaMimeType = mediaInfo.mimeType
              mediaFilename = mediaInfo.filename || null
            }
          } catch (mediaErr) {
            console.error('[WHATSAPP] Media download error (non-blocking):', mediaErr)
          }
        }

        // 3. Dedup: skip if this WhatsApp message was already processed (Meta webhook retries)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existingMsg } = await (supabase as any)
          .from('whatsapp_messages')
          .select('id')
          .eq('whatsapp_message_id', messageId)
          .eq('direction', 'inbound')
          .limit(1)
          .maybeSingle()

        if (existingMsg) {
          console.log('[WHATSAPP] Duplicate message skipped (Meta retry):', messageId)
          continue
        }

        // 4. Store the inbound message
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
            media_url: mediaUrl,
            media_type: mediaType,
            media_mime_type: mediaMimeType,
            media_filename: mediaFilename,
          })

        // 3. Onboarding flow / auto-reply / Clara AI
        let onboardingHandledMessage = false
        let onboardingJustCompleted = false
        try {
          if (hasEnabledSteps) {
            // Pre-check if Clara is active so onboarding knows whether to skip welcome message
            const codexActiveForOnboarding = !!(codexSettingsRecord?.is_active && (codexSettingsRecord?.settings as any)?.enabled === true)
            const onboardingResult = await handleOnboarding(
              supabase, conversation, senderPhone, isNewConversation,
              messageText, buttonReplyId, onboardingConfig, onboardingLang, codexActiveForOnboarding
            )
            onboardingHandledMessage = onboardingResult.handled
            onboardingJustCompleted = onboardingResult.justCompleted
            // If onboarding sent a message (buttons, welcome, etc.), AI must NOT reply to this same message
          } else if (isNewConversation && legacyAutoReply?.enabled && legacyAutoReply?.message) {
            // Legacy auto-reply fallback (plain text)
            let replyText = ''
            if (typeof legacyAutoReply.message === 'string') {
              replyText = legacyAutoReply.message
            } else {
              replyText = legacyAutoReply.message.fr || legacyAutoReply.message.he || legacyAutoReply.message.en || ''
            }
            if (replyText.trim()) {
              const waId = await sendWhatsAppText(senderPhone, replyText)
              await storeOutboundMessage(supabase, conversation.id, replyText, 'text', waId)
              console.log('[WHATSAPP] Legacy auto-reply sent to', senderPhone)
            }
          }
        } catch (onboardingError) {
          console.error('[WHATSAPP] Onboarding/auto-reply error:', onboardingError)
        }

        // 4. AI response (Clara Codex first if active, otherwise legacy Clara)
        // Re-read conversation state (onboarding may have changed during handleOnboarding)
        const { data: refreshedConversation } = await (supabase as any)
          .from('whatsapp_conversations')
          .select('id, contact_name, onboarding_status, branch_id, clara_paused, clara_paused_until, profile')
          .eq('id', conversation.id)
          .single()

        const runtimeConversation = {
          ...conversation,
          ...(refreshedConversation || {}),
        }

        const currentStatus = runtimeConversation.onboarding_status
        const isOnboardingDone = !hasEnabledSteps || currentStatus === 'completed' || currentStatus === null
        const isNotWaiting = !currentStatus?.startsWith('waiting:')

        // Check Clara pause status (human takeover)
        let claraPaused = runtimeConversation.clara_paused === true
        if (claraPaused && runtimeConversation.clara_paused_until) {
          const pauseExpiry = new Date(runtimeConversation.clara_paused_until)
          if (pauseExpiry <= new Date()) {
            claraPaused = false
            await (supabase as any)
              .from('whatsapp_conversations')
              .update({ clara_paused: false, clara_paused_until: null })
              .eq('id', runtimeConversation.id)
            console.log('[WHATSAPP AI] Auto-resumed after timeout for conversation', runtimeConversation.id)
          }
        }

        const codexSettings = codexSettingsRecord?.settings as Record<string, unknown> | undefined
        const codexEnabled = !!(codexSettingsRecord?.is_active && codexSettings?.enabled === true)
        const codexOutsideSchedule = codexEnabled ? isOutsideConfiguredSchedule(codexSettings) : false
        const codexBranchInactive = codexEnabled
          ? isBranchInactive(codexSettings, runtimeConversation.branch_id)
          : false

        // Normal eligibility: onboarding done, not new conversation, not just handled
        const baseEligibility = isOnboardingDone && isNotWaiting && !claraPaused && !isNewConversation && !onboardingHandledMessage && messageText && messageText !== `[${messageType}]`
        // Special case: onboarding JUST completed and user had asked a question before onboarding
        // → Clara should answer the original question now
        const postOnboardingEligibility = onboardingJustCompleted && isOnboardingDone && !claraPaused

        let aiDidRespond = false

        if (codexEnabled && (baseEligibility || postOnboardingEligibility) && !codexOutsideSchedule && !codexBranchInactive) {
          // Send typing indicator immediately, defer AI processing to after() so we return 200 to Meta fast
          await sendTypingIndicator(messageId)
          aiDidRespond = true // Set preemptively — the deferred handler WILL respond

          // For post-onboarding: find the user's first real message to pass to Clara
          let textForClara = messageText
          if (postOnboardingEligibility && !baseEligibility) {
            // Retrieve the first inbound message (the original question asked before onboarding)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: firstInbound } = await (supabase as any)
              .from('whatsapp_messages')
              .select('content')
              .eq('conversation_id', conversation.id)
              .eq('direction', 'inbound')
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle()

            textForClara = firstInbound?.content || messageText
            console.log('[WHATSAPP] Post-onboarding Clara trigger — answering original question:', textForClara)
          }

          // Capture variables for the after() closure
          const deferredSupa = supabase
          const deferredConv = { ...runtimeConversation }
          const deferredPhone = senderPhone
          const deferredText = textForClara
          const deferredSettings = codexSettings
          const deferredLang = onboardingLang
          const deferredMessageId = messageId

          after(async () => {
            // Start periodic typing indicator refresh (WhatsApp "..." expires after ~25s)
            const typingLoop = createTypingIndicatorLoop(deferredMessageId, 20_000)
            try {
              await handleClaraCodexWhatsAppResponseV2(
                deferredSupa,
                deferredConv,
                deferredPhone,
                deferredText,
                deferredSettings as any,
                deferredLang
              )
            } catch (codexErr) {
              console.error('[WHATSAPP CODEX V2] Deferred processing error:', codexErr)
              await triggerCodexTechnicalFallback({
                supabase: deferredSupa,
                conversation: deferredConv,
                senderPhone: deferredPhone,
                locale: deferredLang,
                settings: deferredSettings as any,
                metadata: {
                  error: codexErr instanceof Error ? codexErr.message : String(codexErr),
                },
              })
            } finally {
              typingLoop.stop()
            }
          })
        }

        // 5. Auto-activate timer — set if AI did NOT respond and feature is enabled
        const autoActivateDelay = codexEnabled
          ? Number((codexSettings as any)?.auto_activate_delay_minutes || 0)
          : 0

        if (autoActivateDelay > 0 && !aiDidRespond && isOnboardingDone && isNotWaiting) {
          const activateAt = new Date(Date.now() + autoActivateDelay * 60 * 1000).toISOString()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('whatsapp_conversations')
            .update({ clara_auto_activate_at: activateAt })
            .eq('id', conversation.id)
          console.log('[WHATSAPP] Auto-activate timer set for', conversation.id, 'at', activateAt)
        }
      }
    }

    // 6. Piggyback: process any expired auto-activate timers (non-blocking)
    // Since Vercel Hobby doesn't support per-minute crons, we check on every webhook call
    processExpiredAutoActivateTimers(supabase, msSettings?.settings, codexSettingsRecord).catch(err =>
      console.error('[WHATSAPP] Auto-activate check error (non-blocking):', err)
    )

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('[WHATSAPP WEBHOOK] Error:', error)
    return NextResponse.json({ received: true, error: 'Internal error' })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isOutsideConfiguredSchedule(config: any): boolean {
  if (!config?.schedule_enabled || !config?.schedule) return false

  const israelNow = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })
  const israelDate = new Date(israelNow)
  const dayName = israelDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const currentTime = israelDate.toTimeString().slice(0, 5)
  const daySchedule = config.schedule[dayName]

  if (!daySchedule?.enabled) {
    return true
  }
  return currentTime < daySchedule.start || currentTime >= daySchedule.end
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isBranchInactive(config: any, branchId: string | null | undefined): boolean {
  if (!config?.active_branches || !Array.isArray(config.active_branches)) return false
  if (config.active_branches.length === 0) return false
  if (!branchId) return false
  return !config.active_branches.includes(branchId)
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
  language: string,
  claraActive: boolean = false
): Promise<{ handled: boolean; justCompleted: boolean }> {
  const { waiting, stepId } = parseOnboardingStatus(conversation.onboarding_status)

  // --- NEW CONVERSATION: send first step buttons ---
  if (isNewConversation && waiting && stepId) {
    const firstStep = getStepById(config, stepId) || getFirstStep(config)
    if (firstStep) {
      await sendStepButtons(supabase, conversation.id, senderPhone, firstStep, language)
    }
    return { handled: true, justCompleted: false }
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
      return { handled: true, justCompleted: true }
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

        // Check if the user's FIRST message was a real question (not just a button click)
        // If so, skip the generic welcome and let Clara answer the question instead
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: firstInbound } = await (supabase as any)
          .from('whatsapp_messages')
          .select('content')
          .eq('conversation_id', conversation.id)
          .eq('direction', 'inbound')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        const firstMsg = (firstInbound?.content || '').trim()
        // A "real question" is at least 3 chars and not just a button option label
        const isFirstMsgQuestion = firstMsg.length >= 3 && !matchOption(currentStep, null, firstMsg)

        if (isFirstMsgQuestion && claraActive) {
          // User asked a question before onboarding — skip welcome, let Clara answer it directly
          console.log('[WHATSAPP] Onboarding completed with pending question (Clara active):', firstMsg)
          // Do NOT send welcome message — Clara will respond to the question instead
          return { handled: true, justCompleted: true }
        }

        // No pending question → send welcome message normally
        if (config.welcome_message_enabled && config.welcome_message) {
          const welcomeText = getLocalizedText(config.welcome_message, language)
          if (welcomeText.trim()) {
            const waId = await sendWhatsAppText(senderPhone, welcomeText)
            await storeOutboundMessage(supabase, conversation.id, welcomeText, 'text', waId)
            console.log('[WHATSAPP] Welcome message sent to', senderPhone)
          }
        }
        return { handled: true, justCompleted: false }
      }
    } else {
      // No match → resend current step buttons
      await sendStepButtons(supabase, conversation.id, senderPhone, currentStep, language)
    }
    return { handled: true, justCompleted: false }
  }

  // --- COMPLETED or NULL: Clara AI handles conversation ---
  return { handled: false, justCompleted: false }
}

// ============================================================
// Auto-activate expired timers (piggyback on webhook)
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processExpiredAutoActivateTimers(supabase: any, settings: any, codexSettingsRecord: any) {
  const codexConfig = codexSettingsRecord?.is_active ? codexSettingsRecord?.settings : null

  if (!codexConfig?.enabled) return
  if (!codexConfig?.auto_activate_delay_minutes || codexConfig.auto_activate_delay_minutes <= 0) return
  if (isOutsideConfiguredSchedule(codexConfig)) return

  const now = new Date().toISOString()
  const { data: conversations } = await supabase
    .from('whatsapp_conversations')
    .select('id, phone, contact_name, branch_id, profile')
    .lte('clara_auto_activate_at', now)
    .eq('status', 'active')
    .limit(5)

  if (!conversations || conversations.length === 0) return

  console.log(`[WHATSAPP AUTO-ACTIVATE] Processing ${conversations.length} expired timer(s)`)

  const language = settings?.whatsapp_onboarding?.language || 'he'

  for (const conv of conversations) {
    try {
      // Safety: check last message is inbound (no human responded)
      const { data: lastMsgs } = await supabase
        .from('whatsapp_messages')
        .select('direction, content')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(3)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lastInbound = lastMsgs?.find((m: any) => m.direction === 'inbound')
      if (!lastInbound || (lastMsgs?.[0]?.direction === 'outbound')) {
        // Human already responded or no inbound → clear timer
        await supabase.from('whatsapp_conversations')
          .update({ clara_auto_activate_at: null })
          .eq('id', conv.id)
        continue
      }

      // Check active branches
      if (isBranchInactive(codexConfig, conv.branch_id)) {
        await supabase.from('whatsapp_conversations')
          .update({ clara_auto_activate_at: null })
          .eq('id', conv.id)
        continue
      }

      // Clear timer + unpause Clara
      await supabase.from('whatsapp_conversations')
        .update({ clara_auto_activate_at: null, clara_paused: false, clara_paused_until: null })
        .eq('id', conv.id)

      try {
        await handleClaraCodexWhatsAppResponseV2(
          supabase,
          { id: conv.id, branch_id: conv.branch_id, contact_name: conv.contact_name, profile: conv.profile },
          conv.phone,
          lastInbound.content || '',
          codexConfig,
          language
        )
        console.log(`[WHATSAPP AUTO-ACTIVATE] Clara activated for ${conv.id} (${conv.phone})`)
      } catch (codexErr) {
        console.error(`[WHATSAPP AUTO-ACTIVATE] Clara error for ${conv.id}:`, codexErr)
        await triggerCodexTechnicalFallback({
          supabase,
          conversation: { id: conv.id, branch_id: conv.branch_id, contact_name: conv.contact_name },
          senderPhone: conv.phone,
          locale: language,
          settings: codexConfig,
          metadata: {
            source: 'auto_activate',
            error: codexErr instanceof Error ? codexErr.message : String(codexErr),
          },
        })
      }
    } catch (err) {
      console.error(`[WHATSAPP AUTO-ACTIVATE] Error for ${conv.id}:`, err)
      await supabase.from('whatsapp_conversations')
        .update({ clara_auto_activate_at: null })
        .eq('id', conv.id)
    }
  }
}
