/**
 * Construction des sessions de jeu
 * LOGIQUE IDENTIQUE à BookingModal.handleSubmit
 * Utilisée par l'admin ET l'API site
 */

import type { LaserRoom, GameSession } from './supabase/types'

export interface SessionBuilderParams {
  bookingType: 'GAME' | 'EVENT'
  gameArea?: 'ACTIVE' | 'LASER' | null
  numberOfGames: number
  participants: number
  startDateTime: Date
  branchId: string
  gameDuration: number // En minutes
  // Fonction pour trouver les meilleures salles laser
  findBestLaserRoom?: (
    participants: number,
    startDateTime: Date,
    endDateTime: Date,
    excludeBookingId?: string,
    branchId?: string | null
  ) => Promise<{ roomIds: string[]; requiresTwoRooms: boolean } | null>
  excludeBookingId?: string
}

export interface SessionBuilderResult {
  game_sessions: Array<{
    game_area: 'ACTIVE' | 'LASER'
    start_datetime: string
    end_datetime: string
    laser_room_id: string | null
    session_order: number
    pause_before_minutes: number
  }>
  error?: string
}

/**
 * Construit les game_sessions pour un booking GAME
 * IDENTIQUE à BookingModal ligne 1244-1397
 */
export async function buildGameSessions(
  params: SessionBuilderParams
): Promise<SessionBuilderResult> {
  
  const {
    gameArea,
    numberOfGames,
    participants,
    startDateTime,
    branchId,
    gameDuration,
    findBestLaserRoom,
    excludeBookingId
  } = params

  const game_sessions: SessionBuilderResult['game_sessions'] = []

  if (gameArea === 'ACTIVE') {
    // ACTIVE : créer des sessions pour chaque jeu
    let currentStart = new Date(startDateTime)
    
    for (let i = 0; i < numberOfGames; i++) {
      const sessionStart = new Date(currentStart)
      const sessionEnd = new Date(sessionStart)
      sessionEnd.setMinutes(sessionEnd.getMinutes() + gameDuration)
      
      game_sessions.push({
        game_area: 'ACTIVE',
        start_datetime: sessionStart.toISOString(),
        end_datetime: sessionEnd.toISOString(),
        laser_room_id: null,
        session_order: i + 1,
        pause_before_minutes: 0
      })
      
      // Prochain jeu commence directement après (pas de pause par défaut site)
      currentStart = sessionEnd
    }
    
  } else if (gameArea === 'LASER') {
    // LASER : créer des sessions pour chaque jeu
    // IDENTIQUE à BookingModal ligne 1279-1333
    let currentStart = new Date(startDateTime)
    
    for (let i = 0; i < numberOfGames; i++) {
      const sessionStart = new Date(currentStart)
      const sessionEnd = new Date(sessionStart)
      sessionEnd.setMinutes(sessionEnd.getMinutes() + gameDuration)
      
      // Trouver la meilleure salle laser pour cette session
      let allocatedRoomIds: string[] = []
      
      if (findBestLaserRoom) {
        const allocation = await findBestLaserRoom(
          participants,
          sessionStart,
          sessionEnd,
          excludeBookingId,
          branchId
        )
        
        if (allocation) {
          allocatedRoomIds = allocation.roomIds
        } else {
          // AUCUNE SALLE DISPONIBLE
          const timeStr = `${String(sessionStart.getHours()).padStart(2, '0')}:${String(sessionStart.getMinutes()).padStart(2, '0')}`
          return {
            game_sessions: [],
            error: `No laser room available for ${participants} participants at ${timeStr}`
          }
        }
      }
      
      // Créer une session par salle (si L1+L2, créer 2 sessions)
      // IDENTIQUE à BookingModal ligne 1316-1326
      allocatedRoomIds.forEach((roomId) => {
        game_sessions.push({
          game_area: 'LASER',
          start_datetime: sessionStart.toISOString(),
          end_datetime: sessionEnd.toISOString(),
          laser_room_id: roomId,
          session_order: i + 1, // Ordre du jeu (1, 2, 3, etc.)
          pause_before_minutes: 0
        })
      })
      
      // Prochain jeu commence directement après (pas de pause par défaut site)
      currentStart = sessionEnd
    }
  }

  return { game_sessions }
}

/**
 * Wrapper pour l'API qui gère la récupération des bookings et appelle findBestLaserRoomsForBooking
 */
export async function buildGameSessionsForAPI(params: {
  gameArea?: 'ACTIVE' | 'LASER' | null
  numberOfGames: number
  participants: number
  startDateTime: Date
  branchId: string
  gameDuration: number
  supabase: any // Supabase client
}): Promise<SessionBuilderResult> {
  
  const { gameArea, supabase, branchId, startDateTime, gameDuration, numberOfGames, participants } = params
  
  // Si LASER, on doit récupérer les données pour findBestLaserRoom
  if (gameArea === 'LASER') {
    // Récupérer salles laser
    const { data: laserRooms } = await supabase
      .from('laser_rooms')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('sort_order')
    
    // Récupérer settings
    const { data: settings } = await supabase
      .from('branch_settings')
      .select('*')
      .eq('branch_id', branchId)
      .single()
    
    // Récupérer tous les bookings
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
    
    // Créer une fonction findBestLaserRoom pour ce contexte
    const findBestLaserRoom = async (
      participants: number,
      start: Date,
      end: Date,
      excludeId?: string
    ) => {
      const { findBestLaserRoomsForBooking } = await import('./laser-allocation')
      
      console.log('[buildGameSessionsForAPI] Calling laser allocation with:', {
        participants,
        start: start.toISOString(),
        end: end.toISOString(),
        laserRoomsCount: laserRooms?.length || 0,
        settings: {
          laser_exclusive_threshold: settings?.laser_exclusive_threshold || 10,
          laser_total_vests: settings?.laser_total_vests || 30,
          laser_spare_vests: settings?.laser_spare_vests || 0
        }
      })
      
      const result = await findBestLaserRoomsForBooking({
        participants,
        startDateTime: start,
        endDateTime: end,
        branchId,
        laserRooms: laserRooms || [],
        settings: {
          laser_exclusive_threshold: settings?.laser_exclusive_threshold || 10,
          laser_total_vests: settings?.laser_total_vests || 30,
          laser_spare_vests: settings?.laser_spare_vests || 0
        },
        allBookings: allBookings || [],
        excludeBookingId: excludeId,
        allocationMode: 'auto'
      })
      
      console.log('[buildGameSessionsForAPI] Laser allocation result:', result)
      
      return result
    }
    
    return await buildGameSessions({
      bookingType: 'GAME',
      gameArea,
      numberOfGames,
      participants,
      startDateTime,
      branchId,
      gameDuration,
      findBestLaserRoom
    })
  }
  
  // Pour ACTIVE, pas besoin de fonction spéciale
  return await buildGameSessions({
    bookingType: 'GAME',
    gameArea,
    numberOfGames,
    participants,
    startDateTime,
    branchId,
    gameDuration
  })
}
