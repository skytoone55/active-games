/**
 * API pour vérifier la disponibilité - utilisée par le widget Clara
 * Appelle la même logique que simulateBooking
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Trouve les créneaux alternatifs les plus proches
 * - 1 créneau avant (même jour)
 * - 1 créneau après (même jour)
 * - Même heure sur les autres jours de la semaine (dimanche à samedi)
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
    const [openHour] = dayHours.open.split(':').map(Number)
    const [closeHour] = dayHours.close.split(':').map(Number)

    // Calculer durée nécessaire
    const gameDuration = settings.game_duration_minutes || 30
    const pauseDuration = 0
    let totalDuration: number
    if ((gameArea === 'LASER' || gameArea === 'laser') && numberOfGames > 1) {
      totalDuration = (numberOfGames * gameDuration) + ((numberOfGames - 1) * pauseDuration)
    } else {
      totalDuration = numberOfGames * gameDuration
    }

    // Récupérer tous les bookings ACTIVE pour construire timeline
    const { data: allBookings } = await supabase
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

    // Construire timeline par slots de 15min
    const maxPlayers = settings.max_concurrent_players || 84
    const timeline: Array<{ time: number; available: number }> = []

    for (let min = openHour * 60; min < closeHour * 60; min += 15) {
      const slotStart = new Date(`${requestedDate}T${Math.floor(min/60).toString().padStart(2,'0')}:${(min%60).toString().padStart(2,'0')}:00`)
      const slotEnd = new Date(slotStart.getTime() + 15 * 60000)

      let occupied = 0
      for (const booking of (allBookings || [])) {
        if (!booking.game_sessions) continue
        const hasOverlap = booking.game_sessions.some((session: any) => {
          if (session.game_area !== 'ACTIVE') return false
          const sessionStart = new Date(session.start_datetime)
          const sessionEnd = new Date(session.end_datetime)
          return sessionStart < slotEnd && sessionEnd > slotStart &&
                 !(sessionStart.getTime() === slotEnd.getTime() || sessionEnd.getTime() === slotStart.getTime())
        })
        if (hasOverlap) occupied += booking.participants_count
      }

      timeline.push({ time: min, available: maxPlayers - occupied })
    }

    // Trouver slots libres pour la durée demandée
    const reqSlots = Math.ceil(totalDuration / 15)

    // Chercher AVANT l'heure demandée (slot qui FINIT avant ou à l'heure demandée)
    const reqMin = new Date(`${requestedDate}T${requestedTime}:00`).getHours() * 60 + new Date(`${requestedDate}T${requestedTime}:00`).getMinutes()
    for (let i = timeline.length - reqSlots; i >= 0; i--) {
      const startMin = timeline[i].time
      const endMin = startMin + (reqSlots * 15)

      // Le slot doit finir avant ou à l'heure demandée
      if (endMin > reqMin) continue

      // Vérifier si tous les slots nécessaires sont libres
      let allFree = true
      for (let j = 0; j < reqSlots; j++) {
        if (timeline[i + j].available < participants) {
          allFree = false
          break
        }
      }

      if (allFree) {
        const h = Math.floor(startMin / 60)
        const m = startMin % 60
        beforeSlot = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
        break
      }
    }

    // Chercher APRÈS l'heure demandée
    for (let i = 0; i <= timeline.length - reqSlots; i++) {
      const startMin = timeline[i].time
      if (startMin <= reqMin) continue

      let allFree = true
      for (let j = 0; j < reqSlots; j++) {
        if (timeline[i + j].available < participants) {
          allFree = false
          break
        }
      }

      if (allFree) {
        const h = Math.floor(startMin / 60)
        const m = startMin % 60
        afterSlot = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
        break
      }
    }
  }

  // Chercher 2 jours avant et 2 jours après la date demandée
  const sameTimeOtherDays: Array<{ date: string; dayName: string }> = []
  const currentDate = new Date(requestedDate)

  // 2 jours avant
  for (let offset = -2; offset <= -1; offset++) {
    const testDate = new Date(currentDate)
    testDate.setDate(currentDate.getDate() + offset)
    const testDateStr = testDate.toISOString().split('T')[0]
    const dayName = testDate.toLocaleDateString('fr-FR', { weekday: 'long' })

    const isAvailable = await checkTimeAvailability(branchId, testDateStr, requestedTime, participants, gameArea, numberOfGames, settings)
    if (isAvailable) {
      sameTimeOtherDays.push({ date: testDateStr, dayName })
    }
  }

  // 2 jours après
  for (let offset = 1; offset <= 2; offset++) {
    const testDate = new Date(currentDate)
    testDate.setDate(currentDate.getDate() + offset)
    const testDateStr = testDate.toISOString().split('T')[0]
    const dayName = testDate.toLocaleDateString('fr-FR', { weekday: 'long' })

    const isAvailable = await checkTimeAvailability(branchId, testDateStr, requestedTime, participants, gameArea, numberOfGames, settings)
    if (isAvailable) {
      sameTimeOtherDays.push({ date: testDateStr, dayName })
    }
  }

  return { beforeSlot, afterSlot, sameTimeOtherDays }
}

/**
 * Vérifie si un créneau spécifique est disponible (version simplifiée)
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
  const pauseDuration = 0
  const startDateTime = new Date(`${date}T${time}:00`)
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

        const hasOverlap = booking.game_sessions.some((session: { game_area: string; start_datetime: string; end_datetime: string }) => {
          if (session.game_area !== 'ACTIVE') return false
          const sessionStart = new Date(session.start_datetime)
          const sessionEnd = new Date(session.end_datetime)
          return sessionStart < slotEnd && sessionEnd > slotStart && !(sessionStart.getTime() === slotEnd.getTime() || sessionEnd.getTime() === slotStart.getTime())
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
          return false
        }
      }

      currentStart = new Date(currentStart.getTime() + (gameDuration + pauseDuration) * 60000)
    }
  }

  return true
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      branchSlug,
      date,
      time,
      participants,
      type,
      gameArea,
      numberOfGames,
      eventType
    } = body

    console.log('[Check Availability API] Called with:', body)

    // Convertir le branchSlug en branchId
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('id')
      .ilike('slug', `%${branchSlug.replace(/\s+/g, '-')}%`)
      .single()

    if (branchError || !branch) {
      return NextResponse.json({
        available: false,
        error: 'Branch not found'
      })
    }

    const branchId = branch.id

    // Récupérer les settings
    const { data: settings, error: settingsError } = await supabase
      .from('branch_settings')
      .select('*')
      .eq('branch_id', branchId)
      .single()

    if (settingsError || !settings) {
      return NextResponse.json({
        available: false,
        error: 'Branch settings not found'
      })
    }

    // Vérifier les horaires d'ouverture
    const openingHours = settings.opening_hours as Record<string, { open: string; close: string }> | null
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const dayHours = openingHours?.[dayOfWeek]

    if (!dayHours) {
      return NextResponse.json({
        available: false,
        reason: 'closed',
        message: 'Branch is closed on this day'
      })
    }

    if (time < dayHours.open || time >= dayHours.close) {
      return NextResponse.json({
        available: false,
        reason: 'outside_hours',
        message: `Branch is open from ${dayHours.open} to ${dayHours.close}`,
        openingTime: dayHours.open,
        closingTime: dayHours.close
      })
    }

    const gameDuration = settings.game_duration_minutes || 30
    const pauseDuration = 0
    const startDateTime = new Date(`${date}T${time}:00`)

    // ========== VÉRIFICATION GAME ==========
    if (type === 'game' || type === 'GAME') {
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

          maxOccupancy = Math.max(maxOccupancy, existingParticipants)

          if (existingParticipants + participants > maxPlayers) {
            const alternatives = await findAlternativeSlots(branchId, date, time, participants, gameArea, numGames, settings)
            return NextResponse.json({
              available: false,
              reason: 'capacity_exceeded',
              message: `Not enough capacity. Currently ${existingParticipants}/${maxPlayers} players at this time.`,
              currentOccupancy: existingParticipants,
              maxCapacity: maxPlayers,
              alternatives
            })
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
              const alternatives = await findAlternativeSlots(branchId, date, time, participants, gameArea, numGamesForLaser, settings)
              return NextResponse.json({
                available: false,
                reason: 'laser_room_unavailable',
                message: `No laser room available at ${time} for ${participants} players.`,
                alternatives
              })
            }
          }

          currentStart = new Date(currentStart.getTime() + (gameDuration + pauseDuration) * 60000)
        }
      }

      // Tout OK !
      return NextResponse.json({
        available: true,
        type: 'GAME',
        details: {
          date,
          time,
          participants,
          gameArea: gameArea?.toUpperCase(),
          numberOfGames: numberOfGames || 1,
          endTime: endDateTime.toTimeString().slice(0, 5)
        },
        message: `Slot available for ${participants} players!`
      })
    }

    // ========== VÉRIFICATION EVENT ==========
    if (type === 'event' || type === 'EVENT') {
      const roomDuration = 120
      const roomStartDateTime = new Date(startDateTime)
      const roomEndDateTime = new Date(roomStartDateTime.getTime() + roomDuration * 60000)

      const { data: eventRooms } = await supabase
        .from('event_rooms')
        .select('*')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .order('sort_order')

      if (!eventRooms || eventRooms.length === 0) {
        return NextResponse.json({
          available: false,
          reason: 'no_event_rooms',
          message: 'No event rooms available at this branch.'
        })
      }

      const suitableRooms = eventRooms.filter(room => room.capacity >= participants)
      if (suitableRooms.length === 0) {
        return NextResponse.json({
          available: false,
          reason: 'capacity_exceeded',
          message: `No room can accommodate ${participants} people. Max capacity: ${Math.max(...eventRooms.map(r => r.capacity))}.`
        })
      }

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
        const alternatives = await findAlternativeSlots(branchId, date, time, participants, 'EVENT', 1, settings)
        return NextResponse.json({
          available: false,
          reason: 'room_unavailable',
          message: `No event room available at ${time}.`,
          alternatives
        })
      }

      return NextResponse.json({
        available: true,
        type: 'EVENT',
        details: {
          date,
          time,
          participants,
          roomName: availableRoom.name,
          endTime: roomEndDateTime.toTimeString().slice(0, 5)
        },
        message: `Event room "${availableRoom.name}" is available!`
      })
    }

    return NextResponse.json({
      available: false,
      error: 'Invalid booking type'
    })

  } catch (error) {
    console.error('[Check Availability API] Error:', error)
    return NextResponse.json({
      available: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
