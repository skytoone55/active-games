/**
 * Engine de placement - Cerveau unique du scheduler
 * Logique de placement, allocation, déplacement, validation
 */

import type {
  Booking,
  AllocationParams,
  AllocationResult,
  Conflict,
  ConflictType,
  SlotAllocation,
  RoomAllocation,
  Allocation,
  RoomConfig,
  TimeKey
} from './types'
import type { OccupancyState } from './types'
import {
  buildOccupancyState,
  areSlotsFree,
  isRoomFreeForTimeRange
} from './state'
import {
  toTimeKey,
  rangeToKeys,
  calculateCenteredGameTime,
  toMinutes,
  fromMinutes
} from './time'

const TOTAL_SLOTS = 14
const SLOTS_PER_PERSON = 6 // 1 slot = 6 personnes

/**
 * Calcule le nombre de slots nécessaires selon le nombre de participants
 */
export function calculateSlotsNeeded(participants: number): number {
  if (!participants || participants <= 0) return 1
  return Math.ceil(participants / SLOTS_PER_PERSON)
}

/**
 * Trouve des slots contigus de gauche à droite
 */
export function findContiguousSlots(
  state: OccupancyState,
  slotsNeeded: number,
  timeKeys: TimeKey[],
  excludeBookingId?: string
): number[] | null {
  // Chercher de gauche à droite (slot 1, 2, 3...)
  for (let startSlot = 1; startSlot <= TOTAL_SLOTS - slotsNeeded + 1; startSlot++) {
    const candidateSlots = Array.from({ length: slotsNeeded }, (_, i) => startSlot + i)
    
    if (areSlotsFree(state, candidateSlots, timeKeys, excludeBookingId)) {
      return candidateSlots
    }
  }
  
  return null
}

/**
 * Trouve des slots non-contigus (dernier recours, GAME only)
 * Retourne un tableau de groupes de slots contigus
 */
export function trySplitLastResort(
  state: OccupancyState,
  slotsNeeded: number,
  timeKeys: TimeKey[],
  excludeBookingId?: string
): number[] | null {
  // Collecter tous les slots disponibles
  const availableSlots: number[] = []
  
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    let isAvailable = true
    for (const timeKey of timeKeys) {
      if (!state.gameSlots[timeKey]?.[slot] || 
          (excludeBookingId && state.gameSlots[timeKey]?.[slot] === excludeBookingId)) {
        continue
      }
      isAvailable = false
      break
    }
    if (isAvailable) {
      availableSlots.push(slot)
    }
  }
  
  // Si on a assez de slots disponibles (même non-contigus)
  if (availableSlots.length >= slotsNeeded) {
    // Prendre les premiers disponibles (de gauche à droite)
    return availableSlots.slice(0, slotsNeeded).sort((a, b) => a - b)
  }
  
  return null
}

/**
 * Déplace un booking existant vers la droite pour libérer des slots
 * IMPORTANT : Déplacement HORIZONTAL uniquement (slots), jamais vertical (heure)
 */
