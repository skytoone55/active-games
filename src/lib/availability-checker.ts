/**
 * Logique partagée de vérification de disponibilité
 * Basée sur l'ancienne API check-availability qui fonctionnait
 * Utilisée par le messenger et d'autres modules
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
  alternatives?: {
    beforeSlot: string | null
    afterSlot: string | null
    sameTimeOtherDays: Array<{ date: string; dayName: string }>
  }
}

/**
 * Vérifie si un créneau spécifique est disponible (version simplifiée, sans alternatives)
 */
async function checkTimeAvailability(
  branchId: string,
  date: string,
  time: string,
  participants: number,
  gameArea: string,
  numberOfGames: number,
  settings: any
): Promise<boolean> {
  // Vérifier horaires d'ouverture
  const openingHours = settings.opening_hours as Record<string, { open: string; close: string }> | null
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const dayHours = openingHours?.[dayOfWeek]

  if (!dayHours || time < dayHours.open || time >= dayHours.close) {
    return false
  }

  const gameDuration = settings.game_duration_minutes || 30
  const pauseDuration = 30
  const startDateTime = createIsraelDateTime(date, time)
  const numGames = numberOfGames || 1

  let totalDuration: number
  if ((gameArea === 'LASER' || gameArea === 'laser') && numGames > 1) {
    totalDuration = (numGames * gameDuration) + ((numGames - 1) * pauseDuration)
  } else {
    totalDuration = numGames * gameDuration
  }

  const endDateTime = new Date(startDateTime.getTime() + (totalDuration * 60000))

  // Vérifier capacité ACTIVE
  if (gameArea === 'ACTIVE' || gameArea === 'active' || gameArea === 'MIX' || gameArea === 'mix') {
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
        return false
      }

      checkTime = slotEnd
    }
  }

  // Vérifier disponibilité LASER
  if (gameArea === 'LASER' || gameArea === 'laser' || gameArea === 'MIX' || gameArea === 'mix') {
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
    const isLaserOnly = gameArea === 'LASER' || gameArea === 'laser'

    for (let i = 0; i < numGamesForLaser; i++) {
      const shouldCheckLaser = isLaserOnly || ((gameArea === 'MIX' || gameArea === 'mix') && i % 2 === 1)

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
          return false
        }
      }

      if (i < numGamesForLaser - 1) {
        currentStart = new Date(currentStart.getTime() + ((gameDuration + pauseDuration) * 60000))
      }
    }
  }

  return true
}

/**
 * Trouve les créneaux alternatifs (avant/après même jour + autres jours de la semaine)
 */
async function findAlternativeSlots(
  branchId: string,
  requestedDate: string,
  requestedTime: string,
  participants: number,
  gameArea: string,
  numberOfGames: number,
  settings: any
): Promise<{ beforeSlot: string | null; afterSlot: string | null; sameTimeOtherDays: Array<{ date: string; dayName: string }> }> {
  const openingHours = settings.opening_hours as Record<string, { open: string; close: string }> | null
  const requestedDateTime = new Date(`${requestedDate}T${requestedTime}:00`)
  const dayOfWeek = requestedDateTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const dayHours = openingHours?.[dayOfWeek]

  let beforeSlot: string | null = null
  let afterSlot: string | null = null

  if (dayHours) {
    const [openHour, openMin] = dayHours.open.split(':').map(Number)
    const [closeHour, closeMin] = dayHours.close.split(':').map(Number)
    const [reqHour, reqMin] = requestedTime.split(':').map(Number)

    // Chercher un créneau AVANT (par intervalles de 30 min)
    for (let h = reqHour - 1; h >= openHour; h--) {
      for (let m of [30, 0]) {
        if (h === reqHour - 1 && m >= reqMin) continue
        if (h === openHour && m < openMin) continue

        const testTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
        const isAvailable = await checkTimeAvailability(branchId, requestedDate, testTime, participants, gameArea, numberOfGames, settings)
        if (isAvailable) {
          beforeSlot = testTime
          break
        }
      }
      if (beforeSlot) break
    }

    // Chercher un créneau APRÈS (par intervalles de 15 min)
    for (let h = reqHour + 1; h < closeHour || (h === closeHour && 0 < closeMin); h++) {
      for (let m of [0, 15, 30, 45]) {
        if (h === reqHour && m <= reqMin) continue
        if (h === closeHour && m >= closeMin) continue

        const testTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
        const isAvailable = await checkTimeAvailability(branchId, requestedDate, testTime, participants, gameArea, numberOfGames, settings)
        if (isAvailable) {
          afterSlot = testTime
          break
        }
      }
      if (afterSlot) break
    }
  }

  // Chercher la même heure sur les autres jours de la semaine (dimanche à samedi)
  const sameTimeOtherDays: Array<{ date: string; dayName: string }> = []
  const currentDate = new Date(requestedDate)
  const currentDayIndex = currentDate.getDay() // 0 = dimanche, 6 = samedi

  for (let i = 0; i < 7; i++) {
    if (i === currentDayIndex) continue // Skip le jour demandé

    const testDate = new Date(currentDate)
    testDate.setDate(currentDate.getDate() + (i - currentDayIndex))
    const testDateStr = testDate.toISOString().split('T')[0]
    const dayName = testDate.toLocaleDateString('fr-FR', { weekday: 'long' })

    const isAvailable = await checkTimeAvailability(branchId, testDateStr, requestedTime, participants, gameArea, numberOfGames, settings)
    if (isAvailable) {
      sameTimeOtherDays.push({ date: testDateStr, dayName })
    }
  }

  return { beforeSlot, afterSlot, sameTimeOtherDays }
}

export async function checkAvailability(params: CheckAvailabilityParams): Promise<CheckAvailabilityResult> {
  const { branchId, date, time, participants, type, gameArea, numberOfGames } = params

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
  const startDateTime = createIsraelDateTime(date, time)

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
          // Trouver alternatives
          const alternatives = await findAlternativeSlots(branchId, date, time, participants, gameArea || 'ACTIVE', numGames, settings)
          return {
            available: false,
            reason: 'capacity_exceeded',
            message: 'Not enough capacity for Active Games at this time',
            alternatives
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
            // Trouver alternatives
            const alternatives = await findAlternativeSlots(branchId, date, time, participants, gameArea || 'LASER', numGamesForLaser, settings)
            return {
              available: false,
              reason: 'no_laser_rooms',
              message: 'No laser rooms available at this time',
              alternatives
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

  return { available: false, error: 'Invalid booking type' }
}
