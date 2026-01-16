'use client'

import { useState, useEffect, Fragment } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Plus, LogOut, User, ChevronDown, Sun, Moon, ChevronLeft, ChevronRight, Calendar, Users, PartyPopper, Gamepad2, Search, Trash2, Settings, Sliders } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useBookings, type BookingWithSlots, type CreateBookingData } from '@/hooks/useBookings'
import { BookingModal } from './components/BookingModal'
import { AdminHeader } from './components/AdminHeader'
import { ConfirmationModal } from './components/ConfirmationModal'
import { SettingsModal } from './components/SettingsModal'
import { useBranches } from '@/hooks/useBranches'
import { useAuth } from '@/hooks/useAuth'
import { useLaserRooms } from '@/hooks/useLaserRooms'
import type { Profile, UserBranch, GameArea, GameSession } from '@/lib/supabase/types'

type Theme = 'light' | 'dark'

interface UserData {
  id: string
  email: string
  profile: { id: string; role: string; full_name: string | null } | null
  branches: Array<{ id: string; name: string; slug: string }>
  role: string
}

export default function AdminPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<UserData | null>(null)
  // Utiliser useBranches pour partager la branche sélectionnée avec le CRM
  const branchesHook = useBranches()
  const selectedBranchId = branchesHook.selectedBranchId
  const setSelectedBranchId = (branchId: string | null) => {
    if (branchId) {
      branchesHook.selectBranch(branchId)
    }
  }
  const [theme, setTheme] = useState<Theme>('light')
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Lundi
    const monday = new Date(today)
    monday.setDate(diff)
    monday.setHours(0, 0, 0, 0)
    return monday
  })
  const [showBranchMenu, setShowBranchMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [modalInitialHour, setModalInitialHour] = useState(10)
  const [modalInitialMinute, setModalInitialMinute] = useState(0)
  const [modalDefaultBookingType, setModalDefaultBookingType] = useState<'GAME' | 'EVENT'>('GAME')
  const [modalDefaultGameArea, setModalDefaultGameArea] = useState<'ACTIVE' | 'LASER'>('ACTIVE')
  const [editingBooking, setEditingBooking] = useState<BookingWithSlots | null>(null)
  const [agendaSearchQuery, setAgendaSearchQuery] = useState('')
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  
  // Paramètres d'affichage du texte (chargés depuis localStorage)
  const [displayTextSize, setDisplayTextSize] = useState<'xs' | 'sm' | 'base' | 'lg'>('sm')
  const [displayTextWeight, setDisplayTextWeight] = useState<'normal' | 'semibold' | 'bold'>('bold')
  const [displayTextAlign, setDisplayTextAlign] = useState<'left' | 'center' | 'right'>('left')
  
  // État pour gérer la visibilité des grilles
  const [visibleGrids, setVisibleGrids] = useState({
    active: true,
    laser: true,
    rooms: true
  })
  
  // État pour gérer les dimensions des grilles
  const [showGridSettingsModal, setShowGridSettingsModal] = useState(false)
  const [showBranchSettingsModal, setShowBranchSettingsModal] = useState(false)
  const [gridWidths, setGridWidths] = useState({
    active: 100,  // Pourcentage par défaut
    laser: 100,
    rooms: 100
  })
  const [rowHeight, setRowHeight] = useState(20) // Hauteur des lignes en px (défaut 20px)
  
  // Modal de confirmation
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type?: 'warning' | 'info' | 'success'
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {},
  })

  // Charger les paramètres d'affichage depuis localStorage (doit être avant les autres hooks)
  useEffect(() => {
    if (selectedBranchId) {
      const storageKey = `displaySettings_${selectedBranchId}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.textSize) setDisplayTextSize(parsed.textSize)
          if (parsed.textWeight) setDisplayTextWeight(parsed.textWeight)
          if (parsed.textAlign) setDisplayTextAlign(parsed.textAlign)
        } catch (e) {
          console.error('Error loading display settings:', e)
        }
      }
      
      // Charger les paramètres de grille
      const gridStorageKey = `gridSettings_${selectedBranchId}`
      const savedGrid = localStorage.getItem(gridStorageKey)
      if (savedGrid) {
        try {
          const parsed = JSON.parse(savedGrid)
          if (parsed.gridWidths) setGridWidths(parsed.gridWidths)
          if (parsed.rowHeight) setRowHeight(parsed.rowHeight)
        } catch (e) {
          console.error('Error loading grid settings:', e)
        }
      }
    }
  }, [selectedBranchId])

  // Fonction utilitaire pour formater une date en YYYY-MM-DD (sans conversion UTC)
  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Fonction utilitaire pour extraire la date locale d'une date ISO (sans conversion UTC)
  const extractLocalDateFromISO = (isoString: string): string => {
    const date = new Date(isoString)
    return formatDateToString(date)
  }

  // Format de date pour l'API (format simple YYYY-MM-DD, sans UTC)
  const dateString = formatDateToString(selectedDate)

  // Hook pour TOUTES les réservations (utilisé pour l'agenda ET les statistiques)
  // On charge tout et on filtre côté client pour éviter les problèmes de synchronisation
  const {
    bookings: allBookings,
    loading: bookingsLoading,
    error: bookingsError,
    createBooking,
    updateBooking,
    deleteBooking,
    deleteAllBookings,
    refresh: refreshAllBookings
  } = useBookings(selectedBranchId, undefined) // undefined = pas de filtre par date, on charge tout

  // Utiliser les branches du hook principal (déjà appelé plus haut)
  const branches = branchesHook.branches
  const refreshBranches = branchesHook.refresh

  // Filtrer les réservations pour l'agenda du jour sélectionné
  // IMPORTANT : Pour les réservations LASER, vérifier aussi les dates des game_sessions LASER
  // car un EVENT peut avoir une salle à une date mais des sessions LASER à une autre date
  const dateStr = formatDateToString(selectedDate)
  const bookings = allBookings.filter(b => {
    // Vérifier d'abord la date du booking (start_datetime)
    const bookingDate = extractLocalDateFromISO(b.start_datetime)
    if (bookingDate === dateStr) return true
    
    // Si le booking a des game_sessions LASER, vérifier si une session LASER est sur cette date
    if (b.game_sessions && b.game_sessions.length > 0) {
      const hasLaserSessionOnDate = b.game_sessions.some(session => {
        if (session.game_area !== 'LASER') return false
        const sessionDate = extractLocalDateFromISO(session.start_datetime)
        return sessionDate === dateStr
      })
      if (hasLaserSessionOnDate) return true
    }
    
    // Sinon, ne pas inclure cette réservation pour cette date
    return false
  })

  // CRM: Gérer les query params pour deep-link vers une réservation
  useEffect(() => {
    const bookingId = searchParams?.get('booking')
    const dateParam = searchParams?.get('date')
    
    if (bookingId && allBookings.length > 0) {
      // Trouver la réservation
      const booking = allBookings.find(b => b.id === bookingId)
      
      if (booking) {
        // Si une date est fournie, naviguer vers cette date
        if (dateParam) {
          const targetDate = new Date(dateParam)
          setSelectedDate(targetDate)
        } else {
          // Sinon, utiliser la date de la réservation
          const bookingDate = extractLocalDateFromISO(booking.start_datetime)
          const targetDate = new Date(bookingDate)
          setSelectedDate(targetDate)
        }
        
        // Ouvrir le modal avec cette réservation
        const startTime = booking.game_start_datetime ? new Date(booking.game_start_datetime) : new Date(booking.start_datetime)
        setModalInitialHour(startTime.getHours())
        setModalInitialMinute(startTime.getMinutes())
        setEditingBooking(booking)
        setModalDefaultBookingType(booking.type as 'GAME' | 'EVENT')
        setShowBookingModal(true)
        
        // Nettoyer l'URL
        router.replace('/admin')
      }
    }
  }, [searchParams, allBookings, router])

  // CRM: Helper pour obtenir les données du contact (live avec fallback snapshot)
  const getContactDisplayData = (booking: BookingWithSlots) => {
    // Utiliser les données live du contact si disponible
    if (booking.primaryContact) {
      return {
        firstName: booking.primaryContact.first_name || '',
        lastName: booking.primaryContact.last_name || '',
        phone: booking.primaryContact.phone || '',
        email: booking.primaryContact.email || '',
        notes: booking.primaryContact.notes_client || '',
      }
    }
    
    // Fallback sur les snapshot si le contact n'est pas disponible (archivé ou non lié)
    return {
      firstName: booking.customer_first_name || '',
      lastName: booking.customer_last_name || '',
      phone: booking.customer_phone || '',
      email: booking.customer_email || '',
      notes: booking.customer_notes_at_booking || '',
    }
  }

  // Type pour un segment UI (uniquement pour l'affichage)
  interface UISegment {
    segmentId: string
    bookingId: string
    booking: BookingWithSlots
    start: Date
    end: Date
    slotStart: number
    slotEnd: number
    slotsKey: string // Clé pour identifier les slots (pour regrouper les segments contigus)
    isOverbooked: boolean // Overbooking sur la tranche de 15 min correspondante
  }

  // Type pour les données OB par tranche de 15 min
  interface OBData {
    totalParticipants: number
    capacity: number
    isOverbooked: boolean
    overbookedCount: number
    slotsOver: number // Nombre de slots en surplus
    totalSlotsUsed: number // Nombre total de slots utilisés
  }

  // Récupérer la branche sélectionnée (définie plus bas mais on en a besoin ici)
  const branchForSettings = branches.find(b => b.id === selectedBranchId)
  
  // Constantes configurables - Lecture depuis branch_settings
  const MAX_PLAYERS_PER_SLOT = branchForSettings?.settings?.max_players_per_slot || 6
  const SLOT_DURATION = 15 // minutes
  const TOTAL_SLOTS = branchForSettings?.settings?.total_slots || 14 // Défini ici pour être accessible dans buildUISegments()
  
  // Calculer le nombre de salles actives pour la branche sélectionnée
  const TOTAL_ROOMS = branchForSettings?.rooms?.filter(r => r.is_active).length || 0

  // Générer toutes les tranches de 15 minutes pour la journée (pour les calculs de segments)
  const timeSlotDates: Date[] = []
  for (let h = 10; h <= 22; h++) {
    for (const m of [0, 15, 30, 45]) {
      const slotDate = new Date(selectedDate)
      slotDate.setHours(h, m, 0, 0)
      timeSlotDates.push(slotDate)
    }
  }

  // Pré-calculer les données OB pour toutes les tranches de 15 min (une fois par date)
  // Note: capacity sera passé en paramètre car CAPACITY n'est pas encore défini ici
  const calculateOBMapForDate = (capacity: number): Map<number, OBData> => {
    const obByTimeKey = new Map<number, OBData>()

    for (const timeSlotStart of timeSlotDates) {
      const timeSlotEnd = new Date(timeSlotStart)
      timeSlotEnd.setMinutes(timeSlotEnd.getMinutes() + SLOT_DURATION)

      // Calculer totalParticipants = somme des participants actifs sur cette tranche
      // Calculer totalSlotsUsed = somme des slots utilisés pour cette tranche
      // IMPORTANT : Ne prendre en compte que les sessions ACTIVE (pas LASER)
      let totalParticipants = 0
      let totalSlotsUsed = 0
      for (const booking of bookings) {
        if (booking.type !== 'GAME' && booking.type !== 'EVENT') continue
        
        // Si le booking a des game_sessions, utiliser celles-ci (filtrer ACTIVE uniquement)
        if (booking.game_sessions && booking.game_sessions.length > 0) {
          for (const session of booking.game_sessions) {
            // Ne prendre en compte que les sessions ACTIVE pour la grille Active
            if (session.game_area !== 'ACTIVE') continue
            
            const sessionStart = new Date(session.start_datetime)
            const sessionEnd = new Date(session.end_datetime)
            
            // Vérifier si cette session est active sur cette tranche
            if (sessionStart < timeSlotEnd && sessionEnd > timeSlotStart) {
              totalParticipants += booking.participants_count
              totalSlotsUsed += Math.ceil(booking.participants_count / MAX_PLAYERS_PER_SLOT)
            }
          }
        } else {
          // Fallback pour anciens bookings sans game_sessions : utiliser game_start_datetime/end_datetime
          const bookingStart = booking.game_start_datetime ? new Date(booking.game_start_datetime) : new Date(booking.start_datetime)
          const bookingEnd = booking.game_end_datetime ? new Date(booking.game_end_datetime) : new Date(booking.end_datetime)
          
          // Vérifier si ce booking est actif sur cette tranche
          if (bookingStart < timeSlotEnd && bookingEnd > timeSlotStart) {
            totalParticipants += booking.participants_count
            totalSlotsUsed += Math.ceil(booking.participants_count / MAX_PLAYERS_PER_SLOT)
          }
        }
      }

      const isOverbooked = totalParticipants > capacity
      const overbookedCount = isOverbooked ? totalParticipants - capacity : 0
      
      // Calculer le nombre de slots en surplus (overSlots)
      // overSlots = ceil(overPeople / MAX_PLAYERS_PER_SLOT)
      const overSlots = isOverbooked ? Math.ceil(overbookedCount / MAX_PLAYERS_PER_SLOT) : 0

      // Clé = timestamp arrondi à 15 min
      const timeKey = Math.floor(timeSlotStart.getTime() / (SLOT_DURATION * 60 * 1000)) * (SLOT_DURATION * 60 * 1000)

      obByTimeKey.set(timeKey, {
        totalParticipants,
        capacity,
        isOverbooked,
        overbookedCount,
        slotsOver: overSlots,
        totalSlotsUsed
      })
    }

    return obByTimeKey
  }

  // Construire les segments UI à partir des bookings (uniquement pour l'affichage)
  const buildUISegments = (): UISegment[] => {
    const segments: UISegment[] = []

    // Fonction pour calculer quels slots sont occupés pour une tranche de 15 minutes
    const getOccupiedSlotsForTimeSlot = (timeSlotStart: Date): Map<string, { slotStart: number; slotEnd: number }> => {
      const occupiedSlots = new Map<string, { slotStart: number; slotEnd: number }>()
      const timeSlotEnd = new Date(timeSlotStart)
      timeSlotEnd.setMinutes(timeSlotEnd.getMinutes() + SLOT_DURATION)

      // Trier les bookings par ordre d'arrivée (created_at) pour maintenir la stabilité des slots
      // Une réservation qui arrive en premier garde ses slots, les nouvelles se placent après
      // IMPORTANT : Ne prendre en compte que les sessions ACTIVE (pas LASER)
      const relevantBookings = bookings
        .filter(b => {
          if (b.type !== 'GAME' && b.type !== 'EVENT') return false
          
          // Si le booking a des game_sessions, vérifier s'il y a une session ACTIVE sur ce créneau
          if (b.game_sessions && b.game_sessions.length > 0) {
            return b.game_sessions.some(session => {
              if (session.game_area !== 'ACTIVE') return false
              const sessionStart = new Date(session.start_datetime)
              const sessionEnd = new Date(session.end_datetime)
              return sessionStart < timeSlotEnd && sessionEnd > timeSlotStart
            })
          }
          
          // Fallback pour anciens bookings sans game_sessions
          const bookingStart = b.game_start_datetime ? new Date(b.game_start_datetime) : new Date(b.start_datetime)
          const bookingEnd = b.game_end_datetime ? new Date(b.game_end_datetime) : new Date(b.end_datetime)
          return bookingStart < timeSlotEnd && bookingEnd > timeSlotStart
        })
        .sort((a, b) => {
          // Trier par ordre d'arrivée (created_at) pour maintenir la stabilité
          // Les réservations existantes gardent leurs slots, les nouvelles se placent après
          const createdA = new Date(a.created_at || 0).getTime()
          const createdB = new Date(b.created_at || 0).getTime()
          if (createdA !== createdB) {
            return createdA - createdB
          }
          // En cas d'égalité, utiliser l'ID pour un tri stable
          return a.id.localeCompare(b.id)
        })

      // Assigner les slots de gauche à droite
      let nextAvailableSlot = 0
      for (const booking of relevantBookings) {
        const slotsNeeded = Math.ceil(booking.participants_count / MAX_PLAYERS_PER_SLOT)
        occupiedSlots.set(booking.id, {
          slotStart: nextAvailableSlot,
          slotEnd: nextAvailableSlot + slotsNeeded
        })
        nextAvailableSlot += slotsNeeded
      }

      return occupiedSlots
    }

    // Pour chaque booking, créer ses segments
    // IMPORTANT : Ne créer des segments que pour les sessions ACTIVE (pas LASER)
    for (const booking of bookings) {
      if (booking.type !== 'GAME' && booking.type !== 'EVENT') continue

      // Si le booking a des game_sessions, utiliser celles-ci (filtrer ACTIVE uniquement)
      if (booking.game_sessions && booking.game_sessions.length > 0) {
        // Filtrer uniquement les sessions ACTIVE
        const activeSessions = booking.game_sessions.filter(s => s.game_area === 'ACTIVE')
        
        for (const session of activeSessions) {
          const gameStartTime = new Date(session.start_datetime)
          const gameEndTime = new Date(session.end_datetime)

          // Trouver les tranches de 15 minutes couvertes
          // Découper par tranche de 15 min : un segment par tranche
          for (let i = 0; i < timeSlotDates.length; i++) {
            const timeSlotStart = timeSlotDates[i]
            const timeSlotEnd = new Date(timeSlotStart)
            timeSlotEnd.setMinutes(timeSlotEnd.getMinutes() + SLOT_DURATION)

            // Vérifier si cette tranche est dans la plage du jeu
            if (timeSlotStart < gameEndTime && timeSlotEnd > gameStartTime) {
              // Calculer quels slots sont occupés pour cette tranche
              const occupiedSlots = getOccupiedSlotsForTimeSlot(timeSlotStart)
              const bookingSlotInfo = occupiedSlots.get(booking.id)

              if (bookingSlotInfo) {
                let { slotStart, slotEnd } = bookingSlotInfo
                
                // HARD BOUNDARY : Clamp slotEnd à 14 maximum (jamais de débordement)
                if (slotEnd > TOTAL_SLOTS) {
                  slotEnd = TOTAL_SLOTS
                }
                
                // Découper par tranche de 15 min : un segment par tranche
                const slotsKey = `${slotStart}-${slotEnd}`
                
                // Lookup OB pour cette tranche (O(1))
                const timeKey = Math.floor(timeSlotStart.getTime() / (SLOT_DURATION * 60 * 1000)) * (SLOT_DURATION * 60 * 1000)
                const obData = obByTimeKey.get(timeKey)
                const isOverbooked = obData?.isOverbooked || false

                // Créer un segment pour cette tranche de 15 min
                segments.push({
                  segmentId: `${booking.id}-${session.id}-${timeSlotStart.getTime()}-${timeSlotEnd.getTime()}-${slotsKey}`,
                  bookingId: booking.id,
                  booking,
                  start: timeSlotStart,
                  end: timeSlotEnd,
                  slotStart,
                  slotEnd,
                  slotsKey,
                  isOverbooked
                })
              }
            }
          }
        }
      } else {
        // Fallback pour anciens bookings sans game_sessions : utiliser game_start_datetime/end_datetime
        const gameStartTime = booking.game_start_datetime ? new Date(booking.game_start_datetime) : new Date(booking.start_datetime)
        const gameEndTime = booking.game_end_datetime ? new Date(booking.game_end_datetime) : new Date(booking.end_datetime)

        // Trouver les tranches de 15 minutes couvertes
        for (let i = 0; i < timeSlotDates.length; i++) {
          const timeSlotStart = timeSlotDates[i]
          const timeSlotEnd = new Date(timeSlotStart)
          timeSlotEnd.setMinutes(timeSlotEnd.getMinutes() + SLOT_DURATION)

          // Vérifier si cette tranche est dans la plage du jeu
          if (timeSlotStart < gameEndTime && timeSlotEnd > gameStartTime) {
            // Calculer quels slots sont occupés pour cette tranche
            const occupiedSlots = getOccupiedSlotsForTimeSlot(timeSlotStart)
            const bookingSlotInfo = occupiedSlots.get(booking.id)

            if (bookingSlotInfo) {
              let { slotStart, slotEnd } = bookingSlotInfo
              
              // HARD BOUNDARY : Clamp slotEnd à 14 maximum (jamais de débordement)
              if (slotEnd > TOTAL_SLOTS) {
                slotEnd = TOTAL_SLOTS
              }
              
              // Découper par tranche de 15 min : un segment par tranche
              const slotsKey = `${slotStart}-${slotEnd}`
              
              // Lookup OB pour cette tranche (O(1))
              const timeKey = Math.floor(timeSlotStart.getTime() / (SLOT_DURATION * 60 * 1000)) * (SLOT_DURATION * 60 * 1000)
              const obData = obByTimeKey.get(timeKey)
              const isOverbooked = obData?.isOverbooked || false

              // Créer un segment pour cette tranche de 15 min
              segments.push({
                segmentId: `${booking.id}-${timeSlotStart.getTime()}-${timeSlotEnd.getTime()}-${slotsKey}`,
                bookingId: booking.id,
                booking,
                start: timeSlotStart,
                end: timeSlotEnd,
                slotStart,
                slotEnd,
                slotsKey,
                isOverbooked
              })
            }
          }
        }
      }
    }

    // Merger les segments contigus (même bookingId + même slotsKey + end == next.start)
    const mergedSegments: UISegment[] = []
    for (let i = 0; i < segments.length; i++) {
      const current = segments[i]
      if (mergedSegments.length === 0) {
        mergedSegments.push({ ...current })
        continue
      }
      
      const last = mergedSegments[mergedSegments.length - 1]
      // Vérifier si on peut merger : même booking, même slots, et contigu
      if (
        last.bookingId === current.bookingId &&
        last.slotsKey === current.slotsKey &&
        last.end.getTime() === current.start.getTime()
      ) {
        // Merger : étendre le dernier segment
        last.end = current.end
        last.segmentId = `${last.bookingId}-${last.start.getTime()}-${last.end.getTime()}-${last.slotsKey}`
      } else {
        // Nouveau segment
        mergedSegments.push({ ...current })
      }
    }

    return mergedSegments
  }

  // Calculer CAPACITY (après les hooks, mais TOTAL_SLOTS est déjà défini plus haut)
  const CAPACITY = TOTAL_SLOTS * MAX_PLAYERS_PER_SLOT // 14 * 6 = 84

  // Pré-calculer la map OB une fois (après définition de CAPACITY, avant buildUISegments)
  const obByTimeKey = calculateOBMapForDate(CAPACITY)

  // Construire les segments UI
  const uiSegments = buildUISegments()

  // Ouvrir le modal de réservation
  const openBookingModal = (hour?: number, minute?: number, booking?: BookingWithSlots, defaultType: 'GAME' | 'EVENT' = 'GAME', defaultGameArea: 'ACTIVE' | 'LASER' = 'ACTIVE') => {
    if (booking) {
      setEditingBooking(booking)
      // Extraire l'heure de début de la réservation
      const startTime = new Date(booking.game_start_datetime || booking.start_datetime)
      setModalInitialHour(startTime.getHours())
      setModalInitialMinute(startTime.getMinutes())
      // Le type sera celui de la réservation existante
      setModalDefaultBookingType(booking.type as 'GAME' | 'EVENT')
      // Pour GAME, déterminer la zone depuis les sessions
      if (booking.type === 'GAME' && booking.game_sessions && booking.game_sessions.length > 0) {
        setModalDefaultGameArea(booking.game_sessions[0].game_area as 'ACTIVE' | 'LASER')
      } else {
        setModalDefaultGameArea('ACTIVE')
      }
    } else {
      setEditingBooking(null)
      setModalInitialHour(hour ?? 10)
      setModalInitialMinute(minute ?? 0)
      setModalDefaultBookingType(defaultType) // Définir le type selon où on clique
      setModalDefaultGameArea(defaultGameArea) // Définir la zone selon où on clique
    }
    setShowBookingModal(true)
  }

  // Créer ou mettre à jour une réservation
  const handleSubmitBooking = async (data: CreateBookingData): Promise<boolean> => {
    if (editingBooking) {
      // Mode édition
      const result = await updateBooking(editingBooking.id, data)
      return result !== null
    } else {
      // Mode création
      const result = await createBooking(data)
      return result !== null
    }
  }

  // Supprimer une réservation
  const handleDeleteBooking = async (id: string): Promise<boolean> => {
    const success = await deleteBooking(id)
    if (success) {
      setEditingBooking(null)
      setShowBookingModal(false)
    }
    return success
  }

  // Supprimer toutes les réservations (remettre le système à zéro)
  const handleDeleteAllBookings = () => {
    setConfirmationModal({
      isOpen: true,
      title: '⚠️ ATTENTION',
      message: 'Cette action va supprimer TOUTES les réservations (jeux et événements) de cette branche. Cette action est irréversible.\n\nÊtes-vous sûr de vouloir continuer ?',
      type: 'warning',
      onConfirm: async () => {
        const success = await deleteAllBookings()
        if (success) {
          setConfirmationModal({
            isOpen: true,
            title: 'Succès',
            message: 'Toutes les réservations ont été supprimées. Le système est maintenant à zéro.',
            type: 'success',
            onConfirm: () => {},
          })
        } else {
          setConfirmationModal({
            isOpen: true,
            title: 'Erreur',
            message: 'Erreur lors de la suppression de toutes les réservations.',
            type: 'warning',
            onConfirm: () => {},
          })
        }
      },
    })
  }

  // Charger les données utilisateur
  useEffect(() => {
    const loadUserData = async () => {
      const supabase = createClient()

      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.push('/admin/login')
          return
        }

        // Récupérer le profil
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single<Profile>()

        // Récupérer les branches
        let branches: Array<{ id: string; name: string; slug: string }> = []

        if (profile?.role === 'super_admin') {
          const { data } = await supabase
            .from('branches')
            .select('id, name, slug')
            .eq('is_active', true)
            .order('name')
          branches = data || []
        } else {
          const { data: userBranches } = await supabase
            .from('user_branches')
            .select('branch_id')
            .eq('user_id', user.id)
            .returns<UserBranch[]>()

          if (userBranches && userBranches.length > 0) {
            const branchIds = userBranches.map(ub => ub.branch_id)
            const { data } = await supabase
              .from('branches')
              .select('id, name, slug')
              .in('id', branchIds)
              .eq('is_active', true)
              .order('name')
            branches = data || []
          }
        }

        setUserData({
          id: user.id,
          email: user.email || '',
          profile,
          branches,
          role: profile?.role || 'agent'
        })

        // NE PAS forcer la sélection de branche ici
        // useBranches gère déjà la sélection initiale (Rishon LeZion par défaut au premier chargement)
        // et la persistance via localStorage pour conserver la branche entre les pages
      } catch (error) {
        console.error('Error loading user data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
  }, [router])

  // Charger le thème
  useEffect(() => {
    const savedTheme = localStorage.getItem('admin_theme') as Theme
    if (savedTheme) setTheme(savedTheme)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('admin_theme', newTheme)
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatDateFull = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  // Gestion du calendrier modal
  const handleCalendarDateClick = (date: Date) => {
    setSelectedDate(date)
    setCalendarMonth(date.getMonth())
    setCalendarYear(date.getFullYear())
    setShowCalendarModal(false)
    // Mettre à jour la semaine
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(date)
    monday.setDate(diff)
    monday.setHours(0, 0, 0, 0)
    setCurrentWeekStart(monday)
  }

  const handlePreviousMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11)
      setCalendarYear(calendarYear - 1)
    } else {
      setCalendarMonth(calendarMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0)
      setCalendarYear(calendarYear + 1)
    } else {
      setCalendarMonth(calendarMonth + 1)
    }
  }

  const handlePreviousYear = () => {
    setCalendarYear(calendarYear - 1)
  }

  const handleNextYear = () => {
    setCalendarYear(calendarYear + 1)
  }

  // Générer le calendrier pour le modal
  const getCalendarDays = () => {
    const firstDay = new Date(calendarYear, calendarMonth, 1)
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDay = firstDay.getDay()
    const days = []
    
    // Jours vides avant le premier jour
    for (let i = 0; i < (startDay === 0 ? 6 : startDay - 1); i++) {
      days.push(null)
    }
    
    // Jours du mois
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(calendarYear, calendarMonth, i))
    }
    
    return days
  }

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

  const goToPrevDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDate(newDate)
    // Mettre à jour la semaine si nécessaire
    const day = newDate.getDay()
    const diff = newDate.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(newDate)
    monday.setDate(diff)
    monday.setHours(0, 0, 0, 0)
    setCurrentWeekStart(monday)
  }

  const goToNextDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    setSelectedDate(newDate)
    // Mettre à jour la semaine si nécessaire
    const day = newDate.getDay()
    const diff = newDate.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(newDate)
    monday.setDate(diff)
    monday.setHours(0, 0, 0, 0)
    setCurrentWeekStart(monday)
  }

  const goToToday = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    setSelectedDate(today)
    // Mettre à jour la semaine
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(today)
    monday.setDate(diff)
    monday.setHours(0, 0, 0, 0)
    setCurrentWeekStart(monday)
  }

  // Générer les jours de la semaine
  const getWeekDays = () => {
    const days = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart)
      date.setDate(date.getDate() + i)
      days.push(date)
    }
    return days
  }

  const handleWeekDayClick = (date: Date) => {
    setSelectedDate(date)
  }

  const handlePreviousWeek = () => {
    const newWeekStart = new Date(currentWeekStart)
    newWeekStart.setDate(newWeekStart.getDate() - 7)
    setCurrentWeekStart(newWeekStart)
    // Mettre à jour la date sélectionnée pour rester sur le même jour de la semaine
    const dayOfWeek = selectedDate.getDay()
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const newSelectedDate = new Date(newWeekStart)
    newSelectedDate.setDate(newWeekStart.getDate() + diffToMonday + (selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1))
    setSelectedDate(newSelectedDate)
  }

  const handleNextWeek = () => {
    const newWeekStart = new Date(currentWeekStart)
    newWeekStart.setDate(newWeekStart.getDate() + 7)
    setCurrentWeekStart(newWeekStart)
    // Mettre à jour la date sélectionnée pour rester sur le même jour de la semaine
    const dayOfWeek = selectedDate.getDay()
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const newSelectedDate = new Date(newWeekStart)
    newSelectedDate.setDate(newWeekStart.getDate() + diffToMonday + (selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1))
    setSelectedDate(newSelectedDate)
  }

  // Calculer les stats
  const gameBookings = bookings.filter(b => b.type === 'GAME')
  const eventBookings = bookings.filter(b => b.type === 'EVENT')
  const totalParticipants = bookings.reduce((sum, b) => sum + b.participants_count, 0)

  // Calculer les statistiques détaillées (Jour, Semaine, Mois)
  const calculateStats = () => {
    const dateStr = formatDateToString(selectedDate)
    
    // Utiliser allBookings directement (même source que l'agenda)
    const bookingsForStats = allBookings || []
    
    // Stats du jour
    const dayBookings = bookingsForStats.filter(b => {
      const bookingDate = extractLocalDateFromISO(b.start_datetime)
      return bookingDate === dateStr
    })
    const dayWithRoom = dayBookings.filter(b => b.event_room_id !== null)
    const dayWithoutRoom = dayBookings.filter(b => b.event_room_id === null)
    const dayTotalParticipants = dayBookings.reduce((sum, b) => sum + b.participants_count, 0)
    
    // Stats de la semaine (lundi à dimanche)
    const dayOfWeek = selectedDate.getDay()
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(selectedDate)
    weekStart.setDate(selectedDate.getDate() + diffToMonday)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)
    
    // Filtrer les réservations de la semaine en utilisant les dates locales
    const weekBookings = bookingsForStats.filter(b => {
      const bookingDateStr = extractLocalDateFromISO(b.start_datetime)
      const bookingDate = new Date(bookingDateStr + 'T00:00:00')
      bookingDate.setHours(0, 0, 0, 0)
      return bookingDate >= weekStart && bookingDate <= weekEnd
    })
    
    const weekWithRoom = weekBookings.filter(b => b.event_room_id !== null)
    const weekWithoutRoom = weekBookings.filter(b => b.event_room_id === null)
    const weekTotalParticipants = weekBookings.reduce((sum, b) => sum + b.participants_count, 0)
    
    // Stats du mois
    const year = selectedDate.getFullYear()
    const monthStart = new Date(year, selectedDate.getMonth(), 1)
    monthStart.setHours(0, 0, 0, 0)
    const monthEnd = new Date(year, selectedDate.getMonth() + 1, 0)
    monthEnd.setHours(23, 59, 59, 999)
    
    // Filtrer les réservations du mois en utilisant les dates locales
    const monthBookings = bookingsForStats.filter(b => {
      const bookingDateStr = extractLocalDateFromISO(b.start_datetime)
      const bookingDate = new Date(bookingDateStr + 'T00:00:00')
      bookingDate.setHours(0, 0, 0, 0)
      return bookingDate >= monthStart && bookingDate <= monthEnd
    })
    
    const monthWithRoom = monthBookings.filter(b => b.event_room_id !== null)
    const monthWithoutRoom = monthBookings.filter(b => b.event_room_id === null)
    const monthTotalParticipants = monthBookings.reduce((sum, b) => sum + b.participants_count, 0)
    
    // Formater la période de la semaine
    const weekStartStr = weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    const weekEndStr = weekEnd.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    
    return {
      day: {
        withRoom: dayWithRoom.length,
        withoutRoom: dayWithoutRoom.length,
        totalParticipants: dayTotalParticipants,
        dateStr: selectedDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
      },
      week: {
        withRoom: weekWithRoom.length,
        withoutRoom: weekWithoutRoom.length,
        totalParticipants: weekTotalParticipants,
        period: `${weekStartStr} - ${weekEndStr}`
      },
      month: {
        withRoom: monthWithRoom.length,
        withoutRoom: monthWithoutRoom.length,
        totalParticipants: monthTotalParticipants,
        period: selectedDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      }
    }
  }

  const stats = calculateStats()

  // Rechercher dans TOUTES les réservations (pas seulement le jour sélectionné)
  const searchResults = agendaSearchQuery
    ? allBookings.filter((b) => {
        const searchLower = agendaSearchQuery.toLowerCase()
        const contactData = getContactDisplayData(b)
        const customerName = `${contactData.firstName || ''} ${contactData.lastName || ''}`.toLowerCase().trim()
        const bookingDate = extractLocalDateFromISO(b.start_datetime)
        const startTime = new Date(b.start_datetime)
        const timeStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`
        const notes = (b.notes || '').toLowerCase()
        const customerPhone = contactData.phone.toLowerCase()
        const customerEmail = contactData.email.toLowerCase()
        const referenceCode = (b.reference_code || '').toLowerCase()
        
        return (
          customerName.includes(searchLower) ||
          bookingDate.includes(searchLower) ||
          timeStr.includes(searchLower) ||
          notes.includes(searchLower) ||
          customerPhone.includes(searchLower) ||
          customerEmail.includes(searchLower) ||
          referenceCode.includes(searchLower) ||
          b.id.toLowerCase().includes(searchLower)
        )
      })
    : []

  const calendarDays = getCalendarDays()

  // Cache pour les réservations des autres branches (pour éviter de recharger à chaque fois)
  const [bookingsCache, setBookingsCache] = useState<Map<string, BookingWithSlots[]>>(new Map())

  // Fonction pour charger les réservations d'une branche spécifique (synchrone avec cache)
  const getBookingsForBranch = (branchId: string | null, date: Date): BookingWithSlots[] => {
    if (!branchId) return []
    
    // Si c'est la branche actuelle, utiliser allBookings
    if (branchId === selectedBranchId) {
      const dateStr = formatDateToString(date)
      return allBookings.filter(b => {
        const bookingDate = extractLocalDateFromISO(b.start_datetime)
        return bookingDate === dateStr
      })
    }

    // Vérifier le cache
    const cacheKey = `${branchId}-${formatDateToString(date)}`
    if (bookingsCache.has(cacheKey)) {
      return bookingsCache.get(cacheKey)!
    }

    // Si pas dans le cache, charger de manière asynchrone (mais retourner vide pour l'instant)
    // Le chargement se fera dans un useEffect séparé
    loadBookingsForBranchAsync(branchId, date)
    return []
  }

  // Fonction asynchrone pour charger les réservations d'une branche spécifique
  const loadBookingsForBranchAsync = async (branchId: string, date: Date) => {
    const cacheKey = `${branchId}-${formatDateToString(date)}`
    
    // Ne pas recharger si déjà en cache
    if (bookingsCache.has(cacheKey)) return

    const supabase = createClient()
    const dateStr = formatDateToString(date)
    const startOfDay = `${dateStr}T00:00:00.000Z`
    const endOfDay = `${dateStr}T23:59:59.999Z`

    try {
      const { data: bookingsData, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('branch_id', branchId)
        .neq('status', 'CANCELLED')
        .gte('start_datetime', startOfDay)
        .lte('start_datetime', endOfDay)
        .order('start_datetime', { ascending: true })

      if (error) throw error

      // Charger les slots et contacts comme dans useBookings
      const bookingIds = (bookingsData || []).map((b: any) => b.id)
      if (bookingIds.length > 0) {
        const { data: slotsData } = await supabase
          .from('booking_slots')
          .select('*')
          .in('booking_id', bookingIds)
          .order('slot_start')

        const { data: bookingContactsData } = await supabase
          .from('booking_contacts')
          .select('*, contact:contacts(*)')
          .in('booking_id', bookingIds)

        // Construire les bookings avec slots et contacts (simplifié)
        const bookingsWithDetails: BookingWithSlots[] = (bookingsData || []).map((b: any) => {
          const primaryContactData = (bookingContactsData as any[])?.find((bc: any) => bc.booking_id === b.id && bc.is_primary)
          return {
            ...b,
            slots: (slotsData || []).filter((s: any) => s.booking_id === b.id),
            primaryContact: primaryContactData?.contact || null,
          }
        })

        setBookingsCache(new Map(bookingsCache.set(cacheKey, bookingsWithDetails)))
      } else {
        setBookingsCache(new Map(bookingsCache.set(cacheKey, [])))
      }
    } catch (err) {
      console.error('Error loading bookings for branch:', err)
      setBookingsCache(new Map(bookingsCache.set(cacheKey, [])))
    }
  }

  // Fonction pour trouver la meilleure salle disponible pour un événement
  const findBestAvailableRoom = (
    participants: number,
    startDateTime: Date,
    endDateTime: Date,
    excludeBookingId?: string,
    targetBranchId?: string | null
  ): string | null => {
    // Utiliser la branche cible si fournie, sinon la branche actuelle
    const branchIdToUse = targetBranchId || selectedBranchId
    const targetBranch = branches.find(b => b.id === branchIdToUse)
    const targetRooms = targetBranch?.rooms || []
    
    if (!targetRooms || targetRooms.length === 0) return null

    // Obtenir les bookings de la branche cible (utilise le cache)
    const bookingsForBranch = getBookingsForBranch(branchIdToUse, startDateTime)
    // Déclencher le chargement asynchrone si nécessaire
    if (targetBranchId && targetBranchId !== selectedBranchId) {
      loadBookingsForBranchAsync(targetBranchId, startDateTime)
    }

    // Trier les salles par capacité croissante (plus petite salle en premier)
    const sortedRooms = [...targetRooms]
      .filter(room => room.is_active)
      .sort((a, b) => {
        // D'abord par capacité (croissant)
        if (a.capacity !== b.capacity) {
          return a.capacity - b.capacity
        }
        // Ensuite par sort_order (croissant)
        return a.sort_order - b.sort_order
      })

    // Filtrer les salles qui peuvent accueillir le nombre de participants
    const suitableRooms = sortedRooms.filter(room => room.capacity >= participants)

    if (suitableRooms.length === 0) return null

    // Vérifier la disponibilité de chaque salle dans l'ordre
    for (const room of suitableRooms) {
      // Vérifier si la salle est disponible pendant cette période
      let isAvailable = true

      for (const booking of bookingsForBranch) {
        // Exclure le booking en cours de modification
        if (excludeBookingId && booking.id === excludeBookingId) continue
        
        // Ne vérifier que les événements qui utilisent cette salle
        if (booking.type === 'EVENT' && booking.event_room_id === room.id) {
          const bookingStart = new Date(booking.start_datetime)
          const bookingEnd = new Date(booking.end_datetime)

          // Vérifier s'il y a un chevauchement
          if (
            (startDateTime >= bookingStart && startDateTime < bookingEnd) ||
            (endDateTime > bookingStart && endDateTime <= bookingEnd) ||
            (startDateTime <= bookingStart && endDateTime >= bookingEnd)
          ) {
            isAvailable = false
            break
          }
        }
      }

      if (isAvailable) {
        return room.id
      }
    }

    // Aucune salle disponible
    return null
  }

  // Fonction pour obtenir des informations détaillées sur la disponibilité des salles
  const findRoomAvailability = (
    participants: number,
    startDateTime: Date,
    endDateTime: Date,
    excludeBookingId?: string,
    targetBranchId?: string | null
  ): { bestRoomId: string | null; availableRoomWithLowerCapacity: { id: string; capacity: number } | null; hasAnyAvailableRoom: boolean } => {
    // Utiliser la branche cible si fournie, sinon la branche actuelle
    const branchIdToUse = targetBranchId || selectedBranchId
    const targetBranch = branches.find(b => b.id === branchIdToUse)
    const targetRooms = targetBranch?.rooms || []
    
    if (!targetRooms || targetRooms.length === 0) {
      return { bestRoomId: null, availableRoomWithLowerCapacity: null, hasAnyAvailableRoom: false }
    }

    // Obtenir les bookings de la branche cible (utilise le cache)
    const bookingsForBranch = getBookingsForBranch(branchIdToUse, startDateTime)
    // Déclencher le chargement asynchrone si nécessaire
    if (targetBranchId && targetBranchId !== selectedBranchId) {
      loadBookingsForBranchAsync(targetBranchId, startDateTime)
    }

    // Trier les salles par capacité croissante
    const sortedRooms = [...targetRooms]
      .filter(room => room.is_active)
      .sort((a, b) => {
        if (a.capacity !== b.capacity) {
          return a.capacity - b.capacity
        }
        return a.sort_order - b.sort_order
      })

    // Fonction pour vérifier si une salle est disponible
    const isRoomAvailable = (roomId: string): boolean => {
      for (const booking of bookingsForBranch) {
        // Exclure le booking en cours de modification
        if (excludeBookingId && booking.id === excludeBookingId) continue
        
        if (booking.type === 'EVENT' && booking.event_room_id === roomId) {
          const bookingStart = new Date(booking.start_datetime)
          const bookingEnd = new Date(booking.end_datetime)

          if (
            (startDateTime >= bookingStart && startDateTime < bookingEnd) ||
            (endDateTime > bookingStart && endDateTime <= bookingEnd) ||
            (startDateTime <= bookingStart && endDateTime >= bookingEnd)
          ) {
            return false
          }
        }
      }
      return true
    }

    // Chercher une salle avec capacité suffisante
    const suitableRooms = sortedRooms.filter(room => room.capacity >= participants)
    for (const room of suitableRooms) {
      if (isRoomAvailable(room.id)) {
        return { bestRoomId: room.id, availableRoomWithLowerCapacity: null, hasAnyAvailableRoom: true }
      }
    }

    // Si aucune salle avec capacité suffisante, chercher la plus grande salle disponible
    // (même si sa capacité est inférieure au nombre de participants demandé)
    let bestAvailableRoom: { id: string; capacity: number } | null = null
    let hasAnyAvailable = false

    // Trier par capacité décroissante pour trouver la plus grande salle disponible
    const sortedRoomsDesc = [...sortedRooms].sort((a, b) => {
      if (a.capacity !== b.capacity) {
        return b.capacity - a.capacity // Décroissant
      }
      return a.sort_order - b.sort_order
    })

    for (const room of sortedRoomsDesc) {
      if (isRoomAvailable(room.id)) {
        hasAnyAvailable = true
        // Prendre la première salle disponible (la plus grande)
        if (!bestAvailableRoom) {
          bestAvailableRoom = { id: room.id, capacity: room.capacity }
          break
        }
      }
    }

    return {
      bestRoomId: null,
      availableRoomWithLowerCapacity: bestAvailableRoom,
      hasAnyAvailableRoom: hasAnyAvailable
    }
  }

  // Fonction pour calculer l'overbooking potentiel d'une réservation
  const calculateOverbooking = (
    participants: number,
    startDateTime: Date,
    endDateTime: Date,
    excludeBookingId?: string,
    targetBranchId?: string | null
  ): { willCauseOverbooking: boolean; maxOverbookedCount: number; maxOverbookedSlots: number; affectedTimeSlots: Array<{ time: string; overbookedCount: number; overbookedSlots: number; totalParticipants: number; capacity: number }> } => {
    const CAPACITY = TOTAL_SLOTS * MAX_PLAYERS_PER_SLOT
    const affectedTimeSlots: Array<{ time: string; overbookedCount: number; overbookedSlots: number; totalParticipants: number; capacity: number }> = []
    let maxOverbookedCount = 0
    let maxOverbookedSlots = 0

    // Obtenir les bookings de la branche cible (utilise le cache)
    const branchIdToUse = targetBranchId || selectedBranchId
    const bookingsForBranch = getBookingsForBranch(branchIdToUse, startDateTime)
    // Déclencher le chargement asynchrone si nécessaire
    if (targetBranchId && targetBranchId !== selectedBranchId) {
      loadBookingsForBranchAsync(targetBranchId, startDateTime)
    }

    // Générer toutes les tranches de 15 minutes couvertes par cette réservation
    const bookingTimeSlots: Date[] = []
    let currentTime = new Date(startDateTime)
    while (currentTime < endDateTime) {
      const slotStart = new Date(currentTime)
      slotStart.setMinutes(Math.floor(slotStart.getMinutes() / SLOT_DURATION) * SLOT_DURATION, 0, 0)
      
      if (!bookingTimeSlots.some(ts => ts.getTime() === slotStart.getTime())) {
        bookingTimeSlots.push(new Date(slotStart))
      }
      
      currentTime = new Date(currentTime)
      currentTime.setMinutes(currentTime.getMinutes() + SLOT_DURATION)
    }

    // Pour chaque tranche de 15 minutes
    for (const timeSlotStart of bookingTimeSlots) {
      const timeSlotEnd = new Date(timeSlotStart)
      timeSlotEnd.setMinutes(timeSlotEnd.getMinutes() + SLOT_DURATION)

      // Calculer totalParticipants = somme des participants actifs sur cette tranche (sans exclure le booking en cours de modification)
      let totalParticipants = participants // Inclure la nouvelle réservation
      for (const booking of bookingsForBranch) {
        if (booking.id === excludeBookingId) continue // Exclure le booking en cours de modification
        if (booking.type !== 'GAME' && booking.type !== 'EVENT') continue
        const bookingStart = booking.game_start_datetime ? new Date(booking.game_start_datetime) : new Date(booking.start_datetime)
        const bookingEnd = booking.game_end_datetime ? new Date(booking.game_end_datetime) : new Date(booking.end_datetime)
        
        if (bookingStart < timeSlotEnd && bookingEnd > timeSlotStart) {
          totalParticipants += booking.participants_count
        }
      }

      const isOverbooked = totalParticipants > CAPACITY
      if (isOverbooked) {
        const overbookedCount = totalParticipants - CAPACITY
        const overbookedSlots = Math.ceil(overbookedCount / MAX_PLAYERS_PER_SLOT)
        
        maxOverbookedCount = Math.max(maxOverbookedCount, overbookedCount)
        maxOverbookedSlots = Math.max(maxOverbookedSlots, overbookedSlots)
        
        const timeLabel = timeSlotStart.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        affectedTimeSlots.push({
          time: timeLabel,
          overbookedCount,
          overbookedSlots,
          totalParticipants,
          capacity: CAPACITY
        })
      }
    }

    return {
      willCauseOverbooking: affectedTimeSlots.length > 0,
      maxOverbookedCount,
      maxOverbookedSlots,
      affectedTimeSlots
    }
  }

  // =====================================================
  // FONCTIONS LASER
  // =====================================================

  // Hook pour les laser rooms
  const { laserRooms, calculateVestsUsage, checkLaserRoomAvailability } = useLaserRooms(selectedBranchId)
  
  // Calculer le nombre de salles laser actives pour la branche sélectionnée
  const TOTAL_LASER_ROOMS = laserRooms.filter(r => r.is_active).length

  // Trouver la meilleure salle laser pour un booking
  const findBestLaserRoom = async (
    participants: number,
    startDateTime: Date,
    endDateTime: Date,
    excludeBookingId?: string,
    targetBranchId?: string | null,
    allocationMode: 'auto' | 'petit' | 'grand' | 'maxi' = 'auto'
  ): Promise<{ roomIds: string[]; requiresTwoRooms: boolean } | null> => {
    const branchIdToUse = targetBranchId || selectedBranchId
    const targetBranch = branches.find(b => b.id === branchIdToUse)
    const targetLaserRooms = targetBranch?.laserRooms?.filter(r => r.is_active) || []
    
    // Récupérer le seuil exclusif depuis les settings
    const exclusiveThreshold = targetBranch?.settings?.laser_exclusive_threshold || 10

    if (targetLaserRooms.length === 0) return null

    // Trier les salles par capacité croissante pour optimiser l'espace (plus petite salle suffisante en premier)
    const sortedRoomsByCapacity = [...targetLaserRooms].sort((a, b) => {
      if (a.capacity !== b.capacity) {
        return a.capacity - b.capacity // Croissant (L1=15 en premier, puis L2=20)
      }
      return a.sort_order - b.sort_order
    })

    // Fonction helper pour calculer la capacité restante d'une salle
    const getRoomRemainingCapacity = (roomId: string): number => {
      const room = targetLaserRooms.find(r => r.id === roomId)
      if (!room) return 0
      
      // CRITIQUE : Filtrer UNIQUEMENT les bookings de la branche cible
      // Chaque branche doit avoir ses salles laser totalement indépendantes
      const overlappingLaserBookings = allBookings.filter(b => {
        // FILTRE PAR BRANCHE : Exclure les bookings des autres branches
        if (b.branch_id !== branchIdToUse) return false
        if (excludeBookingId && b.id === excludeBookingId) return false
        if (!b.game_sessions || b.game_sessions.length === 0) return false
        
        return b.game_sessions.some(s => {
          if (s.game_area !== 'LASER') return false
          const sessionStart = new Date(s.start_datetime)
          const sessionEnd = new Date(s.end_datetime)
          return sessionStart < endDateTime && sessionEnd > startDateTime
        })
      })
      
      // RÈGLE 1 : Vérifier si une résa utilise mode MAXI (2 salles ou plus)
      // Si oui, TOUT le laser est bloqué pour ce créneau
      const hasMaxiMode = overlappingLaserBookings.some(b => {
        const laserRoomIds = b.game_sessions
          ?.filter(s => s.game_area === 'LASER')
          .map(s => s.laser_room_id)
          .filter((id): id is string => id !== null) || []
        const uniqueRoomIds = [...new Set(laserRoomIds)]
        return uniqueRoomIds.length > 1 // Mode Maxi = utilise plusieurs salles
      })
      
      if (hasMaxiMode) {
        return 0 // Créneau entier bloqué
      }
      
      // RÈGLE 2 : Vérifier si cette salle spécifique contient une résa au-delà du seuil exclusif
      // Si oui, la salle est EXCLUSIVE (fermée, personne d'autre ne peut s'ajouter)
      const hasExclusiveBooking = overlappingLaserBookings.some(b => {
        const isInThisRoom = b.game_sessions?.some(s => 
          s.game_area === 'LASER' && s.laser_room_id === roomId
        )
        return isInThisRoom && b.participants_count >= exclusiveThreshold
      })
      
      if (hasExclusiveBooking) {
        return 0 // Salle exclusive, groupe joue seul
      }
      
      // RÈGLE 3 : Calcul normal de capacité restante (seulement pour résas < 10 qui peuvent partager)
      const bookingsInThisRoom = overlappingLaserBookings.filter(b => 
        b.game_sessions?.some(s => s.game_area === 'LASER' && s.laser_room_id === roomId)
      )
      const currentParticipants = bookingsInThisRoom.reduce((sum, b) => sum + b.participants_count, 0)
      return room.capacity - currentParticipants
    }
    
    // ALLOCATION MANUELLE : Forcer une salle spécifique si mode != 'auto'
    if (allocationMode !== 'auto') {
      const smallRoom = sortedRoomsByCapacity[0] // Plus petite capacité
      const largeRoom = sortedRoomsByCapacity[sortedRoomsByCapacity.length - 1] // Plus grande capacité
      
      let forcedRoomIds: string[] = []
      
      if (allocationMode === 'petit') {
        forcedRoomIds = [smallRoom.id]
      } else if (allocationMode === 'grand') {
        forcedRoomIds = [largeRoom.id]
      } else if (allocationMode === 'maxi') {
        forcedRoomIds = targetLaserRooms.map(r => r.id)
      }
      
      // Vérifier capacité restante
      const totalRemaining = forcedRoomIds.reduce((sum, id) => sum + getRoomRemainingCapacity(id), 0)
      
      if (totalRemaining >= participants) {
        return { 
          roomIds: forcedRoomIds, 
          requiresTwoRooms: forcedRoomIds.length > 1 
        }
      } else {
        // Capacité insuffisante
        return null
      }
    }
    
    // Logique d'allocation AUTOMATIQUE basée sur la capacité restante
    // TOUJOURS vérifier la capacité restante, pas juste si vide
    
    // Si le groupe nécessite toutes les salles combinées
    if (participants > Math.max(...targetLaserRooms.map(r => r.capacity))) {
      // Vérifier si la capacité restante totale suffit
      const totalRemainingCapacity = targetLaserRooms.reduce((sum, r) => sum + getRoomRemainingCapacity(r.id), 0)
      if (totalRemainingCapacity >= participants) {
        return { 
          roomIds: targetLaserRooms.map(r => r.id), 
          requiresTwoRooms: targetLaserRooms.length > 1 
        }
      }
      return null // Vraiment plein
    }
    
    // Groupe >= exclusiveThreshold : PRÉFÈRE une salle vide seule, mais peut partager si nécessaire
    // Si >= exclusiveThreshold, la salle deviendra exclusive (bloquée aux autres) après allocation
    if (participants >= exclusiveThreshold) {
      // D'abord chercher une salle vide avec capacité suffisante
      for (const room of sortedRoomsByCapacity) {
        const remaining = getRoomRemainingCapacity(room.id)
        if (remaining === room.capacity && room.capacity >= participants) {
          // Salle vide et suffisante
          return { roomIds: [room.id], requiresTwoRooms: false }
        }
      }
      
      // Sinon, chercher une salle avec capacité restante suffisante (partage)
      for (const room of sortedRoomsByCapacity) {
        const remaining = getRoomRemainingCapacity(room.id)
        if (remaining >= participants) {
          // Capacité restante suffisante pour partager
          return { roomIds: [room.id], requiresTwoRooms: false }
        }
      }
      
      return null // Aucune salle ne peut accueillir le groupe
    }
    
    // Groupe < threshold : PEUT partager, chercher la plus petite salle avec capacité restante
    for (const room of sortedRoomsByCapacity) {
      const remaining = getRoomRemainingCapacity(room.id)
      if (remaining >= participants) {
        return { roomIds: [room.id], requiresTwoRooms: false }
      }
    }
    
    // Aucune salle ne peut accueillir le groupe
    return null
  }

  // Vérifier contrainte hard vests avec gestion des spare vests
  const checkLaserVestsConstraint = async (
    participants: number,
    startDateTime: Date,
    endDateTime: Date,
    excludeBookingId?: string,
    targetBranchId?: string | null
  ): Promise<{ 
    isViolated: boolean; 
    needsSpareVests: boolean;
    currentUsage: number; 
    maxVests: number; 
    spareVests: number;
    totalVests: number;
    message: string 
  }> => {
    const branchIdToUse = targetBranchId || selectedBranchId
    const targetBranch = branches.find(b => b.id === branchIdToUse)
    const maxVests = targetBranch?.settings?.laser_total_vests || 0
    const spareVests = targetBranch?.settings?.laser_spare_vests || 0
    const totalVests = maxVests + spareVests

    if (maxVests === 0) {
      // Si pas de contrainte configurée, autoriser
      return { 
        isViolated: false, 
        needsSpareVests: false,
        currentUsage: 0, 
        maxVests: 0, 
        spareVests: 0,
        totalVests: 0,
        message: '' 
      }
    }

    // Calculer l'utilisation actuelle sur ce créneau (filtrer par branche)
    const currentUsage = await calculateVestsUsage(startDateTime, endDateTime, excludeBookingId, branchIdToUse)
    const totalWithNew = currentUsage + participants

    // Vérifier si on dépasse la limite principale
    const exceedsMain = totalWithNew > maxVests
    // Vérifier si on dépasse la limite totale (principale + spare)
    const exceedsTotal = totalWithNew > totalVests

    return {
      isViolated: exceedsTotal, // Bloque seulement si on dépasse la limite totale
      needsSpareVests: exceedsMain && !exceedsTotal, // Demande spare si on dépasse principale mais pas totale
      currentUsage,
      maxVests,
      spareVests,
      totalVests,
      message: exceedsTotal
        ? `Dépassement de la contrainte vestes (incluant spare) : ${totalWithNew} > ${totalVests} (REFUS)`
        : exceedsMain
          ? `Limite principale atteinte (${maxVests} vestes). ${spareVests} vestes spare disponibles.`
          : ''
    }
  }

  // Vérifier capacité soft d'une salle laser
  const checkLaserRoomCapacity = (
    roomId: string,
    participants: number,
    targetBranchId?: string | null
  ): { isExceeded: boolean; roomCapacity: number; overcapBy: number } => {
    const branchIdToUse = targetBranchId || selectedBranchId
    const targetBranch = branches.find(b => b.id === branchIdToUse)
    const room = targetBranch?.laserRooms?.find(r => r.id === roomId)

    if (!room) {
      return { isExceeded: false, roomCapacity: 0, overcapBy: 0 }
    }

    const isExceeded = participants > room.capacity
    const overcapBy = isExceeded ? participants - room.capacity : 0

    return {
      isExceeded,
      roomCapacity: room.capacity,
      overcapBy
    }
  }

  // Vérifier si un créneau contient un segment pour GRID GAME (slots uniquement)
  const getSegmentForCellSlots = (hour: number, minute: number, slotIndex: number): UISegment | null => {
    const cellDate = new Date(selectedDate)
    cellDate.setHours(hour, minute, 0, 0)
    const cellDateEnd = new Date(cellDate)
    cellDateEnd.setMinutes(cellDateEnd.getMinutes() + 15)

    // Parcourir les segments dans l'ordre inverse pour prioriser les plus récents
    for (let i = uiSegments.length - 1; i >= 0; i--) {
      const segment = uiSegments[i]
      
      // Vérifier si ce segment chevauche la cellule
      if (segment.start < cellDateEnd && segment.end > cellDate) {
        // Vérifier si le slotIndex demandé est dans la plage du segment
        if (slotIndex >= segment.slotStart && slotIndex < segment.slotEnd) {
          return segment
        }
      }
    }

    return null
  }

  // Obtenir tous les segments qui chevauchent une cellule LASER (pour affichage côte à côte)
  const getSegmentsForCellLaser = (hour: number, minute: number, roomIndex: number): UISegment[] => {
    const cellDate = new Date(selectedDate)
    cellDate.setHours(hour, minute, 0, 0)
    const cellDateEnd = new Date(cellDate)
    cellDateEnd.setMinutes(cellDateEnd.getMinutes() + 15)
    
    const selectedBranch = branches.find(b => b.id === selectedBranchId)
    const branchLaserRooms = selectedBranch?.laserRooms || []
    
    // Trier les laser rooms par sort_order
    const sortedLaserRooms = [...branchLaserRooms]
      .filter(r => r.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
    
    if (roomIndex >= sortedLaserRooms.length) return []
    
    const targetRoom = sortedLaserRooms[roomIndex]
    const segments: UISegment[] = []
    
    // IMPORTANT : Utiliser allBookings (toutes les réservations) au lieu de bookings (filtré par date)
    // car une réservation peut avoir start_datetime sur une autre date mais des sessions LASER sur cette date
    // Exemple : EVENT avec salle le 1er janvier mais sessions LASER le 2 janvier
    const dateStr = formatDateToString(selectedDate)
    
    // Chercher TOUS les bookings avec sessions LASER qui chevauchent ce créneau ET sont sur cette date
    const relevantBookings = allBookings.filter(b => {
      // Vérifier qu'il y a des game_sessions LASER
      if (!b.game_sessions || b.game_sessions.length === 0) return false
      
      // Trouver toutes les sessions LASER qui chevauchent ce créneau ET sont sur cette date
      const overlappingLaserSessions = b.game_sessions.filter(s => {
        if (s.game_area !== 'LASER') return false
        const sessionDate = extractLocalDateFromISO(s.start_datetime)
        // Vérifier que la session est sur la date sélectionnée
        if (sessionDate !== dateStr) return false
        // Vérifier que la session chevauche le créneau de la cellule
        const sessionStart = new Date(s.start_datetime)
        const sessionEnd = new Date(s.end_datetime)
        return sessionStart < cellDateEnd && sessionEnd > cellDate
      })
      
      return overlappingLaserSessions.length > 0
    })
    
    for (const booking of relevantBookings) {
      // Vérifier si le booking a des game_sessions LASER
      if (booking.game_sessions && booking.game_sessions.length > 0) {
        // Trouver toutes les sessions LASER de ce booking qui chevauchent ce créneau
        const overlappingSessions = booking.game_sessions.filter(session => {
          if (session.game_area !== 'LASER') return false
          const sessionStart = new Date(session.start_datetime)
          const sessionEnd = new Date(session.end_datetime)
          return sessionStart < cellDateEnd && sessionEnd > cellDate
        })
        
        if (overlappingSessions.length === 0) continue
        
        // Vérifier si une de ces sessions utilise la salle cible
        const sessionForThisRoom = overlappingSessions.find(s => s.laser_room_id === targetRoom.id)
        if (!sessionForThisRoom) continue
        
        // Trouver toutes les salles utilisées par ce booking pour ce créneau
        const usedRoomIds = new Set(overlappingSessions.map(s => s.laser_room_id).filter(Boolean))
        const usedRooms = sortedLaserRooms.filter(r => usedRoomIds.has(r.id))
        
        if (usedRooms.length === 0) continue
        
        // Trier les salles utilisées par sort_order pour déterminer slotStart et slotEnd
        usedRooms.sort((a, b) => a.sort_order - b.sort_order)
        const firstRoomIndex = sortedLaserRooms.findIndex(r => r.id === usedRooms[0].id)
        const lastRoomIndex = sortedLaserRooms.findIndex(r => r.id === usedRooms[usedRooms.length - 1].id)
        
        // Utiliser la première session pour les dates (toutes les sessions ont les mêmes dates pour une même réservation)
        const sessionStart = new Date(sessionForThisRoom.start_datetime)
        const sessionEnd = new Date(sessionForThisRoom.end_datetime)
        
        // Créer le segment fusionné pour toutes les salles du groupe
        // Le segment s'étend de firstRoomIndex à lastRoomIndex
        const segment: UISegment = {
          segmentId: `${booking.id}-laser-merged-${firstRoomIndex}-${lastRoomIndex}`,
          bookingId: booking.id,
          booking,
          start: sessionStart,
          end: sessionEnd,
          slotStart: firstRoomIndex,
          slotEnd: lastRoomIndex + 1, // +1 car slotEnd est exclusif
          slotsKey: `laser-${firstRoomIndex}-${lastRoomIndex}`,
          isOverbooked: false // Laser n'a pas d'overbooking
        }
        
        segments.push(segment)
      }
    }
    
    // Trier les segments par bookingId pour un affichage stable
    segments.sort((a, b) => a.bookingId.localeCompare(b.bookingId))
    
    return segments
  }

  // Fonction de compatibilité : retourne le premier segment (pour le code existant)
  const getSegmentForCellLaser = (hour: number, minute: number, roomIndex: number): UISegment | null => {
    const segments = getSegmentsForCellLaser(hour, minute, roomIndex)
    return segments.length > 0 ? segments[0] : null
  }

  // Vérifier si un créneau contient un segment pour GRID ROOMS (rooms uniquement)
  const getSegmentForCellRooms = (hour: number, minute: number, roomIndex: number): UISegment | null => {
    const cellTime = hour * 60 + minute
    const cellDate = new Date(selectedDate)
    cellDate.setHours(hour, minute, 0, 0)
    const cellDateEnd = new Date(cellDate)
    cellDateEnd.setMinutes(cellDateEnd.getMinutes() + 15)
    
    const selectedBranch = branches.find(b => b.id === selectedBranchId)
    const branchRooms = selectedBranch?.rooms || []
    
    for (let i = bookings.length - 1; i >= 0; i--) {
      const booking = bookings[i]
      // RÈGLE BÉTON : Rooms = uniquement EVENT
      if (booking.type !== 'EVENT') continue
      if (!booking.event_room_id) continue

      const bookingRoom = branchRooms.find(r => r.id === booking.event_room_id)
      if (!bookingRoom) continue

      const sortedRooms = [...branchRooms]
        .filter(r => r.is_active)
        .sort((a, b) => a.sort_order - b.sort_order)
      
      const bookingRoomIndex = sortedRooms.findIndex(r => r.id === booking.event_room_id)
      if (bookingRoomIndex !== roomIndex) continue

      // Pour les événements, afficher la salle d'événement pendant toute sa durée
      // IMPORTANT : La grille ROOMS affiche la réservation de la salle
      // Les sessions ACTIVE apparaissent dans la grille ACTIVE, les sessions LASER dans la grille LASER
      // On affiche la salle pendant toute sa durée (start_datetime à end_datetime) pour montrer qu'elle est réservée
      const startTime = new Date(booking.start_datetime)
      const endTime = new Date(booking.end_datetime)
      const bookingStartMinutes = startTime.getHours() * 60 + startTime.getMinutes()
      const bookingEndMinutes = endTime.getHours() * 60 + endTime.getMinutes()
      
      if (cellTime >= bookingStartMinutes && cellTime < bookingEndMinutes) {
        // Retourner un segment pour la salle d'événement
        return {
          segmentId: `${booking.id}-room-${roomIndex}`,
          bookingId: booking.id,
          booking,
          start: startTime,
          end: endTime,
          slotStart: roomIndex,
          slotEnd: roomIndex + 1,
          slotsKey: `room-${roomIndex}`,
          isOverbooked: false // Rooms n'ont pas d'overbooking
        }
      }
    }
    return null
  }

  // Calculer les dimensions d'une réservation (nombre de créneaux horaires et de slots)
  const getBookingDimensions = (booking: BookingWithSlots, isRoom: boolean): {
    timeSlots: number // Nombre de créneaux horaires (30 min chacun)
    slotCount: number // Nombre de slots verticaux
    startTimeSlotIndex: number // Index du premier créneau horaire
    startSlotIndex: number // Index du premier slot vertical
  } => {
    const startTime = new Date(booking.game_start_datetime || booking.start_datetime)
    const endTime = new Date(booking.game_end_datetime || booking.end_datetime)
    const bookingStartMinutes = startTime.getHours() * 60 + startTime.getMinutes()
    const bookingEndMinutes = endTime.getHours() * 60 + endTime.getMinutes()
    
    // Calculer le nombre de créneaux horaires (chaque créneau = 30 min)
    const durationMinutes = bookingEndMinutes - bookingStartMinutes
    const numberOfTimeSlots = Math.ceil(durationMinutes / 30)
    
    // Trouver l'index du premier créneau horaire dans timeSlots (le tableau défini plus bas)
    // Note: Cette fonction est appelée avant la déclaration de timeSlots, donc on ne peut pas l'utiliser ici
    // Cette logique semble obsolète, on la commente pour l'instant
    // const startHour = Math.floor(bookingStartMinutes / 60)
    // const startMinute = bookingStartMinutes % 60
    // const startTimeSlotIndex = timeSlots.findIndex(ts => ts.hour === startHour && ts.minute === startMinute)
    
    let slotCount = 1
    let startSlotIndex = 0
    
    if (!isRoom && booking.type === 'GAME') {
      slotCount = Math.ceil(booking.participants_count / 6)
      startSlotIndex = 0 // Les slots commencent toujours à 0 pour les jeux
    } else if (isRoom && booking.type === 'EVENT') {
      slotCount = 1
      // Pour les salles, trouver l'index de la salle
      // On doit trouver quelle salle est utilisée (pour l'instant, on suppose que c'est la première disponible)
      startSlotIndex = 0
    }
    
    return {
      timeSlots: numberOfTimeSlots,
      slotCount,
      startTimeSlotIndex: 0, // Non utilisé pour l'instant
      startSlotIndex
    }
  }


  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Chargement...</p>
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!userData) {
    return null
  }

  const selectedBranchFromUserData = userData.branches.find(b => b.id === selectedBranchId)
  // Récupérer le Branch complet depuis useBranches
  const selectedBranch = branches.find(b => b.id === selectedBranchId) || null
  const isDark = theme === 'dark'

  // Conversion userData vers format AuthUser pour AdminHeader
  // Utiliser les branches complètes de useBranches pour avoir toutes les propriétés
  const authUserBranches = branches.filter(b => 
    userData?.branches.some(ub => ub.id === b.id)
  )

  const authUser = userData ? {
    id: userData.id,
    email: userData.email,
    role: userData.role as any,
    profile: userData.profile as any, // Cast pour compatibilité
    branches: authUserBranches,
    isSuperAdmin: userData.role === 'super_admin',
    isBranchAdmin: userData.role === 'branch_admin',
    isAgent: userData.role === 'agent',
  } : null

  // Récupérer les salles et settings de la branche sélectionnée
  const branchWithDetails = branches.find(b => b.id === selectedBranchId)
  const branchRooms = branchWithDetails?.rooms || []
  const branchSettings = branchWithDetails?.settings || null

  // Fonction helper pour formater l'heure (HH:mm)
  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  // Classes CSS pour l'affichage selon les paramètres
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

  const getTextAlignClass = (align: string) => {
    switch (align) {
      case 'left': return 'text-left'
      case 'center': return 'text-center'
      case 'right': return 'text-right'
      default: return 'text-left'
    }
  }

  // Générer les créneaux horaires (toutes les 15 minutes pour la précision)
  // Mais on affichera visuellement seulement les bordures de 30 minutes
  const timeSlots: { hour: number; minute: number; label: string }[] = []
  for (let h = 10; h <= 22; h++) {
    for (const m of [0, 15, 30, 45]) {
      timeSlots.push({
        hour: h,
        minute: m,
        label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      })
    }
  }


  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      {/* Header avec navigation */}
      {!loading && authUser && selectedBranch && (
        <AdminHeader
          user={authUser}
          branches={branches}
          selectedBranch={selectedBranch}
          onBranchSelect={(branchId) => {
            branchesHook.selectBranch(branchId) // Utiliser selectBranch du hook pour synchroniser avec le CRM
            setShowBranchMenu(false)
          }}
          onSignOut={handleSignOut}
          theme={theme}
          onToggleTheme={toggleTheme}
          rooms={branchRooms}
        />
      )}

      {/* Contenu principal */}
      <main className="p-6">
        {/* Barre de recherche */}
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 border ${isDark ? 'border-gray-700' : 'border-gray-200'} mb-6`}>
          <div className="flex items-start gap-4">
            <div className="flex-1 relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
              <input
                type="text"
                value={agendaSearchQuery}
                onChange={(e) => setAgendaSearchQuery(e.target.value)}
                placeholder="Rechercher un rendez-vous (nom client, date, heure, référence)..."
                className={`w-full pl-10 pr-4 py-3 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg text-base placeholder-gray-500 focus:border-blue-500 focus:outline-none`}
              />
            </div>
            
            {/* Liste des résultats de recherche */}
            {agendaSearchQuery && searchResults.length > 0 && (
              <div className={`w-96 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'} rounded-lg shadow-xl max-h-96 overflow-y-auto`}>
                <div className={`px-3 py-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} ${isDark ? 'text-white' : 'text-gray-900'} font-semibold text-sm`}>
                  {searchResults.length} résultat{searchResults.length > 1 ? 's' : ''} trouvé{searchResults.length > 1 ? 's' : ''}
                </div>
                <div className="divide-y divide-gray-700">
                  {searchResults.map((booking) => {
                    const bookingDate = new Date(booking.start_datetime)
                    const dateFormatted = bookingDate.toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })
                    const timeFormatted = `${String(bookingDate.getHours()).padStart(2, '0')}:${String(bookingDate.getMinutes()).padStart(2, '0')}`
                    const contactData = getContactDisplayData(booking)
                    const customerName = `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim() || 'Sans nom'
                    
                    return (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => {
                          setSelectedDate(bookingDate)
                          setCalendarMonth(bookingDate.getMonth())
                          setCalendarYear(bookingDate.getFullYear())
                          setAgendaSearchQuery('')
                          // Ouvrir le modal de la réservation
                          openBookingModal(undefined, undefined, booking)
                        }}
                        className={`w-full text-left px-3 py-2 ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} truncate`}>
                              {customerName}
                            </div>
                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-0.5`}>
                              {dateFormatted} à {timeFormatted}
                            </div>
                            {booking.reference_code && (
                              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-0.5`}>
                                Ref: {booking.reference_code}
                              </div>
                            )}
                          </div>
                          <div className="flex-shrink-0">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: booking.color || (booking.type === 'EVENT' ? '#22c55e' : '#3b82f6') }}
                            />
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            
            {/* Message si aucun résultat */}
            {agendaSearchQuery && searchResults.length === 0 && (
              <div className={`w-96 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'} rounded-lg shadow-xl px-4 py-3 ${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>
                Aucun rendez-vous trouvé
              </div>
            )}
          </div>
        </div>

        {/* Statistiques Agenda (Jour, Semaine, Mois) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Jour */}
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-4 border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-base mb-2`}>
              {stats.day.dateStr}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>Avec salle:</span>
                <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.day.withRoom}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>Sans salle:</span>
                <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.day.withoutRoom}</span>
              </div>
              <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm font-semibold`}>Total personnes:</span>
                <span className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{stats.day.totalParticipants}</span>
              </div>
            </div>
          </div>
          
          {/* Semaine */}
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-4 border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-base mb-2`}>
              Semaine ({stats.week.period})
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>Avec salle:</span>
                <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.week.withRoom}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>Sans salle:</span>
                <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.week.withoutRoom}</span>
              </div>
              <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm font-semibold`}>Total personnes:</span>
                <span className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{stats.week.totalParticipants}</span>
              </div>
            </div>
          </div>
          
          {/* Mois */}
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-4 border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-base mb-2`}>
              Mois ({stats.month.period})
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>Avec salle:</span>
                <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.month.withRoom}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>Sans salle:</span>
                <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.month.withoutRoom}</span>
              </div>
              <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm font-semibold`}>Total personnes:</span>
                <span className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{stats.month.totalParticipants}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation de date */}
        <div className="flex items-center justify-between mb-6 gap-4">
          {/* GAUCHE : Boutons Paramètres + Boutons de rétractation */}
          <div className="flex gap-2">
            {/* Bouton Paramètres de la branche */}
            <button
              onClick={() => setShowBranchSettingsModal(true)}
              className={`p-2 rounded-lg transition-colors ${
                isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title="Paramètres de la branche"
            >
              <Settings className="w-5 h-5" />
            </button>
            
            {/* Bouton Paramètres de la grille */}
            <button
              onClick={() => setShowGridSettingsModal(true)}
              className={`p-2 rounded-lg transition-colors ${
                isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title="Paramètres d'affichage de la grille"
            >
              <Sliders className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setVisibleGrids(prev => ({ ...prev, active: !prev.active }))}
              className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                visibleGrids.active
                  ? isDark
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-500 text-white'
                  : isDark
                    ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              ACTIVE
            </button>
            <button
              onClick={() => setVisibleGrids(prev => ({ ...prev, laser: !prev.laser }))}
              className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                visibleGrids.laser
                  ? isDark
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-500 text-white'
                  : isDark
                    ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              LASER
            </button>
            <button
              onClick={() => setVisibleGrids(prev => ({ ...prev, rooms: !prev.rooms }))}
              className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                visibleGrids.rooms
                  ? isDark
                    ? 'bg-green-600 text-white'
                    : 'bg-green-500 text-white'
                  : isDark
                    ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              ROOMS
            </button>
          </div>

          {/* CENTRE : Date sélectionnée avec flèches jour précédent/suivant + bouton Aujourd'hui + Icône calendrier */}
          <div className="flex items-center gap-2 flex-1 justify-center">
            {/* Icône calendrier */}
            <div className="relative">
              <button
                onClick={() => setShowCalendarModal(!showCalendarModal)}
                className={`p-2 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} border ${isDark ? 'border-gray-700' : 'border-gray-300'} rounded-lg transition-all`}
                title="Ouvrir le calendrier"
              >
                <Calendar className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
              </button>

              {/* Modal Calendrier */}
              {showCalendarModal && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowCalendarModal(false)}
                  />
                  <div className={`absolute left-0 top-12 z-50 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'} rounded-lg shadow-xl p-4 min-w-[280px]`}>
                    {/* Navigation Mois/Année */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={handlePreviousYear}
                        className={`p-1 ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} rounded hover:opacity-80 transition-all`}
                        title="Année précédente"
                      >
                        <div className="relative w-4 h-4">
                          <ChevronLeft className={`w-4 h-4 ${isDark ? 'text-white' : 'text-gray-900'} absolute`} />
                          <ChevronLeft className={`w-4 h-4 ${isDark ? 'text-white' : 'text-gray-900'} absolute left-1`} />
                        </div>
                      </button>
                      <button
                        onClick={handlePreviousMonth}
                        className={`p-1 ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} rounded hover:opacity-80 transition-all`}
                        title="Mois précédent"
                      >
                        <ChevronLeft className={`w-4 h-4 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                      </button>
                      <div className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'} px-4`}>
                        {monthNames[calendarMonth]} {calendarYear}
                      </div>
                      <button
                        onClick={handleNextMonth}
                        className={`p-1 ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} rounded hover:opacity-80 transition-all`}
                        title="Mois suivant"
                      >
                        <ChevronRight className={`w-4 h-4 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                      </button>
                      <button
                        onClick={handleNextYear}
                        className={`p-1 ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} rounded hover:opacity-80 transition-all`}
                        title="Année suivante"
                      >
                        <div className="relative w-4 h-4">
                          <ChevronRight className={`w-4 h-4 ${isDark ? 'text-white' : 'text-gray-900'} absolute`} />
                          <ChevronRight className={`w-4 h-4 ${isDark ? 'text-white' : 'text-gray-900'} absolute left-1`} />
                        </div>
                      </button>
                    </div>

                    {/* Grille calendrier */}
                    <div className="grid grid-cols-7 gap-1">
                      {/* En-têtes jours */}
                      {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
                        <div key={i} className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} text-center p-1 font-bold`}>
                          {day}
                        </div>
                      ))}
                      {/* Jours */}
                      {calendarDays.map((date, i) => {
                        if (!date) {
                          return <div key={`empty-${i}`} className="p-2"></div>
                        }
                        const isToday = date.toDateString() === new Date().toDateString()
                        const isSelected = date.toDateString() === selectedDate.toDateString()
                        
                        return (
                          <button
                            key={i}
                            onClick={() => handleCalendarDateClick(date)}
                            className={`p-2 rounded text-sm transition-all ${
                              isSelected
                                ? `${isDark ? 'bg-blue-600/30' : 'bg-blue-100'} ${isDark ? 'text-blue-400' : 'text-blue-600'} font-bold`
                                : isToday
                                ? `${isDark ? 'bg-blue-500/20' : 'bg-blue-50'} ${isDark ? 'text-blue-400' : 'text-blue-600'}`
                                : `${isDark ? 'text-white hover:bg-gray-700' : 'text-gray-900 hover:bg-gray-100'}`
                            }`}
                          >
                            {date.getDate()}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Flèche jour précédent */}
            <button
              onClick={goToPrevDay}
              className={`p-2 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} border ${isDark ? 'border-gray-700' : 'border-gray-300'} rounded-lg transition-all`}
            >
              <ChevronLeft className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
            </button>
            
            {/* Date sélectionnée */}
            <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'} min-w-[200px] text-center`}>
              {formatDateFull(selectedDate)}
            </div>
            
            {/* Flèche jour suivant */}
            <button
              onClick={goToNextDay}
              className={`p-2 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} border ${isDark ? 'border-gray-700' : 'border-gray-300'} rounded-lg transition-all`}
            >
              <ChevronRight className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
            </button>
            
            {/* Bouton Aujourd'hui */}
            <button
              onClick={goToToday}
              className={`px-3 py-2 ${isDark ? 'bg-blue-600/20 border-blue-500/50 hover:bg-blue-600/30' : 'bg-blue-100 border-blue-300 hover:bg-blue-200'} border rounded-lg transition-all text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
            >
              Aujourd'hui
            </button>
          </div>

          {/* DROITE : Jours de la semaine avec navigation semaine */}
          <div className="flex items-center gap-2">
            {/* Flèche gauche : semaine précédente */}
            <button
              onClick={handlePreviousWeek}
              className={`p-2 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} border ${isDark ? 'border-gray-700' : 'border-gray-300'} rounded-lg transition-all`}
              title="Semaine précédente"
            >
              <ChevronLeft className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
            </button>
            
            {/* Jours de la semaine */}
            <div className="flex gap-2">
              {getWeekDays().map((day, index) => {
                const isToday = day.toDateString() === new Date().toDateString()
                const isSelected = day.toDateString() === selectedDate.toDateString()
                return (
                  <button
                    key={index}
                    onClick={() => handleWeekDayClick(day)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? `${isDark ? 'bg-blue-600/20 border-blue-500' : 'bg-blue-100 border-blue-500'} ${isDark ? 'text-blue-400' : 'text-blue-600'} font-bold`
                        : isToday
                        ? `${isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-300'} ${isDark ? 'text-blue-400' : 'text-blue-600'}`
                        : `${isDark ? 'bg-gray-800 border-gray-700 text-white hover:bg-gray-700' : 'bg-gray-200 border-gray-300 text-gray-900 hover:bg-gray-300'}`
                    }`}
                  >
                    <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} leading-tight`}>
                      {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                    </div>
                    <div className={`text-sm font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {day.getDate()}
                    </div>
                  </button>
                )
              })}
            </div>
            
            {/* Flèche droite : semaine suivante */}
            <button
              onClick={handleNextWeek}
              className={`p-2 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} border ${isDark ? 'border-gray-700' : 'border-gray-300'} rounded-lg transition-all`}
              title="Semaine suivante"
            >
              <ChevronRight className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
            </button>
          </div>
        </div>

        {/* Erreur */}
        {bookingsError && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
            {bookingsError}
          </div>
        )}

        {/* Grille de l'agenda */}
        <div className={`rounded-xl overflow-hidden relative ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={{ 
          position: 'relative',
          border: `2px solid ${isDark ? '#374151' : '#e5e7eb'}`, // Même épaisseur que les cellules (2px)
          width: '100%',
          maxWidth: '100%'
        }}>
          {/* Loader sur la grille */}
          {bookingsLoading && (
            <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          )}

          {/* 3 Grilles séparées côte à côte */}
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
                  Heure
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
                    const bookingStartTime = booking ? (booking.game_start_datetime ? new Date(booking.game_start_datetime) : new Date(booking.start_datetime)) : null
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

                    return (
                      <div
                        key={`cell-slot-${timeIndex}-${slotIndex}`}
                        onClick={() => booking ? openBookingModal(slot.hour, slot.minute, booking) : openBookingModal(slot.hour, slot.minute, undefined, 'GAME')}
                        className={`cursor-pointer relative ${
                          booking
                            ? `flex items-center justify-center p-2 text-center`
                            : `p-2 ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`
                        }`}
                        style={{
                          gridColumn: booking ? `${gridColumn} / ${gridColumn + colSpan}` : gridColumn,
                          gridRow: booking ? `${gridRow} / ${gridRow + rowSpan}` : gridRow,
                          backgroundColor: booking ? (booking.color || (booking.type === 'EVENT' ? '#22c55e' : '#3b82f6')) : 'transparent',
                          // Quadrillage complet + contour gris pour les réservations
                          borderTop: shouldShowTopBorder ? `2px solid ${borderTopColor}` : 'none',
                          borderBottom: borderBottomColor !== 'none' ? `2px solid ${borderBottomColor}` : 'none',
                          borderLeft: showLeftBorder && borderLeftColor !== 'none' ? `2px solid ${borderLeftColor}` : 'none',
                          borderRight: showRightBorder && borderRightColor !== 'none' ? `2px solid ${borderRightColor}` : 'none',
                        }}
                        title={booking ? (() => {
                          const contactData = getContactDisplayData(booking)
                          return `${contactData.firstName} ${contactData.lastName || ''}`.trim() || 'Sans nom'
                        })() + ` - ${booking.participants_count} pers.` : ''}
                      >
                        {/* Badge OB supprimé - la colonne OB est la source de vérité */}
                        {booking && showDetails && (
                          <div className={`${getTextSizeClass(displayTextSize)} ${getTextWeightClass(displayTextWeight)} leading-tight ${isDark ? 'text-white' : 'text-white'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                            {(() => {
                              const contactData = getContactDisplayData(booking)
                              const name = contactData.firstName || 'Sans nom'
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
                              
                              return (
                                <div
                                  key={`laser-cell-${timeIndex}-${roomIndex}`}
                                  onClick={() => openBookingModal(slot.hour, slot.minute, undefined, 'GAME', 'LASER')}
                                  className={`cursor-pointer relative ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}
                                  style={{
                                    gridColumn,
                                    gridRow,
                                    backgroundColor: 'transparent',
                                    // Ne pas afficher borderTop si on est à l'intérieur d'une réservation
                                    borderTop: shouldShowTopBorder ? `2px solid ${isDark ? '#374151' : '#e5e7eb'}` : 'none',
                                    borderBottom: 'none',
                                    borderLeft: `2px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                                    borderRight: `2px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                                  }}
                                />
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
                                          return `${contactData.firstName} ${contactData.lastName || ''}`.trim() || 'Sans nom'
                                        })() + ` - ${booking.participants_count} pers.`}
                                      >
                                        <div 
                                          className={`${getTextSizeClass(displayTextSize)} ${getTextWeightClass(displayTextWeight)} leading-tight text-white whitespace-nowrap overflow-hidden text-ellipsis px-1`}
                                          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                                        >
                                          {(() => {
                                            const contactData = getContactDisplayData(booking)
                                            const name = contactData.firstName || 'Sans nom'
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
                  Heure
                </div>
                {branchRooms
                  .filter(r => r.is_active)
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((room, i) => {
                    const roomName = room.name || `Salle ${i + 1}`
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
                    const roomBookingStartTime = booking ? new Date(booking.start_datetime) : null
                    const roomDisplayTime = roomBookingStartTime ? formatTime(roomBookingStartTime) : ''

                    return (
                      <div
                        key={`cell-room-${timeIndex}-${roomIndex}`}
                        onClick={() => booking ? openBookingModal(slot.hour, slot.minute, booking) : openBookingModal(slot.hour, slot.minute, undefined, 'EVENT')}
                        className={`cursor-pointer ${
                          booking
                            ? `flex flex-col items-center justify-center p-1 text-center`
                            : `${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`
                        }`}
                        style={{
                          gridColumn: segment ? `${gridColumn} / ${gridColumn + colSpan}` : gridColumn,
                          gridRow: segment ? `${gridRow} / ${gridRow + rowSpan}` : gridRow,
                          backgroundColor: segment && booking ? (booking.color || '#22c55e') : 'transparent',
                          // Quadrillage complet + contour gris pour les réservations
                          borderTop: borderTopColor !== 'none' ? `2px solid ${borderTopColor}` : 'none',
                          borderBottom: borderBottomColor !== 'none' ? `2px solid ${borderBottomColor}` : 'none',
                          borderLeft: showLeftBorder && borderLeftColor !== 'none' ? `2px solid ${borderLeftColor}` : 'none',
                          borderRight: showRightBorder && borderRightColor !== 'none' ? `2px solid ${borderRightColor}` : 'none',
                        }}
                        title={booking ? (() => {
                          const contactData = getContactDisplayData(booking)
                          return `${contactData.firstName} ${contactData.lastName || ''}`.trim() || 'Sans nom'
                        })() + ` - ${booking.participants_count} pers.` : ''}
                      >
                        {booking && (
                          <>
                            <div className={`${getTextSizeClass(displayTextSize)} ${getTextWeightClass(displayTextWeight)} leading-tight ${isDark ? 'text-white' : 'text-white'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                              {(() => {
                                const contactData = getContactDisplayData(booking)
                                return contactData.firstName || 'Sans nom'
                              })()}
                            </div>
                            <div className={`${getTextSizeClass(displayTextSize)} ${getTextWeightClass(displayTextWeight)} leading-tight ${isDark ? 'text-white/95' : 'text-white/95'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                              {booking.participants_count} pers.
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
        </div>
      </main>

      {/* Popup Paramètres de grille - petit popup non-bloquant */}
      {showGridSettingsModal && (
        <>
          {/* Zone cliquable transparente pour fermer */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setShowGridSettingsModal(false)}
          />
          <div className="fixed top-20 left-4 z-50 w-80">
            <div className={`rounded-xl shadow-2xl border-2 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Paramètres
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowGridSettingsModal(false)
                    }}
                    className={`p-1 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              
              {/* Largeur ACTIVE */}
              <div className="mb-3">
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Largeur ACTIVE: {gridWidths.active}%
                </label>
                <input
                  type="range"
                  min="5"
                  max="500"
                  step="5"
                  value={gridWidths.active}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value)
                    setGridWidths(prev => ({ ...prev, active: newValue }))
                    // Sauvegarde automatique
                    if (selectedBranchId) {
                      localStorage.setItem(`gridSettings_${selectedBranchId}`, JSON.stringify({ 
                        gridWidths: { ...gridWidths, active: newValue }, 
                        rowHeight 
                      }))
                    }
                  }}
                  className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className={`flex justify-between text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <span>5%</span>
                  <span>100% (normal)</span>
                  <span>500%</span>
                </div>
              </div>
              
              {/* Largeur LASER */}
              <div className="mb-3">
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Largeur LASER: {gridWidths.laser}%
                </label>
                <input
                  type="range"
                  min="5"
                  max="800"
                  step="5"
                  value={gridWidths.laser}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value)
                    setGridWidths(prev => ({ ...prev, laser: newValue }))
                    // Sauvegarde automatique
                    if (selectedBranchId) {
                      localStorage.setItem(`gridSettings_${selectedBranchId}`, JSON.stringify({ 
                        gridWidths: { ...gridWidths, laser: newValue }, 
                        rowHeight 
                      }))
                    }
                  }}
                  className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className={`flex justify-between text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <span>5%</span>
                  <span>100% (normal)</span>
                  <span>800%</span>
                </div>
              </div>
              
              {/* Largeur ROOMS */}
              <div className="mb-3">
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Largeur ROOMS: {gridWidths.rooms}%
                </label>
                <input
                  type="range"
                  min="5"
                  max="500"
                  step="5"
                  value={gridWidths.rooms}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value)
                    setGridWidths(prev => ({ ...prev, rooms: newValue }))
                    // Sauvegarde automatique
                    if (selectedBranchId) {
                      localStorage.setItem(`gridSettings_${selectedBranchId}`, JSON.stringify({ 
                        gridWidths: { ...gridWidths, rooms: newValue }, 
                        rowHeight 
                      }))
                    }
                  }}
                  className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className={`flex justify-between text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <span>5%</span>
                  <span>100% (normal)</span>
                  <span>500%</span>
                </div>
              </div>
              
              {/* Hauteur des lignes */}
              <div className="mb-4">
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Hauteur lignes: {rowHeight}px
                </label>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={rowHeight}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value)
                    setRowHeight(newValue)
                    // Sauvegarde automatique
                    if (selectedBranchId) {
                      localStorage.setItem(`gridSettings_${selectedBranchId}`, JSON.stringify({ 
                        gridWidths, 
                        rowHeight: newValue 
                      }))
                    }
                  }}
                  className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              
              {/* Bouton Réinitialiser */}
              <button
                onClick={() => {
                  setGridWidths({ active: 100, laser: 100, rooms: 100 })
                  setRowHeight(20)
                  // Sauvegarder les valeurs par défaut
                  if (selectedBranchId) {
                    localStorage.setItem(`gridSettings_${selectedBranchId}`, JSON.stringify({ 
                      gridWidths: { active: 100, laser: 100, rooms: 100 }, 
                      rowHeight: 20 
                    }))
                  }
                }}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
        </>
      )}

      {/* Modal Paramètres de la branche */}
      {showBranchSettingsModal && selectedBranchId && (
        <SettingsModal
          isOpen={showBranchSettingsModal}
          onClose={() => setShowBranchSettingsModal(false)}
          branchId={selectedBranchId}
          rooms={branchRooms}
          settings={branchSettings}
          onUpdate={async () => {
            // Rafraîchir les données de la branche après mise à jour des paramètres
            await refreshBranches()
            await refreshAllBookings()
            setShowBranchSettingsModal(false)
          }}
          isDark={isDark}
        />
      )}

      {/* Modal de réservation */}
      {selectedBranchId && (
        <BookingModal
          isOpen={showBookingModal}
          onClose={() => {
            setShowBookingModal(false)
            setEditingBooking(null)
          }}
          onSubmit={handleSubmitBooking}
          onDelete={handleDeleteBooking}
          branchId={selectedBranchId || ''}
          selectedDate={selectedDate}
          initialHour={modalInitialHour}
          initialMinute={modalInitialMinute}
          editingBooking={editingBooking}
          isDark={isDark}
          defaultBookingType={modalDefaultBookingType}
          defaultGameArea={modalDefaultGameArea}
          findBestAvailableRoom={findBestAvailableRoom}
          findRoomAvailability={findRoomAvailability}
          calculateOverbooking={calculateOverbooking}
          branches={branches.filter((branch, index, self) => 
            index === self.findIndex(b => b.id === branch.id)
          )}
          selectedBranchId={selectedBranchId}
          findBestLaserRoom={findBestLaserRoom}
          checkLaserVestsConstraint={checkLaserVestsConstraint}
          checkLaserRoomCapacity={checkLaserRoomCapacity}
          laserRooms={laserRooms}
          maxPlayersPerSlot={MAX_PLAYERS_PER_SLOT}
          totalSlots={TOTAL_SLOTS}
        />
      )}

      {/* Modal de confirmation */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        onClose={() => setConfirmationModal({ ...confirmationModal, isOpen: false })}
        onConfirm={confirmationModal.onConfirm}
        title={confirmationModal.title}
        message={confirmationModal.message}
        type={confirmationModal.type}
        isDark={theme === 'dark'}
      />
    </div>
  )
}