export function shiftBookingRight(
  bookings: Booking[],
  bookingToShift: Booking,
  targetSlots: number[],
  date: string
): Booking | null {
  const maxTargetSlot = Math.max(...targetSlots)
  const currentSlots = bookingToShift.assignedSlots || []
  const minCurrentSlot = Math.min(...currentSlots)
  
  // Si déjà après les slots cibles, pas besoin de déplacer
  if (minCurrentSlot > maxTargetSlot) {
    return bookingToShift
  }
  
  // Calculer le décalage nécessaire
  const shift = maxTargetSlot - minCurrentSlot + 1
  const newSlots = currentSlots.map(s => s + shift).sort((a, b) => a - b)
  
  // Vérifier que les nouveaux slots ne dépassent pas TOTAL_SLOTS
  const maxNewSlot = Math.max(...newSlots)
  if (maxNewSlot > TOTAL_SLOTS) {
    return null // Impossible de déplacer (hors limites)
  }
  
  // Vérifier que les nouveaux slots ne créent pas de conflit avec d'autres bookings
  // (on reconstruit l'état avec le booking déplacé)
  const updatedBookings = bookings.map(b => 
    b.id === bookingToShift.id 
      ? { ...b, assignedSlots: newSlots }
      : b
  )
  const tempState = buildOccupancyState(updatedBookings, date)
  
  // Calculer les timeKeys pour ce booking
  // IMPORTANT : Pour les EVENT, utiliser toujours 60 min pour le jeu (centré), pas durationMinutes
  const bookingGameDuration = bookingToShift.type === 'event' 
    ? 60 // Pour EVENT, jeu toujours 60 min centré
    : (bookingToShift.gameDurationMinutes || bookingToShift.durationMinutes || 60)
  const gameTime = calculateCenteredGameTime(
    bookingToShift.hour,
    bookingToShift.minute,
    bookingToShift.type === 'event' ? bookingToShift.durationMinutes || 120 : bookingGameDuration
  )
  const timeKeys = rangeToKeys(
    gameTime.gameStartHour,
    gameTime.gameStartMinute,
    gameTime.gameStartHour + Math.floor((gameTime.gameStartMinute + gameTime.gameDurationMinutes) / 60),
    (gameTime.gameStartMinute + gameTime.gameDurationMinutes) % 60
  )
  
  // Vérifier que les nouveaux slots sont libres
  if (!areSlotsFree(tempState, newSlots, timeKeys, bookingToShift.id)) {
    // Les nouveaux slots créent un conflit, essayer de déplacer récursivement les bloqueurs
    // Trouver les bookings qui bloquent ces nouveaux slots
    const newBlockers: Booking[] = []
    for (const other of updatedBookings) {
      if (other.id === bookingToShift.id) continue
      if (other.date !== bookingToShift.date) continue
      if (!other.assignedSlots || other.assignedSlots.length === 0) continue
      
      // Vérifier chevauchement temporel
      // IMPORTANT : Pour les EVENT, utiliser toujours 60 min pour le jeu (centré), pas durationMinutes
      const otherGameDuration = other.type === 'event' 
        ? 60 // Pour EVENT, jeu toujours 60 min centré
        : (other.gameDurationMinutes || other.durationMinutes || 60)
      const otherGameTime = calculateCenteredGameTime(
        other.hour,
        other.minute,
        other.type === 'event' ? other.durationMinutes || 120 : otherGameDuration
      )
      const otherTimeKeys = rangeToKeys(
        otherGameTime.gameStartHour,
        otherGameTime.gameStartMinute,
        otherGameTime.gameStartHour + Math.floor((otherGameTime.gameStartMinute + otherGameTime.gameDurationMinutes) / 60),
        (otherGameTime.gameStartMinute + otherGameTime.gameDurationMinutes) % 60
      )
      
      const timeOverlap = timeKeys.some(tk => otherTimeKeys.includes(tk))
      if (!timeOverlap) continue
      
      // Vérifier chevauchement de slots
      const slotOverlap = newSlots.some(ns => other.assignedSlots!.includes(ns))
      if (slotOverlap) {
        newBlockers.push(other)
      }
    }
    
    // Essayer de déplacer récursivement les nouveaux bloqueurs
    for (const blocker of newBlockers) {
      const blockerShifted = shiftBookingRight(updatedBookings, blocker, newSlots, date)
      if (!blockerShifted) {
        // Impossible de déplacer récursivement
        return null
      }
      // Mettre à jour dans la liste
      const index = updatedBookings.findIndex(b => b.id === blocker.id)
      if (index >= 0) {
        updatedBookings[index] = blockerShifted
      }
    }
    
    // Reconstruire l'état après déplacement récursif
    const finalState = buildOccupancyState(updatedBookings, date)
    if (!areSlotsFree(finalState, newSlots, timeKeys, bookingToShift.id)) {
      // Toujours pas libre après déplacement récursif
      return null
    }
  }
  
  // Déplacement réussi
  return {
    ...bookingToShift,
    assignedSlots: newSlots
  }
}

/**
 * Alloue des slots de gauche à droite avec déplacement automatique si nécessaire
 */
