/**
 * Cron Job: Check Email Status
 * Polls Brevo API to get real delivery status of recent emails
 *
 * Run every 30 minutes via Vercel Cron or external cron service
 * GET /api/cron/check-email-status
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Get admin Supabase client
const getAdminSupabase = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Brevo API base URL
const BREVO_API_URL = 'https://api.brevo.com/v3'

interface BrevoEventResponse {
  events: Array<{
    email: string
    date: string
    messageId: string
    event: string
    reason?: string
    tag?: string
  }>
}

// Map Brevo events to our status
function mapBrevoEventToStatus(event: string): 'delivered' | 'failed' | 'bounced' | null {
  switch (event) {
    case 'delivered':
    case 'opened':
    case 'clicks':
      return 'delivered'
    case 'softBounces':
    case 'hardBounces':
    case 'blocked':
    case 'spam':
      return 'bounced'
    case 'invalid':
    case 'error':
      return 'failed'
    default:
      return null
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (optional security)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Allow without auth if no secret is set (for testing)
      if (cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const apiKey = process.env.BREVO_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'BREVO_API_KEY not configured' }, { status: 500 })
    }

    const supabase = getAdminSupabase()

    // Get emails with status 'sent' from the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pendingEmails, error: fetchError } = await (supabase as any)
      .from('email_logs')
      .select('id, recipient_email, metadata, sent_at')
      .eq('status', 'sent')
      .gte('sent_at', oneDayAgo)
      .limit(50)

    if (fetchError) {
      console.error('[CRON check-email-status] Error fetching emails:', fetchError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return NextResponse.json({
        message: 'No pending emails to check',
        checked: 0,
        updated: 0
      })
    }

    console.log(`[CRON check-email-status] Checking ${pendingEmails.length} emails`)

    let updatedCount = 0
    const errors: string[] = []

    // Check each email via Brevo API
    for (const email of pendingEmails) {
      const brevoMessageId = email.metadata?.brevo_message_id

      if (!brevoMessageId) {
        console.log(`[CRON] Email ${email.id} has no brevo_message_id, skipping`)
        continue
      }

      try {
        // Get events for this specific message
        const response = await fetch(
          `${BREVO_API_URL}/smtp/statistics/events?messageId=${encodeURIComponent(brevoMessageId)}&limit=10`,
          {
            headers: {
              'api-key': apiKey,
              'Content-Type': 'application/json',
            },
          }
        )

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`[CRON] Brevo API error for ${email.id}:`, errorText)
          errors.push(`Email ${email.id}: Brevo API error`)
          continue
        }

        const data = await response.json() as BrevoEventResponse

        if (!data.events || data.events.length === 0) {
          // No events yet, email is still in transit
          continue
        }

        // Get the most recent event
        const latestEvent = data.events[0]
        const newStatus = mapBrevoEventToStatus(latestEvent.event)

        if (newStatus) {
          // Update the email log
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updateData: Record<string, any> = {
            status: newStatus,
            metadata: {
              ...(email.metadata || {}),
              brevo_last_event: latestEvent.event,
              brevo_last_event_date: latestEvent.date,
            }
          }

          if (newStatus === 'bounced' || newStatus === 'failed') {
            updateData.error_message = latestEvent.reason || `Brevo: ${latestEvent.event}`
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updateError } = await (supabase as any)
            .from('email_logs')
            .update(updateData)
            .eq('id', email.id)

          if (updateError) {
            console.error(`[CRON] Error updating email ${email.id}:`, updateError)
            errors.push(`Email ${email.id}: Update failed`)
          } else {
            console.log(`[CRON] Updated email ${email.id} to status: ${newStatus}`)
            updatedCount++
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (err) {
        console.error(`[CRON] Error checking email ${email.id}:`, err)
        errors.push(`Email ${email.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      message: 'Email status check completed',
      checked: pendingEmails.length,
      updated: updatedCount,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('[CRON check-email-status] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
