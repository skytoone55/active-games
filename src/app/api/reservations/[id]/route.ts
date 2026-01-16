/**
 * API Route pour mettre à jour une réservation
 * PATCH /api/reservations/[id]
 * Met à jour le statut d'une réservation (confirmed/cancelled)
 */

import { NextRequest, NextResponse } from 'next/server'
import { updateReservationStatus } from '@/lib/reservations'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    if (!body.status || !['confirmed', 'cancelled'].includes(body.status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status. Must be "confirmed" or "cancelled"' },
        { status: 400 }
      )
    }
    
    const reservation = await updateReservationStatus(id, body.status)
    
    if (!reservation) {
      return NextResponse.json(
        { success: false, error: 'Reservation not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true, reservation })
  } catch (error) {
    console.error('Error updating reservation:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update reservation' },
      { status: 500 }
    )
  }
}