export function allocateLeftToRight(
  bookings: Booking[],
  params: AllocationParams,
  state: OccupancyState
): { slots: number[]; updatedBookings: Booking[] } | null {
  const slotsNeeded = calculateSlotsNeeded(params.participants)
  
  // Calculer les timeKeys pour le jeu
  // IMPORTANT : Pour les EVENT, utiliser toujours 60 min pour le jeu (centré), pas durationMinutes
  const gameDuration = params.type === 'event' 
    ? 60 // Pour EVENT, jeu toujours 60 min centré
    : (params.gameDurationMinutes || params.durationMinutes || 60)
  const gameTime = calculateCenteredGameTime(
    params.hour,
    params.minute,
    params.type === 'event' ? params.durationMinutes || 120 : gameDuration
  )
  const timeKeys = rangeToKeys(
    gameTime.gameStartHour,
    gameTime.gameStartMinute,
    gameTime.gameStartHour + Math.floor((gameTime.gameStartMinute + gameTime.gameDurationMinutes) / 60),
    (gameTime.gameStartMinute + gameTime.gameDurationMinutes) % 60
  )
  
  // 1. Essayer de trouver des slots contigus directement disponibles
  let slots = findContiguousSlots(state, slotsNeeded, timeKeys, params.excludeBookingId)
  
  if (slots) {
    return { slots, updatedBookings: bookings }
  }
  
  // 2. Si pas de slots contigus, essayer de déplacer les bookings qui bloquent
  // Chercher quels bookings bloquent les slots candidats
  const candidateSlots = Array.from({ length: slotsNeeded }, (_, i) => i + 1) // Commencer par slots 1,2,3...
  const blockers: Booking[] = []
  
  for (const booking of bookings) {
    if (booking.id === params.excludeBookingId) continue
    if (booking.date !== params.date) continue
    if (!booking.assignedSlots || booking.assignedSlots.length === 0) continue
    
    // Vérifier si ce booking chevauche temporellement
    // IMPORTANT : Pour les EVENT, utiliser toujours 60 min pour le jeu (centré), pas durationMinutes
    const bookingGameDuration = booking.type === 'event' 
      ? 60 // Pour EVENT, jeu toujours 60 min centré
      : (booking.gameDurationMinutes || booking.durationMinutes || 60)
    const bookingGameTime = calculateCenteredGameTime(
      booking.hour,
      booking.minute,
      booking.type === 'event' ? booking.durationMinutes || 120 : bookingGameDuration
    )
    const bookingTimeKeys = rangeToKeys(
      bookingGameTime.gameStartHour,
      bookingGameTime.gameStartMinute,
      bookingGameTime.gameStartHour + Math.floor((bookingGameTime.gameStartMinute + bookingGameTime.gameDurationMinutes) / 60),
      (bookingGameTime.gameStartMinute + bookingGameTime.gameDurationMinutes) % 60
    )
    
    // Vérifier chevauchement temporel
    const timeOverlap = timeKeys.some(tk => bookingTimeKeys.includes(tk))
    if (!timeOverlap) continue
    
    // Vérifier chevauchement de slots
    const slotOverlap = candidateSlots.some(cs => booking.assignedSlots!.includes(cs))
    if (slotOverlap) {
      blockers.push(booking)
    }
  }
  
  // Essayer de déplacer les bloqueurs vers la droite
  const updatedBookings = [...bookings]
  let allShifted = true
  
  for (const blocker of blockers) {
    const shifted = shiftBookingRight(updatedBookings, blocker, candidateSlots, params.date)
    if (!shifted) {
      allShifted = false
      break
    }
    // Mettre à jour dans la liste
    const index = updatedBookings.findIndex(b => b.id === blocker.id)
    if (index >= 0) {
      updatedBookings[index] = shifted
    }
  }
  
  if (allShifted) {
    // Reconstruire l'état avec les bookings déplacés
    const newState = buildOccupancyState(updatedBookings, params.date)
    // Vérifier que les slots sont maintenant libres
    if (areSlotsFree(newState, candidateSlots, timeKeys, params.excludeBookingId)) {
      return { slots: candidateSlots, updatedBookings }
    }
  }
  
  // 3. Si toujours pas de place, retourner null (pas d'allocation)
  return null
}

