/**
 * Link a contact to a messenger conversation (and update branch_id)
 * POST /api/chat/messenger-conversations/[id]/link-contact
 * Body: { contactId: string }
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

    const { id } = await params
    const body = await request.json()
    const { contactId } = body

    if (!contactId) {
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Get the contact to find their branch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contact, error: contactError } = await (supabase as any)
      .from('contacts')
      .select('id, branch_id_main, first_name, last_name')
      .eq('id', contactId)
      .single()

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Update the messenger conversation with contact_id and branch_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error } = await (supabase as any)
      .from('messenger_conversations')
      .update({
        contact_id: contactId,
        branch_id: contact.branch_id_main,
      })
      .eq('id', id)
      .select('*, contacts:contact_id(id, first_name, last_name, phone, email), branch:branch_id(id, name, name_en)')
      .single()

    if (error) {
      console.error('[MESSENGER API] Error linking contact:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, conversation: updated })
  } catch (error) {
    console.error('[MESSENGER API] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
