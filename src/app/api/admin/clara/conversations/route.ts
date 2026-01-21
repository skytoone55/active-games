/**
 * API pour gérer les conversations Clara
 * GET: Liste des conversations
 * PATCH: Renommer une conversation
 * DELETE: Supprimer une conversation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

// GET - Liste des conversations
export async function GET() {
  try {
    const { success, errorResponse, userId } = await verifyApiPermission('orders', 'view')
    if (!success || !userId) {
      return errorResponse
    }

    const supabase = createServiceRoleClient()

    // Récupérer les conversations de l'utilisateur
    const { data: conversations, error } = await supabase
      .from('ai_conversations')
      .select(`
        id,
        title,
        updated_at,
        ai_messages (
          id,
          content
        )
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching conversations:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch conversations' }, { status: 500 })
    }

    // Formater les conversations
    const formattedConversations = conversations?.map(conv => ({
      id: conv.id,
      title: conv.title || generateTitle(conv.ai_messages),
      lastMessage: conv.ai_messages?.[0]?.content?.substring(0, 50) || '',
      updatedAt: conv.updated_at,
      messageCount: conv.ai_messages?.length || 0
    })) || []

    return NextResponse.json({
      success: true,
      conversations: formattedConversations
    })

  } catch (error) {
    console.error('Error in conversations API:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Renommer une conversation
export async function PATCH(request: NextRequest) {
  try {
    const { success, errorResponse, userId } = await verifyApiPermission('orders', 'view')
    if (!success || !userId) {
      return errorResponse
    }

    const { conversationId, title } = await request.json()

    if (!conversationId || !title) {
      return NextResponse.json({ success: false, error: 'Missing conversationId or title' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Vérifier que la conversation appartient à l'utilisateur
    const { data: conv } = await supabase
      .from('ai_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single()

    if (!conv) {
      return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 })
    }

    // Mettre à jour le titre
    const { error } = await supabase
      .from('ai_conversations')
      .update({ title })
      .eq('id', conversationId)

    if (error) {
      console.error('Error updating conversation:', error)
      return NextResponse.json({ success: false, error: 'Failed to update conversation' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in conversations PATCH:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Supprimer une conversation
export async function DELETE(request: NextRequest) {
  try {
    const { success, errorResponse, userId } = await verifyApiPermission('orders', 'view')
    if (!success || !userId) {
      return errorResponse
    }

    const { conversationId } = await request.json()

    if (!conversationId) {
      return NextResponse.json({ success: false, error: 'Missing conversationId' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Vérifier que la conversation appartient à l'utilisateur
    const { data: conv } = await supabase
      .from('ai_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single()

    if (!conv) {
      return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 })
    }

    // Supprimer les messages d'abord (FK constraint)
    await supabase
      .from('ai_messages')
      .delete()
      .eq('conversation_id', conversationId)

    // Supprimer la conversation
    const { error } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', conversationId)

    if (error) {
      console.error('Error deleting conversation:', error)
      return NextResponse.json({ success: false, error: 'Failed to delete conversation' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in conversations DELETE:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// Helper pour générer un titre à partir des messages
function generateTitle(messages: { content: string }[] | null): string {
  if (!messages || messages.length === 0) return 'Sans titre'

  // Prendre le premier message utilisateur
  const firstMessage = messages[0]?.content || ''

  // Tronquer à 30 caractères
  if (firstMessage.length <= 30) return firstMessage
  return firstMessage.substring(0, 30) + '...'
}