/**
 * Valide qu'il n'y a aucun chevauchement (hard assert)
 */
export function validateNoOverlap(
  bookings: Booking[],
  date: string
): { valid: boolean; conflicts: Array<{ booking1: Booking; booking2: Booking }> } {
  const conflicts: Array<{ booking1: Booking; booking2: Booking }> = []
  const dateBookings = bookings.filter(b => b.date === date)
  
  for (let i = 0; i < dateBookings.length; i++) {
    const b1 = dateBookings[i]
    if (!b1.assignedSlots || b1.assignedSlots.length === 0) continue
    
    // IMPORTANT : Pour les EVENT, utiliser toujours 60 min pour le jeu (centré), pas durationMinutes
    const b1GameDuration = b1.type === 'event' 
      ? 60 // Pour EVENT, jeu toujours 60 min centré
      : (b1.gameDurationMinutes || b1.durationMinutes || 60)
    const gameTime1 = calculateCenteredGameTime(
      b1.hour,
      b1.minute,
      b1.type === 'event' ? b1.durationMinutes || 120 : b1GameDuration
    )
    const timeKeys1 = rangeToKeys(
      gameTime1.gameStartHour,
      gameTime1.gameStartMinute,
      gameTime1.gameStartHour + Math.floor((gameTime1.gameStartMinute + gameTime1.gameDurationMinutes) / 60),
      (gameTime1.gameStartMinute + gameTime1.gameDurationMinutes) % 60
    )
    
    for (let j = i + 1; j < dateBookings.length; j++) {
      const b2 = dateBookings[j]
      if (!b2.assignedSlots || b2.assignedSlots.length === 0) continue
      
      // IMPORTANT : Pour les EVENT, utiliser toujours 60 min pour le jeu (centré), pas durationMinutes
      const b2GameDuration = b2.type === 'event' 
        ? 60 // Pour EVENT, jeu toujours 60 min centré
        : (b2.gameDurationMinutes || b2.durationMinutes || 60)
      const gameTime2 = calculateCenteredGameTime(
        b2.hour,
        b2.minute,
        b2.type === 'event' ? b2.durationMinutes || 120 : b2GameDuration
      )
      const timeKeys2 = rangeToKeys(
        gameTime2.gameStartHour,
        gameTime2.gameStartMinute,
        gameTime2.gameStartHour + Math.floor((gameTime2.gameStartMinute + gameTime2.gameDurationMinutes) / 60),
        (gameTime2.gameStartMinute + gameTime2.gameDurationMinutes) % 60
      )
      
      // Vérifier chevauchement temporel
      const timeOverlap = timeKeys1.some(tk => timeKeys2.includes(tk))
      if (!timeOverlap) continue
      
      // Vérifier chevauchement de slots
      const slotOverlap = b1.assignedSlots.some(s1 => b2.assignedSlots!.includes(s1))
      if (slotOverlap) {
        conflicts.push({ booking1: b1, booking2: b2 })
      }
    }
  }
  
  return {
    valid: conflicts.length === 0,
    conflicts
  }
}

/**
 * Place un booking de type GAME
 */
