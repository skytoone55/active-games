'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, Users, MapPin, Phone, Mail, Search, Filter, X, Ban, CheckCircle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Grid, CalendarDays, Sun, Moon, Settings } from 'lucide-react'
import { Reservation } from '@/lib/reservations'

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
        // Sécuriser les anciens rendez-vous avec valeurs par défaut
        setAppointments(
          parsed.map((a) => ({
            ...a,
            color: a.color || '#3b82f6',
            durationMinutes: a.durationMinutes ?? 60,
          })),
        )
      } catch {
        setAppointments([])
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

  // Compacter les slots : déplacer les rendez-vous pour remplir les trous à gauche
  // RÈGLE TETRIS : Aucun bloc ne peut entrer dans un autre bloc
  // Si conflit détecté, déplacer automatiquement les rendez-vous existants
  const compactSlots = (date: string, allAppointments: SimpleAppointment[], excludeAppointmentId?: string): SimpleAppointment[] => {
    // Récupérer tous les rendez-vous pour cette date (y compris ceux sans slots assignés)
    const dateAppointments = allAppointments
      .filter(a => a.date === date && a.id !== excludeAppointmentId)
      .map(a => ({ ...a }))

    if (dateAppointments.length === 0) return []

    // Trier par heure de début (plus tôt d'abord) pour un placement séquentiel
    dateAppointments.sort((a, b) => {
      const aStart = a.hour * 60 + (a.minute || 0)
      const bStart = b.hour * 60 + (b.minute || 0)
      return aStart - bStart
    })

    // Créer une carte de disponibilité pour chaque slot à chaque moment
    const slotUsage: Map<number, Set<number>> = new Map() // slot -> Set de minutes occupées
    
    // Initialiser tous les slots comme libres
    for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
      slotUsage.set(slot, new Set())
    }

    // Fonction pour vérifier si des slots sont disponibles pour un créneau
    // Vérifie à la fois slotUsage ET les rendez-vous déjà placés dans compactedAppointments
    const areSlotsAvailable = (slots: number[], startMinutes: number, endMinutes: number, excludeAppointmentId?: string): boolean => {
      // Vérifier d'abord dans slotUsage
      for (const slot of slots) {
        const occupiedMinutes = slotUsage.get(slot)
        if (!occupiedMinutes) return false
        
        for (let min = startMinutes; min < endMinutes; min += 15) {
          if (occupiedMinutes.has(min)) {
            return false
          }
        }
      }
      
      // Vérifier aussi les conflits avec les rendez-vous déjà placés
      for (const existing of compactedAppointments) {
        if (excludeAppointmentId && existing.id === excludeAppointmentId) continue
        
        const existingStart = existing.hour * 60 + (existing.minute || 0)
        const existingDuration = existing.gameDurationMinutes || existing.durationMinutes || 60
        const existingEnd = existingStart + existingDuration
        const existingSlots = existing.assignedSlots || []
        
        // Vérifier si les créneaux se chevauchent
        const timeOverlap = existingStart < endMinutes && existingEnd > startMinutes
        
        if (timeOverlap) {
          // Vérifier si les slots se chevauchent
          const slotOverlap = slots.some(slot => existingSlots.includes(slot))
          if (slotOverlap) {
            return false // Conflit détecté
          }
        }
      }
      
      return true
    }

    // Fonction pour réserver des slots
    const reserveSlots = (slots: number[], startMinutes: number, endMinutes: number) => {
      for (const slot of slots) {
        const occupiedMinutes = slotUsage.get(slot)
        if (occupiedMinutes) {
          for (let min = startMinutes; min < endMinutes; min += 15) {
            occupiedMinutes.add(min)
          }
        }
      }
    }

    // Fonction pour libérer des slots
    const releaseSlots = (slots: number[], startMinutes: number, endMinutes: number) => {
      for (const slot of slots) {
        const occupiedMinutes = slotUsage.get(slot)
        if (occupiedMinutes) {
          for (let min = startMinutes; min < endMinutes; min += 15) {
            occupiedMinutes.delete(min)
          }
        }
      }
    }

    // Traiter chaque rendez-vous dans l'ordre chronologique
    const compactedAppointments: SimpleAppointment[] = []
    
    for (const appointment of dateAppointments) {
      const startMinutes = appointment.hour * 60 + (appointment.minute || 0)
      const duration = appointment.gameDurationMinutes || appointment.durationMinutes || 60
      const endMinutes = startMinutes + duration
      // Si assignedSlots est défini et non vide, utiliser sa longueur, sinon calculer à partir des participants
      const slotsNeeded = (appointment.assignedSlots && appointment.assignedSlots.length > 0)
        ? appointment.assignedSlots.length 
        : calculateSlotsNeeded(appointment.participants)
      
      // Chercher les meilleurs slots pour le rendez-vous actuel (de gauche à droite)
      let bestSlots: number[] | null = null
      
      // Essayer de trouver des slots consécutifs d'abord (de gauche à droite)
      for (let startSlot = 1; startSlot <= TOTAL_SLOTS - slotsNeeded + 1; startSlot++) {
        const candidateSlots = Array.from({ length: slotsNeeded }, (_, i) => startSlot + i)
        if (areSlotsAvailable(candidateSlots, startMinutes, endMinutes, appointment.id)) {
          bestSlots = candidateSlots
          break
        }
      }
      
      // Si pas de slots consécutifs, prendre les premiers disponibles (de gauche à droite)
      if (!bestSlots) {
        const availableSlots: number[] = []
        for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
          if (availableSlots.length >= slotsNeeded) break
          
          // Vérifier si ce slot est disponible
          const occupiedMinutes = slotUsage.get(slot)
          if (occupiedMinutes) {
            let isAvailable = true
            for (let min = startMinutes; min < endMinutes; min += 15) {
              if (occupiedMinutes.has(min)) {
                isAvailable = false
                break
              }
            }
            
            // Vérifier aussi les conflits avec les rendez-vous déjà placés
            if (isAvailable) {
              for (const existing of compactedAppointments) {
                const existingStart = existing.hour * 60 + (existing.minute || 0)
                const existingDuration = existing.gameDurationMinutes || existing.durationMinutes || 60
                const existingEnd = existingStart + existingDuration
                const existingSlots = existing.assignedSlots || []
                
                const timeOverlap = existingStart < endMinutes && existingEnd > startMinutes
                if (timeOverlap && existingSlots.includes(slot)) {
                  isAvailable = false
                  break
                }
              }
            }
            
            if (isAvailable) {
              availableSlots.push(slot)
            }
          }
        }
        
        if (availableSlots.length >= slotsNeeded) {
          bestSlots = availableSlots.slice(0, slotsNeeded)
        }
      }
      
      // Si on a trouvé des slots, vérifier s'il y a des conflits avec les rendez-vous déjà placés
      if (bestSlots) {
        // RÈGLE TETRIS : Vérifier les conflits avec les slots qu'on va assigner
        const conflictingAppointments: { index: number; appointment: SimpleAppointment }[] = []
        
        for (let i = 0; i < compactedAppointments.length; i++) {
          const existing = compactedAppointments[i]
          const existingStart = existing.hour * 60 + (existing.minute || 0)
          const existingDuration = existing.gameDurationMinutes || existing.durationMinutes || 60
          const existingEnd = existingStart + existingDuration
          const existingSlots = existing.assignedSlots || []
          
          // Vérifier si les créneaux se chevauchent
          const timeOverlap = existingStart < endMinutes && existingEnd > startMinutes
          
          if (timeOverlap) {
            // Vérifier si les slots qu'on va assigner chevauchent avec les slots existants
            const slotOverlap = bestSlots.some(slot => existingSlots.includes(slot))
            if (slotOverlap) {
              conflictingAppointments.push({ index: i, appointment: existing })
            }
          }
        }
        
        // Si conflit détecté, déplacer les rendez-vous en conflit AVANT de placer le nouveau
        if (conflictingAppointments.length > 0) {
          // Libérer les slots des rendez-vous en conflit
          for (const conflict of conflictingAppointments) {
            const existingStart = conflict.appointment.hour * 60 + (conflict.appointment.minute || 0)
            const existingDuration = conflict.appointment.gameDurationMinutes || conflict.appointment.durationMinutes || 60
            const existingEnd = existingStart + existingDuration
            releaseSlots(conflict.appointment.assignedSlots || [], existingStart, existingEnd)
          }
          
          // Réassigner les rendez-vous en conflit vers d'autres slots
          for (const conflict of conflictingAppointments) {
            const existingStart = conflict.appointment.hour * 60 + (conflict.appointment.minute || 0)
            const existingDuration = conflict.appointment.gameDurationMinutes || conflict.appointment.durationMinutes || 60
            const existingEnd = existingStart + existingDuration
            const existingSlotsNeeded = conflict.appointment.assignedSlots?.length || calculateSlotsNeeded(conflict.appointment.participants)
            
            // Chercher de nouveaux slots pour ce rendez-vous (en évitant les slots qu'on va assigner)
            let newSlots: number[] | null = null
            
            // Essayer des slots consécutifs d'abord (de gauche à droite)
            for (let startSlot = 1; startSlot <= TOTAL_SLOTS - existingSlotsNeeded + 1; startSlot++) {
              const candidateSlots = Array.from({ length: existingSlotsNeeded }, (_, i) => startSlot + i)
              // Vérifier que ces slots ne sont pas dans les slots qu'on va assigner
              if (!candidateSlots.some(slot => bestSlots!.includes(slot)) && areSlotsAvailable(candidateSlots, existingStart, existingEnd, conflict.appointment.id)) {
                newSlots = candidateSlots
                break
              }
            }
            
            // Si pas de slots consécutifs, prendre les premiers disponibles (hors slots qu'on va assigner)
            if (!newSlots) {
              const availableSlots: number[] = []
              for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
                if (availableSlots.length >= existingSlotsNeeded) break
                // Ne pas prendre les slots qui sont dans les slots qu'on va assigner
                if (bestSlots.includes(slot)) continue
                
                const occupiedMinutes = slotUsage.get(slot)
                if (occupiedMinutes) {
                  let isAvailable = true
                  for (let min = existingStart; min < existingEnd; min += 15) {
                    if (occupiedMinutes.has(min)) {
                      isAvailable = false
                      break
                    }
                  }
                  
                  // Vérifier aussi les conflits avec les autres rendez-vous déjà placés
                  if (isAvailable) {
                    for (const other of compactedAppointments) {
                      if (other.id === conflict.appointment.id) continue
                      const otherStart = other.hour * 60 + (other.minute || 0)
                      const otherDuration = other.gameDurationMinutes || other.durationMinutes || 60
                      const otherEnd = otherStart + otherDuration
                      const otherSlots = other.assignedSlots || []
                      
                      const timeOverlap = otherStart < existingEnd && otherEnd > existingStart
                      if (timeOverlap && otherSlots.includes(slot)) {
                        isAvailable = false
                        break
                      }
                    }
                  }
                  
                  if (isAvailable) {
                    availableSlots.push(slot)
                  }
                }
              }
              
              if (availableSlots.length >= existingSlotsNeeded) {
                newSlots = availableSlots.slice(0, existingSlotsNeeded)
              }
            }
            
            // Mettre à jour les slots du rendez-vous en conflit
            if (newSlots) {
              reserveSlots(newSlots, existingStart, existingEnd)
              compactedAppointments[conflict.index] = {
                ...conflict.appointment,
                assignedSlots: newSlots.sort((a, b) => a - b)
              }
            } else {
              // Si pas de nouveaux slots, garder les originaux mais il y aura un conflit
              reserveSlots(conflict.appointment.assignedSlots || [], existingStart, existingEnd)
            }
          }
        }
        
        // Maintenant assigner les slots au rendez-vous actuel
        reserveSlots(bestSlots, startMinutes, endMinutes)
        compactedAppointments.push({
          ...appointment,
          assignedSlots: bestSlots.sort((a, b) => a - b)
        })
      } else {
        // Si pas de slots disponibles, garder les slots originaux (mais il y aura peut-être un conflit)
        reserveSlots(appointment.assignedSlots || [], startMinutes, endMinutes)
        compactedAppointments.push(appointment)
      }
    }

    return compactedAppointments
  }

  // Trouver les slots disponibles pour un créneau donné
  const findAvailableSlots = (
    date: string,
    startMinutes: number,
    durationMinutes: number,
    slotsNeeded: number,
    excludeAppointmentId?: string
  ): number[] | null => {
    const endMinutes = startMinutes + durationMinutes
    
    // Créer un tableau de disponibilité pour chaque slot sur chaque intervalle de 15 minutes
    // Structure : slotAvailability[slotNumber][minute] = true/false
    const slotAvailability: boolean[][] = []
    for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
      slotAvailability[slot] = []
      // Initialiser tous les créneaux de 15 min comme disponibles (10h à 22h)
      for (let min = 10 * 60; min < 23 * 60; min += 15) {
        slotAvailability[slot][min] = true
      }
    }

    // Marquer les slots occupés par les autres rendez-vous
    appointments.forEach(appointment => {
      // Exclure le rendez-vous en cours de modification (important pour la réallocation)
      if (appointment.id === excludeAppointmentId) return
      if (appointment.date !== date) return
      
      const appStartMinutes = appointment.hour * 60 + (appointment.minute || 0)
      // Pour les slots, utiliser la durée du jeu (gameDurationMinutes), pas la durée de l'événement
      const appGameDuration = appointment.gameDurationMinutes || appointment.durationMinutes || 60
      const appEndMinutes = appStartMinutes + appGameDuration
      const assignedSlots = appointment.assignedSlots || []
      
      // Si pas de slots assignés, ignorer
      if (assignedSlots.length === 0) return
      
      // Vérifier si ce rendez-vous chevauche le créneau demandé
      const overlaps = appStartMinutes < endMinutes && appEndMinutes > startMinutes
      if (!overlaps) return // Pas de chevauchement, on peut ignorer ce rendez-vous
      
      // Pour chaque slot assigné, marquer comme occupé sur toute la durée du chevauchement
      assignedSlots.forEach(slotIndex => {
        // S'assurer que le slot est valide
        if (slotIndex < 1 || slotIndex > TOTAL_SLOTS) return
        
        // Marquer comme occupé seulement sur la partie qui chevauche
        const overlapStart = Math.max(appStartMinutes, startMinutes)
        const overlapEnd = Math.min(appEndMinutes, endMinutes)
        // Marquer chaque créneau de 15 min comme occupé dans la zone de chevauchement
        for (let min = overlapStart; min < overlapEnd; min += 15) {
          // S'assurer que le slot existe et que le créneau est initialisé
          if (slotAvailability[slotIndex] && slotAvailability[slotIndex][min] !== undefined) {
            slotAvailability[slotIndex][min] = false
          }
        }
      })
    })

    // IMPORTANT : Trouver automatiquement les slots disponibles (gauche → droite)
    // Le slot cliqué par l'utilisateur n'est PAS utilisé pour l'assignation
    
    // ÉTAPE 1 : Essayer d'abord de trouver des slots consécutifs
    for (let startSlot = 1; startSlot <= TOTAL_SLOTS - slotsNeeded + 1; startSlot++) {
      const candidateSlots: number[] = []
      
      // Vérifier si ce groupe de slots consécutifs est disponible
      let allAvailable = true
      for (let i = 0; i < slotsNeeded; i++) {
        const slot = startSlot + i
        if (slot > TOTAL_SLOTS) {
          allAvailable = false
          break
        }
        
        // Vérifier que ce slot est disponible sur TOUTE la durée
        for (let min = startMinutes; min < endMinutes; min += 15) {
          if (!slotAvailability[slot] || slotAvailability[slot][min] === undefined || !slotAvailability[slot][min]) {
            allAvailable = false
            break
          }
        }
        
        if (!allAvailable) break
        candidateSlots.push(slot)
      }
      
      // Si tous les slots du groupe sont disponibles, on les retourne
      if (allAvailable && candidateSlots.length === slotsNeeded) {
        return candidateSlots.sort((a, b) => a - b)
      }
    }

    // ÉTAPE 2 : Si pas assez de slots consécutifs, prendre les slots disponibles non consécutifs
    // Priorité : gauche → droite (slots les plus petits d'abord)
    const availableSlots: number[] = []
    
    // Parcourir tous les slots de gauche à droite
    for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
      // Vérifier que ce slot est disponible sur TOUTE la durée
      let slotAvailable = true
      for (let min = startMinutes; min < endMinutes; min += 15) {
        if (!slotAvailability[slot] || slotAvailability[slot][min] === undefined || !slotAvailability[slot][min]) {
          slotAvailable = false
          break
        }
      }
      
      if (slotAvailable) {
        availableSlots.push(slot)
        // Si on a trouvé assez de slots, on s'arrête
        if (availableSlots.length >= slotsNeeded) {
          return availableSlots.slice(0, slotsNeeded).sort((a, b) => a - b)
        }
      }
    }

    // Pas assez de slots disponibles (même non consécutifs)
    return null
  }

  // Trouver une salle d'anniversaire disponible pour un créneau donné
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
      for (const appointment of appointments) {
        // Exclure le rendez-vous en cours de modification
        if (appointment.id === excludeAppointmentId) continue
        if (appointment.date !== date) continue
        if (appointment.eventType === 'game') continue // Les "game" ne bloquent pas les salles
        if (appointment.assignedRoom !== room) continue
        
        const appStartMinutes = appointment.hour * 60 + (appointment.minute || 0)
        const appDuration = appointment.durationMinutes || 60
        const appEndMinutes = appStartMinutes + appDuration
        
        // Vérifier le chevauchement
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
    setAppointmentTitle(appointment.title)
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

  // Fonction interne pour sauvegarder avec des slots spécifiques
  // DOIT être définie AVANT saveAppointment car elle est utilisée dans pendingSave
  const saveAppointmentWithSlots = (slotsToUse: number[]) => {
    if (!appointmentTitle.trim() || appointmentHour === null || !appointmentDate) {
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
      // Si une salle est déjà sélectionnée, vérifier qu'elle est disponible
      if (appointmentRoom !== null) {
        const roomAvailable = findAvailableRoom(
          dateStr,
          startMinutes,
          eventDurationMinutes,
          editingAppointment?.id
        )
        if (roomAvailable === appointmentRoom) {
          assignedRoom = appointmentRoom
        } else {
          alert(`La salle ${appointmentRoom} n'est pas disponible sur ce créneau.`)
          return
        }
      } else {
        // Trouver automatiquement une salle disponible
        const availableRoom = findAvailableRoom(
          dateStr,
          startMinutes,
          eventDurationMinutes,
          editingAppointment?.id
        )
        if (!availableRoom) {
          alert(`Aucune salle d'anniversaire disponible sur ce créneau.`)
          return
        }
        assignedRoom = availableRoom
      }
    }

    if (editingAppointment) {
      setAppointments(prev => {
        // Mettre à jour le rendez-vous modifié
        const updatedAppointment: SimpleAppointment = {
          ...editingAppointment,
          title: appointmentTitle.trim(),
          hour: appointmentHour,
          minute: appointmentMinute,
          date: dateStr,
          branch: appointmentBranch || undefined,
          eventType: appointmentEventType || undefined,
          // Pour les jeux standards, pas de durationMinutes (seulement gameDurationMinutes)
          durationMinutes: (appointmentEventType && appointmentEventType !== 'game') 
            ? (appointmentDuration ?? undefined) 
            : undefined,
          color: appointmentColor || '#3b82f6',
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
        
        // Mettre à jour tous les rendez-vous
        const updated = prev.map(a =>
          a.id === editingAppointment.id ? updatedAppointment : a
        )
        
        // Compacter les slots pour cette date
        // compactSlots déplacera automatiquement les blocs en conflit et réassignera les slots
        const compacted = compactSlots(dateStr, updated)
        const otherDates = updated.filter(a => a.date !== dateStr)
        
        // Fusionner les rendez-vous compactés avec les autres dates
        return [...otherDates, ...compacted]
      })
    } else {
      const newAppointment: SimpleAppointment = {
        id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: appointmentTitle.trim(),
        hour: appointmentHour,
        minute: appointmentMinute,
        date: dateStr,
        branch: appointmentBranch || undefined,
        eventType: appointmentEventType || undefined,
        // Pour les jeux standards, pas de durationMinutes (seulement gameDurationMinutes)
        durationMinutes: (appointmentEventType && appointmentEventType !== 'game') 
          ? (appointmentDuration ?? undefined) 
          : undefined,
        color: appointmentColor || '#3b82f6',
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
        // Ajouter le nouveau rendez-vous SANS slots assignés d'abord
        // compactSlots va les assigner automatiquement
        const newAppointmentWithoutSlots = {
          ...newAppointment,
          assignedSlots: undefined
        }
        const withNew = [...prev, newAppointmentWithoutSlots]
        
        // Compacter les slots pour cette date
        // compactSlots déplacera automatiquement les blocs en conflit et assignera les slots
        const compacted = compactSlots(dateStr, withNew)
        const otherDates = withNew.filter(a => a.date !== dateStr)
        
        // Fusionner les rendez-vous compactés avec les autres dates
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

  const saveAppointment = () => {
    if (!appointmentTitle.trim() || appointmentHour === null || !appointmentDate) {
      return
    }
    const dateStr = appointmentDate

    // Calculer le nombre de slots nécessaires
    // Si participants est null, considérer comme < 6 joueurs (1 slot)
    const slotsNeeded = calculateSlotsNeeded(appointmentParticipants ?? null)
    
    // Calculer les minutes de début
    const startMinutes = appointmentHour * 60 + appointmentMinute
    
    // IMPORTANT : Deux durées différentes
    // - gameDurationMinutes : durée du jeu (bloque les slots) - TOUJOURS présente
    // - durationMinutes : durée de l'événement (bloque la salle d'anniversaire) - UNIQUEMENT pour les événements
    const gameDurationMinutes = appointmentGameDuration ?? 60 // Durée du jeu pour les slots
    // Pour les jeux standards (type "game"), pas de durée d'événement, utiliser la durée du jeu
    const eventDurationMinutes = (appointmentEventType && appointmentEventType !== 'game') 
      ? (appointmentDuration ?? 120) // Durée de l'événement pour la salle (événements)
      : gameDurationMinutes // Pour les jeux, utiliser la durée du jeu

    // D'ABORD : Compter les slots vraiment disponibles (sans conflit)
    let availableCount = 0
    for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
      let isAvailable = true
      for (let min = startMinutes; min < startMinutes + gameDurationMinutes; min += 15) {
        const isOccupied = appointments.some(a => {
          if (a.id === editingAppointment?.id) return false
          if (a.date !== dateStr) return false
          const assignedSlots = a.assignedSlots || []
          if (!assignedSlots.includes(slot)) return false
          const aStart = a.hour * 60 + (a.minute || 0)
          const aGameDuration = a.gameDurationMinutes || 60
          const aEnd = aStart + aGameDuration
          return aStart < min + 15 && aEnd > min
        })
        if (isOccupied) {
          isAvailable = false
          break
        }
      }
      if (isAvailable) availableCount++
    }

    // Si pas assez de slots disponibles, il y a un conflit - demander confirmation
    if (availableCount < slotsNeeded) {
      const maxParticipants = availableCount * 6
      
      // Si aucun slot disponible, refuser
      if (availableCount === 0) {
        alert(`Impossible de créer ce rendez-vous. Aucun slot disponible sur ce créneau.`)
        return
      }
      
      // Demander autorisation pour chevauchement (le système déplacera les autres blocs si possible)
      setOverlapInfo({
        slotsNeeded,
        availableSlots: availableCount,
        maxParticipants
      })
      
      // Stocker la fonction de sauvegarde pour l'appeler après confirmation
      // IMPORTANT : Utiliser les valeurs capturées dans le closure
      const capturedDateStr = dateStr
      const capturedStartMinutes = startMinutes
      const capturedGameDurationMinutes = gameDurationMinutes
      const capturedSlotsNeeded = slotsNeeded
      const capturedAvailableCount = availableCount
      const capturedEditingId = editingAppointment?.id
      
      setPendingSave(() => () => {
        // Ne pas assigner de slots maintenant - laisser compactSlots les assigner automatiquement
        // Cela garantit que compactSlots peut déplacer les autres rendez-vous correctement
        saveAppointmentWithSlots([])
      })
      
      setShowOverlapConfirm(true)
      return
    }
    
    // Si on a assez de slots disponibles, trouver les meilleurs slots et continuer
    const availableSlots = findAvailableSlots(
      dateStr,
      startMinutes,
      gameDurationMinutes,
      slotsNeeded,
      editingAppointment?.id
    )
    
    // VÉRIFICATION CRITIQUE : Si findAvailableSlots ne trouve pas exactement slotsNeeded slots,
    // ou si availableCount < slotsNeeded, il y a un chevauchement potentiel
    if (!availableSlots || availableSlots.length < slotsNeeded || availableCount < slotsNeeded) {
      // Il y a un chevauchement - demander confirmation
      const maxParticipants = availableCount * 6
      
      // Si aucun slot disponible, refuser
      if (availableCount === 0) {
        alert(`Impossible de créer ce rendez-vous. Aucun slot disponible sur ce créneau.`)
        return
      }
      
      // Demander autorisation pour chevauchement (le système déplacera les autres blocs si possible)
      setOverlapInfo({
        slotsNeeded,
        availableSlots: availableCount,
        maxParticipants
      })
      
      // Stocker la fonction de sauvegarde pour l'appeler après confirmation
      setPendingSave(() => () => {
        // Ne pas assigner de slots maintenant - laisser compactSlots les assigner automatiquement
        saveAppointmentWithSlots([])
      })
      
      setShowOverlapConfirm(true)
      return
    }
    
    // Si on arrive ici, on a exactement slotsNeeded slots disponibles sans chevauchement
    saveAppointmentWithSlots(availableSlots)
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
                      className={`w-full px-2 border-b ${borderColor} text-center flex items-center justify-center`}
                      style={{ height: `${rowHeight / 2}px`, minHeight: `${rowHeight / 2}px` }}
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
                    gridTemplateColumns: `repeat(${TOTAL_COLUMNS}, 1fr)`,
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

                  {/* Colonnes salles d'anniversaire */}
                  {Array.from({ length: TOTAL_ROOMS }, (_, roomIndex) => {
                    const roomNumber = roomIndex + 1
                    return (
                      <div
                        key={`header-room-${roomNumber}`}
                        className={`${bgHeader} border-r ${borderColor} border-b ${borderColor} text-center flex items-center justify-center`}
                      >
                        <div className={`text-xs font-bold ${textPrimary}`}>Room {roomNumber}</div>
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
                  const appointmentsStartingHere = appointments.filter((a, index, self) => {
                    if (a.date !== dateStr) return false
                    const assignedSlots = a.assignedSlots || []
                    if (assignedSlots.length === 0) return false

                    const aStart = a.hour * 60 + (a.minute || 0)
                    if (aStart !== timeStartMinutes) return false

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
                        gridTemplateColumns: `repeat(${TOTAL_COLUMNS}, 1fr)`,
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
                        const appointmentStartMinutes = appointment.hour * 60 + (appointment.minute || 0)
                        // Pour les slots, utiliser la durée du jeu (gameDurationMinutes), pas la durée de l'événement
                        const gameDuration = appointment.gameDurationMinutes || appointment.durationMinutes || 60
                        const appointmentEndMinutes = appointmentStartMinutes + gameDuration
                        const assignedSlots = appointment.assignedSlots || []
                        
                        if (assignedSlots.length === 0) return null
                        
                        // Calculer combien de lignes de 15 min ce rendez-vous occupe
                        const durationIn15MinSlots = (appointmentEndMinutes - appointmentStartMinutes) / 15
                        
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
                        const startCol = minSlot - 1 // 0-indexed (slot 1 = colonne 0)
                        
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
                              left: `${(startCol / TOTAL_COLUMNS) * 100}%`,
                              width: `${(widthCols / TOTAL_COLUMNS) * 100}%`,
                              top: 0,
                              height: `${durationIn15MinSlots * (rowHeight / 2)}px`,
                              backgroundColor: getFullColor(appointment.color),
                              border: `1px solid ${getDarkerColor(appointment.color)}`,
                              color: '#fff',
                              zIndex: 10,
                              boxSizing: 'border-box',
                            }}
                            title={appointment.title}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate font-medium text-white">{appointment.title}</span>
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
                        
                        // Position dans les colonnes de salles (après les slots)
                        const roomCol = TOTAL_SLOTS + (assignedRoom - 1) // Colonne après les slots
                        
                        return (
                          <div
                            key={`room-${appointment.id}`}
                            data-appointment-card
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditAppointmentModal(appointment)
                            }}
                            className="rounded text-xs font-medium hover:opacity-90 transition-all overflow-hidden flex flex-col justify-center px-2 absolute"
                            style={{
                              left: `${(roomCol / TOTAL_COLUMNS) * 100}%`,
                              width: `${(1 / TOTAL_COLUMNS) * 100}%`,
                              top: 0,
                              height: `${durationIn15MinSlots * (rowHeight / 2)}px`,
                              backgroundColor: getFullColor(appointment.color),
                              border: `1px solid ${getDarkerColor(appointment.color)}`,
                              color: '#fff',
                              zIndex: 10,
                              boxSizing: 'border-box',
                            }}
                            title={appointment.title}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate font-medium text-white">{appointment.title}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>

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
                            <label className={`block text-sm mb-1 ${textSecondary}`}>Titre / Nom de l'événement</label>
                            <input
                              type="text"
                              value={appointmentTitle}
                              onChange={(e) => setAppointmentTitle(e.target.value)}
                              className={`w-full px-3 py-2 rounded border ${borderColor} ${inputBg} ${textMain} text-sm focus:outline-none focus:border-primary`}
                              placeholder="Anniversaire Emma, Équipe marketing, etc."
                            />
                          </div>

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
                          disabled={!appointmentTitle.trim() || appointmentHour === null || !appointmentDate}
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
                            Pas assez de slots disponibles
                          </h3>
                          
                          <p className={`${textSecondary} mb-4`}>
                            Ce rendez-vous nécessite <strong>{overlapInfo.slotsNeeded} slot(s)</strong>, mais seulement <strong>{overlapInfo.availableSlots} slot(s)</strong> sont disponibles.
                          </p>
                          
                          <p className={`${textSecondary} mb-6`}>
                            Maximum possible : <strong>{overlapInfo.maxParticipants} participants</strong> ({overlapInfo.availableSlots} slot(s) × 6 personnes).
                          </p>
                          
                          <p className={`${textSecondary} mb-6 text-sm`}>
                            Si vous acceptez, le système déplacera automatiquement les autres rendez-vous pour libérer les slots nécessaires.
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
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
