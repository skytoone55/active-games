/**
 * Clara Tools - Function Calling pour Gemini
 * Définition de tous les outils disponibles pour Clara
 */

import { tool } from 'ai'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

// Client Supabase avec service role pour les opérations backend
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================
// TOOLS PUBLICS (Widget chat visiteurs)
// ============================================

/**
 * Obtenir les infos d'une branche (horaires, adresse, etc.)
 */
export const getBranchInfo = tool({
  description: 'Get information about a branch (address, opening hours, phone). Use this to get branch IDs before checking availability.',
  inputSchema: z.object({
    branchSlug: z.string().optional().describe('Branch slug (e.g., "rishon-lezion", "petah-tikva"). If not provided, returns all branches.'),
  }),
  execute: async ({ branchSlug }) => {
    console.log('[Tool:getBranchInfo] Called with:', { branchSlug })
    let query = supabase
      .from('branches')
      .select(`
        id,
        slug,
        name,
        name_en,
        address,
        phone,
        is_active,
        branch_settings (
          opening_hours,
          laser_enabled
        )
      `)
      .eq('is_active', true)

    if (branchSlug) {
      // Recherche partielle pour supporter "rishon", "rishon lezion", "petah", etc.
      const searchTerm = branchSlug.toLowerCase().replace(/\s+/g, '-')
      query = query.ilike('slug', `%${searchTerm}%`)
    }

    const { data, error } = await query

    if (error) {
      console.log('[Tool:getBranchInfo] Error:', error.message)
      return { error: error.message }
    }

    console.log('[Tool:getBranchInfo] Result:', JSON.stringify(data, null, 2))
    return { branches: data }
  },
})

/**
 * Obtenir les prix des activités
 */
export const getPricing = tool({
  description: 'Get pricing information for games and events',
  inputSchema: z.object({
    branchId: z.string().optional().describe('Branch ID to get specific pricing'),
    category: z.enum(['game', 'event', 'all']).default('all').describe('Category of pricing'),
  }),
  execute: async ({ branchId, category }) => {
    // Récupérer les produits
    let productsQuery = supabase
      .from('icount_products')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    if (branchId) {
      productsQuery = productsQuery.eq('branch_id', branchId)
    }

    if (category !== 'all') {
      productsQuery = productsQuery.eq('category', category === 'game' ? 'game' : 'event_tariff')
    }

    const { data: products, error: productsError } = await productsQuery

    if (productsError) {
      return { error: productsError.message }
    }

    // Récupérer les formules événements
    const { data: formulas, error: formulasError } = await supabase
      .from('icount_formulas')
      .select('*')
      .eq('is_active', true)
      .order('priority')

    if (formulasError) {
      return { error: formulasError.message }
    }

    return { products, formulas }
  },
})

/**
 * Simuler une réservation pour vérifier la VRAIE disponibilité
 * Utilise la même logique que /api/orders mais sans créer de données
 */
