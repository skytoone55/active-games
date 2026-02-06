import { NextRequest, NextResponse } from 'next/server'
import { processUserMessage } from '@/lib/messenger/engine'

/**
 * POST /api/messenger/message
 * Traite un message utilisateur
 * Body: { conversationId: string, message: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, message } = body

    if (!conversationId || !message) {
      return NextResponse.json(
        { success: false, error: 'conversationId and message are required' },
        { status: 400 }
      )
    }

    const result = await processUserMessage(conversationId, message)

    console.log('[Message API] Result from engine:', {
      success: result.success,
      message: result.message,
      moduleType: result.moduleType,
      choicesCount: result.choices?.length || 0,
      choices: result.choices
    })

    return NextResponse.json({
      success: result.success,
      message: result.message,
      nextStepRef: result.nextStepRef,
      conversationStatus: result.conversationStatus,
      moduleType: result.moduleType,
      choices: result.choices,
      error: result.error
    })
  } catch (error: any) {
    console.error('[Messenger Message API] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
