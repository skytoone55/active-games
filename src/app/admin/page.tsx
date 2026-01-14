'use client'

import { useState, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, LogOut, User, ChevronDown, Sun, Moon, ChevronLeft, ChevronRight, Calendar, Users, PartyPopper, Gamepad2, Search, Trash2, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useBookings, type BookingWithSlots, type CreateBookingData } from '@/hooks/useBookings'
import { BookingModal } from './components/BookingModal'
import { SettingsModal } from './components/SettingsModal'
import { useBranches } from '@/hooks/useBranches'
import type { Profile, UserBranch } from '@/lib/supabase/types'

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
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>('dark')
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
  const [editingBooking, setEditingBooking] = useState<BookingWithSlots | null>(null)
  const [agendaSearchQuery, setAgendaSearchQuery] = useState('')
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  
  // Paramètres d'affichage du texte (chargés depuis localStorage)
  const [displayTextSize, setDisplayTextSize] = useState<'xs' | 'sm' | 'base' | 'lg'>('sm')
  const [displayTextWeight, setDisplayTextWeight] = useState<'normal' | 'semibold' | 'bold'>('bold')
  const [displayTextAlign, setDisplayTextAlign] = useState<'left' | 'center' | 'right'>('left')

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
    }
  }, [selectedBranchId, showSettingsModal])

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

  // Hook pour récupérer les salles et settings de la branche
  // IMPORTANT: Doit être appelé avant les early returns pour respecter les règles des hooks React
  const { branches, refresh: refreshBranches } = useBranches()

  // Filtrer les réservations pour l'agenda du jour sélectionné
  const dateStr = formatDateToString(selectedDate)
  const bookings = allBookings.filter(b => {
    const bookingDate = extractLocalDateFromISO(b.start_datetime)
    return bookingDate === dateStr
  })

  // Ouvrir le modal de réservation
  const openBookingModal = (hour?: number, minute?: number, booking?: BookingWithSlots) => {
    if (booking) {
      setEditingBooking(booking)
      // Extraire l'heure de début de la réservation
      const startTime = new Date(booking.game_start_datetime || booking.start_datetime)
      setModalInitialHour(startTime.getHours())
      setModalInitialMinute(startTime.getMinutes())
    } else {
      setEditingBooking(null)
      setModalInitialHour(hour ?? 10)
      setModalInitialMinute(minute ?? 0)
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
  const handleDeleteAllBookings = async () => {
    const confirmed = window.confirm(
      '⚠️ ATTENTION : Cette action va supprimer TOUTES les réservations (jeux et événements) de cette branche. Cette action est irréversible.\n\nÊtes-vous sûr de vouloir continuer ?'
    )
    
    if (!confirmed) return

    const success = await deleteAllBookings()
    if (success) {
      // Le rafraîchissement se fait automatiquement dans deleteAllBookings
      // Plus besoin de refreshAllBookings car on utilise maintenant un seul hook
      alert('Toutes les réservations ont été supprimées. Le système est maintenant à zéro.')
    } else {
      alert('Erreur lors de la suppression de toutes les réservations.')
    }
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

        if (branches.length > 0) {
          setSelectedBranchId(branches[0].id)
        }
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

  // Filtrer les résultats de recherche
  const searchResults = agendaSearchQuery
    ? bookings.filter((b) => {
        const searchLower = agendaSearchQuery.toLowerCase()
        const customerName = `${b.customer_first_name || ''} ${b.customer_last_name || ''}`.toLowerCase().trim()
        const bookingDate = extractLocalDateFromISO(b.start_datetime)
        const startTime = new Date(b.start_datetime)
        const timeStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`
        const notes = (b.notes || '').toLowerCase()
        const customerPhone = (b.customer_phone || '').toLowerCase()
        const customerEmail = (b.customer_email || '').toLowerCase()
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

  // Fonction pour trouver la meilleure salle disponible pour un événement
  const findBestAvailableRoom = (
    participants: number,
    startDateTime: Date,
    endDateTime: Date
  ): string | null => {
    if (!branchRooms || branchRooms.length === 0) return null

    // Trier les salles par capacité croissante (plus petite salle en premier)
    const sortedRooms = [...branchRooms]
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

      for (const booking of bookings) {
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


  // Vérifier si un créneau contient une réservation
  const getBookingForCell = (hour: number, minute: number, slotIndex: number, isRoom: boolean): BookingWithSlots | null => {
    const cellTime = hour * 60 + minute

    // Parcourir les réservations dans l'ordre inverse pour prioriser les plus récentes
    // Cela évite qu'une réservation courte "cache" une réservation longue sur un créneau partiel
    for (let i = bookings.length - 1; i >= 0; i--) {
      const booking = bookings[i]
      // Pour les salles : vérifier les événements (EVENT)
      if (isRoom && booking.type === 'EVENT') {
        // Vérifier que cette réservation utilise une salle
        if (!booking.event_room_id) continue

        // Trouver la salle correspondante et vérifier son sort_order
        const bookingRoom = branchRooms.find(r => r.id === booking.event_room_id)
        if (!bookingRoom) continue

        // Le slotIndex correspond au roomIndex dans l'affichage (basé sur sort_order)
        const sortedRooms = [...branchRooms]
          .filter(r => r.is_active)
          .sort((a, b) => a.sort_order - b.sort_order)
        
        const roomIndex = sortedRooms.findIndex(r => r.id === booking.event_room_id)
        
        // Si la salle demandée (slotIndex) ne correspond pas à la salle de la réservation, ignorer
        if (roomIndex !== slotIndex) continue

        // Utiliser les dates de la salle (start_datetime et end_datetime pour la salle)
        const startTime = new Date(booking.start_datetime)
        const endTime = new Date(booking.end_datetime)
        const bookingStartMinutes = startTime.getHours() * 60 + startTime.getMinutes()
        const bookingEndMinutes = endTime.getHours() * 60 + endTime.getMinutes()
        
        if (cellTime >= bookingStartMinutes && cellTime < bookingEndMinutes) {
          return booking
        }
      }
      
      // Pour les slots : vérifier les jeux (GAME) ET les événements (EVENT)
      if (!isRoom && (booking.type === 'GAME' || booking.type === 'EVENT')) {
        // Utiliser les dates du jeu (game_start_datetime et game_end_datetime)
        const gameStartTime = booking.game_start_datetime ? new Date(booking.game_start_datetime) : new Date(booking.start_datetime)
        const gameEndTime = booking.game_end_datetime ? new Date(booking.game_end_datetime) : new Date(booking.end_datetime)
        const gameStartMinutes = gameStartTime.getHours() * 60 + gameStartTime.getMinutes()
        const gameEndMinutes = gameEndTime.getHours() * 60 + gameEndTime.getMinutes()
        
        // Vérifier si le créneau est dans la plage du jeu
        if (cellTime >= gameStartMinutes && cellTime < gameEndMinutes) {
          // Version simple : chaque réservation prend ses slots nécessaires à partir de S1
          const slotsNeeded = Math.ceil(booking.participants_count / 6)
          if (slotIndex < slotsNeeded) {
            return booking
          }
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
    const timeSlots = Math.ceil(durationMinutes / 30)
    
    // Trouver l'index du premier créneau horaire dans timeSlots
    const startHour = Math.floor(bookingStartMinutes / 60)
    const startMinute = bookingStartMinutes % 60
    const startTimeSlotIndex = timeSlots.findIndex(ts => ts.hour === startHour && ts.minute === startMinute)
    
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
      timeSlots,
      slotCount,
      startTimeSlotIndex,
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

  const selectedBranch = userData.branches.find(b => b.id === selectedBranchId)
  const isDark = theme === 'dark'
  const TOTAL_SLOTS = 14
  const TOTAL_ROOMS = 4

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

  // Générer les créneaux horaires (toutes les 30 minutes)
  const timeSlots: { hour: number; minute: number; label: string }[] = []
  for (let h = 10; h <= 22; h++) {
    for (const m of [0, 30]) {
      timeSlots.push({
        hour: h,
        minute: m,
        label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      })
    }
  }


  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-white">
              Active Games
              <span className="text-blue-400 ml-2">Admin</span>
            </h1>

            {/* Sélecteur d'agence */}
            {userData.branches.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowBranchMenu(!showBranchMenu)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-white"
                >
                  <span>{selectedBranch?.name || 'Sélectionner'}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showBranchMenu ? 'rotate-180' : ''}`} />
                </button>

                {showBranchMenu && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                    {userData.branches.map((branch) => (
                      <button
                        key={branch.id}
                        onClick={() => {
                          setSelectedBranchId(branch.id)
                          setShowBranchMenu(false)
                        }}
                        className={`w-full px-4 py-2 text-left hover:bg-gray-700 ${
                          branch.id === selectedBranchId ? 'bg-blue-600 text-white' : 'text-gray-300'
                        }`}
                      >
                        {branch.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Toggle thème */}
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            {/* Menu utilisateur */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-sm text-white font-medium">
                    {userData.profile?.full_name || userData.email}
                  </div>
                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                    {userData.role === 'super_admin' ? 'Super Admin' :
                     userData.role === 'branch_admin' ? 'Admin Agence' : 'Agent'}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-700">
                    <div className="text-sm text-white font-medium">{userData.profile?.full_name || 'Utilisateur'}</div>
                    <div className="text-xs text-gray-400">{userData.email}</div>
                  </div>
                  <button
                    onClick={() => {
                      setShowSettingsModal(true)
                      setShowUserMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700 flex items-center gap-2 border-b border-gray-700"
                  >
                    <Settings className="w-4 h-4" />
                    Paramètres
                  </button>
                  <button
                    onClick={handleDeleteAllBookings}
                    className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-700 flex items-center gap-2 border-b border-gray-700"
                  >
                    <Trash2 className="w-4 h-4" />
                    Supprimer toutes les réservations
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-700 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

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
                    const customerName = `${booking.customer_first_name || ''} ${booking.customer_last_name || ''}`.trim() || 'Sans nom'
                    
                    return (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => {
                          setSelectedDate(bookingDate)
                          setCalendarMonth(bookingDate.getMonth())
                          setCalendarYear(bookingDate.getFullYear())
                          setAgendaSearchQuery('')
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
          {/* GAUCHE : Jours de la semaine avec navigation semaine */}
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

          {/* MILIEU : Date sélectionnée avec flèches jour précédent/suivant + bouton Aujourd'hui + Icône calendrier */}
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

          {/* DROITE : Nouvelle réservation */}
          <button
            onClick={() => openBookingModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            <Plus className="w-5 h-5" />
            Nouvelle réservation
          </button>
        </div>

        {/* Erreur */}
        {bookingsError && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
            {bookingsError}
          </div>
        )}

        {/* Grille de l'agenda */}
        <div className={`rounded-xl border overflow-hidden relative ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`} style={{ position: 'relative' }}>
          {/* Loader sur la grille */}
          {bookingsLoading && (
            <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          )}

          {/* En-tête */}
          <div className={`grid border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`} style={{
            gridTemplateColumns: `80px repeat(${TOTAL_SLOTS}, 1fr) repeat(${TOTAL_ROOMS}, 1fr)`,
          }}>
            <div className={`p-3 text-center font-medium ${isDark ? 'text-gray-400 bg-gray-900' : 'text-gray-600 bg-gray-50'}`}>
              Heure
            </div>
            {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
              <div key={`slot-${i}`} className={`p-3 text-center font-medium border-l ${isDark ? 'text-blue-400 bg-gray-900 border-gray-700' : 'text-blue-600 bg-gray-50 border-gray-200'}`}>
                S{i + 1}
              </div>
            ))}
            {branchRooms
              .sort((a, b) => a.sort_order - b.sort_order)
              .slice(0, TOTAL_ROOMS)
              .map((room, i) => {
                const roomName = room.name || `Salle ${i + 1}`
                return (
                  <div key={`room-${room.id}`} className={`p-3 text-center font-medium border-l ${isDark ? 'text-green-400 bg-gray-900 border-gray-700' : 'text-green-600 bg-gray-50 border-gray-200'}`}>
                    {roomName}
                  </div>
                )
              })}
          </div>

          {/* Corps - Grille avec réservations intégrées */}
          <div className="grid" style={{
            gridTemplateColumns: `80px repeat(${TOTAL_SLOTS}, 1fr) repeat(${TOTAL_ROOMS}, 1fr)`,
            gridTemplateRows: `repeat(${timeSlots.length}, 40px)`,
          }}>
            {/* Colonne Heure */}
            {timeSlots.map((slot, timeIndex) => (
              <div
                key={`time-${timeIndex}`}
                className={`p-2 text-center text-sm border-b ${isDark ? 'text-gray-500 border-gray-700' : 'text-gray-400 border-gray-200'}`}
                style={{ gridColumn: '1', gridRow: timeIndex + 1 }}
              >
                {slot.minute === 0 ? slot.label : ''}
              </div>
            ))}
            
            {/* Cellules pour les slots et salles */}
            {timeSlots.map((slot, timeIndex) => {
              return (
                <Fragment key={`row-${timeIndex}`}>
                  {/* Slots de jeu */}
                  {Array.from({ length: TOTAL_SLOTS }, (_, slotIndex) => {
                    const booking = getBookingForCell(slot.hour, slot.minute, slotIndex, false)
                    
                    // Déterminer si cette cellule est le début d'une réservation (top-left corner)
                    const isBookingTop = booking && (
                      timeIndex === 0 ||
                      getBookingForCell(timeSlots[timeIndex - 1].hour, timeSlots[timeIndex - 1].minute, slotIndex, false)?.id !== booking.id
                    )
                    const isBookingStart = booking && (
                      slotIndex === 0 || 
                      getBookingForCell(slot.hour, slot.minute, slotIndex - 1, false)?.id !== booking.id
                    )
                    const isBookingEnd = booking && (
                      slotIndex === TOTAL_SLOTS - 1 || 
                      getBookingForCell(slot.hour, slot.minute, slotIndex + 1, false)?.id !== booking.id
                    )
                    const isBookingBottom = booking && (
                      timeIndex === timeSlots.length - 1 ||
                      getBookingForCell(timeSlots[timeIndex + 1].hour, timeSlots[timeIndex + 1].minute, slotIndex, false)?.id !== booking.id
                    )
                    
                    // Si cette cellule fait partie d'une réservation mais n'est pas le début, ne pas la rendre
                    const isPartOfBooking = booking && !(isBookingStart && isBookingTop)
                    if (isPartOfBooking) return null

                    // Afficher les détails uniquement sur le premier slot (top-left)
                    const showDetails = booking && isBookingStart && isBookingTop
                    
                    const gridColumn = slotIndex + 2 // +2 car colonne 1 = Heure
                    const gridRow = timeIndex + 1
                    
                    // Calculer les spans pour les réservations
                    let colSpan = 1
                    let rowSpan = 1
                    if (booking && (booking.type === 'GAME' || booking.type === 'EVENT')) {
                      // Pour les jeux ET les événements, calculer les slots nécessaires
                      const slotsNeeded = Math.ceil(booking.participants_count / 6)
                      colSpan = slotsNeeded
                      
                      // Utiliser les dates du jeu (game_start_datetime et game_end_datetime)
                      const gameStartTime = booking.game_start_datetime ? new Date(booking.game_start_datetime) : new Date(booking.start_datetime)
                      const gameEndTime = booking.game_end_datetime ? new Date(booking.game_end_datetime) : new Date(booking.end_datetime)
                      const gameStartMinutes = gameStartTime.getHours() * 60 + gameStartTime.getMinutes()
                      const gameEndMinutes = gameEndTime.getHours() * 60 + gameEndTime.getMinutes()
                      const durationMinutes = gameEndMinutes - gameStartMinutes
                      rowSpan = Math.ceil(durationMinutes / 30)
                    }
                    
                    // Formater l'heure pour l'affichage
                    const bookingStartTime = booking ? (booking.game_start_datetime ? new Date(booking.game_start_datetime) : new Date(booking.start_datetime)) : null
                    const displayTime = bookingStartTime ? formatTime(bookingStartTime) : ''

                    // Calculer l'overbooking (si participants > capacité max de 84)
                    const maxCapacity = TOTAL_SLOTS * 6 // 84
                    const overbookedCount = booking && booking.participants_count > maxCapacity 
                      ? booking.participants_count - maxCapacity 
                      : 0

                    return (
                      <div
                        key={`cell-slot-${timeIndex}-${slotIndex}`}
                        onClick={() => booking ? openBookingModal(slot.hour, slot.minute, booking) : openBookingModal(slot.hour, slot.minute)}
                        className={`cursor-pointer relative ${
                          booking
                            ? `flex flex-col justify-start p-1 ${getTextAlignClass(displayTextAlign)}`
                            : `${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`
                        }`}
                        style={{
                          gridColumn: booking ? `${gridColumn} / ${gridColumn + colSpan}` : gridColumn,
                          gridRow: booking ? `${gridRow} / ${gridRow + rowSpan}` : gridRow,
                          backgroundColor: booking ? (booking.color || (booking.type === 'EVENT' ? '#22c55e' : '#3b82f6')) : 'transparent',
                          borderTop: `2px solid ${booking ? (booking.color || (booking.type === 'EVENT' ? (isDark ? '#4ade80' : '#16a34a') : (isDark ? '#60a5fa' : '#2563eb'))) : (isDark ? '#374151' : '#e5e7eb')}`,
                          borderBottom: `2px solid ${booking ? (booking.color || (booking.type === 'EVENT' ? (isDark ? '#4ade80' : '#16a34a') : (isDark ? '#60a5fa' : '#2563eb'))) : (isDark ? '#374151' : '#e5e7eb')}`,
                          borderLeft: `2px solid ${booking ? (booking.color || (booking.type === 'EVENT' ? (isDark ? '#4ade80' : '#16a34a') : (isDark ? '#60a5fa' : '#2563eb'))) : (isDark ? '#374151' : '#e5e7eb')}`,
                          borderRight: `2px solid ${booking ? (booking.color || (booking.type === 'EVENT' ? (isDark ? '#4ade80' : '#16a34a') : (isDark ? '#60a5fa' : '#2563eb'))) : (isDark ? '#374151' : '#e5e7eb')}`,
                        }}
                        title={booking ? `${booking.customer_first_name} ${booking.customer_last_name} - ${booking.participants_count} pers.${overbookedCount > 0 ? ` (${overbookedCount} en surplus)` : ''}` : ''}
                      >
                        {/* Indicateur d'overbooking (petit nombre à gauche) */}
                        {booking && overbookedCount > 0 && showDetails && (
                          <div className="absolute left-1 top-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center" style={{ zIndex: 10 }}>
                            {overbookedCount}
                          </div>
                        )}
                        {booking && showDetails && (
                          <>
                            <div className={`${getTextSizeClass(displayTextSize)} ${getTextWeightClass(displayTextWeight)} leading-tight ${isDark ? 'text-white' : 'text-white'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                              {booking.customer_first_name}
                            </div>
                            <div className={`${getTextSizeClass(displayTextSize)} ${getTextWeightClass(displayTextWeight)} leading-tight ${isDark ? 'text-white/95' : 'text-white/95'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                              {booking.participants_count} pers.
                            </div>
                            <div className={`${getTextSizeClass(displayTextSize)} ${getTextWeightClass(displayTextWeight)} leading-tight ${isDark ? 'text-white/90' : 'text-white/90'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                              {displayTime}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                  
                  {/* Salles d'événements */}
                  {Array.from({ length: TOTAL_ROOMS }, (_, roomIndex) => {
                    const booking = getBookingForCell(slot.hour, slot.minute, roomIndex, true)
                    
                    // Déterminer si cette cellule est le début d'une réservation (top-left corner)
                    const isBookingTop = booking && (
                      timeIndex === 0 ||
                      getBookingForCell(timeSlots[timeIndex - 1].hour, timeSlots[timeIndex - 1].minute, roomIndex, true)?.id !== booking.id
                    )
                    const isBookingStart = booking && (
                      roomIndex === 0 || 
                      getBookingForCell(slot.hour, slot.minute, roomIndex - 1, true)?.id !== booking.id
                    )
                    const isBookingEnd = booking && (
                      roomIndex === TOTAL_ROOMS - 1 || 
                      getBookingForCell(slot.hour, slot.minute, roomIndex + 1, true)?.id !== booking.id
                    )
                    const isBookingBottom = booking && (
                      timeIndex === timeSlots.length - 1 ||
                      getBookingForCell(timeSlots[timeIndex + 1].hour, timeSlots[timeIndex + 1].minute, roomIndex, true)?.id !== booking.id
                    )
                    
                    // Si cette cellule fait partie d'une réservation mais n'est pas le début, ne pas la rendre
                    const isPartOfBooking = booking && !(isBookingStart && isBookingTop)
                    if (isPartOfBooking) return null
                    
                    const gridColumn = TOTAL_SLOTS + roomIndex + 2 // +2 car colonne 1 = Heure
                    const gridRow = timeIndex + 1
                    
                    // Calculer les spans pour les réservations
                    let colSpan = 1
                    let rowSpan = 1
                    if (booking && booking.type === 'EVENT') {
                      colSpan = 1 // Une salle = 1 colonne
                      
                      const startTime = new Date(booking.start_datetime)
                      const endTime = new Date(booking.end_datetime)
                      const bookingStartMinutes = startTime.getHours() * 60 + startTime.getMinutes()
                      const bookingEndMinutes = endTime.getHours() * 60 + endTime.getMinutes()
                      const durationMinutes = bookingEndMinutes - bookingStartMinutes
                      rowSpan = Math.ceil(durationMinutes / 30)
                    }
                    
                    // Formater l'heure pour l'affichage
                    const roomBookingStartTime = booking ? new Date(booking.start_datetime) : null
                    const roomDisplayTime = roomBookingStartTime ? formatTime(roomBookingStartTime) : ''

                    return (
                      <div
                        key={`cell-room-${timeIndex}-${roomIndex}`}
                        onClick={() => booking ? openBookingModal(slot.hour, slot.minute, booking) : openBookingModal(slot.hour, slot.minute)}
                        className={`cursor-pointer ${
                          booking
                            ? `flex flex-col justify-start p-1 ${getTextAlignClass(displayTextAlign)}`
                            : `${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`
                        }`}
                        style={{
                          gridColumn: booking ? `${gridColumn} / ${gridColumn + colSpan}` : gridColumn,
                          gridRow: booking ? `${gridRow} / ${gridRow + rowSpan}` : gridRow,
                          backgroundColor: booking ? (booking.color || '#22c55e') : 'transparent',
                          borderTop: `2px solid ${booking ? (booking.color || (isDark ? '#4ade80' : '#16a34a')) : (isDark ? '#374151' : '#e5e7eb')}`,
                          borderBottom: `2px solid ${booking ? (booking.color || (isDark ? '#4ade80' : '#16a34a')) : (isDark ? '#374151' : '#e5e7eb')}`,
                          borderLeft: `2px solid ${booking ? (booking.color || (isDark ? '#4ade80' : '#16a34a')) : (isDark ? '#374151' : '#e5e7eb')}`,
                          borderRight: `2px solid ${booking ? (booking.color || (isDark ? '#4ade80' : '#16a34a')) : (isDark ? '#374151' : '#e5e7eb')}`,
                        }}
                        title={booking ? `${booking.customer_first_name} ${booking.customer_last_name} - ${booking.participants_count} pers.` : ''}
                      >
                        {booking && (
                          <>
                            <div className={`${getTextSizeClass(displayTextSize)} ${getTextWeightClass(displayTextWeight)} leading-tight ${isDark ? 'text-white' : 'text-white'}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                              {booking.customer_first_name}
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
      </main>

      {/* Modal de paramètres */}
      {selectedBranchId && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          branchId={selectedBranchId}
          rooms={branchRooms}
          settings={branchSettings}
          onUpdate={async () => {
            await refreshBranches()
            await refreshAllBookings()
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
          branchId={selectedBranchId}
          selectedDate={selectedDate}
          initialHour={modalInitialHour}
          initialMinute={modalInitialMinute}
          editingBooking={editingBooking}
          isDark={isDark}
          findBestAvailableRoom={findBestAvailableRoom}
        />
      )}
    </div>
  )
}