export const simulateBooking = tool({
  description: `Simulate a booking to check REAL availability. This tool uses the same logic as the actual booking system.

IMPORTANT: You must collect ALL required information BEFORE calling this tool:
- Branch (branchId)
- Type (GAME or EVENT)
- Game area (ACTIVE, LASER, or MIX) for GAME type
- Number of games (1-4) for GAME type
- Number of participants
- Date (YYYY-MM-DD)
- Time (HH:MM)

This tool will tell you if the slot is really available or not, and suggest alternatives if not.`,
  inputSchema: z.object({
    branchId: z.string().describe('Branch ID (UUID). REQUIRED!'),
    date: z.string().describe('Date in YYYY-MM-DD format'),
    time: z.string().describe('Time in HH:MM format'),
    participants: z.number().min(1).describe('Number of participants'),
    type: z.enum(['GAME', 'EVENT']).describe('Booking type'),
    gameArea: z.enum(['ACTIVE', 'LASER', 'MIX']).optional().describe('Game area (required for GAME type)'),
    numberOfGames: z.number().min(1).max(4).optional().describe('Number of games (required for GAME type, usually 1-3)'),
    eventType: z.enum(['event_active', 'event_laser', 'event_mix']).optional().describe('Event type (required for EVENT type)'),
  }),
  execute: async ({ branchId, date, time, participants, type, gameArea, numberOfGames, eventType }) => {
    console.log('[Tool:simulateBooking] Called with:', { branchId, date, time, participants, type, gameArea, numberOfGames, eventType })

    // Valider le branchId
    if (!branchId || branchId.length < 10) {
      return {
        available: false,
        error: 'Branch not specified. Please ask the customer which branch they prefer.',
        missingInfo: ['branch']
      }
    }

    // VALIDATION CRITIQUE : EVENT nécessite minimum 15 personnes
    if (type === 'EVENT' && participants < 15) {
      return {
        available: false,
        error: `IMPOSSIBLE de créer un EVENT pour ${participants} personnes. Minimum 15 personnes requis. Pour un anniversaire de moins de 15 personnes, propose un GAME (jeu simple) avec les mêmes activités. Ne propose JAMAIS un EVENT à moins de 15 personnes.`,
        missingInfo: []
      }
    }

    // Valider les infos selon le type
    if (type === 'GAME') {
      if (!gameArea) {
        return {
          available: false,
          error: 'Game area not specified. Please ask if customer wants Active Games, Laser Tag, or both (MIX).',
          missingInfo: ['gameArea']
        }
      }
      if (!numberOfGames) {
        return {
          available: false,
          error: 'Number of games not specified. Please ask how many games they want to play (usually 1-3).',
          missingInfo: ['numberOfGames']
        }
      }
    }

    if (type === 'EVENT' && !eventType) {
      return {
        available: false,
        error: 'Event type not specified. Please ask if it\'s an Active event, Laser event, or Mix event.',
        missingInfo: ['eventType']
      }
    }

    // Récupérer les settings de la branche
    const { data: settings, error: settingsError } = await supabase
      .from('branch_settings')
      .select('*')
      .eq('branch_id', branchId)
      .single()

    if (settingsError || !settings) {
      return { available: false, error: 'Branch not found' }
    }

    // Vérifier les horaires d'ouverture
    const openingHours = settings.opening_hours as Record<string, { open: string; close: string }> | null
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const dayHours = openingHours?.[dayOfWeek]

    if (!dayHours) {
      return {
        available: false,
        reason: 'closed',
        message: 'The branch is closed on this day.',
        suggestedDates: getNextOpenDays(date, openingHours, 3)
      }
    }

    // Vérifier que l'heure est dans les horaires
    const requestedTime = time
    if (requestedTime < dayHours.open || requestedTime >= dayHours.close) {
      return {
        available: false,
        reason: 'outside_hours',
        message: `The branch is open from ${dayHours.open} to ${dayHours.close} on this day.`,
        openingTime: dayHours.open,
        closingTime: dayHours.close
      }
    }

    const gameDuration = settings.game_duration_minutes || 30
    const pauseDuration = 30

    // Construire la date/heure
    const startDateTime = new Date(`${date}T${time}:00`)

    // ========== SIMULATION GAME ==========
    if (type === 'GAME') {
      const numGames = numberOfGames || 1
      let totalDuration: number

      if (gameArea === 'LASER' && numGames > 1) {
        // Laser avec plusieurs parties: pause de 30 min entre chaque partie
        totalDuration = (numGames * gameDuration) + ((numGames - 1) * pauseDuration)
      } else if (gameArea === 'MIX') {
        // MIX = 1 partie laser (30 min) + 30 min Active Games = 60 min total
        totalDuration = 60
      } else if (gameArea === 'ACTIVE') {
        // Active Games = 1h par défaut
        totalDuration = 60
      } else {
        // Laser simple
        totalDuration = numGames * gameDuration
      }

      const endDateTime = new Date(startDateTime.getTime() + (totalDuration * 60000))

      // Vérifier capacité ACTIVE
      if (gameArea === 'ACTIVE' || gameArea === 'MIX') {
        const maxPlayers = settings.max_concurrent_players || 84

        const { data: existingBookings } = await supabase
          .from('bookings')
          .select(`
            id,
            participants_count,
            game_sessions (
              id,
              game_area,
              start_datetime,
              end_datetime
            )
          `)
          .eq('branch_id', branchId)
          .neq('status', 'CANCELLED')

        // Vérifier chaque tranche de 15 min
        const SLOT_DURATION = 15
        let checkTime = new Date(startDateTime)
        let maxOccupancy = 0

        while (checkTime < endDateTime) {
          const slotStart = new Date(checkTime)
          const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION * 60000)
          let existingParticipants = 0

          for (const booking of (existingBookings || [])) {
            if (!booking.game_sessions || booking.game_sessions.length === 0) continue

            const hasOverlap = booking.game_sessions.some((session: { game_area: string; start_datetime: string; end_datetime: string }) => {
              if (session.game_area !== 'ACTIVE') return false
              const sessionStart = new Date(session.start_datetime)
              const sessionEnd = new Date(session.end_datetime)
              return sessionStart < slotEnd && sessionEnd > slotStart
            })

            if (hasOverlap) {
              existingParticipants += booking.participants_count
            }
          }

          const totalParticipants = existingParticipants + participants
          maxOccupancy = Math.max(maxOccupancy, existingParticipants)

          if (totalParticipants > maxPlayers) {
            // Trouver des alternatives
            const alternatives = await findAlternativeSlots(branchId, date, participants, 'ACTIVE', settings)
            return {
              available: false,
              reason: 'capacity_exceeded',
              message: `Not enough capacity at ${time}. Currently ${existingParticipants} players booked, max is ${maxPlayers}.`,
              currentOccupancy: existingParticipants,
              maxCapacity: maxPlayers,
              requestedParticipants: participants,
              alternativeSlots: alternatives
            }
          }

          checkTime = slotEnd
        }
      }

      // Vérifier disponibilité LASER
      if (gameArea === 'LASER' || gameArea === 'MIX') {
        const { findBestLaserRoomsForBooking } = await import('@/lib/laser-allocation')

        const { data: laserRooms } = await supabase
          .from('laser_rooms')
          .select('*')
          .eq('branch_id', branchId)
          .eq('is_active', true)
          .order('sort_order')

        const { data: allBookings } = await supabase
          .from('bookings')
          .select(`
            id,
            branch_id,
            participants_count,
            status,
            game_sessions (
              id,
              game_area,
              laser_room_id,
              start_datetime,
              end_datetime
            )
          `)
          .eq('branch_id', branchId)
          .neq('status', 'CANCELLED')

        // Tester chaque session laser
        let currentStart = new Date(startDateTime)
        for (let i = 0; i < numGames; i++) {
          if (gameArea === 'LASER' || (gameArea === 'MIX' && i % 2 === 1)) {
            const sessionStart = new Date(currentStart)
            const sessionEnd = new Date(sessionStart.getTime() + gameDuration * 60000)

            const allocation = await findBestLaserRoomsForBooking({
              participants,
              startDateTime: sessionStart,
              endDateTime: sessionEnd,
              branchId,
              laserRooms: laserRooms || [],
              settings: {
                laser_exclusive_threshold: settings.laser_exclusive_threshold || 10,
                laser_total_vests: settings.laser_total_vests || 30,
                laser_spare_vests: settings.laser_spare_vests || 0
              },
              allBookings: allBookings || [],
              allocationMode: 'auto'
            })

            if (!allocation || allocation.roomIds.length === 0) {
              const alternatives = await findAlternativeSlots(branchId, date, participants, 'LASER', settings)
              return {
                available: false,
                reason: 'laser_room_unavailable',
                message: `No laser room available at ${time} for ${participants} players.`,
                alternativeSlots: alternatives
              }
            }
          }

          // Avancer au prochain jeu
          currentStart = new Date(currentStart.getTime() + (gameDuration + pauseDuration) * 60000)
        }
      }

      // Tout est OK !
      return {
        available: true,
        type: 'GAME',
        details: {
          branch: branchId,
          date,
          time,
          participants,
          gameArea,
          numberOfGames: numGames,
          duration: totalDuration,
          endTime: endDateTime.toTimeString().slice(0, 5)
        },
        message: `Slot available! ${participants} players can play ${numGames} ${gameArea} game(s) from ${time} to ${endDateTime.toTimeString().slice(0, 5)}.`
      }
    }

    // ========== SIMULATION EVENT ==========
    if (type === 'EVENT') {
      const roomDuration = 120 // 2h
      const eventSetupPause = 15

      const roomStartDateTime = new Date(startDateTime)
      const roomEndDateTime = new Date(roomStartDateTime.getTime() + roomDuration * 60000)

      // Vérifier disponibilité salle événement
      const { data: eventRooms } = await supabase
        .from('event_rooms')
        .select('*')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .order('sort_order')

      if (!eventRooms || eventRooms.length === 0) {
        return {
          available: false,
          reason: 'no_event_rooms',
          message: 'No event rooms configured for this branch.'
        }
      }

      // Vérifier capacité des salles
      const suitableRooms = eventRooms.filter(room => room.capacity >= participants)
      if (suitableRooms.length === 0) {
        return {
          available: false,
          reason: 'capacity_exceeded',
          message: `No event room can accommodate ${participants} people. Maximum capacity is ${Math.max(...eventRooms.map(r => r.capacity))}.`,
          maxCapacity: Math.max(...eventRooms.map(r => r.capacity))
        }
      }

      // Vérifier disponibilité temporelle
      const { data: existingEventBookings } = await supabase
        .from('bookings')
        .select('id, event_room_id, start_datetime, end_datetime')
        .eq('branch_id', branchId)
        .eq('type', 'EVENT')
        .neq('status', 'CANCELLED')

      let availableRoom = null
      for (const room of suitableRooms) {
        let isAvailable = true

        for (const booking of (existingEventBookings || [])) {
          if (booking.event_room_id === room.id) {
            const bookingStart = new Date(booking.start_datetime)
            const bookingEnd = new Date(booking.end_datetime)

            if (
              (roomStartDateTime >= bookingStart && roomStartDateTime < bookingEnd) ||
              (roomEndDateTime > bookingStart && roomEndDateTime <= bookingEnd) ||
              (roomStartDateTime <= bookingStart && roomEndDateTime >= bookingEnd)
            ) {
              isAvailable = false
              break
            }
          }
        }

        if (isAvailable) {
          availableRoom = room
          break
        }
      }

      if (!availableRoom) {
        return {
          available: false,
          reason: 'room_unavailable',
          message: `No event room available at ${time} for ${participants} people.`,
          suggestedTimes: ['10:00', '13:00', '16:00', '19:00'].filter(t => t !== time)
        }
      }

      // Vérifier laser si nécessaire
      if (eventType === 'event_laser' || eventType === 'event_mix') {
        const { findBestLaserRoomsForBooking } = await import('@/lib/laser-allocation')

        const { data: laserRooms } = await supabase
          .from('laser_rooms')
          .select('*')
          .eq('branch_id', branchId)
          .eq('is_active', true)

        const { data: allBookings } = await supabase
          .from('bookings')
          .select(`
            id, branch_id, participants_count, status,
            game_sessions (id, game_area, laser_room_id, start_datetime, end_datetime)
          `)
          .eq('branch_id', branchId)
          .neq('status', 'CANCELLED')

        const gameStartDateTime = new Date(roomStartDateTime.getTime() + eventSetupPause * 60000)

        const allocation = await findBestLaserRoomsForBooking({
          participants,
          startDateTime: gameStartDateTime,
          endDateTime: new Date(gameStartDateTime.getTime() + gameDuration * 60000),
          branchId,
          laserRooms: laserRooms || [],
          settings: {
            laser_exclusive_threshold: settings.laser_exclusive_threshold || 10,
            laser_total_vests: settings.laser_total_vests || 30,
            laser_spare_vests: settings.laser_spare_vests || 0
          },
          allBookings: allBookings || [],
          allocationMode: 'auto'
        })

        if (!allocation || allocation.roomIds.length === 0) {
          return {
            available: false,
            reason: 'laser_unavailable_for_event',
            message: `Event room available but no laser capacity at ${time} for ${participants} players.`,
            roomAvailable: availableRoom.name
          }
        }
      }

      return {
        available: true,
        type: 'EVENT',
        details: {
          branch: branchId,
          date,
          time,
          participants,
          eventType,
          roomName: availableRoom.name,
          duration: roomDuration,
          endTime: roomEndDateTime.toTimeString().slice(0, 5)
        },
        message: `Event slot available! Room "${availableRoom.name}" is free for ${participants} people from ${time} to ${roomEndDateTime.toTimeString().slice(0, 5)}.`
      }
    }

    return { available: false, error: 'Invalid booking type' }
  },
})