export function placeGameBooking(
  bookings: Booking[],
  params: AllocationParams,
  allowSplit: boolean = false,
  allowSurbook: boolean = false
): AllocationResult {
  const state = buildOccupancyState(bookings, params.date)
  const slotsNeeded = calculateSlotsNeeded(params.participants)
  
  // Calculer les timeKeys
  const gameTime = calculateCenteredGameTime(
    params.hour,
    params.minute,
    params.gameDurationMinutes || params.durationMinutes || 60
  )
  const timeKeys = rangeToKeys(
    gameTime.gameStartHour,
    gameTime.gameStartMinute,
    gameTime.gameStartHour + Math.floor((gameTime.gameStartMinute + gameTime.gameDurationMinutes) / 60),
    (gameTime.gameStartMinute + gameTime.gameDurationMinutes) % 60
  )
  
  // 1. Essayer allocation gauche→droite avec déplacement automatique
  let result = allocateLeftToRight(bookings, params, state)
  
  if (result) {
    // Vérifier que les slots sont contigus
    const sorted = result.slots.sort((a, b) => a - b)
    const isContiguous = sorted.every((s, i) => i === 0 || s === sorted[i - 1] + 1)
    
    return {
      success: true,
      allocation: {
        slotAllocation: {
          slots: result.slots,
          isSplit: !isContiguous,
          splitParts: !isContiguous ? undefined : undefined, // TODO: calculer si split
          splitIndex: !isContiguous ? undefined : undefined
        }
      }
    }
  }
  
  // 2. Si pas de place contiguë, essayer split (dernier recours, GAME only)
  if (allowSplit && params.type === 'game') {
    const splitSlots = trySplitLastResort(state, slotsNeeded, timeKeys, params.excludeBookingId)
    if (splitSlots) {
      return {
        success: true,
        allocation: {
          slotAllocation: {
            slots: splitSlots,
            isSplit: true,
            splitParts: undefined, // TODO: calculer
            splitIndex: undefined
          }
        }
      }
    }
  }
  
  // 3. Si toujours pas de place, vérifier surbooking
  // Compter les slots disponibles
  let availableCount = 0
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    if (areSlotsFree(state, [slot], timeKeys, params.excludeBookingId)) {
      availableCount++
    }
  }
  
  if (availableCount === 0) {
    // FULL : tous les slots occupés
    // Même si FULL, proposer surbook si allowSurbook (on peut quand même créer avec surbook)
    if (allowSurbook) {
      return {
        success: false,
        conflict: {
          type: 'NEED_SURBOOK_CONFIRM',
          message: `Tous les slots sont occupés (besoin de ${slotsNeeded} slot(s)). Autoriser surbooking ?`,
          details: {
            availableSlots: 0,
            neededSlots: slotsNeeded,
            excessParticipants: slotsNeeded * SLOTS_PER_PERSON
          }
        }
      }
    }
    
    return {
      success: false,
      conflict: {
        type: 'FULL',
        message: 'Tous les slots sont occupés à cet horaire',
        details: {
          availableSlots: 0,
          neededSlots: slotsNeeded
        }
      }
    }
  }
  
  // Besoin de confirmation pour surbooking
  if (allowSurbook) {
    return {
      success: false,
      conflict: {
        type: 'NEED_SURBOOK_CONFIRM',
        message: `Seulement ${availableCount} slot(s) disponible(s), besoin de ${slotsNeeded}. Autoriser surbooking ?`,
        details: {
          availableSlots: availableCount,
          neededSlots: slotsNeeded,
          excessParticipants: (slotsNeeded - availableCount) * SLOTS_PER_PERSON
        }
      }
    }
  }
  
  // Refus
  return {
    success: false,
    conflict: {
      type: 'FULL',
      message: `Pas assez de slots disponibles (${availableCount} disponible(s), ${slotsNeeded} nécessaire(s))`,
      details: {
        availableSlots: availableCount,
        neededSlots: slotsNeeded
      }
    }
  }
}

/**
 * Trouve la plus petite salle qui peut accueillir le nombre de participants (smallest-fit)
 */
export function findSmallestFitRoom(
  state: OccupancyState,
  participants: number,
  timeKeys: TimeKey[],
  roomConfigs: Map<number, RoomConfig>,
  excludeBookingId?: string
): { roomId: number; config: RoomConfig } | null {
  // Trier les salles par capacité croissante
  const sortedRooms = Array.from(roomConfigs.entries())
    .sort((a, b) => a[1].maxCapacity - b[1].maxCapacity)
  
  for (const [roomId, config] of sortedRooms) {
    // Vérifier capacité
    if (config.maxCapacity >= participants) {
      // Vérifier disponibilité temporelle
      if (isRoomFreeForTimeRange(state, roomId, timeKeys, excludeBookingId)) {
        return { roomId, config }
      }
    }
  }
  
  return null
}

/**
 * Place un booking de type EVENT (room + game zone)
 */
