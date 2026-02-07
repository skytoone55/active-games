/**
 * Logique partagée de vérification de disponibilité
 * Basée sur simulateBooking de l'ancienne Clara
 * Peut être utilisée par le messenger et d'autres modules
 */

import { createClient } from '@supabase/supabase-js'
import { createIsraelDateTime } from '@/lib/dates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CheckAvailabilityParams {
  branchId: string
  date: string
  time: string
  participants: number
  type: 'GAME' | 'EVENT'
  gameArea?: 'ACTIVE' | 'LASER' | 'MIX'
  numberOfGames?: number
  eventType?: 'event_active' | 'event_laser' | 'event_mix'
}

interface CheckAvailabilityResult {
  available: boolean
  reason?: string
  message?: string
  error?: string
  alternatives?: any
}

export async function checkAvailability(params: CheckAvailabilityParams): Promise<CheckAvailabilityResult> {
  const { branchId, date, time, participants, type, gameArea, numberOfGames, eventType } = params

  console.log('[Availability Checker] Checking:', params)

  // Récupérer les settings de la branche
  const { data: settings, error: settingsError } = await supabase
    .from('branch_settings')
    .select('*')
    .eq('branch_id', branchId)
    .single()

  if (settingsError || !settings) {
    return { available: false, error: 'Branch settings not found' }
  }

  // Vérifier les horaires d'ouverture
  const openingHours = settings.opening_hours as Record<string, { open: string; close: string }> | null
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const dayHours = openingHours?.[dayOfWeek]

  if (!dayHours) {
    return {
      available: false,
      reason: 'closed',
      message: 'Branch is closed on this day'
    }
  }

  if (time < dayHours.open || time >= dayHours.close) {
    return {
      available: false,
      reason: 'outside_hours',
      message: `Branch is open from ${dayHours.open} to ${dayHours.close}`
    }
  }

  const gameDuration = settings.game_duration_minutes || 30
  const pauseDuration = 30

  // Convertir l'heure Israel → UTC
  const startDateTime = createIsraelDateTime(date, time)
  console.log('[Availability Checker] Israel time:', date, time, '→ UTC:', startDateTime.toISOString())

  // ========== VÉRIFICATION GAME ==========
  if (type === 'GAME') {
    const numGames = numberOfGames || 1
    let totalDuration: number

    if (gameArea === 'LASER' && numGames > 1) {
      totalDuration = (numGames * gameDuration) + ((numGames - 1) * pauseDuration)
    } else if (gameArea === 'MIX') {
      totalDuration = 60
    } else if (gameArea === 'ACTIVE') {
      totalDuration = 60
    } else {
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

      const SLOT_DURATION = 15
      let checkTime = new Date(startDateTime)

      while (checkTime < endDateTime) {
        const slotStart = new Date(checkTime)
        const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION * 60000)
        let existingParticipants = 0

        for (const booking of (existingBookings || [])) {
          if (!booking.game_sessions || booking.game_sessions.length === 0) continue

          const hasOverlap = booking.game_sessions.some((session: any) => {
            if (session.game_area !== 'ACTIVE') return false
            const sessionStart = new Date(session.start_datetime)
            const sessionEnd = new Date(session.end_datetime)
            return sessionStart < slotEnd && sessionEnd > slotStart &&
                   !(sessionStart.getTime() === slotEnd.getTime() || sessionEnd.getTime() === slotStart.getTime())
          })

          if (hasOverlap) {
            existingParticipants += booking.participants_count
          }
        }

        if (existingParticipants + participants > maxPlayers) {
          console.log('[Availability Checker] ACTIVE capacity exceeded at', slotStart)
          return {
            available: false,
            reason: 'capacity_exceeded',
            message: 'Not enough capacity for Active Games at this time'
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

      let currentStart = new Date(startDateTime)
      const numGamesForLaser = numberOfGames || 1
      const isLaserOnly = gameArea === 'LASER'

      for (let i = 0; i < numGamesForLaser; i++) {
        const shouldCheckLaser = isLaserOnly || (gameArea === 'MIX' && i % 2 === 1)

        if (shouldCheckLaser) {
          const sessionStart = new Date(currentStart)
          const sessionEnd = new Date(sessionStart.getTime() + gameDuration * 60000)

          const result = await findBestLaserRoomsForBooking({
            participants,
            startDateTime: sessionStart,
            endDateTime: sessionEnd,
            branchId,
            laserRooms: laserRooms || [],
            settings: {
              laser_exclusive_threshold: settings.laser_exclusive_threshold || 10,
              laser_total_vests: settings.laser_total_vests || 40,
              laser_spare_vests: settings.laser_spare_vests || 5
            },
            allBookings: allBookings || []
          })

          if (!result || result.roomIds.length === 0) {
            console.log('[Availability Checker] No laser rooms available for session', i + 1)
            return {
              available: false,
              reason: 'no_laser_rooms',
              message: 'No laser rooms available at this time'
            }
          }
        }

        if (i < numGamesForLaser - 1) {
          currentStart = new Date(currentStart.getTime() + ((gameDuration + pauseDuration) * 60000))
        }
      }
    }

    // Si on arrive ici, c'est disponible
    return { available: true }
  }

  // ========== VÉRIFICATION EVENT ==========
  if (type === 'EVENT') {
    // Pour les événements, vérifier les salles d'événements
    const { data: eventRooms } = await supabase
      .from('event_rooms')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .gte('max_capacity', participants)
      .order('sort_order')

    if (!eventRooms || eventRooms.length === 0) {
      return {
        available: false,
        reason: 'no_event_room',
        message: 'No event room available for this capacity'
      }
    }

    // Calculer la durée totale de l'événement (15 min setup + 2 jeux avec pause)
    const eventSetupPause = 15
    const eventNumberOfGames = 2
    const roomDuration = eventSetupPause + (eventNumberOfGames * gameDuration) + ((eventNumberOfGames - 1) * pauseDuration)
    const roomEndDateTime = new Date(startDateTime.getTime() + roomDuration * 60000)

    // Trouver une salle disponible
    for (const room of eventRooms) {
      const { data: conflictingBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('event_room_id', room.id)
        .neq('status', 'CANCELLED')
        .or(`start_datetime.lt.${roomEndDateTime.toISOString()},end_datetime.gt.${startDateTime.toISOString()}`)

      if (!conflictingBookings || conflictingBookings.length === 0) {
        return { available: true }
      }
    }

    return {
      available: false,
      reason: 'event_room_busy',
      message: 'All event rooms are busy at this time'
    }
  }

  return { available: false, error: 'Invalid booking type' }
}