// Helper: trouver les prochains jours ouverts
function getNextOpenDays(fromDate: string, openingHours: Record<string, { open: string; close: string }> | null, count: number): string[] {
  if (!openingHours) return []

  const result: string[] = []
  const current = new Date(fromDate)

  for (let i = 0; i < 14 && result.length < count; i++) {
    current.setDate(current.getDate() + 1)
    const dayName = current.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    if (openingHours[dayName]) {
      result.push(current.toISOString().split('T')[0])
    }
  }

  return result
}

// Helper: trouver des créneaux alternatifs
async function findAlternativeSlots(
  branchId: string,
  date: string,
  participants: number,
  gameArea: 'ACTIVE' | 'LASER',
  settings: Record<string, unknown>
): Promise<string[]> {
  const alternatives: string[] = []
  const testTimes = ['10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']

  // Pour simplifier, retourner quelques suggestions
  // Une vraie implémentation testerait chaque créneau
  const openingHours = settings.opening_hours as Record<string, { open: string; close: string }> | null
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const dayHours = openingHours?.[dayOfWeek]

  if (dayHours) {
    for (const t of testTimes) {
      if (t >= dayHours.open && t < dayHours.close && alternatives.length < 3) {
        alternatives.push(t)
      }
    }
  }

  return alternatives
}

