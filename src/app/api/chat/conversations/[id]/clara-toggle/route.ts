/**
 * Clara Toggle API
 * POST - Toggle Clara AI on/off for a WhatsApp conversation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params
    const { paused } = await request.json()

    if (typeof paused !== 'boolean') {
      return NextResponse.json({ error: 'paused (boolean) required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    let pausedUntil: string | null = null

    if (paused) {
      // When manually pausing, get auto-resume timeout from settings
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: msSettings } = await (supabase as any)
          .from('messenger_settings')
          .select('settings')
          .single()
        const autoResumeMinutes = msSettings?.settings?.whatsapp_clara?.auto_resume_minutes || 5
        pausedUntil = new Date(Date.now() + autoResumeMinutes * 60 * 1000).toISOString()
      } catch {
        pausedUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString()
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('whatsapp_conversations')
      .update({
        clara_paused: paused,
        clara_paused_until: paused ? pausedUntil : null,
      })
      .eq('id', conversationId)
      .select('id, clara_paused, clara_paused_until')
      .single()

    if (error) {
      console.error('[CLARA TOGGLE] Error:', error)
      return NextResponse.json({ error: 'Failed to toggle Clara' }, { status: 500 })
    }

    return NextResponse.json({ success: true, conversation: data })
  } catch (error) {
    console.error('[CLARA TOGGLE] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
