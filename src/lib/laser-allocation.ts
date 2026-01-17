/**
 * Utilitaires partagés pour la gestion des réservations LASER
 * Utilisé par l'admin ET l'API site pour garantir une logique identique
 */

import type { LaserRoom } from './supabase/types'

export interface LaserAllocationResult {
  roomIds: string[]
  requiresTwoRooms: boolean
}

export interface LaserAllocationSettings {
  laser_exclusive_threshold: number // Par défaut 10
  laser_total_vests: number
  laser_spare_vests?: number
}

/**
 * Trouve les meilleures salles laser pour un booking
 * LOGIQUE IDENTIQUE à findBestLaserRoom de l'admin
 */
export async function findBestLaserRoomsForBooking(params: {
  participants: number
  startDateTime: Date
  endDateTime: Date
  branchId: string
  laserRooms: LaserRoom[]
  settings: LaserAllocationSettings
  allBookings: Array<{
    id: string
    branch_id: string
    participants_count: number
    game_sessions?: Array<{
      game_area: string
      laser_room_id: string | null
      start_datetime: string
      end_datetime: string
    }>
  }>
  excludeBookingId?: string
  allocationMode?: 'auto' | 'petit' | 'grand' | 'maxi'
}): Promise<LaserAllocationResult | null> {
  
  const {
    participants,
    startDateTime,
    endDateTime,
    branchId,
    laserRooms,
    settings,
    allBookings,
    excludeBookingId,
    allocationMode = 'auto'
  } = params

  const exclusiveThreshold = settings.laser_exclusive_threshold || 10
  const activeLaserRooms = laserRooms.filter(r => r.is_active)

  if (activeLaserRooms.length === 0) {
    return null
  }

  // Trier par capacité croissante (plus petite salle en premier)
  const sortedRoomsByCapacity = [...activeLaserRooms].sort((a, b) => {
    if (a.capacity !== b.capacity) {
      return a.capacity - b.capacity
    }
    return a.sort_order - b.sort_order
  })

  // Filtrer les bookings qui chevauchent et sont sur la même branche
  const overlappingLaserBookings = allBookings.filter(b => {
    if (b.branch_id !== branchId) return false
    if (excludeBookingId && b.id === excludeBookingId) return false
    if (!b.game_sessions || b.game_sessions.length === 0) return false
    
    return b.game_sessions.some(s => {
      if (s.game_area !== 'LASER') return false
      const sessionStart = new Date(s.start_datetime)
      const sessionEnd = new Date(s.end_datetime)
      return sessionStart < endDateTime && sessionEnd > startDateTime
    })
  })

  // Fonction pour calculer la capacité restante d'une salle
  const getRoomRemainingCapacity = (roomId: string): number => {
    const room = activeLaserRooms.find(r => r.id === roomId)
    if (!room) return 0
    
    // RÈGLE 1 : Vérifier si une résa utilise mode MAXI (2+ salles)
    const hasMaxiMode = overlappingLaserBookings.some(b => {
      const laserRoomIds = b.game_sessions
        ?.filter(s => s.game_area === 'LASER')
        .map(s => s.laser_room_id)
        .filter((id): id is string => id !== null) || []
      const uniqueRoomIds = [...new Set(laserRoomIds)]
      return uniqueRoomIds.length > 1
    })
    
    if (hasMaxiMode) {
      return 0 // Tout le laser bloqué
    }
    
    // RÈGLE 2 : Vérifier si un groupe >= exclusiveThreshold utilise cette salle
    const hasExclusiveGroup = overlappingLaserBookings.some(b => 
      b.participants_count >= exclusiveThreshold &&
      b.game_sessions?.some(s => s.game_area === 'LASER' && s.laser_room_id === roomId)
    )
    
    if (hasExclusiveGroup) {
      return 0 // Salle exclusive
    }
    
    // RÈGLE 3 : Calcul normal de capacité restante
    const bookingsInThisRoom = overlappingLaserBookings.filter(b => 
      b.game_sessions?.some(s => s.game_area === 'LASER' && s.laser_room_id === roomId)
    )
    const currentParticipants = bookingsInThisRoom.reduce((sum, b) => sum + b.participants_count, 0)
    return room.capacity - currentParticipants
  }

  // ALLOCATION MANUELLE : Forcer une salle spécifique si mode != 'auto'
  if (allocationMode !== 'auto') {
    const smallRoom = sortedRoomsByCapacity[0]
    const largeRoom = sortedRoomsByCapacity[sortedRoomsByCapacity.length - 1]
    
    let forcedRoomIds: string[] = []
    
    if (allocationMode === 'petit') {
      forcedRoomIds = [smallRoom.id]
    } else if (allocationMode === 'grand') {
      forcedRoomIds = [largeRoom.id]
    } else if (allocationMode === 'maxi') {
      forcedRoomIds = activeLaserRooms.map(r => r.id)
    }
    
    // Vérifier si les salles forcées ont assez de capacité
    const totalCapacity = forcedRoomIds.reduce((sum, roomId) => {
      const remaining = getRoomRemainingCapacity(roomId)
      return sum + remaining
    }, 0)
    
    if (totalCapacity >= participants) {
      return {
        roomIds: forcedRoomIds,
        requiresTwoRooms: forcedRoomIds.length > 1
      }
    } else {
      return null // Pas assez de capacité en mode forcé
    }
  }

  // ALLOCATION AUTO : Optimiser l'espace

  // Cas 1 : Groupe >= exclusiveThreshold → Besoin d'une salle exclusive
  if (participants >= exclusiveThreshold) {
    // Trouver une salle vide avec capacité suffisante (plus petite possible)
    for (const room of sortedRoomsByCapacity) {
      const remaining = getRoomRemainingCapacity(room.id)

      if (remaining === room.capacity && room.capacity >= participants) {
        return {
          roomIds: [room.id],
          requiresTwoRooms: false
        }
      }
    }

    // Si aucune salle simple ne suffit, essayer combinaison de 2 salles
    const totalCapacityAllRooms = sortedRoomsByCapacity.reduce((sum, r) => {
      const remaining = getRoomRemainingCapacity(r.id)
      return sum + (remaining === r.capacity ? r.capacity : 0) // Seulement salles vides
    }, 0)

    if (totalCapacityAllRooms >= participants) {
      // Prendre toutes les salles disponibles vides
      const emptyRooms = sortedRoomsByCapacity.filter(r => getRoomRemainingCapacity(r.id) === r.capacity)
      return {
        roomIds: emptyRooms.map(r => r.id),
        requiresTwoRooms: true
      }
    }

    return null // Pas de capacité pour groupe exclusif
  }
  
  // Cas 2 : Petit groupe (< exclusiveThreshold) → Peut partager
  // Trouver la plus petite salle avec capacité suffisante
  for (const room of sortedRoomsByCapacity) {
    const remaining = getRoomRemainingCapacity(room.id)
    if (remaining >= participants) {
      return {
        roomIds: [room.id],
        requiresTwoRooms: false
      }
    }
  }
  
  return null // Aucune salle disponible
}