/**
 * Ancien checkAvailability - gardé pour compatibilité mais redirige vers simulateBooking
 * @deprecated Use simulateBooking instead
 */
export const checkAvailability = tool({
  description: 'DEPRECATED - Use simulateBooking instead for real availability checking.',
  inputSchema: z.object({
    branchId: z.string().describe('Branch ID'),
    date: z.string().describe('Date in YYYY-MM-DD format'),
    time: z.string().optional().describe('Time in HH:MM format'),
    participants: z.number().min(1).default(1).describe('Number of participants'),
    type: z.enum(['GAME', 'EVENT']).default('GAME').describe('Booking type'),
  }),
  execute: async ({ branchId, date, time, participants, type }) => {
    console.log('[Tool:checkAvailability] DEPRECATED - redirecting to basic check')

    // Récupérer les settings de la branche
    const { data: settings } = await supabase
      .from('branch_settings')
      .select('opening_hours')
      .eq('branch_id', branchId)
      .single()

    const openingHours = settings?.opening_hours as Record<string, { open: string; close: string }> | null
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const dayHours = openingHours?.[dayOfWeek]

    if (!dayHours) {
      return { available: false, reason: 'Branch is closed on this day' }
    }

    return {
      available: true,
      date,
      openingTime: dayHours.open,
      closingTime: dayHours.close,
      note: 'This is a basic check. Use simulateBooking for real availability verification.'
    }
  },
})

