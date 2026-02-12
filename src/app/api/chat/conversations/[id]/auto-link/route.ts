/**
 * Auto-link a contact to a WhatsApp conversation.
 * If a contact with the same phone already exists in the branch → link it.
 * If not → create a new contact then link it.
 *
 * POST /api/chat/conversations/[id]/auto-link
 * Body: { branchId: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { formatIsraeliPhone } from '@/lib/validation'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { branchId } = body

    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // 1. Get the conversation to find phone & contact_name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conversation, error: convError } = await (supabase as any)
      .from('whatsapp_conversations')
      .select('id, phone, contact_name, contact_id, branch_id')
      .eq('id', id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Already has a contact linked
    if (conversation.contact_id) {
      // Just update branch_id if needed
      if (conversation.branch_id !== branchId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: updated } = await (supabase as any)
          .from('whatsapp_conversations')
          .update({ branch_id: branchId, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select('*, contacts:contact_id(id, first_name, last_name, phone, email), branch:branch_id(id, name, name_en)')
          .single()
        return NextResponse.json({ success: true, conversation: updated, action: 'branch_updated' })
      }
      return NextResponse.json({ success: true, conversation, action: 'already_linked' })
    }

    // 2. Format phone to Israeli format for matching
    const rawPhone = conversation.phone.replace(/^\+/, '')
    let localPhone = rawPhone
    if (rawPhone.startsWith('972')) {
      localPhone = '0' + rawPhone.substring(3)
    }
    const formattedPhone = formatIsraeliPhone(localPhone)

    // 3. Check if a contact with this phone already exists in the branch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingContacts } = await (supabase as any)
      .from('contacts')
      .select('id, first_name, last_name, phone, email, branch_id_main')
      .eq('branch_id_main', branchId)
      .eq('phone', formattedPhone)
      .eq('status', 'active')
      .limit(1)

    let contactId: string

    if (existingContacts && existingContacts.length > 0) {
      // Contact exists → use it
      contactId = existingContacts[0].id
    } else {
      // 4. Create new contact from WhatsApp info
      const contactName = conversation.contact_name || ''
      const nameParts = contactName.trim().split(/\s+/)
      const firstName = nameParts[0] || localPhone // Fallback to phone if no name
      const lastName = nameParts.slice(1).join(' ') || null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newContact, error: createError } = await (supabase as any)
        .from('contacts')
        .insert({
          branch_id_main: branchId,
          first_name: firstName,
          last_name: lastName,
          phone: formattedPhone,
          source: 'whatsapp',
          client_type: 'individual',
          status: 'active',
        })
        .select('id, first_name, last_name, phone, email')
        .single()

      if (createError || !newContact) {
        console.error('[AUTO-LINK] Error creating contact:', createError)
        return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
      }

      contactId = newContact.id
    }

    // 5. Link the contact to the conversation (same logic as link-contact)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contact } = await (supabase as any)
      .from('contacts')
      .select('id, branch_id_main, first_name, last_name')
      .eq('id', contactId)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error: updateError } = await (supabase as any)
      .from('whatsapp_conversations')
      .update({
        contact_id: contactId,
        branch_id: branchId,
        contact_name: contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || undefined : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, contacts:contact_id(id, first_name, last_name, phone, email), branch:branch_id(id, name, name_en)')
      .single()

    if (updateError) {
      console.error('[AUTO-LINK] Error updating conversation:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      conversation: updated,
      action: existingContacts && existingContacts.length > 0 ? 'linked_existing' : 'created_and_linked',
    })
  } catch (error) {
    console.error('[AUTO-LINK] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
