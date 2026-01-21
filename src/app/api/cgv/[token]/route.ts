import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { calculateBookingPrice, type PriceCalculationResult } from '@/lib/price-calculator'
import type { Database } from '@/lib/supabase/types'
import type { ICountProduct, ICountEventFormula, ICountRoom } from '@/hooks/usePricingData'

type OrderRow = Database['public']['Tables']['orders']['Row']
type BranchRow = Database['public']['Tables']['branches']['Row']

// GET: Récupérer les infos de la commande pour affichage
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = createServiceRoleClient()

    // Récupérer la commande par token
    // D'abord on récupère l'order sans la jointure booking
    const { data: orderData, error } = await supabase
      .from('orders')
      .select(`
        id,
        request_reference,
        customer_first_name,
        customer_last_name,
        requested_date,
        requested_time,
        participants_count,
        event_type,
        cgv_validated_at,
        branch_id,
        contact_id,
        order_type,
        booking_id,
        game_area,
        number_of_games
      `)
      .eq('cgv_token', token)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order = orderData as any

    if (error || !order) {
      return NextResponse.json(
        { success: false, error: 'Lien invalide ou expiré' },
        { status: 404 }
      )
    }

    // Récupérer le nom de la branche
    let branchName = 'Laser City'
    if (order.branch_id) {
      const { data: branchData } = await supabase
        .from('branches')
        .select('name')
        .eq('id', order.branch_id)
        .single()
      const branch = branchData as Pick<BranchRow, 'name'> | null
      if (branch) branchName = branch.name
    }

    // Récupérer la langue préférée du contact
    let preferredLocale: 'he' | 'fr' | 'en' = 'he'
    if (order.contact_id) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('preferred_locale')
        .eq('id', order.contact_id)
        .single<{ preferred_locale: string | null }>()
      if (contactData?.preferred_locale) {
        preferredLocale = contactData.preferred_locale as 'he' | 'fr' | 'en'
      }
    }

    // Récupérer le booking si booking_id existe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let booking: any = null
    if (order.booking_id) {
      const { data: bookingData } = await supabase
        .from('bookings')
        .select(`
          id,
          room_id,
          booking_slots(
            id,
            room_id,
            start_time,
            end_time,
            participants,
            games_count,
            formula_id,
            product_id,
            unit_price,
            total_price
          )
        `)
        .eq('id', order.booking_id)
        .single()
      booking = bookingData
    }

    // Fetch pricing data: icount_products, icount_event_formulas, icount_rooms
    // (même tables que usePricingData utilisé par AccountingModal)
    const [productsResult, formulasResult, roomsResult] = await Promise.all([
      supabase.from('icount_products').select('*').eq('branch_id', order.branch_id).eq('is_active', true),
      supabase.from('icount_event_formulas').select('*').eq('branch_id', order.branch_id).eq('is_active', true),
      supabase.from('icount_rooms').select('*').eq('branch_id', order.branch_id).eq('is_active', true)
    ])

    const products = (productsResult.data || []) as ICountProduct[]
    const eventFormulas = (formulasResult.data || []) as ICountEventFormula[]
    const rooms = (roomsResult.data || []) as ICountRoom[]

    console.log('[CGV API] Products count:', products.length)
    console.log('[CGV API] EventFormulas count:', eventFormulas.length)
    console.log('[CGV API] Rooms count:', rooms.length)
    console.log('[CGV API] Order type:', order.order_type)
    console.log('[CGV API] Participants:', order.participants_count)
    console.log('[CGV API] Game area:', order.game_area)

    // Calculer le prix avec la même logique que AccountingModal
    let priceCalculation: PriceCalculationResult | null = null
    const bookingType = order.order_type as 'GAME' | 'EVENT'
    const participants = order.participants_count || 0
    const gameArea = (order.game_area || 'ACTIVE') as 'ACTIVE' | 'LASER' | 'MIX' | 'CUSTOM'

    if (participants >= 1 && products.length > 0) {
      // Determine game parameters from booking slots or order data
      let laserGames = 0
      let activeDuration = 0

      const slots = booking?.booking_slots || []
      if (slots && Array.isArray(slots) && slots.length > 0) {
        slots.forEach((slot: { area?: string; duration_minutes?: number }) => {
          if (slot?.area === 'LASER') {
            laserGames++
          } else if (slot?.area === 'ACTIVE') {
            activeDuration += slot?.duration_minutes || 30
          }
        })
      }

      // Fallback to order fields if no slot data
      if (laserGames === 0 && activeDuration === 0) {
        if (gameArea === 'LASER' || gameArea === 'CUSTOM') {
          laserGames = (order as { laser_games_count?: number }).laser_games_count ||
                       order.number_of_games || 1
        }
        if (gameArea === 'ACTIVE' || gameArea === 'CUSTOM') {
          activeDuration = (order as { active_duration?: number }).active_duration || 60
        }
      }

      // Determine event quick plan
      let eventQuickPlan = 'AA'
      if (bookingType === 'EVENT') {
        if (gameArea === 'LASER') eventQuickPlan = 'LL'
        else if (gameArea === 'ACTIVE') eventQuickPlan = 'AA'
        else eventQuickPlan = 'AL'
      }

      priceCalculation = calculateBookingPrice({
        bookingType,
        gameArea,
        participants,
        numberOfGames: laserGames || order.number_of_games || 1,
        gameDurations: activeDuration > 0 ? [String(activeDuration)] : ['60'],
        eventQuickPlan,
        eventRoomId: booking?.room_id || null,
        products,
        eventFormulas,
        rooms,
      })
    }

    // Build price breakdown for display (same format as AccountingModal)
    const priceBreakdown: Array<{
      description: string
      label?: string
      quantity: number
      unitPrice: number
      totalPrice: number
    }> = []

    // Translations for price breakdown labels based on contact's preferred locale
    const priceLabels: Record<string, Record<string, string>> = {
      he: {
        laser: 'לייזר',
        active: 'אקטיב',
        laser_active: 'לייזר + אקטיב',
        game: 'משחק',
        event: 'אירוע',
        room: 'חדר'
      },
      en: {
        laser: 'Laser',
        active: 'Active',
        laser_active: 'Laser + Active',
        game: 'Game',
        event: 'Event',
        room: 'Room'
      },
      fr: {
        laser: 'Laser',
        active: 'Active',
        laser_active: 'Laser + Active',
        game: 'Jeu',
        event: 'Événement',
        room: 'Salle'
      }
    }

    const getLabel = (key: string) => {
      return priceLabels[preferredLocale]?.[key] || priceLabels['en'][key] || key
    }

    // Determine the game type label based on gameArea
    const getGameTypeLabel = (): string => {
      if (gameArea === 'LASER') return getLabel('laser')
      if (gameArea === 'ACTIVE') return getLabel('active')
      if (gameArea === 'MIX' || gameArea === 'CUSTOM') return getLabel('laser_active')
      // Fallback based on booking type
      return bookingType === 'EVENT' ? getLabel('event') : getLabel('game')
    }

    if (priceCalculation?.valid) {
      // Main line - participants × price with actual game type
      const typeLabel = getGameTypeLabel()
      priceBreakdown.push({
        description: typeLabel,
        label: priceCalculation.details.unitLabel,
        quantity: participants,
        unitPrice: priceCalculation.details.unitPrice,
        totalPrice: participants * priceCalculation.details.unitPrice
      })

      // Room line if applicable
      if (priceCalculation.details.roomPrice && priceCalculation.details.roomPrice > 0) {
        priceBreakdown.push({
          description: getLabel('room'),
          label: priceCalculation.details.roomName,
          quantity: 1,
          unitPrice: priceCalculation.details.roomPrice,
          totalPrice: priceCalculation.details.roomPrice
        })
      }
    }

    const totalAmount = priceCalculation?.total || 0
    const subtotal = priceCalculation?.subtotal || 0
    const discountAmount = priceCalculation?.discountAmount || 0

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        request_reference: order.request_reference,
        customer_first_name: order.customer_first_name,
        customer_last_name: order.customer_last_name,
        requested_date: order.requested_date,
        requested_time: order.requested_time,
        participants_count: order.participants_count,
        event_type: order.event_type,
        cgv_validated_at: order.cgv_validated_at,
        branch_name: branchName,
        booking_type: order.order_type === 'EVENT' ? 'event' : 'game',
        preferred_locale: preferredLocale,
        // Price breakdown data (same format as AccountingModal)
        priceBreakdown,
        subtotal,
        discountAmount,
        totalAmount,
      }
    })

  } catch (error) {
    console.error('[CGV] Error fetching order:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// POST: Valider les CGV
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()

    if (!body.accepted) {
      return NextResponse.json(
        { success: false, error: 'Vous devez accepter les CGV' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()

    // Vérifier que la commande existe et n'est pas déjà validée
    const { data: orderData, error: fetchError } = await supabase
      .from('orders')
      .select('id, cgv_validated_at, request_reference, branch_id')
      .eq('cgv_token', token)
      .single()

    const order = orderData as Pick<OrderRow, 'id' | 'cgv_validated_at' | 'request_reference' | 'branch_id'> | null

    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, error: 'Lien invalide ou expiré' },
        { status: 404 }
      )
    }

    if (order.cgv_validated_at) {
      return NextResponse.json({
        success: true,
        message: 'CGV déjà validées'
      })
    }

    // Mettre à jour la commande
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('orders')
      .update({
        cgv_validated_at: new Date().toISOString(),
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString()
      })
      .eq('id', order.id)

    if (updateError) {
      console.error('[CGV] Error updating order:', updateError)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la validation' },
        { status: 500 }
      )
    }

    // Logger l'action
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('activity_logs').insert({
        user_id: null,
        user_role: 'agent',
        user_name: 'Client',
        action_type: 'order_updated',
        target_type: 'order',
        target_id: order.id,
        target_name: order.request_reference,
        branch_id: order.branch_id,
        details: {
          action: 'cgv_accepted',
          validated_at: new Date().toISOString()
        }
      })
    } catch (logError) {
      console.error('[CGV] Error logging action:', logError)
    }

    return NextResponse.json({
      success: true,
      message: 'CGV validées avec succès'
    })

  } catch (error) {
    console.error('[CGV] Error validating CGV:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