export function placeEventBooking(
  bookings: Booking[],
  params: AllocationParams,
  roomConfigs: Map<number, RoomConfig>,
  allowRoomOvercap: boolean = false
): AllocationResult {
  const state = buildOccupancyState(bookings, params.date)
  
  // Durée de l'événement (ex: 120 min)
  const eventDuration = params.durationMinutes || 120
  const timeKeys = rangeToKeys(
    params.hour,
    params.minute,
    params.hour + Math.floor((params.minute + eventDuration) / 60),
    (params.minute + eventDuration) % 60
  )
  
  // 1. Trouver une salle (smallest-fit)
  const roomResult = findSmallestFitRoom(
    state,
    params.participants,
    timeKeys,
    roomConfigs,
    params.excludeBookingId
  )
  
  if (!roomResult) {
    // Aucune salle disponible
    return {
      success: false,
      conflict: {
        type: 'NO_ROOM',
        message: 'Aucune salle disponible à cet horaire',
        details: {
          participants: params.participants
        }
      }
    }
  }
  
  // 2. Vérifier capacité
  if (roomResult.config.maxCapacity < params.participants) {
    if (allowRoomOvercap) {
      return {
        success: false,
        conflict: {
          type: 'NEED_ROOM_OVERCAP_CONFIRM',
          message: `La salle ${roomResult.config.name} a une capacité de ${roomResult.config.maxCapacity} personnes, mais ${params.participants} sont demandées. Autoriser ?`,
          details: {
            roomId: roomResult.roomId,
            roomCapacity: roomResult.config.maxCapacity,
            participants: params.participants,
            excessParticipants: params.participants - roomResult.config.maxCapacity
          }
        }
      }
    }
    
    return {
      success: false,
      conflict: {
        type: 'ROOM_OVERCAP',
        message: `La salle ${roomResult.config.name} ne peut pas accueillir ${params.participants} personnes (capacité: ${roomResult.config.maxCapacity})`,
        details: {
          roomId: roomResult.roomId,
          roomCapacity: roomResult.config.maxCapacity,
          participants: params.participants
        }
      }
    }
  }
  
  // 3. Allouer les slots pour la zone de jeu (centrée)
  const gameParams: AllocationParams = {
    ...params,
    gameDurationMinutes: 60 // Toujours 60 min centré
  }
  const gameResult = placeGameBooking(bookings, gameParams, false, false)
  
  if (!gameResult.success) {
    // Si pas de slots pour le jeu, l'événement est impossible
    return {
      success: false,
      conflict: {
        type: 'FULL',
        message: 'Aucun slot disponible pour la zone de jeu',
        details: gameResult.conflict?.details
      }
    }
  }
  
  // 4. Succès : retourner allocation complète (room + slots)
  return {
    success: true,
    allocation: {
      roomAllocation: {
        roomId: roomResult.roomId,
        startTimeKey: toTimeKey(params.hour, params.minute),
        endTimeKey: toTimeKey(
          params.hour + Math.floor((params.minute + eventDuration) / 60),
          (params.minute + eventDuration) % 60
        )
      },
      slotAllocation: gameResult.allocation?.slotAllocation
    }
  }
}

/**
 * Réorganise TOUS les bookings d'une date et retourne un nouvel état complet
 * RÈGLE : Retourne toujours un état complet, jamais de mutation directe
 * L'UI NE DOIT JAMAIS muter les appointments directement
 */
