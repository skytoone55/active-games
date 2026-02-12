/**
 * Link a contact to a conversation (and update branch_id)
 * POST /api/chat/conversations/[id]/link-contact
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

    // Update the conversation with contact_id and branch_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error } = await (supabase as any)
      .from('whatsapp_conversations')
      .update({
        contact_id: contactId,
        branch_id: contact.branch_id_main,
        contact_name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, contacts:contact_id(id, first_name, last_name, phone, email), branch:branch_id(id, name, name_en)')
      .single()

    if (error) {
      console.error('[CHAT API] Error linking contact:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, conversation: updated })
  } catch (error) {
    console.error('[CHAT API] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
