'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Users, Clock, User, Phone, Mail, MessageSquare, Gamepad2, PartyPopper, Palette, Home, Calendar, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import type { CreateBookingData, BookingWithSlots } from '@/hooks/useBookings'

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateBookingData) => Promise<boolean>
  onDelete?: (id: string) => Promise<boolean>
  branchId: string
  selectedDate: Date
  initialHour?: number
  initialMinute?: number
  editingBooking?: BookingWithSlots | null
  isDark: boolean
  findBestAvailableRoom?: (participants: number, startDateTime: Date, endDateTime: Date) => string | null
}

type BookingType = 'GAME' | 'EVENT'

// Configuration des slots
const SLOT_DURATION = 15 // minutes
const MAX_PLAYERS_PER_SLOT = 6
const TOTAL_SLOTS = 14
const TOTAL_CAPACITY = TOTAL_SLOTS * MAX_PLAYERS_PER_SLOT // 84 joueurs max

// Horaires d'ouverture
const OPENING_HOUR = 10
const CLOSING_HOUR = 23

// Couleurs disponibles
const COLORS = [
  { name: 'Bleu', value: '#3B82F6' },
  { name: 'Vert', value: '#22C55E' },
  { name: 'Rouge', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Violet', value: '#A855F7' },
  { name: 'Rose', value: '#EC4899' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Jaune', value: '#EAB308' },
]

export function BookingModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  branchId,
  selectedDate,
  initialHour = 10,
  initialMinute = 0,
  editingBooking = null,
  isDark,
  findBestAvailableRoom
}: BookingModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Date locale (modifiable)
  const [localDate, setLocalDate] = useState(selectedDate)
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(selectedDate.getMonth())
  const [calendarYear, setCalendarYear] = useState(selectedDate.getFullYear())

  // Formulaire
  const [bookingType, setBookingType] = useState<BookingType>('GAME')
  const [hour, setHour] = useState(initialHour)
  const [minute, setMinute] = useState(initialMinute)
  const [durationMinutes, setDurationMinutes] = useState('60') // Durée en minutes (champ libre)
  const [participants, setParticipants] = useState('1')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [contactId, setContactId] = useState('') // ID unique du contact (auto-généré)
  const [color, setColor] = useState(COLORS[0].value) // Couleur par défaut bleu

  // Pour les événements avec salle (automatique pour EVENT)
  const [roomStartHour, setRoomStartHour] = useState(initialHour)
  const [roomStartMinute, setRoomStartMinute] = useState(initialMinute)
  const [roomDurationMinutes, setRoomDurationMinutes] = useState('120') // Durée salle par défaut 2 heures, modifiable
  const [eventAlias, setEventAlias] = useState('') // Alias : nom de la personne qui fête l'événement
  const [eventNotes, setEventNotes] = useState('') // Notes spécifiques à l'événement/salle
  const [sessionId, setSessionId] = useState('') // ID unique de la session (jeu ou événement, auto-généré)

  // Fonction pour générer un ID unique de contact (numéro séquentiel simple)
  const generateContactId = (): string => {
    // Utiliser localStorage pour stocker le dernier ID utilisé
    const storageKey = `lastContactId_${branchId}`
    const lastId = localStorage.getItem(storageKey)
    const nextId = lastId ? parseInt(lastId, 10) + 1 : 1
    localStorage.setItem(storageKey, nextId.toString())
    return nextId.toString()
  }

  // Fonction pour générer un ID unique de session (numéro séquentiel simple)
  const generateSessionId = (): string => {
    // Utiliser localStorage pour stocker le dernier ID utilisé
    const storageKey = `lastSessionId_${branchId}`
    const lastId = localStorage.getItem(storageKey)
    const nextId = lastId ? parseInt(lastId, 10) + 1 : 1
    localStorage.setItem(storageKey, nextId.toString())
    return nextId.toString()
  }

  // Fonction utilitaire pour formater une date en YYYY-MM-DD (sans conversion UTC)
  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Fonction utilitaire pour extraire la date locale d'une date ISO
  const extractLocalDateFromISO = (isoString: string): Date => {
    const date = new Date(isoString)
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }

  // Reset le formulaire quand on ouvre/ferme ou charge une réservation à éditer
  useEffect(() => {
    if (isOpen) {
      if (editingBooking) {
        // Mode édition : pré-remplir avec les données de la réservation
        const bookingStartDate = extractLocalDateFromISO(editingBooking.game_start_datetime || editingBooking.start_datetime)
        const bookingStartTime = new Date(editingBooking.game_start_datetime || editingBooking.start_datetime)
        
        setLocalDate(bookingStartDate)
        setCalendarMonth(bookingStartDate.getMonth())
        setCalendarYear(bookingStartDate.getFullYear())
        setHour(bookingStartTime.getHours())
        setMinute(bookingStartTime.getMinutes())
        setParticipants(String(editingBooking.participants_count))
        setBookingType(editingBooking.type)
        
        // Extraire les notes et l'alias depuis les notes
        const notes = editingBooking.notes || ''
        const contactIdMatch = notes.match(/Contact ID: (\d+)/)
        if (contactIdMatch) {
          setContactId(contactIdMatch[1])
        } else {
          setContactId(generateContactId())
        }
        
        // Extraire l'alias (pour les événements)
        if (editingBooking.type === 'EVENT') {
          const aliasMatch = notes.match(/Alias: ([^\n]+)/)
          if (aliasMatch) {
            setEventAlias(aliasMatch[1].trim())
          }
          // Extraire les notes de l'événement (après Alias)
          const eventNotesMatch = notes.match(/Alias: [^\n]+\n(.*?)(?:\n(?:Contact ID|Session ID):|$)/s)
          if (eventNotesMatch) {
            setEventNotes(eventNotesMatch[1].trim())
          }
          
          // Calculer la durée de la salle
          if (editingBooking.start_datetime && editingBooking.end_datetime) {
            const roomStart = new Date(editingBooking.start_datetime)
            const roomEnd = new Date(editingBooking.end_datetime)
            const roomDurationMs = roomEnd.getTime() - roomStart.getTime()
            const roomDurationMinutes = Math.round(roomDurationMs / (1000 * 60))
            setRoomDurationMinutes(String(roomDurationMinutes))
            
            setRoomStartHour(roomStart.getHours())
            setRoomStartMinute(roomStart.getMinutes())
          }
          
          // Calculer la durée du jeu
          if (editingBooking.game_start_datetime && editingBooking.game_end_datetime) {
            const gameStart = new Date(editingBooking.game_start_datetime)
            const gameEnd = new Date(editingBooking.game_end_datetime)
            const gameDurationMs = gameEnd.getTime() - gameStart.getTime()
            const gameDurationMinutes = Math.round(gameDurationMs / (1000 * 60))
            setDurationMinutes(String(gameDurationMinutes))
          }
        } else {
          // Pour les jeux, calculer la durée
          if (editingBooking.game_start_datetime && editingBooking.game_end_datetime) {
            const gameStart = new Date(editingBooking.game_start_datetime)
            const gameEnd = new Date(editingBooking.game_end_datetime)
            const gameDurationMs = gameEnd.getTime() - gameStart.getTime()
            const gameDurationMinutes = Math.round(gameDurationMs / (1000 * 60))
            setDurationMinutes(String(gameDurationMinutes))
          }
          
          // Extraire les notes de contact (pour les jeux)
          const contactNotesMatch = notes.match(/(?:Session ID: \d+\n)?Contact ID: \d+\n(.*?)$/s)
          if (contactNotesMatch) {
            setNotes(contactNotesMatch[1].trim())
          }
        }
        
        // Informations client
        setFirstName(editingBooking.customer_first_name || '')
        setLastName(editingBooking.customer_last_name || '')
        setPhone(editingBooking.customer_phone || '')
        setEmail(editingBooking.customer_email || '')
        
        // Couleur : utiliser celle de la base de données si disponible, sinon couleur par défaut selon le type
        setColor(editingBooking.color || (editingBooking.type === 'GAME' ? COLORS[0].value : COLORS[1].value))
      } else {
        // Mode création : réinitialiser le formulaire
        setLocalDate(selectedDate)
        setCalendarMonth(selectedDate.getMonth())
        setCalendarYear(selectedDate.getFullYear())
        setHour(initialHour)
        setMinute(initialMinute)
        setRoomStartHour(initialHour)
        setRoomStartMinute(initialMinute)
        setParticipants('1')
        setEventAlias('')
        setEventNotes('')
        setNotes('')
        setContactId(generateContactId())
        setSessionId(generateSessionId())
        setDurationMinutes('60')
        setRoomDurationMinutes('120')
        setFirstName('')
        setLastName('')
        setPhone('')
        setEmail('')
        setError(null)
        // Couleur par défaut selon le type
        setColor(bookingType === 'GAME' ? COLORS[0].value : COLORS[1].value)
      }
    }
  }, [isOpen, selectedDate, initialHour, initialMinute, bookingType, editingBooking])

  // Générer le Session ID si nécessaire
  useEffect(() => {
    if (!sessionId && !editingBooking) {
      setSessionId(generateSessionId())
    }
  }, [sessionId, editingBooking])

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

  const handleCalendarDateClick = (date: Date) => {
    setLocalDate(date)
    setCalendarMonth(date.getMonth())
    setCalendarYear(date.getFullYear())
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

  // Changer la couleur par défaut quand on change de type
  useEffect(() => {
    setColor(bookingType === 'GAME' ? COLORS[0].value : COLORS[1].value)
  }, [bookingType])

  // Générer les options d'heures
  const hourOptions = []
  for (let h = OPENING_HOUR; h < CLOSING_HOUR; h++) {
    hourOptions.push(h)
  }

  // Parser les valeurs
  const parsedParticipants = parseInt(participants) || 0
  const parsedDuration = parseInt(durationMinutes) || 60
  const parsedRoomDuration = parseInt(roomDurationMinutes) || 120 // Durée salle modifiable, par défaut 2 heures

  // Calculer les slots nécessaires (logique Tetris)
  const calculateSlots = () => {
    const slotsNeeded = Math.ceil(parsedParticipants / MAX_PLAYERS_PER_SLOT)
    return Math.min(slotsNeeded, TOTAL_SLOTS)
  }


  // Calculer l'heure de fin du jeu
  const calculateGameEndTime = () => {
    const startMinutes = hour * 60 + minute
    const endMinutes = startMinutes + parsedDuration
    return {
      endHour: Math.floor(endMinutes / 60),
      endMinute: endMinutes % 60
    }
  }

  // Calculer l'heure de fin de la salle
  const calculateRoomEndTime = () => {
    const startMinutes = roomStartHour * 60 + roomStartMinute
    const endMinutes = startMinutes + parsedRoomDuration
    return {
      endHour: Math.floor(endMinutes / 60),
      endMinute: endMinutes % 60
    }
  }

  // Vérifier si la capacité est dépassée
  const isOverCapacity = parsedParticipants > TOTAL_CAPACITY

  // Soumettre le formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validations
    if (!firstName.trim()) {
      setError('Le prénom est requis')
      return
    }
    
    if (!phone.trim()) {
      setError('Le numéro de téléphone est requis')
      return
    }
    if (!phone.trim()) {
      setError('Le numéro de téléphone est requis')
      return
    }
    if (parsedParticipants < 1) {
      setError('Le nombre de participants doit être au moins 1')
      return
    }
    if (isOverCapacity) {
      setError(`Capacité maximale dépassée (${TOTAL_CAPACITY} joueurs max)`)
      return
    }
    if (parsedDuration < 15) {
      setError('La durée minimum est de 15 minutes')
      return
    }

    setLoading(true)

    try {
      // Construire les dates du jeu (format simple)
      const gameStartDate = new Date(localDate)
      gameStartDate.setHours(hour, minute, 0, 0)

      const { endHour: gameEndHour, endMinute: gameEndMinute } = calculateGameEndTime()
      const gameEndDate = new Date(localDate)
      gameEndDate.setHours(gameEndHour, gameEndMinute, 0, 0)

      // Dates globales (jeu par défaut, ou salle si elle est plus large)
      let startDate = gameStartDate
      let endDate = gameEndDate

      // Si événement, calculer les dates de la salle (automatique pour EVENT)
      let eventRoomId: string | null | undefined = editingBooking?.event_room_id || null
      
      if (bookingType === 'EVENT') {
        const roomStartDate = new Date(localDate)
        roomStartDate.setHours(roomStartHour, roomStartMinute, 0, 0)

        const { endHour: roomEndHour, endMinute: roomEndMinute } = calculateRoomEndTime()
        const roomEndDate = new Date(localDate)
        roomEndDate.setHours(roomEndHour, roomEndMinute, 0, 0)

        // Prendre les dates les plus larges
        if (roomStartDate < gameStartDate) startDate = roomStartDate
        if (roomEndDate > gameEndDate) endDate = roomEndDate

        // Assigner automatiquement la meilleure salle disponible
        if (findBestAvailableRoom && !editingBooking) {
          eventRoomId = findBestAvailableRoom(parsedParticipants, roomStartDate, roomEndDate)
          if (!eventRoomId) {
            setError('Aucune salle disponible pour cette période avec cette capacité.')
            setLoading(false)
            return
          }
        }
      }

      // Construire les slots (version simple - un seul slot continu)
      // Utiliser directement les heures saisies par l'utilisateur
      const slotStart = new Date(localDate)
      slotStart.setHours(hour, minute, 0, 0)
      
      const slotEnd = new Date(localDate)
      slotEnd.setHours(hour, minute, parsedDuration, 0)
      
      const slots: CreateBookingData['slots'] = [{
        slot_start: slotStart.toISOString(),
        slot_end: slotEnd.toISOString(),
        participants_count: parsedParticipants
      }]

      const bookingData: CreateBookingData = {
        branch_id: branchId,
        type: bookingType,
        start_datetime: startDate.toISOString(),
        end_datetime: endDate.toISOString(),
        game_start_datetime: gameStartDate.toISOString(),
        game_end_datetime: gameEndDate.toISOString(),
        participants_count: parsedParticipants,
        event_room_id: bookingType === 'EVENT' ? eventRoomId : undefined,
        customer_first_name: firstName.trim(),
        customer_last_name: lastName.trim() || '', // Nom optionnel, chaîne vide si non renseigné
        customer_phone: phone.trim(),
        customer_email: email.trim() || undefined,
        notes: bookingType === 'EVENT' 
          ? (eventAlias.trim() || eventNotes.trim() || contactId || sessionId
              ? `Session ID: ${sessionId}\nContact ID: ${contactId}\nAlias: ${eventAlias.trim() || 'N/A'}\n${eventNotes.trim()}`.trim() 
              : `Session ID: ${sessionId}\nContact ID: ${contactId}`)
          : (notes.trim() || contactId || sessionId
              ? `Session ID: ${sessionId}\nContact ID: ${contactId}\n${notes.trim()}`.trim()
              : `Session ID: ${sessionId}\nContact ID: ${contactId}`),
        // color: color, // Désactivé temporairement jusqu'à ce que la colonne soit ajoutée dans la base de données
        slots
      }

      console.log('Submitting booking:', bookingData)
      const success = await onSubmit(bookingData)

      if (success) {
        // Reset et fermer
        setFirstName('')
        setLastName('')
        setPhone('')
        setEmail('')
        setNotes('')
        setEventNotes('')
        setParticipants('1')
        setDurationMinutes('60')
        onClose()
      } else {
        setError('Erreur lors de la création de la réservation')
      }
    } catch (err) {
      console.error('Error creating booking:', err)
      setError('Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    if (!editingBooking || !onDelete) return

    setLoading(true)
    try {
      const success = await onDelete(editingBooking.id)
      if (success) {
        setShowDeleteConfirm(false)
        onClose()
      } else {
        setError('Erreur lors de la suppression de la réservation')
        setShowDeleteConfirm(false)
      }
    } catch (err) {
      console.error('Error deleting booking:', err)
      setError('Erreur lors de la suppression de la réservation')
      setShowDeleteConfirm(false)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const slotsNeeded = calculateSlots()
  const { endHour: gameEndHour, endMinute: gameEndMinute } = calculateGameEndTime()
  const { endHour: roomEndHour, endMinute: roomEndMinute } = calculateRoomEndTime()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-3xl mx-4 rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {editingBooking ? 'Modifier la réservation' : 'Nouvelle réservation'}
            </h2>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCalendarModal(!showCalendarModal)}
                className={`mt-1 text-sm font-medium ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} flex items-center gap-1 cursor-pointer transition-colors`}
              >
                <Calendar className="w-4 h-4" />
                {localDate.toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
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
                        type="button"
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
                        type="button"
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
                        type="button"
                        onClick={handleNextMonth}
                        className={`p-1 ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} rounded hover:opacity-80 transition-all`}
                        title="Mois suivant"
                      >
                        <ChevronRight className={`w-4 h-4 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                      </button>
                      <button
                        type="button"
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
                      {getCalendarDays().map((date, i) => {
                        if (!date) {
                          return <div key={`empty-${i}`} className="p-2"></div>
                        }
                        const isToday = date.toDateString() === new Date().toDateString()
                        const isSelected = date.toDateString() === localDate.toDateString()
                        
                        return (
                          <button
                            key={i}
                            type="button"
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
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Session ID */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Session ID
            </label>
            <div className={`px-3 py-2 rounded-lg border text-sm font-mono ${
              isDark
                ? 'bg-gray-700/50 border-gray-600 text-gray-300'
                : 'bg-gray-100 border-gray-300 text-gray-700'
            }`}>
              {sessionId || 'Génération...'}
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Numéro unique généré automatiquement
            </p>
          </div>

          {/* Type de réservation + Couleur */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Type de réservation
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBookingType('GAME')}
                  className={`p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    bookingType === 'GAME'
                      ? 'border-blue-500 bg-blue-500/10'
                      : isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Gamepad2 className={`w-6 h-6 ${bookingType === 'GAME' ? 'text-blue-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  <span className={`font-medium ${bookingType === 'GAME' ? 'text-blue-500' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Game
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setBookingType('EVENT')}
                  className={`p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    bookingType === 'EVENT'
                      ? 'border-green-500 bg-green-500/10'
                      : isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <PartyPopper className={`w-6 h-6 ${bookingType === 'EVENT' ? 'text-green-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  <span className={`font-medium ${bookingType === 'EVENT' ? 'text-green-500' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Event
                  </span>
                </button>
              </div>
            </div>

            {/* Couleur - Désactivée temporairement jusqu'à ce que la colonne soit ajoutée dans la base de données */}
            {/* <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <Palette className="w-4 h-4 inline mr-1" />
                Couleur
              </label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      color === c.value ? 'ring-2 ring-offset-2 ring-white scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div> */}
          </div>

          {/* Temps de jeu */}
          <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-3">
              <Gamepad2 className="w-5 h-5 text-blue-400" />
              <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Temps de jeu</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Début
                </label>
                <div className="flex gap-1">
                  <select
                    value={hour}
                    onChange={(e) => setHour(parseInt(e.target.value))}
                    className={`admin-time-select flex-1 px-2 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-400 ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white focus:bg-gray-700 hover:bg-gray-700'
                        : 'bg-white border-gray-300 text-gray-900 focus:bg-white hover:bg-white'
                    }`}
                  >
                    {hourOptions.map(h => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}h</option>
                    ))}
                  </select>
                  <select
                    value={minute}
                    onChange={(e) => setMinute(parseInt(e.target.value))}
                    className={`admin-time-select flex-1 px-2 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-400 ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white focus:bg-gray-700 hover:bg-gray-700'
                        : 'bg-white border-gray-300 text-gray-900 focus:bg-white hover:bg-white'
                    }`}
                  >
                    {[0, 15, 30, 45].map(m => (
                      <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Durée (min)
                </label>
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className={`w-full px-2 py-2 rounded-lg border text-sm ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="60"
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Fin
                </label>
                <div className={`px-2 py-2 rounded-lg border text-sm ${
                  isDark ? 'bg-gray-700/50 border-gray-600 text-gray-400' : 'bg-gray-100 border-gray-300 text-gray-600'
                }`}>
                  {String(gameEndHour).padStart(2, '0')}:{String(gameEndMinute).padStart(2, '0')}
                </div>
              </div>
              <div>
                <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Participants
                </label>
                <input
                  type="number"
                  min="1"
                  max={TOTAL_CAPACITY}
                  value={participants}
                  onChange={(e) => setParticipants(e.target.value)}
                  className={`w-full px-2 py-2 rounded-lg border text-sm ${
                    isOverCapacity
                      ? 'border-red-500 bg-red-500/10'
                      : isDark
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="1"
                />
              </div>
            </div>
            {/* Info slots Tetris */}
            {parsedParticipants > 0 && (
              <div className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <span className="text-blue-400">{slotsNeeded} slot{slotsNeeded > 1 ? 's' : ''}</span>
                {' '}seront réservés ({slotsNeeded * MAX_PLAYERS_PER_SLOT} places max)
                {isOverCapacity && <span className="text-red-400 ml-2">Capacité max: {TOTAL_CAPACITY}</span>}
              </div>
            )}
          </div>

          {/* Salle (automatique pour les événements, 2 heures) */}
          {bookingType === 'EVENT' && (
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Home className="w-5 h-5 text-green-400" />
                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Salle d'événement</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Début salle
                  </label>
                  <div className="flex gap-1">
                    <select
                      value={roomStartHour}
                      onChange={(e) => setRoomStartHour(parseInt(e.target.value))}
                      className={`admin-time-select flex-1 px-2 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-400 ${
                        isDark
                          ? 'bg-gray-700 border-gray-600 text-white focus:bg-gray-700 hover:bg-gray-700'
                          : 'bg-white border-gray-300 text-gray-900 focus:bg-white hover:bg-white'
                      }`}
                    >
                      {hourOptions.map(h => (
                        <option key={h} value={h}>{String(h).padStart(2, '0')}h</option>
                      ))}
                    </select>
                    <select
                      value={roomStartMinute}
                      onChange={(e) => setRoomStartMinute(parseInt(e.target.value))}
                      className={`admin-time-select flex-1 px-2 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-400 ${
                        isDark
                          ? 'bg-gray-700 border-gray-600 text-white focus:bg-gray-700 hover:bg-gray-700'
                          : 'bg-white border-gray-300 text-gray-900 focus:bg-white hover:bg-white'
                      }`}
                    >
                      {[0, 15, 30, 45].map(m => (
                        <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Durée (min)
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={roomDurationMinutes}
                    onChange={(e) => setRoomDurationMinutes(e.target.value)}
                    className={`w-full px-2 py-2 rounded-lg border text-sm ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="120"
                  />
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Fin salle
                  </label>
                  <div className={`px-2 py-2 rounded-lg border text-sm ${
                    isDark ? 'bg-gray-700/50 border-gray-600 text-gray-400' : 'bg-gray-100 border-gray-300 text-gray-600'
                  }`}>
                    {String(roomEndHour).padStart(2, '0')}:{String(roomEndMinute).padStart(2, '0')}
                  </div>
                </div>
              </div>
              
              {/* Alias et Notes de l'événement */}
              <div className="mt-3 grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <User className="w-3 h-3 inline mr-1" />
                    Alias
                  </label>
                  <input
                    type="text"
                    value={eventAlias}
                    onChange={(e) => setEventAlias(e.target.value)}
                    className={`w-full px-2 py-2 rounded-lg border text-sm ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                    placeholder="Ex: Marie, Lucas"
                  />
                </div>
                <div className="col-span-3">
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <MessageSquare className="w-3 h-3 inline mr-1" />
                    Notes de l'événement
                  </label>
                  <textarea
                    value={eventNotes}
                    onChange={(e) => {
                      setEventNotes(e.target.value)
                      // Auto-resize jusqu'à 5 lignes max
                      const textarea = e.target as HTMLTextAreaElement
                      textarea.style.height = 'auto'
                      const maxHeight = 5 * 24 // 5 lignes environ (24px par ligne)
                      const newHeight = Math.min(textarea.scrollHeight, maxHeight)
                      textarea.style.height = `${newHeight}px`
                    }}
                    rows={2}
                    className={`w-full px-3 py-2 rounded-lg border resize-none text-sm overflow-y-auto ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                    placeholder="Notes concernant l'événement et la salle..."
                    style={{ minHeight: '48px', maxHeight: '120px' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Infos client */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <User className="w-4 h-4 inline mr-1" />
                Prénom *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
                placeholder="Prénom"
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Nom
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
                placeholder="Nom (optionnel)"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <Phone className="w-4 h-4 inline mr-1" />
                Téléphone *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
                placeholder="05X XXX XXXX"
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <Mail className="w-4 h-4 inline mr-1" />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
                placeholder="email@exemple.com"
              />
            </div>
          </div>

          {/* Contact ID */}
          <div className="mt-4">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Contact ID
            </label>
            <div className={`px-3 py-2 rounded-lg border text-sm font-mono ${
              isDark
                ? 'bg-gray-700/50 border-gray-600 text-gray-300'
                : 'bg-gray-100 border-gray-300 text-gray-700'
            }`}>
              {contactId || 'Génération...'}
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Numéro unique généré automatiquement
            </p>
          </div>

          {/* Notes */}
          <div className="mt-4">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value)
                // Auto-resize jusqu'à 5 lignes max
                const textarea = e.target as HTMLTextAreaElement
                textarea.style.height = 'auto'
                const maxHeight = 5 * 24 // 5 lignes environ (24px par ligne)
                const newHeight = Math.min(textarea.scrollHeight, maxHeight)
                textarea.style.height = `${newHeight}px`
              }}
              rows={2}
              className={`w-full px-3 py-2 rounded-lg border resize-none text-sm overflow-y-auto ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
              placeholder="Notes additionnelles..."
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>

          {/* Erreur */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className={`flex items-center justify-between gap-3 p-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            {editingBooking && onDelete && (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={loading}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                  isDark
                    ? 'text-red-400 hover:bg-red-900/20 hover:text-red-300'
                    : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`px-4 py-2 rounded-lg ${
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              Annuler
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading || isOverCapacity || parsedParticipants < 1}
              className="px-6 py-2 rounded-lg text-white flex items-center gap-2 disabled:opacity-50 bg-blue-600 hover:bg-blue-700"
              // style={{ backgroundColor: color }} // Désactivé temporairement - utilise la couleur par défaut
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {editingBooking ? 'Modification...' : 'Création...'}
                </>
              ) : (
                editingBooking ? 'Modifier' : 'Créer la réservation'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmation de suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />

          {/* Modal de confirmation */}
          <div className={`relative w-full max-w-md mx-4 rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="p-6">
              <h3 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Confirmer la suppression
              </h3>
              <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Êtes-vous sûr de vouloir supprimer définitivement cette réservation ? Cette action est irréversible.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg ${
                    isDark
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  } disabled:opacity-50`}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Suppression...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Supprimer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
