'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Loader2, Users, Clock, User, Phone, Mail, MessageSquare, Gamepad2, PartyPopper, Palette, Home, Calendar, ChevronLeft, ChevronRight, Trash2, Edit2, RefreshCw, AlertTriangle } from 'lucide-react'
import type { CreateBookingData, BookingWithSlots } from '@/hooks/useBookings'
import { ContactFieldAutocomplete } from './ContactFieldAutocomplete'
import { useContacts } from '@/hooks/useContacts'
import type { Contact } from '@/lib/supabase/types'

interface OverbookingInfo {
  willCauseOverbooking: boolean
  maxOverbookedCount: number
  maxOverbookedSlots: number
  affectedTimeSlots: Array<{ time: string; overbookedCount: number; overbookedSlots: number; totalParticipants: number; capacity: number }>
}

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
  defaultBookingType?: BookingType // Type par défaut selon où on clique
  findBestAvailableRoom?: (participants: number, startDateTime: Date, endDateTime: Date, excludeBookingId?: string) => string | null
  findRoomAvailability?: (participants: number, startDateTime: Date, endDateTime: Date, excludeBookingId?: string) => { bestRoomId: string | null; availableRoomWithLowerCapacity: { id: string; capacity: number } | null; hasAnyAvailableRoom: boolean }
  calculateOverbooking?: (participants: number, startDateTime: Date, endDateTime: Date, excludeBookingId?: string) => OverbookingInfo
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

