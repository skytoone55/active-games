'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, Loader2, Users, Clock, User, Phone, Mail, MessageSquare, Gamepad2, PartyPopper, Palette, Home, Calendar, ChevronLeft, ChevronRight, Trash2, Edit2, RefreshCw, AlertTriangle, ChevronDown, Building2, Zap, Target, FileText, Receipt, CheckCheck } from 'lucide-react'
import type { CreateBookingData, BookingWithSlots } from '@/hooks/useBookings'
import { ContactFieldAutocomplete } from './ContactFieldAutocomplete'
import { useContacts } from '@/hooks/useContacts'
import type { Contact, GameArea, LaserRoom } from '@/lib/supabase/types'
import { useTranslation } from '@/contexts/LanguageContext'
import { validateIsraeliPhone, validateEmail, VALIDATION_MESSAGES } from '@/lib/validation'
import { usePricingData } from '@/hooks/usePricingData'
import { calculateBookingPrice, type PriceCalculationResult } from '@/lib/price-calculator'

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
  defaultGameArea?: 'ACTIVE' | 'LASER' // Zone de jeu par défaut (pour GAME)
  findBestAvailableRoom?: (participants: number, startDateTime: Date, endDateTime: Date, excludeBookingId?: string, targetBranchId?: string | null) => string | null
  findRoomAvailability?: (participants: number, startDateTime: Date, endDateTime: Date, excludeBookingId?: string, targetBranchId?: string | null) => { bestRoomId: string | null; availableRoomWithLowerCapacity: { id: string; capacity: number } | null; hasAnyAvailableRoom: boolean }
  calculateOverbooking?: (participants: number, startDateTime: Date, endDateTime: Date, excludeBookingId?: string, targetBranchId?: string | null) => OverbookingInfo
  branches?: Array<{ id: string; name: string; slug: string }> // Liste des branches pour permettre le changement
  selectedBranchId?: string | null // ID de la branche sélectionnée
  // Fonctions Laser
  findBestLaserRoom?: (participants: number, startDateTime: Date, endDateTime: Date, excludeBookingId?: string, targetBranchId?: string | null, allocationMode?: 'auto' | 'petit' | 'grand' | 'maxi') => Promise<{ roomIds: string[]; requiresTwoRooms: boolean } | null>
  checkLaserVestsConstraint?: (participants: number, startDateTime: Date, endDateTime: Date, excludeBookingId?: string, targetBranchId?: string | null) => Promise<{ isViolated: boolean; needsSpareVests: boolean; currentUsage: number; maxVests: number; spareVests: number; totalVests: number; message: string }>
  checkLaserRoomCapacity?: (roomId: string, participants: number, targetBranchId?: string | null) => { isExceeded: boolean; roomCapacity: number; overcapBy: number }
  laserRooms?: LaserRoom[] // Liste des laser rooms de la branche
  maxPlayersPerSlot?: number // Max players per slot (dynamique)
  totalSlots?: number // Total slots (dynamique)
  // Permissions
  canCreate?: boolean // Permission de créer une réservation
  canEdit?: boolean // Permission de modifier une réservation
  canDelete?: boolean // Permission de supprimer une réservation
  // Navigation vers la commande
  onViewOrder?: (orderId: string) => void // Callback pour voir la commande dans la zone Orders
  orderId?: string | null // ID de la commande liée au booking
  orderStatus?: string | null // Statut de la commande (pour conditionner les boutons)
  onOpenAccounting?: (orderId: string) => void // Callback pour ouvrir la fiche comptable
  onCloseOrder?: (orderId: string) => void // Callback pour clôturer la commande
}

type BookingType = 'GAME' | 'EVENT'

// Configuration des slots
const SLOT_DURATION = 15 // minutes
const MAX_PLAYERS_PER_SLOT = 6
const TOTAL_SLOTS = 14
const TOTAL_CAPACITY = TOTAL_SLOTS * MAX_PLAYERS_PER_SLOT // 84 joueurs max

// Horaires disponibles dans le formulaire (24h)
const OPENING_HOUR = 0
const CLOSING_HOUR = 24

