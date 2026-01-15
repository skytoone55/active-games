/**
 * Gestion des contacts (CRM) - Migration vers Supabase
 * Cette lib remplace l'ancienne version JSON par des appels Supabase
 */

import { createClient } from '@/lib/supabase/server'
import type { Contact, ContactSource, ContactStatus } from '@/lib/supabase/types'

export interface ContactData {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
  email: string | null
  alias: string | null
  notes: string | null
  branch: string | null
  source: ContactSource
  createdAt: string
}

/**
 * Convertit un Contact Supabase vers l'interface ContactData (pour compatibilité)
 */
function contactToData(contact: Contact): ContactData {
  return {
    id: contact.id,
    firstName: contact.first_name || null,
    lastName: contact.last_name || null,
    phone: contact.phone,
    email: contact.email || null,
    alias: contact.alias || null,
    notes: contact.notes_client || null,
    branch: contact.branch_id_main || null,
    source: contact.source,
    createdAt: contact.created_at,
  }
}

/**
 * Lit tous les contacts actifs depuis Supabase
 */
export async function getAllContacts(branchId?: string): Promise<ContactData[]> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('contacts')
      .select('*')
      .eq('status', 'active')

    if (branchId) {
      query = query.eq('branch_id_main', branchId)
    }

    const { data, error } = await query.order('created_at', { ascending: false }).returns<Contact[]>()

    if (error) throw error

    return (data || []).map(contactToData)
  } catch (error) {
    console.error('Error reading contacts:', error)
    throw error
  }
}

/**
 * Trouve un contact existant par téléphone ou email
 */
export async function findContactByPhoneOrEmail(
  phone: string | null,
  email: string | null,
  branchId: string
): Promise<ContactData | null> {
  try {
    const supabase = await createClient()

    if (phone) {
      const { data: phoneContact } = await supabase
        .from('contacts')
        .select('*')
        .eq('branch_id_main', branchId)
        .eq('phone', phone.trim())
        .eq('status', 'active')
        .single<Contact>()

      if (phoneContact) return contactToData(phoneContact)
    }

    if (email && email.trim()) {
      const { data: emailContact } = await supabase
        .from('contacts')
        .select('*')
        .eq('branch_id_main', branchId)
        .eq('email', email.trim())
        .eq('status', 'active')
        .single<Contact>()

      if (emailContact) return contactToData(emailContact)
    }

    return null
  } catch (error) {
    // Si aucun contact trouvé, retourner null (pas une erreur)
    if ((error as any)?.code === 'PGRST116') {
      return null
    }
    console.error('Error finding contact:', error)
    return null
  }
}

/**
 * Met à jour un contact existant dans Supabase
 */
export async function updateContact(
  id: string,
  updates: Partial<Omit<ContactData, 'id' | 'createdAt' | 'source'>>
): Promise<ContactData> {
  try {
    const supabase = await createClient()

    const updateData: Record<string, unknown> = {}

    if (updates.firstName !== undefined) updateData.first_name = updates.firstName?.trim() || null
    if (updates.lastName !== undefined) updateData.last_name = updates.lastName?.trim() || null
    if (updates.phone !== undefined) updateData.phone = updates.phone.trim()
    if (updates.email !== undefined) updateData.email = updates.email?.trim() || null
    if (updates.alias !== undefined) updateData.alias = updates.alias?.trim() || null
    if (updates.notes !== undefined) updateData.notes_client = updates.notes?.trim() || null
    if (updates.branch !== undefined) updateData.branch_id_main = updates.branch || null

    // @ts-ignore - Supabase typing issue with dynamic updates
    const query = supabase.from('contacts') as any
    const { data: updatedContact, error } = await query
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!updatedContact) throw new Error('Contact not found after update')

    return contactToData(updatedContact)
  } catch (error) {
    console.error('Error updating contact:', error)
    throw error
  }
}

/**
 * Supprime un contact (archive) par son ID
 */
export async function deleteContact(id: string): Promise<boolean> {
  try {
    const supabase = await createClient()

    // @ts-ignore - Supabase typing issue with dynamic updates
    const query = supabase.from('contacts') as any
    const { error } = await query
      .update({
        status: 'archived' as ContactStatus,
        archived_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error

    return true
  } catch (error) {
    console.error('Error deleting contact:', error)
    throw error
  }
}

/**
 * Sauvegarde un nouveau contact dans Supabase
 */
export async function saveContact(
  contact: Omit<ContactData, 'id' | 'createdAt'>,
  branchId: string
): Promise<ContactData> {
  try {
    const supabase = await createClient()

    const { data: newContact, error } = await supabase
      .from('contacts')
      .insert({
        branch_id_main: branchId,
        first_name: contact.firstName?.trim() || null,
        last_name: contact.lastName?.trim() || null,
        phone: contact.phone.trim(),
        email: contact.email?.trim() || null,
        alias: contact.alias?.trim() || null,
        notes_client: contact.notes?.trim() || null,
        source: contact.source || 'admin_agenda',
        status: 'active',
      } as any)
      .select()
      .single<Contact>()

    if (error) throw error
    if (!newContact) throw new Error('Failed to create contact')

    return contactToData(newContact)
  } catch (error) {
    console.error('Error saving contact:', error)
    throw error
  }
}

/**
 * Export pour compatibilité avec l'ancien code
 */
export type { ContactData as Contact }