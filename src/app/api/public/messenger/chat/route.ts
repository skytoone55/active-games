import { NextRequest, NextResponse } from 'next/server'
import { startConversation, processUserMessage } from '@/lib/messenger/engine'

/**
 * POST /api/public/messenger/chat
 * API publique pour le chat messenger
 * Body: { sessionId, message?, branchId?, contactId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, message, branchId, contactId } = body

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      )
    }

    // Si pas de message, démarrer une nouvelle conversation
    if (!message) {
      const result = await startConversation(sessionId, branchId, contactId)
      return NextResponse.json({
        success: true,
        data: {
          conversationId: result.conversationId,
          message: result.firstMessage,
          locale: result.locale,
          status: 'active'
        }
      })
    }

    // Sinon, traiter le message utilisateur
    const { conversationId, choiceId } = body
    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId is required' },
        { status: 400 }
      )
    }

    const result = await processUserMessage(conversationId, message, choiceId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        message: result.message,
        nextStepRef: result.nextStepRef,
        status: result.conversationStatus || 'active'
      }
    })
  } catch (error) {
    console.error('[Public Messenger API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