// Couleurs disponibles (10 couleurs) - les noms sont des clés de traduction
const COLORS = [
  { nameKey: 'admin.booking_modal.colors.blue', value: '#3B82F6' },        // Défaut pour GAME
  { nameKey: 'admin.booking_modal.colors.green', value: '#22C55E' },       // Défaut pour EVENT
  { nameKey: 'admin.booking_modal.colors.red', value: '#EF4444' },
  { nameKey: 'admin.booking_modal.colors.orange', value: '#F97316' },
  { nameKey: 'admin.booking_modal.colors.purple', value: '#A855F7' },
  { nameKey: 'admin.booking_modal.colors.pink', value: '#EC4899' },
  { nameKey: 'admin.booking_modal.colors.cyan', value: '#06B6D4' },
  { nameKey: 'admin.booking_modal.colors.yellow', value: '#EAB308' },
  { nameKey: 'admin.booking_modal.colors.indigo', value: '#6366F1' },
  { nameKey: 'admin.booking_modal.colors.emerald', value: '#10B981' },
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
  defaultGameArea, // Pas de valeur par défaut - forcer le commercial à choisir
  findBestAvailableRoom,
  findRoomAvailability,
  calculateOverbooking,
  branches = [],
  selectedBranchId = null,
  findBestLaserRoom,
  checkLaserVestsConstraint,
  checkLaserRoomCapacity,
  laserRooms = [],
  maxPlayersPerSlot = 6,
  totalSlots = 14,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  onViewOrder,
  orderId,
  orderStatus,
  onOpenAccounting,
  onCloseOrder
}: BookingModalProps) {
  const { t, tArray, locale } = useTranslation()

  // Helper pour obtenir la locale de date en fonction de la langue
  const getDateLocale = () => {
    switch (locale) {
      case 'he': return 'he-IL'
      case 'en': return 'en-US'
      default: return 'fr-FR'
    }
  }

  // Helper pour obtenir le nom du mois traduit
  const getMonthName = (monthIndex: number) => {
    const monthKeys = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
    return t(`admin.agenda.months.${monthKeys[monthIndex]}`)
  }

  // Helper pour obtenir les jours de la semaine traduits
  const getDaysShort = (): string[] => {
    const days = tArray('admin.agenda.days_short')
    if (days.length > 0) {
      return days
    }
    // Fallback si la traduction n'est pas un tableau
    return ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  }

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
  const skipSyncRef = useRef(false) // Pour éviter la synchronisation pendant l'initialisation
  // Référence pour suivre la branche précédente et détecter les changements
  const prevBookingBranchIdRef = useRef<string | null>(null)

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
  const [participants, setParticipants] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [preferredLocale, setPreferredLocale] = useState<'he' | 'fr' | 'en'>('he') // Langue préférée du contact pour les emails
  const [contactId, setContactId] = useState('') // ID unique du contact (auto-généré)
  const [color, setColor] = useState(COLORS[0].value) // Couleur par défaut bleu

  // Discount (remise)
  const [discountType, setDiscountType] = useState<'percent' | 'fixed' | null>(null)
  const [discountValue, setDiscountValue] = useState<string>('')

  // Branche de la réservation (peut être différente de branchId si on modifie)
  const [bookingBranchId, setBookingBranchId] = useState<string>(branchId)
  const [isEditingBranch, setIsEditingBranch] = useState(false)
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)
  const branchDropdownRef = useRef<HTMLDivElement>(null)
  const [showCustomGamesDropdown, setShowCustomGamesDropdown] = useState(false)
  const customGamesDropdownRef = useRef<HTMLDivElement>(null)
  
  // CRM: Contact sélectionné
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [isEditingContact, setIsEditingContact] = useState(false) // Mode modification activé par "modifier client"
  const [isEditingEvent, setIsEditingEvent] = useState(false) // Mode modification activé par "modifier événement"
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [pendingContactData, setPendingContactData] = useState<{ phone: string; email: string | null } | null>(null)
  const [pendingEventRoomId, setPendingEventRoomId] = useState<string | null | undefined>(null)
  // Utiliser bookingBranchId pour les opérations sur les contacts (peut changer si on modifie la branche)
  const { createContact, checkDuplicates, updateContact, getContact } = useContacts(bookingBranchId)

  // Prix pour le calcul
  const { products, eventFormulas, rooms: pricingRooms } = usePricingData(bookingBranchId)
  
  // Les champs sont gelés si un contact est sélectionné ET qu'on n'est pas en mode édition
  const areFieldsFrozen = selectedContact !== null && !isEditingContact

  // Pour les événements avec salle (automatique pour EVENT)
  const [roomStartHour, setRoomStartHour] = useState(initialHour)
  const [roomStartMinute, setRoomStartMinute] = useState(initialMinute)
  const [roomDurationMinutes, setRoomDurationMinutes] = useState('120') // Durée salle par défaut 2 heures, modifiable
  const [eventAlias, setEventAlias] = useState('') // Alias : nom de la personne qui fête l'événement
  const [eventNotes, setEventNotes] = useState('') // Notes spécifiques à l'événement/salle

  // État OUT pour le bouton invisible
  const [isOrderOut, setIsOrderOut] = useState(false)

  // Gestion Laser et game_sessions
  // Pour GAME : game_area (ACTIVE/LASER/CUSTOM), nombre de jeux (1/2/3), durées, pauses
  const [gameArea, setGameArea] = useState<GameArea | 'CUSTOM' | null>(null) // ACTIVE, LASER ou CUSTOM (sur mesure) pour GAME, null par défaut pour nouvelle réservation
  const [numberOfGames, setNumberOfGames] = useState(1) // Par défaut 1 jeu (sera ajusté selon gameArea)
  const [laserAllocationMode, setLaserAllocationMode] = useState<'auto' | 'petit' | 'grand' | 'maxi'>('auto') // Mode d'allocation manuelle pour LASER
  const [showSpareVestsPopup, setShowSpareVestsPopup] = useState(false) // Popup pour demander si spare vests disponibles
  const [pendingSpareVestsData, setPendingSpareVestsData] = useState<{ currentUsage: number; maxVests: number; spareVests: number; totalVests: number } | null>(null) // Données pour le popup spare vests
  const [spareVestsAuthorized, setSpareVestsAuthorized] = useState(false) // Flag pour bypasser la vérification des vests après autorisation
  const [gameDurations, setGameDurations] = useState<string[]>(['30', '30']) // Durée de chaque jeu (en minutes)
  const [gamePauses, setGamePauses] = useState<number[]>([]) // Pause après chaque jeu (en minutes)
  const [laserRoomIds, setLaserRoomIds] = useState<string[]>([]) // IDs des salles laser pour chaque jeu (si LASER)
  // Pour GAME en mode sur mesure : même système que EVENT
  const [gameCustomGameArea, setGameCustomGameArea] = useState<GameArea[]>([]) // Zone de chaque jeu pour plan sur mesure
  const [gameCustomNumberOfGames, setGameCustomNumberOfGames] = useState(2) // Nombre de jeux pour plan sur mesure
  const [gameCustomGameDurations, setGameCustomGameDurations] = useState<string[]>(['30', '30']) // Durées pour plan sur mesure
  const [gameCustomGamePauses, setGameCustomGamePauses] = useState<number[]>([]) // Pauses pour plan sur mesure
  const [gameCustomLaserRoomIds, setGameCustomLaserRoomIds] = useState<string[]>([]) // IDs salles laser pour plan sur mesure
  const [showGameCustomGamesDropdown, setShowGameCustomGamesDropdown] = useState(false)
  const gameCustomGamesDropdownRef = useRef<HTMLDivElement>(null)

  // Pour EVENT : Nouveau système de plans de jeu
  type EventGamePlanType = '2' | 'CUSTOM' // 2 jeux prédéfinis ou sur mesure
  type EventQuickPlan = 'AA' | 'LL' | 'AL' | 'LA' | 'AAA' | 'LLL' | 'AAL' | 'ALL' | 'LAA' | 'LLA' | 'ALA' | 'LAL' | 'AAAA' | 'LLLL' | 'AALL' | 'LLAA' | 'ALAL' | 'LALA' | 'AALA' | 'LLAL' | 'ALAA' | 'LALL' | 'AAAL' | 'LLLA' // Plans prédéfinis
  const [eventGamePlanType, setEventGamePlanType] = useState<EventGamePlanType>('2') // Type de plan : 1, 2, 3, 4 jeux ou CUSTOM
  const [eventQuickPlan, setEventQuickPlan] = useState<EventQuickPlan>('AA') // Plan prédéfini sélectionné (AA, LL, AL, LA, etc.)
  const [eventFirstGameStartHour, setEventFirstGameStartHour] = useState(initialHour) // Heure de début du premier jeu
  const [eventFirstGameStartMinute, setEventFirstGameStartMinute] = useState(initialMinute) // Minute de début du premier jeu
  // Pour plans prédéfinis : durées et pauses par jeu
  const [eventGameDurations, setEventGameDurations] = useState<string[]>(['30', '30']) // Durée de chaque jeu EVENT
  const [eventGamePauses, setEventGamePauses] = useState<number[]>([]) // Pause après chaque jeu EVENT
  // Pour plan sur mesure : même système que GAME
  const [eventCustomGameArea, setEventCustomGameArea] = useState<GameArea[]>([]) // Zone de chaque jeu pour plan sur mesure
  const [eventCustomNumberOfGames, setEventCustomNumberOfGames] = useState(2) // Nombre de jeux pour plan sur mesure
  const [eventCustomGameDurations, setEventCustomGameDurations] = useState<string[]>(['30', '30']) // Durées pour plan sur mesure
  const [eventCustomGamePauses, setEventCustomGamePauses] = useState<number[]>([]) // Pauses pour plan sur mesure
  const [eventCustomLaserRoomIds, setEventCustomLaserRoomIds] = useState<string[]>([]) // IDs salles laser pour plan sur mesure
  // Anciennes variables pour compatibilité (à supprimer progressivement)
  // Anciennes variables pour compatibilité (à supprimer progressivement)
  const [eventGamePlan, setEventGamePlan] = useState<'AA' | 'LL' | 'AL' | 'LA'>('AA') // DEPRECATED: utiliser eventQuickPlan
  const [eventNumberOfGames, setEventNumberOfGames] = useState(2) // DEPRECATED
  const [eventSession1Duration, setEventSession1Duration] = useState('30') // DEPRECATED
  const [eventSession2Duration, setEventSession2Duration] = useState('30') // DEPRECATED
  const [eventPause, setEventPause] = useState(30) // DEPRECATED

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
    setPreferredLocale(contact.preferred_locale || 'he') // Charger la langue préférée du contact
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
    else if (field === 'phone') {
      setPhone(value)
      // Valider le format téléphone israélien
      if (value.trim() && !validateIsraeliPhone(value)) {
        setPhoneError(VALIDATION_MESSAGES.phone.israeliFormat)
      } else {
        setPhoneError(null)
      }
    }
    else if (field === 'email') {
      setEmail(value)
      // Valider le format email si c'est un EVENT et que le champ n'est pas vide
      if (value.trim() && !validateEmail(value)) {
        setEmailError(VALIDATION_MESSAGES.email.invalid)
      } else {
        setEmailError(null)
      }
    }
  }

  // CRM: Activer le mode modification de contact
  const handleModifyClient = () => {
    if (!selectedContact) return
    // Activer le mode édition pour permettre la modification des champs directement dans le formulaire
    // Pas besoin de pop-up, les champs sont débloqués et la sauvegarde de la réservation mettra à jour le contact
    setIsEditingContact(true)
  }

  // Activer le mode modification de l'événement
  const handleModifyEvent = () => {
    if (bookingType !== 'EVENT' || !editingBooking) return
    setIsEditingEvent(true)
  }

  // CRM: Changer de contact (réinitialiser et permettre nouveau contact)
  const handleChangeContact = () => {
    setSelectedContact(null)
    setIsEditingContact(false)
    setFirstName('')
    setLastName('')
    setPhone('')
    setPhoneError(null)
    setEmail('')
    setNotes('')
    setPreferredLocale('he') // Réinitialiser la langue par défaut à hébreu
  }

  // Fonction utilitaire pour formater une date en YYYY-MM-DD (sans conversion UTC)
  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Fonctions utilitaires pour les plans de jeu EVENT
  // Obtenir les zones de jeu d'un plan prédéfini
  const getQuickPlanAreas = (plan: EventQuickPlan): GameArea[] => {
    return plan.split('').map(char => char === 'A' ? 'ACTIVE' : 'LASER') as GameArea[]
  }

  // Obtenir le nombre de jeux d'un plan prédéfini
  const getQuickPlanGameCount = (plan: EventQuickPlan): number => {
    return plan.length
  }

  // Générer les plans prédéfinis disponibles selon le nombre de jeux
  const getAvailableQuickPlans = (gameCount: '2'): EventQuickPlan[] => {
    if (gameCount === '2') return ['AA', 'LL', 'AL', 'LA'] as EventQuickPlan[]
    return []
  }

  // Helper pour calculer les sessions ACTIVE d'un événement (pour vérification overbooking)
  const calculateActiveSessionsForEvent = (): Array<{ start: Date; end: Date }> => {
    const activeSessions: Array<{ start: Date; end: Date }> = []
    
    if (eventGamePlanType !== 'CUSTOM') {
      const areas = getQuickPlanAreas(eventQuickPlan)
      let currentStart = new Date(localDate)
      currentStart.setHours(eventFirstGameStartHour, eventFirstGameStartMinute, 0, 0)
      
      for (let i = 0; i < areas.length; i++) {
        if (areas[i] === 'ACTIVE') {
          const duration = parseInt(eventGameDurations[i] || '30', 10)
          const sessionStart = new Date(currentStart)
          const sessionEnd = new Date(sessionStart)
          sessionEnd.setMinutes(sessionEnd.getMinutes() + duration)
          activeSessions.push({ start: sessionStart, end: sessionEnd })
        }
        
        // Préparer le début du prochain jeu
        if (i < areas.length - 1) {
          const duration = parseInt(eventGameDurations[i] || '30', 10)
          currentStart = new Date(currentStart)
          currentStart.setMinutes(currentStart.getMinutes() + duration + (eventGamePauses[i] ?? 0))
        }
      }
    } else {
      // Plan sur mesure
      let currentStart = new Date(localDate)
      currentStart.setHours(eventFirstGameStartHour, eventFirstGameStartMinute, 0, 0)
      
      for (let i = 0; i < eventCustomNumberOfGames; i++) {
        if (eventCustomGameArea[i] === 'ACTIVE') {
          const duration = parseInt(eventCustomGameDurations[i] || '30', 10)
          const sessionStart = new Date(currentStart)
          const sessionEnd = new Date(sessionStart)
          sessionEnd.setMinutes(sessionEnd.getMinutes() + duration)
          activeSessions.push({ start: sessionStart, end: sessionEnd })
        }
        
        // Préparer le début du prochain jeu
        if (i < eventCustomNumberOfGames - 1) {
          const duration = parseInt(eventCustomGameDurations[i] || '30', 10)
          currentStart = new Date(currentStart)
          currentStart.setMinutes(currentStart.getMinutes() + duration + (eventCustomGamePauses[i] ?? 0))
        }
      }
    }
    
    return activeSessions
  }

  // Obtenir le label d'un plan prédéfini
  const getQuickPlanLabel = (plan: EventQuickPlan): string => {
    const areas = getQuickPlanAreas(plan)
    return areas.map(a => a === 'ACTIVE' ? t('admin.booking_modal.zones.active') : t('admin.booking_modal.zones.laser')).join(' + ')
  }

  // Fonction utilitaire pour extraire la date locale d'une date ISO
  const extractLocalDateFromISO = (isoString: string): Date => {
    const date = new Date(isoString)
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }

  // Fermer le dropdown de branche quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) {
        setShowBranchDropdown(false)
      }
    }

    if (showBranchDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showBranchDropdown])

  // Fermer le dropdown "sur mesure" quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customGamesDropdownRef.current && !customGamesDropdownRef.current.contains(event.target as Node)) {
        setShowCustomGamesDropdown(false)
      }
    }

    if (showCustomGamesDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCustomGamesDropdown])

  // Fermer le dropdown "sur mesure" GAME quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (gameCustomGamesDropdownRef.current && !gameCustomGamesDropdownRef.current.contains(event.target as Node)) {
        setShowGameCustomGamesDropdown(false)
      }
    }

    if (showGameCustomGamesDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showGameCustomGamesDropdown])

  // Reset le formulaire quand on ouvre/ferme ou charge une réservation à éditer
  useEffect(() => {
    // Ne réinitialiser que si le modal vient de s'ouvrir (passage de false à true)
    const justOpened = isOpen && !prevIsOpenRef.current
    prevIsOpenRef.current = isOpen
    
    if (justOpened) {
      // Reset spare vests authorization flag
      setSpareVestsAuthorized(false)
      // Initialiser la branche de la réservation
      const initialBranchId = editingBooking ? (editingBooking.branch_id || branchId) : branchId
      setBookingBranchId(initialBranchId)
      // Initialiser la référence pour éviter de déclencher la validation au premier chargement
      prevBookingBranchIdRef.current = initialBranchId
      // Pour les réservations existantes, geler la branche par défaut
      setIsEditingBranch(false)
      setShowBranchDropdown(false)
      
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
            
            // Pour les EVENT, utiliser directement l'heure de start_datetime (comme pour GAME)
            // C'est l'heure de début de la salle, pas besoin de la calculer depuis game_start_datetime
            if (editingBooking.type === 'EVENT') {
              // Utiliser directement l'heure de start_datetime pour la salle
              setRoomStartHour(roomStart.getHours())
              setRoomStartMinute(roomStart.getMinutes())
              
              // Pour l'heure du premier jeu, utiliser game_start_datetime si disponible
              if (editingBooking.game_start_datetime) {
                const gameStart = new Date(editingBooking.game_start_datetime)
                setEventFirstGameStartHour(gameStart.getHours())
                setEventFirstGameStartMinute(gameStart.getMinutes())
              }
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
        
        // Initialiser les game_sessions si disponibles
        if (editingBooking.game_sessions && editingBooking.game_sessions.length > 0) {
          // Déterminer game_area pour GAME
          if (editingBooking.type === 'GAME') {
            const firstSession = editingBooking.game_sessions[0]
            setGameArea(firstSession.game_area)
            
            // IMPORTANT: Compter les session_order UNIQUES, pas le nombre total de sessions
            // Car un jeu peut avoir plusieurs sessions (ex: 2 salles LASER pour un même jeu)
            const sessions = editingBooking.game_sessions || []
            const uniqueSessionOrders = [...new Set(sessions.map(s => s.session_order))].sort((a, b) => a - b)
            setNumberOfGames(uniqueSessionOrders.length)
            
            // Initialiser les durées et pauses par JEU (groupé par session_order)
            const durations: string[] = []
            const pauses: number[] = []
            const roomIds: string[] = []
            
            uniqueSessionOrders.forEach((sessionOrder, index) => {
              // Trouver toutes les sessions de ce jeu
              const sessionsForThisGame = sessions.filter(s => s.session_order === sessionOrder)
              if (sessionsForThisGame.length === 0) return
              
              // Prendre la première session pour les temps (toutes ont les mêmes heures)
              const firstSessionOfGame = sessionsForThisGame[0]
              const sessionStart = new Date(firstSessionOfGame.start_datetime)
              const sessionEnd = new Date(firstSessionOfGame.end_datetime)
              const durationMs = sessionEnd.getTime() - sessionStart.getTime()
              const durationMinutes = Math.round(durationMs / (1000 * 60))
              durations.push(String(durationMinutes))
              
              // Calculer la pause "après" ce jeu en regardant l'écart avec le jeu suivant
              if (index < uniqueSessionOrders.length - 1) {
                const nextSessionOrder = uniqueSessionOrders[index + 1]
                const nextSessions = sessions.filter(s => s.session_order === nextSessionOrder)
                if (nextSessions.length > 0) {
                  const nextSessionStart = new Date(nextSessions[0].start_datetime)
                  const pauseMs = nextSessionStart.getTime() - sessionEnd.getTime()
                  const pauseMinutes = Math.round(pauseMs / (1000 * 60))
                  pauses.push(pauseMinutes)
                }
              }
              // Pas de pause après le dernier jeu
              
              // Collecter les room IDs pour ce jeu
              sessionsForThisGame.forEach(s => {
                if (s.laser_room_id) {
                  roomIds.push(s.laser_room_id)
                }
              })
            })
            
            setGameDurations(durations)
            setGamePauses(pauses)
            setLaserRoomIds(roomIds)
            
            // Mode allocation LASER reste toujours sur 'auto' par défaut
            // L'utilisateur peut le changer manuellement si besoin
            
            // Les pauses sont maintenant "après" chaque jeu, pas besoin de gapBetweenGames
          } else if (editingBooking.type === 'EVENT') {
            // EVENT : déterminer le plan de jeu depuis les sessions
            const sessions = editingBooking.game_sessions || []
            
            if (sessions.length >= 2) {
              // Déterminer si c'est un plan prédéfini (2 jeux) ou sur mesure
              if (sessions.length === 2) {
                // Plan prédéfini à 2 jeux
                setEventGamePlanType('2')
                
                const session1 = sessions[0]
                const session2 = sessions[1]
                const plan1 = session1.game_area === 'ACTIVE' ? 'A' : 'L'
                const plan2 = session2.game_area === 'ACTIVE' ? 'A' : 'L'
                const quickPlan = `${plan1}${plan2}` as EventQuickPlan
                setEventQuickPlan(quickPlan)
                setEventGamePlan(quickPlan as 'AA' | 'LL' | 'AL' | 'LA') // Pour compatibilité
                
                // Durées des sessions
                const session1Start = new Date(session1.start_datetime)
                const session1End = new Date(session1.end_datetime)
                const session1DurationMs = session1End.getTime() - session1Start.getTime()
                const session1DurationMinutes = Math.round(session1DurationMs / (1000 * 60))
                
                const session2Start = new Date(session2.start_datetime)
                const session2End = new Date(session2.end_datetime)
                const session2DurationMs = session2End.getTime() - session2Start.getTime()
                const session2DurationMinutes = Math.round(session2DurationMs / (1000 * 60))
                
                setEventGameDurations([String(session1DurationMinutes), String(session2DurationMinutes)])
                
                // Pause entre sessions
                const pauseMs = session2Start.getTime() - session1End.getTime()
                const pauseMinutes = Math.round(pauseMs / (1000 * 60))
                setEventGamePauses([pauseMinutes])
                
                // Durées pour compatibilité (ancien système)
                setEventSession1Duration(String(session1DurationMinutes))
                setEventSession2Duration(String(session2DurationMinutes))
                setEventPause(pauseMinutes)
              } else {
                // Plan sur mesure (plus de 2 jeux)
                setEventGamePlanType('CUSTOM')
                setEventCustomNumberOfGames(sessions.length)
                
                const areas: GameArea[] = []
                const durations: string[] = []
                const pauses: number[] = []
                const roomIds: string[] = []
                
                sessions.forEach((session, index) => {
                  areas.push(session.game_area || 'ACTIVE')
                  
                  const sessionStart = new Date(session.start_datetime)
                  const sessionEnd = new Date(session.end_datetime)
                  const durationMs = sessionEnd.getTime() - sessionStart.getTime()
                  const durationMinutes = Math.round(durationMs / (1000 * 60))
                  durations.push(String(durationMinutes))
                  
                  // Calculer la pause après ce jeu
                  if (index < sessions.length - 1) {
                    const nextSession = sessions[index + 1]
                    const nextSessionStart = new Date(nextSession.start_datetime)
                    const pauseMs = nextSessionStart.getTime() - sessionEnd.getTime()
                    const pauseMinutes = Math.round(pauseMs / (1000 * 60))
                    pauses.push(pauseMinutes)
                  }
                  
                  if (session.laser_room_id) {
                    roomIds.push(session.laser_room_id)
                  } else {
                    roomIds.push('')
                  }
                })
                
                setEventCustomGameArea(areas)
                setEventCustomGameDurations(durations)
                setEventCustomGamePauses(pauses)
                setEventCustomLaserRoomIds(roomIds)
              }
              
              // Initialiser l'heure de début du premier jeu
              if (sessions.length > 0) {
                const firstGameStart = new Date(sessions[0].start_datetime)
                setEventFirstGameStartHour(firstGameStart.getHours())
                setEventFirstGameStartMinute(firstGameStart.getMinutes())
              }
              
              // Verrouiller les données de l'événement par défaut
              setIsEditingEvent(false)
            }
          }
        } else {
          // Pas de game_sessions : comportement par défaut UNIQUEMENT pour nouvelle réservation
          // Si editingBooking existe, ne pas réinitialiser (c'est une réservation existante sans game_sessions)
          if (!editingBooking) {
            setGameArea(null) // Pas de zone sélectionnée par défaut pour nouvelle réservation
            setNumberOfGames(1) // Par défaut 1 jeu (ajusté selon gameArea)
            setGameDurations(['30'])
            setGamePauses([]) // Pas de pause par défaut
            setLaserRoomIds([])
            setEventGamePlan('AA')
            setEventSession1Duration('30')
            setEventSession2Duration('30')
            setEventPause(30)
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
              setIsEditingEvent(false) // Les données de l'événement doivent être gelées pour une réservation existante
              // Charger les notes du contact (notes_client fait partie du contact)
              setNotes(contact.notes_client || '')
              // Charger la langue préférée du contact
              setPreferredLocale(contact.preferred_locale || 'he')
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

        // Discount : charger les valeurs existantes
        setDiscountType((editingBooking as unknown as { discount_type?: string }).discount_type as 'percent' | 'fixed' | null || null)
        setDiscountValue((editingBooking as unknown as { discount_value?: number }).discount_value?.toString() || '')
      } else {
        // Mode création : réinitialiser le formulaire
        setLocalDate(selectedDate)
        setCalendarMonth(selectedDate.getMonth())
        setCalendarYear(selectedDate.getFullYear())
        
        // Pour EVENT : l'heure cliquée est l'heure de la salle, calculer l'heure du jeu à partir de celle-ci
        if (defaultBookingType === 'EVENT') {
          // Désactiver temporairement la synchronisation pendant l'initialisation
          skipSyncRef.current = true
          setRoomStartHour(initialHour)
          setRoomStartMinute(initialMinute)
          // Calculer l'heure du jeu = heure de la salle + 15 minutes
          const roomStartMinutes = initialHour * 60 + initialMinute
          const gameStartMinutes = roomStartMinutes + 15
          const gameHour = Math.floor(gameStartMinutes / 60)
          const gameMinute = gameStartMinutes % 60
          setHour(gameHour)
          setMinute(gameMinute)
          // Initialiser l'heure de début du premier jeu (pour les plans prédéfinis et sur mesure)
          setEventFirstGameStartHour(gameHour)
          setEventFirstGameStartMinute(gameMinute)
        } else {
          // Pour GAME : l'heure cliquée est l'heure du jeu
          setHour(initialHour)
          setMinute(initialMinute)
          setRoomStartHour(initialHour)
          setRoomStartMinute(initialMinute)
        }
        
        setParticipants('')
        setBookingType(defaultBookingType) // Utiliser le type par défaut selon où on clique
        // Réinitialiser gameArea selon defaultGameArea (ne pas mémoriser le dernier)
        if (defaultBookingType === 'GAME') {
          setGameArea(defaultGameArea || null)
        } else {
          setGameArea(null)
        }
        setEventAlias('')
        setEventNotes('')
        setNotes('')
        setContactId(generateContactId())
        // Initialiser la durée selon le type de jeu
        if (defaultBookingType === 'GAME' && defaultGameArea === 'LASER') {
          setDurationMinutes('30') // 30 min par défaut pour LASER
        } else {
          setDurationMinutes('60') // 60 min par défaut pour ACTIVE ou autres
        }
        setRoomDurationMinutes('120')
        // Initialiser les pauses pour les événements
        if (defaultBookingType === 'EVENT') {
          setEventGamePauses([30]) // Par défaut : 30 min de pause après le premier jeu
          setEventCustomGamePauses([0]) // Par défaut : 0 min de pause pour le plan sur mesure
        }
        setError(null)
        // CRM: Réinitialiser le contact et le mode édition pour une nouvelle réservation
        setSelectedContact(null)
        setIsEditingContact(false)
        setIsEditingEvent(false) // Réinitialiser le mode édition événement
        // Couleur par défaut selon le type
        setColor(defaultBookingType === 'GAME' ? COLORS[0].value : COLORS[1].value)
        // Réinitialiser le discount
        setDiscountType(null)
        setDiscountValue('')

        // Vérifier s'il y a des données de réactivation
        const reactivateDataStr = localStorage.getItem('booking-reactivate-data')
        if (reactivateDataStr) {
          try {
            const data = JSON.parse(reactivateDataStr)
            setParticipants(data.participants || '')
            setNumberOfGames(Number(data.numberOfGames) || 1)
            
            // Si un contactId est fourni, charger le contact existant
            if (data.contactId) {
              getContact(data.contactId).then((contact) => {
                if (contact) {
                  setSelectedContact(contact)
                  setFirstName(contact.first_name || '')
                  setLastName(contact.last_name || '')
                  setPhone(contact.phone || '')
                  setEmail(contact.email || '')
                  setNotes(contact.notes_client || '')
                  setPreferredLocale(contact.preferred_locale || 'he')
                  setIsEditingContact(false) // Champs gelés car contact importé
                } else {
                  // Fallback si le contact n'existe plus
                  setFirstName(data.firstName || '')
                  setLastName(data.lastName || '')
                  setPhone(data.phone || '')
                  setEmail(data.email || '')
                }
              })
            } else {
              // Pas de contactId, juste remplir les champs
              setFirstName(data.firstName || '')
              setLastName(data.lastName || '')
              setPhone(data.phone || '')
              setEmail(data.email || '')
            }
            // Ne pas supprimer les données tout de suite - on en aura besoin pour le submit
          } catch (e) {
            console.error('Error parsing reactivate data:', e)
            setFirstName('')
            setLastName('')
            setPhone('')
            setPhoneError(null)
            setEmail('')
          }
        } else {
          setFirstName('')
          setLastName('')
          setPhone('')
          setPhoneError(null)
          setEmail('')
        }
      }
    }
  }, [isOpen, selectedDate, initialHour, initialMinute, defaultBookingType, defaultGameArea, editingBooking])


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

  // monthNames est maintenant dynamique via getMonthName()

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

  // Changer la couleur automatiquement selon le type (uniquement lors de la création)
  // Changer la couleur automatiquement selon le type (création ET édition)
  useEffect(() => {
    const currentDefaultColor = bookingType === 'GAME' ? COLORS[0].value : COLORS[1].value
    const oppositeDefaultColor = bookingType === 'GAME' ? COLORS[1].value : COLORS[0].value

    // Changer automatiquement la couleur si :
    // 1. La couleur actuelle est une des couleurs par défaut (bleu ou vert)
    // 2. Elle correspond à la couleur opposée du type actuel
    // Cela fonctionne en mode création ET édition
    if (color === oppositeDefaultColor || color === currentDefaultColor) {
      // Si c'est la couleur opposée, changer vers la couleur par défaut du type actuel
      // Si c'est déjà la bonne couleur par défaut, ne rien faire
      if (color === oppositeDefaultColor) {
        setColor(currentDefaultColor)
      }
    }
    // Si la couleur est personnalisée (rouge, orange, etc.), ne pas la changer automatiquement
  }, [bookingType, color])

  // Vérifier l'état OUT initial de l'ordre quand le modal s'ouvre
  useEffect(() => {
    if (isOpen && editingBooking && orderId) {
      // Faire une requête pour vérifier l'état OUT de l'ordre
      fetch(`/api/orders/${orderId}/toggle-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkOnly: true })
      })
        .then(res => res.json())
        .then(data => {
          if (data.is_out) {
            setIsOrderOut(true)
          } else {
            setIsOrderOut(false)
          }
        })
        .catch(err => {
          console.error('Error checking OUT status:', err)
          setIsOrderOut(false)
        })
    } else {
      setIsOrderOut(false)
    }
  }, [isOpen, editingBooking, orderId])

  // Pour les EVENT : synchroniser automatiquement l'heure du jeu avec l'heure de la salle + 15 minutes
  // (l'heure de la salle est la source de vérité quand on clique sur une case de salle)
  // Ne pas synchroniser pendant l'initialisation pour éviter les conflits
  useEffect(() => {
    // Ne pas synchroniser si le flag est activé (pendant l'initialisation)
    if (skipSyncRef.current) {
      // Réinitialiser le flag après un court délai pour permettre la synchronisation future
      setTimeout(() => {
        skipSyncRef.current = false
      }, 100)
      return
    }
    
    if (bookingType === 'EVENT' && isOpen && !editingBooking) {
      // Calculer l'heure du jeu = heure de la salle + 15 minutes
      const roomStartMinutes = roomStartHour * 60 + roomStartMinute
      const gameStartMinutes = roomStartMinutes + 15
      const newGameHour = Math.floor(gameStartMinutes / 60)
      const newGameMinute = gameStartMinutes % 60
      
      // Mettre à jour seulement si différent (éviter les boucles infinies)
      if (hour !== newGameHour || minute !== newGameMinute) {
        setHour(newGameHour)
        setMinute(newGameMinute)
      }
    }
  }, [bookingType, roomStartHour, roomStartMinute, hour, minute, isOpen, editingBooking])

  // Calculer l'heure de début du premier jeu = heure de la salle + 15 minutes (pour EVENT)
  useEffect(() => {
    if (bookingType === 'EVENT') {
      const roomStartMinutes = roomStartHour * 60 + roomStartMinute
      const firstGameStartMinutes = roomStartMinutes + 15
      const newFirstGameHour = Math.floor(firstGameStartMinutes / 60)
      const newFirstGameMinute = firstGameStartMinutes % 60
      
      // Mettre à jour seulement si différent (éviter les boucles infinies)
      // Ne pas inclure eventFirstGameStartHour/Minute dans les dépendances pour éviter la boucle
      if (eventFirstGameStartHour !== newFirstGameHour || eventFirstGameStartMinute !== newFirstGameMinute) {
        setEventFirstGameStartHour(newFirstGameHour)
        setEventFirstGameStartMinute(newFirstGameMinute)
      }
    }
  }, [bookingType, roomStartHour, roomStartMinute])

  // Valider les disponibilités dans la nouvelle branche quand bookingBranchId change
  useEffect(() => {
    // Ne valider que si le modal est ouvert
    if (!isOpen || !bookingBranchId) {
      // Réinitialiser la référence quand le modal se ferme
      if (!isOpen) {
        prevBookingBranchIdRef.current = null
      }
      return
    }
    
    // Ne valider que si la branche a vraiment changé (pas au premier chargement)
    if (prevBookingBranchIdRef.current === bookingBranchId) return
    
    // Mettre à jour la référence AVANT la validation pour éviter les boucles
    const previousBranchId = prevBookingBranchIdRef.current
    prevBookingBranchIdRef.current = bookingBranchId
    
    // Ne pas valider au premier chargement (quand previousBranchId est null)
    if (previousBranchId === null) return
    
    // Attendre un peu pour laisser le temps au cache de se charger si nécessaire
    const timeoutId = setTimeout(() => {
      // Calculer parsedParticipants directement ici
      const currentParsedParticipants = parseInt(participants) || 0
      const currentParsedDuration = parseInt(durationMinutes) || 60
      const currentParsedRoomDuration = parseInt(roomDurationMinutes) || 120
      
      // Ne valider que si on a des données de réservation valides
      if (!currentParsedParticipants || currentParsedParticipants <= 0) return
      
      // Calculer les dates de la réservation
      const gameStartDate = new Date(localDate)
      gameStartDate.setHours(hour, minute, 0, 0)
      
      // Calculer l'heure de fin du jeu
      const startMinutes = hour * 60 + minute
      const endMinutes = startMinutes + currentParsedDuration
      const gameEndHour = Math.floor(endMinutes / 60)
      const gameEndMinute = endMinutes % 60
      const gameEndDate = new Date(localDate)
      gameEndDate.setHours(gameEndHour, gameEndMinute, 0, 0)
      
      // Pour les événements, utiliser les dates de la salle
      let startDateTime = gameStartDate
      let endDateTime = gameEndDate
      
      if (bookingType === 'EVENT') {
        const roomStartDate = new Date(localDate)
        roomStartDate.setHours(roomStartHour, roomStartMinute, 0, 0)
        
        // Calculer l'heure de fin de la salle
        const roomStartMinutes = roomStartHour * 60 + roomStartMinute
        const roomEndMinutes = roomStartMinutes + currentParsedRoomDuration
        const roomEndHour = Math.floor(roomEndMinutes / 60)
        const roomEndMinute = roomEndMinutes % 60
        const roomEndDate = new Date(localDate)
        roomEndDate.setHours(roomEndHour, roomEndMinute, 0, 0)
        
        // Prendre les dates les plus larges
        if (roomStartDate < gameStartDate) startDateTime = roomStartDate
        if (roomEndDate > gameEndDate) endDateTime = roomEndDate
      }
      
      // Vérifier l'overbooking dans la nouvelle branche
      // IMPORTANT: L'overbooking ne s'applique qu'aux sessions ACTIVE (pas LASER qui a sa propre logique de salles)
      const hasActiveContentForOB = bookingType === 'EVENT'
        ? eventQuickPlan.includes('A')
        : (gameArea === 'ACTIVE' || gameArea === 'CUSTOM' || gameArea === 'MIX')

      if (calculateOverbooking && hasActiveContentForOB) {
        let overbookingInfo = null
        let hasOverbooking = false

        if (bookingType === 'EVENT') {
          // Pour les événements, calculer les sessions ACTIVE et vérifier chacune individuellement
          const activeSessions = calculateActiveSessionsForEvent()

          // Vérifier chaque session ACTIVE individuellement (pas la durée totale)
          for (const session of activeSessions) {
            const sessionObInfo = calculateOverbooking(
              currentParsedParticipants,
              session.start,
              session.end,
              editingBooking?.id,
              bookingBranchId
            )

            if (sessionObInfo.willCauseOverbooking) {
              hasOverbooking = true
              // Garder l'info avec le plus grand overbooking
              if (!overbookingInfo || sessionObInfo.maxOverbookedCount > overbookingInfo.maxOverbookedCount) {
                overbookingInfo = sessionObInfo
              }
            }
          }
        } else {
          // Pour GAME ACTIVE/CUSTOM/MIX, vérifier l'overbooking
          overbookingInfo = calculateOverbooking(
            currentParsedParticipants,
            startDateTime,
            endDateTime,
            editingBooking?.id,
            bookingBranchId
          )
          hasOverbooking = overbookingInfo.willCauseOverbooking
        }

        if (hasOverbooking && overbookingInfo) {
          setOverbookingInfo(overbookingInfo)
          setShowOverbookingWarning(true)
        } else {
          // Réinitialiser si pas d'overbooking
          setOverbookingInfo(null)
          setShowOverbookingWarning(false)
        }
      } else if (!hasActiveContentForOB) {
        // Pas de contenu ACTIVE = pas d'overbooking à vérifier
        setOverbookingInfo(null)
        setShowOverbookingWarning(false)
      }
      
      // Pour les événements, vérifier la disponibilité des salles dans la nouvelle branche
      if (bookingType === 'EVENT' && findRoomAvailability) {
        // Pour les événements, utiliser les dates de la salle pour vérifier la disponibilité
        const roomStartDate = new Date(localDate)
        roomStartDate.setHours(roomStartHour, roomStartMinute, 0, 0)
        const { endHour: roomEndHour, endMinute: roomEndMinute } = calculateRoomEndTime()
        const roomEndDate = new Date(localDate)
        roomEndDate.setHours(roomEndHour, roomEndMinute, 0, 0)
        
        const roomAvailability = findRoomAvailability(
          currentParsedParticipants,
          roomStartDate,
          roomEndDate,
          editingBooking?.id,
          bookingBranchId // Passer la branche cible
        )
        
        if (!roomAvailability.bestRoomId && !roomAvailability.hasAnyAvailableRoom) {
          // Aucune salle disponible dans la nouvelle branche
          setShowNoRoomAvailable(true)
        } else if (!roomAvailability.bestRoomId && roomAvailability.availableRoomWithLowerCapacity) {
          // Salle disponible mais capacité insuffisante
          setLowerCapacityRoomInfo(roomAvailability.availableRoomWithLowerCapacity)
          setShowLowerCapacityRoom(true)
        } else {
          // Réinitialiser si tout est OK
          setShowNoRoomAvailable(false)
          setLowerCapacityRoomInfo(null)
          setShowLowerCapacityRoom(false)
        }
      }
    }, 300) // Délai pour laisser le cache se charger

    return () => clearTimeout(timeoutId)
  }, [bookingBranchId, bookingType, participants, hour, minute, localDate, roomStartHour, roomStartMinute, durationMinutes, roomDurationMinutes, isOpen, branchId, editingBooking?.id, calculateOverbooking, findRoomAvailability])

  // Générer les options d'heures
  const hourOptions = []
  for (let h = OPENING_HOUR; h < CLOSING_HOUR; h++) {
    hourOptions.push(h)
  }

  // Parser les valeurs
  const parsedParticipants = parseInt(participants) || 0
  const parsedDuration = parseInt(durationMinutes) || 60
  const parsedRoomDuration = parseInt(roomDurationMinutes) || 120 // Durée salle modifiable, par défaut 2 heures

  // Calcul du prix en temps réel
  const priceCalculation = useMemo(() => {
    if (parsedParticipants < 1) return null

    // Pour EVENT, le prix de la salle vient de la formule (formula.room_id -> icount_rooms)
    // On ne passe pas eventRoomId car booking.event_room_id pointe vers event_rooms (salles physiques)
    // alors que le calcul de prix utilise icount_rooms (configuration de prix)
    // La formule contient déjà le room_id vers la bonne table icount_rooms

    const result = calculateBookingPrice({
      bookingType,
      participants: parsedParticipants,
      // GAME params
      gameArea: gameArea as 'ACTIVE' | 'LASER' | 'CUSTOM' | null,
      numberOfGames,
      gameDurations,
      // GAME CUSTOM params
      customGameAreas: gameCustomGameArea as ('ACTIVE' | 'LASER')[],
      customGameDurations: gameCustomGameDurations,
      // EVENT params
      eventQuickPlan,
      eventRoomId: null, // Laisser le calcul utiliser formula.room_id
      // Discount
      discountType,
      discountValue,
      // Pricing data
      products,
      eventFormulas,
      rooms: pricingRooms,
    })
    console.log('[PRICE CALC]', { bookingType, parsedParticipants, gameArea, numberOfGames, products: products.length, result })
    return result
  }, [
    bookingType,
    parsedParticipants,
    gameArea,
    numberOfGames,
    gameDurations,
    gameCustomGameArea,
    gameCustomGameDurations,
    eventQuickPlan,
    discountType,
    discountValue,
    products,
    eventFormulas,
    pricingRooms,
  ])

  // Validation des participants EVENT - calculer les limites min/max
  const eventParticipantsValidation = useMemo(() => {
    if (bookingType !== 'EVENT' || eventFormulas.length === 0) {
      return { valid: true, minParticipants: 0, maxParticipants: Infinity }
    }

    const minParticipants = Math.min(...eventFormulas.map(f => f.min_participants))
    const maxParticipants = Math.max(...eventFormulas.map(f => f.max_participants))

    const valid = parsedParticipants >= minParticipants && parsedParticipants <= maxParticipants

    return {
      valid,
      minParticipants,
      maxParticipants,
      message: valid
        ? null
        : `Nombre de participants invalide. Minimum: ${minParticipants}, Maximum: ${maxParticipants}`
    }
  }, [bookingType, eventFormulas, parsedParticipants])

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
    // Gérer correctement les heures qui dépassent minuit (modulo 24)
    const endHour = Math.floor(endMinutes / 60) % 24
    const endMinute = endMinutes % 60
    return {
      endHour,
      endMinute
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

        // Normaliser les valeurs pour comparaison (null et "" sont équivalents)
        const normalize = (val: string | null | undefined) => (val || '').trim()

        // Si les infos ont été VRAIMENT modifiées, mettre à jour le contact
        const hasChanges =
          normalize(selectedContact.first_name) !== normalize(firstName) ||
          normalize(selectedContact.last_name) !== normalize(lastName) ||
          normalize(selectedContact.phone) !== normalize(phone) ||
          normalize(selectedContact.email) !== normalize(email) ||
          normalize(selectedContact.notes_client) !== normalize(notes) ||
          (selectedContact.preferred_locale || 'he') !== preferredLocale

        if (hasChanges) {
          const updated = await updateContact(selectedContact.id, {
            first_name: firstName.trim(),
            last_name: lastName.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            notes_client: notes.trim() || null,
            preferred_locale: preferredLocale,
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
            branch_id_main: bookingBranchId, // Utiliser la branche de la réservation
            first_name: firstName.trim(),
            last_name: lastName.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            notes_client: notes.trim() || null,
            source: 'admin_agenda',
            preferred_locale: preferredLocale,
          })
          
          if (newContact) {
            contactIdToLink = newContact.id
            setSelectedContact(newContact)
          }
        }
      } else {
        // skipDuplicateCheck = true : créer le contact malgré le doublon potentiel
        if (phone.trim()) {
          const newContact = await createContact({
            branch_id_main: bookingBranchId,
            first_name: firstName.trim(),
            last_name: lastName.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            notes_client: notes.trim() || null,
            source: 'admin_agenda',
            preferred_locale: preferredLocale,
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

      // Dates globales
      let startDate: Date
      let endDate: Date

      // Si événement, utiliser directement les dates de la salle (comme pour GAME qui utilise les dates du jeu)
      if (bookingType === 'EVENT') {
        const roomStartDate = new Date(localDate)
        roomStartDate.setHours(roomStartHour, roomStartMinute, 0, 0)

        // IMPORTANT : Calculer l'heure de fin en utilisant la durée fixe (parsedRoomDuration)
        // Exactement comme pour GAME : début + durée = fin
        const roomStartMinutes = roomStartHour * 60 + roomStartMinute
        const roomEndMinutes = roomStartMinutes + parsedRoomDuration
        const roomEndHour = Math.floor(roomEndMinutes / 60)
        const roomEndMinute = roomEndMinutes % 60
        
        const roomEndDate = new Date(localDate)
        roomEndDate.setHours(roomEndHour, roomEndMinute, 0, 0)

        // Pour EVENT, utiliser directement les dates de la salle (comme GAME utilise les dates du jeu)
        startDate = roomStartDate
        endDate = roomEndDate
      } else {
        // Pour GAME, utiliser les dates du jeu
        startDate = gameStartDate
        endDate = gameEndDate
      }

      // Notes : séparer notes client (globales) et notes réservation (spécifiques)
      const bookingNotes = bookingType === 'EVENT' 
        ? (eventAlias.trim() || eventNotes.trim()
            ? `Alias: ${eventAlias.trim() || 'N/A'}\n${eventNotes.trim()}`.trim() 
            : '')
        : notes.trim()

      // Générer les game_sessions selon le type de booking
      const game_sessions: CreateBookingData['game_sessions'] = []
      
      if (bookingType === 'GAME') {
        // GAME : créer des sessions selon game_area et nombre de jeux
        if (gameArea === 'ACTIVE') {
          // ACTIVE : créer des sessions pour chaque jeu
          // Utiliser la durée saisie par l'utilisateur
          let currentStart = new Date(gameStartDate)
          for (let i = 0; i < numberOfGames; i++) {
            // Si un seul jeu, utiliser durationMinutes, sinon utiliser gameDurations[i]
            const gameDuration = numberOfGames === 1 
              ? (parseInt(durationMinutes) || 60) 
              : (parseInt(gameDurations[i] || '30', 10))
            const sessionStart = new Date(currentStart)
            const sessionEnd = new Date(sessionStart)
            sessionEnd.setMinutes(sessionEnd.getMinutes() + gameDuration)
            
            // Pause après ce jeu (sauf pour le dernier)
            const pauseAfter = i < numberOfGames - 1 ? (gamePauses[i] || 0) : 0
            
            game_sessions.push({
              game_area: 'ACTIVE',
              start_datetime: sessionStart.toISOString(),
              end_datetime: sessionEnd.toISOString(),
              laser_room_id: null,
              session_order: i + 1,
              pause_before_minutes: 0 // Plus utilisé, mais gardé pour compatibilité
            })
            
            // Prochain jeu commence après la pause
            currentStart = new Date(sessionEnd)
            if (pauseAfter > 0) {
              currentStart.setMinutes(currentStart.getMinutes() + pauseAfter)
            }
          }
        } else if (gameArea === 'LASER') {
          // LASER : créer des sessions pour chaque jeu
          // Utiliser la durée saisie par l'utilisateur (par défaut 30 min)
          // Ne pas forcer l'alignement - garder l'heure exacte (x:15 ou x:45 peuvent rester)
          let currentStart = new Date(gameStartDate)
          
          for (let i = 0; i < numberOfGames; i++) {
            // Si un seul jeu, utiliser durationMinutes, sinon utiliser gameDurations[i]
            const gameDuration = numberOfGames === 1 
              ? (parseInt(durationMinutes) || 30) 
              : (parseInt(gameDurations[i] || '30', 10))
            const sessionStart = new Date(currentStart)
            // Ne pas forcer l'alignement - garder l'heure exacte
            
            const sessionEnd = new Date(sessionStart)
            sessionEnd.setMinutes(sessionEnd.getMinutes() + gameDuration)
            
            // Pause après ce jeu (sauf pour le dernier)
            const pauseAfter = i < numberOfGames - 1 ? (gamePauses[i] || 30) : 0
            
            // Trouver la meilleure salle laser pour cette session
            let allocatedRoomIds: string[] = []
            if (findBestLaserRoom) {
              const allocation = await findBestLaserRoom(parsedParticipants, sessionStart, sessionEnd, editingBooking?.id, bookingBranchId, laserAllocationMode)
              if (allocation) {
                allocatedRoomIds = allocation.roomIds
              } else {
                // AUCUNE SALLE DISPONIBLE : BLOQUER LA CRÉATION
                const timeStr = `${String(sessionStart.getHours()).padStart(2, '0')}:${String(sessionStart.getMinutes()).padStart(2, '0')}`
                const modeText = laserAllocationMode === 'petit' ? ' (Petit laby forcé)' :
                                laserAllocationMode === 'grand' ? ' (Grand laby forcé)' :
                                laserAllocationMode === 'maxi' ? ' (Maxi forcé)' : ''
                setError(t('admin.booking_modal.errors.no_laser_room', {
                  participants: parsedParticipants,
                  time: timeStr,
                  mode: modeText,
                  modeHint: laserAllocationMode !== 'auto' ? ', ou changer le mode d\'allocation' : ''
                }))
                return
              }
            }
            
            // Créer une session par salle (si L1+L2, créer 2 sessions)
            allocatedRoomIds.forEach((roomId, roomIndex) => {
              game_sessions.push({
                game_area: 'LASER',
                start_datetime: sessionStart.toISOString(),
                end_datetime: sessionEnd.toISOString(),
                laser_room_id: roomId,
                session_order: i + 1, // Ordre du jeu (1, 2, 3, etc.)
                pause_before_minutes: 0
              })
            })
            
            // Prochain jeu commence après la pause
            currentStart = new Date(sessionEnd)
            if (pauseAfter > 0) {
              currentStart.setMinutes(currentStart.getMinutes() + pauseAfter)
            }
          }
        } else if (gameArea === 'CUSTOM') {
          // CUSTOM (sur mesure) : créer des sessions selon gameCustomGameArea, gameCustomGameDurations, gameCustomGamePauses
          let currentStart = new Date(gameStartDate)
          for (let i = 0; i < gameCustomNumberOfGames; i++) {
            const customGameArea = gameCustomGameArea[i] || 'ACTIVE'
            const gameDuration = parseInt(gameCustomGameDurations[i] || '30', 10)
            const sessionStart = new Date(currentStart)
            const sessionEnd = new Date(sessionStart)
            sessionEnd.setMinutes(sessionEnd.getMinutes() + gameDuration)
            
            // Pause après ce jeu (sauf pour le dernier)
            const pauseAfter = i < gameCustomNumberOfGames - 1 ? (gameCustomGamePauses[i] || 0) : 0
            
            if (customGameArea === 'ACTIVE') {
              game_sessions.push({
                game_area: 'ACTIVE',
                start_datetime: sessionStart.toISOString(),
                end_datetime: sessionEnd.toISOString(),
                laser_room_id: null,
                session_order: i + 1,
                pause_before_minutes: 0
              })
            } else if (customGameArea === 'LASER') {
              // Pour LASER, ne pas forcer l'alignement - garder l'heure exacte (x:15 ou x:45 peuvent rester)
              sessionEnd.setTime(sessionStart.getTime() + gameDuration * 60000)
              
              // Trouver la meilleure salle laser pour cette session
              let allocatedRoomIds: string[] = []
              if (findBestLaserRoom) {
                const allocation = await findBestLaserRoom(parsedParticipants, sessionStart, sessionEnd, editingBooking?.id, bookingBranchId, laserAllocationMode)
                if (allocation) {
                  allocatedRoomIds = allocation.roomIds
                } else {
                  // AUCUNE SALLE DISPONIBLE : BLOQUER LA CRÉATION
                  const timeStr = `${String(sessionStart.getHours()).padStart(2, '0')}:${String(sessionStart.getMinutes()).padStart(2, '0')}`
                  const modeText = laserAllocationMode === 'petit' ? ' (Petit laby forcé)' :
                                  laserAllocationMode === 'grand' ? ' (Grand laby forcé)' :
                                  laserAllocationMode === 'maxi' ? ' (Maxi forcé)' : ''
                  setError(t('admin.booking_modal.errors.no_laser_room', {
                  participants: parsedParticipants,
                  time: timeStr,
                  mode: modeText,
                  modeHint: laserAllocationMode !== 'auto' ? ', ou changer le mode d\'allocation' : ''
                }))
                  return
                }
              }
              
              // Créer une session par salle (si L1+L2, créer 2 sessions)
              allocatedRoomIds.forEach((roomId) => {
                game_sessions.push({
                  game_area: 'LASER',
                  start_datetime: sessionStart.toISOString(),
                  end_datetime: sessionEnd.toISOString(),
                  laser_room_id: roomId,
                  session_order: i + 1,
                  pause_before_minutes: 0
                })
              })
            }
            
            // Prochain jeu commence après la pause
            currentStart = new Date(sessionEnd)
            if (pauseAfter > 0) {
              currentStart.setMinutes(currentStart.getMinutes() + pauseAfter)
              // Ne pas forcer l'alignement - garder l'heure exacte
            }
          }
        }
      } else if (bookingType === 'EVENT') {
        // EVENT : générer les sessions selon le plan de jeu (prédéfini ou sur mesure)
        const roomStartDate = new Date(localDate)
        roomStartDate.setHours(roomStartHour, roomStartMinute, 0, 0)
        
        // Premier jeu : commencer à eventFirstGameStartHour:eventFirstGameStartMinute
        // Cette heure est utilisée pour les plans prédéfinis ET sur mesure
        let currentStart = new Date(localDate)
        currentStart.setHours(eventFirstGameStartHour, eventFirstGameStartMinute, 0, 0)
        
        if (eventGamePlanType !== 'CUSTOM') {
          // Plan prédéfini : utiliser eventQuickPlan, eventGameDurations, eventGamePauses
          const areas = getQuickPlanAreas(eventQuickPlan)
          const gameCount = areas.length
          
          for (let i = 0; i < gameCount; i++) {
            const area = areas[i]
            const duration = parseInt(eventGameDurations[i] || '30', 10)
            
            // Si LASER, ne pas forcer l'alignement - garder l'heure exacte (x:15 ou x:45 peuvent rester)
            
            const sessionStart = new Date(currentStart)
            const sessionEnd = new Date(sessionStart)
            sessionEnd.setMinutes(sessionEnd.getMinutes() + duration)
            
            // Allocation Laser si nécessaire
            let allocatedRoomIds: string[] = []
            if (area === 'LASER') {
              if (findBestLaserRoom) {
                const allocation = await findBestLaserRoom(parsedParticipants, sessionStart, sessionEnd, editingBooking?.id, bookingBranchId, laserAllocationMode)
                if (allocation && allocation.roomIds.length > 0) {
                  allocatedRoomIds = allocation.roomIds
                } else {
                  // AUCUNE SALLE DISPONIBLE : BLOQUER LA CRÉATION
                  const timeStr = `${String(sessionStart.getHours()).padStart(2, '0')}:${String(sessionStart.getMinutes()).padStart(2, '0')}`
                  const modeText = laserAllocationMode === 'petit' ? ' (Petit laby forcé)' :
                                  laserAllocationMode === 'grand' ? ' (Grand laby forcé)' :
                                  laserAllocationMode === 'maxi' ? ' (Maxi forcé)' : ''
                  setError(t('admin.booking_modal.errors.no_laser_room', {
                  participants: parsedParticipants,
                  time: timeStr,
                  mode: modeText,
                  modeHint: laserAllocationMode !== 'auto' ? ', ou changer le mode d\'allocation' : ''
                }))
                  return
                }
              }
            }

            // Créer une session par salle laser allouée (si mode MAXI avec L1+L2, créer 2 sessions)
            if (area === 'LASER' && allocatedRoomIds.length > 0) {
              allocatedRoomIds.forEach((roomId) => {
                game_sessions.push({
                  game_area: area,
                  start_datetime: sessionStart.toISOString(),
                  end_datetime: sessionEnd.toISOString(),
                  laser_room_id: roomId,
                  session_order: i + 1,
                  pause_before_minutes: i === 0 ? 15 : (eventGamePauses[i - 1] ?? 0)
                })
              })
            } else {
              // Non-laser ou pas d'allocation
              game_sessions.push({
                game_area: area,
                start_datetime: sessionStart.toISOString(),
                end_datetime: sessionEnd.toISOString(),
                laser_room_id: null,
                session_order: i + 1,
                pause_before_minutes: i === 0 ? 15 : (eventGamePauses[i - 1] ?? 0)
              })
            }
            
            // Préparer le début du prochain jeu (après la pause)
            if (i < gameCount - 1) {
              currentStart = new Date(sessionEnd)
              currentStart.setMinutes(currentStart.getMinutes() + (eventGamePauses[i] ?? 0))
            }
          }
        } else {
          // Plan sur mesure : utiliser eventCustomGameArea, eventCustomGameDurations, eventCustomGamePauses
          const gameCount = eventCustomNumberOfGames
          
          for (let i = 0; i < gameCount; i++) {
            const area = eventCustomGameArea[i] || 'ACTIVE'
            const duration = parseInt(eventCustomGameDurations[i] || '30', 10)
            
            // Si LASER, ne pas forcer l'alignement - garder l'heure exacte (x:15 ou x:45 peuvent rester)
            
            const sessionStart = new Date(currentStart)
            const sessionEnd = new Date(sessionStart)
            sessionEnd.setMinutes(sessionEnd.getMinutes() + duration)
            
              // Allocation Laser si nécessaire
              let allocatedRoomIds: string[] = []
              if (area === 'LASER') {
                if (findBestLaserRoom) {
                  const allocation = await findBestLaserRoom(parsedParticipants, sessionStart, sessionEnd, editingBooking?.id, bookingBranchId, laserAllocationMode)
                  if (allocation && allocation.roomIds.length > 0) {
                    allocatedRoomIds = allocation.roomIds
                  } else {
                    // AUCUNE SALLE DISPONIBLE : BLOQUER LA CRÉATION
                    const timeStr = `${String(sessionStart.getHours()).padStart(2, '0')}:${String(sessionStart.getMinutes()).padStart(2, '0')}`
                  setError(t('admin.booking_modal.errors.no_laser_room_full', {
                    participants: parsedParticipants,
                    time: timeStr
                  }))
                    return
                  }
                }
              }

              // Créer une session par salle laser allouée (si mode MAXI avec L1+L2, créer 2 sessions)
              if (area === 'LASER' && allocatedRoomIds.length > 0) {
                allocatedRoomIds.forEach((roomId) => {
                  game_sessions.push({
                    game_area: area,
                    start_datetime: sessionStart.toISOString(),
                    end_datetime: sessionEnd.toISOString(),
                    laser_room_id: roomId,
                    session_order: i + 1,
                    pause_before_minutes: i === 0 ? 15 : (eventCustomGamePauses[i - 1] ?? 0)
                  })
                })
              } else {
                // Non-laser ou pas d'allocation
                game_sessions.push({
                  game_area: area,
                  start_datetime: sessionStart.toISOString(),
                  end_datetime: sessionEnd.toISOString(),
                  laser_room_id: null,
                  session_order: i + 1,
                  pause_before_minutes: i === 0 ? 15 : (eventCustomGamePauses[i - 1] ?? 0)
                })
              }
            
            // Préparer le début du prochain jeu (après la pause)
            if (i < gameCount - 1) {
              currentStart = new Date(sessionEnd)
              currentStart.setMinutes(currentStart.getMinutes() + (eventCustomGamePauses[i] ?? 0))
            }
          }
        }
      }

      // Construire les slots selon le type de booking
      const slots: CreateBookingData['slots'] = []
      
      if (bookingType === 'GAME') {
        // Pour GAME : un seul slot continu
        const slotStart = new Date(localDate)
        slotStart.setHours(hour, minute, 0, 0)

        const slotEnd = new Date(slotStart)
        slotEnd.setMinutes(slotEnd.getMinutes() + parsedDuration)

        slots.push({
          slot_start: slotStart.toISOString(),
          slot_end: slotEnd.toISOString(),
          participants_count: parsedParticipants
        })
      } else if (bookingType === 'EVENT') {
        // Pour EVENT : créer un slot uniquement pour chaque session ACTIVE (pas pendant les pauses)
        // Les pauses entre les jeux ne doivent pas bloquer les slots
        for (const session of game_sessions) {
          if (session.game_area === 'ACTIVE') {
            slots.push({
              slot_start: session.start_datetime,
              slot_end: session.end_datetime,
              participants_count: parsedParticipants
            })
          }
        }
      }

      // Vérifier s'il y a des données de réactivation
      let reactivateOrderId: string | undefined
      let reactivateReference: string | undefined
      const reactivateDataStr = localStorage.getItem('booking-reactivate-data')
      if (reactivateDataStr) {
        try {
          const reactivateData = JSON.parse(reactivateDataStr)
          if (reactivateData.isReactivate) {
            reactivateOrderId = reactivateData.orderId
            reactivateReference = reactivateData.reference
          }
        } catch (e) {
          console.error('Error parsing reactivate data:', e)
        }
      }

      const bookingData: CreateBookingData = {
        branch_id: bookingBranchId, // Utiliser la branche de la réservation (peut être modifiée)
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
        // Discount (remise)
        discount_type: discountType || undefined,
        discount_value: discountValue ? parseFloat(discountValue) : undefined,
        slots: slots.length > 0 ? slots : [],
        game_sessions: game_sessions.length > 0 ? game_sessions : [],
        // Données de réactivation si présentes
        reactivateOrderId,
        reactivateReference,
        // Langue préférée du contact pour les emails
        locale: preferredLocale
      }

      const success = await onSubmit(bookingData)

      // Nettoyer les données de réactivation après soumission
      if (reactivateDataStr) {
        localStorage.removeItem('booking-reactivate-data')
      }

      if (success) {
        // Si c'était une nouvelle réservation (pas d'édition), reset et fermer
        if (!editingBooking) {
          setFirstName('')
          setLastName('')
          setPhone('')
          setPhoneError(null)
          setEmail('')
          setNotes('')
          setEventNotes('')
          setParticipants('')
          setDurationMinutes('60')
          setSelectedContact(null)
          setIsEditingContact(false)
          onClose()
        } else {
          // Pour une édition, fermer automatiquement le modal après sauvegarde
          setIsEditingContact(false)
          setIsEditingEvent(false)
          onClose()
        }
      } else {
        setError(t('admin.booking_modal.errors.create_error'))
      }
    } catch (err) {
      console.error('Error creating booking:', err)
      setError(t('admin.booking_modal.errors.generic_error'))
    } finally {
      setLoading(false)
    }
  }

  // Soumettre le formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Bloquer la soumission si un avertissement d'overbooking est actif
    if (showOverbookingWarning && overbookingInfo) {
      // Le pop-up d'overbooking doit être confirmé avant de pouvoir soumettre
      return
    }

    // Validations
    if (!firstName.trim()) {
      setError(t('admin.booking_modal.validation.required_fields'))
      return
    }
    
    if (!phone.trim()) {
      setError(t('admin.booking_modal.validation.required_fields'))
      return
    }
    if (!validateIsraeliPhone(phone)) {
      setError(VALIDATION_MESSAGES.phone.israeliFormat)
      setPhoneError(VALIDATION_MESSAGES.phone.israeliFormat)
      return
    }
    if (parsedParticipants < 1) {
      setError(t('admin.booking_modal.validation.min_participants'))
      return
    }
    // Plus de limitation de capacité : le système d'overbooking gère les dépassements
    if (parsedDuration < 15) {
      setError(t('admin.booking_modal.validation.min_duration'))
      return
    }

    // Validation Laser : contrainte hard vests (skip si spare vests déjà autorisées)
    if (bookingType === 'GAME' && gameArea === 'LASER' && checkLaserVestsConstraint && !spareVestsAuthorized) {
      const gameStartDate = new Date(localDate)
      gameStartDate.setHours(hour, minute, 0, 0)
      const { endHour: gameEndHour, endMinute: gameEndMinute } = calculateGameEndTime()
      const gameEndDate = new Date(localDate)
      gameEndDate.setHours(gameEndHour, gameEndMinute, 0, 0)

      const vestsCheck = await checkLaserVestsConstraint(
        parsedParticipants,
        gameStartDate,
        gameEndDate,
        editingBooking?.id,
        bookingBranchId
      )

      if (vestsCheck.needsSpareVests) {
        // Afficher popup pour demander si spare vests disponibles
        setPendingSpareVestsData({
          currentUsage: vestsCheck.currentUsage,
          maxVests: vestsCheck.maxVests,
          spareVests: vestsCheck.spareVests,
          totalVests: vestsCheck.totalVests
        })
        setShowSpareVestsPopup(true)
        return // Interrompre la soumission jusqu'à confirmation
      }

      if (vestsCheck.isViolated) {
        setError(t('admin.booking_modal.errors.vests_constraint_spare', {
          current: vestsCheck.currentUsage + parsedParticipants,
          total: vestsCheck.totalVests,
          message: vestsCheck.message
        }))
        return
      }
    }

    // Validation Laser : contrainte hard vests pour GAME en mode sur mesure avec sessions Laser
    if (bookingType === 'GAME' && gameArea === 'CUSTOM' && checkLaserVestsConstraint) {
      const hasLaserSession = gameCustomGameArea.some(area => area === 'LASER')
      if (hasLaserSession) {
        const gameStartDate = new Date(localDate)
        gameStartDate.setHours(hour, minute, 0, 0)
        // Calculer la date de fin en additionnant toutes les durées et pauses
        let totalMinutes = 0
        for (let i = 0; i < gameCustomNumberOfGames; i++) {
          totalMinutes += parseInt(gameCustomGameDurations[i] || '30', 10)
          if (i < gameCustomNumberOfGames - 1) {
            totalMinutes += gameCustomGamePauses[i] || 0
          }
        }
        const gameEndDate = new Date(gameStartDate)
        gameEndDate.setMinutes(gameEndDate.getMinutes() + totalMinutes)

        const vestsCheck = await checkLaserVestsConstraint(
          parsedParticipants,
          gameStartDate,
          gameEndDate,
          editingBooking?.id,
          bookingBranchId
        )

        if (vestsCheck.isViolated) {
          setError(t('admin.booking_modal.errors.vests_constraint_hard', {
            current: vestsCheck.currentUsage + parsedParticipants,
            max: vestsCheck.maxVests,
            message: vestsCheck.message
          }))
          return
        }
      }
    }

    // Validation Laser : contrainte hard vests pour EVENT avec sessions Laser
    // Vérifier chaque session LASER individuellement (pas la durée totale de la salle)
    // IMPORTANT : Toujours exclure editingBooking?.id pour éviter de compter la réservation en cours de modification
    if (bookingType === 'EVENT' && checkLaserVestsConstraint) {
      // Calculer les sessions LASER qui seront créées
      const laserSessions: Array<{ start: Date; end: Date }> = []
      
      if (eventGamePlanType !== 'CUSTOM') {
        // Plan prédéfini : calculer les sessions selon le plan
        const areas = getQuickPlanAreas(eventQuickPlan)
        let currentStart = new Date(localDate)
        currentStart.setHours(eventFirstGameStartHour, eventFirstGameStartMinute, 0, 0)
        
        for (let i = 0; i < areas.length; i++) {
          if (areas[i] === 'LASER') {
            const duration = parseInt(eventGameDurations[i] || '30', 10)
            const sessionStart = new Date(currentStart)
            const sessionEnd = new Date(sessionStart)
            sessionEnd.setMinutes(sessionEnd.getMinutes() + duration)
            laserSessions.push({ start: sessionStart, end: sessionEnd })
          }
          
          // Préparer le début du prochain jeu
          if (i < areas.length - 1) {
            const duration = parseInt(eventGameDurations[i] || '30', 10)
            currentStart = new Date(currentStart)
            currentStart.setMinutes(currentStart.getMinutes() + duration + (eventGamePauses[i] ?? 0))
          }
        }
      } else {
        // Plan sur mesure : calculer les sessions selon la configuration
        let currentStart = new Date(localDate)
        currentStart.setHours(eventFirstGameStartHour, eventFirstGameStartMinute, 0, 0)
        
        for (let i = 0; i < eventCustomNumberOfGames; i++) {
          if (eventCustomGameArea[i] === 'LASER') {
            const duration = parseInt(eventCustomGameDurations[i] || '30', 10)
            const sessionStart = new Date(currentStart)
            const sessionEnd = new Date(sessionStart)
            sessionEnd.setMinutes(sessionEnd.getMinutes() + duration)
            laserSessions.push({ start: sessionStart, end: sessionEnd })
          }
          
          // Préparer le début du prochain jeu
          if (i < eventCustomNumberOfGames - 1) {
            const duration = parseInt(eventCustomGameDurations[i] || '30', 10)
            currentStart = new Date(currentStart)
            currentStart.setMinutes(currentStart.getMinutes() + duration + (eventCustomGamePauses[i] ?? 0))
          }
        }
      }
      
      // Vérifier chaque session LASER individuellement
      // IMPORTANT : Pour chaque session, vérifier la contrainte en excluant la réservation en cours de modification
      // Si on modifie un événement, editingBooking?.id doit être défini pour exclure toutes ses sessions
      const excludeBookingId = editingBooking?.id || undefined
      
      for (const session of laserSessions) {
        const vestsCheck = await checkLaserVestsConstraint(
          parsedParticipants,
          session.start,
          session.end,
          excludeBookingId, // Exclure la réservation en cours de modification (toutes ses sessions)
          bookingBranchId
        )

        if (vestsCheck.isViolated) {
          setError(t('admin.booking_modal.errors.vests_constraint_hard', {
            current: vestsCheck.currentUsage + parsedParticipants,
            max: vestsCheck.maxVests,
            message: vestsCheck.message
          }))
          return
        }
      }
    }

    // Si événement, vérifier la salle
    let eventRoomId: string | null | undefined = editingBooking?.event_room_id || null
    
    if (bookingType === 'EVENT' && findRoomAvailability) {
      const roomStartDate = new Date(localDate)
      roomStartDate.setHours(roomStartHour, roomStartMinute, 0, 0)

      const { endHour: roomEndHour, endMinute: roomEndMinute } = calculateRoomEndTime()
      const roomEndDate = new Date(localDate)
      roomEndDate.setHours(roomEndHour, roomEndMinute, 0, 0)

      // Exclure le booking en cours de modification pour qu'il ne se bloque pas lui-même
      const roomAvailability = findRoomAvailability(parsedParticipants, roomStartDate, roomEndDate, editingBooking?.id, bookingBranchId)
      
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
        setError(t('admin.booking_modal.errors.no_room_for_quantity'))
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
      const bestRoomId = findBestAvailableRoom(parsedParticipants, roomStartDate, roomEndDate, editingBooking?.id, bookingBranchId)
      
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

    // Vérifier l'overbooking avant de soumettre
    // IMPORTANT: L'overbooking ne s'applique qu'aux sessions ACTIVE (pas LASER qui a sa propre logique de salles)
    const hasActiveContent = bookingType === 'EVENT'
      ? eventQuickPlan.includes('A') // EVENT avec sessions ACTIVE
      : (gameArea === 'ACTIVE' || gameArea === 'CUSTOM' || gameArea === 'MIX') // GAME avec zone ACTIVE

    if (calculateOverbooking && hasActiveContent) {
      let obInfo = null

      if (bookingType === 'EVENT') {
        // Pour les événements, vérifier chaque session ACTIVE individuellement
        const activeSessions = calculateActiveSessionsForEvent()
        let maxOverbooking = null

        for (const session of activeSessions) {
          const sessionObInfo = calculateOverbooking(
            parsedParticipants,
            session.start,
            session.end,
            editingBooking?.id,
            bookingBranchId
          )

          if (sessionObInfo.willCauseOverbooking) {
            // Garder l'info avec le plus grand overbooking
            if (!maxOverbooking || sessionObInfo.maxOverbookedCount > maxOverbooking.maxOverbookedCount) {
              maxOverbooking = sessionObInfo
            }
          }
        }

        obInfo = maxOverbooking || {
          willCauseOverbooking: false,
          maxOverbookedCount: 0,
          maxOverbookedSlots: 0,
          affectedTimeSlots: []
        }
      } else {
        // Pour GAME ACTIVE/CUSTOM/MIX, vérifier l'overbooking
        const gameStartDate = new Date(localDate)
        gameStartDate.setHours(hour || 10, minute || 0, 0, 0)

        const { endHour: gameEndHour, endMinute: gameEndMinute } = calculateGameEndTime()
        const gameEndDate = new Date(localDate)
        gameEndDate.setHours(gameEndHour, gameEndMinute, 0, 0)

        obInfo = calculateOverbooking(
          parsedParticipants,
          gameStartDate,
          gameEndDate,
          editingBooking?.id,
          bookingBranchId
        )
      }

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

    // Vérifier l'overbooking seulement si contenu ACTIVE
    const hasActiveContent = bookingType === 'EVENT'
      ? eventQuickPlan.includes('A')
      : (gameArea === 'ACTIVE' || gameArea === 'CUSTOM' || gameArea === 'MIX')

    // Après avoir confirmé la salle, vérifier l'overbooking avant de soumettre
    if (calculateOverbooking && hasActiveContent) {
      const gameStartDate = new Date(localDate)
      gameStartDate.setHours(hour || 10, minute || 0, 0, 0)

      const { endHour: gameEndHour, endMinute: gameEndMinute } = calculateGameEndTime()
      const gameEndDate = new Date(localDate)
      gameEndDate.setHours(gameEndHour, gameEndMinute, 0, 0)

      const obInfo = calculateOverbooking(
        parsedParticipants,
        gameStartDate,
        gameEndDate,
        editingBooking?.id,
        bookingBranchId
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
    setError(t('admin.booking_modal.errors.booking_cancelled'))
    setPendingRoomId(null)
  }

  const handleLowerCapacityRoomConfirm = async () => {
    if (lowerCapacityRoomInfo) {
      const confirmedRoomId = lowerCapacityRoomInfo.id
      setShowLowerCapacityRoom(false)
      setLowerCapacityRoomInfo(null)

      // Vérifier l'overbooking seulement si contenu ACTIVE
      const hasActiveContent = bookingType === 'EVENT'
        ? eventQuickPlan.includes('A')
        : (gameArea === 'ACTIVE' || gameArea === 'CUSTOM' || gameArea === 'MIX')

      // Après avoir confirmé la salle, vérifier l'overbooking avant de soumettre
      if (calculateOverbooking && hasActiveContent) {
        const gameStartDate = new Date(localDate)
        gameStartDate.setHours(hour || 10, minute || 0, 0, 0)

        const { endHour: gameEndHour, endMinute: gameEndMinute } = calculateGameEndTime()
        const gameEndDate = new Date(localDate)
        gameEndDate.setHours(gameEndHour, gameEndMinute, 0, 0)

        const obInfo = calculateOverbooking(
          parsedParticipants,
          gameStartDate,
          gameEndDate,
          editingBooking?.id,
          bookingBranchId
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
    setError(t('admin.booking_modal.errors.no_room_for_participants', { participants: parsedParticipants }))
    setLowerCapacityRoomInfo(null)
  }

  const handleNoRoomAvailableClose = () => {
    setShowNoRoomAvailable(false)
    setError(t('admin.booking_modal.errors.no_room_for_participants', { participants: parsedParticipants }))
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
    setError(t('admin.booking_modal.errors.booking_cancelled'))
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
        setError(t('admin.booking_modal.delete_error'))
        setShowDeleteConfirm(false)
      }
    } catch (err) {
      console.error('Error deleting booking:', err)
      setError(t('admin.booking_modal.delete_error'))
      setShowDeleteConfirm(false)
    } finally {
      setLoading(false)
    }
  }

  // Ref pour le formulaire
  const formRef = useRef<HTMLFormElement>(null)

  // Handler simple pour la touche Entrée - soumet directement
  const handleEnterKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      // Si on est dans un textarea, laisser le comportement par défaut (sauf Ctrl+Enter)
      if (e.target instanceof HTMLTextAreaElement) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          const fakeEvent = { preventDefault: () => {} } as React.FormEvent
          handleSubmit(fakeEvent)
        }
        return
      }
      
      // Pour tous les autres inputs, soumettre directement
      e.preventDefault()
      e.stopPropagation()
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent
      handleSubmit(fakeEvent)
    }
  }

  // Wrapper pour ContactFieldAutocomplete qui attend () => void
  const handleEnterKeyWrapper = () => {
    if (!loading) {
      const fakeEvent = { preventDefault: () => {}, stopPropagation: () => {} } as React.FormEvent
      handleSubmit(fakeEvent)
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
              {editingBooking ? t('admin.booking_modal.title_edit') : t('admin.booking_modal.title_new')}
            </h2>
            <div className="flex items-center gap-6 mt-1">
              {/* Date - complètement à gauche */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCalendarModal(!showCalendarModal)}
                  className={`text-sm font-medium ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} flex items-center gap-1 cursor-pointer transition-colors`}
                >
                  <Calendar className="w-4 h-4" />
                  {localDate.toLocaleDateString(getDateLocale(), {
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
                        title={t('admin.booking_modal.calendar.previous_year')}
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
                        title={t('admin.booking_modal.calendar.previous_month')}
                      >
                        <ChevronLeft className={`w-4 h-4 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                      </button>
                      <div className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'} px-4`}>
                        {getMonthName(calendarMonth)} {calendarYear}
                      </div>
                      <button
                        type="button"
                        onClick={handleNextMonth}
                        className={`p-1 ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} rounded hover:opacity-80 transition-all`}
                        title={t('admin.booking_modal.calendar.next_month')}
                      >
                        <ChevronRight className={`w-4 h-4 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextYear}
                        className={`p-1 ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} rounded hover:opacity-80 transition-all`}
                        title={t('admin.booking_modal.calendar.next_year')}
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
                      {getDaysShort().map((day, i) => (
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
              
              {/* Branche - au milieu avec espacement */}
              <div ref={branchDropdownRef} className="relative">
                {editingBooking && !isEditingBranch ? (
                  // Mode gelé pour réservation existante : afficher la branche avec bouton modification
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                      {branches.find(b => b.id === bookingBranchId)?.name || t('admin.booking_modal.branch')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingBranch(true)}
                      className={`p-1 rounded ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                      title={t('admin.booking_modal.edit_branch')}
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  // Mode édition ou nouvelle réservation : dropdown actif
                  <>
                    <button
                      type="button"
                      onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                        isDark
                          ? 'bg-gray-800 hover:bg-gray-700 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                      }`}
                      title={t('admin.booking_modal.edit_branch')}
                    >
                      <Building2 className={`w-4 h-4 ${
                        isDark ? 'text-blue-400' : 'text-blue-600'
                      }`} />
                      <span>{branches.find(b => b.id === bookingBranchId)?.name || t('admin.booking_modal.common.branch')}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      } ${showBranchDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showBranchDropdown && branches.length > 0 && (
                  <div className={`absolute top-full left-0 mt-2 w-56 rounded-lg shadow-xl z-50 overflow-hidden ${
                    isDark
                      ? 'bg-gray-800 border border-gray-700'
                      : 'bg-white border border-gray-200'
                  }`}>
                    {branches.filter((branch, index, self) => 
                      index === self.findIndex(b => b.id === branch.id)
                    ).map((branch) => (
                      <button
                        key={branch.id}
                        type="button"
                        onClick={() => {
                          // Changer la branche - cela déclenchera la validation dans le useEffect
                          setBookingBranchId(branch.id)
                          setShowBranchDropdown(false)
                          // Réinitialiser les états d'avertissement pour forcer la re-vérification
                          setShowOverbookingWarning(false)
                          setOverbookingInfo(null)
                          setShowNoRoomAvailable(false)
                          setShowLowerCapacityRoom(false)
                        }}
                        className={`w-full px-4 py-2.5 text-left transition-colors text-sm ${
                          bookingBranchId === branch.id
                            ? isDark
                              ? 'bg-blue-600/20 text-blue-400'
                              : 'bg-blue-100 text-blue-700'
                            : isDark
                            ? 'text-white hover:bg-gray-700'
                            : 'text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <div className="font-medium">{branch.name}</div>
                      </button>
                    ))}
                  </div>
                    )}
                  </>
                )}
              </div>

              {/* Bouton invisible OUT - seulement en mode édition */}
              {editingBooking && orderId && (
                <button
                  type="button"
                  onClick={async () => {
                    // Ne rien faire si déjà OUT
                    if (isOrderOut) return

                    try {
                      const response = await fetch(`/api/orders/${orderId}/toggle-out`, {
                        method: 'POST',
                      })

                      if (!response.ok) {
                        throw new Error('Failed to toggle OUT status')
                      }

                      const data = await response.json()

                      // Si le toggle a réussi et que l'ordre est maintenant OUT
                      if (data.is_out) {
                        setIsOrderOut(true)
                        console.log('OUT status: ON')
                      }
                    } catch (error) {
                      console.error('Error toggling OUT:', error)
                    }
                  }}
                  disabled={isOrderOut}
                  className="opacity-0 w-8 h-8 ml-2"
                  aria-label="Toggle OUT status"
                />
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Icônes d'accès rapide - visibles uniquement en mode édition avec orderId */}
            {editingBooking && orderId && (
              <div className="flex items-center gap-1 mr-2">
                {/* Fiche Commande */}
                {onViewOrder && (
                  <button
                    type="button"
                    onClick={() => onViewOrder(orderId)}
                    className={`p-2.5 rounded-lg transition-colors ${
                      isDark
                        ? 'hover:bg-blue-600/30 text-blue-400'
                        : 'hover:bg-blue-100 text-blue-600'
                    }`}
                    title={t('admin.booking_modal.actions.view_order')}
                  >
                    <FileText className="w-6 h-6" />
                  </button>
                )}
                {/* Fiche Comptable */}
                {onOpenAccounting && (
                  <button
                    type="button"
                    onClick={() => onOpenAccounting(orderId)}
                    className={`p-2.5 rounded-lg transition-colors ${
                      isDark
                        ? 'hover:bg-cyan-600/30 text-cyan-400'
                        : 'hover:bg-cyan-100 text-cyan-600'
                    }`}
                    title={t('admin.accounting.title')}
                  >
                    <Receipt className="w-6 h-6" />
                  </button>
                )}
                {/* Clôturer la commande */}
                {onCloseOrder && orderId && orderStatus !== 'closed' && orderStatus !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => onCloseOrder(orderId)}
                    className={`p-2.5 rounded-lg transition-colors ${
                      isDark
                        ? 'hover:bg-green-600/30 text-green-400'
                        : 'hover:bg-green-100 text-green-600'
                    }`}
                    title={t('admin.orders.close_order')}
                  >
                    <CheckCheck className="w-6 h-6" />
                  </button>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Avertissement commande fermée */}
          {orderStatus === 'closed' && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/20 border border-amber-500/30">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {t('admin.errors.orderClosed')}
              </p>
            </div>
          )}

          {/* Reference Code / Numéro de commande */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('admin.booking_modal.order_number')}
            </label>
            <div className={`px-3 py-2 rounded-lg border text-sm font-mono ${
              isDark
                ? 'bg-gray-700/50 border-gray-600 text-gray-300'
                : 'bg-gray-100 border-gray-300 text-gray-700'
            }`}>
              {editingBooking?.reference_code || t('admin.booking_modal.creating')}
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {editingBooking ? t('admin.booking_modal.order_number_help_edit') : t('admin.booking_modal.order_number_help_new')}
            </p>
          </div>

          {/* Type de réservation + Couleur */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('admin.booking_modal.type_label')}
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
                  {t('admin.booking_modal.types.game')}
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
                  {t('admin.booking_modal.types.event')}
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
                    title={t(c.nameKey)}
                  />
                ))}
              </div>
            </div>

            {/* Remise (Discount) */}
          </div>

          {/* EVENT : Salle d'événement - EN PREMIER (définit l'heure de début) */}
          {bookingType === 'EVENT' && (
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Home className="w-5 h-5 text-green-400" />
                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('admin.booking_modal.event.room_title')}</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('admin.booking_modal.event.room_start')}
                  </label>
                  <div className="flex gap-1">
                    <select
                      value={roomStartHour}
                      onChange={(e) => setRoomStartHour(parseInt(e.target.value))}
                      className={`admin-time-select flex-1 px-2 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-400 ${
                        isDark
                          ? 'bg-gray-800 border-gray-600 text-white focus:bg-gray-800 hover:bg-gray-800'
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
                          ? 'bg-gray-800 border-gray-600 text-white focus:bg-gray-800 hover:bg-gray-800'
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
                    {t('admin.booking_modal.fields.duration_min')}
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
                    {t('admin.booking_modal.event.room_end')}
                  </label>
                  <div className={`px-2 py-2 rounded-lg border text-sm ${
                    isDark ? 'bg-gray-700/50 border-gray-600 text-gray-400' : 'bg-gray-100 border-gray-300 text-gray-600'
                  }`}>
                    {String(roomEndHour).padStart(2, '0')}:{String(roomEndMinute).padStart(2, '0')}
                  </div>
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('admin.booking_modal.fields.participants')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    onKeyDown={handleEnterKey}
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
              
              {/* Alias et Notes de l'événement */}
              <div className="mt-3 grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <User className="w-3 h-3 inline mr-1" />
                    {t('admin.booking_modal.fields.alias')}
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
                    placeholder={t('admin.booking_modal.fields.alias_placeholder')}
                  />
                </div>
                <div className="col-span-3">
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <MessageSquare className="w-3 h-3 inline mr-1" />
                    {t('admin.booking_modal.event.event_notes')}
                  </label>
                  <textarea
                    value={eventNotes}
                    onChange={(e) => {
                      setEventNotes(e.target.value)
                      const textarea = e.target as HTMLTextAreaElement
                      textarea.style.height = 'auto'
                      const maxHeight = 5 * 24
                      const newHeight = Math.min(textarea.scrollHeight, maxHeight)
                      textarea.style.height = `${newHeight}px`
                    }}
                    rows={2}
                    className={`w-full px-3 py-2 rounded-lg border resize-none text-sm overflow-y-auto ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                    placeholder={t('admin.booking_modal.event.event_notes_placeholder')}
                    style={{ minHeight: '48px', maxHeight: '120px' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* EVENT : Plan de jeu - ENSUITE */}
          {bookingType === 'EVENT' && laserRooms.length > 0 && (
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PartyPopper className="w-5 h-5 text-green-400" />
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('admin.booking_modal.event.game_plan')}</span>
                </div>
                {/* Bouton Modifier événement (uniquement en mode édition) */}
                {editingBooking && !isEditingEvent && (
                  <button
                    type="button"
                    onClick={handleModifyEvent}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-2 ${
                      isDark
                        ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/50'
                        : 'bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300'
                    }`}
                  >
                    <Edit2 className="w-3 h-3" />
                    {t('admin.booking_modal.event.modify_event')}
                  </button>
                )}
              </div>
              
              {/* Variable pour désactiver les champs si l'événement est verrouillé */}
              {(() => {
                const isEventLocked = editingBooking && !isEditingEvent
                return (
                  <div className={isEventLocked ? 'opacity-60 pointer-events-none' : ''}>
              
              {/* Sélection du nombre de jeux (2 jeux ou sur mesure) */}
              <div className="mb-4">
                <label className={`block text-xs mb-2 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('admin.booking_modal.event.game_plan')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['2', 'CUSTOM'] as EventGamePlanType[]).map(planType => (
                    <button
                      key={planType}
                      type="button"
                      onClick={() => {
                        setEventGamePlanType(planType)
                        if (planType !== 'CUSTOM') {
                          const count = parseInt(planType)
                          // Initialiser les durées et pauses selon le nombre de jeux
                          const defaultDurations = Array(count).fill('30')
                          const defaultPauses = Array(count - 1).fill(30) // Pauses après chaque jeu (sauf le dernier)
                          setEventGameDurations(defaultDurations)
                          setEventGamePauses(defaultPauses)
                          // Sélectionner le premier plan prédéfini disponible
                          const availablePlans = getAvailableQuickPlans(planType)
                          if (availablePlans.length > 0) {
                            setEventQuickPlan(availablePlans[0])
                            // Réinitialiser les pauses selon le nouveau plan
                            const areas = getQuickPlanAreas(availablePlans[0])
                            const newPauses = Array(areas.length - 1).fill(30)
                            setEventGamePauses(newPauses)
                          }
                        }
                      }}
                      className={`p-2 rounded-lg border-2 transition-all text-sm ${
                        eventGamePlanType === planType
                          ? 'border-green-500 bg-green-500/10 text-green-500'
                          : isDark ? 'border-gray-700 hover:border-gray-600 text-gray-300' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {planType === 'CUSTOM' ? t('admin.booking_modal.event.custom_plan') : `${planType} ${t('admin.booking_modal.fields.games')}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plans prédéfinis (si pas sur mesure) */}
              {eventGamePlanType !== 'CUSTOM' && (
                <div className="mb-4">
                  <label className={`block text-xs mb-2 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('admin.booking_modal.event.predefined_plan')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {getAvailableQuickPlans(eventGamePlanType).map(plan => (
                      <button
                        key={plan}
                        type="button"
                        onClick={() => {
                          setEventQuickPlan(plan)
                          // Réinitialiser les pauses selon le nouveau plan
                          const areas = getQuickPlanAreas(plan)
                          const newPauses = Array(areas.length - 1).fill(30)
                          setEventGamePauses(newPauses)
                        }}
                        className={`p-2 rounded-lg border-2 transition-all text-xs ${
                          eventQuickPlan === plan
                            ? 'border-green-500 bg-green-500/10 text-green-500'
                            : isDark ? 'border-gray-700 hover:border-gray-600 text-gray-300' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        {getQuickPlanLabel(plan)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Configuration des sessions selon le plan */}
              {eventGamePlanType !== 'CUSTOM' ? (
                // Plan prédéfini : afficher configuration pour chaque jeu
                <div className="space-y-3">
                  <div className="mb-3">
                    <label className={`block text-xs mb-2 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {t('admin.booking_modal.event.first_game_start')}
                    </label>
                    <div className="flex gap-1 w-fit">
                      <select
                        value={eventFirstGameStartHour}
                        onChange={(e) => setEventFirstGameStartHour(parseInt(e.target.value))}
                        className={`admin-time-select w-20 px-2 py-1.5 rounded-lg border text-sm ${
                          isDark
                            ? 'bg-gray-800 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      >
                        {hourOptions.map(h => (
                          <option key={h} value={h}>{String(h).padStart(2, '0')}h</option>
                        ))}
                      </select>
                      <select
                        value={eventFirstGameStartMinute}
                        onChange={(e) => setEventFirstGameStartMinute(parseInt(e.target.value))}
                        className={`admin-time-select w-20 px-2 py-1.5 rounded-lg border text-sm ${
                          isDark
                            ? 'bg-gray-800 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      >
                        {[0, 15, 30, 45].map(m => (
                          <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  {getQuickPlanAreas(eventQuickPlan).map((area, index) => {
                    const gameNumber = index + 1
                    return (
                      <div key={index} className={`p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {t('admin.booking_modal.fields.game_number')} {gameNumber} ({area === 'ACTIVE' ? t('admin.booking_modal.zones.active') : t('admin.booking_modal.zones.laser')})
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {t('admin.booking_modal.common.duration_min')}
                            </label>
                            <input
                              type="number"
                              min="15"
                              step="15"
                              value={eventGameDurations[index] || '30'}
                              onChange={(e) => {
                                const newDurations = [...eventGameDurations]
                                newDurations[index] = e.target.value
                                setEventGameDurations(newDurations)
                              }}
                              className={`w-full px-2 py-1 rounded border text-sm ${
                                isDark
                                  ? 'bg-gray-700 border-gray-600 text-white'
                                  : 'bg-white border-gray-300 text-gray-900'
                              }`}
                              placeholder={area === 'LASER' ? '30' : '30'}
                            />
                          </div>
                          {index < getQuickPlanAreas(eventQuickPlan).length - 1 && (
                            <div>
                              <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {t('admin.booking_modal.event.pause_after')}
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="15"
                                value={eventGamePauses[index] ?? 30}
                                onChange={(e) => {
                                  const newPauses = [...eventGamePauses]
                                  const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                                  newPauses[index] = isNaN(value) ? 0 : value
                                  setEventGamePauses(newPauses)
                                }}
                                className={`w-full px-2 py-1 rounded border text-sm ${
                                  isDark
                                    ? 'bg-gray-700 border-gray-600 text-white'
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                // Plan sur mesure : même interface que GAME
                <div className="space-y-3">
                  <div className="mb-3">
                    <label className={`block text-xs mb-2 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {t('admin.booking_modal.event.first_game_start')}
                    </label>
                    <div className="flex gap-1 w-fit">
                      <select
                        value={eventFirstGameStartHour}
                        onChange={(e) => setEventFirstGameStartHour(parseInt(e.target.value))}
                        className={`admin-time-select w-20 px-2 py-1.5 rounded-lg border text-sm ${
                          isDark
                            ? 'bg-gray-800 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      >
                        {hourOptions.map(h => (
                          <option key={h} value={h}>{String(h).padStart(2, '0')}h</option>
                        ))}
                      </select>
                      <select
                        value={eventFirstGameStartMinute}
                        onChange={(e) => setEventFirstGameStartMinute(parseInt(e.target.value))}
                        className={`admin-time-select w-20 px-2 py-1.5 rounded-lg border text-sm ${
                          isDark
                            ? 'bg-gray-800 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      >
                        {[0, 15, 30, 45].map(m => (
                          <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className={`block text-xs mb-2 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {t('admin.booking_modal.fields.games_count')}
                    </label>
                    <div ref={customGamesDropdownRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCustomGamesDropdown(!showCustomGamesDropdown)}
                        className={`flex items-center justify-between w-full px-3 py-2 rounded-lg transition-colors text-sm ${
                          isDark
                            ? 'bg-gray-800 hover:bg-gray-700 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                        }`}
                      >
                        <span>{eventCustomNumberOfGames} {t('admin.booking_modal.fields.games')}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        } ${showCustomGamesDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showCustomGamesDropdown && (
                        <div className={`absolute top-full left-0 mt-2 w-full rounded-lg shadow-xl z-50 overflow-hidden ${
                          isDark
                            ? 'bg-gray-800 border border-gray-700'
                            : 'bg-white border border-gray-200'
                        }`}>
                          {[1, 2, 3, 4].map(n => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => {
                                setEventCustomNumberOfGames(n)
                                const defaultDurations = Array(n).fill('30')
                                const defaultPauses = Array(n - 1).fill(0)
                                setEventCustomGameDurations(defaultDurations)
                                setEventCustomGamePauses(defaultPauses)
                                setEventCustomGameArea(Array(n).fill('ACTIVE' as GameArea))
                                setEventCustomLaserRoomIds(Array(n).fill(''))
                                setShowCustomGamesDropdown(false)
                              }}
                              className={`w-full px-4 py-2.5 text-left transition-colors text-sm ${
                                eventCustomNumberOfGames === n
                                  ? isDark
                                    ? 'bg-blue-600/20 text-blue-400'
                                    : 'bg-blue-100 text-blue-700'
                                  : isDark
                                  ? 'text-white hover:bg-gray-700'
                                  : 'text-gray-900 hover:bg-gray-100'
                              }`}
                            >
                              {n} {t('admin.booking_modal.fields.games')}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {Array.from({ length: eventCustomNumberOfGames }).map((_, index) => (
                    <div key={index} className={`p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <div className="mb-2">
                        <label className={`block text-xs mb-1 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {t('admin.booking_modal.fields.game_number')} {index + 1} - {t('admin.booking_modal.event.game_type')}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const newAreas = [...eventCustomGameArea]
                              newAreas[index] = 'ACTIVE'
                              setEventCustomGameArea(newAreas)
                            }}
                            className={`p-2 rounded-lg border-2 text-xs ${
                              eventCustomGameArea[index] === 'ACTIVE'
                                ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                                : isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-700'
                            }`}
                          >
                            {t('admin.booking_modal.zones.active')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newAreas = [...eventCustomGameArea]
                              newAreas[index] = 'LASER'
                              setEventCustomGameArea(newAreas)
                            }}
                            className={`p-2 rounded-lg border-2 text-xs ${
                              eventCustomGameArea[index] === 'LASER'
                                ? 'border-purple-500 bg-purple-500/10 text-purple-500'
                                : isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-700'
                            }`}
                          >
                            {t('admin.booking_modal.zones.laser')}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {t('admin.booking_modal.common.duration_min')}
                          </label>
                          <input
                            type="number"
                            min="15"
                            step="15"
                            value={eventCustomGameDurations[index] || '30'}
                            onChange={(e) => {
                              const newDurations = [...eventCustomGameDurations]
                              newDurations[index] = e.target.value
                              setEventCustomGameDurations(newDurations)
                            }}
                            className={`w-full px-2 py-1 rounded border text-sm ${
                              isDark
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            }`}
                          />
                        </div>
                        {index < eventCustomNumberOfGames - 1 && (
                          <div>
                            <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {t('admin.booking_modal.event.pause_after')}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="15"
                              value={eventCustomGamePauses[index] ?? 0}
                              onChange={(e) => {
                                const newPauses = [...eventCustomGamePauses]
                                const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                                newPauses[index] = isNaN(value) ? 0 : value
                                setEventCustomGamePauses(newPauses)
                              }}
                              className={`w-full px-2 py-1 rounded border text-sm ${
                                isDark
                                  ? 'bg-gray-700 border-gray-600 text-white'
                                  : 'bg-white border-gray-300 text-gray-900'
                              }`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
                  </div>
                )
              })()}
            </div>
          )}

          {/* Sélection Zone de jeu (ACTIVE/LASER/Sur mesure) - Uniquement pour GAME */}
          {bookingType === 'GAME' && laserRooms.length > 0 && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('admin.booking_modal.game_area_label')}
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                      onClick={() => {
                        setGameArea('ACTIVE')
                        // Par défaut ACTIVE : 2 jeux de 30 min avec 0 pause après le premier
                        setNumberOfGames(2)
                        setGameDurations(['30', '30'])
                        setGamePauses([0]) // Pause après le premier jeu (0 par défaut)
                        setDurationMinutes('60') // Durée par défaut pour un jeu ACTIVE simple (60 min)
                      }}
                  className={`p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    gameArea === 'ACTIVE'
                      ? 'border-blue-500 bg-blue-500/10'
                      : isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Zap className={`w-6 h-6 ${gameArea === 'ACTIVE' ? 'text-blue-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  <span className={`font-medium ${gameArea === 'ACTIVE' ? 'text-blue-500' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Active
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGameArea('LASER')
                    // Par défaut LASER : 1 jeu de 30 min
                    setNumberOfGames(1)
                    setGameDurations(['30'])
                    setGamePauses([]) // Pas de pause pour un seul jeu
                    setDurationMinutes('30') // Durée par défaut pour un jeu LASER simple (30 min)
                  }}
                  className={`p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    gameArea === 'LASER'
                      ? 'border-purple-500 bg-purple-500/10'
                      : isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Target className={`w-6 h-6 ${gameArea === 'LASER' ? 'text-purple-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  <span className={`font-medium ${gameArea === 'LASER' ? 'text-purple-500' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Laser
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGameArea('CUSTOM')
                    // Initialiser les valeurs par défaut pour sur mesure
                    setGameCustomNumberOfGames(2)
                    setGameCustomGameDurations(['30', '30'])
                    setGameCustomGamePauses([0])
                    setGameCustomGameArea(['ACTIVE', 'ACTIVE'] as GameArea[])
                    setGameCustomLaserRoomIds(['', ''])
                  }}
                  className={`p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    gameArea === 'CUSTOM'
                      ? 'border-green-500 bg-green-500/10'
                      : isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Gamepad2 className={`w-6 h-6 ${gameArea === 'CUSTOM' ? 'text-green-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  <span className={`font-medium ${gameArea === 'CUSTOM' ? 'text-green-500' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('admin.booking_modal.game_area.custom')}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Temps de jeu et Participants - Uniquement affiché si zone de jeu sélectionnée (GAME) */}
          {bookingType === 'GAME' && gameArea !== null && (
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Gamepad2 className="w-5 h-5 text-blue-400" />
                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('admin.booking_modal.game_time')}</span>
              </div>
              <div className={`grid gap-3 ${(gameArea as string) === 'CUSTOM' ? 'grid-cols-2' : (numberOfGames === 1 && (gameArea as string) !== 'CUSTOM' ? 'grid-cols-3' : 'grid-cols-2')}`}>
                <div>
                  <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('admin.booking_modal.start')}
                  </label>
                  <div className="flex gap-1">
                    <select
                      value={hour}
                      onChange={(e) => setHour(parseInt(e.target.value))}
                      onKeyDown={handleEnterKey}
                      className={`admin-time-select flex-1 px-2 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-400 ${
                        isDark
                          ? 'bg-gray-800 border-gray-600 text-white focus:bg-gray-800 hover:bg-gray-800'
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
                      onKeyDown={handleEnterKey}
                      className={`admin-time-select flex-1 px-2 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-400 ${
                        isDark
                          ? 'bg-gray-800 border-gray-600 text-white focus:bg-gray-800 hover:bg-gray-800'
                          : 'bg-white border-gray-300 text-gray-900 focus:bg-white hover:bg-white'
                      }`}
                    >
                      {[0, 15, 30, 45].map(m => (
                        <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Durée - uniquement affichée pour 1 jeu (pas pour 2, 3, 4 jeux où on utilise les durées individuelles) */}
                {gameArea !== 'CUSTOM' && numberOfGames === 1 && (
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
                      onKeyDown={handleEnterKey}
                      className={`w-full px-2 py-2 rounded-lg border text-sm ${
                        isDark
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                      placeholder={gameArea === 'LASER' ? '30' : '60'}
                    />
                  </div>
                )}
                <div>
                  <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('admin.booking_modal.fields.participants')}
                  </label>
                  <input
                    type="number"
                    min="1"
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
              {parsedParticipants > 0 && bookingType === 'GAME' && gameArea === 'ACTIVE' && (
                <div className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t('admin.booking_modal.game.slots_info', { slots: slotsNeeded, places: slotsNeeded * MAX_PLAYERS_PER_SLOT })}
                  {isOverCapacity && <span className="text-red-400 ml-2">{t('admin.booking_modal.game.max_capacity')}: {TOTAL_CAPACITY}</span>}
                </div>
              )}
            </div>
          )}

          {/* Allocation manuelle LASER */}
          {bookingType === 'GAME' && gameArea === 'LASER' && (
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-purple-400" />
                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('admin.booking_modal.laser.allocation_title')}</span>
              </div>
              {(() => {
                const activeLaserRooms = laserRooms?.filter(r => r.is_active) || []
                const hasMultipleRooms = activeLaserRooms.length > 1
                return (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setLaserAllocationMode('auto')}
                        className={`px-4 py-3 rounded-lg border-2 transition-all ${
                          laserAllocationMode === 'auto'
                            ? 'border-purple-500 bg-purple-500/10 text-purple-500'
                            : isDark ? 'border-gray-700 hover:border-gray-600 text-gray-300' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="font-medium">{t('admin.booking_modal.laser.auto')}</div>
                        <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.booking_modal.laser.auto_desc')}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => hasMultipleRooms && setLaserAllocationMode('petit')}
                        disabled={!hasMultipleRooms}
                        className={`px-4 py-3 rounded-lg border-2 transition-all ${
                          !hasMultipleRooms
                            ? 'opacity-40 cursor-not-allowed border-gray-600 text-gray-500'
                            : laserAllocationMode === 'petit'
                              ? 'border-purple-500 bg-purple-500/10 text-purple-500'
                              : isDark ? 'border-gray-700 hover:border-gray-600 text-gray-300' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="font-medium">{t('admin.booking_modal.laser.petit')}</div>
                        <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.booking_modal.laser.petit_desc')}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => hasMultipleRooms && setLaserAllocationMode('grand')}
                        disabled={!hasMultipleRooms}
                        className={`px-4 py-3 rounded-lg border-2 transition-all ${
                          !hasMultipleRooms
                            ? 'opacity-40 cursor-not-allowed border-gray-600 text-gray-500'
                            : laserAllocationMode === 'grand'
                              ? 'border-purple-500 bg-purple-500/10 text-purple-500'
                              : isDark ? 'border-gray-700 hover:border-gray-600 text-gray-300' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="font-medium">{t('admin.booking_modal.laser.grand')}</div>
                        <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.booking_modal.laser.grand_desc')}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => hasMultipleRooms && setLaserAllocationMode('maxi')}
                        disabled={!hasMultipleRooms}
                        className={`px-4 py-3 rounded-lg border-2 transition-all ${
                          !hasMultipleRooms
                            ? 'opacity-40 cursor-not-allowed border-gray-600 text-gray-500'
                            : laserAllocationMode === 'maxi'
                              ? 'border-purple-500 bg-purple-500/10 text-purple-500'
                              : isDark ? 'border-gray-700 hover:border-gray-600 text-gray-300' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="font-medium">{t('admin.booking_modal.laser.maxi')}</div>
                        <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.booking_modal.laser.maxi_desc')}</div>
                      </button>
                    </div>
                    {!hasMultipleRooms && (
                      <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {t('admin.booking_modal.laser.single_room_notice')}
                      </p>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* Configuration des jeux (ACTIVE, LASER ou Sur mesure) - Uniquement pour GAME */}
          {bookingType === 'GAME' && laserRooms.length > 0 && gameArea && gameArea !== 'CUSTOM' && (
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-3">
                {gameArea === 'ACTIVE' ? (
                  <Zap className="w-5 h-5 text-blue-400" />
                ) : (
                  <Target className="w-5 h-5 text-purple-400" />
                )}
                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {t('admin.booking_modal.game.config_title')} ({gameArea === 'ACTIVE' ? t('admin.booking_modal.zones.active') : t('admin.booking_modal.zones.laser')})
                </span>
              </div>
              
              {/* Nombre de jeux (1/2/3/4) */}
              <div className="mb-3">
                <label className={`block text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t('admin.booking_modal.fields.games_count')}
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setNumberOfGames(num)
                        // Initialiser les durées et pauses
                        setGameDurations(Array(num).fill('30'))
                        // Pauses après chaque jeu (sauf le dernier) : 0 pour ACTIVE, 30 pour LASER
                        const defaultPause = gameArea === 'ACTIVE' ? 0 : 30
                        setGamePauses(Array(num - 1).fill(defaultPause)) // num-1 car pas de pause après le dernier jeu
                        setLaserRoomIds(Array(num).fill(''))
                      }}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        numberOfGames === num
                          ? gameArea === 'ACTIVE'
                            ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                            : 'border-purple-500 bg-purple-500/10 text-purple-500'
                          : isDark ? 'border-gray-700 hover:border-gray-600 text-gray-300' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Configuration des jeux individuels (ACTIVE et LASER) */}
              {numberOfGames > 1 && (
                <div className="space-y-3">
                  <label className={`block text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('admin.booking_modal.game.config_title')}
                  </label>
                  {Array.from({ length: numberOfGames }, (_, i) => (
                    <div key={i} className={`p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {t('admin.booking_modal.fields.game_number')} {i + 1}
                        </span>
                      </div>
                      <div className={`grid gap-2 ${i < numberOfGames - 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        <div>
                          <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {t('admin.booking_modal.common.duration_min')}
                          </label>
                          <input
                            type="number"
                            min="15"
                            step="15"
                            value={gameDurations[i] || '30'}
                            onChange={(e) => {
                              const newDurations = [...gameDurations]
                              newDurations[i] = e.target.value
                              setGameDurations(newDurations)
                            }}
                            className={`w-full px-2 py-1 rounded border text-sm ${
                              isDark
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            }`}
                          />
                        </div>
                        {/* Pause après ce jeu (sauf pour le dernier) */}
                        {i < numberOfGames - 1 && (
                          <div>
                            <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {t('admin.booking_modal.event.pause_after')}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="15"
                              value={gamePauses[i] || (gameArea === 'LASER' ? 30 : 0)}
                              onChange={(e) => {
                                const newPauses = [...gamePauses]
                                newPauses[i] = parseInt(e.target.value, 10) || 0
                                setGamePauses(newPauses)
                              }}
                              className={`w-full px-2 py-1 rounded border text-sm ${
                                isDark
                                  ? 'bg-gray-700 border-gray-600 text-white'
                                  : 'bg-white border-gray-300 text-gray-900'
                              }`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Configuration Laser : allocation de salle */}
              {gameArea === 'LASER' && laserRooms.length > 0 && (
                <div className="mt-3">
                  <label className={`block text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('admin.booking_modal.laser.room_allocation')}
                  </label>
                  <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {parsedParticipants <= 15 && t('admin.booking_modal.laser.default_l1')}
                    {parsedParticipants > 15 && parsedParticipants <= 20 && t('admin.booking_modal.laser.default_l2')}
                    {parsedParticipants > 20 && t('admin.booking_modal.laser.needs_both')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Configuration sur mesure pour GAME */}
          {bookingType === 'GAME' && laserRooms.length > 0 && gameArea === 'CUSTOM' && (
            <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Gamepad2 className="w-5 h-5 text-green-400" />
                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('admin.booking_modal.custom.config_title')}</span>
              </div>
              
              <div className="space-y-3">
                <div className="mb-3">
                  <label className={`block text-xs mb-2 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('admin.booking_modal.fields.games_count')}
                  </label>
                  <div ref={gameCustomGamesDropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShowGameCustomGamesDropdown(!showGameCustomGamesDropdown)}
                      className={`flex items-center justify-between w-full px-3 py-2 rounded-lg transition-colors text-sm ${
                        isDark
                          ? 'bg-gray-800 hover:bg-gray-700 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                      }`}
                    >
                      <span>{gameCustomNumberOfGames} {t('admin.booking_modal.fields.games')}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      } ${showGameCustomGamesDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showGameCustomGamesDropdown && (
                      <div className={`absolute top-full left-0 mt-2 w-full rounded-lg shadow-xl z-50 overflow-hidden ${
                        isDark
                          ? 'bg-gray-800 border border-gray-700'
                          : 'bg-white border border-gray-200'
                      }`}>
                        {[1, 2, 3, 4].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              setGameCustomNumberOfGames(n)
                              const defaultDurations = Array(n).fill('30')
                              const defaultPauses = Array(n - 1).fill(0)
                              setGameCustomGameDurations(defaultDurations)
                              setGameCustomGamePauses(defaultPauses)
                              setGameCustomGameArea(Array(n).fill('ACTIVE' as GameArea))
                              setGameCustomLaserRoomIds(Array(n).fill(''))
                              setShowGameCustomGamesDropdown(false)
                            }}
                            className={`w-full px-4 py-2.5 text-left transition-colors text-sm ${
                              gameCustomNumberOfGames === n
                                ? isDark
                                  ? 'bg-blue-600/20 text-blue-400'
                                  : 'bg-blue-100 text-blue-700'
                                : isDark
                                ? 'text-white hover:bg-gray-700'
                                : 'text-gray-900 hover:bg-gray-100'
                            }`}
                          >
                            {n} {t('admin.booking_modal.fields.games')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {Array.from({ length: gameCustomNumberOfGames }).map((_, index) => (
                  <div key={index} className={`p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="mb-2">
                      <label className={`block text-xs mb-1 font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {t('admin.booking_modal.fields.game_number')} {index + 1} - {t('admin.booking_modal.event.game_type')}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const newAreas = [...gameCustomGameArea]
                            newAreas[index] = 'ACTIVE'
                            setGameCustomGameArea(newAreas)
                          }}
                          className={`p-2 rounded-lg border-2 text-xs ${
                            gameCustomGameArea[index] === 'ACTIVE'
                              ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                              : isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-700'
                          }`}
                        >
                          {t('admin.booking_modal.zones.active')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newAreas = [...gameCustomGameArea]
                            newAreas[index] = 'LASER'
                            setGameCustomGameArea(newAreas)
                          }}
                          className={`p-2 rounded-lg border-2 text-xs ${
                            gameCustomGameArea[index] === 'LASER'
                              ? 'border-purple-500 bg-purple-500/10 text-purple-500'
                              : isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-700'
                          }`}
                        >
                          {t('admin.booking_modal.zones.laser')}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Durée (min)
                        </label>
                        <input
                          type="number"
                          min="15"
                          step="15"
                          value={gameCustomGameDurations[index] || '30'}
                          onChange={(e) => {
                            const newDurations = [...gameCustomGameDurations]
                            newDurations[index] = e.target.value
                            setGameCustomGameDurations(newDurations)
                          }}
                          className={`w-full px-2 py-1 rounded border text-sm ${
                            isDark
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        />
                      </div>
                      {index < gameCustomNumberOfGames - 1 && (
                        <div>
                          <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {t('admin.booking_modal.event.pause_after')}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="15"
                            value={gameCustomGamePauses[index] || 0}
                            onChange={(e) => {
                              const newPauses = [...gameCustomGamePauses]
                              newPauses[index] = parseInt(e.target.value, 10) || 0
                              setGameCustomGamePauses(newPauses)
                            }}
                            className={`w-full px-2 py-1 rounded border text-sm ${
                              isDark
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
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
                  {t('admin.booking_modal.contact.modify_client')}
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
                  {t('admin.booking_modal.contact.change_contact')}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <User className="w-4 h-4 inline mr-1" />
                  {t('admin.booking_modal.contact.first_name_required')}
                </label>
                <ContactFieldAutocomplete
                  branchId={bookingBranchId}
                  value={firstName}
                  onChange={(value) => handleFieldChange('firstName', value)}
                  onSelectContact={handleContactSelectedFromField}
                  fieldType="firstName"
                  placeholder={t('admin.booking_modal.contact.first_name_placeholder')}
                  required
                  isDark={isDark}
                  inputType="text"
                  disabled={areFieldsFrozen}
                  onEnterKey={handleEnterKeyWrapper}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('admin.booking_modal.fields.last_name')}
                </label>
                <ContactFieldAutocomplete
                  branchId={bookingBranchId}
                  value={lastName}
                  onChange={(value) => handleFieldChange('lastName', value)}
                  onSelectContact={handleContactSelectedFromField}
                  fieldType="lastName"
                  placeholder={t('admin.booking_modal.contact.last_name_optional')}
                  isDark={isDark}
                  inputType="text"
                  disabled={areFieldsFrozen}
                  onEnterKey={handleEnterKeyWrapper}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Phone className="w-4 h-4 inline mr-1" />
                  {t('admin.booking_modal.contact.phone_required')}
                </label>
                <ContactFieldAutocomplete
                  branchId={bookingBranchId}
                  value={phone}
                  onChange={(value) => handleFieldChange('phone', value)}
                  onSelectContact={handleContactSelectedFromField}
                  fieldType="phone"
                  placeholder={t('admin.booking_modal.common.placeholder_phone')}
                  required
                  isDark={isDark}
                  inputType="tel"
                  disabled={areFieldsFrozen}
                  onEnterKey={handleEnterKeyWrapper}
                />
                {phoneError && (
                  <p className="mt-1 text-sm text-red-500">{phoneError}</p>
                )}
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <Mail className="w-4 h-4 inline mr-1" />
                  {t('admin.booking_modal.fields.email')}
                  {bookingType === 'EVENT' && <span className="text-red-500 ml-1">*</span>}
                </label>
                <ContactFieldAutocomplete
                  branchId={bookingBranchId}
                  value={email}
                  onChange={(value) => handleFieldChange('email', value)}
                  onSelectContact={handleContactSelectedFromField}
                  fieldType="email"
                  placeholder={t('admin.booking_modal.contact.email_placeholder')}
                  isDark={isDark}
                  inputType="email"
                  disabled={areFieldsFrozen}
                  onEnterKey={handleEnterKeyWrapper}
                />
                {emailError && (
                  <p className="mt-1 text-sm text-red-500">{emailError}</p>
                )}
              </div>
            </div>

            {/* Sélecteur de langue préférée */}
            <div className="flex items-center gap-2 mt-3">
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('admin.booking_modal.contact.preferred_language')}:
              </span>
              <div className="flex gap-1">
                {([
                  { code: 'he', flag: '🇮🇱', labelKey: 'admin.booking_modal.languages.hebrew' },
                  { code: 'fr', flag: '🇫🇷', labelKey: 'admin.booking_modal.languages.french' },
                  { code: 'en', flag: '🇬🇧', labelKey: 'admin.booking_modal.languages.english' }
                ] as const).map(({ code, flag, labelKey }) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setPreferredLocale(code)}
                    title={t(labelKey)}
                    className={`text-lg px-1.5 py-0.5 rounded transition-all ${
                      preferredLocale === code
                        ? isDark
                          ? 'bg-blue-600/30 ring-2 ring-blue-500'
                          : 'bg-blue-100 ring-2 ring-blue-500'
                        : isDark
                          ? 'hover:bg-gray-700 opacity-50 hover:opacity-100'
                          : 'hover:bg-gray-100 opacity-50 hover:opacity-100'
                    }`}
                  >
                    {flag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="mt-4">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <MessageSquare className="w-4 h-4 inline mr-1" />
              {t('admin.booking_modal.fields.notes')}
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
              placeholder={t('admin.booking_modal.fields.notes_additional')}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>

          {/* Discount (remise) */}
          <div className="flex items-center gap-3 mt-4">
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('admin.booking_modal.discount.label')}:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDiscountType(discountType === 'percent' ? null : 'percent')}
                className={`px-3 py-1 rounded-lg text-sm transition-all ${
                  discountType === 'percent'
                    ? 'bg-purple-500 text-white'
                    : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                %
              </button>
              <button
                type="button"
                onClick={() => setDiscountType(discountType === 'fixed' ? null : 'fixed')}
                className={`px-3 py-1 rounded-lg text-sm transition-all ${
                  discountType === 'fixed'
                    ? 'bg-purple-500 text-white'
                    : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ₪
              </button>
              {discountType && (
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percent' ? t('admin.booking_modal.discount.percent_placeholder') : t('admin.booking_modal.discount.fixed_placeholder')}
                  className={`w-20 px-2 py-1 rounded-lg border text-sm ${
                    isDark
                      ? 'bg-gray-800 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  min="0"
                  max={discountType === 'percent' ? '100' : undefined}
                />
              )}
              {discountType && discountValue && (
                <span className={`text-xs ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                  {discountType === 'percent' ? `${discountValue}%` : `${discountValue}₪`}
                </span>
              )}
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Avertissement participants EVENT invalides */}
          {bookingType === 'EVENT' && parsedParticipants > 0 && !eventParticipantsValidation.valid && (
            <div className={`p-3 rounded-xl ${isDark ? 'bg-orange-900/20 border border-orange-500/30' : 'bg-orange-50 border border-orange-200'}`}>
              <div className={`text-center text-sm ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
                ⚠️ {eventParticipantsValidation.message}
              </div>
            </div>
          )}

          {/* Calcul du prix */}
          {priceCalculation && priceCalculation.valid && (
            <div className={`p-3 rounded-xl ${isDark ? 'bg-green-900/20 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
              <div className={`text-center font-mono text-sm ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                {priceCalculation.breakdown} = <span className="font-bold text-base">{priceCalculation.total.toLocaleString()}₪</span>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className={`flex items-center justify-between gap-3 p-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2">
            {editingBooking && onDelete && (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={loading || !canDelete || orderStatus === 'closed'}
                title={orderStatus === 'closed' ? t('admin.errors.orderClosed') : !canDelete ? t('admin.common.no_permission') : undefined}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                  !canDelete || orderStatus === 'closed'
                    ? 'opacity-50 cursor-not-allowed text-gray-400'
                    : isDark
                      ? 'text-red-400 hover:bg-red-900/20 hover:text-red-300'
                      : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Trash2 className="w-4 h-4" />
                {t('admin.booking_modal.actions.delete')}
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
              {t('admin.booking_modal.actions.cancel')}
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading || parsedParticipants < 1 || (bookingType === 'EVENT' && !eventParticipantsValidation.valid) || (bookingType === 'EVENT' && (!email.trim() || !!emailError)) || (editingBooking ? !canEdit : !canCreate) || orderStatus === 'closed'}
              title={orderStatus === 'closed' ? t('admin.errors.orderClosed') : (editingBooking ? !canEdit : !canCreate) ? t('admin.common.no_permission') : undefined}
              className={`px-6 py-2 rounded-lg text-white flex items-center gap-2 disabled:opacity-50 ${
                (editingBooking ? !canEdit : !canCreate) || orderStatus === 'closed' ? 'cursor-not-allowed' : ''
              }`}
              style={{ backgroundColor: (editingBooking ? !canEdit : !canCreate) || orderStatus === 'closed' ? '#6B7280' : color }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {editingBooking ? t('admin.booking_modal.actions.modifying') : t('admin.booking_modal.actions.creating')}
                </>
              ) : (
                editingBooking ? t('admin.booking_modal.actions.modify') : t('admin.booking_modal.actions.create')
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
                ⚠️ {t('admin.booking_modal.modals.insufficient_capacity')}
              </h3>
              <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('admin.booking_modal.modals.no_room_for_participants', { count: parsedParticipants })}<br /><br />
                {t('admin.booking_modal.modals.capacity_insufficient')}<br /><br />
                {t('admin.booking_modal.modals.continue_anyway')}
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
                  {t('admin.booking_modal.actions.cancel')}
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
                      {t('admin.booking_modal.actions.processing')}
                    </>
                  ) : (
                    t('admin.booking_modal.modals.continue_button')
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
                ❌ {t('admin.booking_modal.modals.no_room_available')}
              </h3>
              <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('admin.booking_modal.modals.no_room_at_period', { count: parsedParticipants })}<br /><br />
                {t('admin.booking_modal.modals.reduce_participants')}
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
                  {t('admin.booking_modal.actions.close')}
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
                ⚠️ {t('admin.booking_modal.modals.lower_capacity')}
              </h3>
              <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('admin.booking_modal.modals.requested_vs_available', { requested: parsedParticipants, available: lowerCapacityRoomInfo.capacity })}<br /><br />
                {parsedParticipants > lowerCapacityRoomInfo.capacity ? (
                  <>
                    {t('admin.booking_modal.modals.exceeds_by', { count: parsedParticipants - lowerCapacityRoomInfo.capacity })}<br /><br />
                  </>
                ) : null}
                {t('admin.booking_modal.modals.use_this_room')}
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
                  {t('admin.booking_modal.actions.cancel')}
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
                      {t('admin.booking_modal.actions.processing')}
                    </>
                  ) : (
                    t('admin.booking_modal.modals.use_room_button')
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
            className="absolute inset-0 z-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDuplicateWarning(false)}
          />

          {/* Modal */}
          <div className={`relative z-10 w-full max-w-md mx-4 rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className={`w-6 h-6 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {t('admin.booking_modal.modals.duplicate_detected')}
                </h3>
              </div>
              <p className={`mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('admin.booking_modal.modals.duplicate_exists')}
              </p>
              <div className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                {pendingContactData.phone && (
                  <div className="mb-2">
                    <strong className={isDark ? 'text-gray-300' : 'text-gray-700'}>{t('admin.booking_modal.fields.phone')} :</strong>{' '}
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{pendingContactData.phone}</span>
                  </div>
                )}
                {pendingContactData.email && (
                  <div>
                    <strong className={isDark ? 'text-gray-300' : 'text-gray-700'}>{t('admin.booking_modal.fields.email')} :</strong>{' '}
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{pendingContactData.email}</span>
                  </div>
                )}
              </div>
              <p className={`mb-6 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('admin.booking_modal.modals.create_anyway_question')}
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
                  {t('admin.booking_modal.actions.cancel')}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!pendingContactData) return

                    setShowDuplicateWarning(false)
                    setPendingContactData(null)
                    // Relancer la soumission avec skipDuplicateCheck = true (créer nouveau contact)
                    const roomId = pendingEventRoomId
                    setPendingEventRoomId(null)
                    await submitWithRoom(roomId, true)
                  }}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('admin.booking_modal.actions.processing')}
                    </>
                  ) : (
                    t('admin.booking_modal.modals.create_anyway_button')
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
                ⚠️ {t('admin.booking_modal.modals.overbooking_warning')}
              </h3>
              <div className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <p className="mb-4">
                  {bookingBranchId && bookingBranchId !== branchId && (
                    <span className="block mb-2">
                      <strong>{t('admin.booking_modal.modals.destination_branch')} :</strong> {branches.find(b => b.id === bookingBranchId)?.name || t('admin.booking_modal.modals.unknown_branch')}
                    </span>
                  )}
                  {t('admin.booking_modal.modals.will_create_overbooking')}
                </p>
                <div className={`p-4 rounded-lg ${isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'}`}>
                  <div className="space-y-2">
                    <div>
                      <strong className={isDark ? 'text-red-300' : 'text-red-700'}>{t('admin.booking_modal.modals.maximum')} :</strong>
                      <span className="ml-2">
                        <strong>{overbookingInfo.maxOverbookedCount} {t('admin.booking_modal.modals.persons_surplus')}</strong>
                        {' '}(<strong>{overbookingInfo.maxOverbookedSlots} {t('admin.booking_modal.modals.slots')}</strong>)
                      </span>
                    </div>
                    {overbookingInfo.affectedTimeSlots.length > 0 && (
                      <div className="mt-3">
                        <strong className={isDark ? 'text-red-300' : 'text-red-700'}>{t('admin.booking_modal.modals.affected_slots')} :</strong>
                        <ul className="mt-2 space-y-1 text-sm">
                          {overbookingInfo.affectedTimeSlots.slice(0, 5).map((slot, idx) => (
                            <li key={idx}>
                              • <strong>{slot.time}</strong> : +{slot.overbookedCount} pers. ({slot.totalParticipants}/{slot.capacity})
                            </li>
                          ))}
                          {overbookingInfo.affectedTimeSlots.length > 5 && (
                            <li className="italic">{t('admin.booking_modal.modals.and_more', { count: overbookingInfo.affectedTimeSlots.length - 5 })}</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                <p className="mt-4">
                  <strong>{t('admin.booking_modal.modals.manual_auth_required')}</strong>
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
                  {t('admin.booking_modal.actions.cancel')}
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
                      {t('admin.booking_modal.actions.processing')}
                    </>
                  ) : (
                    t('admin.booking_modal.modals.authorize_continue')
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
                {t('admin.booking_modal.modals.confirm_delete')}
              </h3>
              <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('admin.booking_modal.modals.delete_irreversible')}
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
                  {t('admin.booking_modal.actions.cancel')}
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
                      {t('admin.booking_modal.actions.deleting')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      {t('admin.booking_modal.actions.delete')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal spare vests */}
      {showSpareVestsPopup && pendingSpareVestsData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowSpareVestsPopup(false)
              setPendingSpareVestsData(null)
            }}
          />

          {/* Modal spare vests */}
          <div className={`relative w-full max-w-md mx-4 rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="p-6">
              <h3 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('admin.booking_modal.modals.vests_limit')}
              </h3>
              <p className={`mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('admin.booking_modal.modals.vests_limit_reached', { max: pendingSpareVestsData.maxVests })}
              </p>
              <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('admin.booking_modal.modals.spare_vests_available', { spare: pendingSpareVestsData.spareVests })}
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowSpareVestsPopup(false)
                    setPendingSpareVestsData(null)
                  }}
                  className={`px-4 py-2 rounded-lg ${
                    isDark
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  {t('admin.booking_modal.modals.no_cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSpareVestsPopup(false)
                    setPendingSpareVestsData(null)
                    // Activer le flag pour bypasser la vérification des vests
                    setSpareVestsAuthorized(true)
                    // Soumettre automatiquement le formulaire
                    setTimeout(() => {
                      formRef.current?.requestSubmit()
                    }, 0)
                  }}
                  className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white"
                >
                  {t('admin.booking_modal.modals.yes_authorize')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
