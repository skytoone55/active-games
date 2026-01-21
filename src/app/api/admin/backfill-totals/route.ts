/**
 * API de migration one-shot pour remplir les total_amount des commandes existantes
 * À exécuter une seule fois via: POST /api/admin/backfill-totals
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { calculateBookingPrice } from '@/lib/price-calculator'
import type { ICountProduct, ICountEventFormula, ICountRoom } from '@/hooks/usePricingData'

export async function POST(request: NextRequest) {
  try {
    // Vérifier les permissions admin
    const { success, user, errorResponse } = await verifyApiPermission('orders', 'edit')
    if (!success || !user) return errorResponse

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceRoleClient() as any

    // Récupérer les commandes sans total_amount
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        branch_id,
        order_type,
        participants_count,
        game_area,
        number_of_games,
        booking_id,
        total_amount
      `)
      .is('total_amount', null)
      .order('created_at', { ascending: false })
      .limit(500)

    const orders = ordersData as Array<{
      id: string
      branch_id: string
      order_type: string
      participants_count: number | null
      game_area: string | null
      number_of_games: number | null
      booking_id: string | null
      total_amount: number | null
    }> | null

    if (ordersError) {
      return NextResponse.json({ success: false, error: ordersError.message }, { status: 500 })
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ success: true, message: 'Aucune commande à mettre à jour', updated: 0 })
    }

    // Récupérer les données de pricing par branche
    const branchIds = [...new Set(orders.map(o => o.branch_id))]
    const pricingDataByBranch: Record<string, {
      products: ICountProduct[]
      eventFormulas: ICountEventFormula[]
      rooms: ICountRoom[]
    }> = {}

    for (const branchId of branchIds) {
      const [productsResult, formulasResult, roomsResult] = await Promise.all([
        supabase.from('icount_products').select('*').eq('branch_id', branchId).eq('is_active', true),
        supabase.from('icount_event_formulas').select('*').eq('branch_id', branchId).eq('is_active', true),
        supabase.from('icount_rooms').select('*').eq('branch_id', branchId).eq('is_active', true)
      ])

      pricingDataByBranch[branchId] = {
        products: (productsResult.data || []) as ICountProduct[],
        eventFormulas: (formulasResult.data || []) as ICountEventFormula[],
        rooms: (roomsResult.data || []) as ICountRoom[]
      }
    }

    // Récupérer les bookings associés pour les sessions de jeu
    const bookingIds = orders.filter(o => o.booking_id).map(o => o.booking_id) as string[]
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select(`
        id,
        type,
        discount_type,
        discount_value,
        event_room_id,
        game_sessions (
          game_area,
          start_datetime,
          end_datetime
        )
      `)
      .in('id', bookingIds)

    type BookingWithSessions = {
      id: string
      type: string
      discount_type: string | null
      discount_value: number | null
      event_room_id: string | null
      game_sessions: Array<{
        game_area: string
        start_datetime: string
        end_datetime: string
      }>
    }

    const bookings = bookingsData as BookingWithSessions[] | null
    const bookingsMap = new Map(bookings?.map(b => [b.id, b]) || [])

    // Calculer et mettre à jour chaque commande
    let updated = 0
    let errors = 0
    const results: Array<{ orderId: string; totalAmount: number | null; error?: string }> = []

    for (const order of orders) {
      try {
        const pricingData = pricingDataByBranch[order.branch_id]
        if (!pricingData || pricingData.products.length === 0) {
          results.push({ orderId: order.id, totalAmount: null, error: 'No pricing data' })
          continue
        }

        const booking = order.booking_id ? bookingsMap.get(order.booking_id) : null
        const gameSessions = booking?.game_sessions || []

        // Calculer les paramètres de jeu depuis les sessions
        let laserGames = 0
        let activeDurations: string[] = []

        for (const session of gameSessions) {
          const startTime = new Date(session.start_datetime)
          const endTime = new Date(session.end_datetime)
          const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

          if (session.game_area === 'LASER') {
            laserGames++
          } else if (session.game_area === 'ACTIVE') {
            activeDurations.push(String(durationMinutes))
          }
        }

        // Déterminer le quick plan pour les événements
        let eventQuickPlan = 'AA'
        const gameArea = order.game_area as 'ACTIVE' | 'LASER' | 'MIX' | 'CUSTOM' | null
        if (order.order_type === 'EVENT') {
          if (gameArea === 'LASER') eventQuickPlan = 'LL'
          else if (gameArea === 'ACTIVE') eventQuickPlan = 'AA'
          else eventQuickPlan = 'AL'
        }

        const priceCalculation = calculateBookingPrice({
          bookingType: order.order_type as 'GAME' | 'EVENT',
          participants: order.participants_count || 0,
          gameArea: gameArea || 'ACTIVE',
          numberOfGames: laserGames || order.number_of_games || 1,
          gameDurations: activeDurations.length > 0 ? activeDurations : ['60'],
          eventQuickPlan,
          eventRoomId: booking?.event_room_id || null,
          discountType: booking?.discount_type as 'percent' | 'fixed' | null | undefined,
          discountValue: booking?.discount_value ?? undefined,
          products: pricingData.products,
          eventFormulas: pricingData.eventFormulas,
          rooms: pricingData.rooms,
        })

        if (priceCalculation.valid && priceCalculation.total > 0) {
          const { error: updateError } = await supabase
            .from('orders')
            .update({ total_amount: priceCalculation.total })
            .eq('id', order.id)

          if (updateError) {
            results.push({ orderId: order.id, totalAmount: null, error: updateError.message })
            errors++
          } else {
            results.push({ orderId: order.id, totalAmount: priceCalculation.total })
            updated++
          }
        } else {
          results.push({ orderId: order.id, totalAmount: null, error: 'Invalid price calculation' })
        }
      } catch (err) {
        results.push({ orderId: order.id, totalAmount: null, error: String(err) })
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Mise à jour terminée: ${updated} commandes mises à jour, ${errors} erreurs`,
      total: orders.length,
      updated,
      errors,
      results: results.slice(0, 20) // Limiter les détails retournés
    })

  } catch (error) {
    console.error('[Backfill] Error:', error)
    return NextResponse.json({ success: false, error: 'Erreur interne' }, { status: 500 })
  }
}
