/**
 * Chat Messages API
 * GET - Get messages for a conversation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const { success, errorResponse } = await verifyApiPermission('chat', 'view')
    if (!success) return errorResponse!

    const supabase = createServiceRoleClient()
    const { searchParams } = request.nextUrl

    const conversationId = searchParams.get('conversationId')
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
    }

    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')
    const offset = (page - 1) * pageSize

    // BUG CORRIGÉ : on triait par date CROISSANTE avec .range(0, 99), donc on
    // renvoyait les 100 messages les PLUS ANCIENS. Au-delà de 100 messages dans
    // une conversation, les nouveaux messages n'apparaissaient JAMAIS dans le fil
    // — les employés envoyaient une réponse (bien partie et délivrée), ne la
    // voyaient pas s'afficher, et croyaient que l'envoi était cassé.
    // On récupère désormais les plus RÉCENTS (tri décroissant), puis on remet
    // l'ordre chronologique pour l'affichage. page=2 remonte les 100 précédents.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error, count } = await (supabase as any)
      .from('whatsapp_messages')
      .select('*', { count: 'exact' })
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) {
      console.error('[CHAT API] Error fetching messages:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Remettre dans l'ordre chronologique (le plus ancien en haut)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages = [...(data || [])].reverse()

    // Mark conversation as read
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('whatsapp_conversations')
      .update({ unread_count: 0, updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    return NextResponse.json({
      messages,
      total: count || 0,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('[CHAT API] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