export function reorganizeAllBookingsForDate(
  existingBookings: Booking[],
  newBooking: Booking | null, // null si suppression
  date: string,
  roomConfigs: Map<number, RoomConfig>,
  allowSplit: boolean = false,
  allowSurbook: boolean = false,
  allowRoomOvercap: boolean = false
): { success: boolean; bookings: Booking[]; conflict?: Conflict } {
  // Filtrer les bookings de la date (exclure celui qu'on modifie/ajoute/supprime)
  const dateBookings = existingBookings
    .filter(b => b.date === date)
    .filter(b => !newBooking || b.id !== newBooking.id)
    .map(b => ({ ...b })) // Copie pour éviter mutation

  // Si nouveau booking, l'ajouter à la liste
  const bookingsToReorganize = newBooking
    ? [...dateBookings, newBooking]
    : dateBookings

  // Trier par heure de début
  bookingsToReorganize.sort((a, b) => {
    const aStart = a.hour * 60 + a.minute
    const bStart = b.hour * 60 + b.minute
    return aStart - bStart
  })

  // Réorganiser chaque booking un par un dans l'ordre chronologique
  // IMPORTANT : Utiliser les bookings déplacés à chaque étape pour propager les déplacements
  let currentBookings: Booking[] = [] // Liste des bookings déjà réorganisés (avec déplacements)

  for (const booking of bookingsToReorganize) {
    // IMPORTANT : Pour les EVENT, s'assurer que gameDurationMinutes est bien 60 (centré)
    const params: AllocationParams = {
      date: booking.date,
      hour: booking.hour,
      minute: booking.minute,
      participants: booking.participants,
      type: booking.type,
      durationMinutes: booking.durationMinutes,
      gameDurationMinutes: booking.type === 'event' 
        ? 60 // Pour EVENT, jeu toujours 60 min centré
        : (booking.gameDurationMinutes || booking.durationMinutes || 60),
      excludeBookingId: booking.id // Exclure ce booking lui-même pendant la vérification
    }

    let result: AllocationResult | null = null

    if (booking.type === 'event') {
      result = placeEventBooking(currentBookings, params, roomConfigs, allowRoomOvercap)
    } else {
      // Pour les GAME, utiliser directement allocateLeftToRight pour récupérer les déplacements
      const state = buildOccupancyState(currentBookings, params.date)
      const allocationResult = allocateLeftToRight(currentBookings, params, state)
      
      if (allocationResult) {
        // Mettre à jour currentBookings avec les bookings déplacés (ne contient PAS le nouveau booking)
        currentBookings = allocationResult.updatedBookings
        
        // Créer le résultat avec les slots assignés
        result = {
          success: true,
          allocation: {
            slotAllocation: {
              slots: allocationResult.slots,
              isSplit: false // allocateLeftToRight retourne toujours des slots contigus
            }
          }
        }
      } else {
        // Pas de place même après déplacement, essayer split/surbook
        result = placeGameBooking(currentBookings, params, allowSplit, allowSurbook)
      }
    }

    if (result && result.success && result.allocation) {
      // Mettre à jour le booking avec la nouvelle allocation
      const updatedBooking: Booking = {
        ...booking,
        assignedSlots: result.allocation.slotAllocation?.slots,
        assignedRoom: result.allocation.roomAllocation?.roomId,
        surbooked: result.allocation.surbooked || false,
        surbookedParticipants: result.allocation.surbookedParticipants || 0,
        roomOvercap: result.allocation.roomOvercap || false,
        roomOvercapParticipants: result.allocation.roomOvercapParticipants || 0,
        split: result.allocation.split || false,
        splitParts: result.allocation.splitParts || 1,
        splitIndex: result.allocation.splitIndex || 0,
      }
      
      // Ajouter le booking avec les slots assignés
      // (currentBookings contient déjà les bookings déplacés si on a utilisé allocateLeftToRight)
      currentBookings.push(updatedBooking)
    } else if (result && !result.success) {
      // Échec : retourner conflit (pas de mutation)
      return {
        success: false,
        bookings: existingBookings, // Retourner état original sans modifications
        conflict: result.conflict
      }
    }
  }
  
  // Utiliser les bookings réorganisés avec déplacements
  const reorganizedBookings = currentBookings

  // Valider qu'il n'y a aucun chevauchement
  const validation = validateNoOverlap(reorganizedBookings, date)
  if (!validation.valid) {
    return {
      success: false,
      bookings: existingBookings, // Rollback : retourner état original
      conflict: {
        type: 'OVERLAP_DETECTED' as ConflictType,
        message: `${validation.conflicts.length} chevauchement(s) détecté(s) après réorganisation`,
        details: {
          conflicts: validation.conflicts.length
        }
      }
    }
  }

  // Succès : retourner état complet (bookings de la date réorganisés + autres dates inchangés)
  const otherDatesBookings = existingBookings.filter(b => b.date !== date)
  return {
    success: true,
    bookings: [...otherDatesBookings, ...reorganizedBookings]
  }
}