// Couleurs disponibles (10 couleurs)
const COLORS = [
  { name: 'Bleu', value: '#3B82F6' },        // Défaut pour GAME
  { name: 'Vert', value: '#22C55E' },        // Défaut pour EVENT
  { name: 'Rouge', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Violet', value: '#A855F7' },
  { name: 'Rose', value: '#EC4899' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Jaune', value: '#EAB308' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Emeraude', value: '#10B981' },
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
  defaultBookingType = 'GAME',
  findBestAvailableRoom,
  findRoomAvailability,
  calculateOverbooking
}: BookingModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showOverCapacityConfirm, setShowOverCapacityConfirm] = useState(false)
  const [showNoRoomAvailable, setShowNoRoomAvailable] = useState(false)
  const [showLowerCapacityRoom, setShowLowerCapacityRoom] = useState(false)
  const [showOverbookingWarning, setShowOverbookingWarning] = useState(false)
  const [overbookingInfo, setOverbookingInfo] = useState<OverbookingInfo | null>(null)
  const [pendingRoomId, setPendingRoomId] = useState<string | null | undefined>(null)
  const [lowerCapacityRoomInfo, setLowerCapacityRoomInfo] = useState<{ id: string; capacity: number } | null>(null)
  
  // Référence pour suivre si le modal vient de s'ouvrir (pour éviter de réinitialiser le type quand l'utilisateur le change)
  const prevIsOpenRef = useRef(false)

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
  
  // CRM: Contact sélectionné
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [isEditingContact, setIsEditingContact] = useState(false) // Mode modification activé par "modifier client"
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [pendingContactData, setPendingContactData] = useState<{ phone: string; email: string | null } | null>(null)
  const [pendingEventRoomId, setPendingEventRoomId] = useState<string | null | undefined>(null)
  const { createContact, checkDuplicates, updateContact, getContact } = useContacts(branchId)
  
  // Les champs sont gelés si un contact est sélectionné ET qu'on n'est pas en mode édition
  const areFieldsFrozen = selectedContact !== null && !isEditingContact

  // Pour les événements avec salle (automatique pour EVENT)
  const [roomStartHour, setRoomStartHour] = useState(initialHour)
  const [roomStartMinute, setRoomStartMinute] = useState(initialMinute)
  const [roomDurationMinutes, setRoomDurationMinutes] = useState('120') // Durée salle par défaut 2 heures, modifiable
  const [eventAlias, setEventAlias] = useState('') // Alias : nom de la personne qui fête l'événement
  const [eventNotes, setEventNotes] = useState('') // Notes spécifiques à l'événement/salle

  // Fonction pour générer un ID unique de contact (numéro séquentiel simple)
  // NOTE: Ceci est conservé pour rétrocompatibilité mais ne sera plus utilisé avec le CRM
  const generateContactId = (): string => {
    // Utiliser localStorage pour stocker le dernier ID utilisé
    const storageKey = `lastContactId_${branchId}`
    const lastId = localStorage.getItem(storageKey)
    const nextId = lastId ? parseInt(lastId, 10) + 1 : 1
    localStorage.setItem(storageKey, nextId.toString())
    return nextId.toString()
  }

  // CRM: Quand un contact est sélectionné depuis n'importe quel champ, remplir tous les autres champs
  const handleContactSelectedFromField = (contact: Contact) => {
    setSelectedContact(contact)
    setFirstName(contact.first_name || '')
    setLastName(contact.last_name || '')
    setPhone(contact.phone || '')
    setEmail(contact.email || '')
    setNotes(contact.notes_client || '')
    setIsEditingContact(false) // Désactiver le mode édition quand on sélectionne un nouveau contact
  }

  // CRM: Mettre à jour un champ (seulement si en mode édition)
  const handleFieldChange = (field: 'firstName' | 'lastName' | 'phone' | 'email', value: string) => {
    // Si les champs sont gelés, ne rien faire
    if (areFieldsFrozen) {
      return
    }
    
    // Mettre à jour le champ
    if (field === 'firstName') setFirstName(value)
    else if (field === 'lastName') setLastName(value)
    else if (field === 'phone') setPhone(value)
    else if (field === 'email') setEmail(value)
  }

  // CRM: Activer le mode modification de contact
  const handleModifyClient = () => {
    if (!selectedContact) return
    // Activer le mode édition pour permettre la modification des champs directement dans le formulaire
    // Pas besoin de pop-up, les champs sont débloqués et la sauvegarde de la réservation mettra à jour le contact
    setIsEditingContact(true)
  }

  // CRM: Changer de contact (réinitialiser et permettre nouveau contact)
  const handleChangeContact = () => {
    setSelectedContact(null)
    setIsEditingContact(false)
    setFirstName('')
    setLastName('')
    setPhone('')
    setEmail('')
    setNotes('')
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
    // Ne réinitialiser que si le modal vient de s'ouvrir (passage de false à true)
    const justOpened = isOpen && !prevIsOpenRef.current
    prevIsOpenRef.current = isOpen
    
    if (justOpened) {
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
            const eventNotesMatch = notes.match(/Alias: [^\n]+\n(.*?)(?:\n(?:Contact ID):|$)/s)
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
            
            // Pour les EVENT, calculer l'heure de la salle à partir de l'heure du jeu - 15 minutes
            if (editingBooking.type === 'EVENT' && editingBooking.game_start_datetime) {
              const gameStart = new Date(editingBooking.game_start_datetime)
              const gameStartMinutes = gameStart.getHours() * 60 + gameStart.getMinutes()
              const roomStartMinutes = Math.max(0, gameStartMinutes - 15)
              setRoomStartHour(Math.floor(roomStartMinutes / 60))
              setRoomStartMinute(roomStartMinutes % 60)
            } else {
              // Pour les autres cas, utiliser l'heure de start_datetime
              setRoomStartHour(roomStart.getHours())
              setRoomStartMinute(roomStart.getMinutes())
            }
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
          const contactNotesMatch = notes.match(/Contact ID: \d+\n(.*?)$/s)
          if (contactNotesMatch) {
            setNotes(contactNotesMatch[1].trim())
          }
        }
        
        // Informations client
        setFirstName(editingBooking.customer_first_name || '')
        setLastName(editingBooking.customer_last_name || '')
        setPhone(editingBooking.customer_phone || '')
        setEmail(editingBooking.customer_email || '')
        
        // CRM: Charger le contact si primary_contact_id existe
        if (editingBooking.primary_contact_id) {
          getContact(editingBooking.primary_contact_id).then((contact) => {
            if (contact) {
              setSelectedContact(contact)
              setIsEditingContact(false) // Les champs doivent être gelés pour une réservation existante
              // Charger les notes du contact (notes_client fait partie du contact)
              setNotes(contact.notes_client || '')
              // Ne pas écraser les champs si le contact existe (on garde les snapshot)
              // Mais on peut les pré-remplir avec les infos du contact si les snapshot sont vides
              if (!editingBooking.customer_first_name && contact.first_name) {
                setFirstName(contact.first_name)
              }
              if (!editingBooking.customer_last_name && contact.last_name) {
                setLastName(contact.last_name)
              }
              if (!editingBooking.customer_phone && contact.phone) {
                setPhone(contact.phone)
              }
              if (!editingBooking.customer_email && contact.email) {
                setEmail(contact.email)
              }
            }
          }).catch(() => {
            // Contact introuvable ou archivé, on garde les snapshot
          })
        }
        
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
        setBookingType(defaultBookingType) // Utiliser le type par défaut selon où on clique
        setEventAlias('')
        setEventNotes('')
        setNotes('')
        setContactId(generateContactId())
        setDurationMinutes('60')
        setRoomDurationMinutes('120')
        setFirstName('')
        setLastName('')
        setPhone('')
        setEmail('')
        setError(null)
        // CRM: Réinitialiser le contact et le mode édition pour une nouvelle réservation
        setSelectedContact(null)
        setIsEditingContact(false)
        // Couleur par défaut selon le type
        setColor(defaultBookingType === 'GAME' ? COLORS[0].value : COLORS[1].value)
      }
    }
  }, [isOpen, selectedDate, initialHour, initialMinute, defaultBookingType, editingBooking])


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

  // Changer la couleur par défaut quand on change de type (uniquement lors de la création)
  // Changer la couleur automatiquement selon le type (création ET édition)
  useEffect(() => {
    const currentDefaultColor = bookingType === 'GAME' ? COLORS[0].value : COLORS[1].value
    const oppositeDefaultColor = bookingType === 'GAME' ? COLORS[1].value : COLORS[0].value
    
    // Si la couleur actuelle est la couleur par défaut de l'autre type, on la change
    // En mode édition, on change seulement si c'est une couleur par défaut
    if (editingBooking) {
      // En mode édition : changer seulement si c'est une couleur par défaut
      if (color === oppositeDefaultColor || color === COLORS[0].value || color === COLORS[1].value) {
        setColor(currentDefaultColor)
      }
    } else {
      // En mode création : changer si c'est la couleur opposée
      if (color === oppositeDefaultColor) {
        setColor(currentDefaultColor)
      }
    }
  }, [bookingType, editingBooking])

  // Pour les EVENT : synchroniser automatiquement l'heure de la salle avec l'heure du jeu - 15 minutes
  useEffect(() => {
    if (bookingType === 'EVENT') {
      // Calculer l'heure de la salle = heure du jeu - 15 minutes
      const gameStartMinutes = hour * 60 + minute
      const roomStartMinutes = Math.max(0, gameStartMinutes - 15) // Ne pas aller en négatif
      const newRoomHour = Math.floor(roomStartMinutes / 60)
      const newRoomMinute = roomStartMinutes % 60
      
      // Mettre à jour seulement si différent (éviter les boucles infinies)
      if (roomStartHour !== newRoomHour || roomStartMinute !== newRoomMinute) {
        setRoomStartHour(newRoomHour)
        setRoomStartMinute(newRoomMinute)
      }
    }
  }, [bookingType, hour, minute, roomStartHour, roomStartMinute])

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

  // Fonction interne pour soumettre avec une salle spécifique
  const submitWithRoom = async (eventRoomId: string | null | undefined, skipDuplicateCheck = false) => {
    setLoading(true)

    try {
      // CRM: Gérer le contact (création ou liaison)
      let contactIdToLink: string | null = null
      
      if (selectedContact) {
        // Contact déjà sélectionné, utiliser son ID
        contactIdToLink = selectedContact.id
        
        // Si les infos ont été modifiées, mettre à jour le contact
        const hasChanges = 
          selectedContact.first_name !== firstName.trim() ||
          selectedContact.last_name !== lastName.trim() ||
          selectedContact.phone !== phone.trim() ||
          selectedContact.email !== email.trim() ||
          selectedContact.notes_client !== notes.trim()
        
        if (hasChanges) {
          const updated = await updateContact(selectedContact.id, {
            first_name: firstName.trim(),
            last_name: lastName.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            notes_client: notes.trim() || null,
          })
          if (updated) {
            contactIdToLink = updated.id
            // Mettre à jour le contact dans l'état pour refléter les changements
            setSelectedContact(updated)
          }
        }
      } else if (!skipDuplicateCheck) {
        // Nouveau contact à créer - vérifier les doublons
        if (phone.trim()) {
          const duplicates = await checkDuplicates(phone.trim(), email.trim() || null)
          
          if (duplicates.phoneMatches.length > 0 || duplicates.emailMatches.length > 0) {
            // Il y a des doublons, demander confirmation
            setPendingContactData({ phone: phone.trim(), email: email.trim() || null })
            setPendingEventRoomId(eventRoomId)
            setShowDuplicateWarning(true)
            setLoading(false)
            return
          }
          
          // Pas de doublon, créer le contact
          const newContact = await createContact({
            branch_id_main: branchId,
            first_name: firstName.trim(),
            last_name: lastName.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            notes_client: notes.trim() || null,
            source: 'admin_agenda',
          })
          
          if (newContact) {
            contactIdToLink = newContact.id
            setSelectedContact(newContact)
          }
        }
      } else {
        // skipDuplicateCheck = true : créer directement sans vérifier (après confirmation doublon)
        if (phone.trim()) {
          const newContact = await createContact({
            branch_id_main: branchId,
            first_name: firstName.trim(),
            last_name: lastName.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            notes_client: notes.trim() || null,
            source: 'admin_agenda',
          })
          
          if (newContact) {
            contactIdToLink = newContact.id
            setSelectedContact(newContact)
          }
        }
      }

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
      if (bookingType === 'EVENT') {
        const roomStartDate = new Date(localDate)
        roomStartDate.setHours(roomStartHour, roomStartMinute, 0, 0)

        const { endHour: roomEndHour, endMinute: roomEndMinute } = calculateRoomEndTime()
        const roomEndDate = new Date(localDate)
        roomEndDate.setHours(roomEndHour, roomEndMinute, 0, 0)

        // Prendre les dates les plus larges
        if (roomStartDate < gameStartDate) startDate = roomStartDate
        if (roomEndDate > gameEndDate) endDate = roomEndDate
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

      // Notes : séparer notes client (globales) et notes réservation (spécifiques)
      const bookingNotes = bookingType === 'EVENT' 
        ? (eventAlias.trim() || eventNotes.trim()
            ? `Alias: ${eventAlias.trim() || 'N/A'}\n${eventNotes.trim()}`.trim() 
            : '')
        : notes.trim()

      const bookingData: CreateBookingData = {
        branch_id: branchId,
        type: bookingType,
        start_datetime: startDate.toISOString(),
        end_datetime: endDate.toISOString(),
        game_start_datetime: gameStartDate.toISOString(),
        game_end_datetime: gameEndDate.toISOString(),
        participants_count: parsedParticipants,
        event_room_id: bookingType === 'EVENT' ? (eventRoomId ?? undefined) : undefined,
        customer_first_name: firstName.trim(),
        customer_last_name: lastName.trim() || '',
        customer_phone: phone.trim(),
        customer_email: email.trim() || undefined,
        customer_notes_at_booking: selectedContact?.notes_client || notes.trim() || undefined, // Snapshot
        primary_contact_id: contactIdToLink || undefined,
        notes: bookingNotes || undefined,
        color: color,
        slots
      }

      console.log('Submitting booking:', bookingData)
      const success = await onSubmit(bookingData)

      if (success) {
        // Si c'était une nouvelle réservation (pas d'édition), reset et fermer
        if (!editingBooking) {
          setFirstName('')
          setLastName('')
          setPhone('')
          setEmail('')
          setNotes('')
          setEventNotes('')
          setParticipants('1')
          setDurationMinutes('60')
          setSelectedContact(null)
          setIsEditingContact(false)
          onClose()
        } else {
          // Pour une édition, fermer automatiquement le modal après sauvegarde
          setIsEditingContact(false)
          onClose()
        }
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

    // Si événement, vérifier la salle
    let eventRoomId: string | null | undefined = editingBooking?.event_room_id || null
    
    if (bookingType === 'EVENT' && findRoomAvailability) {
      const roomStartDate = new Date(localDate)
      roomStartDate.setHours(roomStartHour, roomStartMinute, 0, 0)

      const { endHour: roomEndHour, endMinute: roomEndMinute } = calculateRoomEndTime()
      const roomEndDate = new Date(localDate)
      roomEndDate.setHours(roomEndHour, roomEndMinute, 0, 0)

      const roomAvailability = findRoomAvailability(parsedParticipants, roomStartDate, roomEndDate)
      
      if (roomAvailability.bestRoomId) {
        // Une salle avec capacité suffisante est disponible
        eventRoomId = roomAvailability.bestRoomId
      } else if (roomAvailability.availableRoomWithLowerCapacity) {
        // Une salle disponible mais avec capacité inférieure
        setLowerCapacityRoomInfo(roomAvailability.availableRoomWithLowerCapacity)
        setShowLowerCapacityRoom(true)
        return
      } else if (!roomAvailability.hasAnyAvailableRoom) {
        // Aucune salle disponible du tout - NE PAS AUTORISER
        setShowNoRoomAvailable(true)
        return
      } else {
        // Cas de secours (ne devrait pas arriver)
        setError('Aucune salle disponible pour cette quantité. Veuillez réduire le nombre de participants.')
        return
      }
    } else if (bookingType === 'EVENT' && findBestAvailableRoom) {
      // Fallback vers l'ancienne fonction si findRoomAvailability n'est pas fournie
      const roomStartDate = new Date(localDate)
      roomStartDate.setHours(roomStartHour, roomStartMinute, 0, 0)

      const { endHour: roomEndHour, endMinute: roomEndMinute } = calculateRoomEndTime()
      const roomEndDate = new Date(localDate)
      roomEndDate.setHours(roomEndHour, roomEndMinute, 0, 0)

      // Exclure le booking en cours de modification pour qu'il ne se bloque pas lui-même
      const bestRoomId = findBestAvailableRoom(parsedParticipants, roomStartDate, roomEndDate, editingBooking?.id)
      
      if (!bestRoomId) {
        // Aucune salle disponible - over capacity
        setPendingRoomId(editingBooking?.event_room_id || null)
        setShowOverCapacityConfirm(true)
        return
      } else {
        // Une salle convient - l'utiliser (même si différente de la salle actuelle)
        eventRoomId = bestRoomId
      }
    }

    // Vérifier l'overbooking avant de soumettre (pour GAME et EVENT)
    if (calculateOverbooking && (bookingType === 'GAME' || bookingType === 'EVENT')) {
      const gameStartDate = new Date(localDate)
      gameStartDate.setHours(hour || 10, minute || 0, 0, 0)
      
      const { endHour: gameEndHour, endMinute: gameEndMinute } = calculateGameEndTime()
      const gameEndDate = new Date(localDate)
      gameEndDate.setHours(gameEndHour, gameEndMinute, 0, 0)

      const obInfo = calculateOverbooking(
        parsedParticipants,
        gameStartDate,
        gameEndDate,
        editingBooking?.id
      )

      if (obInfo.willCauseOverbooking) {
        // Stocker la salle avant d'afficher le popup
        setPendingRoomId(eventRoomId)
        setOverbookingInfo(obInfo)
        setShowOverbookingWarning(true)
        return
      }
    }

    // Soumettre avec la salle trouvée
    await submitWithRoom(eventRoomId)
  }

  const handleOverCapacityConfirm = async () => {
    const confirmedRoomId = pendingRoomId
    setShowOverCapacityConfirm(false)
    setPendingRoomId(null)
    
    // Après avoir confirmé la salle, vérifier l'overbooking avant de soumettre
    if (calculateOverbooking && (bookingType === 'GAME' || bookingType === 'EVENT')) {
      const gameStartDate = new Date(localDate)
      gameStartDate.setHours(hour || 10, minute || 0, 0, 0)
      
      const { endHour: gameEndHour, endMinute: gameEndMinute } = calculateGameEndTime()
      const gameEndDate = new Date(localDate)
      gameEndDate.setHours(gameEndHour, gameEndMinute, 0, 0)

      const obInfo = calculateOverbooking(
        parsedParticipants,
        gameStartDate,
        gameEndDate,
        editingBooking?.id
      )

      if (obInfo.willCauseOverbooking) {
        // Stocker la salle confirmée et afficher le popup d'overbooking
        setPendingRoomId(confirmedRoomId)
        setOverbookingInfo(obInfo)
        setShowOverbookingWarning(true)
        return
      }
    }
    
    // Pas d'overbooking, soumettre directement
    await submitWithRoom(confirmedRoomId)
  }

  const handleOverCapacityCancel = () => {
    setShowOverCapacityConfirm(false)
    setError('Réservation annulée. Veuillez réduire le nombre de participants ou choisir une autre période.')
    setPendingRoomId(null)
  }

  const handleLowerCapacityRoomConfirm = async () => {
    if (lowerCapacityRoomInfo) {
      const confirmedRoomId = lowerCapacityRoomInfo.id
      setShowLowerCapacityRoom(false)
      setLowerCapacityRoomInfo(null)
      
      // Après avoir confirmé la salle, vérifier l'overbooking avant de soumettre
      if (calculateOverbooking && (bookingType === 'GAME' || bookingType === 'EVENT')) {
        const gameStartDate = new Date(localDate)
        gameStartDate.setHours(hour || 10, minute || 0, 0, 0)
        
        const { endHour: gameEndHour, endMinute: gameEndMinute } = calculateGameEndTime()
        const gameEndDate = new Date(localDate)
        gameEndDate.setHours(gameEndHour, gameEndMinute, 0, 0)

        const obInfo = calculateOverbooking(
          parsedParticipants,
          gameStartDate,
          gameEndDate,
          editingBooking?.id
        )

        if (obInfo.willCauseOverbooking) {
          // Stocker la salle confirmée et afficher le popup d'overbooking
          setPendingRoomId(confirmedRoomId)
          setOverbookingInfo(obInfo)
          setShowOverbookingWarning(true)
          return
        }
      }
      
      // Pas d'overbooking, soumettre directement
      await submitWithRoom(confirmedRoomId)
    }
  }

  const handleLowerCapacityRoomCancel = () => {
    setShowLowerCapacityRoom(false)
    setError(`Aucune salle disponible pour ${parsedParticipants} participants. Veuillez réduire le nombre de participants ou choisir une autre période.`)
    setLowerCapacityRoomInfo(null)
  }

  const handleNoRoomAvailableClose = () => {
    setShowNoRoomAvailable(false)
    setError(`Aucune salle disponible pour ${parsedParticipants} participants. Veuillez réduire le nombre de participants ou choisir une autre période.`)
  }

  const handleOverbookingConfirm = async () => {
    setShowOverbookingWarning(false)
    // Continuer avec la soumission
    const eventRoomId = pendingRoomId || editingBooking?.event_room_id || null
    await submitWithRoom(eventRoomId)
    setOverbookingInfo(null)
    setPendingRoomId(null)
  }

  const handleOverbookingCancel = () => {
    setShowOverbookingWarning(false)
    setError('Réservation annulée. Veuillez réduire le nombre de participants ou choisir une autre période.')
    setOverbookingInfo(null)
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
          {/* Reference Code / Numéro de commande */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Numéro de commande
            </label>
            <div className={`px-3 py-2 rounded-lg border text-sm font-mono ${
              isDark
                ? 'bg-gray-700/50 border-gray-600 text-gray-300'
                : 'bg-gray-100 border-gray-300 text-gray-700'
            }`}>
              {editingBooking?.reference_code || 'Création en cours...'}
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {editingBooking ? 'Numéro unique de la réservation' : 'Sera généré automatiquement à la création'}
            </p>
          </div>

          {/* Type de réservation + Couleur */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Type de réservation
            </label>
            <div className="grid grid-cols-2 gap-3 mb-3">
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

            {/* Sélecteur de couleur - en dessous, sur une ligne */}
            <div className="flex items-center gap-3">
              <Palette className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              <div className="flex items-center gap-2 flex-1">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`w-7 h-7 rounded-full transition-all border-2 flex-shrink-0 ${
                      color === c.value 
                        ? `${isDark ? 'ring-2 ring-offset-2 ring-white ring-offset-gray-800' : 'ring-2 ring-offset-2 ring-gray-800 ring-offset-white'} scale-125 border-white shadow-lg` 
                        : `${isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'} hover:scale-110`
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
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

          {/* Informations du contact avec autocomplete sur chaque champ */}
          <div className="space-y-4">
            {selectedContact && (
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={handleModifyClient}
                  className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 transition-colors ${
                    isDark
                      ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  }`}
                >
                  <Edit2 className="w-3 h-3" />
                  Modifier client
                </button>
                <button
                  type="button"
                  onClick={handleChangeContact}
                  className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 transition-colors ${
                    isDark
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <RefreshCw className="w-3 h-3" />
                  Changer contact
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <User className="w-4 h-4 inline mr-1" />
                  Prénom *
                </label>
                <ContactFieldAutocomplete
                  branchId={branchId}
                  value={firstName}
                  onChange={(value) => handleFieldChange('firstName', value)}
                  onSelectContact={handleContactSelectedFromField}
                  fieldType="firstName"
                  placeholder="Prénom"
                  required
                  isDark={isDark}
                  inputType="text"
                  disabled={areFieldsFrozen}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Nom
                </label>
                <ContactFieldAutocomplete
                  branchId={branchId}
                  value={lastName}
                  onChange={(value) => handleFieldChange('lastName', value)}
                  onSelectContact={handleContactSelectedFromField}
                  fieldType="lastName"
                  placeholder="Nom (optionnel)"
                  isDark={isDark}
                  inputType="text"
                  disabled={areFieldsFrozen}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Phone className="w-4 h-4 inline mr-1" />
                  Téléphone *
                </label>
                <ContactFieldAutocomplete
                  branchId={branchId}
                  value={phone}
                  onChange={(value) => handleFieldChange('phone', value)}
                  onSelectContact={handleContactSelectedFromField}
                  fieldType="phone"
                  placeholder="05X XXX XXXX"
                  required
                  isDark={isDark}
                  inputType="tel"
                  disabled={areFieldsFrozen}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </label>
                <ContactFieldAutocomplete
                  branchId={branchId}
                  value={email}
                  onChange={(value) => handleFieldChange('email', value)}
                  onSelectContact={handleContactSelectedFromField}
                  fieldType="email"
                  placeholder="email@exemple.com"
                  isDark={isDark}
                  inputType="email"
                  disabled={areFieldsFrozen}
                />
              </div>
            </div>
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
                if (!areFieldsFrozen) {
                  setNotes(e.target.value)
                  // Auto-resize jusqu'à 5 lignes max
                  const textarea = e.target as HTMLTextAreaElement
                  textarea.style.height = 'auto'
                  const maxHeight = 5 * 24 // 5 lignes environ (24px par ligne)
                  const newHeight = Math.min(textarea.scrollHeight, maxHeight)
                  textarea.style.height = `${newHeight}px`
                }
              }}
              rows={2}
              disabled={areFieldsFrozen}
              readOnly={areFieldsFrozen}
              className={`w-full px-3 py-2 rounded-lg border resize-none text-sm overflow-y-auto ${
                areFieldsFrozen
                  ? isDark
                    ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                  : isDark
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
              className="px-6 py-2 rounded-lg text-white flex items-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: color }}
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

      {/* Modal de confirmation d'over capacity */}
      {showOverCapacityConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleOverCapacityCancel}
          />

          {/* Modal de confirmation */}
          <div className={`relative w-full max-w-md mx-4 rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="p-6">
              <h3 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ⚠️ Capacité insuffisante
              </h3>
              <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Aucune salle disponible pour <strong>{parsedParticipants} participants</strong>.<br /><br />
                La capacité maximale des salles disponibles est insuffisante.<br /><br />
                Voulez-vous continuer quand même avec la salle actuelle (si elle existe) ?
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleOverCapacityCancel}
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
                  onClick={handleOverCapacityConfirm}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      En cours...
                    </>
                  ) : (
                    'Continuer quand même'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal : Aucune salle disponible (NON AUTORISABLE) */}
      {showNoRoomAvailable && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleNoRoomAvailableClose}
          />

          {/* Modal */}
          <div className={`relative w-full max-w-md mx-4 rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="p-6">
              <h3 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ❌ Aucune salle disponible
              </h3>
              <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Aucune salle disponible pour <strong>{parsedParticipants} participants</strong> à cette période.<br /><br />
                Veuillez réduire le nombre de participants ou choisir une autre période.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleNoRoomAvailableClose}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg ${
                    isDark
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  } disabled:opacity-50`}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal : Salle disponible avec capacité inférieure (AUTORISABLE) */}
      {showLowerCapacityRoom && lowerCapacityRoomInfo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleLowerCapacityRoomCancel}
          />

          {/* Modal */}
          <div className={`relative w-full max-w-md mx-4 rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="p-6">
              <h3 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ⚠️ Capacité inférieure disponible
              </h3>
              <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Vous avez demandé <strong>{parsedParticipants} participants</strong>, mais la plus grande salle disponible a une capacité de <strong>{lowerCapacityRoomInfo.capacity} participants</strong>.<br /><br />
                {parsedParticipants > lowerCapacityRoomInfo.capacity ? (
                  <>
                    Cette salle dépasse sa capacité maximale de <strong>{parsedParticipants - lowerCapacityRoomInfo.capacity} participants</strong>.<br /><br />
                  </>
                ) : null}
                Voulez-vous utiliser cette salle quand même ?
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleLowerCapacityRoomCancel}
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
                  onClick={handleLowerCapacityRoomConfirm}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      En cours...
                    </>
                  ) : (
                    'Utiliser cette salle'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal : Avertissement de doublon de contact */}
      {showDuplicateWarning && pendingContactData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDuplicateWarning(false)}
          />

          {/* Modal */}
          <div className={`relative w-full max-w-md mx-4 rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className={`w-6 h-6 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Doublon détecté
                </h3>
              </div>
              <p className={`mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Un ou plusieurs contacts existent déjà avec :
              </p>
              <div className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                {pendingContactData.phone && (
                  <div className="mb-2">
                    <strong className={isDark ? 'text-gray-300' : 'text-gray-700'}>Téléphone :</strong>{' '}
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{pendingContactData.phone}</span>
                  </div>
                )}
                {pendingContactData.email && (
                  <div>
                    <strong className={isDark ? 'text-gray-300' : 'text-gray-700'}>Email :</strong>{' '}
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{pendingContactData.email}</span>
                  </div>
                )}
              </div>
              <p className={`mb-6 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Voulez-vous créer un nouveau contact quand même ? Ce contact sera créé même si des données similaires existent déjà.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDuplicateWarning(false)
                    setPendingContactData(null)
                  }}
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
                  onClick={async () => {
                    if (!pendingContactData) return
                    
                    // Créer le contact malgré le doublon
                    const newContact = await createContact({
                      branch_id_main: branchId,
                      first_name: firstName.trim(),
                      last_name: lastName.trim() || null,
                      phone: pendingContactData.phone,
                      email: pendingContactData.email || null,
                      notes_client: notes.trim() || null,
                      source: 'admin_agenda',
                    })
                    
                    if (newContact) {
                      setSelectedContact(newContact)
                      setShowDuplicateWarning(false)
                      setPendingContactData(null)
                      // Relancer la soumission avec skipDuplicateCheck = true
                      const roomId = pendingEventRoomId
                      setPendingEventRoomId(null)
                      await submitWithRoom(roomId, true)
                    }
                  }}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      En cours...
                    </>
                  ) : (
                    'Créer quand même'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal : Avertissement d'overbooking */}
      {showOverbookingWarning && overbookingInfo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleOverbookingCancel}
          />

          {/* Modal */}
          <div className={`relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="p-6">
              <h3 className={`text-xl font-bold mb-4 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                ⚠️ Avertissement : Overbooking détecté
              </h3>
              <div className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <p className="mb-4">
                  Cette réservation va créer un <strong>overbooking</strong> :
                </p>
                <div className={`p-4 rounded-lg ${isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'}`}>
                  <div className="space-y-2">
                    <div>
                      <strong className={isDark ? 'text-red-300' : 'text-red-700'}>Maximum :</strong>
                      <span className="ml-2">
                        <strong>{overbookingInfo.maxOverbookedCount} personnes</strong> en surplus
                        {' '}(<strong>{overbookingInfo.maxOverbookedSlots} slots</strong>)
                      </span>
                    </div>
                    {overbookingInfo.affectedTimeSlots.length > 0 && (
                      <div className="mt-3">
                        <strong className={isDark ? 'text-red-300' : 'text-red-700'}>Tranches horaires affectées :</strong>
                        <ul className="mt-2 space-y-1 text-sm">
                          {overbookingInfo.affectedTimeSlots.slice(0, 5).map((slot, idx) => (
                            <li key={idx}>
                              • <strong>{slot.time}</strong> : +{slot.overbookedCount} pers. ({slot.totalParticipants}/{slot.capacity})
                            </li>
                          ))}
                          {overbookingInfo.affectedTimeSlots.length > 5 && (
                            <li className="italic">... et {overbookingInfo.affectedTimeSlots.length - 5} autre(s) tranche(s)</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                <p className="mt-4">
                  <strong>Autorisation manuelle requise</strong> pour continuer.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleOverbookingCancel}
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
                  onClick={handleOverbookingConfirm}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      En cours...
                    </>
                  ) : (
                    'Autoriser et continuer'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
