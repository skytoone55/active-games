/**
 * Delete individual WhatsApp message (super_admin only)
 * POST /api/chat/messages/[id]/delete
 *
 * Hard-deletes a single message from a conversation.
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

    // Verify message exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: message, error: fetchError } = await (serviceClient as any)
      .from('whatsapp_messages')
      .select('id, conversation_id, direction, content')
      .eq('id', id)
      .single()

    if (fetchError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Delete the message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (serviceClient as any)
      .from('whatsapp_messages')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[CHAT API] Error deleting WA message:', deleteError)
      return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
    }

    console.log(`[CHAT API] User ${user.id} deleted WA message ${id} (conv: ${message.conversation_id}, ${message.direction})`)

    return NextResponse.json({ success: true, conversationId: message.conversation_id })
  } catch (error) {
    console.error('[CHAT API] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
