/**
 * Delete WhatsApp conversation (super_admin only)
 * POST /api/chat/conversations/[id]/delete
 *
 * Hard-deletes the conversation and all its messages (CASCADE).
 * Reserved exclusively for super_admin — not exposed in permissions UI.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('chat', 'delete')
    if (!success || !user) return errorResponse!

    const { id } = await params
    const serviceClient = createServiceRoleClient()

    // Verify conversation exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conversation, error: fetchError } = await (serviceClient as any)
      .from('whatsapp_conversations')
      .select('id, phone, contact_name')
      .eq('id', id)
      .single()

    if (fetchError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Delete conversation (messages are CASCADE-deleted)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (serviceClient as any)
      .from('whatsapp_conversations')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[CHAT API] Error deleting WA conversation:', deleteError)
      return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
    }

    console.log(`[CHAT API] User ${user.id} deleted WA conversation ${id} (${conversation.phone})`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CHAT API] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
