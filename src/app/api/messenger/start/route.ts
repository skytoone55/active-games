import { NextRequest, NextResponse } from 'next/server'
import { startConversation } from '@/lib/messenger/engine'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * POST /api/messenger/start
 * Démarre une nouvelle conversation
 * Body: { sessionId: string, branchId?: string, contactId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, branchId, contactId, locale } = body

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      )
    }

    // Check if messenger is active
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceRoleClient() as any
    const { data: msSettings } = await supabase
      .from('messenger_settings')
      .select('is_active')
      .single()

    if (msSettings && msSettings.is_active === false) {
      return NextResponse.json(
        { success: false, error: 'messenger_disabled' },
        { status: 403 }
      )
    }

    const result = await startConversation(sessionId, branchId, contactId, locale)

    return NextResponse.json({
      success: true,
      conversationId: result.conversationId,
      firstMessage: result.firstMessage,
      locale: result.locale,
      moduleType: result.moduleType,
      choices: result.choices
    })
  } catch (error: any) {
    console.error('[Messenger Start API] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
