'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, Users, MapPin, Phone, Mail, Search, Filter, X, Ban, CheckCircle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Grid, CalendarDays, Sun, Moon, Settings, Trash2 } from 'lucide-react'
import { Reservation } from '@/lib/reservations'
// Scheduler imports
import { placeGameBooking, placeEventBooking, validateNoOverlap, calculateSlotsNeeded } from '@/lib/scheduler/engine'
import { toRoomConfigs, toBooking, fromBooking } from '@/lib/scheduler/adapters'
import type { Booking } from '@/lib/scheduler/types'
import { requiresConfirmation, getConflictDetails } from '@/lib/scheduler/exceptions'

type SortField = 'reservationNumber' | 'date' | 'time' | 'firstName' | 'lastName' | 'phone' | 'branch' | 'type' | 'players' | 'status'
type SortDirection = 'asc' | 'desc' | null
type ViewMode = 'table' | 'agenda'
type AgendaView = 'week' | 'day'
type Theme = 'light' | 'dark'

type SimpleAppointment = {
  id: string
  date: string // 'YYYY-MM-DD'
  hour: number // 10, 11, 12...
  minute?: number // 0, 15, 30, 45
  title: string
  branch?: string
  eventType?: string // 'game' pour jeu privé, autre chose pour événement avec salle
  durationMinutes?: number // Durée de l'événement (bloque la salle d'anniversaire)
  color?: string
  eventNotes?: string
  customerFirstName?: string
  customerLastName?: string
  customerPhone?: string
  customerEmail?: string
  customerNotes?: string
  gameDurationMinutes?: number // Durée du jeu (bloque les slots)
  participants?: number
  assignedSlots?: number[] // Indices des slots assignés (1-14)
  assignedRoom?: number // Salle d'anniversaire assignée (1-4), undefined si pas de salle
  // Exceptions/confirmations
  surbooked?: boolean
  surbookedParticipants?: number
  roomOvercap?: boolean
  roomOvercapParticipants?: number
}

