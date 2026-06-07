"use client"

import { Fragment, memo } from 'react'
import { toIsraelLocalDate } from '@/lib/dates'
import type { BookingWithSlots } from '@/hooks/useBookings'

const toIL = (d: Date) => toIsraelLocalDate(d)

export interface UISegment {
  segmentId: string
  bookingId: string
  booking: BookingWithSlots
  start: Date
  end: Date
  slotStart: number
  slotEnd: number
  slotsKey: string
  isOverbooked: boolean
}

export interface OBData {
  totalParticipants: number
  capacity: number
  isOverbooked: boolean
  overbookedCount: number
  slotsOver: number
  totalSlotsUsed: number
}

interface RoomLike { id: string; name?: string | null; is_active: boolean; sort_order: number }
interface TimeSlot { hour: number; minute: number; label: string }

// Helpers purs (aucun état capturé) — copiés depuis page.tsx
const formatTime = (date: Date): string => {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

const getTextSizeClass = (size: string) => {
  switch (size) {
    case 'xs': return 'text-xs'
    case 'sm': return 'text-sm'
    case 'base': return 'text-base'
    case 'lg': return 'text-lg'
    default: return 'text-sm'
  }
}

const getTextWeightClass = (weight: string) => {
  switch (weight) {
    case 'normal': return 'font-normal'
    case 'semibold': return 'font-semibold'
    case 'bold': return 'font-bold'
    default: return 'font-bold'
  }
}

const getContactDisplayData = (booking: BookingWithSlots) => {
  if (booking.primaryContact) {
    return {
      firstName: booking.primaryContact.first_name || '',
      lastName: booking.primaryContact.last_name || '',
      phone: booking.primaryContact.phone || '',
      email: booking.primaryContact.email || '',
      notes: booking.primaryContact.notes_client || '',
    }
  }
  return {
    firstName: booking.customer_first_name || '',
    lastName: booking.customer_last_name || '',
    phone: booking.customer_phone || '',
    email: booking.customer_email || '',
    notes: booking.customer_notes_at_booking || '',
  }
}

interface AgendaGridProps {
  isDark: boolean
  visibleGrids: { active: boolean; laser: boolean; rooms: boolean }
  gridWidths: { active: number; laser: number; rooms: number }
  TOTAL_SLOTS: number
  TOTAL_LASER_ROOMS: number
  TOTAL_ROOMS: number
  timeSlots: TimeSlot[]
  rowHeight: number
  selectedDate: Date
  SLOT_DURATION: number
  obByTimeKey: Map<number, OBData>
  laserRooms: RoomLike[]
  branchRooms: RoomLike[]
  displayTextSize: string
  displayTextWeight: string
  dateString: string
  // Maps mémoïsées (stables) — les lookups O(1) sont définis dans le composant.
  // Passer les Maps plutôt que des fonctions garantit que React.memo re-rend
  // la grille quand les données changent (nouvelle Map) et la saute sinon.
  segmentIndexActive: Map<string, UISegment>
  segmentIndexLaser: Map<string, UISegment[]>
  getSegmentForCellRooms: (hour: number, minute: number, roomIndex: number) => UISegment | null
  openBookingModal: (hour?: number, minute?: number, booking?: BookingWithSlots, defaultType?: 'GAME' | 'EVENT', defaultGameArea?: 'ACTIVE' | 'LASER') => void
  isSlotBlocked: (dateStr: string, hour: number, minute: number) => boolean
  t: (key: string, params?: Record<string, string | number>) => string
}

function AgendaGridInner({
  isDark,
  visibleGrids,
  gridWidths,
  TOTAL_SLOTS,
  TOTAL_LASER_ROOMS,
  TOTAL_ROOMS,
  timeSlots,
  rowHeight,
  selectedDate,
  SLOT_DURATION,
  obByTimeKey,
  laserRooms,
  branchRooms,
  displayTextSize,
  displayTextWeight,
  dateString,
  segmentIndexActive,
  segmentIndexLaser,
  getSegmentForCellRooms,
  openBookingModal,
  isSlotBlocked,
  t,
}: AgendaGridProps) {
  // Lookups O(1) sur les Maps mémoïsées (équivalents aux anciens helpers de page.tsx)
  const getSegmentForCellSlots = (hour: number, minute: number, slotIndex: number): UISegment | null =>
    segmentIndexActive.get(`${hour}:${minute}:${slotIndex}`) || null
  const getSegmentsForCellLaser = (hour: number, minute: number, roomIndex: number): UISegment[] =>
    segmentIndexLaser.get(`${hour}:${minute}:${roomIndex}`) || []

  return (
          <div className="flex gap-0" style={{ width: '100%', minWidth: 0, overflowX: 'auto' }}>
            {/* GRID GAME - Heure + S1-S14 */}
            {visibleGrids.active && (
            <div style={{ flexGrow: gridWidths.active / 100, flexShrink: 1, flexBasis: `${gridWidths.active}%`, minWidth: `${Math.max(100, 80 + TOTAL_SLOTS * 30 * gridWidths.active / 100)}px`, borderRight: `2px solid ${isDark ? '#374151' : '#e5e7eb'}` }}>
              {/* En-tête GRID GAME */}
              <div className={`grid ${isDark ? '' : ''}`} style={{
                gridTemplateColumns: `80px repeat(${TOTAL_SLOTS}, minmax(30px, 1fr))`,
                borderBottom: `2px solid ${isDark ? '#374151' : '#e5e7eb'}`
              }}>
                <div className={`p-3 text-center font-medium ${isDark ? 'text-gray-400 bg-gray-900' : 'text-gray-600 bg-gray-50'}`}>
                  {t('admin.agenda.grid_headers.hour')}
                </div>
                {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                  <div key={`slot-${i}`} className={`p-3 text-center font-medium border-l ${isDark ? 'text-blue-400 bg-gray-900 border-gray-700' : 'text-blue-600 bg-gray-50 border-gray-200'}`}>
                    S{i + 1}
                  </div>
                ))}
              </div>

              {/* Corps GRID GAME */}
              <div className="grid" style={{
                gridTemplateColumns: `80px repeat(${TOTAL_SLOTS}, minmax(30px, 1fr))`,
                gridTemplateRows: `repeat(${timeSlots.length}, ${rowHeight}px)`,
                minWidth: 0
              }}>
            {/* Colonne Heure */}
            {timeSlots.map((slot, timeIndex) => {
              // Pour avoir des lignes visibles à 10:00, 10:30, 11:00, etc. (créneaux de 30 minutes)
              // La bordure borderBottom d'une case crée une ligne en bas de cette case
              // Donc pour avoir une ligne à 10:30, il faut une bordure sur la case 10:15 (qui précède)
              // Mais on veut aussi une ligne à 10:00, donc bordure sur la case 10:00
              // En fait, on veut des bordures sur les cases de 30 minutes (0 et 30) ET sur les cases de 15 minutes qui précèdent (pour créer la ligne)
              // Non, en fait : si on veut une ligne à 10:30, il faut une bordure sur la case 10:15 (qui est juste avant)
              // Mais on ne veut pas de ligne à 10:15, donc pas de bordure sur 10:00
              // Attendez, réfléchissons différemment :
              // - Case 10:00 → bordure en bas → ligne entre 10:00 et 10:15 (on veut cette ligne ? Non, on veut ligne à 10:30)
              // - Case 10:15 → bordure en bas → ligne entre 10:15 et 10:30 (on veut cette ligne ? Oui, c'est la ligne de 10:30)
              // - Case 10:30 → bordure en bas → ligne entre 10:30 et 10:45 (on veut cette ligne ? Non)
              // - Case 10:45 → bordure en bas → ligne entre 10:45 et 11:00 (on veut cette ligne ? Oui, c'est la ligne de 11:00)
              
              // Pour aligner avec les cellules : borderTop visible sur 0 et 30 dans les cellules
              // Donc on utilise borderTop sur les cases de 30 minutes (0 et 30) dans la colonne des heures
              const showBorder = (slot.minute === 0 || slot.minute === 30)
              
              return (
                <div
                  key={`time-${timeIndex}`}
                  onClick={() => openBookingModal(slot.hour, slot.minute, undefined, 'GAME', 'ACTIVE')}
                  className={`p-2 text-center text-sm cursor-pointer ${isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                  style={{ 
                    gridColumn: '1', 
                    gridRow: timeIndex + 1,
                    // Afficher borderTop sur les cases de 30 minutes pour aligner avec les cellules
                    // Appliquer la même épaisseur que les cellules (2px solid)
                    borderTop: showBorder ? `2px solid ${isDark ? '#374151' : '#e5e7eb'}` : 'none',
                    borderBottom: 'none',
                    borderLeft: 'none',
                    borderRight: `2px solid ${isDark ? '#374151' : '#e5e7eb'}` // Bordure droite pour séparer de la grille
                  }}
                >
                  {(slot.minute === 0 || slot.minute === 30) ? slot.label : ''}
                </div>
              )
            })}
            
            {/* Cellules pour les slots et salles */}
            {timeSlots.map((slot, timeIndex) => {
              return (
                <Fragment key={`row-${timeIndex}`}>
                  {/* Slots de jeu */}
                  {Array.from({ length: TOTAL_SLOTS }, (_, slotIndex) => {
                    const segment = getSegmentForCellSlots(slot.hour, slot.minute, slotIndex)
                    const booking = segment?.booking
                    
                    // Déterminer si cette cellule est le début d'un segment (top-left corner)
                    // Utiliser segmentId au lieu de booking.id
                    const isSegmentTop = segment && (
                      timeIndex === 0 ||
                      getSegmentForCellSlots(timeSlots[timeIndex - 1].hour, timeSlots[timeIndex - 1].minute, slotIndex)?.segmentId !== segment.segmentId
                    )
                    const isSegmentStart = segment && (
                      slotIndex === segment.slotStart || 
                      getSegmentForCellSlots(slot.hour, slot.minute, slotIndex - 1)?.segmentId !== segment.segmentId
                    )
                    const isSegmentEnd = segment && (
                      slotIndex === segment.slotEnd - 1 || 
                      getSegmentForCellSlots(slot.hour, slot.minute, slotIndex + 1)?.segmentId !== segment.segmentId
                    )
                    const isSegmentBottom = segment && (
                      timeIndex === timeSlots.length - 1 ||
                      getSegmentForCellSlots(timeSlots[timeIndex + 1].hour, timeSlots[timeIndex + 1].minute, slotIndex)?.segmentId !== segment.segmentId
                    )
                    
                    // Si cette cellule fait partie d'un segment mais n'est pas le début, ne pas la rendre
                    const isPartOfSegment = segment && !(isSegmentStart && isSegmentTop)
                    if (isPartOfSegment) return null

                    // Afficher les détails uniquement sur le premier segment du booking (premier segment continu)
                    // Vérifier si c'est le premier segment de ce booking (pas juste le premier segment de 15 min)
                    const isFirstSegmentOfBooking = segment && (
                      timeIndex === 0 || 
                      getSegmentForCellSlots(timeSlots[timeIndex - 1].hour, timeSlots[timeIndex - 1].minute, slotIndex)?.bookingId !== segment.bookingId
                    )
                    const showDetails = segment && isSegmentStart && isSegmentTop && isFirstSegmentOfBooking
                    
                    const gridColumn = slotIndex + 2 // +2 car colonne 1 = Heure
                    const gridRow = timeIndex + 1
                    
                    // Calculer les spans pour les segments
                    let colSpan = 1
                    let rowSpan = 1
                    if (segment) {
                      // colSpan basé sur le nombre de slots du segment
                      colSpan = segment.slotEnd - segment.slotStart
                      
                      // rowSpan basé sur la durée du segment (pas du booking global)
                      const segmentStartMinutes = segment.start.getHours() * 60 + segment.start.getMinutes()
                      const segmentEndMinutes = segment.end.getHours() * 60 + segment.end.getMinutes()
                      const durationMinutes = segmentEndMinutes - segmentStartMinutes
                      rowSpan = Math.ceil(durationMinutes / 15) // Cases de 15 minutes
                    }
                    
                    // Vérifier les segments adjacents pour les bordures de quadrillage
                    const leftSegment = slotIndex > 0 ? getSegmentForCellSlots(slot.hour, slot.minute, slotIndex - 1) : null
                    const rightSegment = slotIndex < TOTAL_SLOTS - 1 ? getSegmentForCellSlots(slot.hour, slot.minute, slotIndex + 1) : null
                    const topSegment = timeIndex > 0 ? getSegmentForCellSlots(timeSlots[timeIndex - 1].hour, timeSlots[timeIndex - 1].minute, slotIndex) : null
                    
                    const isDifferentBookingLeft = segment && leftSegment && segment.bookingId !== leftSegment.bookingId
                    const isDifferentBookingRight = segment && rightSegment && segment.bookingId !== rightSegment.bookingId
                    const isDifferentBookingTop = segment && topSegment && segment.bookingId !== topSegment.bookingId
                    const isEmptyLeft = !segment && leftSegment
                    const isEmptyRight = !segment && rightSegment
                    
                    // Bordures verticales : TOUJOURS afficher le quadrillage entre slots
                    // Si c'est une réservation, utiliser gris pour le contour, sinon gris du quadrillage
                    const borderLeftColor = booking 
                      ? (isDark ? '#6b7280' : '#9ca3af') // Gris pour contour réservation
                      : (slotIndex === 0 ? 'none' : (isDark ? '#374151' : '#e5e7eb')) // Quadrillage (pas de bordure à gauche du premier slot)
                    const borderRightColor = booking
                      ? (isDark ? '#6b7280' : '#9ca3af') // Gris pour contour réservation
                      : (slotIndex === TOTAL_SLOTS - 1 ? 'none' : (isDark ? '#374151' : '#e5e7eb')) // Quadrillage (pas de bordure à droite du dernier slot)
                    
                    // Pour les réservations fusionnées, ne pas afficher les bordures internes
                    const showLeftBorder = !booking || slotIndex === segment.slotStart || isDifferentBookingLeft
                    const showRightBorder = !booking || slotIndex === segment.slotEnd - 1 || isDifferentBookingRight
                    
                    // Bordures horizontales : quadrillage toutes les 15 min
                    const shouldShowTopBorder = true
                    const borderTopColor = isDifferentBookingTop 
                      ? (isDark ? '#374151' : '#e5e7eb')
                      : (booking ? (isDark ? '#6b7280' : '#9ca3af') : (isDark ? '#374151' : '#e5e7eb')) // Gris pour contour réservation
                    
                    // Formater l'heure pour l'affichage
                    const bookingStartTime = booking ? toIL(new Date(booking.game_start_datetime || booking.start_datetime)) : null
                    const displayTime = bookingStartTime ? formatTime(bookingStartTime) : ''

                    // Vérifier que colSpan ne dépasse jamais TOTAL_SLOTS (hard boundary)
                    if (segment && gridColumn + colSpan > TOTAL_SLOTS + 2) {
                      colSpan = TOTAL_SLOTS + 2 - gridColumn
                    }

                    // Vérifier si c'est la dernière cellule verticale de la réservation
                    const bottomSegment = timeIndex < timeSlots.length - 1 ? getSegmentForCellSlots(timeSlots[timeIndex + 1].hour, timeSlots[timeIndex + 1].minute, slotIndex) : null
                    const isDifferentBookingBottom = segment && bottomSegment && segment.bookingId !== bottomSegment.bookingId
                    const isBookingBottom = booking && (timeIndex === timeSlots.length - 1 || isDifferentBookingBottom)
                    const borderBottomColor = isBookingBottom ? (isDark ? '#6b7280' : '#9ca3af') : 'none' // Gris pour contour réservation

                    const isActiveSlotBlocked = !booking && isSlotBlocked(dateString, slot.hour, slot.minute)

                    return (
                      <div
                        key={`cell-slot-${timeIndex}-${slotIndex}`}
                        onClick={() => booking ? openBookingModal(slot.hour, slot.minute, booking) : openBookingModal(slot.hour, slot.minute, undefined, 'GAME')}
                        className={`relative ${
                          booking
                            ? `cursor-pointer flex items-center justify-center p-2 text-center`
                            : isActiveSlotBlocked
                              ? 'cursor-not-allowed p-2 bg-transparent'
                              : `cursor-pointer p-2 ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors bg-transparent`
                        }`}
                        style={{
                          gridColumn: booking ? `${gridColumn} / ${gridColumn + colSpan}` : gridColumn,
                          gridRow: booking ? `${gridRow} / ${gridRow + rowSpan}` : gridRow,
                          ...(booking && { backgroundColor: booking.color || (booking.type === 'EVENT' ? '#22c55e' : '#3b82f6') }),
                          // Quadrillage complet + contour gris pour les réservations
                          borderTop: shouldShowTopBorder ? `2px solid ${borderTopColor}` : 'none',
                          borderBottom: borderBottomColor !== 'none' ? `2px solid ${borderBottomColor}` : 'none',
                          borderLeft: showLeftBorder && borderLeftColor !== 'none' ? `2px solid ${borderLeftColor}` : 'none',
                          borderRight: showRightBorder && borderRightColor !== 'none' ? `2px solid ${borderRightColor}` : 'none',
                        }}
                        title={booking ? (() => {
                          const contactData = getContactDisplayData(booking)
                          return `${contactData.firstName} ${contactData.lastName || ''}`.trim() || t('admin.agenda.booking.no_name')
                        })() + ` - ${booking.participants_count} ${t('admin.agenda.booking.people')}` : isActiveSlotBlocked ? t('admin.blocked_periods.slot_blocked_tooltip') : ''}
                      >
                        {/* Overlay créneau bloqué */}
                        {isActiveSlotBlocked && (
                          <div className="absolute inset-0 pointer-events-none" style={{
                            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, ${isDark ? 'rgba(156,163,175,0.25)' : 'rgba(156,163,175,0.35)'} 4px, ${isDark ? 'rgba(156,163,175,0.25)' : 'rgba(156,163,175,0.35)'} 8px)`
                          }} />
                        )}
                        {/* Badge OB supprimé - la colonne OB est la source de vérité */}
                        {booking && showDetails && (
                          <div className={`${getTextSizeClass(displayTextSize)} ${getTextWeightClass(displayTextWeight)} leading-tight ${isDark ? 'text-white' : 'text-white'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                            {(() => {
                              const contactData = getContactDisplayData(booking)
                              const name = contactData.firstName || t('admin.agenda.booking.no_name')
                              return `${name}-${booking.participants_count}`
                            })()}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </Fragment>
              )
            })}
              </div>
            </div>
            )}

            {/* GRID OB - 1 colonne métrique (affiché avec ACTIVE) */}
            {visibleGrids.active && (
            <div style={{ flex: '0 0 80px', borderRight: `2px solid ${isDark ? '#374151' : '#e5e7eb'}` }}>
              {/* En-tête GRID OB */}
              <div className={`grid ${isDark ? '' : ''}`} style={{
                gridTemplateColumns: `1fr`,
                borderBottom: `2px solid ${isDark ? '#374151' : '#e5e7eb'}`
              }}>
                <div className={`p-3 text-center font-medium ${isDark ? 'text-yellow-400 bg-gray-900' : 'text-yellow-600 bg-gray-50'}`}>
                  OB
                </div>
              </div>

              {/* Corps GRID OB - Métrique pure, jamais de getSegmentForCell */}
              <div className="grid" style={{
                gridTemplateColumns: `1fr`,
                gridTemplateRows: `repeat(${timeSlots.length}, ${rowHeight}px)`,
              }}>
                {timeSlots.map((slot, timeIndex) => {
                  // Convertir slot en Date pour calculer timeKey
                  const slotDate = new Date(selectedDate)
                  slotDate.setHours(slot.hour, slot.minute, 0, 0)
                  
                  // Lookup OB pour cette tranche (O(1))
                  const timeKey = Math.floor(slotDate.getTime() / (SLOT_DURATION * 60 * 1000)) * (SLOT_DURATION * 60 * 1000)
                  const obData = obByTimeKey.get(timeKey)
                  
                  // OB : afficher les lignes toutes les 15 min (comme les slots)
                  // IMPORTANT : Utiliser exactement la même structure que les cellules des slots pour un alignement parfait
                  const showBorder = true // Toujours afficher les lignes pour OB (quadrillage en 15 min)
                  
                  return (
                    <div
                      key={`ob-${timeIndex}`}
                      className={`p-2 flex items-center justify-center text-center text-sm font-bold ${
                        obData && obData.totalParticipants > 0
                          ? obData.isOverbooked
                            ? 'text-red-500'
                            : 'text-blue-500'
                          : isDark ? 'text-gray-600' : 'text-gray-300'
                      }`}
                      style={{
                        gridRow: timeIndex + 1,
                        // Afficher toutes les lignes de 15 min comme les slots
                        borderTop: showBorder ? `2px solid ${isDark ? '#374151' : '#e5e7eb'}` : 'none',
                        borderBottom: 'none',
                        borderLeft: 'none',
                        borderRight: `2px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                      }}
                    >
                      {obData && obData.totalParticipants > 0 && (
                        <span className="text-xs font-bold">
                          {obData.isOverbooked ? (
                            `${obData.slotsOver}/${obData.totalParticipants}P`
                          ) : (
                            `${obData.totalSlotsUsed}/${obData.totalParticipants}P`
                          )}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            )}

            {/* GRID LASER - Avec colonne Heure à droite */}
            {visibleGrids.laser && laserRooms.length > 0 && (
              <div style={{ flexGrow: gridWidths.laser / 100, flexShrink: 1, flexBasis: `${gridWidths.laser}%`, minWidth: `${Math.max(100, 80 + TOTAL_LASER_ROOMS * 30 * gridWidths.laser / 100)}px`, borderRight: `2px solid ${isDark ? '#374151' : '#e5e7eb'}` }}>
                {/* En-tête GRID LASER */}
                <div className={`grid ${isDark ? '' : ''}`} style={{
                  gridTemplateColumns: `repeat(${TOTAL_LASER_ROOMS}, minmax(30px, 1fr))`,
                  borderBottom: `2px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                  minWidth: 0
                }}>
                  {laserRooms
                    .filter(r => r.is_active)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((room, i) => {
                      const roomName = room.name || `L${i + 1}`
                      return (
                        <div key={`laser-room-${room.id}`} className={`p-3 text-center font-medium ${isDark ? 'text-purple-400 bg-gray-900 border-gray-700' : 'text-purple-600 bg-gray-50 border-gray-200'} ${i > 0 ? 'border-l' : ''}`}>
                          {roomName}
                        </div>
                      )
                    })}
                </div>

                {/* Corps GRID LASER */}
                <div className="grid" style={{
                  gridTemplateColumns: `repeat(${TOTAL_LASER_ROOMS}, minmax(30px, 1fr))`,
                  gridTemplateRows: `repeat(${timeSlots.length}, ${rowHeight}px)`,
                  minWidth: 0
                }}>
                  {/* Laser rooms - Afficher toutes les cases de 15 min comme les salles */}
                  {timeSlots.map((slot, timeIndex) => {
                    return (
                      <Fragment key={`laser-row-${timeIndex}`}>
                        {laserRooms
                          .filter(r => r.is_active)
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((room, roomIndex) => {
                            // Obtenir TOUS les segments qui chevauchent ce créneau
                            const allSegments = getSegmentsForCellLaser(slot.hour, slot.minute, roomIndex)
                            
                            // Filtrer pour ne garder que les segments qui commencent à ce créneau (isSegmentTop)
                            // ET qui commencent à cette salle (isSegmentStart)
                            const segmentsToDisplay = allSegments.filter(segment => {
                              // Vérifier début vertical (isSegmentTop)
                              const isSegmentTop = timeIndex === 0 || 
                                !getSegmentsForCellLaser(
                                  timeSlots[timeIndex - 1].hour, 
                                  timeSlots[timeIndex - 1].minute, 
                                  roomIndex
                                ).find(ps => ps.segmentId === segment.segmentId)
                              
                              // Vérifier début horizontal (isSegmentStart)
                              const isSegmentStart = segment.slotStart === roomIndex
                              
                              // Afficher seulement si c'est le coin top-left du segment
                              return isSegmentTop && isSegmentStart
                            })
                            
                            const gridColumn = roomIndex + 1
                            const gridRow = timeIndex + 1
                            const shouldShowTopBorder = (slot.minute === 0 || slot.minute === 30)
                            const grayBorderColor = isDark ? '#6b7280' : '#9ca3af'
                            
                            // Vérifier si cette cellule est à l'intérieur d'une réservation (pas le début)
                            const isInsideReservation = allSegments.length > 0 && segmentsToDisplay.length === 0
                            
                            // Cellule vide (aucun segment à afficher)
                            if (segmentsToDisplay.length === 0) {
                              // Vérifier si cette cellule est couverte par un segment fusionné horizontalement
                              // (le segment commence à gauche et s'étend jusqu'ici)
                              const isCoveredByFusedSegment = allSegments.some(seg => 
                                seg.slotStart < roomIndex && seg.slotEnd > roomIndex
                              )
                              
                              // Ne pas afficher les cellules couvertes par un segment fusionné
                              if (isCoveredByFusedSegment || isInsideReservation) {
                                return null
                              }
                              
                              const isLaserSlotBlocked = isSlotBlocked(dateString, slot.hour, slot.minute)

                              return (
                                <div
                                  key={`laser-cell-${timeIndex}-${roomIndex}`}
                                  onClick={() => openBookingModal(slot.hour, slot.minute, undefined, 'GAME', 'LASER')}
                                  className={`relative p-2 ${isLaserSlotBlocked ? 'cursor-not-allowed' : `cursor-pointer ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`} bg-transparent`}
                                  style={{
                                    gridColumn,
                                    gridRow,
                                    // Ne pas afficher borderTop si on est à l'intérieur d'une réservation
                                    borderTop: shouldShowTopBorder ? `2px solid ${isDark ? '#374151' : '#e5e7eb'}` : 'none',
                                    borderBottom: 'none',
                                    borderLeft: `2px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                                    borderRight: `2px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                                  }}
                                  title={isLaserSlotBlocked ? t('admin.blocked_periods.slot_blocked_tooltip') : ''}
                                >
                                  {isLaserSlotBlocked && (
                                    <div className="absolute inset-0 pointer-events-none" style={{
                                      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, ${isDark ? 'rgba(156,163,175,0.25)' : 'rgba(156,163,175,0.35)'} 4px, ${isDark ? 'rgba(156,163,175,0.25)' : 'rgba(156,163,175,0.35)'} 8px)`
                                    }} />
                                  )}
                                </div>
                              )
                            }

                            
                            // Si des segments doivent être affichés
                            if (segmentsToDisplay.length > 0) {
                              // Calculer le rowSpan et colSpan max (tous les segments partagent les mêmes)
                              const firstSegment = segmentsToDisplay[0]
                              const segmentStartMinutes = firstSegment.start.getHours() * 60 + firstSegment.start.getMinutes()
                              const segmentEndMinutes = firstSegment.end.getHours() * 60 + firstSegment.end.getMinutes()
                              const durationMinutes = segmentEndMinutes - segmentStartMinutes
                              const rowSpan = Math.ceil(durationMinutes / 15)
                              const colSpan = firstSegment.slotEnd - firstSegment.slotStart
                              
                              // Conteneur qui occupe les cellules fusionnées
                              return (
                                <div
                                  key={`laser-cell-${timeIndex}-${roomIndex}`}
                                  className="relative flex"
                                  style={{
                                    gridColumn: colSpan > 1 ? `${gridColumn} / span ${colSpan}` : gridColumn,
                                    gridRow: rowSpan > 1 ? `${gridRow} / span ${rowSpan}` : gridRow,
                                    backgroundColor: 'transparent',
                                  }}
                                >
                                  {/* Afficher chaque segment côte à côte */}
                                  {segmentsToDisplay.map((segment, segmentIndex) => {
                                    const booking = segment.booking
                                    const bookingColor = booking.color || '#a855f7'
                                    const segmentWidth = `calc(100% / ${segmentsToDisplay.length})`
                                    
                                    return (
                                      <div
                                        key={`laser-segment-${segment.segmentId}`}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          openBookingModal(slot.hour, slot.minute, booking)
                                        }}
                                        className="cursor-pointer flex flex-col items-center justify-center text-center p-1"
                                        style={{
                                          width: segmentWidth,
                                          height: '100%',
                                          backgroundColor: bookingColor,
                                          border: `2px solid ${grayBorderColor}`,
                                          borderRight: segmentIndex < segmentsToDisplay.length - 1 ? `1px solid ${isDark ? '#1f2937' : '#f3f4f6'}` : `2px solid ${grayBorderColor}`,
                                        }}
                                        title={(() => {
                                          const contactData = getContactDisplayData(booking)
                                          return `${contactData.firstName} ${contactData.lastName || ''}`.trim() || t('admin.agenda.booking.no_name')
                                        })() + ` - ${booking.participants_count} ${t('admin.agenda.booking.people')}`}
                                      >
                                        <div 
                                          className={`${getTextSizeClass(displayTextSize)} ${getTextWeightClass(displayTextWeight)} leading-tight text-white whitespace-nowrap overflow-hidden text-ellipsis px-1`}
                                          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                                        >
                                          {(() => {
                                            const contactData = getContactDisplayData(booking)
                                            const name = contactData.firstName || t('admin.agenda.booking.no_name')
                                            return `${name}-${booking.participants_count}`
                                          })()}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            }
                          })}
                      </Fragment>
                    )
                  })}
                </div>
              </div>
            )}

            {/* GRID ROOMS - Heure + Room A-D */}
            {visibleGrids.rooms && (
            <div style={{ flexGrow: gridWidths.rooms / 100, flexShrink: 1, flexBasis: `${gridWidths.rooms}%`, minWidth: `${Math.max(100, 80 + TOTAL_ROOMS * 100 * gridWidths.rooms / 100)}px` }}>
              {/* En-tête GRID ROOMS */}
              <div className={`grid ${isDark ? '' : ''}`} style={{
                gridTemplateColumns: `80px repeat(${TOTAL_ROOMS}, minmax(100px, 1fr))`,
                borderBottom: `2px solid ${isDark ? '#374151' : '#e5e7eb'}`
              }}>
                <div className={`p-3 text-center font-medium ${isDark ? 'text-gray-400 bg-gray-900' : 'text-gray-600 bg-gray-50'}`}>
                  {t('admin.agenda.grid_headers.hour')}
                </div>
                {branchRooms
                  .filter(r => r.is_active)
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((room, i) => {
                    const roomName = room.name || `${t('admin.agenda.grid_headers.room')} ${i + 1}`
                    return (
                      <div key={`room-${room.id}`} className={`p-3 text-center font-medium border-l ${isDark ? 'text-green-400 bg-gray-900 border-gray-700' : 'text-green-600 bg-gray-50 border-gray-200'}`}>
                        {roomName}
                      </div>
                    )
                  })}
              </div>

              {/* Corps GRID ROOMS */}
              <div className="grid" style={{
                gridTemplateColumns: `80px repeat(${TOTAL_ROOMS}, minmax(100px, 1fr))`,
                gridTemplateRows: `repeat(${timeSlots.length}, ${rowHeight}px)`,
              }}>
                {/* Colonne Heure pour ROOMS */}
                {timeSlots.map((slot, timeIndex) => {
                  // SALLES : lignes seulement à 0 et 30 (comme OB avant)
                  const showBorder = (slot.minute === 0 || slot.minute === 30)
                  return (
                    <div
                      key={`time-room-${timeIndex}`}
                      onClick={() => openBookingModal(slot.hour, slot.minute, undefined, 'GAME', 'LASER')}
                      className={`p-2 text-center text-sm cursor-pointer ${isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                      style={{
                        gridColumn: '1',
                        gridRow: timeIndex + 1,
                        borderTop: showBorder ? `2px solid ${isDark ? '#374151' : '#e5e7eb'}` : 'none',
                        borderRight: `2px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                      }}
                    >
                      {(slot.minute === 0 || slot.minute === 30) ? slot.label : ''}
                    </div>
                  )
                })}
                
                {/* Salles d'événements */}
                {timeSlots.map((slot, timeIndex) => {
                  return (
                    <Fragment key={`row-room-${timeIndex}`}>
                      {branchRooms
                        .filter(r => r.is_active)
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((room, roomIndex) => {
                        const segment = getSegmentForCellRooms(slot.hour, slot.minute, roomIndex)
                    const booking = segment?.booking
                    
                    // RÈGLE BÉTON : Rooms = uniquement EVENT
                    if (booking && booking.type !== 'EVENT') return null
                    
                    // Déterminer si cette cellule est le début d'un segment (top-left corner)
                    // Utiliser segmentId au lieu de booking.id
                        const isSegmentTop = segment && (
                          timeIndex === 0 ||
                          getSegmentForCellRooms(timeSlots[timeIndex - 1].hour, timeSlots[timeIndex - 1].minute, roomIndex)?.segmentId !== segment.segmentId
                        )
                        const isSegmentStart = segment && (
                          roomIndex === 0 || 
                          getSegmentForCellRooms(slot.hour, slot.minute, roomIndex - 1)?.segmentId !== segment.segmentId
                        )
                        const isSegmentEnd = segment && (
                          roomIndex === TOTAL_ROOMS - 1 || 
                          getSegmentForCellRooms(slot.hour, slot.minute, roomIndex + 1)?.segmentId !== segment.segmentId
                        )
                        const isSegmentBottom = segment && (
                          timeIndex === timeSlots.length - 1 ||
                          getSegmentForCellRooms(timeSlots[timeIndex + 1].hour, timeSlots[timeIndex + 1].minute, roomIndex)?.segmentId !== segment.segmentId
                        )
                    
                        // Si cette cellule fait partie d'un segment mais n'est pas le début, ne pas la rendre
                        const isPartOfSegment = segment && !(isSegmentStart && isSegmentTop)
                        if (isPartOfSegment) return null
                        
                        const gridColumn = roomIndex + 2 // +2 car colonne 1 = Heure
                        const gridRow = timeIndex + 1
                    
                    // Calculer les spans pour les segments
                    let colSpan = 1
                    let rowSpan = 1
                    if (segment) {
                      colSpan = segment.slotEnd - segment.slotStart // Pour les rooms, c'est toujours 1
                      
                      // rowSpan basé sur la durée du segment (pas du booking global)
                      const segmentStartMinutes = segment.start.getHours() * 60 + segment.start.getMinutes()
                      const segmentEndMinutes = segment.end.getHours() * 60 + segment.end.getMinutes()
                      const durationMinutes = segmentEndMinutes - segmentStartMinutes
                      rowSpan = Math.ceil(durationMinutes / 15) // Cases de 15 minutes
                    }
                    
                    // Vérifier les segments adjacents pour les bordures de quadrillage
                    const leftSegment = roomIndex > 0 ? getSegmentForCellRooms(slot.hour, slot.minute, roomIndex - 1) : null
                    const rightSegment = roomIndex < TOTAL_ROOMS - 1 ? getSegmentForCellRooms(slot.hour, slot.minute, roomIndex + 1) : null
                    const topSegment = timeIndex > 0 ? getSegmentForCellRooms(timeSlots[timeIndex - 1].hour, timeSlots[timeIndex - 1].minute, roomIndex) : null
                    const bottomSegment = timeIndex < timeSlots.length - 1 ? getSegmentForCellRooms(timeSlots[timeIndex + 1].hour, timeSlots[timeIndex + 1].minute, roomIndex) : null
                    
                    const isDifferentBookingLeft = segment && leftSegment && segment.bookingId !== leftSegment.bookingId
                    const isDifferentBookingRight = segment && rightSegment && segment.bookingId !== rightSegment.bookingId
                    const isDifferentBookingTop = segment && topSegment && segment.bookingId !== topSegment.bookingId
                    const isDifferentBookingBottom = segment && bottomSegment && segment.bookingId !== bottomSegment.bookingId
                    
                    // Bordures verticales : TOUJOURS afficher le quadrillage entre salles
                    // Si c'est une réservation, utiliser gris pour le contour, sinon gris du quadrillage
                    const borderLeftColor = booking
                      ? (isDark ? '#6b7280' : '#9ca3af') // Gris pour contour réservation
                      : (roomIndex === 0 ? 'none' : (isDark ? '#374151' : '#e5e7eb')) // Quadrillage (pas de bordure à gauche de la première salle)
                    const borderRightColor = booking
                      ? (isDark ? '#6b7280' : '#9ca3af') // Gris pour contour réservation
                      : (roomIndex === TOTAL_ROOMS - 1 ? 'none' : (isDark ? '#374151' : '#e5e7eb')) // Quadrillage (pas de bordure à droite de la dernière salle)
                    
                    // Pour les réservations, afficher les bordures sur les bords extérieurs
                    const showLeftBorder = !booking || roomIndex === 0 || isDifferentBookingLeft
                    const showRightBorder = !booking || roomIndex === TOTAL_ROOMS - 1 || isDifferentBookingRight
                    
                    // Bordures horizontales : SALLES - lignes SEULEMENT à 0 et 30 (comme OB avant)
                    const shouldShowTopBorder = (slot.minute === 0 || slot.minute === 30)
                    const borderTopColor = shouldShowTopBorder 
                      ? (isDifferentBookingTop ? (isDark ? '#374151' : '#e5e7eb') : (booking ? (isDark ? '#6b7280' : '#9ca3af') : (isDark ? '#374151' : '#e5e7eb'))) // Gris pour contour réservation
                      : 'none'
                    
                    // Bordure du bas : uniquement pour la dernière cellule de la réservation
                    const isBookingBottom = booking && (timeIndex === timeSlots.length - 1 || isDifferentBookingBottom)
                    const borderBottomColor = isBookingBottom ? (isDark ? '#6b7280' : '#9ca3af') : 'none' // Gris pour contour réservation
                    
                    // Formater l'heure pour l'affichage
                    const roomBookingStartTime = booking ? toIL(new Date(booking.start_datetime)) : null
                    const roomDisplayTime = roomBookingStartTime ? formatTime(roomBookingStartTime) : ''

                    const isRoomSlotBlocked = !booking && isSlotBlocked(dateString, slot.hour, slot.minute)

                    return (
                      <div
                        key={`cell-room-${timeIndex}-${roomIndex}`}
                        onClick={() => booking ? openBookingModal(slot.hour, slot.minute, booking) : openBookingModal(slot.hour, slot.minute, undefined, 'EVENT')}
                        className={`relative ${
                          booking
                            ? `cursor-pointer flex flex-col items-center justify-center p-1 text-center`
                            : isRoomSlotBlocked
                              ? 'cursor-not-allowed p-1 bg-transparent'
                              : `cursor-pointer p-1 ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors bg-transparent`
                        }`}
                        style={{
                          gridColumn: segment ? `${gridColumn} / ${gridColumn + colSpan}` : gridColumn,
                          gridRow: segment ? `${gridRow} / ${gridRow + rowSpan}` : gridRow,
                          ...(segment && booking && { backgroundColor: booking.color || '#22c55e' }),
                          // Quadrillage complet + contour gris pour les réservations
                          borderTop: borderTopColor !== 'none' ? `2px solid ${borderTopColor}` : 'none',
                          borderBottom: borderBottomColor !== 'none' ? `2px solid ${borderBottomColor}` : 'none',
                          borderLeft: showLeftBorder && borderLeftColor !== 'none' ? `2px solid ${borderLeftColor}` : 'none',
                          borderRight: showRightBorder && borderRightColor !== 'none' ? `2px solid ${borderRightColor}` : 'none',
                        }}
                        title={booking ? (() => {
                          const contactData = getContactDisplayData(booking)
                          return `${contactData.firstName} ${contactData.lastName || ''}`.trim() || t('admin.agenda.booking.no_name')
                        })() + ` - ${booking.participants_count} ${t('admin.agenda.booking.people')}` : isRoomSlotBlocked ? t('admin.blocked_periods.slot_blocked_tooltip') : ''}
                      >
                        {/* Overlay créneau bloqué */}
                        {isRoomSlotBlocked && (
                          <div className="absolute inset-0 pointer-events-none" style={{
                            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, ${isDark ? 'rgba(156,163,175,0.25)' : 'rgba(156,163,175,0.35)'} 4px, ${isDark ? 'rgba(156,163,175,0.25)' : 'rgba(156,163,175,0.35)'} 8px)`
                          }} />
                        )}
                        {booking && (
                          <>
                            <div className={`${getTextSizeClass(displayTextSize)} ${getTextWeightClass(displayTextWeight)} leading-tight ${isDark ? 'text-white' : 'text-white'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                              {(() => {
                                const contactData = getContactDisplayData(booking)
                                return contactData.firstName || t('admin.agenda.booking.no_name')
                              })()}
                            </div>
                            <div className={`${getTextSizeClass(displayTextSize)} ${getTextWeightClass(displayTextWeight)} leading-tight ${isDark ? 'text-white/95' : 'text-white/95'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                              {booking.participants_count} {t('admin.agenda.booking.people')}
                            </div>
                            <div className={`${getTextSizeClass(displayTextSize)} ${getTextWeightClass(displayTextWeight)} leading-tight ${isDark ? 'text-white/90' : 'text-white/90'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                              {roomDisplayTime}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </Fragment>
              )
            })}
              </div>
            </div>
            )}
          </div>

  )
}

export const AgendaGrid = memo(AgendaGridInner)
