/**
 * API Route pour gérer les réservations
 * GET: Liste toutes les réservations
 * POST: Crée une nouvelle réservation
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAllReservations, saveReservation } from '@/lib/reservations'

/**
 * GET /api/reservations
 * Retourne toutes les réservations
 */
export async function GET(request: NextRequest) {
  try {
    const reservations = await getAllReservations()
    
    // Filtrer par status si query param
    const status = request.nextUrl.searchParams.get('status')
    let filtered = reservations
    
    if (status === 'confirmed') {
      filtered = reservations.filter(r => r.status === 'confirmed')
    } else if (status === 'cancelled') {
      filtered = reservations.filter(r => r.status === 'cancelled')
    }
    
    // Trier par date de création (plus récent en premier)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    
    return NextResponse.json({ success: true, reservations: filtered })
  } catch (error) {
    console.error('Error fetching reservations:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reservations' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/reservations
 * Crée une nouvelle réservation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validation des champs requis
    const requiredFields = ['branch', 'type', 'players', 'date', 'time', 'firstName', 'lastName', 'phone', 'reservationNumber']
    const missingFields = requiredFields.filter(field => !body[field])
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }
    
    const reservation = await saveReservation({
      branch: body.branch,
      type: body.type,
      players: body.players,
      date: body.date,
      time: body.time,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      email: body.email || null,
      specialRequest: body.specialRequest || null,
      eventType: body.eventType || null,
      eventAge: body.eventAge || null,
      reservationNumber: body.reservationNumber,
    })
    
    return NextResponse.json({ success: true, reservation }, { status: 201 })
  } catch (error) {
    console.error('Error creating reservation:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create reservation' },
      { status: 500 }
    )
  }
}
