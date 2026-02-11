/**
 * Delete WhatsApp conversation (super_admin only)
 * POST /api/chat/conversations/[id]/delete
 *
 * Hard-deletes the conversation and all its messages (CASCADE).
 * Reserved exclusively for super_admin — not exposed in permissions UI.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Check super_admin role (hardcoded — no permission system)
    const serviceClient = createServiceRoleClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error: profileError } = await (serviceClient as any)
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden — super_admin only' }, { status: 403 })
    }

    // 3. Verify conversation exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conversation, error: fetchError } = await (serviceClient as any)
      .from('whatsapp_conversations')
      .select('id, phone, contact_name')
      .eq('id', id)
      .single()

    if (fetchError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // 4. Delete conversation (messages are CASCADE-deleted)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (serviceClient as any)
      .from('whatsapp_conversations')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[CHAT API] Error deleting WA conversation:', deleteError)
      return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
    }

    console.log(`[CHAT API] Super admin ${user.id} deleted WA conversation ${id} (${conversation.phone})`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CHAT API] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
