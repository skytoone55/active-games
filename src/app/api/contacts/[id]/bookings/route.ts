/**
 * API Route pour récupérer les réservations liées à un contact
 * GET: Liste des réservations d'un contact
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

/**
 * GET /api/contacts/[id]/bookings
 * Récupère les réservations liées à un contact
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

    const { id: contactId } = await params
    const searchParams = request.nextUrl.searchParams
    const branchId = searchParams.get('branchId') || searchParams.get('branch_id')

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: 'branchId is required', messageKey: 'errors.branchRequired' },
        { status: 400 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(branchId)) {
      return NextResponse.json(
        { success: false, error: 'Branch access denied', messageKey: 'errors.branchAccessDenied' },
        { status: 403 }
      )
    }

    const supabase = createServiceRoleClient()

    // Récupérer les réservations via booking_contacts
    const { data: bookingContacts, error: bookingContactsError } = await supabase
      .from('booking_contacts')
      .select('booking_id')
      .eq('contact_id', contactId)
      .returns<Array<{ booking_id: string }>>()

    if (bookingContactsError) {
      console.error('Error fetching booking contacts:', bookingContactsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch booking links', messageKey: 'errors.fetchFailed' },
        { status: 500 }
      )
    }

    if (!bookingContacts || bookingContacts.length === 0) {
      return NextResponse.json({ success: true, bookings: [] })
    }

    const bookingIds = bookingContacts.map((bc) => bc.booking_id)

    // Récupérer les bookings avec leurs game_sessions
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, reference_code, type, status, start_datetime, end_datetime, participants_count, created_at, game_sessions(id, game_area)')
      .in('id', bookingIds)
      .eq('branch_id', branchId)
      .order('start_datetime', { ascending: false })

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch bookings', messageKey: 'errors.fetchFailed' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, bookings: bookings || [] })

  } catch (error) {
    console.error('Error in GET /api/contacts/[id]/bookings:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', messageKey: 'errors.internalError' },
      { status: 500 }
    )
  }
}