export default function AdminPage() {
  // ===== CONFIGURATION FLEXIBLE =====
  // Modifiez ces valeurs pour ajouter/supprimer des slots ou des rooms
  const TOTAL_SLOTS = 14
  const TOTAL_ROOMS = 4
  const TOTAL_COLUMNS = TOTAL_SLOTS + TOTAL_ROOMS
  // ===================================
  
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [theme, setTheme] = useState<Theme>('light')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [allReservations, setAllReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [agendaView, setAgendaView] = useState<AgendaView>('day')
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [showSettingsPanel, setShowSettingsPanel] = useState(false)
  const [rowHeight, setRowHeight] = useState(60) // Hauteur des lignes en pixels
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Lundi
    const monday = new Date(today.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    return monday
  })
  const [columnFilters, setColumnFilters] = useState<{
    status?: 'confirmed' | 'cancelled' | 'all'
    branch?: string
    type?: 'game' | 'event' | 'all'
  }>({
    status: 'all',
    branch: 'all',
    type: 'all',
  })
  const [appointments, setAppointments] = useState<SimpleAppointment[]>([])
  const [showAppointmentModal, setShowAppointmentModal] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<SimpleAppointment | null>(null)
  const [appointmentTitle, setAppointmentTitle] = useState('')
  const [appointmentHour, setAppointmentHour] = useState<number | null>(null)
  const [appointmentMinute, setAppointmentMinute] = useState<number>(0)
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentBranch, setAppointmentBranch] = useState('')
  const [appointmentEventType, setAppointmentEventType] = useState('')
  const [appointmentDuration, setAppointmentDuration] = useState<number | null>(60)
  const [appointmentColor, setAppointmentColor] = useState('#3b82f6')
  const [appointmentEventNotes, setAppointmentEventNotes] = useState('')
  const [appointmentCustomerFirstName, setAppointmentCustomerFirstName] = useState('')
  const [appointmentCustomerLastName, setAppointmentCustomerLastName] = useState('')
  const [appointmentCustomerPhone, setAppointmentCustomerPhone] = useState('')
  const [appointmentCustomerEmail, setAppointmentCustomerEmail] = useState('')
  const [appointmentCustomerNotes, setAppointmentCustomerNotes] = useState('')
  const [appointmentGameDuration, setAppointmentGameDuration] = useState<number | null>(60)
  const [appointmentParticipants, setAppointmentParticipants] = useState<number | null>(null)
  const [appointmentRoom, setAppointmentRoom] = useState<number | null>(null) // 1-4 pour les salles d'anniversaire
  const [userChangedColor, setUserChangedColor] = useState(false) // Suivre si l'utilisateur a modifié la couleur manuellement
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false) // Afficher la pop-up de confirmation de suppression
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null) // ID du rendez-vous à supprimer
  const [showOverlapConfirm, setShowOverlapConfirm] = useState(false) // Afficher la pop-up de confirmation de chevauchement
  const [overlapInfo, setOverlapInfo] = useState<{ slotsNeeded: number; availableSlots: number; maxParticipants: number } | null>(null)
  const [pendingSave, setPendingSave] = useState<(() => void) | null>(null) // Fonction de sauvegarde en attente
  
  // Confirmation de dépassement de capacité de salle
  const [showRoomCapacityConfirm, setShowRoomCapacityConfirm] = useState(false)
  const [roomCapacityInfo, setRoomCapacityInfo] = useState<{ roomNumber: number; roomName: string; maxCapacity: number; participants: number } | null>(null)
  const [pendingRoomSave, setPendingRoomSave] = useState<(() => void) | null>(null)

  // Gestion des capacités des salles
  type RoomCapacity = {
    maxCapacity: number // Capacité maximale en personnes
    name?: string // Nom optionnel de la salle
  }
  const [roomCapacities, setRoomCapacities] = useState<Map<number, RoomCapacity>>(() => {
    // Valeurs par défaut : 20 personnes par salle
    const defaultCapacities = new Map<number, RoomCapacity>()
    for (let i = 1; i <= TOTAL_ROOMS; i++) {
      defaultCapacities.set(i, { maxCapacity: 20, name: `Salle ${i}` })
    }
    return defaultCapacities
  })
  const [showRoomSettingsModal, setShowRoomSettingsModal] = useState(false)
  const [editingRoomNumber, setEditingRoomNumber] = useState<number | null>(null)
  const [roomSettingsCapacity, setRoomSettingsCapacity] = useState<number>(20)
  const [roomSettingsName, setRoomSettingsName] = useState<string>('')

  const presetColors = ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#a855f7', '#eab308']

  // Position du modal de rendez-vous (draggable)
  const [appointmentModalPosition, setAppointmentModalPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDraggingModal, setIsDraggingModal] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)

  // Vérifier si déjà authentifié, charger thème + rendez-vous simples + config modal
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const auth = localStorage.getItem('admin_authenticated')
    if (auth === 'true') {
      setAuthenticated(true)
      loadReservations()
    }
    const savedTheme = localStorage.getItem('admin_theme') as Theme
    if (savedTheme) {
      setTheme(savedTheme)
    }

    const storedAppointments = localStorage.getItem('admin_simple_appointments')
    if (storedAppointments) {
      try {
        const parsed: SimpleAppointment[] = JSON.parse(storedAppointments)
        
        // VALIDATION ET NETTOYAGE : Vérifier et nettoyer les données corrompues
        const validatedAppointments = parsed
          .filter((a) => {
            // Vérifier que l'événement a les champs essentiels
            if (!a.id || !a.date || a.hour === undefined || a.hour === null) {
              console.warn('Événement invalide ignoré (champs manquants):', a)
              return false
            }
            
            // Vérifier que les slots assignés sont valides (1 à TOTAL_SLOTS)
            if (a.assignedSlots && a.assignedSlots.length > 0) {
              const invalidSlots = a.assignedSlots.filter(slot => slot < 1 || slot > TOTAL_SLOTS)
              if (invalidSlots.length > 0) {
                console.warn('Événement avec slots invalides, nettoyage:', a.id, invalidSlots)
                // Nettoyer les slots invalides
                a.assignedSlots = a.assignedSlots.filter(slot => slot >= 1 && slot <= TOTAL_SLOTS)
                // Si plus de slots valides, les supprimer
                if (a.assignedSlots.length === 0) {
                  a.assignedSlots = undefined
                }
              }
            }
            
            // Vérifier que la salle assignée est valide (1 à TOTAL_ROOMS)
            if (a.assignedRoom !== undefined && a.assignedRoom !== null) {
              if (a.assignedRoom < 1 || a.assignedRoom > TOTAL_ROOMS) {
                console.warn('Événement avec salle invalide, nettoyage:', a.id, a.assignedRoom)
                a.assignedRoom = undefined
              }
            }
            
            return true
          })
          .map((a) => ({
            ...a,
            color: a.color || '#3b82f6',
            durationMinutes: a.durationMinutes ?? 60,
            // hasInsufficientSlots supprimé
            // S'assurer que assignedSlots est un tableau valide ou undefined
            assignedSlots: a.assignedSlots && a.assignedSlots.length > 0 
              ? a.assignedSlots.filter(slot => slot >= 1 && slot <= TOTAL_SLOTS)
              : undefined,
            // S'assurer que assignedRoom est valide ou undefined
            assignedRoom: a.assignedRoom && a.assignedRoom >= 1 && a.assignedRoom <= TOTAL_ROOMS
              ? a.assignedRoom
              : undefined,
          }))
        
        // Si des événements ont été nettoyés, sauvegarder la version nettoyée
        if (validatedAppointments.length !== parsed.length) {
          console.log(`Nettoyage: ${parsed.length - validatedAppointments.length} événement(s) invalide(s) supprimé(s)`)
          localStorage.setItem('admin_simple_appointments', JSON.stringify(validatedAppointments))
        }
        
        setAppointments(validatedAppointments)
      } catch (error) {
        console.error('Erreur lors du chargement des événements depuis localStorage:', error)
        // En cas d'erreur, vider le localStorage corrompu
        localStorage.removeItem('admin_simple_appointments')
        setAppointments([])
      }
    }

    // Charger les capacités des salles depuis localStorage
    const storedRoomCapacities = localStorage.getItem('admin_room_capacities')
    if (storedRoomCapacities) {
      try {
        const parsed = JSON.parse(storedRoomCapacities)
        const capacitiesMap = new Map<number, RoomCapacity>()
        for (let i = 1; i <= TOTAL_ROOMS; i++) {
          if (parsed[i]) {
            capacitiesMap.set(i, parsed[i])
          } else {
            capacitiesMap.set(i, { maxCapacity: 20, name: `Salle ${i}` })
          }
        }
        setRoomCapacities(capacitiesMap)
      } catch {
        // Garder les valeurs par défaut
      }
    }

    // Charger la position sauvegardée de la pop-up
    const storedPosition = localStorage.getItem('admin_appointment_modal_position')
    if (storedPosition) {
      try {
        const parsed = JSON.parse(storedPosition) as { x: number; y: number }
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setAppointmentModalPosition(parsed)
        }
      } catch {
        // ignore
      }
    }
  }, [])

  // Sauvegarde position modal
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (appointmentModalPosition) {
      localStorage.setItem('admin_appointment_modal_position', JSON.stringify(appointmentModalPosition))
    }
  }, [appointmentModalPosition])

  // Sauvegarde des rendez-vous simples
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('admin_simple_appointments', JSON.stringify(appointments))
  }, [appointments])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('admin_theme', newTheme)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        setAuthenticated(true)
        localStorage.setItem('admin_authenticated', 'true')
        loadReservations()
      } else {
        alert(result.error || 'Mot de passe incorrect')
      }
    } catch (error) {
      alert('Erreur lors de la connexion')
    }
  }

  const handleLogout = () => {
    setAuthenticated(false)
    localStorage.removeItem('admin_authenticated')
    setReservations([])
    setAllReservations([])
  }

  // Fonction pour vider tous les événements
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const clearAllAppointments = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_simple_appointments')
      setAppointments([])
      console.log('Tous les événements ont été supprimés du localStorage et de l\'état.')
      setShowClearConfirm(false)
    }
  }
  
  // Fonction pour nettoyer et valider les données dans localStorage
  const cleanAndValidateData = () => {
    if (typeof window === 'undefined') return
    
    try {
      const storedAppointments = localStorage.getItem('admin_simple_appointments')
      if (!storedAppointments) return
      
      const parsed: SimpleAppointment[] = JSON.parse(storedAppointments)
      
      // Nettoyer et valider
      const cleaned = parsed
        .filter((a) => {
          if (!a.id || !a.date || a.hour === undefined || a.hour === null) return false
          return true
        })
        .map((a) => ({
          ...a,
          assignedSlots: a.assignedSlots && a.assignedSlots.length > 0
            ? a.assignedSlots.filter(slot => slot >= 1 && slot <= TOTAL_SLOTS)
            : undefined,
          assignedRoom: a.assignedRoom && a.assignedRoom >= 1 && a.assignedRoom <= TOTAL_ROOMS
            ? a.assignedRoom
            : undefined,
        }))
      
      // Sauvegarder la version nettoyée
      localStorage.setItem('admin_simple_appointments', JSON.stringify(cleaned))
      setAppointments(cleaned)
      
      alert(`Données nettoyées : ${parsed.length - cleaned.length} événement(s) invalide(s) supprimé(s)`)
    } catch (error) {
      console.error('Erreur lors du nettoyage:', error)
      alert('Erreur lors du nettoyage des données. Vider le cache ?')
    }
  }

  const loadReservations = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/reservations')
      const result = await response.json()
      
      if (result.success) {
        setAllReservations(result.reservations)
        
        let filtered = result.reservations
        
        // Filtre par statut
        if (columnFilters.status && columnFilters.status !== 'all') {
          filtered = filtered.filter((r: Reservation) => r.status === columnFilters.status)
        }
        
        // Filtre par branch
        if (columnFilters.branch && columnFilters.branch !== 'all') {
          filtered = filtered.filter((r: Reservation) => r.branch === columnFilters.branch)
        }
        
        // Filtre par type
        if (columnFilters.type && columnFilters.type !== 'all') {
          filtered = filtered.filter((r: Reservation) => r.type === columnFilters.type)
        }
        
        // Recherche
        if (searchQuery) {
          const searchLower = searchQuery.toLowerCase()
          filtered = filtered.filter((r: Reservation) => 
            r.firstName.toLowerCase().includes(searchLower) ||
            r.lastName.toLowerCase().includes(searchLower) ||
            r.phone.includes(searchLower) ||
            (r.email && r.email.toLowerCase().includes(searchLower)) ||
            r.reservationNumber.toLowerCase().includes(searchLower)
          )
        }
        
        // Tri
        if (sortField && sortDirection) {
          filtered.sort((a: Reservation, b: Reservation) => {
            let aVal: any
            let bVal: any
            
            switch (sortField) {
              case 'date':
                aVal = new Date(a.date + 'T00:00:00').getTime()
                bVal = new Date(b.date + 'T00:00:00').getTime()
                break
              case 'time':
                aVal = a.time
                bVal = b.time
                break
              case 'firstName':
                aVal = a.firstName.toLowerCase()
                bVal = b.firstName.toLowerCase()
                break
              case 'lastName':
                aVal = a.lastName.toLowerCase()
                bVal = b.lastName.toLowerCase()
                break
              case 'phone':
                aVal = a.phone
                bVal = b.phone
                break
              case 'branch':
                aVal = a.branch
                bVal = b.branch
                break
              case 'type':
                aVal = a.type
                bVal = b.type
                break
              case 'players':
                aVal = a.players
                bVal = b.players
                break
              case 'status':
                aVal = a.status
                bVal = b.status
                break
              case 'reservationNumber':
                aVal = a.reservationNumber
                bVal = b.reservationNumber
                break
              default:
                return 0
            }
            
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
            return 0
          })
        }
        
        setReservations(filtered)
      } else {
        setError(result.error || 'Erreur lors du chargement des réservations')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelReservation = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette réservation ?')) {
      return
    }

    try {
      const response = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      })

      const result = await response.json()
      
      if (result.success) {
        loadReservations()
      } else {
        alert('Erreur lors de l\'annulation')
      }
    } catch (err) {
      alert('Erreur lors de l\'annulation')
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortDirection(null)
        setSortField('date')
        setSortDirection('desc')
      } else {
        setSortDirection('asc')
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleColumnFilter = (field: 'status' | 'branch' | 'type', value: string) => {
    setColumnFilters({ ...columnFilters, [field]: value })
  }

  // Générer le titre de l'événement à partir du prénom et nom
  const generateAppointmentTitle = (firstName?: string, lastName?: string): string => {
    const first = firstName?.trim() || ''
    const last = lastName?.trim() || ''
    if (first && last) {
      return `${first} ${last}`
    } else if (first) {
      return first
    } else if (last) {
      return last
    }
    return 'Nouvel événement'
  }

  // Formater l'affichage de l'événement dans l'agenda
  const formatAppointmentDisplay = (appointment: SimpleAppointment): string => {
    const name = generateAppointmentTitle(appointment.customerFirstName, appointment.customerLastName)
    const participants = appointment.participants ? `${appointment.participants} pers.` : ''
    const time = `${String(appointment.hour).padStart(2, '0')}:${String(appointment.minute || 0).padStart(2, '0')}`
    
    let display = name
    if (participants) {
      display += ` - ${participants}`
    }
    display += ` - ${time}`
    return display
  }

  // Formater l'affichage pour les salles (avec retour à la ligne)
  const formatAppointmentDisplayForRooms = (appointment: SimpleAppointment) => {
    const name = generateAppointmentTitle(appointment.customerFirstName, appointment.customerLastName)
    const participants = appointment.participants ? `${appointment.participants} pers.` : ''
    const time = `${String(appointment.hour).padStart(2, '0')}:${String(appointment.minute || 0).padStart(2, '0')}`
    
    return {
      name,
      details: participants ? `${participants} - ${time}` : time
    }
  }

  const handlePreviousWeek = () => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentWeekStart(newDate)
  }

  const handleNextWeek = () => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentWeekStart(newDate)
  }

  const handlePreviousDay = () => {
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

  const handleNextDay = () => {
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

  const handleToday = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    setSelectedDate(today)
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(today)
    monday.setDate(diff)
    monday.setHours(0, 0, 0, 0)
    setCurrentWeekStart(monday)
  }

  const handleDayClick = (date: Date) => {
    setSelectedDate(date)
  }

  const handleWeekDayClick = (date: Date) => {
    setSelectedDate(date)
  }

  const handleCalendarDateClick = (date: Date) => {
    setSelectedDate(date)
    // Mettre à jour la semaine
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(date)
    monday.setDate(diff)
    monday.setHours(0, 0, 0, 0)
    setCurrentWeekStart(monday)
    setShowCalendarModal(false)
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

  // Recharger quand les filtres ou la recherche changent
  useEffect(() => {
    if (authenticated) {
      const timer = setTimeout(() => {
        loadReservations()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [searchQuery, columnFilters.status, columnFilters.branch, columnFilters.type, sortField, sortDirection])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00')
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
    })
  }

  const formatDateLong = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }

  const formatDateFull = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const getSortIcon = (field: SortField) => {
    const iconColor = theme === 'light' ? 'text-gray-900' : 'text-primary'
    if (sortField !== field) {
      return <ChevronDown className={`w-4 h-4 opacity-30 ${iconColor}`} />
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className={`w-4 h-4 ${iconColor}`} />
    }
    if (sortDirection === 'desc') {
      return <ChevronDown className={`w-4 h-4 ${iconColor}`} />
    }
    return <ChevronDown className={`w-4 h-4 opacity-30 ${iconColor}`} />
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

  // Générer les slots de temps (10:00, 10:15, 10:30, 10:45, ...) pour l'affichage agenda
  // Grille interne 15 min, mais on affichera seulement les labels 30 min sur le côté
  const getTimeSlots = () => {
    const slots: Array<{ hour: number; minute: number; label: string; slotId: number }> = []
    for (let h = 10; h <= 22; h++) {
      slots.push({ hour: h, minute: 0, label: `${String(h).padStart(2, '0')}:00`, slotId: h * 100 + 0 })
      slots.push({ hour: h, minute: 15, label: `${String(h).padStart(2, '0')}:15`, slotId: h * 100 + 15 })
      slots.push({ hour: h, minute: 30, label: `${String(h).padStart(2, '0')}:30`, slotId: h * 100 + 30 })
      slots.push({ hour: h, minute: 45, label: `${String(h).padStart(2, '0')}:45`, slotId: h * 100 + 45 })
    }
    return slots
  }

  // Calculer le nombre de slots nécessaires selon le nombre de participants
  // Si participants est null ou non défini, considérer comme < 6 joueurs (1 slot)
  const calculateSlotsNeeded = (participants: number | null | undefined): number => {
    if (!participants || participants <= 0) return 1
    return Math.ceil(participants / 6)
  }

  // Calculer le temps de jeu centré pour un événement avec salle
  // Si l'événement a une salle et une durée d'événement, le jeu dure toujours 1h et est centré
  // Retourne { gameStartMinutes: number, gameDurationMinutes: number }
  const calculateCenteredGameTime = (appointment: SimpleAppointment): { gameStartMinutes: number; gameDurationMinutes: number } => {
    const eventStartMinutes = appointment.hour * 60 + (appointment.minute || 0)
    
    // Si l'événement a une salle ET une durée d'événement (pas juste un jeu)
    if (appointment.assignedRoom && appointment.durationMinutes && appointment.durationMinutes > 60) {
      // Le jeu dure toujours 1 heure et est centré dans l'événement
      const gameDurationMinutes = 60
      const eventDurationMinutes = appointment.durationMinutes
      // Calculer le début du jeu : centré dans l'événement
      const gameStartOffset = (eventDurationMinutes - gameDurationMinutes) / 2
      const gameStartMinutes = eventStartMinutes + gameStartOffset
      
      return { gameStartMinutes, gameDurationMinutes }
    }
    
    // Sinon, utiliser le temps normal (pas de centrage)
    const gameDuration = appointment.gameDurationMinutes || appointment.durationMinutes || 60
    return { gameStartMinutes: eventStartMinutes, gameDurationMinutes: gameDuration }
  }

  // Détecter les chevauchements entre rendez-vous
  const detectOverlaps = (appointments: SimpleAppointment[]): Array<{ a: SimpleAppointment; b: SimpleAppointment }> => {
    const overlaps: Array<{ a: SimpleAppointment; b: SimpleAppointment }> = []
    
    for (let i = 0; i < appointments.length; i++) {
      const a = appointments[i]
      const aStart = a.hour * 60 + (a.minute || 0)
      const aDuration = a.gameDurationMinutes || a.durationMinutes || 60
      const aEnd = aStart + aDuration
      const aSlots = a.assignedSlots || []
      
      if (aSlots.length === 0) continue
      
      for (let j = i + 1; j < appointments.length; j++) {
        const b = appointments[j]
        const bStart = b.hour * 60 + (b.minute || 0)
        const bDuration = b.gameDurationMinutes || b.durationMinutes || 60
        const bEnd = bStart + bDuration
        const bSlots = b.assignedSlots || []
        
        if (bSlots.length === 0) continue
        
        // Vérifier si les créneaux se chevauchent
        const timeOverlap = aStart < bEnd && aEnd > bStart
        
        if (timeOverlap) {
          // Vérifier si les slots se chevauchent
          const slotOverlap = aSlots.some(slot => bSlots.includes(slot))
          if (slotOverlap) {
            overlaps.push({ a, b })
          }
        }
      }
    }
    
    return overlaps
  }

  // Guard strict : assertNoOverlap après chaque placement
  // ROLLBACK IMMÉDIAT si overlap détecté + popup "Impossible sans chevauchement"
  const assertNoOverlap = (bookings: Booking[], date: string, context: string): boolean => {
    const validation = validateNoOverlap(bookings, date)
    if (!validation.valid && validation.conflicts.length > 0) {
      // Logger les détails des conflits
      console.error(`[SCHEDULER] Overlap détecté dans ${context}:`, validation.conflicts)
      for (const conflict of validation.conflicts) {
        const b1 = conflict.booking1
        const b2 = conflict.booking2
        const b1Slots = b1.assignedSlots || []
        const b2Slots = b2.assignedSlots || []
        const b1GameTime = {
          hour: b1.hour,
          minute: b1.minute,
          duration: b1.gameDurationMinutes || b1.durationMinutes || 60
        }
        const b2GameTime = {
          hour: b2.hour,
          minute: b2.minute,
          duration: b2.gameDurationMinutes || b2.durationMinutes || 60
        }
        console.error(`[OVERLAP] Booking ${b1.id} (${b1.customerFirstName} ${b1.customerLastName}) slots [${b1Slots.join(',')}] ${b1GameTime.hour}:${String(b1GameTime.minute).padStart(2, '0')} (+${b1GameTime.duration}min)`)
        console.error(`[OVERLAP] Booking ${b2.id} (${b2.customerFirstName} ${b2.customerLastName}) slots [${b2Slots.join(',')}] ${b2GameTime.hour}:${String(b2GameTime.minute).padStart(2, '0')} (+${b2GameTime.duration}min)`)
        console.error(`[OVERLAP] Chevauchement sur slots: [${b1Slots.filter(s => b2Slots.includes(s)).join(',')}]`)
      }
      
      // En dev : throw pour bloquer
      // En prod : popup et retourner false pour rollback
      if (process.env.NODE_ENV === 'development') {
        throw new Error(`[SCHEDULER] Overlap détecté dans ${context}. Voir console pour détails.`)
      } else {
        alert(`Impossible de créer/modifier ce rendez-vous sans chevauchement. ${validation.conflicts.length} conflit(s) détecté(s).`)
        return false
      }
    }
    return true
  }

  // Compacter les slots : utilise le scheduler engine
  // RÈGLE TETRIS : Aucun bloc ne peut entrer dans un autre bloc
  // Si conflit détecté, déplacer automatiquement les rendez-vous existants
  const compactSlots = (date: string, allAppointments: SimpleAppointment[], excludeAppointmentId?: string): SimpleAppointment[] => {
    // Récupérer tous les rendez-vous pour cette date (y compris ceux sans slots assignés)
    const dateAppointments = allAppointments
      .filter(a => a.date === date && a.id !== excludeAppointmentId)
      .map(a => ({ ...a }))

    if (dateAppointments.length === 0) return []

    // Convertir en Bookings et trier par heure
    const bookings: Booking[] = dateAppointments.map(toBooking).sort((a, b) => {
      const aStart = a.hour * 60 + a.minute
      const bStart = b.hour * 60 + b.minute
      return aStart - bStart
    })

    // Réorganiser tous les bookings en utilisant le scheduler
    // On les replace un par un dans l'ordre chronologique
    const reorganizedBookings: Booking[] = []
    const roomConfigs = toRoomConfigs(roomCapacities)

    for (const booking of bookings) {
      // Si le booking a déjà des slots assignés, on les garde temporairement
      // mais on va le replacer pour s'assurer qu'il n'y a pas de conflit
      const params = {
        date: booking.date,
        hour: booking.hour,
        minute: booking.minute,
        participants: booking.participants,
        type: booking.type,
        durationMinutes: booking.durationMinutes,
        gameDurationMinutes: booking.gameDurationMinutes,
        excludeBookingId: booking.id // Exclure ce booking lui-même
      }

      let result
      if (booking.type === 'event') {
        result = placeEventBooking(reorganizedBookings, params, roomConfigs, false)
      } else {
        result = placeGameBooking(reorganizedBookings, params, true, false) // allowSplit pour GAME
      }

      if (result.success && result.allocation) {
        // Mettre à jour le booking avec la nouvelle allocation
        const updatedBooking: Booking = {
          ...booking,
          assignedSlots: result.allocation.slotAllocation?.slots,
          assignedRoom: result.allocation.roomAllocation?.roomId
        }
        reorganizedBookings.push(updatedBooking)
      } else {
        // Si le placement échoue, garder le booking tel quel (avec ses slots existants)
        // Mais on ne devrait jamais arriver ici si le booking était déjà placé
        reorganizedBookings.push(booking)
      }
    }

    // Guard : vérifier qu'il n'y a pas de chevauchement
    assertNoOverlap(reorganizedBookings, date, 'compactSlots')

    // Convertir en SimpleAppointment
    return reorganizedBookings.map(b => {
      const original = dateAppointments.find(a => a.id === b.id)
      return fromBooking(b, original)
    })
  }

  // Trouver les slots disponibles pour un créneau donné (utilise compactSlots qui utilise le scheduler)
  const findAvailableSlots = (
    date: string,
    startMinutes: number,
    durationMinutes: number,
    slotsNeeded: number,
    excludeAppointmentId?: string
  ): number[] | null => {
    const endMinutes = startMinutes + durationMinutes
    const compacted = compactSlots(date, appointments, excludeAppointmentId)
    
    // Chercher des slots consécutifs de gauche à droite
    for (let startSlot = 1; startSlot <= TOTAL_SLOTS - slotsNeeded + 1; startSlot++) {
      const candidateSlots = Array.from({ length: slotsNeeded }, (_, i) => startSlot + i)
      
      // Vérifier si ces slots sont libres
      let isFree = true
      for (const existing of compacted) {
        if (excludeAppointmentId && existing.id === excludeAppointmentId) continue
        // Calculer le temps de jeu centré pour l'événement existant
        const { gameStartMinutes: existingGameStart, gameDurationMinutes: existingGameDuration } = calculateCenteredGameTime(existing)
        const existingEnd = existingGameStart + existingGameDuration
        const existingSlots = existing.assignedSlots || []
        
        if (existingSlots.length === 0) continue
        
        const timeOverlap = existingGameStart < endMinutes && existingEnd > startMinutes
        if (timeOverlap && candidateSlots.some(s => existingSlots.includes(s))) {
          isFree = false
          break
        }
      }
      
      if (isFree) {
        return candidateSlots
      }
    }
    
    return null
  }

  // Trouver une salle d'anniversaire disponible pour un créneau donné
  // Ne vérifie QUE les chevauchements temporels (pas la capacité)
  const findAvailableRoom = (
    date: string,
    startMinutes: number,
    durationMinutes: number,
    excludeAppointmentId?: string
  ): number | null => {
    const endMinutes = startMinutes + durationMinutes
    
    // Vérifier chaque salle
    for (let room = 1; room <= TOTAL_ROOMS; room++) {
      let isAvailable = true
      
      // Vérifier si cette salle est occupée par un autre rendez-vous sur ce créneau
      // IMPORTANT : On vérifie SEULEMENT les chevauchements temporels (interdits)
      for (const appointment of appointments) {
        // Exclure le rendez-vous en cours de modification
        if (appointment.id === excludeAppointmentId) continue
        if (appointment.date !== date) continue
        if (appointment.eventType === 'game') continue // Les "game" ne bloquent pas les salles
        if (appointment.assignedRoom !== room) continue
        
        const appStartMinutes = appointment.hour * 60 + (appointment.minute || 0)
        const appDuration = appointment.durationMinutes || 60
        const appEndMinutes = appStartMinutes + appDuration
        
        // Vérifier le chevauchement temporel (INTERDIT)
        if (appStartMinutes < endMinutes && appEndMinutes > startMinutes) {
          isAvailable = false
          break
        }
      }
      
      if (isAvailable) {
        return room
      }
    }
    
    return null
  }

  // Trouver une salle disponible qui peut accueillir le nombre de participants
  // Essaie chaque salle de gauche à droite jusqu'à trouver une qui convient
  const findAvailableRoomWithCapacity = (
    date: string,
    startMinutes: number,
    durationMinutes: number,
    requiredParticipants: number,
    excludeAppointmentId?: string
  ): { room: number; needsAuthorization: boolean } | null => {
    const endMinutes = startMinutes + durationMinutes
    
    let firstAvailableRoomWithoutCapacity: number | null = null
    
    // Vérifier chaque salle de gauche à droite (1, 2, 3, 4...)
    for (let room = 1; room <= TOTAL_ROOMS; room++) {
      let isTimeAvailable = true
      
      // Vérifier d'abord les chevauchements temporels (INTERDITS)
      for (const appointment of appointments) {
        if (appointment.id === excludeAppointmentId) continue
        if (appointment.date !== date) continue
        if (appointment.eventType === 'game') continue
        if (appointment.assignedRoom !== room) continue
        
        const appStartMinutes = appointment.hour * 60 + (appointment.minute || 0)
        const appDuration = appointment.durationMinutes || 60
        const appEndMinutes = appStartMinutes + appDuration
        
        if (appStartMinutes < endMinutes && appEndMinutes > startMinutes) {
          isTimeAvailable = false
          break
        }
      }
      
      // Si la salle n'est pas disponible temporellement, passer à la suivante
      if (!isTimeAvailable) continue
      
      // Si la salle est disponible temporellement, vérifier la capacité
      const roomCapacity = roomCapacities.get(room)
      if (roomCapacity) {
        // Si la capacité est suffisante, retourner cette salle immédiatement
        if (requiredParticipants <= roomCapacity.maxCapacity) {
          return { room, needsAuthorization: false }
        }
        // Si la capacité n'est pas suffisante, noter cette salle comme option de secours
        // (on continuera à chercher une salle avec assez de capacité)
        if (firstAvailableRoomWithoutCapacity === null) {
          firstAvailableRoomWithoutCapacity = room
        }
      }
    }
    
    // Si on arrive ici, aucune salle n'a assez de capacité
    // Retourner la première salle disponible temporellement avec needsAuthorization = true
    if (firstAvailableRoomWithoutCapacity !== null) {
      return { room: firstAvailableRoomWithoutCapacity, needsAuthorization: true }
    }
    
    // Aucune salle disponible temporellement
    return null
  }

  // Obtenir les rendez-vous qui commencent ou chevauchent un créneau de 30 minutes donné
  const getAppointmentsForSlot = (date: Date, slotHour: number, slotMinute: number) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`

    const slotStartMinutes = slotHour * 60 + slotMinute
    const slotEndMinutes = slotStartMinutes + 30

    return appointments.filter(a => {
      if (a.date !== dateStr) return false
      
      // Convertir l'heure du rendez-vous en minutes depuis minuit
      const appointmentStartMinutes = a.hour * 60 + (a.minute || 0)
      const duration = a.durationMinutes || 60
      const appointmentEndMinutes = appointmentStartMinutes + duration
      
      // Le rendez-vous chevauche ce créneau si :
      // - Il commence avant la fin du créneau ET
      // - Il se termine après le début du créneau
      return appointmentStartMinutes < slotEndMinutes && appointmentEndMinutes > slotStartMinutes
    })
  }

  // Calculer combien de créneaux de 30 minutes un rendez-vous occupe
  const getSlotSpan = (durationMinutes: number) => {
    return Math.ceil((durationMinutes || 60) / 30)
  }

  // Ouvrir le modal pour créer un nouveau rendez-vous
  // NOTE : Le slot cliqué n'est utilisé QUE pour déterminer l'heure
  // Les slots seront assignés automatiquement par findAvailableSlots (gauche → droite)
  const openNewAppointmentModal = (hour: number, minute: number = 0) => {
    setEditingAppointment(null)
    setAppointmentTitle('')
    setAppointmentHour(hour)
    setAppointmentMinute(minute)
    const year = selectedDate.getFullYear()
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
    const day = String(selectedDate.getDate()).padStart(2, '0')
    setAppointmentDate(`${year}-${month}-${day}`)
    setAppointmentBranch('')
    setAppointmentEventType('')
    // Durées par défaut : 2h pour événement, 1h pour jeu
    setAppointmentDuration(120) // 2 heures par défaut pour événement
    setAppointmentColor('#3b82f6') // Bleu par défaut (sera changé automatiquement si événement)
    setAppointmentEventNotes('')
    setAppointmentCustomerFirstName('')
    setAppointmentCustomerLastName('')
    setAppointmentCustomerPhone('')
    setAppointmentCustomerEmail('')
    setAppointmentCustomerNotes('')
    setAppointmentGameDuration(60) // 1 heure par défaut pour jeu
    setAppointmentParticipants(null) // null = < 6 joueurs = 1 slot
    setAppointmentRoom(null)
    setUserChangedColor(false) // Réinitialiser le flag de couleur modifiée
    setShowAppointmentModal(true)
  }

  const openEditAppointmentModal = (appointment: SimpleAppointment) => {
    setEditingAppointment(appointment)
    // Ne plus charger le titre, il sera généré automatiquement
    setAppointmentHour(appointment.hour)
    setAppointmentMinute(appointment.minute || 0)
    setAppointmentDate(appointment.date)
    setAppointmentBranch(appointment.branch || '')
    setAppointmentEventType(appointment.eventType || '')
    setAppointmentDuration(appointment.durationMinutes ?? 60)
    setAppointmentColor(appointment.color || '#3b82f6')
    setAppointmentEventNotes(appointment.eventNotes || '')
    setAppointmentCustomerFirstName(appointment.customerFirstName || '')
    setAppointmentCustomerLastName(appointment.customerLastName || '')
    setAppointmentCustomerPhone(appointment.customerPhone || '')
    setAppointmentCustomerEmail(appointment.customerEmail || '')
    setAppointmentCustomerNotes(appointment.customerNotes || '')
    setAppointmentGameDuration(appointment.gameDurationMinutes ?? 60)
    setAppointmentParticipants(appointment.participants ?? null)
    setAppointmentRoom(appointment.assignedRoom ?? null)
    setShowAppointmentModal(true)
  }

  // Assigner automatiquement des slots aux anciens rendez-vous qui n'en ont pas (lors du chargement)
  useEffect(() => {
    if (appointments.length === 0) return
    
    const needsUpdate = appointments.some(a => !a.assignedSlots || a.assignedSlots.length === 0)
    if (!needsUpdate) return
    
    setAppointments(prev => prev.map(a => {
      if (a.assignedSlots && a.assignedSlots.length > 0) return a
      
      const slotsNeeded = calculateSlotsNeeded(a.participants)
      const startMinutes = a.hour * 60 + (a.minute || 0)
      const durationMinutes = a.durationMinutes || 60
      
      // Pour la migration, assigner les premiers slots disponibles
      const defaultSlots = Array.from({ length: slotsNeeded }, (_, i) => Math.min(i + 1, TOTAL_SLOTS))
      return { ...a, assignedSlots: defaultSlots }
    }))
  }, [appointments.length])

  // Changer automatiquement la couleur selon le type d'événement
  // Ne s'applique que lors du changement de type, pas si l'utilisateur a déjà modifié la couleur
  useEffect(() => {
    if (!showAppointmentModal) {
      setUserChangedColor(false)
      return
    }
    
    // Si l'utilisateur a modifié la couleur manuellement, ne pas la changer automatiquement
    if (userChangedColor && editingAppointment) return
    
    if (appointmentEventType && appointmentEventType !== 'game') {
      // Événement (anniversaire, bar mitzvah, etc.) → vert
      setAppointmentColor('#22c55e')
      // Durée par défaut : 2h pour événement (seulement si nouvelle création)
      if (!editingAppointment) {
        setAppointmentDuration(120)
      }
    } else if (appointmentEventType === 'game' || appointmentEventType === '') {
      // Jeu normal → bleu
      setAppointmentColor('#3b82f6')
      // Pour les jeux, pas besoin de durationMinutes (seulement gameDurationMinutes)
      // On ne modifie pas appointmentDuration ici car il n'est pas utilisé pour les jeux
    }
  }, [appointmentEventType, showAppointmentModal, editingAppointment, userChangedColor])

  // Fonction helper pour sauvegarder avec une salle assignée (utilisée après confirmation de capacité)
  // Cette fonction est appelée APRÈS autorisation, donc on skip les vérifications de capacité
  const saveAppointmentWithRoom = (slotsToUse: number[], roomToAssign: number) => {
    // Cette fonction utilise maintenant saveAppointment() directement
    // Gardée pour compatibilité avec les callbacks existants
    // Le flag __pendingSurbookConfirmed est géré dans saveAppointment()
    saveAppointment()
  }

  const saveAppointmentWithRoom_OLD = (slotsToUse: number[], roomToAssign: number) => {
    // DÉPRÉCIÉ : Utiliser saveAppointment() directement
    // Vérifier que prénom ou nom est rempli au lieu du titre
    if ((!appointmentCustomerFirstName?.trim() && !appointmentCustomerLastName?.trim()) || appointmentHour === null || !appointmentDate) {
      return
    }
    const dateStr = appointmentDate
    const isEventType = appointmentEventType && appointmentEventType !== 'game' && appointmentEventType.trim() !== ''
    const eventDurationMinutes = isEventType 
      ? (appointmentDuration ?? 120)
      : (appointmentGameDuration ?? 60)
    
    // Pour les événements avec salle, le jeu dure toujours 1 heure et est centré
    // On ne stocke pas gameDurationMinutes explicitement, il sera calculé à partir de durationMinutes

    if (editingAppointment) {
      setAppointments(prev => {
        const updatedAppointment: SimpleAppointment = {
          ...editingAppointment,
          title: generateAppointmentTitle(appointmentCustomerFirstName, appointmentCustomerLastName),
          hour: appointmentHour,
          minute: appointmentMinute,
          date: dateStr,
          branch: appointmentBranch || undefined,
          eventType: appointmentEventType || undefined,
          durationMinutes: isEventType
            ? (appointmentDuration ?? undefined) 
            : undefined,
          color: appointmentColor || (isEventType ? '#22c55e' : '#3b82f6'), // Vert pour EVENT, bleu pour GAME
          eventNotes: appointmentEventNotes || undefined,
          customerFirstName: appointmentCustomerFirstName || undefined,
          customerLastName: appointmentCustomerLastName || undefined,
          customerPhone: appointmentCustomerPhone || undefined,
          customerEmail: appointmentCustomerEmail || undefined,
          customerNotes: appointmentCustomerNotes || undefined,
          // Pour les événements avec salle, gameDurationMinutes sera calculé automatiquement (1h centré)
          // On ne le stocke pas explicitement, il sera calculé à partir de durationMinutes
          gameDurationMinutes: isEventType
            ? undefined // Pour les événements avec salle, on ne stocke pas gameDurationMinutes
            : (appointmentGameDuration ?? undefined), // Pour les jeux simples, on stocke la durée
          participants: appointmentParticipants ?? undefined,
          assignedSlots: slotsToUse.length > 0 ? slotsToUse : undefined,
          assignedRoom: roomToAssign,
        }
        
        const updated = prev.map(a =>
          a.id === editingAppointment.id ? updatedAppointment : a
        )
        
        const compacted = compactSlots(dateStr, updated)
        const otherDates = updated.filter(a => a.date !== dateStr)
        
        // Guard strict : rollback si overlap
        const allBookings = compacted.map(toBooking)
        if (!assertNoOverlap(allBookings, dateStr, 'saveAppointmentWithRoom')) {
          return prev // Rollback
        }
        
        return [...otherDates, ...compacted]
      })
    } else {
      const newAppointment: SimpleAppointment = {
        id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: generateAppointmentTitle(appointmentCustomerFirstName, appointmentCustomerLastName),
        hour: appointmentHour,
        minute: appointmentMinute,
        date: dateStr,
        branch: appointmentBranch || undefined,
        eventType: appointmentEventType || undefined,
        durationMinutes: isEventType
          ? (appointmentDuration ?? undefined) 
          : undefined,
        color: appointmentColor || (isEventType ? '#22c55e' : '#3b82f6'), // Vert pour EVENT, bleu pour GAME
        eventNotes: appointmentEventNotes || undefined,
        customerFirstName: appointmentCustomerFirstName || undefined,
        customerLastName: appointmentCustomerLastName || undefined,
        customerPhone: appointmentCustomerPhone || undefined,
        customerEmail: appointmentCustomerEmail || undefined,
        customerNotes: appointmentCustomerNotes || undefined,
        gameDurationMinutes: appointmentGameDuration ?? undefined,
        participants: appointmentParticipants ?? undefined,
        assignedSlots: slotsToUse.length > 0 ? slotsToUse : undefined,
        assignedRoom: roomToAssign,
      }
      
      setAppointments(prev => {
        const updated = [...prev, newAppointment]
        const compacted = compactSlots(dateStr, updated)
        const otherDates = updated.filter(a => a.date !== dateStr)
        return [...otherDates, ...compacted]
      })
    }
    
    setShowAppointmentModal(false)
    setEditingAppointment(null)
    setAppointmentTitle('')
    setAppointmentHour(null)
    setAppointmentDate('')
    setAppointmentCustomerFirstName('')
    setAppointmentCustomerLastName('')
    setAppointmentParticipants(null)
    setAppointmentEventType('')
    setAppointmentGameDuration(60)
    setAppointmentDuration(60)
    setAppointmentBranch('')
    setAppointmentEventNotes('')
    setAppointmentCustomerPhone('')
    setAppointmentCustomerEmail('')
    setAppointmentCustomerNotes('')
  }

  // Fonction interne pour sauvegarder avec des slots spécifiques
  // DOIT être définie AVANT saveAppointment car elle est utilisée dans pendingSave
  const saveAppointmentWithSlots = (slotsToUse: number[]) => {
    // Vérifier que prénom ou nom est rempli au lieu du titre
    if ((!appointmentCustomerFirstName?.trim() && !appointmentCustomerLastName?.trim()) || appointmentHour === null || !appointmentDate) {
      return
    }
    const dateStr = appointmentDate

    // Calculer les minutes de début
    const startMinutes = appointmentHour * 60 + appointmentMinute
    
    // IMPORTANT : Deux durées différentes
    const gameDurationMinutes = appointmentGameDuration ?? 60
    const eventDurationMinutes = (appointmentEventType && appointmentEventType !== 'game') 
      ? (appointmentDuration ?? 120)
      : gameDurationMinutes

    // Si ce n'est pas un "game", vérifier la disponibilité d'une salle d'anniversaire
    let assignedRoom: number | undefined = undefined
    if (appointmentEventType && appointmentEventType !== 'game') {
      // Si une salle est déjà sélectionnée, vérifier qu'elle est disponible (chevauchement temporel)
      if (appointmentRoom !== null) {
        const roomAvailable = findAvailableRoom(
          dateStr,
          startMinutes,
          eventDurationMinutes,
          editingAppointment?.id
        )
        
        // Vérifier d'abord les chevauchements temporels (INTERDITS)
        if (roomAvailable !== appointmentRoom) {
          const roomCapacity = roomCapacities.get(appointmentRoom)
          const roomName = roomCapacity?.name || `Salle ${appointmentRoom}`
          alert(`${roomName} n'est pas disponible sur ce créneau (chevauchement avec un autre événement).`)
          return
        }
        
        // Si pas de chevauchement temporel, vérifier la capacité (demander autorisation si dépassée)
        if (appointmentParticipants !== null && appointmentParticipants !== undefined && appointmentParticipants > 0) {
          const roomCapacity = roomCapacities.get(appointmentRoom)
          if (roomCapacity && appointmentParticipants > roomCapacity.maxCapacity) {
            // Demander l'autorisation pour dépasser la capacité
            setRoomCapacityInfo({
              roomNumber: appointmentRoom,
              roomName: roomCapacity.name || `Salle ${appointmentRoom}`,
              maxCapacity: roomCapacity.maxCapacity,
              participants: appointmentParticipants
            })
            setPendingRoomSave(() => () => {
              saveAppointmentWithRoom(slotsToUse, appointmentRoom)
            })
            setShowRoomCapacityConfirm(true)
            return // Attendre la confirmation
          }
        }
        
        // Pas de dépassement de capacité, continuer normalement
        assignedRoom = appointmentRoom
      } else {
        // Trouver automatiquement une salle disponible en vérifiant la capacité intelligemment
        if (appointmentParticipants !== null && appointmentParticipants !== undefined && appointmentParticipants > 0) {
          // Utiliser la fonction intelligente qui vérifie la capacité
          const roomResult = findAvailableRoomWithCapacity(
            dateStr,
            startMinutes,
            eventDurationMinutes,
            appointmentParticipants,
            editingAppointment?.id
          )
          
          if (!roomResult) {
            alert(`Aucune salle d'anniversaire disponible sur ce créneau (toutes les salles sont occupées).`)
            return
          }
          
          if (roomResult.needsAuthorization) {
            // Aucune salle n'a assez de capacité, demander l'autorisation
            const roomCapacity = roomCapacities.get(roomResult.room)
            if (roomCapacity) {
              setRoomCapacityInfo({
                roomNumber: roomResult.room,
                roomName: roomCapacity.name || `Salle ${roomResult.room}`,
                maxCapacity: roomCapacity.maxCapacity,
                participants: appointmentParticipants
              })
              setPendingRoomSave(() => () => {
                saveAppointmentWithRoom(slotsToUse, roomResult.room)
              })
              setShowRoomCapacityConfirm(true)
              return // Attendre la confirmation
            }
          } else {
            // Une salle avec assez de capacité a été trouvée
            assignedRoom = roomResult.room
          }
        } else {
          // Pas de participants spécifiés, trouver n'importe quelle salle disponible
          const availableRoom = findAvailableRoom(
            dateStr,
            startMinutes,
            eventDurationMinutes,
            editingAppointment?.id
          )
          if (!availableRoom) {
            alert(`Aucune salle d'anniversaire disponible sur ce créneau (toutes les salles sont occupées).`)
            return
          }
          assignedRoom = availableRoom
        }
      }
    }

    if (editingAppointment) {
      setAppointments(prev => {
        // Mettre à jour le rendez-vous modifié
        const updatedAppointment: SimpleAppointment = {
          ...editingAppointment,
          title: generateAppointmentTitle(appointmentCustomerFirstName, appointmentCustomerLastName),
          hour: appointmentHour,
          minute: appointmentMinute,
          date: dateStr,
          branch: appointmentBranch || undefined,
          eventType: appointmentEventType || undefined,
          // Pour les jeux standards, pas de durationMinutes (seulement gameDurationMinutes)
          durationMinutes: (appointmentEventType && appointmentEventType !== 'game') 
            ? (appointmentDuration ?? undefined) 
            : undefined,
          color: appointmentColor || (isEvent ? '#22c55e' : '#3b82f6'), // Vert pour EVENT, bleu pour GAME
          eventNotes: appointmentEventNotes || undefined,
          customerFirstName: appointmentCustomerFirstName || undefined,
          customerLastName: appointmentCustomerLastName || undefined,
          customerPhone: appointmentCustomerPhone || undefined,
          customerEmail: appointmentCustomerEmail || undefined,
          customerNotes: appointmentCustomerNotes || undefined,
          // Pour les événements avec salle, gameDurationMinutes sera calculé automatiquement (1h centré)
          // On ne le stocke pas explicitement, il sera calculé à partir de durationMinutes
          gameDurationMinutes: (appointmentEventType && appointmentEventType !== 'game') 
            ? undefined // Pour les événements avec salle, on ne stocke pas gameDurationMinutes
            : (appointmentGameDuration ?? undefined), // Pour les jeux simples, on stocke la durée
          participants: appointmentParticipants ?? undefined,
          // Si slotsToUse est vide, compactSlots assignera automatiquement les slots
          assignedSlots: slotsToUse.length > 0 ? slotsToUse : undefined,
          assignedRoom: assignedRoom,
        }
        
        // Mettre à jour tous les rendez-vous
        const updated = prev.map(a =>
          a.id === editingAppointment.id ? updatedAppointment : a
        )
        
        // TOUJOURS utiliser compactSlots pour réorganiser tous les rendez-vous
        // Cela garantit que les rendez-vous sont déplacés si nécessaire
        // Même si slotsToUse est fourni, compactSlots peut déplacer d'autres rendez-vous pour optimiser
        const compacted = compactSlots(dateStr, updated)
        const otherDates = updated.filter(a => a.date !== dateStr)
        return [...otherDates, ...compacted]
      })
    } else {
      const newAppointment: SimpleAppointment = {
        id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: generateAppointmentTitle(appointmentCustomerFirstName, appointmentCustomerLastName),
        hour: appointmentHour,
        minute: appointmentMinute,
        date: dateStr,
        branch: appointmentBranch || undefined,
        eventType: appointmentEventType || undefined,
        // Pour les jeux standards, pas de durationMinutes (seulement gameDurationMinutes)
        durationMinutes: (appointmentEventType && appointmentEventType !== 'game') 
          ? (appointmentDuration ?? undefined) 
          : undefined,
        color: appointmentColor || (isEvent ? '#22c55e' : '#3b82f6') // Vert pour EVENT, bleu pour GAME,
        eventNotes: appointmentEventNotes || undefined,
        customerFirstName: appointmentCustomerFirstName || undefined,
        customerLastName: appointmentCustomerLastName || undefined,
        customerPhone: appointmentCustomerPhone || undefined,
        customerEmail: appointmentCustomerEmail || undefined,
        customerNotes: appointmentCustomerNotes || undefined,
        gameDurationMinutes: appointmentGameDuration ?? undefined,
        participants: appointmentParticipants ?? undefined,
        // Si slotsToUse est vide, compactSlots assignera automatiquement les slots
        assignedSlots: slotsToUse.length > 0 ? slotsToUse : undefined,
        assignedRoom: assignedRoom,
      }
      
      setAppointments(prev => {
        // TOUJOURS utiliser compactSlots pour réorganiser tous les rendez-vous
        // Si slotsToUse est vide, le nouveau rendez-vous n'aura pas de slots assignés et compactSlots les trouvera
        // Si slotsToUse est fourni, compactSlots peut quand même déplacer d'autres rendez-vous si nécessaire
        const newAppointmentForCompaction = slotsToUse.length === 0
          ? { ...newAppointment, assignedSlots: undefined }
          : newAppointment
        const withNew = [...prev, newAppointmentForCompaction]
        const compacted = compactSlots(dateStr, withNew)
        const otherDates = withNew.filter(a => a.date !== dateStr)
        return [...otherDates, ...compacted]
      })
    }

    setShowAppointmentModal(false)
    setEditingAppointment(null)
    setAppointmentTitle('')
    setAppointmentHour(null)
    setAppointmentMinute(0)
    setAppointmentDate('')
    setAppointmentBranch('')
    setAppointmentEventType('')
    setAppointmentDuration(60)
    setAppointmentColor('#3b82f6')
    setAppointmentEventNotes('')
    setAppointmentCustomerFirstName('')
    setAppointmentCustomerLastName('')
    setAppointmentCustomerPhone('')
    setAppointmentCustomerEmail('')
    setAppointmentCustomerNotes('')
    setAppointmentGameDuration(60)
    setAppointmentParticipants(null)
    // Fermer la modal de confirmation de chevauchement
    setShowOverlapConfirm(false)
    setOverlapInfo(null)
    setPendingSave(null)
  }

  // Fonction robuste pour détecter les chevauchements
  // Retourne { hasOverlap: boolean, availableSlots: number, conflictingAppointments: SimpleAppointment[] }
  const checkForOverlap = (
    date: string,
    startMinutes: number,
    gameDurationMinutes: number,
    slotsNeeded: number,
    excludeAppointmentId?: string
  ): { hasOverlap: boolean; availableSlots: number; conflictingAppointments: SimpleAppointment[] } => {
    const endMinutes = startMinutes + gameDurationMinutes
    const conflictingAppointments: SimpleAppointment[] = []
    
    // Créer un tableau de disponibilité pour chaque slot
    const slotAvailability: boolean[][] = []
    for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
      slotAvailability[slot] = []
      // Initialiser tous les créneaux de 15 min comme disponibles
      for (let min = 10 * 60; min < 23 * 60; min += 15) {
        slotAvailability[slot][min] = true
      }
    }

    // Marquer les slots occupés par les autres rendez-vous
    appointments.forEach(appointment => {
      if (appointment.id === excludeAppointmentId) return
      if (appointment.date !== date) return
      
      // Calculer le temps de jeu centré pour ce rendez-vous
      const { gameStartMinutes: appGameStart, gameDurationMinutes: appGameDuration } = calculateCenteredGameTime(appointment)
      const appEndMinutes = appGameStart + appGameDuration
      const assignedSlots = appointment.assignedSlots || []
      
      if (assignedSlots.length === 0) return
      
      // Vérifier si ce rendez-vous chevauche le créneau demandé
      const overlaps = appGameStart < endMinutes && appEndMinutes > startMinutes
      if (overlaps) {
        conflictingAppointments.push(appointment)
        
        // Marquer les slots comme occupés sur TOUTE la durée du jeu (centré)
        assignedSlots.forEach(slotIndex => {
          if (slotIndex < 1 || slotIndex > TOTAL_SLOTS) return
          for (let min = appGameStart; min < appEndMinutes; min += 15) {
            if (slotAvailability[slotIndex] && slotAvailability[slotIndex][min] !== undefined) {
              slotAvailability[slotIndex][min] = false
            }
          }
        })
      }
    })

    // Compter les slots vraiment disponibles pour le créneau demandé
    let availableCount = 0
    for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
      let isAvailable = true
      for (let min = startMinutes; min < endMinutes; min += 15) {
        if (!slotAvailability[slot] || slotAvailability[slot][min] === undefined || !slotAvailability[slot][min]) {
          isAvailable = false
          break
        }
      }
      if (isAvailable) availableCount++
    }

    // Il y a un chevauchement si :
    // 1. Il y a des rendez-vous en conflit ET
    // 2. Pas assez de slots disponibles
    const hasOverlap = conflictingAppointments.length > 0 && availableCount < slotsNeeded

    return {
      hasOverlap,
      availableSlots: availableCount,
      conflictingAppointments
    }
  }

  const saveAppointment = () => {
    // Vérifier que prénom ou nom est rempli au lieu du titre
    if ((!appointmentCustomerFirstName?.trim() && !appointmentCustomerLastName?.trim()) || appointmentHour === null || !appointmentDate) {
      return
    }
    const dateStr = appointmentDate

    // Convertir les appointments existants en Bookings (exclure celui en cours d'édition)
    const existingBookings = appointments
      .filter(a => a.id !== editingAppointment?.id)
      .map(toBooking)

    // Préparer les paramètres pour le scheduler
    // RÈGLE CRITIQUE : Seuls les EVENT (anniversaire avec eventType !== 'game') bloquent une room
    // GAME (eventType === 'game' ou vide/null/undefined) = uniquement game-slots
    const isEvent = appointmentEventType && appointmentEventType !== 'game' && appointmentEventType.trim() !== ''
    const eventDurationMinutes = isEvent 
      ? (appointmentDuration ?? 120)
      : (appointmentGameDuration ?? 60)
    
    const params = {
      date: dateStr,
      hour: appointmentHour,
      minute: appointmentMinute,
      participants: appointmentParticipants ?? 0,
      type: (isEvent ? 'event' : 'game') as 'game' | 'event',
      durationMinutes: eventDurationMinutes,
      gameDurationMinutes: isEvent 
        ? 60 // Pour EVENT, jeu toujours 60 min centré
        : (appointmentGameDuration ?? 60),
      excludeBookingId: editingAppointment?.id
    }

    // Utiliser le scheduler pour placer le booking
    const roomConfigs = toRoomConfigs(roomCapacities)
    let result

    if (params.type === 'event') {
      result = placeEventBooking(existingBookings, params, roomConfigs, false)
    } else {
      result = placeGameBooking(existingBookings, params, true, false) // allowSplit pour GAME, pas de surbook par défaut
    }

    // Gérer le résultat
    if (result.success && result.allocation) {
      // Placement réussi : créer/mettre à jour le booking
      const newBooking: Booking = {
        id: editingAppointment?.id || `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: params.type,
        date: params.date,
        hour: params.hour,
        minute: params.minute,
        participants: params.participants,
        durationMinutes: params.durationMinutes,
        gameDurationMinutes: params.gameDurationMinutes,
        assignedSlots: result.allocation.slotAllocation?.slots,
        assignedRoom: result.allocation.roomAllocation?.roomId,
        customerFirstName: appointmentCustomerFirstName || undefined,
        customerLastName: appointmentCustomerLastName || undefined,
        color: appointmentColor || (isEvent ? '#22c55e' : '#3b82f6'), // Vert (#22c55e) pour EVENT, bleu (#3b82f6) pour GAME
      }

      // Convertir en SimpleAppointment et sauvegarder
      const newAppointment = fromBooking(newBooking, editingAppointment || undefined)
      
      setAppointments(prev => {
        let updated: SimpleAppointment[]
        if (editingAppointment) {
          updated = prev.map(a => a.id === editingAppointment.id ? newAppointment : a)
        } else {
          updated = [...prev, newAppointment]
        }
        
        // Réorganiser tous les bookings de la date avec le scheduler
        const reorganized = compactSlots(dateStr, updated, editingAppointment?.id)
        const otherDates = updated.filter(a => a.date !== dateStr)
        
        // Guard strict : vérifier qu'il n'y a pas de chevauchement
        // ROLLBACK si overlap détecté
        const allBookings = reorganized.map(toBooking)
        if (!assertNoOverlap(allBookings, dateStr, 'saveAppointment')) {
          // Rollback : ne pas modifier l'état
          return prev
        }
        
        return [...otherDates, ...reorganized]
      })

      // Fermer le modal
      setShowAppointmentModal(false)
      setEditingAppointment(null)
      // Reset form...
      setAppointmentCustomerFirstName('')
      setAppointmentCustomerLastName('')
      setAppointmentHour(null)
      setAppointmentDate('')
      setAppointmentParticipants(null)
      setAppointmentEventType('')
      setAppointmentGameDuration(60)
      setAppointmentDuration(60)
      setAppointmentColor('#3b82f6')
    } else if (result.conflict) {
      // Gérer les conflits
      // RÈGLE : FULL peut aussi proposer surbook si availableSlots > 0 ou si on force
      const canSurbook = result.conflict.type === 'NEED_SURBOOK_CONFIRM' || 
                        (result.conflict.type === 'FULL' && result.conflict.details && 
                         (result.conflict.details.availableSlots === 0 || result.conflict.details.availableSlots! < (result.conflict.details.neededSlots || 0)))
      
      if (canSurbook || result.conflict.type === 'NEED_ROOM_OVERCAP_CONFIRM') {
        // Afficher popup de confirmation
        if (canSurbook) {
          setOverlapInfo({
            slotsNeeded: result.conflict.details?.neededSlots || 0,
            availableSlots: result.conflict.details?.availableSlots || 0,
            maxParticipants: (result.conflict.details?.availableSlots || 0) * 6
          })
          setPendingSave(() => () => {
            // Marquer que le surbook est confirmé
            // Cela permet à saveAppointment() de repasser avec allowSurbook=true
            (window as any).__pendingSurbookConfirmed = true
            
            // Réessayer avec surbook autorisé en repassant par saveAppointment
            // Cela garantit que le backend (engine) accepte le surbook
            saveAppointment()
            
            // Nettoyer le flag après un délai
            setTimeout(() => {
              delete (window as any).__pendingSurbookConfirmed
            }, 1000)
          })
          setShowOverlapConfirm(true)
        } else if (result.conflict.type === 'NEED_ROOM_OVERCAP_CONFIRM') {
          setRoomCapacityInfo({
            roomNumber: result.conflict.details?.roomId || 0,
            roomName: `Salle ${result.conflict.details?.roomId || 0}`,
            maxCapacity: result.conflict.details?.roomCapacity || 0,
            participants: params.participants
          })
          setPendingRoomSave(() => () => {
            // Réessayer avec room overcap autorisé
            const overcapResult = placeEventBooking(existingBookings, params, roomConfigs, true)
            if (overcapResult.success && overcapResult.allocation) {
              const overcapBooking: Booking = {
                id: editingAppointment?.id || `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type: params.type,
                date: params.date,
                hour: params.hour,
                minute: params.minute,
                participants: params.participants,
                durationMinutes: params.durationMinutes,
                gameDurationMinutes: params.gameDurationMinutes,
                assignedSlots: overcapResult.allocation.slotAllocation?.slots,
                assignedRoom: overcapResult.allocation.roomAllocation?.roomId,
                roomOvercap: true,
                roomOvercapParticipants: result.conflict.details?.excessParticipants,
                customerFirstName: appointmentCustomerFirstName || undefined,
                customerLastName: appointmentCustomerLastName || undefined,
                color: appointmentColor || (isEvent ? '#22c55e' : '#3b82f6') // Vert pour EVENT, bleu pour GAME
              }
              const overcapAppointment = fromBooking(overcapBooking, editingAppointment || undefined)
              setAppointments(prev => {
                let updated: SimpleAppointment[]
                if (editingAppointment) {
                  updated = prev.map(a => a.id === editingAppointment.id ? overcapAppointment : a)
                } else {
                  updated = [...prev, overcapAppointment]
                }
                const reorganized = compactSlots(dateStr, updated, editingAppointment?.id)
                const otherDates = updated.filter(a => a.date !== dateStr)
                
                // Guard strict : rollback si overlap
                const allBookings = reorganized.map(toBooking)
                if (!assertNoOverlap(allBookings, dateStr, 'saveAppointment-overcap')) {
                  return prev // Rollback
                }
                
                return [...otherDates, ...reorganized]
              })
              setShowAppointmentModal(false)
              setEditingAppointment(null)
            }
          })
          setShowRoomCapacityConfirm(true)
        }
      } else {
        // Autres conflits : refuser
        alert(result.conflict.message)
      }
    }
  }

  // Afficher la pop-up de confirmation de suppression
  const confirmDeleteAppointment = (id: string) => {
    setAppointmentToDelete(id)
    setShowDeleteConfirm(true)
  }

  // Supprimer définitivement le rendez-vous après confirmation
  const deleteAppointment = () => {
    if (!appointmentToDelete) return
    
    setAppointments(prev => prev.filter(a => a.id !== appointmentToDelete))
    setShowAppointmentModal(false)
    setEditingAppointment(null)
    setShowDeleteConfirm(false)
    setAppointmentToDelete(null)
  }

  // Annuler la suppression
  const cancelDelete = () => {
    setShowDeleteConfirm(false)
    setAppointmentToDelete(null)
  }

  // Gestion du drag du modal
  const startDragModal = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const modal = e.currentTarget.closest('[data-appointment-modal]') as HTMLElement
    if (!modal) return
    
    const rect = modal.getBoundingClientRect()
    const currentX = appointmentModalPosition?.x ?? window.innerWidth / 2 - rect.width / 2
    const currentY = appointmentModalPosition?.y ?? window.innerHeight / 2 - rect.height / 2
    
    setIsDraggingModal(true)
    setDragStart({
      x: e.clientX - currentX,
      y: e.clientY - currentY,
    })
  }


  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingModal && dragStart) {
        const newX = e.clientX - dragStart.x
        const newY = e.clientY - dragStart.y
        // Permettre de déplacer partout, mais garder au moins un peu visible
        const minX = -600 // permet de cacher une partie mais garde un peu visible
        const minY = -400
        const maxX = window.innerWidth - 100
        const maxY = window.innerHeight - 100
        setAppointmentModalPosition({
          x: Math.max(minX, Math.min(maxX, newX)),
          y: Math.max(minY, Math.min(maxY, newY)),
        })
      }
    }

    const handleMouseUp = () => {
      if (isDraggingModal) {
        setIsDraggingModal(false)
        setDragStart(null)
        // Sauvegarder la position
        if (appointmentModalPosition) {
          localStorage.setItem('admin_appointment_modal_position', JSON.stringify(appointmentModalPosition))
        }
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingModal, dragStart, appointmentModalPosition])

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

  // Classes CSS conditionnelles selon le thème
  const bgMain = theme === 'light' ? 'bg-gray-50' : 'bg-gradient-to-b from-dark via-dark-100 to-dark-200'
  const bgCard = theme === 'light' ? 'bg-white' : 'bg-dark-100/50'
  const bgCardHover = theme === 'light' ? 'bg-gray-100' : 'bg-dark-200/30'
  const bgHeader = theme === 'light' ? 'bg-gray-100' : 'bg-dark-200/50'
  const textMain = theme === 'light' ? 'text-gray-900' : 'text-white'
  const textSecondary = theme === 'light' ? 'text-gray-600' : 'text-gray-400'
  const textPrimary = theme === 'light' ? 'text-gray-900' : 'text-primary'
  const borderColor = theme === 'light' ? 'border-gray-300' : 'border-primary/30'
  const inputBg = theme === 'light' ? 'bg-white' : 'bg-dark-200/50'
  const inputBorder = theme === 'light' ? 'border-gray-300' : 'border-primary/30'

  // Page de login
  if (!authenticated) {
    return (
      <div className={`min-h-screen ${bgMain} ${textMain} flex items-center justify-center py-12 px-4`}>
        <div className="max-w-md w-full">
          <div className={`${bgCard} backdrop-blur-sm rounded-2xl p-8 border-2 ${borderColor}`}>
            <h1 className="text-3xl font-bold mb-6 text-center" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Admin - Back Office
            </h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className={`block ${textMain} mb-2 text-base font-medium`}>Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Entrez le mot de passe"
                  required
                  autoFocus
                  className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-lg ${textMain} text-base placeholder-gray-500 focus:border-primary/70 focus:outline-none`}
                />
              </div>
              <button
                type="submit"
                className="glow-button w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-base"
              >
                <CheckCircle className="w-5 h-5" />
                Connexion
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  const weekDays = getWeekDays()
  const timeSlots = getTimeSlots()
  const calendarDays = getCalendarDays()
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

  // Page admin
  return (
    <div className={`min-h-screen ${bgMain} ${textMain} py-12 px-4`}>
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Back Office - Réservations
            </h1>
            <p className={textSecondary + ' text-base'}>Gestion des réservations</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleTheme}
              className={`p-2 ${bgCard} border ${borderColor} rounded-lg hover:${bgCardHover} transition-all`}
              title={theme === 'light' ? 'Mode sombre' : 'Mode clair'}
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5 text-gray-700" />
              ) : (
                <Sun className="w-5 h-5 text-yellow-400" />
              )}
            </button>
            <button
              onClick={cleanAndValidateData}
              className={`px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg hover:bg-yellow-500/30 transition-all text-base text-yellow-600 dark:text-yellow-400 flex items-center gap-2`}
              title="Nettoyer et valider les données (supprime les événements invalides/corrompus)"
            >
              <Trash2 className="w-4 h-4" />
              Nettoyer données
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              className={`px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition-all text-base text-red-500 flex items-center gap-2`}
              title="Vider tous les événements"
            >
              <Trash2 className="w-4 h-4" />
              Vider événements
            </button>
            <button
              onClick={handleLogout}
              className={`px-4 py-2 ${bgCard} border ${borderColor} rounded-lg hover:${bgCardHover} transition-all text-base`}
            >
              Déconnexion
            </button>
          </div>
        </div>

        {/* Onglets Table/Agenda */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setViewMode('table')}
            className={`px-6 py-3 rounded-lg border transition-all flex items-center gap-2 ${
              viewMode === 'table'
                ? 'bg-primary/20 border-primary text-primary'
                : `${bgCard} ${borderColor} ${textMain} hover:${bgCardHover}`
            }`}
          >
            <Grid className="w-5 h-5" />
            <span className="text-base font-medium">Tableau</span>
          </button>
          <button
            onClick={() => setViewMode('agenda')}
            className={`px-6 py-3 rounded-lg border transition-all flex items-center gap-2 ${
              viewMode === 'agenda'
                ? 'bg-primary/20 border-primary text-primary'
                : `${bgCard} ${borderColor} ${textMain} hover:${bgCardHover}`
            }`}
          >
            <CalendarDays className="w-5 h-5" />
            <span className="text-base font-medium">Agenda</span>
          </button>
        </div>

        {/* Barre de recherche */}
        <div className={`${bgCard} backdrop-blur-sm rounded-2xl p-6 border ${borderColor} mb-6`}>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${textSecondary}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, téléphone, email, numéro de réservation..."
                className={`w-full pl-10 pr-4 py-3 ${inputBg} border ${inputBorder} rounded-lg ${textMain} text-base placeholder-gray-500 focus:border-primary/70 focus:outline-none`}
              />
            </div>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`${bgCard} backdrop-blur-sm rounded-xl p-4 border ${borderColor}`}>
            <div className={`${textSecondary} text-base mb-1`}>Total</div>
            <div className={`text-3xl font-bold ${textPrimary}`}>{reservations.length}</div>
          </div>
          <div className={`${bgCard} backdrop-blur-sm rounded-xl p-4 border ${borderColor}`}>
            <div className={`${textSecondary} text-base mb-1`}>Confirmées</div>
            <div className="text-3xl font-bold text-green-500">
              {reservations.filter(r => r.status === 'confirmed').length}
            </div>
          </div>
          <div className={`${bgCard} backdrop-blur-sm rounded-xl p-4 border ${borderColor}`}>
            <div className={`${textSecondary} text-base mb-1`}>Annulées</div>
            <div className="text-3xl font-bold text-red-500">
              {reservations.filter(r => r.status === 'cancelled').length}
            </div>
          </div>
        </div>

        {/* Erreur */}
        {error && (
          <div className={`mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-base`}>
            {error}
          </div>
        )}

        {/* Vue Tableau */}
        {viewMode === 'table' && (
          <div className={`${bgCard} backdrop-blur-sm rounded-2xl border ${borderColor} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${bgHeader} border-b ${borderColor}`}>
                  <tr>
                    <th className="px-4 py-4 text-left">
                      <button
                        onClick={() => handleSort('reservationNumber')}
                        className={`flex items-center gap-2 text-base font-bold ${textPrimary} hover:opacity-80 transition-colors`}
                      >
                        <span>Numéro</span>
                        {getSortIcon('reservationNumber')}
                      </button>
                    </th>
                    <th className="px-4 py-4 text-left">
                      <button
                        onClick={() => handleSort('date')}
                        className={`flex items-center gap-2 text-base font-bold ${textPrimary} hover:opacity-80 transition-colors`}
                      >
                        <span>Date</span>
                        {getSortIcon('date')}
                      </button>
                    </th>
                    <th className="px-4 py-4 text-left">
                      <button
                        onClick={() => handleSort('time')}
                        className={`flex items-center gap-2 text-base font-bold ${textPrimary} hover:opacity-80 transition-colors`}
                      >
                        <span>Heure</span>
                        {getSortIcon('time')}
                      </button>
                    </th>
                    <th className="px-4 py-4 text-left">
                      <button
                        onClick={() => handleSort('lastName')}
                        className={`flex items-center gap-2 text-base font-bold ${textPrimary} hover:opacity-80 transition-colors`}
                      >
                        <span>Client</span>
                        {getSortIcon('lastName')}
                      </button>
                    </th>
                    <th className="px-4 py-4 text-left">
                      <button
                        onClick={() => handleSort('phone')}
                        className={`flex items-center gap-2 text-base font-bold ${textPrimary} hover:opacity-80 transition-colors`}
                      >
                        <span>Téléphone</span>
                        {getSortIcon('phone')}
                      </button>
                    </th>
                    <th className="px-4 py-4 text-left">
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleSort('branch')}
                          className={`flex items-center gap-2 text-base font-bold ${textPrimary} hover:opacity-80 transition-colors`}
                        >
                          <span>Branch</span>
                          {getSortIcon('branch')}
                        </button>
                        <select
                          value={columnFilters.branch || 'all'}
                          onChange={(e) => handleColumnFilter('branch', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className={`text-sm ${inputBg} border ${inputBorder} rounded px-2 py-1.5 ${textMain} focus:border-primary/50 focus:outline-none`}
                        >
                          <option value="all">Toutes</option>
                          <option value="Rishon LeZion">Rishon</option>
                          <option value="Petah Tikva">Petah Tikva</option>
                        </select>
                      </div>
                    </th>
                    <th className="px-4 py-4 text-left">
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleSort('type')}
                          className={`flex items-center gap-2 text-base font-bold ${textPrimary} hover:opacity-80 transition-colors`}
                        >
                          <span>Type</span>
                          {getSortIcon('type')}
                        </button>
                        <select
                          value={columnFilters.type || 'all'}
                          onChange={(e) => handleColumnFilter('type', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className={`text-sm ${inputBg} border ${inputBorder} rounded px-2 py-1.5 ${textMain} focus:border-primary/50 focus:outline-none`}
                        >
                          <option value="all">Tous</option>
                          <option value="game">Game</option>
                          <option value="event">Event</option>
                        </select>
                      </div>
                    </th>
                    <th className="px-4 py-4 text-left">
                      <button
                        onClick={() => handleSort('players')}
                        className={`flex items-center gap-2 text-base font-bold ${textPrimary} hover:opacity-80 transition-colors`}
                      >
                        <span>Participants</span>
                        {getSortIcon('players')}
                      </button>
                    </th>
                    <th className="px-4 py-4 text-left">
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleSort('status')}
                          className={`flex items-center gap-2 text-base font-bold ${textPrimary} hover:opacity-80 transition-colors`}
                        >
                          <span>Statut</span>
                          {getSortIcon('status')}
                        </button>
                        <select
                          value={columnFilters.status || 'all'}
                          onChange={(e) => handleColumnFilter('status', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className={`text-sm ${inputBg} border ${inputBorder} rounded px-2 py-1.5 ${textMain} focus:border-primary/50 focus:outline-none`}
                        >
                          <option value="all">Tous</option>
                          <option value="confirmed">Confirmées</option>
                          <option value="cancelled">Annulées</option>
                        </select>
                      </div>
                    </th>
                    <th className={`px-4 py-4 text-left text-base font-bold ${textPrimary}`}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className={`px-4 py-12 text-center text-base ${textSecondary}`}>
                        Chargement...
                      </td>
                    </tr>
                  ) : reservations.length === 0 ? (
                    <tr>
                      <td colSpan={10} className={`px-4 py-12 text-center text-base ${textSecondary}`}>
                        Aucune réservation trouvée
                      </td>
                    </tr>
                  ) : (
                    reservations.map((reservation) => (
                      <tr
                        key={reservation.id}
                        className={`border-b ${borderColor} hover:${bgCardHover} transition-colors`}
                      >
                        <td className="px-4 py-4">
                          <div className={`text-base font-mono ${textSecondary} whitespace-nowrap`}>
                            {reservation.reservationNumber}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className={`text-base ${textMain} whitespace-nowrap`}>
                            {formatDate(reservation.date)}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className={`text-base ${textMain} whitespace-nowrap`}>
                            {reservation.time}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className={`text-base ${textMain} whitespace-nowrap`}>
                            {reservation.firstName} {reservation.lastName}
                          </div>
                          {reservation.email && (
                            <div className={`text-sm ${textSecondary} mt-1`}>
                              {reservation.email}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className={`text-base ${textMain} whitespace-nowrap`}>
                            {reservation.phone}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className={`text-base ${textMain} whitespace-nowrap`}>
                            {reservation.branch}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-block px-3 py-1.5 rounded text-sm font-bold whitespace-nowrap ${
                              reservation.type === 'game'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-purple-500/20 text-purple-400'
                            }`}
                          >
                            {reservation.type === 'game' ? 'GAME' : 'EVENT'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className={`text-base ${textMain} whitespace-nowrap`}>
                            {reservation.players}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-block px-3 py-1.5 rounded text-sm font-bold whitespace-nowrap ${
                              reservation.status === 'confirmed'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {reservation.status === 'confirmed' ? 'Confirmée' : 'Annulée'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {reservation.status === 'confirmed' && (
                            <button
                              onClick={() => handleCancelReservation(reservation.id)}
                              className="p-2 bg-red-500/20 border border-red-500/30 rounded hover:bg-red-500/30 transition-all"
                              title="Annuler la réservation"
                            >
                              <Ban className="w-5 h-5 text-red-400" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Vue Agenda */}
        {viewMode === 'agenda' && (
          <div className={`${bgCard} backdrop-blur-sm rounded-2xl border ${borderColor}`}>
            {/* Barre supérieure : Bouton paramètres + Icône calendrier + Date centrée + Jours de la semaine à droite */}
            <div className={`${bgHeader} border-b ${borderColor} px-4 py-3`}>
              <div className="flex items-center justify-between gap-4">
                {/* Bouton Paramètres tout à gauche, avec espace avant le calendrier/agenda */}
                <div className="relative mr-6">
                  <button
                    onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                    className={`p-2 ${bgCard} border ${borderColor} rounded-lg hover:${bgCardHover} transition-all`}
                    title="Paramètres de l'agenda"
                  >
                    <Settings className={`w-5 h-5 ${textPrimary}`} />
                  </button>

                  {/* Panneau Paramètres */}
                  {showSettingsPanel && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowSettingsPanel(false)}
                      />
                      <div className={`absolute left-0 top-12 z-50 ${bgCard} border ${borderColor} rounded-lg shadow-xl p-4 min-w-[250px]`}>
                        <div className={`text-base font-bold ${textPrimary} mb-4`}>Paramètres de l'agenda</div>
                        
                        <div className="space-y-4">
                          <div>
                            <label className={`block ${textSecondary} text-sm mb-2`}>
                              Hauteur des lignes: {rowHeight}px
                            </label>
                            <input
                              type="range"
                              min="40"
                              max="120"
                              step="5"
                              value={rowHeight}
                              onChange={(e) => setRowHeight(Number(e.target.value))}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs mt-1">
                              <span className={textSecondary}>40px</span>
                              <span className={textSecondary}>120px</span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setRowHeight(60)
                                setShowSettingsPanel(false)
                              }}
                              className={`flex-1 px-3 py-2 ${bgCardHover} border ${borderColor} rounded hover:opacity-80 transition-all text-sm`}
                            >
                              Réinitialiser
                            </button>
                            <button
                              onClick={() => setShowSettingsPanel(false)}
                              className={`flex-1 px-3 py-2 bg-primary/20 border border-primary rounded hover:bg-primary/30 transition-all text-sm font-bold`}
                            >
                              Valider
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Icône calendrier à côté du bouton Paramètres */}
                <div className="relative mr-4">
                  <button
                    onClick={() => setShowCalendarModal(!showCalendarModal)}
                    className={`p-2 ${bgCard} border ${borderColor} rounded-lg hover:${bgCardHover} transition-all`}
                    title="Ouvrir le calendrier"
                  >
                    <Calendar className={`w-5 h-5 ${textPrimary}`} />
                  </button>

                  {/* Modal Calendrier */}
                  {showCalendarModal && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowCalendarModal(false)}
                      />
                      <div className={`absolute left-0 top-12 z-50 ${bgCard} border ${borderColor} rounded-lg shadow-xl p-4 min-w-[280px]`}>
                        {/* Navigation Mois/Année */}
                        <div className="flex items-center justify-between mb-4">
                          <button
                            onClick={handlePreviousYear}
                            className={`p-1 ${bgCardHover} rounded hover:opacity-80 transition-all`}
                            title="Année précédente"
                          >
                            <div className="relative w-4 h-4">
                              <ChevronLeft className={`w-4 h-4 ${textPrimary} absolute`} />
                              <ChevronLeft className={`w-4 h-4 ${textPrimary} absolute left-1`} />
                            </div>
                          </button>
                          <button
                            onClick={handlePreviousMonth}
                            className={`p-1 ${bgCardHover} rounded hover:opacity-80 transition-all`}
                            title="Mois précédent"
                          >
                            <ChevronLeft className={`w-4 h-4 ${textPrimary}`} />
                          </button>
                          <div className={`text-base font-bold ${textPrimary} px-4`}>
                            {monthNames[calendarMonth]} {calendarYear}
                          </div>
                          <button
                            onClick={handleNextMonth}
                            className={`p-1 ${bgCardHover} rounded hover:opacity-80 transition-all`}
                            title="Mois suivant"
                          >
                            <ChevronRight className={`w-4 h-4 ${textPrimary}`} />
                          </button>
                          <button
                            onClick={handleNextYear}
                            className={`p-1 ${bgCardHover} rounded hover:opacity-80 transition-all`}
                            title="Année suivante"
                          >
                            <div className="relative w-4 h-4">
                              <ChevronRight className={`w-4 h-4 ${textPrimary} absolute`} />
                              <ChevronRight className={`w-4 h-4 ${textPrimary} absolute left-1`} />
                            </div>
                          </button>
                        </div>

                        {/* Grille calendrier */}
                        <div className="grid grid-cols-7 gap-1">
                          {/* En-têtes jours */}
                          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
                            <div key={i} className={`text-xs ${textSecondary} text-center p-1 font-bold`}>
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
                            const isInWeek = weekDays.some(d => d.toDateString() === date.toDateString())
                            
                            return (
                              <button
                                key={i}
                                onClick={() => handleCalendarDateClick(date)}
                                className={`p-2 rounded text-sm transition-all ${
                                  isSelected
                                    ? 'bg-primary/30 text-primary font-bold'
                                    : isToday
                                    ? 'bg-primary/20 text-primary'
                                    : isInWeek
                                    ? `${bgCardHover} ${textMain}`
                                    : `${textMain} hover:${bgCardHover}`
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

                {/* Date centrée avec flèches + bouton Aujourd'hui */}
                <div className="flex items-center gap-2 flex-1 justify-center">
                  <button
                    onClick={handlePreviousDay}
                    className={`p-2 ${bgCard} border ${borderColor} rounded-lg hover:${bgCardHover} transition-all`}
                  >
                    <ChevronLeft className={`w-5 h-5 ${textPrimary}`} />
                  </button>
                  <div className={`text-lg font-bold ${textPrimary} min-w-[200px] text-center`}>
                    {formatDateFull(selectedDate)}
                  </div>
                  <button
                    onClick={handleNextDay}
                    className={`p-2 ${bgCard} border ${borderColor} rounded-lg hover:${bgCardHover} transition-all`}
                  >
                    <ChevronRight className={`w-5 h-5 ${textPrimary}`} />
                  </button>
                  <button
                    onClick={handleToday}
                    className={`px-3 py-2 bg-primary/20 border ${borderColor} rounded-lg hover:bg-primary/30 transition-all text-sm ml-2`}
                  >
                    Aujourd'hui
                  </button>
                </div>

                {/* Jours de la semaine (clic rapide) à droite */}
                <div className="flex gap-2">
                  {weekDays.map((day, index) => {
                    const isToday = day.toDateString() === new Date().toDateString()
                    const isSelected = day.toDateString() === selectedDate.toDateString()
                    return (
                      <button
                        key={index}
                        onClick={() => handleWeekDayClick(day)}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                          isSelected
                            ? `bg-primary/20 border-primary ${textPrimary} font-bold`
                            : isToday
                            ? `bg-primary/10 border-primary/30 ${textPrimary}`
                            : `${bgCard} ${borderColor} ${textMain} hover:${bgCardHover}`
                        }`}
                      >
                        <div className={`text-xs ${textSecondary} leading-tight`}>
                          {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                        </div>
                        <div className="text-sm font-bold leading-tight">
                          {day.getDate()}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Vue journalière : Lignes = horaires (15 min), Colonnes = 14 slots + 4 salles */}
            <div className="flex overflow-x-auto">
              {/* Colonne Heure - Labels 30 minutes, grille interne 15 minutes */}
              <div className={`w-24 ${bgHeader} border-r ${borderColor} sticky left-0 flex-shrink-0 z-10`}>
                {/* En-tête */}
                <div
                  className={`px-2 ${bgHeader} border-b ${borderColor} text-center flex items-center justify-center`}
                  style={{ height: `${rowHeight}px`, minHeight: `${rowHeight}px` }}
                >
                  <div className={`text-sm font-bold ${textPrimary}`}>Heure</div>
                </div>
                
                {/* Afficher les créneaux de 15 minutes, mais labels seulement sur les 30 min */}
                {Array.from({ length: 48 }, (_, i) => {
                  const hour = 10 + Math.floor(i / 4)
                  const minute = (i % 4) * 15
                  if (hour > 22) return null
                  
                  const is30MinLabel = minute === 0 || minute === 30
                  
                  return (
                    <div
                      key={`${hour}-${minute}`}
                      className={`w-full px-2 border-b ${borderColor} text-center flex items-center justify-center cursor-pointer hover:bg-primary/10 transition-colors`}
                      style={{ height: `${rowHeight / 2}px`, minHeight: `${rowHeight / 2}px` }}
                      onClick={() => {
                        // Ouvrir le modal pour créer un événement à cette heure (toutes les 15 min)
                        openNewAppointmentModal(hour, minute)
                      }}
                      title={`Cliquer pour créer un événement à ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`}
                    >
                      {is30MinLabel && (
                        <div className={`text-sm font-bold ${textPrimary}`}>
                          {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Zone avec slots + salles d'anniversaire (colonnes dynamiques) */}
              <div className="flex-1 relative" style={{ height: `${rowHeight + 48 * (rowHeight / 2)}px` }}>
                {/* En-tête des colonnes */}
                <div
                  className="grid sticky top-0 z-10"
                  style={{
                    gridTemplateColumns: `${Array(TOTAL_SLOTS).fill('1fr').join(' ')} 2px ${Array(TOTAL_ROOMS).fill('1fr').join(' ')}`,
                    height: `${rowHeight}px`,
                    minHeight: `${rowHeight}px`,
                  }}
                >
                  {/* Colonnes slots */}
                  {Array.from({ length: TOTAL_SLOTS }, (_, slotIndex) => {
                    const slotNumber = slotIndex + 1
                    return (
                      <div
                        key={`header-slot-${slotNumber}`}
                        className={`${bgHeader} border-r ${borderColor} border-b ${borderColor} text-center flex items-center justify-center`}
                      >
                        <div className={`text-xs font-bold ${textPrimary}`}>Slot {slotNumber}</div>
                      </div>
                    )
                  })}

                  {/* Ligne de séparation entre slots et salles */}
                  <div className={`${bgHeader} border-b ${borderColor} bg-gray-400/30`} style={{ borderRight: '2px solid #9ca3af' }} />

                  {/* Colonnes salles d'anniversaire */}
                  {Array.from({ length: TOTAL_ROOMS }, (_, roomIndex) => {
                    const roomNumber = roomIndex + 1
                    const roomCapacity = roomCapacities.get(roomNumber)
                    const roomName = roomCapacity?.name || `Salle ${roomNumber}`
                    const roomMaxCapacity = roomCapacity?.maxCapacity || 20
                    return (
                      <div
                        key={`header-room-${roomNumber}`}
                        className={`${bgHeader} border-r ${borderColor} border-b ${borderColor} text-center flex flex-col items-center justify-center cursor-pointer hover:bg-primary/10 transition-colors`}
                        onClick={() => {
                          setEditingRoomNumber(roomNumber)
                          setRoomSettingsCapacity(roomMaxCapacity)
                          setRoomSettingsName(roomName)
                          setShowRoomSettingsModal(true)
                        }}
                        title={`Cliquer pour modifier les paramètres de ${roomName} (Capacité: ${roomMaxCapacity} personnes)`}
                      >
                        <div className={`text-xs font-bold ${textPrimary}`}>{roomName}</div>
                        <div className={`text-xs ${textSecondary} mt-0.5`}>{roomMaxCapacity} pers.</div>
                      </div>
                    )
                  })}
                </div>

                {/* Grille de base : 48 lignes de 15 min × colonnes dynamiques */}
                {Array.from({ length: 48 }, (_, timeIndex) => {
                  const hour = 10 + Math.floor(timeIndex / 4)
                  const minute = (timeIndex % 4) * 15
                  if (hour > 22) return null
                  
                  const year = selectedDate.getFullYear()
                  const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
                  const day = String(selectedDate.getDate()).padStart(2, '0')
                  const dateStr = `${year}-${month}-${day}`

                  const timeStartMinutes = hour * 60 + minute

                  // Trouver les rendez-vous qui COMMENCENT à cette heure (sans doublons)
                  // Pour les événements avec salle, on vérifie si le jeu (centré) commence à cette heure
                  const appointmentsStartingHere = appointments.filter((a, index, self) => {
                    if (a.date !== dateStr) return false
                    const assignedSlots = a.assignedSlots || []
                    if (assignedSlots.length === 0) return false

                    // Calculer le temps de jeu centré
                    const { gameStartMinutes } = calculateCenteredGameTime(a)
                    if (gameStartMinutes !== timeStartMinutes) return false

                    // Éviter les doublons : vérifier que c'est le premier avec cet ID
                    return self.findIndex(app => app.id === a.id) === index
                  })

                  // Rendez-vous qui utilisent une salle à cette heure
                  const appointmentsWithRooms = appointments.filter((a, index, self) => {
                    if (a.date !== dateStr) return false
                    if (!a.assignedRoom) return false
                    if (a.eventType === 'game') return false // Les "game" ne bloquent pas les salles

                    const aStart = a.hour * 60 + (a.minute || 0)
                    if (aStart !== timeStartMinutes) return false

                    // Éviter les doublons
                    return self.findIndex(app => app.id === a.id) === index
                  })

                  return (
                    <div
                      key={`time-row-${hour}-${minute}`}
                      className="grid absolute w-full"
                      style={{
                        gridTemplateColumns: `${Array(TOTAL_SLOTS).fill('1fr').join(' ')} 2px ${Array(TOTAL_ROOMS).fill('1fr').join(' ')}`,
                        top: `${rowHeight + timeIndex * (rowHeight / 2)}px`,
                        height: `${rowHeight / 2}px`,
                      }}
                    >
                      {/* Colonnes slots */}
                      {Array.from({ length: TOTAL_SLOTS }, (_, slotIndex) => {
                        const slotNumber = slotIndex + 1

                        return (
                          <div
                            key={`cell-${hour}-${minute}-slot-${slotNumber}`}
                            className={`border-r ${borderColor} border-b ${borderColor} cursor-pointer hover:${bgCardHover} transition-colors relative`}
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest('[data-appointment-card]')) return
                              openNewAppointmentModal(hour, minute)
                            }}
                          />
                        )
                      })}

                      {/* Ligne de séparation entre slots et salles */}
                      <div className={`border-b ${borderColor} bg-gray-400/30`} style={{ borderRight: '2px solid #9ca3af' }} />

                      {/* Colonnes salles d'anniversaire */}
                      {Array.from({ length: TOTAL_ROOMS }, (_, roomIndex) => {
                        const roomNumber = roomIndex + 1

                        return (
                          <div
                            key={`cell-${hour}-${minute}-room-${roomNumber}`}
                            className={`border-r ${borderColor} border-b ${borderColor} cursor-pointer hover:${bgCardHover} transition-colors relative`}
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest('[data-appointment-card]')) return
                              openNewAppointmentModal(hour, minute)
                            }}
                          />
                        )
                      })}

                      {/* Afficher les rendez-vous dans les slots */}
                      {appointmentsStartingHere.map((appointment) => {
                        // Calculer le temps de jeu centré si l'événement a une salle
                        const { gameStartMinutes, gameDurationMinutes } = calculateCenteredGameTime(appointment)
                        const appointmentEndMinutes = gameStartMinutes + gameDurationMinutes
                        const assignedSlots = appointment.assignedSlots || []
                        
                        if (assignedSlots.length === 0) return null
                        
                        // Calculer combien de lignes de 15 min ce rendez-vous occupe
                        const durationIn15MinSlots = gameDurationMinutes / 15
                        
                        // Trouver le premier slot assigné
                        const minSlot = Math.min(...assignedSlots)
                        const widthCols = assignedSlots.length // Nombre total de slots assignés
                        
                        // Convertir couleur hex en couleur pleine
                        const getFullColor = (color: string | undefined) => {
                          if (!color) return '#93c5fd'
                          return color
                        }
                        
                        // Assombrir une couleur pour la bordure
                        const getDarkerColor = (color: string | undefined) => {
                          if (!color) return '#3b82f6'
                          const hex = color.replace('#', '')
                          const r = parseInt(hex.substring(0, 2), 16)
                          const g = parseInt(hex.substring(2, 4), 16)
                          const b = parseInt(hex.substring(4, 6), 16)
                          const darkerR = Math.max(0, Math.floor(r * 0.7))
                          const darkerG = Math.max(0, Math.floor(g * 0.7))
                          const darkerB = Math.max(0, Math.floor(b * 0.7))
                          return `rgb(${darkerR}, ${darkerG}, ${darkerB})`
                        }
                        
                        // Calculer la position et largeur : le bloc commence au premier slot et s'étend sur tous les slots assignés
                        // La grille a : TOTAL_SLOTS colonnes (1fr chacune) + 1 colonne séparation (2px) + TOTAL_ROOMS colonnes (1fr chacune)
                        // Avec CSS Grid, les colonnes 1fr sont calculées après avoir soustrait les colonnes fixes (2px)
                        // Pour positionner avec position: absolute, on utilise calc() pour tenir compte de la colonne de séparation
                        // Position dans la zone des slots (0 à 100% de la zone slots)
                        const startInSlots = (minSlot - 1) / TOTAL_SLOTS
                        const widthInSlots = widthCols / TOTAL_SLOTS
                        
                        // Calculer la largeur relative des slots (en négligeant les 2px qui sont négligeables)
                        const totalFr = TOTAL_SLOTS + TOTAL_ROOMS
                        const slotsWidthPercent = (TOTAL_SLOTS / totalFr) * 100
                        
                        // Position absolue dans la grille totale
                        const leftPercent = startInSlots * slotsWidthPercent
                        const widthPercent = widthInSlots * slotsWidthPercent
                        
                        // Utiliser toujours la couleur normale de l'événement
                        const displayColor = getFullColor(appointment.color)
                        const displayBorderColor = getDarkerColor(appointment.color)
                        
                        return (
                          <div
                            key={appointment.id}
                            data-appointment-card
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditAppointmentModal(appointment)
                            }}
                            className="rounded text-xs font-medium hover:opacity-90 transition-all overflow-hidden flex flex-col justify-center px-2 absolute"
                            style={{
                              left: `${leftPercent}%`,
                              width: `${widthPercent}%`,
                              top: 0,
                              height: `${durationIn15MinSlots * (rowHeight / 2)}px`,
                              backgroundColor: displayColor,
                              border: `1px solid ${displayBorderColor}`,
                              color: '#fff',
                              zIndex: 10,
                              boxSizing: 'border-box',
                            }}
                            title={formatAppointmentDisplay(appointment)}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate font-medium text-white">{formatAppointmentDisplay(appointment)}</span>
                            </div>
                          </div>
                        )
                      })}
                      
                      {/* Afficher les événements dans les colonnes de salles d'anniversaire */}
                      {appointmentsWithRooms.map((appointment) => {
                        const appointmentStartMinutes = appointment.hour * 60 + (appointment.minute || 0)
                        // Pour les salles, utiliser la durée de l'événement (durationMinutes)
                        // Si c'est un jeu standard, utiliser gameDurationMinutes à la place
                        const eventDuration = (appointment.eventType && appointment.eventType !== 'game')
                          ? (appointment.durationMinutes || 120)
                          : (appointment.gameDurationMinutes || 60)
                        const appointmentEndMinutes = appointmentStartMinutes + eventDuration
                        const assignedRoom = appointment.assignedRoom!
                        
                        // Calculer combien de lignes de 15 min cet événement occupe dans la salle
                        const durationIn15MinSlots = (appointmentEndMinutes - appointmentStartMinutes) / 15
                        
                        // Convertir couleur hex en couleur pleine
                        const getFullColor = (color: string | undefined) => {
                          if (!color) return '#93c5fd'
                          return color
                        }
                        
                        // Assombrir une couleur pour la bordure
                        const getDarkerColor = (color: string | undefined) => {
                          if (!color) return '#3b82f6'
                          const hex = color.replace('#', '')
                          const r = parseInt(hex.substring(0, 2), 16)
                          const g = parseInt(hex.substring(2, 4), 16)
                          const b = parseInt(hex.substring(4, 6), 16)
                          const darkerR = Math.max(0, Math.floor(r * 0.7))
                          const darkerG = Math.max(0, Math.floor(g * 0.7))
                          const darkerB = Math.max(0, Math.floor(b * 0.7))
                          return `rgb(${darkerR}, ${darkerG}, ${darkerB})`
                        }
                        
                        // Position dans les colonnes de salles (après les slots + séparation de 2px)
                        // La grille a : TOTAL_SLOTS colonnes (1fr chacune) + 1 colonne séparation (2px) + TOTAL_ROOMS colonnes (1fr chacune)
                        // Pour calculer les pourcentages, on doit tenir compte que la colonne de séparation est fixe (2px)
                        const totalFr = TOTAL_SLOTS + TOTAL_ROOMS
                        const slotsWidthPercent = (TOTAL_SLOTS / totalFr) * 100
                        const roomsWidthPercent = (TOTAL_ROOMS / totalFr) * 100
                        
                        // Position dans la zone des salles (0 à 100% de la zone salles)
                        const startInRooms = (assignedRoom - 1) / TOTAL_ROOMS
                        const widthInRooms = 1 / TOTAL_ROOMS
                        
                        // Position absolue dans la grille totale : après les slots + séparation
                        const leftPercent = slotsWidthPercent + (startInRooms * roomsWidthPercent)
                        const widthPercent = widthInRooms * roomsWidthPercent
                        
                        return (
                          <div
                            key={`room-${appointment.id}`}
                            data-appointment-card
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditAppointmentModal(appointment)
                            }}
                            className="rounded text-sm font-medium hover:opacity-90 transition-all overflow-hidden flex flex-col justify-center px-2 py-1 absolute items-center justify-center"
                            style={{
                              left: `${leftPercent}%`,
                              width: `${widthPercent}%`,
                              top: 0,
                              height: `${durationIn15MinSlots * (rowHeight / 2)}px`,
                              backgroundColor: getFullColor(appointment.color),
                              border: `1px solid ${getDarkerColor(appointment.color)}`,
                              color: '#fff',
                              zIndex: 10,
                              boxSizing: 'border-box',
                            }}
                            title={formatAppointmentDisplay(appointment)}
                          >
                            <div className="flex flex-col gap-1 w-full items-center justify-center text-center">
                              {(() => {
                                const display = formatAppointmentDisplayForRooms(appointment)
                                return (
                                  <>
                                    <span className="font-medium text-white break-words whitespace-normal leading-tight text-sm">
                                      {display.name}
                                    </span>
                                    {display.details && (
                                      <span className="text-white/90 text-xs break-words whitespace-normal leading-tight">
                                        {display.details}
                                      </span>
                                    )}
                                  </>
                                )
                              })()}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Modal de confirmation pour vider tous les événements */}
            {showClearConfirm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                <div className={`${bgCard} rounded-lg p-6 max-w-md w-full border ${borderColor}`}>
                  <h3 className={`text-lg font-bold mb-4 ${textPrimary}`}>Confirmer la suppression</h3>
                  <p className={`${textSecondary} mb-6`}>
                    Êtes-vous sûr de vouloir supprimer tous les événements ? Cette action est irréversible.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className={`px-4 py-2 ${bgCardHover} border ${borderColor} rounded-lg hover:opacity-80 transition-all`}
                    >
                      Annuler
                    </button>
                    <button
                      onClick={clearAllAppointments}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                    >
                      Supprimer tout
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal création / édition de rendez-vous simples */}
            {showAppointmentModal && (
              <>
                <div
                  className="fixed inset-0 bg-black/40 z-40"
                  onClick={() => {
                    setShowAppointmentModal(false)
                    setEditingAppointment(null)
                    setAppointmentTitle('')
                    setAppointmentHour(null)
                    setAppointmentDate('')
                  }}
                />
                {/* Fenêtre pop-up indépendante, draggable */}
                <div className="fixed inset-0 z-50 pointer-events-none">
                  <div
                    data-appointment-modal
                    className={`${bgCard} border ${borderColor} rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col pointer-events-auto relative`}
                    style={{
                      position: 'absolute',
                      ...(appointmentModalPosition
                        ? {
                            left: `${appointmentModalPosition.x}px`,
                            top: `${appointmentModalPosition.y}px`,
                            transform: 'none',
                          }
                        : {
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                          }),
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      // Si on appuie sur Entrée et que le formulaire est valide, sauvegarder
                      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                        // Ne pas déclencher si on est dans un textarea
                        const target = e.target as HTMLElement
                        if (target.tagName === 'TEXTAREA') return
                        
                        // Vérifier que les champs requis sont remplis
                                  if ((appointmentCustomerFirstName?.trim() || appointmentCustomerLastName?.trim()) && appointmentHour !== null && appointmentDate) {
                          e.preventDefault()
                          saveAppointment()
                        }
                      }
                    }}
                  >
                    {/* Header draggable */}
                    <div
                      className="flex items-center justify-between px-6 py-4 border-b border-gray-600 cursor-move select-none"
                      onMouseDown={startDragModal}
                    >
                      <h3 className={`text-xl font-bold ${textPrimary}`}>
                        {editingAppointment ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
                      </h3>
                      <span className={`text-xs ${textSecondary}`}>Glisser pour déplacer</span>
                    </div>

                    {/* Contenu scrollable */}
                    <div className="flex-1 overflow-y-auto px-6 pt-4 pb-4 space-y-6">
                      {/* Section 1 : Informations Événement */}
                      <div>
                        <h4 className={`text-base font-semibold mb-3 ${textPrimary}`}>Informations de l'événement</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className={`block text-sm mb-1 ${textSecondary}`}>Branche</label>
                            <select
                              value={appointmentBranch}
                              onChange={(e) => setAppointmentBranch(e.target.value)}
                              className={`w-full px-3 py-2 rounded border ${borderColor} ${inputBg} ${textMain} text-sm focus:outline-none focus:border-primary`}
                            >
                              <option value="">Sélectionner une branche</option>
                              <option value="Rishon LeZion">Rishon LeZion</option>
                              <option value="Petah Tikva">Petah Tikka</option>
                            </select>
                          </div>

                          <div>
                            <label className={`block text-sm mb-1 ${textSecondary}`}>Type d'événement</label>
                            <select
                              value={appointmentEventType}
                              onChange={(e) => setAppointmentEventType(e.target.value)}
                              className={`w-full px-3 py-2 rounded border ${borderColor} ${inputBg} ${textMain} text-sm focus:outline-none focus:border-primary`}
                            >
                              <option value="">Sélectionner un type</option>
                              <option value="game">Jeu privé/personnel</option>
                              <option value="birthday">Anniversaire</option>
                              <option value="bar_bat_mitzvah">Bar/Bat Mitzvah</option>
                              <option value="corporate">Corporate</option>
                              <option value="party">Soirée</option>
                              <option value="other">Autre</option>
                            </select>
                          </div>

                          {/* Sélection de salle d'anniversaire (seulement si ce n'est pas un "game") */}
                          {appointmentEventType && appointmentEventType !== 'game' && (
                            <div>
                              <label className={`block text-sm mb-1 ${textSecondary}`}>Salle d'anniversaire</label>
                              <select
                                value={appointmentRoom || ''}
                                onChange={(e) => setAppointmentRoom(e.target.value ? Number(e.target.value) : null)}
                                className={`w-full px-3 py-2 rounded border ${borderColor} ${inputBg} ${textMain} text-sm focus:outline-none focus:border-primary`}
                              >
                                <option value="">Auto (trouver automatiquement)</option>
                                {Array.from({ length: TOTAL_ROOMS }, (_, i) => {
                                  const roomNumber = i + 1
                                  return (
                                    <option key={roomNumber} value={roomNumber}>
                                      Room {roomNumber}
                                    </option>
                                  )
                                })}
                              </select>
                            </div>
                          )}

                          <div>
                            <label className={`block text-sm mb-1 ${textSecondary}`}>Date</label>
                            <input
                              type="date"
                              value={appointmentDate}
                              onChange={(e) => setAppointmentDate(e.target.value)}
                              className={`w-full px-3 py-2 rounded border ${borderColor} ${inputBg} ${textMain} text-sm focus:outline-none focus:border-primary`}
                            />
                          </div>

                          <div>
                            <label className={`block text-sm mb-1 ${textSecondary}`}>Heure</label>
                            <select
                              value={appointmentHour !== null && appointmentMinute !== null ? `${appointmentHour * 100 + appointmentMinute}` : ''}
                              onChange={(e) => {
                                const slotId = Number(e.target.value)
                                if (slotId) {
                                  setAppointmentHour(Math.floor(slotId / 100))
                                  setAppointmentMinute(slotId % 100)
                                } else {
                                  setAppointmentHour(null)
                                  setAppointmentMinute(0)
                                }
                              }}
                              className={`w-full px-3 py-2 rounded border ${borderColor} ${inputBg} ${textMain} text-sm focus:outline-none focus:border-primary`}
                            >
                              <option value="">Sélectionner une heure</option>
                              {timeSlots.map((slot) => (
                                <option key={slot.slotId} value={slot.slotId}>
                                  {slot.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Durée événement - UNIQUEMENT pour les événements (pas pour les jeux standards) */}
                          {appointmentEventType && appointmentEventType !== 'game' && (
                            <div>
                              <label className={`block text-sm mb-1 ${textSecondary}`}>Durée événement (min)</label>
                              <input
                                type="number"
                                min={15}
                                step={15}
                                value={appointmentDuration ?? 120}
                                onChange={(e) =>
                                  setAppointmentDuration(e.target.value ? Number(e.target.value) : 120)
                                }
                                className={`w-full px-3 py-2 rounded border ${borderColor} ${inputBg} ${textMain} text-sm focus:outline-none focus:border-primary`}
                                title="Durée totale de l'événement (bloque la salle d'anniversaire)"
                              />
                            </div>
                          )}


                          <div>
                            <label className={`block text-sm mb-1 ${textSecondary}`}>Couleur</label>
                            <div className="flex items-center gap-3 flex-wrap">
                              {presetColors.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => {
                                    setAppointmentColor(color)
                                    setUserChangedColor(true) // L'utilisateur a modifié la couleur manuellement
                                  }}
                                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                                    appointmentColor === color ? 'border-white ring-2 ring-offset-2 ring-primary' : 'border-gray-300'
                                  }`}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                              <span className={`text-xs ${textSecondary}`}>Couleur de l'événement dans l'agenda</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <label className={`block text-sm mb-1 ${textSecondary}`}>
                            Notes internes sur l'événement (pour le vendeur)
                          </label>
                          <textarea
                            value={appointmentEventNotes}
                            onChange={(e) => setAppointmentEventNotes(e.target.value)}
                            rows={3}
                            className={`w-full px-3 py-2 rounded border ${borderColor} ${inputBg} ${textMain} text-sm focus:outline-none focus:border-primary`}
                            placeholder="Contraintes particulières de salle, déco, timing, etc."
                          />
                        </div>
                      </div>

                      {/* Section 2 : Informations Client & Jeu */}
                      <div>
                        <h4 className={`text-base font-semibold mb-3 ${textPrimary}`}>Informations client & jeu</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className={`block text-sm mb-1 ${textSecondary}`}>Prénom</label>
                            <input
                              type="text"
                              value={appointmentCustomerFirstName}
                              onChange={(e) => setAppointmentCustomerFirstName(e.target.value)}
                              autoFocus={!editingAppointment} // Auto-focus sur prénom pour nouveau événement
                              className={`w-full px-3 py-2 rounded border ${borderColor} ${inputBg} ${textMain} text-sm focus:outline-none focus:border-primary`}
                            />
                          </div>
                          <div>
                            <label className={`block text-sm mb-1 ${textSecondary}`}>Nom</label>
                            <input
                              type="text"
                              value={appointmentCustomerLastName}
                              onChange={(e) => setAppointmentCustomerLastName(e.target.value)}
                              className={`w-full px-3 py-2 rounded border ${borderColor} ${inputBg} ${textMain} text-sm focus:outline-none focus:border-primary`}
                            />
                          </div>

                          <div>
                            <label className={`block text-sm mb-1 ${textSecondary}`}>Téléphone</label>
                            <input
                              type="tel"
                              value={appointmentCustomerPhone}
                              onChange={(e) => setAppointmentCustomerPhone(e.target.value)}
                              className={`w-full px-3 py-2 rounded border ${borderColor} ${inputBg} ${textMain} text-sm focus:outline-none focus:border-primary`}
                            />
                          </div>
                          <div>
                            <label className={`block text-sm mb-1 ${textSecondary}`}>Email</label>
                            <input
                              type="email"
                              value={appointmentCustomerEmail}
                              onChange={(e) => setAppointmentCustomerEmail(e.target.value)}
                              className={`w-full px-3 py-2 rounded border ${borderColor} ${inputBg} ${textMain} text-sm focus:outline-none focus:border-primary`}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className={`block text-sm mb-1 ${textSecondary}`}>Durée de jeu (min)</label>
                              <input
                                type="number"
                                min={15}
                                step={15}
                                value={appointmentGameDuration ?? 60}
                                onChange={(e) =>
                                  setAppointmentGameDuration(e.target.value ? Number(e.target.value) : 60)
                                }
                                className={`w-full px-3 py-2 rounded border ${borderColor} ${inputBg} ${textMain} text-sm focus:outline-none focus:border-primary`}
                                title="Durée du jeu (bloque les slots)"
                              />
                            </div>
                            <div>
                              <label className={`block text-sm mb-1 ${textSecondary}`}>Participants</label>
                              <input
                                type="number"
                                min={1}
                                value={appointmentParticipants ?? ''}
                                onChange={(e) =>
                                  setAppointmentParticipants(e.target.value ? Number(e.target.value) : null)
                                }
                                className={`w-full px-3 py-2 rounded border ${borderColor} ${inputBg} ${textMain} text-sm focus:outline-none focus:border-primary`}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <label className={`block text-sm mb-1 ${textSecondary}`}>
                            Notes client / demandes particulières
                          </label>
                          <textarea
                            value={appointmentCustomerNotes}
                            onChange={(e) => setAppointmentCustomerNotes(e.target.value)}
                            rows={3}
                            className={`w-full px-3 py-2 rounded border ${borderColor} ${inputBg} ${textMain} text-sm focus:outline-none focus:border-primary`}
                            placeholder="Allergies, langage, demandes spéciales, etc."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Footer avec de l'air autour */}
                    <div className="px-6 py-4 flex justify-between gap-4 border-t border-gray-700">
                      {editingAppointment ? (
                        <button
                          onClick={() => confirmDeleteAppointment(editingAppointment.id)}
                          className="px-4 py-2 rounded-lg border border-red-500 text-red-500 text-sm hover:bg-red-500/10 transition-all"
                        >
                          Supprimer
                        </button>
                      ) : (
                        <span />
                      )}

                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setShowAppointmentModal(false)
                            setEditingAppointment(null)
                            setAppointmentTitle('')
                            setAppointmentHour(null)
                            setAppointmentDate('')
                          }}
                          className={`px-4 py-2 rounded-lg border ${borderColor} text-sm ${textSecondary} hover:${bgCardHover} transition-all min-w-[120px]`}
                        >
                          Annuler
                        </button>
                        <button
                          onClick={saveAppointment}
                          disabled={(!appointmentCustomerFirstName?.trim() && !appointmentCustomerLastName?.trim()) || appointmentHour === null || !appointmentDate}
                          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all min-w-[140px]"
                        >
                          Enregistrer
                        </button>
                      </div>
                    </div>

                    {/* Modal de confirmation de chevauchement - centré sur la pop-up du rendez-vous */}
                    {showOverlapConfirm && overlapInfo && (
                      <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl"
                        onClick={() => {
                          setShowOverlapConfirm(false)
                          setOverlapInfo(null)
                          setPendingSave(null)
                        }}
                      >
                        <div
                          data-overlap-confirm-modal
                          className={`${bgCard} border ${borderColor} rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col pointer-events-auto mx-4`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <h3 className={`text-xl font-bold mb-4 ${textPrimary}`}>
                            {overlapInfo.availableSlots === 0 
                              ? 'Aucun slot disponible - Chevauchement détecté'
                              : 'Pas assez de slots disponibles'}
                          </h3>
                          
                          <p className={`${textSecondary} mb-4`}>
                            {overlapInfo.availableSlots === 0 ? (
                              <>
                                Ce rendez-vous nécessite <strong>{overlapInfo.slotsNeeded} slot(s)</strong>, mais <strong>aucun slot n'est disponible</strong> sur ce créneau.
                                <br />
                                <strong>Tous les slots sont occupés.</strong>
                              </>
                            ) : (
                              <>
                                Ce rendez-vous nécessite <strong>{overlapInfo.slotsNeeded} slot(s)</strong>, mais seulement <strong>{overlapInfo.availableSlots} slot(s)</strong> sont disponibles.
                              </>
                            )}
                          </p>
                          
                          {overlapInfo.availableSlots > 0 && (
                            <p className={`${textSecondary} mb-6`}>
                              Maximum possible : <strong>{overlapInfo.maxParticipants} participants</strong> ({overlapInfo.availableSlots} slot(s) × 6 personnes).
                            </p>
                          )}
                          
                          <p className={`${textSecondary} mb-6 text-sm`}>
                            {overlapInfo.availableSlots === 0 ? (
                              <>
                                Si vous acceptez, le système créera l'événement avec un chevauchement complet. Vous pouvez autoriser ce chevauchement si nécessaire.
                              </>
                            ) : (
                              <>
                                Si vous acceptez, le système utilisera les slots disponibles ({overlapInfo.availableSlots} slot(s)) et créera un chevauchement partiel si nécessaire. Le système tentera également de déplacer automatiquement les autres rendez-vous pour libérer plus de slots.
                              </>
                            )}
                          </p>

                          <div className="flex gap-3 justify-end">
                            <button
                              onClick={() => {
                                setShowOverlapConfirm(false)
                                setOverlapInfo(null)
                                setPendingSave(null)
                              }}
                              className={`px-4 py-2 rounded-lg border ${borderColor} text-sm ${textSecondary} hover:${bgCardHover} transition-all min-w-[120px]`}
                            >
                              Refuser
                            </button>
                            <button
                              onClick={() => {
                                if (pendingSave) {
                                  pendingSave()
                                }
                                setShowOverlapConfirm(false)
                                setOverlapInfo(null)
                                setPendingSave(null)
                              }}
                              className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all min-w-[120px]"
                            >
                              Accepter
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Modal de confirmation de suppression - centré sur la pop-up du rendez-vous */}
                    {showDeleteConfirm && (
                      <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl"
                        onClick={cancelDelete}
                      >
                        <div
                          data-delete-confirm-modal
                          className={`${bgCard} border ${borderColor} rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col pointer-events-auto mx-4`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <h3 className={`text-xl font-bold mb-4 ${textPrimary}`}>
                            Confirmer la suppression
                          </h3>
                          
                          <p className={`${textSecondary} mb-6`}>
                            Êtes-vous sûr de vouloir supprimer ce rendez-vous ? Cette action est irréversible.
                          </p>

                          <div className="flex gap-3 justify-end">
                            <button
                              onClick={cancelDelete}
                              className={`px-4 py-2 rounded-lg border ${borderColor} text-sm ${textSecondary} hover:${bgCardHover} transition-all min-w-[120px]`}
                            >
                              Annuler
                            </button>
                            <button
                              onClick={deleteAppointment}
                              className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-all min-w-[120px]"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Modal de confirmation de dépassement de capacité de salle */}
                    {showRoomCapacityConfirm && roomCapacityInfo && (
                      <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl"
                        onClick={() => {
                          setShowRoomCapacityConfirm(false)
                          setRoomCapacityInfo(null)
                          setPendingRoomSave(null)
                        }}
                      >
                        <div
                          data-room-capacity-confirm-modal
                          className={`${bgCard} border ${borderColor} rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col pointer-events-auto mx-4`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <h3 className={`text-xl font-bold mb-4 ${textPrimary}`}>
                            Capacité de salle dépassée
                          </h3>
                          
                          <p className={`${textSecondary} mb-4`}>
                            La salle <strong>{roomCapacityInfo.roomName}</strong> a une capacité maximale de <strong>{roomCapacityInfo.maxCapacity} personnes</strong>.
                            <br />
                            Vous souhaitez créer un événement avec <strong>{roomCapacityInfo.participants} participants</strong>.
                          </p>
                          
                          <p className={`${textSecondary} mb-6 text-sm`}>
                            Voulez-vous autoriser ce dépassement de capacité ? L'événement sera créé dans cette salle malgré le dépassement.
                          </p>

                          <div className="flex gap-3 justify-end">
                            <button
                              onClick={() => {
                                setShowRoomCapacityConfirm(false)
                                setRoomCapacityInfo(null)
                                setPendingRoomSave(null)
                              }}
                              className={`px-4 py-2 rounded-lg border ${borderColor} text-sm ${textSecondary} hover:${bgCardHover} transition-all min-w-[120px]`}
                            >
                              Refuser
                            </button>
                            <button
                              onClick={() => {
                                // Fermer le modal AVANT d'appeler la sauvegarde pour éviter les boucles
                                setShowRoomCapacityConfirm(false)
                                const saveFunction = pendingRoomSave
                                setRoomCapacityInfo(null)
                                setPendingRoomSave(null)
                                
                                // Appeler la sauvegarde après avoir fermé le modal
                                if (saveFunction) {
                                  // Utiliser setTimeout pour s'assurer que le state est mis à jour
                                  setTimeout(() => {
                                    saveFunction()
                                  }, 0)
                                }
                              }}
                              className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all min-w-[120px]"
                            >
                              Autoriser
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Modal de paramètres de salle */}
            {showRoomSettingsModal && editingRoomNumber !== null && (
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
                onClick={() => {
                  setShowRoomSettingsModal(false)
                  setEditingRoomNumber(null)
                }}
              >
                <div
                  className={`${bgCard} border ${borderColor} rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col pointer-events-auto mx-4`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className={`text-xl font-bold mb-4 ${textPrimary}`}>
                    Paramètres de la salle {editingRoomNumber}
                  </h3>
                  
                  <div className="mb-4">
                    <label className={`block text-sm mb-1 ${textSecondary}`}>
                      Nom de la salle
                    </label>
                    <input
                      type="text"
                      value={roomSettingsName}
                      onChange={(e) => setRoomSettingsName(e.target.value)}
                      className={`w-full px-3 py-2 rounded border ${borderColor} ${inputBg} ${textMain} text-sm focus:outline-none focus:border-primary`}
                      placeholder={`Salle ${editingRoomNumber}`}
                    />
                  </div>

                  <div className="mb-6">
                    <label className={`block text-sm mb-1 ${textSecondary}`}>
                      Capacité maximale (nombre de personnes)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={roomSettingsCapacity}
                      onChange={(e) => setRoomSettingsCapacity(Number(e.target.value))}
                      className={`w-full px-3 py-2 rounded border ${borderColor} ${inputBg} ${textMain} text-sm focus:outline-none focus:border-primary`}
                    />
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => {
                        setShowRoomSettingsModal(false)
                        setEditingRoomNumber(null)
                      }}
                      className={`px-4 py-2 rounded-lg border ${borderColor} text-sm ${textSecondary} hover:${bgCardHover} transition-all min-w-[120px]`}
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => {
                        const newCapacities = new Map(roomCapacities)
                        newCapacities.set(editingRoomNumber, {
                          maxCapacity: roomSettingsCapacity,
                          name: roomSettingsName.trim() || `Salle ${editingRoomNumber}`
                        })
                        setRoomCapacities(newCapacities)
                        
                        // Sauvegarder dans localStorage
                        if (typeof window !== 'undefined') {
                          const capacitiesObj: Record<number, RoomCapacity> = {}
                          newCapacities.forEach((capacity, roomNum) => {
                            capacitiesObj[roomNum] = capacity
                          })
                          localStorage.setItem('admin_room_capacities', JSON.stringify(capacitiesObj))
                        }
                        
                        setShowRoomSettingsModal(false)
                        setEditingRoomNumber(null)
                      }}
                      className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all min-w-[120px]"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
