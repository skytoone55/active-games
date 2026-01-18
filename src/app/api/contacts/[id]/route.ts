/**
 * API Route pour gérer un contact individuel
 * GET: Récupérer un contact
 * PUT: Mettre à jour un contact
 * DELETE: Archiver un contact (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { logContactAction, getClientIpFromHeaders } from '@/lib/activity-logger'
import type { Contact, ContactStatus, UserRole } from '@/lib/supabase/types'

/**
 * GET /api/contacts/[id]
 * Récupère un contact spécifique
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérifier les permissions
    const { success, user, errorResponse } = await verifyApiPermission('clients', 'view')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const supabase = createServiceRoleClient()

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single<Contact>()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Contact not found', messageKey: 'errors.contactNotFound' },
          { status: 404 }
        )
      }
      console.error('Error fetching contact:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contact', messageKey: 'errors.fetchFailed' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, contact })
  } catch (error) {
    console.error('Error fetching contact:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch contact', messageKey: 'errors.fetchFailed' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/contacts/[id]
 * Met à jour un contact spécifique
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérifier les permissions
    const { success, user, errorResponse } = await verifyApiPermission('clients', 'edit')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const body = await request.json()
    const supabase = createServiceRoleClient()
    const ipAddress = getClientIpFromHeaders(request.headers)

    // Récupérer le contact actuel pour le log (avant modification)
    const { data: oldContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single<Contact>()

    if (!oldContact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found', messageKey: 'errors.contactNotFound' },
        { status: 404 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}

    if (body.first_name !== undefined) updateData.first_name = body.first_name?.trim()
    if (body.last_name !== undefined) updateData.last_name = body.last_name?.trim() || null
    if (body.phone !== undefined) updateData.phone = body.phone?.trim()
    if (body.email !== undefined) updateData.email = body.email?.trim() || null
    if (body.notes_client !== undefined) updateData.notes_client = body.notes_client?.trim() || null
    if (body.alias !== undefined) updateData.alias = body.alias?.trim() || null
    if (body.source !== undefined) updateData.source = body.source

    // Gestion du status (archivage/désarchivage)
    if (body.status !== undefined) {
      updateData.status = body.status as ContactStatus
      if (body.status === 'archived') {
        updateData.archived_at = new Date().toISOString()
        if (body.archived_reason !== undefined) {
          updateData.archived_reason = body.archived_reason?.trim() || null
        }
      } else if (body.status === 'active') {
        updateData.archived_at = null
        updateData.archived_reason = null
      }
    }

    updateData.updated_at = new Date().toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contact, error } = await (supabase as any)
      .from('contacts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single() as { data: Contact | null; error: any }

    if (error || !contact) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Contact not found', messageKey: 'errors.contactNotFound' },
          { status: 404 }
        )
      }
      console.error('Error updating contact:', error)
      return NextResponse.json(
        { success: false, error: error?.message || 'Failed to update contact', messageKey: 'errors.updateFailed' },
        { status: 500 }
      )
    }

    // ====================================================================
    // SYNCHRONISER les données vers les orders et bookings liés
    // ====================================================================
    // Si les champs de données client ont changé, mettre à jour les copies
    const customerFieldsChanged =
      updateData.first_name !== undefined ||
      updateData.last_name !== undefined ||
      updateData.phone !== undefined ||
      updateData.email !== undefined

    if (customerFieldsChanged) {
      // Préparer les données pour la synchronisation
      const syncData: Record<string, unknown> = {}
      if (updateData.first_name !== undefined) syncData.customer_first_name = contact.first_name
      if (updateData.last_name !== undefined) syncData.customer_last_name = contact.last_name || ''
      if (updateData.phone !== undefined) syncData.customer_phone = contact.phone
      if (updateData.email !== undefined) syncData.customer_email = contact.email

      // Synchroniser vers les orders liées
      if (Object.keys(syncData).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: ordersError } = await (supabase as any)
          .from('orders')
          .update(syncData)
          .eq('contact_id', id)

        if (ordersError) {
          console.warn('Warning: Failed to sync contact data to orders:', ordersError)
          // On continue quand même - ce n'est pas bloquant
        }

        // Synchroniser vers les bookings liés (via primary_contact_id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: bookingsError } = await (supabase as any)
          .from('bookings')
          .update(syncData)
          .eq('primary_contact_id', id)

        if (bookingsError) {
          console.warn('Warning: Failed to sync contact data to bookings:', bookingsError)
          // On continue quand même - ce n'est pas bloquant
        }
      }
    }

    // Déterminer l'action (archivage ou simple update)
    const actionType = body.status === 'archived' ? 'archived' : 'updated'

    // Logger la modification
    await logContactAction({
      userId: user.id,
      userRole: user.role as UserRole,
      userName: `${user.profile.first_name} ${user.profile.last_name}`,
      action: actionType,
      contactId: id,
      contactName: `${contact.first_name} ${contact.last_name || ''}`.trim(),
      details: {
        changes: Object.keys(updateData).filter(k => k !== 'updated_at'),
        oldValues: {
          first_name: oldContact.first_name,
          last_name: oldContact.last_name,
          phone: oldContact.phone,
          email: oldContact.email,
          status: oldContact.status
        },
        newValues: {
          first_name: contact.first_name,
          last_name: contact.last_name,
          phone: contact.phone,
          email: contact.email,
          status: contact.status
        }
      },
      ipAddress
    })

    return NextResponse.json({ success: true, contact })
  } catch (error) {
    console.error('Error updating contact:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update contact', messageKey: 'errors.updateFailed' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/contacts/[id]
 * Archive un contact (soft delete) - pas de hard delete via UI
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérifier les permissions
    const { success, user, errorResponse } = await verifyApiPermission('clients', 'delete')
    if (!success || !user) {
      return errorResponse
    }

    const { id } = await params
    const supabase = createServiceRoleClient()
    const ipAddress = getClientIpFromHeaders(request.headers)

    // Récupérer le contact avant archivage pour le log
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single<Contact>()

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found', messageKey: 'errors.contactNotFound' },
        { status: 404 }
      )
    }

    // Soft delete = archivage (pas de hard delete via UI en v1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('contacts')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      console.error('Error archiving contact:', error)
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to archive contact', messageKey: 'errors.archiveFailed' },
        { status: 500 }
      )
    }

    // Logger l'archivage
    await logContactAction({
      userId: user.id,
      userRole: user.role as UserRole,
      userName: `${user.profile.first_name} ${user.profile.last_name}`,
      action: 'archived',
      contactId: id,
      contactName: `${contact.first_name} ${contact.last_name || ''}`.trim(),
      details: {
        phone: contact.phone,
        email: contact.email,
        previousStatus: contact.status
      },
      ipAddress
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error archiving contact:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to archive contact', messageKey: 'errors.archiveFailed' },
      { status: 500 }
    )
  }
}
