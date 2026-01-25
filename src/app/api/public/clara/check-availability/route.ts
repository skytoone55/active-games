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
    const pauseDuration = 30
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
            return NextResponse.json({
              available: false,
              reason: 'capacity_exceeded',
              message: `Not enough capacity. Currently ${existingParticipants}/${maxPlayers} players at this time.`,
              currentOccupancy: existingParticipants,
              maxCapacity: maxPlayers,
              alternativeSlots: ['10:00', '14:00', '16:00', '19:00'].filter(t => t !== time)
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
              return NextResponse.json({
                available: false,
                reason: 'laser_room_unavailable',
                message: `No laser room available at ${time} for ${participants} players.`,
                alternativeSlots: ['10:00', '14:00', '16:00', '19:00'].filter(t => t !== time)
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
        return NextResponse.json({
          available: false,
          reason: 'room_unavailable',
          message: `No event room available at ${time}.`,
          alternativeSlots: ['10:00', '13:00', '16:00', '19:00'].filter(t => t !== time)
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
