/**
 * API publique pour calculer le montant de l'acompte
 *
 * RÈGLES D'ACOMPTE:
 * - GAME: Prix d'1 joueur sur 6 (arrondi supérieur)
 * - EVENT: Prix de la salle uniquement
 *
 * IMPORTANT: Utilise la même logique de calcul que le reste de l'app
 * (price-calculator.ts) pour avoir une seule source de vérité
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculateBookingPrice } from '@/lib/price-calculator'
import type { ICountProduct, ICountEventFormula, ICountRoom } from '@/hooks/usePricingData'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CalculateDepositRequest {
  branch_id: string
  order_type: 'GAME' | 'EVENT'
  participants_count: number
  // GAME params
  game_area?: 'ACTIVE' | 'LASER' | 'MIX' | 'CUSTOM' | null
  number_of_games?: number
  game_durations?: string[]
  custom_game_areas?: ('ACTIVE' | 'LASER')[]
  custom_game_durations?: string[]
  // EVENT params
  event_type?: string | null // event_active, event_laser, event_mix
  event_quick_plan?: string  // AA, LL, AL, LA, etc.
  event_room_id?: string | null
  // Locale for display
  locale?: 'he' | 'en' | 'fr'
}

/**
 * Convert event_type to quick_plan for price calculation
 */
function eventTypeToQuickPlan(eventType: string | null | undefined): string {
  if (!eventType) return 'AA' // Default to ACTIVE

  if (eventType === 'event_laser') return 'LL'
  if (eventType === 'event_mix') return 'AL'
  return 'AA' // event_active or default
}

/**
 * POST /api/public/calculate-deposit
 * Calculer le montant de l'acompte pour une réservation
 */
export async function POST(request: NextRequest) {
  try {
    const body: CalculateDepositRequest = await request.json()

    const {
      branch_id,
      order_type,
      participants_count,
      game_area,
      number_of_games = 2,
      game_durations = [],
      custom_game_areas = [],
      custom_game_durations = [],
      event_type,
      event_quick_plan,
      event_room_id,
      locale = 'en'
    } = body

    console.log('[CALC-DEPOSIT] Request:', {
      branch_id,
      order_type,
      participants_count,
      game_area,
      number_of_games,
      event_type,
      event_quick_plan
    })

    // Validation de base
    if (!branch_id || !order_type || !participants_count) {
      console.log('[CALC-DEPOSIT] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Load pricing data (same as usePricingData hook)
    const [productsRes, formulasRes, roomsRes] = await Promise.all([
      supabase
        .from('icount_products')
        .select('id, code, name, name_he, unit_price')
        .eq('branch_id', branch_id)
        .eq('is_active', true),
      supabase
        .from('icount_event_formulas')
        .select('id, name, game_type, min_participants, max_participants, price_per_person, room_id, product_id')
        .eq('branch_id', branch_id)
        .eq('is_active', true),
      supabase
        .from('icount_rooms')
        .select('id, name, name_he, price')
        .eq('branch_id', branch_id)
        .eq('is_active', true)
    ])

    if (productsRes.error || formulasRes.error || roomsRes.error) {
      console.error('[CALC-DEPOSIT] Error loading pricing data:', {
        products: productsRes.error,
        formulas: formulasRes.error,
        rooms: roomsRes.error
      })
      return NextResponse.json(
        { success: false, error: 'Failed to load pricing data' },
        { status: 500 }
      )
    }

    const products = (productsRes.data || []) as ICountProduct[]
    const eventFormulas = (formulasRes.data || []) as ICountEventFormula[]
    const rooms = (roomsRes.data || []) as ICountRoom[]

    console.log('[CALC-DEPOSIT] Loaded pricing data:', {
      productsCount: products.length,
      formulasCount: eventFormulas.length,
      roomsCount: rooms.length
    })

    // Build game durations for ACTIVE
    let gameDurations = game_durations
    if (gameDurations.length === 0 && game_area === 'ACTIVE') {
      // Default: Active Games = 60 minutes (1 hour)
      gameDurations = Array(number_of_games).fill('60')
    }

    // Handle MIX (Sur Mesure) - convert to CUSTOM with 1 Laser + 30min Active
    let effectiveGameArea: 'ACTIVE' | 'LASER' | 'MIX' | 'CUSTOM' | null | undefined = game_area
    let effectiveCustomGameAreas = custom_game_areas
    let effectiveCustomGameDurations = custom_game_durations

    if (game_area === 'MIX') {
      // MIX = 1 partie Laser + 30min Active (default sur mesure)
      effectiveGameArea = 'CUSTOM'
      effectiveCustomGameAreas = ['LASER', 'ACTIVE']
      effectiveCustomGameDurations = ['0', '30'] // Laser doesn't use duration, Active uses 30min
      console.log('[CALC-DEPOSIT] MIX converted to CUSTOM:', {
        areas: effectiveCustomGameAreas,
        durations: effectiveCustomGameDurations
      })
    }

    // Calculate price using the same function as the rest of the app
    const priceResult = calculateBookingPrice({
      bookingType: order_type,
      participants: participants_count,
      gameArea: effectiveGameArea,
      numberOfGames: number_of_games,
      gameDurations,
      customGameAreas: effectiveCustomGameAreas.length > 0 ? effectiveCustomGameAreas : undefined,
      customGameDurations: effectiveCustomGameDurations.length > 0 ? effectiveCustomGameDurations : undefined,
      eventQuickPlan: event_quick_plan || eventTypeToQuickPlan(event_type),
      eventRoomId: event_room_id,
      products,
      eventFormulas,
      rooms,
      locale: locale as 'he' | 'en' | 'fr'
    })

    console.log('[CALC-DEPOSIT] Price calculation result:', priceResult)

    if (!priceResult.valid) {
      return NextResponse.json(
        { success: false, error: priceResult.breakdown || 'Price calculation failed' },
        { status: 400 }
      )
    }

    // Calculate deposit amount based on rules
    let depositAmount = 0
    let explanation = ''

    if (order_type === 'GAME') {
      // GAME: deposit = price of 1 player per 6 participants (minimum 1)
      const depositPlayers = Math.max(1, Math.ceil(participants_count / 6))
      depositAmount = priceResult.details.unitPrice * depositPlayers
      explanation = `Deposit: ${depositPlayers} player(s) out of ${participants_count}`
    } else if (order_type === 'EVENT') {
      // EVENT: deposit = room price only
      depositAmount = priceResult.details.roomPrice || 0
      if (depositAmount > 0) {
        explanation = `Deposit: Room rental (${priceResult.details.roomName})`
      } else {
        explanation = 'No deposit required'
      }
    }

    // Round up deposit
    depositAmount = Math.ceil(depositAmount)

    return NextResponse.json({
      success: true,
      deposit: {
        amount: depositAmount,
        total: priceResult.total,
        unitPrice: priceResult.details.unitPrice,
        roomPrice: priceResult.details.roomPrice || 0,
        roomName: priceResult.details.roomName || null,
        breakdown: priceResult.breakdown,
        explanation
      }
    })

  } catch (error) {
    console.error('[CALC-DEPOSIT] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