/**
 * Obtenir les salles d'événements disponibles
 */
export const getEventRooms = tool({
  description: 'Get available event rooms for a branch',
  inputSchema: z.object({
    branchId: z.string().describe('Branch ID'),
  }),
  execute: async ({ branchId }) => {
    const { data, error } = await supabase
      .from('event_rooms')
      .select('id, slug, name, name_en, capacity')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('sort_order')

    if (error) {
      return { error: error.message }
    }

    return { rooms: data }
  },
})

/**
 * Générer un lien de réservation pré-rempli
 * Clara collecte les infos et génère un lien pour que le client finalise sur le site
 */
export const generateBookingLink = tool({
  description: `Generate a pre-filled booking link for the customer. Use this when you have collected all the necessary information (branch, type, players, games, date, time, contact info). The customer will click this link to go directly to the payment step on the website.`,
  inputSchema: z.object({
    branchSlug: z.string().describe('Branch slug: "rishon-lezion" or "petah-tikva"'),
    type: z.enum(['game', 'event']).describe('Booking type'),
    players: z.number().min(1).describe('Number of players/participants'),
    gameArea: z.enum(['ACTIVE', 'LASER', 'MIX']).optional().describe('Game area (required for game type)'),
    numberOfGames: z.number().min(1).max(6).optional().describe(`Number of games (tranches de 30min pour ACTIVE):
      - For LASER: number of parties (1, 2, or 3)
      - For ACTIVE: numberOfGames in 30min blocks (2=1h/100₪, 3=1h30/140₪, 4=2h/180₪)
      - For MIX: always 1 (fixed 30min Active + 1 Laser = 120₪)
      IMPORTANT: Active Games uses 30min blocks. 2 games = 1h, 3 games = 1h30, 4 games = 2h.`),
    date: z.string().describe('Date in YYYY-MM-DD format'),
    time: z.string().describe('Time in HH:MM format'),
    firstName: z.string().optional().describe('Customer first name'),
    lastName: z.string().optional().describe('Customer last name'),
    phone: z.string().optional().describe('Customer phone number'),
    email: z.string().optional().describe('Customer email (ALWAYS ask for it)'),
    eventType: z.string().optional().describe('Event type (for event bookings): birthday, bar_mitzvah, corporate, party, other'),
  }),
  execute: async ({ branchSlug, type, players, gameArea, numberOfGames, date, time, firstName, lastName, phone, email, eventType }) => {
    console.log('[Tool:generateBookingLink] Generating link with:', { branchSlug, type, players, gameArea, numberOfGames, date, time })

    // VALIDATION CRITIQUE : EVENT nécessite minimum 15 personnes
    if (type === 'event' && players < 15) {
      return {
        success: false,
        error: `ERREUR : Impossible de créer un lien EVENT pour ${players} personnes. Minimum 15 personnes requis pour un EVENT. Pour moins de 15 personnes, utilise type="game" même si c'est un anniversaire.`,
        bookingUrl: null,
        summary: null
      }
    }

    // Construire l'URL avec les paramètres
    const params = new URLSearchParams()
    params.set('branch', branchSlug)
    params.set('type', type)
    params.set('players', String(players))

    if (type === 'game') {
      if (gameArea) params.set('gameArea', gameArea)
      if (numberOfGames) params.set('games', String(numberOfGames))
    } else if (type === 'event' && eventType) {
      params.set('eventType', eventType)
    }

    params.set('date', date)
    params.set('time', time)

    if (firstName) params.set('firstName', firstName)
    if (lastName) params.set('lastName', lastName)
    if (phone) params.set('phone', phone)
    if (email) params.set('email', email)

    // URL de base (sera relative, le frontend ajoutera le domaine)
    const bookingUrl = `/reservation?${params.toString()}`

    // Résumé pour Clara
    const branchNames: Record<string, string> = {
      'rishon-lezion': 'Rishon LeZion',
      'petah-tikva': 'Petah Tikva',
    }

    // Créer une commande ABORTED pour tracker l'intérêt
    // Elle sera mise à jour en PENDING si le client paie
    try {
      // Récupérer le branch_id
      const { data: branch } = await supabase
        .from('branches')
        .select('id')
        .eq('slug', branchSlug)
        .single()

      if (branch) {
        await supabase
          .from('orders')
          .insert({
            branch_id: branch.id,
            order_type: type.toUpperCase(),
            participants_count: players,
            game_area: gameArea || null,
            number_of_games: numberOfGames || null,
            event_type: eventType || null,
            requested_date: date,
            requested_time: time,
            customer_first_name: firstName || null,
            customer_last_name: lastName || null,
            customer_phone: phone || null,
            customer_email: email || null,
            status: 'aborted',
            source: 'clara_chatbot',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        console.log('[Clara] Aborted order created for tracking')
      }
    } catch (error) {
      console.error('[Clara] Error creating aborted order:', error)
      // Ne pas bloquer la génération du lien si ça échoue
    }

    return {
      success: true,
      bookingUrl,
      summary: {
        branch: branchNames[branchSlug] || branchSlug,
        type,
        players,
        gameArea: gameArea || null,
        numberOfGames: numberOfGames || null,
        date,
        time,
        hasContactInfo: !!(firstName && phone),
      },
      message: `Booking link generated successfully. Customer should click the link to proceed to payment.`,
    }
  },
})

// ============================================
// TOOLS CRM (Utilisateurs authentifiés)
// ============================================

/**
 * Rechercher des commandes
 */
export const searchOrders = tool({
  description: 'Search orders by various criteria',
  inputSchema: z.object({
    branchId: z.string().optional().describe('Filter by branch'),
    status: z.enum(['pending', 'auto_confirmed', 'manually_confirmed', 'cancelled', 'closed']).optional(),
    customerPhone: z.string().optional().describe('Customer phone number'),
    customerName: z.string().optional().describe('Customer name (partial match)'),
    dateFrom: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    dateTo: z.string().optional().describe('End date (YYYY-MM-DD)'),
    limit: z.number().default(10).describe('Max results'),
  }),
  execute: async ({ branchId, status, customerPhone, customerName, dateFrom, dateTo, limit }) => {
    let query = supabase
      .from('orders')
      .select(`
        id,
        request_reference,
        status,
        order_type,
        customer_first_name,
        customer_last_name,
        customer_phone,
        requested_date,
        requested_time,
        participants_count,
        total_amount,
        paid_amount,
        payment_status,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (branchId) query = query.eq('branch_id', branchId)
    if (status) query = query.eq('status', status)
    if (customerPhone) query = query.ilike('customer_phone', `%${customerPhone}%`)
    if (customerName) {
      query = query.or(`customer_first_name.ilike.%${customerName}%,customer_last_name.ilike.%${customerName}%`)
    }
    if (dateFrom) query = query.gte('requested_date', dateFrom)
    if (dateTo) query = query.lte('requested_date', dateTo)

    const { data, error } = await query

    if (error) {
      return { error: error.message }
    }

    return { orders: data, count: data?.length || 0 }
  },
})

/**
 * Rechercher des contacts/clients
 */
export const searchContacts = tool({
  description: 'Search contacts/clients in the database',
  inputSchema: z.object({
    query: z.string().describe('Search query (name, phone, email)'),
    branchId: z.string().optional().describe('Filter by branch'),
    limit: z.number().default(10).describe('Max results'),
  }),
  execute: async ({ query: searchQuery, branchId, limit }) => {
    let query = supabase
      .from('contacts')
      .select(`
        id,
        first_name,
        last_name,
        phone,
        email,
        client_type,
        company_name,
        status,
        created_at
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (branchId) query = query.eq('branch_id_main', branchId)

    // Recherche multi-champs
    query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)

    const { data, error } = await query

    if (error) {
      return { error: error.message }
    }

    return { contacts: data, count: data?.length || 0 }
  },
})

/**
 * Obtenir les statistiques du jour/semaine/mois
 */
export const getStats = tool({
  description: 'Get business statistics for a period',
  inputSchema: z.object({
    branchId: z.string().optional().describe('Filter by branch'),
    period: z.enum(['today', 'week', 'month']).default('today').describe('Time period'),
  }),
  execute: async ({ branchId, period }) => {
    // Calculer les dates
    const now = new Date()
    let startDate: string

    switch (period) {
      case 'today':
        startDate = now.toISOString().split('T')[0]
        break
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        startDate = weekAgo.toISOString().split('T')[0]
        break
      case 'month':
        startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        break
    }

    // Requête pour les commandes
    let ordersQuery = supabase
      .from('orders')
      .select('status, total_amount, paid_amount, order_type')
      .gte('created_at', startDate)
      .not('status', 'eq', 'cancelled')

    if (branchId) ordersQuery = ordersQuery.eq('branch_id', branchId)

    const { data: orders } = await ordersQuery

    // Calculer les stats
    const stats = {
      period,
      totalOrders: orders?.length || 0,
      pendingOrders: orders?.filter(o => o.status === 'pending').length || 0,
      confirmedOrders: orders?.filter(o => o.status.includes('confirmed')).length || 0,
      totalRevenue: orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
      paidRevenue: orders?.reduce((sum, o) => sum + (o.paid_amount || 0), 0) || 0,
      gameOrders: orders?.filter(o => o.order_type === 'GAME').length || 0,
      eventOrders: orders?.filter(o => o.order_type === 'EVENT').length || 0,
    }

    return stats
  },
})

/**
 * Obtenir les détails d'une commande spécifique
 */
export const getOrderDetails = tool({
  description: 'Get detailed information about a specific order',
  inputSchema: z.object({
    orderId: z.string().optional().describe('Order UUID'),
    reference: z.string().optional().describe('Order reference (e.g., ORD-2024-001)'),
  }),
  execute: async ({ orderId, reference }) => {
    let query = supabase
      .from('orders')
      .select(`
        *,
        branch:branches(name, slug),
        contact:contacts(first_name, last_name, phone, email),
        booking:bookings(id, reference_code, start_datetime, end_datetime, status)
      `)

    if (orderId) {
      query = query.eq('id', orderId)
    } else if (reference) {
      query = query.eq('request_reference', reference)
    } else {
      return { error: 'Please provide orderId or reference' }
    }

    const { data, error } = await query.single()

    if (error) {
      return { error: error.message }
    }

    return { order: data }
  },
})

// ============================================
// Export des tools par contexte
// ============================================

export const publicTools = {
  getBranchInfo,
  getPricing,
  checkAvailability,
  simulateBooking,
  getEventRooms,
  generateBookingLink,
}

export const crmTools = {
  ...publicTools,
  searchOrders,
  searchContacts,
  getStats,
  getOrderDetails,
}

export type PublicToolName = keyof typeof publicTools
export type CRMToolName = keyof typeof crmTools
