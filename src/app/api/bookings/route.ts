/**
 * API Route pour créer une réservation depuis l'admin
 * POST: Crée un booking avec slots, sessions, order, contact et envoie l'email
 *
 * Cette API centralise TOUTE la logique de création pour garantir:
 * - Les logs d'activité (booking, contact, order)
 * - L'envoi d'email avec log
 * - La cohérence des données
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiPermission } from '@/lib/permissions'
import { validateBookingPrice } from '@/lib/booking-validation'
import { extractIsraelDate, extractIsraelTime } from '@/lib/dates'
import { logBookingAction, logContactAction, logOrderAction, getClientIpFromHeaders } from '@/lib/activity-logger'
import { sendBookingConfirmationEmail } from '@/lib/email-sender'
import { calculateBookingPrice } from '@/lib/price-calculator'
import type { ICountProduct, ICountEventFormula, ICountRoom } from '@/hooks/usePricingData'
// iCount offers removed - invoice+receipt created only at order close
import type {
  UserRole,
  Booking,
  Branch,
  BookingType,
  BookingStatus,
} from '@/lib/supabase/types'

// Client Supabase avec service role pour bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Générer un code de référence unique
function generateReferenceCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Générer un token CGV sécurisé (64 caractères hex)
function generateCgvToken(): string {
  const chars = 'abcdef0123456789'
  let token = ''
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

// Calculer la game_area basée sur les sessions (MIX si mélange ACTIVE+LASER)
function calculateGameArea(sessions?: Array<{ game_area: string }>): string | null {
  if (!sessions || sessions.length === 0) return null

  const areas = sessions.map(s => s.game_area)
  const uniqueAreas = [...new Set(areas)]

  if (uniqueAreas.length === 1) {
    return uniqueAreas[0]
  } else if (uniqueAreas.includes('ACTIVE') && uniqueAreas.includes('LASER')) {
    return 'MIX'
  }
  return sessions[0].game_area
}

interface CreateBookingBody {
  branch_id: string
  type: BookingType
  start_datetime: string
  end_datetime: string
  game_start_datetime?: string
  game_end_datetime?: string
  participants_count: number
  event_room_id?: string
  customer_first_name: string
  customer_last_name: string
  customer_phone: string
  customer_email?: string
  customer_notes_at_booking?: string
  primary_contact_id?: string
  notes?: string
  color?: string
  discount_type?: 'percent' | 'fixed' | null
  discount_value?: number | null
  reactivateReference?: string
  reactivateOrderId?: string
  slots: Array<{
    slot_start: string
    slot_end: string
    participants_count: number
  }>
  game_sessions?: Array<{
    game_area: 'ACTIVE' | 'LASER'
    start_datetime: string
    end_datetime: string
    laser_room_id?: string | null
    session_order: number
    pause_before_minutes: number
  }>
  locale?: string
}

/**
 * POST /api/bookings
 * Crée une réservation complète depuis l'admin
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier les permissions
    const { success, user, errorResponse } = await verifyApiPermission('agenda', 'create')
    if (!success || !user) {
      return errorResponse
    }

    const body: CreateBookingBody = await request.json()
    const ipAddress = getClientIpFromHeaders(request.headers)

    // Validation basique
    if (!body.branch_id || !body.type || !body.start_datetime || !body.end_datetime) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(body.branch_id)) {
      return NextResponse.json(
        { success: false, error: 'Branch access denied' },
        { status: 403 }
      )
    }

    // === VALIDATION PRIX OBLIGATOIRE ===
    // Vérifier qu'une formule/produit existe AVANT de créer le booking
    if (body.game_sessions && body.game_sessions.length > 0) {
      const priceValidation = await validateBookingPrice(
        supabase,
        body.type,
        body.branch_id,
        body.participants_count,
        body.game_sessions.map(s => ({
          game_area: s.game_area,
          start_datetime: s.start_datetime,
          end_datetime: s.end_datetime
        }))
      )

      if (!priceValidation.valid) {
        console.error('[BOOKINGS API] Price validation failed:', priceValidation.error)
        return NextResponse.json({
          success: false,
          error: priceValidation.error,
          errorKey: priceValidation.errorKey
        }, { status: 400 })
      }
      console.log('[BOOKINGS API] Price validation passed')
    }
    // === FIN VALIDATION PRIX ===

    // 1. CRÉER OU TROUVER LE CONTACT
    let contactId = body.primary_contact_id
    let contactWasCreated = false

    if (!contactId && body.customer_phone) {
      // Chercher un contact existant par téléphone
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('branch_id_main', body.branch_id)
        .eq('phone', body.customer_phone)
        .single() as { data: { id: string } | null }

      if (existingContact) {
        contactId = existingContact.id
      } else {
        // Créer un nouveau contact
        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            branch_id_main: body.branch_id,
            first_name: body.customer_first_name,
            last_name: body.customer_last_name || '',
            phone: body.customer_phone,
            email: body.customer_email || null,
            notes_client: body.customer_notes_at_booking || null,
            source: 'admin'
          })
          .select('id')
          .single() as { data: { id: string } | null; error: unknown }

        if (!contactError && newContact) {
          contactId = newContact.id
          contactWasCreated = true

          // LOG: Contact créé
          await logContactAction({
            userId: user.id,
            userRole: user.role as UserRole,
            userName: `${user.profile.first_name} ${user.profile.last_name}`.trim(),
            action: 'created',
            contactId: newContact.id,
            contactName: `${body.customer_first_name} ${body.customer_last_name || ''}`.trim(),
            branchId: body.branch_id,
            details: {
              source: 'admin',
              phone: body.customer_phone,
              email: body.customer_email
            },
            ipAddress
          })
        }
      }
    }

    // 2. CRÉER LE BOOKING
    const referenceCode = body.reactivateReference || generateReferenceCode()

    const bookingData: Record<string, unknown> = {
      branch_id: body.branch_id,
      type: body.type,
      status: 'CONFIRMED' as BookingStatus,
      start_datetime: body.start_datetime,
      end_datetime: body.end_datetime,
      game_start_datetime: body.game_start_datetime,
      game_end_datetime: body.game_end_datetime,
      participants_count: body.participants_count,
      event_room_id: body.event_room_id || null,
      customer_first_name: body.customer_first_name,
      customer_last_name: body.customer_last_name || '',
      customer_phone: body.customer_phone,
      customer_email: body.customer_email || null,
      customer_notes_at_booking: body.customer_notes_at_booking || null,
      primary_contact_id: contactId || null,
      reference_code: referenceCode,
      notes: body.notes || null,
    }

    if (body.color) {
      bookingData.color = body.color
    }

    if (body.discount_type) {
      bookingData.discount_type = body.discount_type
      bookingData.discount_value = body.discount_value || 0
    }

    const { data: newBooking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single<Booking>()

    if (bookingError || !newBooking) {
      console.error('Booking insert error:', bookingError)
      return NextResponse.json(
        { success: false, error: 'Failed to create booking', details: bookingError?.message },
        { status: 500 }
      )
    }

    // LOG: Booking créé
    await logBookingAction({
      userId: user.id,
      userRole: user.role as UserRole,
      userName: `${user.profile.first_name} ${user.profile.last_name}`.trim(),
      action: 'created',
      bookingId: newBooking.id,
      bookingRef: referenceCode,
      branchId: body.branch_id,
      details: {
        source: 'admin',
        type: body.type,
        participants: body.participants_count,
        customerName: `${body.customer_first_name} ${body.customer_last_name || ''}`.trim(),
        contactCreated: contactWasCreated
      },
      ipAddress
    })

    // 3. CRÉER LA LIAISON BOOKING_CONTACTS
    if (contactId) {
      await supabase
        .from('booking_contacts')
        .insert({
          booking_id: newBooking.id,
          contact_id: contactId,
          is_primary: true,
          role: null,
        })
    }

    // 4. CRÉER LES SLOTS
    if (body.slots && body.slots.length > 0) {
      const slotsToInsert = body.slots.map(slot => ({
        booking_id: newBooking.id,
        branch_id: body.branch_id,
        slot_start: slot.slot_start,
        slot_end: slot.slot_end,
        participants_count: slot.participants_count,
        slot_type: 'game_zone',
      }))

      const { error: slotsError } = await supabase
        .from('booking_slots')
        .insert(slotsToInsert)

      if (slotsError) {
        console.error('Slots insert error:', slotsError)
      }
    }

    // 5. CRÉER LES GAME_SESSIONS
    if (body.game_sessions && body.game_sessions.length > 0) {
      const sessionsToInsert = body.game_sessions.map(session => ({
        booking_id: newBooking.id,
        game_area: session.game_area,
        start_datetime: session.start_datetime,
        end_datetime: session.end_datetime,
        laser_room_id: session.laser_room_id || null,
        session_order: session.session_order,
        pause_before_minutes: session.pause_before_minutes,
      }))

      const { error: sessionsError } = await supabase
        .from('game_sessions')
        .insert(sessionsToInsert)

      if (sessionsError) {
        console.error('Sessions insert error:', sessionsError)
      }
    }

    // 6. CRÉER L'ORDER
    const bookingDate = new Date(body.start_datetime)
    let orderId: string | null = null
    let orderCgvToken: string | null = null

    // Récupérer les données de pricing pour calculer le total_amount
    const [productsResult, formulasResult, roomsResult] = await Promise.all([
      supabase.from('icount_products').select('*').eq('branch_id', body.branch_id).eq('is_active', true),
      supabase.from('icount_event_formulas').select('*').eq('branch_id', body.branch_id).eq('is_active', true),
      supabase.from('icount_rooms').select('*').eq('branch_id', body.branch_id).eq('is_active', true)
    ])

    const products = (productsResult.data || []) as ICountProduct[]
    const eventFormulas = (formulasResult.data || []) as ICountEventFormula[]
    const rooms = (roomsResult.data || []) as ICountRoom[]

    // Calculer le total_amount
    let totalAmount: number | null = null
    const gameArea = calculateGameArea(body.game_sessions) as 'ACTIVE' | 'LASER' | 'MIX' | 'CUSTOM' | null

    if (body.participants_count >= 1 && products.length > 0) {
      // Calculer les paramètres de jeu depuis les sessions
      let laserGames = 0
      let activeDurations: string[] = []
      let customGameAreas: ('ACTIVE' | 'LASER')[] = []
      let customGameDurations: string[] = []

      if (body.game_sessions && body.game_sessions.length > 0) {
        for (const session of body.game_sessions) {
          const startTime = new Date(session.start_datetime)
          const endTime = new Date(session.end_datetime)
          const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

          if (session.game_area === 'LASER') {
            laserGames++
          } else if (session.game_area === 'ACTIVE') {
            activeDurations.push(String(durationMinutes))
          }

          // Pour CUSTOM/MIX
          customGameAreas.push(session.game_area)
          customGameDurations.push(String(durationMinutes))
        }
      }

      // Déterminer le quick plan pour les événements
      let eventQuickPlan = 'AA'
      if (body.type === 'EVENT') {
        if (gameArea === 'LASER') eventQuickPlan = 'LL'
        else if (gameArea === 'ACTIVE') eventQuickPlan = 'AA'
        else eventQuickPlan = 'AL'
      }

      const priceCalculation = calculateBookingPrice({
        bookingType: body.type as 'GAME' | 'EVENT',
        participants: body.participants_count,
        gameArea: gameArea || 'ACTIVE',
        numberOfGames: laserGames || body.game_sessions?.length || 1,
        gameDurations: activeDurations.length > 0 ? activeDurations : ['60'],
        customGameAreas: gameArea === 'MIX' || gameArea === 'CUSTOM' ? customGameAreas : undefined,
        customGameDurations: gameArea === 'MIX' || gameArea === 'CUSTOM' ? customGameDurations : undefined,
        eventQuickPlan,
        eventRoomId: body.event_room_id || null,
        discountType: body.discount_type,
        discountValue: body.discount_value ?? undefined,
        products,
        eventFormulas,
        rooms,
      })

      if (priceCalculation.valid) {
        totalAmount = priceCalculation.total
      }
    }

    if (body.reactivateOrderId) {
      // Réactivation: mettre à jour l'order existant
      const { data: updatedOrder } = await supabase
        .from('orders')
        .update({
          booking_id: newBooking.id,
          status: 'manually_confirmed',
          requested_date: extractIsraelDate(bookingDate.toISOString()),
          requested_time: extractIsraelTime(bookingDate.toISOString()),
          participants_count: body.participants_count,
          customer_first_name: body.customer_first_name || 'Client',
          customer_last_name: body.customer_last_name || '',
          customer_phone: body.customer_phone || '0000000000',
          customer_email: body.customer_email || null,
          game_area: calculateGameArea(body.game_sessions),
          number_of_games: body.game_sessions?.length || 1,
          processed_at: new Date().toISOString(),
          total_amount: totalAmount,
        })
        .eq('id', body.reactivateOrderId)
        .select('id')
        .single()

      orderId = updatedOrder?.id || body.reactivateOrderId
    } else {
      // Nouvelle création - générer un token CGV pour que le client puisse valider
      const cgvToken = generateCgvToken()

      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          branch_id: body.branch_id,
          booking_id: newBooking.id,
          contact_id: contactId || null,
          source: 'admin_agenda',
          status: 'auto_confirmed',
          order_type: body.type,
          game_area: calculateGameArea(body.game_sessions),
          number_of_games: body.game_sessions?.length || 1,
          requested_date: extractIsraelDate(bookingDate.toISOString()),
          requested_time: extractIsraelTime(bookingDate.toISOString()),
          participants_count: body.participants_count,
          customer_first_name: body.customer_first_name || 'Client',
          customer_last_name: body.customer_last_name || '',
          customer_phone: body.customer_phone || '0000000000',
          customer_email: body.customer_email || null,
          customer_notes: body.customer_notes_at_booking || null,
          request_reference: referenceCode,
          total_amount: totalAmount,
          // CGV non acceptées - le client doit valider via le lien email
          terms_accepted: false,
          terms_accepted_at: null,
          cgv_token: cgvToken,
          cgv_validated_at: null,
        })
        .select('id, cgv_token')
        .single()

      if (!orderError && newOrder) {
        orderId = newOrder.id
        orderCgvToken = newOrder.cgv_token

        // LOG: Order créé
        await logOrderAction({
          userId: user.id,
          userRole: user.role as UserRole,
          userName: `${user.profile.first_name} ${user.profile.last_name}`.trim(),
          action: 'created',
          orderId: newOrder.id,
          orderRef: referenceCode,
          branchId: body.branch_id,
          details: {
            source: 'admin_agenda',
            status: 'auto_confirmed',
            type: body.type,
            participants: body.participants_count
          },
          ipAddress
        })
      }
    }

    // Récupérer les slots et sessions créés pour la réponse
    const { data: slots } = await supabase
      .from('booking_slots')
      .select('*')
      .eq('booking_id', newBooking.id)

    const { data: sessions } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('booking_id', newBooking.id)

    // iCount offer creation removed - invoice+receipt created at order close

    // Envoyer l'email de confirmation
    let emailSent = false
    let emailLogId: string | undefined

    if (body.customer_email) {
      // Récupérer la branche pour l'email
      const { data: branch } = await supabase
        .from('branches')
        .select('*')
        .eq('id', body.branch_id)
        .single<Branch>()

      if (branch) {
        try {
          const emailResult = await sendBookingConfirmationEmail({
            booking: newBooking,
            branch,
            triggeredBy: user.id,
            locale: body.locale || 'he',
            cgvToken: orderCgvToken // Lien de validation CGV pour les orders admin
          })

          emailSent = emailResult.success
          emailLogId = emailResult.emailLogId

          if (!emailResult.success) {
            console.error('Email send failed:', emailResult.error)
          }
        } catch (emailErr) {
          console.error('Email send exception:', emailErr)
        }
      }
    }

    return NextResponse.json({
      success: true,
      booking: {
        ...newBooking,
        slots: slots || [],
        game_sessions: sessions || [],
      },
      orderId,
      contactId,
      contactCreated: contactWasCreated,
      emailSent,
      emailLogId,
    })

  } catch (error) {
    console.error('Error in POST /api/bookings:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
