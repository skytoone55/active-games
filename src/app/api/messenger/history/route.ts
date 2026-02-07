/**
 * API pour récupérer l'historique d'une conversation messenger
 * Utilisé pour restaurer les conversations persistées
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function GET(request: NextRequest) {
  const supabase = createServiceRoleClient()
  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get('conversationId')

  if (!conversationId) {
    return NextResponse.json(
      { success: false, error: 'conversationId is required' },
      { status: 400 }
    )
  }

  try {
    // Récupérer les messages de la conversation
    const { data: messages, error } = await supabase
      .from('messenger_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[Messenger History] Error fetching messages:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      messages: messages || []
    })
  } catch (error) {
    console.error('[Messenger History] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
