/**
 * Cron Job: Clara Auto-Activate
 *
 * Runs every minute. Finds WhatsApp conversations where:
 * - clara_auto_activate_at has expired (timer set by webhook when no human responded)
 * - Conversation is still active
 * Then triggers Clara AI to respond to the last inbound message.
 *
 * GET /api/cron/clara-auto-activate
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { handleClaraWhatsAppResponse } from '@/lib/clara/whatsapp-handler'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceRoleClient()

    // Load Clara WhatsApp config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: msSettings } = await (supabase as any)
      .from('messenger_settings')
      .select('settings')
      .single()

    const claraWhatsAppConfig = msSettings?.settings?.whatsapp_clara

    // If Clara WhatsApp is globally disabled, skip
    if (!claraWhatsAppConfig?.enabled) {
      return NextResponse.json({
        skipped: true,
        reason: 'Clara WhatsApp disabled',
        duration_ms: Date.now() - startTime,
      })
    }

    // If auto-activate feature is disabled (delay = 0), skip
    const autoActivateDelay = claraWhatsAppConfig?.auto_activate_delay_minutes
    if (!autoActivateDelay || autoActivateDelay <= 0) {
      return NextResponse.json({
        skipped: true,
        reason: 'auto_activate_delay_minutes is 0 or not set',
        duration_ms: Date.now() - startTime,
      })
    }

    // Find conversations with expired auto-activate timers
    const now = new Date().toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conversations, error: queryError } = await (supabase as any)
      .from('whatsapp_conversations')
      .select('id, phone, contact_name, branch_id, clara_paused, clara_paused_until')
      .lte('clara_auto_activate_at', now)
      .eq('status', 'active')
      .limit(10)

    if (queryError) {
      console.error('[CLARA AUTO-ACTIVATE] Query error:', queryError)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({
        processed: 0,
        duration_ms: Date.now() - startTime,
      })
    }

    console.log(`[CLARA AUTO-ACTIVATE] Found ${conversations.length} conversations to process`)

    // Check Clara schedule (Israel timezone)
    let outsideSchedule = false
    if (claraWhatsAppConfig?.schedule_enabled && claraWhatsAppConfig?.schedule) {
      const israelNow = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })
      const israelDate = new Date(israelNow)
      const dayName = israelDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
      const currentTime = israelDate.toTimeString().slice(0, 5) // "HH:MM"
      const daySchedule = claraWhatsAppConfig.schedule[dayName]

      if (!daySchedule?.enabled) {
        outsideSchedule = true
      } else if (currentTime < daySchedule.start || currentTime >= daySchedule.end) {
        outsideSchedule = true
      }

      if (outsideSchedule) {
        console.log(`[CLARA AUTO-ACTIVATE] Outside schedule (${dayName} ${currentTime}), skipping but keeping timers`)
        return NextResponse.json({
          skipped: true,
          reason: 'outside_schedule',
          pending: conversations.length,
          duration_ms: Date.now() - startTime,
        })
      }
    }

    const results: Array<{ id: string; status: string; error?: string }> = []

    for (const conv of conversations) {
      try {
        // Safety check: no outbound message after the last inbound
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: lastMessages } = await (supabase as any)
          .from('whatsapp_messages')
          .select('direction, content, message_type')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(5)

        // Find the last inbound message (this is what Clara will respond to)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lastInbound = lastMessages?.find((m: any) => m.direction === 'inbound')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lastOutbound = lastMessages?.find((m: any) => m.direction === 'outbound')

        if (!lastInbound) {
          // No inbound message → clear timer and skip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('whatsapp_conversations')
            .update({ clara_auto_activate_at: null })
            .eq('id', conv.id)
          results.push({ id: conv.id, status: 'skipped', error: 'no_inbound_message' })
          continue
        }

        // If there's an outbound message more recent than the last inbound → human already responded
        if (lastMessages && lastMessages.length > 0) {
          const lastMsgDirection = lastMessages[0].direction
          if (lastMsgDirection === 'outbound') {
            // Human already responded → clear timer
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from('whatsapp_conversations')
              .update({ clara_auto_activate_at: null })
              .eq('id', conv.id)
            results.push({ id: conv.id, status: 'skipped', error: 'human_already_responded' })
            continue
          }
        }

        // Check active branches
        if (claraWhatsAppConfig?.active_branches?.length > 0 && conv.branch_id) {
          if (!claraWhatsAppConfig.active_branches.includes(conv.branch_id)) {
            // Branch inactive → clear timer (won't retry)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from('whatsapp_conversations')
              .update({ clara_auto_activate_at: null })
              .eq('id', conv.id)
            results.push({ id: conv.id, status: 'skipped', error: 'branch_inactive' })
            continue
          }
        }

        // Clear timer + unpause Clara
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('whatsapp_conversations')
          .update({
            clara_auto_activate_at: null,
            clara_paused: false,
            clara_paused_until: null,
          })
          .eq('id', conv.id)

        // Get message text to pass to Clara
        const messageText = lastInbound.content || ''
        const language = msSettings?.settings?.whatsapp_onboarding?.language || 'he'

        // Trigger Clara
        await handleClaraWhatsAppResponse(
          supabase,
          { id: conv.id, branch_id: conv.branch_id, contact_name: conv.contact_name },
          conv.phone,
          messageText,
          claraWhatsAppConfig,
          language
        )

        console.log(`[CLARA AUTO-ACTIVATE] Clara activated for conversation ${conv.id} (${conv.phone})`)
        results.push({ id: conv.id, status: 'activated' })
      } catch (err) {
        console.error(`[CLARA AUTO-ACTIVATE] Error processing conversation ${conv.id}:`, err)
        // Clear timer to avoid infinite retry loop
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('whatsapp_conversations')
          .update({ clara_auto_activate_at: null })
          .eq('id', conv.id)
        results.push({ id: conv.id, status: 'error', error: String(err) })
      }
    }

    const activated = results.filter(r => r.status === 'activated').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const errors = results.filter(r => r.status === 'error').length

    console.log(`[CLARA AUTO-ACTIVATE] Done: ${activated} activated, ${skipped} skipped, ${errors} errors`)

    return NextResponse.json({
      processed: conversations.length,
      activated,
      skipped,
      errors,
      results,
      duration_ms: Date.now() - startTime,
    })
  } catch (error) {
    console.error('[CLARA AUTO-ACTIVATE] Fatal error:', error)
    return NextResponse.json(
      { error: 'Internal error', duration_ms: Date.now() - startTime },
      { status: 500 }
    )
  }
}
