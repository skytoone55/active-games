/**
 * API Route pour récupérer les statistiques d'un contact
 * GET: Stats d'un contact (nombre de réservations, participants, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'

interface BookingStat {
  id: string
  type: string
  status: string
  start_datetime: string
  participants_count: number
  created_at: string
}

/**
 * GET /api/contacts/[id]/stats
 * Récupère les statistiques d'un contact
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

    // Récupérer les réservations liées
    const { data: bookingContacts, error: bookingContactsError } = await supabase
      .from('booking_contacts')
      .select('booking_id')
      .eq('contact_id', contactId)
      .returns<Array<{ booking_id: string }>>()

    if (bookingContactsError) {
      console.error('Error fetching booking contacts:', bookingContactsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch stats', messageKey: 'errors.fetchFailed' },
        { status: 500 }
      )
    }

    // Si pas de réservations, retourner des stats vides
    if (!bookingContacts || bookingContacts.length === 0) {
      return NextResponse.json({
        success: true,
        stats: {
          totalBookings: 0,
          totalParticipants: 0,
          upcomingBookings: 0,
          pastBookings: 0,
          lastActivity: null,
          firstBooking: null,
          gameBookings: 0,
          eventBookings: 0,
        }
      })
    }

    const bookingIds = bookingContacts.map((bc) => bc.booking_id)
    const now = new Date().toISOString()

    // Récupérer les bookings avec stats
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, type, status, start_datetime, participants_count, created_at')
      .in('id', bookingIds)
      .eq('branch_id', branchId)
      .returns<BookingStat[]>()

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch stats', messageKey: 'errors.fetchFailed' },
        { status: 500 }
      )
    }

    const bookingsList = bookings || []
    const totalBookings = bookingsList.length
    const totalParticipants = bookingsList.reduce((sum, b) => sum + (b.participants_count || 0), 0)

    const upcomingBookings = bookingsList.filter((b) => b.start_datetime > now && b.status !== 'CANCELLED').length
    const pastBookings = bookingsList.filter((b) => b.start_datetime <= now || b.status === 'CANCELLED').length

    const gameBookings = bookingsList.filter((b) => b.type === 'GAME').length
    const eventBookings = bookingsList.filter((b) => b.type === 'EVENT').length

    // Dernière activité (dernière réservation)
    const sortedByDate = [...bookingsList].sort((a, b) =>
      new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime()
    )
    const lastActivity = sortedByDate.length > 0 ? sortedByDate[0].start_datetime : null

    // Première réservation
    const sortedByCreated = [...bookingsList].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    const firstBooking = sortedByCreated.length > 0 ? sortedByCreated[0].created_at : null

    return NextResponse.json({
      success: true,
      stats: {
        totalBookings,
        totalParticipants,
        upcomingBookings,
        pastBookings,
        lastActivity,
        firstBooking,
        gameBookings,
        eventBookings,
      }
    })

  } catch (error) {
    console.error('Error in GET /api/contacts/[id]/stats:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', messageKey: 'errors.internalError' },
      { status: 500 }
    )
  }
}
