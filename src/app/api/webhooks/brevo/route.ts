/**
 * Brevo Webhook Handler
 * Receives webhook events from Brevo to update email delivery status
 *
 * Brevo events:
 * - request: Email submitted to Brevo
 * - delivered: Email delivered to recipient's mail server
 * - soft_bounce: Temporary delivery failure
 * - hard_bounce: Permanent delivery failure
 * - complaint: Recipient marked email as spam
 * - unique_opened: Email opened (first time)
 * - opened: Email opened
 * - click: Link clicked in email
 * - invalid_email: Email address invalid
 * - deferred: Delivery deferred
 * - blocked: Email blocked
 * - error: Sending error
 * - unsubscribed: Recipient unsubscribed
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Brevo webhook event types
type BrevoEventType =
  | 'request'
  | 'delivered'
  | 'soft_bounce'
  | 'hard_bounce'
  | 'complaint'
  | 'unique_opened'
  | 'opened'
  | 'click'
  | 'invalid_email'
  | 'deferred'
  | 'blocked'
  | 'error'
  | 'unsubscribed'

interface BrevoWebhookPayload {
  event: BrevoEventType
  email: string
  id: number // Campaign ID
  date: string // ISO date string
  ts: number // Unix timestamp
  'message-id': string // Brevo message ID
  ts_event: number
  subject?: string
  tag?: string
  sending_ip?: string
  ts_epoch?: number
  template_id?: number
  // Bounce specific
  reason?: string
  // Click specific
  link?: string
  // Error specific
  error_code?: string
}

// Map Brevo events to our email_logs status
function mapBrevoEventToStatus(event: BrevoEventType): 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced' | null {
  switch (event) {
    case 'request':
      return 'sent'
    case 'delivered':
      return 'delivered'
    case 'soft_bounce':
    case 'hard_bounce':
    case 'complaint':
    case 'blocked':
      return 'bounced'
    case 'invalid_email':
    case 'error':
      return 'failed'
    case 'unique_opened':
    case 'opened':
    case 'click':
    case 'deferred':
    case 'unsubscribed':
      // These events don't change the delivery status
      return null
    default:
      return null
  }
}

// Get admin Supabase client
const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as BrevoWebhookPayload

    console.log('[BREVO WEBHOOK] Received event:', payload.event)
    console.log('[BREVO WEBHOOK] Message ID:', payload['message-id'])
    console.log('[BREVO WEBHOOK] Email:', payload.email)

    // Validate required fields
    if (!payload.event || !payload['message-id']) {
      console.error('[BREVO WEBHOOK] Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = getAdminSupabase()
    const messageId = payload['message-id']

    // Find the email log by Brevo message ID (stored in metadata)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: emailLogs, error: findError } = await (supabase as any)
      .from('email_logs')
      .select('id, status, metadata')
      .eq('metadata->>brevo_message_id', messageId)

    if (findError) {
      console.error('[BREVO WEBHOOK] Error finding email log:', findError)
      // Return 200 to acknowledge receipt (Brevo will retry on non-200)
      return NextResponse.json({ received: true, processed: false })
    }

    if (!emailLogs || emailLogs.length === 0) {
      console.log('[BREVO WEBHOOK] No email log found for message ID:', messageId)
      // Return 200 to acknowledge receipt
      return NextResponse.json({ received: true, processed: false })
    }

    const emailLog = emailLogs[0]
    const newStatus = mapBrevoEventToStatus(payload.event)

    // Prepare update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      metadata: {
        ...(emailLog.metadata || {}),
        brevo_last_event: payload.event,
        brevo_last_event_date: payload.date,
      }
    }

    // Update status if applicable
    if (newStatus) {
      updateData.status = newStatus

      // Add error message for failures
      if (newStatus === 'failed' || newStatus === 'bounced') {
        updateData.error_message = payload.reason || `Brevo event: ${payload.event}`
      }
    }

    // Add delivered timestamp
    if (newStatus === 'delivered') {
      updateData.metadata = {
        ...updateData.metadata,
        delivered_at: payload.date,
      }
    }

    // Update the email log
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('email_logs')
      .update(updateData)
      .eq('id', emailLog.id)

    if (updateError) {
      console.error('[BREVO WEBHOOK] Error updating email log:', updateError)
      return NextResponse.json({ received: true, processed: false })
    }

    console.log('[BREVO WEBHOOK] Updated email log:', emailLog.id, 'status:', newStatus || '(unchanged)')

    return NextResponse.json({
      received: true,
      processed: true,
      emailLogId: emailLog.id,
      newStatus: newStatus || 'unchanged'
    })

  } catch (error) {
    console.error('[BREVO WEBHOOK] Error processing webhook:', error)
    // Return 200 to acknowledge receipt (prevent Brevo retries)
    return NextResponse.json({ received: true, processed: false, error: 'Internal error' })
  }
}

// Brevo may also send GET requests to verify webhook URL
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'brevo-webhook' })
}
