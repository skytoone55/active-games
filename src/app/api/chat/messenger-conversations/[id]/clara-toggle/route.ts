/**
 * Clara Toggle API for Messenger conversations
 * POST - Toggle Clara AI on/off
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { success, errorResponse } = await verifyApiPermission('chat', 'edit')
    if (!success) return errorResponse!

    const { id: conversationId } = await params
    const { paused } = await request.json()

    if (typeof paused !== 'boolean') {
      return NextResponse.json({ error: 'paused (boolean) required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Manual toggle: permanent pause until manually re-enabled (no auto-resume timeout)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('messenger_conversations')
      .update({
        clara_paused: paused,
        clara_paused_until: null,
      })
      .eq('id', conversationId)
      .select('id, clara_paused, clara_paused_until')
      .single()

    if (error) {
      console.error('[MS CLARA TOGGLE] Error:', error)
      return NextResponse.json({ error: 'Failed to toggle Clara' }, { status: 500 })
    }

    return NextResponse.json({ success: true, conversation: data })
  } catch (error) {
    console.error('[MS CLARA TOGGLE] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
