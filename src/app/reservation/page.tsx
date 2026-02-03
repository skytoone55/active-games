'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Calendar, Clock, ChevronRight, ChevronLeft, Check, Users, Gamepad2, User, Phone, Mail, MessageSquare, FileText, ExternalLink, X, Home, Cake, Target, Zap, AlertCircle, CreditCard, Lock, Loader2 } from 'lucide-react'
import { getTranslations, getDirection, Locale, defaultLocale } from '@/i18n'
import { Header, Footer } from '@/components'
import { validateEmail, validateIsraeliPhone, formatIsraeliPhone, VALIDATION_MESSAGES } from '@/lib/validation'

type BookingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

interface BookingData {
  branch: string | null // Nom de la branche (pour affichage)
  branchSlug: string | null // Slug de la branche (pour identification unique dans la BD)
  type: 'game' | 'event' | null
  gameArea: 'ACTIVE' | 'LASER' | 'MIX' | null // Type de jeu (pour Game)
  numberOfGames: number // Nombre de jeux (pour Game)
  players: number | null
  date: string | null
  time: string | null
  firstName: string | null
  lastName: string | null
  phone: string | null
  email: string | null
  specialRequest: string | null
  termsAccepted: boolean
  // Event specific fields
  eventType: string | null // e.g., "birthday", "bar_mitzvah", "corporate", "party", "other"
  eventAge: number | null // Age for birthday or bar/bat mitzvah (optional)
}

function ReservationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [locale, setLocale] = useState<Locale>(defaultLocale)
  const [translations, setTranslations] = useState(getTranslations(defaultLocale))
  const [step, setStep] = useState<BookingStep>(1)
  const [bookingData, setBookingData] = useState<BookingData>({
    branch: null,
    branchSlug: null,
    type: null,
    gameArea: null,
    numberOfGames: 2, // Par défaut 2 (= 1h pour Active, sera ajusté selon l'activité)
    players: null,
    date: null,
    time: null,
    firstName: null,
    lastName: null,
    phone: null,
    email: null,
    specialRequest: null,
    termsAccepted: false,
    eventType: null,
    eventAge: null,
  })
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1) // 1-12, pas 0-11
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [reservationNumber, setReservationNumber] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<{ phone?: string; email?: string }>({})
  const [termsContent, setTermsContent] = useState<{ game: string | null; event: string | null }>({ game: null, event: null })
  const [termsLoading, setTermsLoading] = useState(false)

  // Payment states
  const [depositInfo, setDepositInfo] = useState<{
    amount: number
    total: number
    unitPrice: number
    roomPrice: number
    roomName: string | null
    breakdown: string
    explanation: string
  } | null>(null)
  const [isLoadingDeposit, setIsLoadingDeposit] = useState(false)
  const [cardData, setCardData] = useState({
    cc_number: '',
    cc_validity: '',
    cc_cvv: '',
    cc_holder_id: '',
    cc_holder_name: '',
  })
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)


  // Helper function for translations
  const t = (key: string, params?: Record<string, any>) => {
    const keys = key.split('.')
    let value: any = translations
    for (const k of keys) {
      value = value?.[k]
      if (!value) return key // Fallback to key if translation not found
    }
    // Handle interpolation
    if (params && typeof value === 'string') {
      return Object.entries(params).reduce((str, [paramKey, paramValue]) => {
        return str.replace(`{{${paramKey}}}`, String(paramValue))
      }, value)
    }
    return value || key
  }
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem('locale') as Locale
      if (savedLocale && ['en', 'he'].includes(savedLocale)) {
        setLocale(savedLocale)
        setTranslations(getTranslations(savedLocale))
      }
    }
  }, [])

  // Pré-remplir les données depuis les paramètres URL (lien généré par Clara)
  useEffect(() => {
    if (!searchParams) return

    const branch = searchParams.get('branch')
    const type = searchParams.get('type') as 'game' | 'event' | null
    const players = searchParams.get('players')
    const gameArea = searchParams.get('gameArea') as 'ACTIVE' | 'LASER' | 'MIX' | null
    const numberOfGames = searchParams.get('games')
    const date = searchParams.get('date')
    const time = searchParams.get('time')
    const firstName = searchParams.get('firstName')
    const lastName = searchParams.get('lastName')
    const phone = searchParams.get('phone')
    const email = searchParams.get('email')
    const eventType = searchParams.get('eventType')

    // Si au moins la branche est fournie, pré-remplir les données
    if (branch) {
      // Map branch slug to display name
      const branchNames: Record<string, string> = {
        'rishon-lezion': 'Rishon LeZion',
        'petah-tikva': 'Petah Tikva',
      }

      const newBookingData: Partial<BookingData> = {
        branchSlug: branch,
        branch: branchNames[branch] || branch,
      }

      if (type) newBookingData.type = type
      if (players) newBookingData.players = parseInt(players, 10)
      if (gameArea) newBookingData.gameArea = gameArea
      if (numberOfGames) newBookingData.numberOfGames = parseInt(numberOfGames, 10)
      if (date) newBookingData.date = date
      if (time) newBookingData.time = time
      if (firstName) newBookingData.firstName = firstName
      if (lastName) newBookingData.lastName = lastName
      if (phone) newBookingData.phone = phone
      if (email) newBookingData.email = email
      if (eventType) newBookingData.eventType = eventType

      setBookingData(prev => ({ ...prev, ...newBookingData }))

      // Déterminer l'étape de départ selon les données fournies
      // On va directement à l'étape 7 (paiement) si toutes les infos essentielles sont présentes
      if (branch && type && players && date && time && firstName && phone) {
        // Données complètes → aller à l'étape de paiement
        setTimeout(() => setStep(7), 100)
      } else if (branch && type && players && date && time) {
        // Manque juste les coordonnées → étape 6
        setTimeout(() => setStep(6), 100)
      } else if (branch && type && players && date) {
        // Manque l'heure → étape 5
        setTimeout(() => setStep(5), 100)
      } else if (branch && type && players && (type === 'event' || gameArea)) {
        // Manque la date → étape 4
        setTimeout(() => setStep(4), 100)
      } else if (branch && type && players) {
        // Manque le type de jeu/event → étape 3
        setTimeout(() => setStep(3), 100)
      } else if (branch) {
        // Juste la branche → étape 2
        setTimeout(() => setStep(2), 100)
      }
    }
  }, [searchParams])

  // Fetch terms and conditions from database
  useEffect(() => {
    const fetchTerms = async () => {
      setTermsLoading(true)
      try {
        // Map locale to language code (fr not available on public site, fallback to en)
        const langCode = locale === 'he' ? 'he' : 'en'

        const response = await fetch(`/api/terms?lang=${langCode}`)
        if (response.ok) {
          const data = await response.json()
          setTermsContent({
            game: data.game || null,
            event: data.event || null
          })
        }
      } catch (error) {
        console.error('Error fetching terms:', error)
      } finally {
        setTermsLoading(false)
      }
    }

    fetchTerms()
  }, [locale])

  // Reset deposit info when booking data changes (before step 7)
  useEffect(() => {
    if (step < 7) {
      setDepositInfo(null)
    }
  }, [step, bookingData.type, bookingData.players, bookingData.gameArea, bookingData.eventType])

  // Fetch deposit info when reaching step 7 (payment step) with all required data
  useEffect(() => {
    const fetchDepositInfo = async () => {
      if (step !== 7) return
      if (!bookingData.branchSlug || !bookingData.type || !bookingData.players) return

      // Reset before fetching new data
      setDepositInfo(null)
      setIsLoadingDeposit(true)

      try {
        // First get the branch_id from slug
        const branchesResponse = await fetch('/api/branches')
        const branchesData = await branchesResponse.json()

        if (!branchesData.success || !branchesData.branches) {
          console.error('Failed to fetch branches')
          return
        }

        const branch = branchesData.branches.find((b: { slug: string }) =>
          b.slug?.toLowerCase().trim() === bookingData.branchSlug?.toLowerCase().trim()
        )

        if (!branch) {
          console.error('Branch not found:', bookingData.branchSlug)
          return
        }

        // Build request payload
        const payload = {
          branch_id: branch.id,
          order_type: bookingData.type === 'event' ? 'EVENT' : 'GAME',
          participants_count: bookingData.players,
          game_area: bookingData.gameArea,
          number_of_games: bookingData.numberOfGames,
          event_type: bookingData.eventType,
          locale: locale,
        }

        console.log('[DEPOSIT] Calculating deposit for:', payload)

        // Calculate deposit
        const response = await fetch('/api/public/calculate-deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const data = await response.json()
        console.log('[DEPOSIT] API response:', data)

        if (data.success && data.deposit) {
          setDepositInfo(data.deposit)
        } else {
          console.error('[DEPOSIT] API error:', data.error)
        }
      } catch (error) {
        console.error('Error fetching deposit info:', error)
      } finally {
        setIsLoadingDeposit(false)
      }
    }

    fetchDepositInfo()
  }, [step, bookingData.branchSlug, bookingData.type, bookingData.players, bookingData.gameArea, bookingData.numberOfGames, bookingData.eventType])

  const isRTL = locale === 'he'
  const dir = getDirection(locale)

  // Branches from translations (avec slug pour identification unique)
  const branches: Array<{ name: string; slug?: string; address: string; venue: string; city?: string; phone?: string }> = translations.branches?.items || []

  // Generate available dates (next 365 days - unlimited)
  const getAvailableDates = () => {
    const dates: string[] = []
    const today = new Date()

    // Start from TODAY (i=0), not tomorrow
    for (let i = 0; i <= 365; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      
      // FORMAT LOCAL (pas ISO pour éviter décalage timezone)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      dates.push(`${year}-${month}-${day}`)
    }

    return dates
  }

  // Group dates by month
  const getDatesByMonth = () => {
    const dates = getAvailableDates()
    const grouped: { [key: string]: string[] } = {}
    
    dates.forEach((date) => {
      const [year, month] = date.split('-')
      const monthKey = `${year}-${month}`
      if (!grouped[monthKey]) {
        grouped[monthKey] = []
      }
      grouped[monthKey].push(date)
    })

    return grouped
  }

  // Get available months
  const getAvailableMonths = () => {
    const dates = getAvailableDates()
    const months = new Set<string>()
    
    dates.forEach((date) => {
      const dateObj = new Date(date + 'T00:00:00')
      months.add(`${dateObj.getFullYear()}-${String(dateObj.getMonth()).padStart(2, '0')}`)
    })
    
    return Array.from(months).sort().map((key) => {
      const [year, month] = key.split('-').map(Number)
      return { year, month, key }
    })
  }

  // Get dates for selected month
  const getDatesForSelectedMonth = () => {
    const grouped = getDatesByMonth()
    const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
    return grouped[monthKey] || []
  }

  // Get first day of month offset (to align calendar grid)
  const getFirstDayOffset = () => {
    const dates = getDatesForSelectedMonth()
    if (dates.length === 0) return 0
    const firstDate = dates[0]
    if (!firstDate) return 0
    const dateObj = new Date(firstDate + 'T00:00:00')
    return dateObj.getDay() // 0 = Sunday, 6 = Saturday
  }

  // Generate available time slots (10:00 to 23:00, every 30 minutes)
  // FILTRE: Si date = aujourd'hui, ne montrer que les heures futures (dès maintenant, pas de marge)
  const getAvailableTimes = () => {
    const times: string[] = []
    const now = new Date()
    const selectedDateStr = bookingData.date // Format: "YYYY-MM-DD"
    const todayStr = now.toISOString().split('T')[0]
    const isToday = selectedDateStr === todayStr

    for (let hour = 10; hour <= 23; hour++) {
      // Add :00
      const time00 = `${hour.toString().padStart(2, '0')}:00`
      if (isToday) {
        // Si aujourd'hui, vérifier que l'heure est dans le futur (dès maintenant, pas de marge)
        const slotDate = new Date(now)
        slotDate.setHours(hour, 0, 0, 0)
        if (slotDate >= now) {
          times.push(time00)
        }
      } else {
        times.push(time00)
      }
      
      // Add :30
      if (hour < 23) {
        const time30 = `${hour.toString().padStart(2, '0')}:30`
        if (isToday) {
          const slotDate = new Date(now)
          slotDate.setHours(hour, 30, 0, 0)
          if (slotDate >= now) {
            times.push(time30)
          }
        } else {
          times.push(time30)
        }
      }
    }

    return times
  }

  const handleBranchSelect = (branchName: string, branchSlug?: string) => {
    setBookingData({ ...bookingData, branch: branchName, branchSlug: branchSlug || null })
    setTimeout(() => setStep(2), 300)
  }

  // Sélection du type (Game ou Event) - reste sur étape 2 pour saisir participants
  const handleTypeSelect = (type: 'game' | 'event') => {
    // Pour Glilot: forcer gameArea='LASER'
    const isGlilot = bookingData.branchSlug === 'glilot'
    setBookingData({
      ...bookingData,
      type,
      gameArea: isGlilot ? 'LASER' : null,
      numberOfGames: type === 'game' ? (isGlilot ? 1 : 2) : 2, // Glilot: 1 partie laser par défaut, autres: 2 jeux
      players: null,
      eventType: type === 'event' ? (isGlilot ? 'event_laser' : null) : null,
      eventAge: null,
    })
    // Ne pas changer d'étape - on attend que l'utilisateur saisisse le nombre de participants
  }

  const handlePlayersChange = (players: number | null) => {
    setBookingData({ ...bookingData, players })
  }

  // Continuer après avoir saisi le nombre de participants (étape 2 → 3)
  const handleContinueToStep3 = () => {
    const minPlayers = bookingData.type === 'event' ? 15 : 1
    if (bookingData.type && bookingData.players && bookingData.players >= minPlayers) {
      setTimeout(() => setStep(3), 300) // Étape 3 = type de jeu (Game) ou type d'event (Event)
    }
  }

  // Sélection du type de jeu (pour Game uniquement)
  const handleGameAreaSelect = (gameArea: 'ACTIVE' | 'LASER' | 'MIX') => {
    // Définir le nombre de jeux par défaut selon le type
    // ACTIVE: numberOfGames en tranches de 30min (2 = 1h, 3 = 1h30, 4 = 2h)
    // LASER: numberOfGames = nombre de parties
    // MIX: toujours 1 (formule fixe 30min Active + 1 Laser)
    const defaultGames = gameArea === 'LASER' ? 1 : gameArea === 'MIX' ? 1 : 2 // 2 = 1h pour Active
    setBookingData({ ...bookingData, gameArea, numberOfGames: defaultGames })
    // Ne pas changer d'étape - on attend la sélection du nombre de jeux
  }

  // Changer le nombre de jeux
  const handleNumberOfGamesChange = (num: number) => {
    setBookingData({ ...bookingData, numberOfGames: num })
  }

  // Continuer vers la date (étape 3 → 4)
  const handleContinueToDate = () => {
    if (bookingData.gameArea) {
      setTimeout(() => setStep(4), 300)
    }
  }


  const handleDateSelect = (date: string) => {
    setBookingData({ ...bookingData, date })
    setTimeout(() => setStep(5), 300) // Étape 5 = heure
  }

  const handleTimeSelect = (time: string) => {
    setBookingData({ ...bookingData, time })
    setTimeout(() => setStep(6), 300) // Étape 6 = contact
  }

  const handleNext = () => {
    if (step < 6) {
      setStep((step + 1) as BookingStep)
    }
  }

  const handlePrevious = () => {
    if (step > 1) {
      setStep((step - 1) as BookingStep)
    }
  }

  // Créer une commande ABORTED quand le client arrive à l'étape paiement
  const createAbortedOrder = async () => {
    try {
      // Récupérer le branch_id à partir du slug
      if (!bookingData.branchSlug) {
        console.warn('[ABORTED] No branch slug available')
        return
      }

      const branchRes = await fetch(`/api/branches?slug=${bookingData.branchSlug}`)
      const branchData = await branchRes.json()
      if (!branchData.success || !branchData.branch?.id) {
        console.warn('[ABORTED] Could not find branch ID')
        return
      }

      const response = await fetch('/api/orders/aborted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: branchData.branch.id,
          order_type: bookingData.type?.toUpperCase(),
          participants_count: bookingData.players,
          game_area: bookingData.gameArea,
          number_of_games: bookingData.numberOfGames,
          event_type: bookingData.eventType,
          requested_date: bookingData.date,
          requested_time: bookingData.time,
          customer_first_name: bookingData.firstName,
          customer_last_name: bookingData.lastName,
          customer_phone: bookingData.phone,
          customer_email: bookingData.email,
          source: 'public_booking'
        })
      })

      const data = await response.json()
      if (data.success) {
        console.log('[ABORTED] Order created:', data.order_id)
        // Stocker l'ID pour le mettre à jour après paiement
        sessionStorage.setItem('aborted_order_id', data.order_id)
      }
    } catch (error) {
      console.error('[ABORTED] Error creating order:', error)
      // Ne pas bloquer l'utilisateur si ça échoue
    }
  }

  const handleContactInfoChange = (field: 'firstName' | 'lastName' | 'phone' | 'email' | 'specialRequest', value: string | number) => {
    setBookingData({ ...bookingData, [field]: value })
    
    // Validation en temps réel
    const newErrors = { ...validationErrors }
    
    if (field === 'phone' && value) {
      const phoneStr = String(value)
      if (!validateIsraeliPhone(phoneStr)) {
        newErrors.phone = VALIDATION_MESSAGES.phone.israeliFormat
      } else {
        delete newErrors.phone
      }
    }
    
    if (field === 'email' && value) {
      const emailStr = String(value)
      if (!validateEmail(emailStr)) {
        newErrors.email = VALIDATION_MESSAGES.email.invalid
      } else {
        delete newErrors.email
      }
    }
    
    setValidationErrors(newErrors)
  }

  // État pour le message de confirmation
  const [orderStatus, setOrderStatus] = useState<'auto_confirmed' | 'pending' | null>(null)
  const [orderMessage, setOrderMessage] = useState<string>('')

  // Handler pour les changements de carte
  const handleCardChange = (field: keyof typeof cardData, value: string) => {
    let formattedValue = value

    // Format card number with spaces
    if (field === 'cc_number') {
      formattedValue = value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19)
    }
    // Format validity as MM/YY
    else if (field === 'cc_validity') {
      formattedValue = value.replace(/\D/g, '')
      if (formattedValue.length > 2) {
        formattedValue = formattedValue.slice(0, 2) + '/' + formattedValue.slice(2, 4)
      }
    }
    // CVV max 4 digits
    else if (field === 'cc_cvv') {
      formattedValue = value.replace(/\D/g, '').slice(0, 4)
    }
    // ID only digits
    else if (field === 'cc_holder_id') {
      formattedValue = value.replace(/\D/g, '').slice(0, 9)
    }

    setCardData(prev => ({ ...prev, [field]: formattedValue }))
    setPaymentError(null)
  }

  // Validation de la carte
  const isCardValid = () => {
    const ccNumber = cardData.cc_number.replace(/\s/g, '')
    const ccValidity = cardData.cc_validity.replace('/', '')

    return (
      ccNumber.length >= 13 &&
      ccNumber.length <= 19 &&
      ccValidity.length === 4 &&
      cardData.cc_cvv.length >= 3 &&
      cardData.cc_holder_id.length >= 7
    )
  }

  const handleConfirm = async () => {
    // Protection double-click
    if (isSubmitting || isProcessingPayment) {
      return
    }

    // Si acompte requis et pas de carte valide, erreur
    if (depositInfo && depositInfo.amount > 0 && !isCardValid()) {
      setPaymentError(t('booking.payment.fill_card_details'))
      return
    }

    setIsSubmitting(true)
    setPaymentError(null)

    try {
      // D'abord, récupérer le branch_id depuis le nom de la branche
      const branchesResponse = await fetch('/api/branches')
      const branchesData = await branchesResponse.json()

      if (!branchesData.success || !branchesData.branches || branchesData.branches.length === 0) {
        alert(t('booking.errors.no_branches'))
        setIsSubmitting(false)
        return
      }

      if (!bookingData.branch) {
        alert(t('booking.errors.select_branch'))
        setIsSubmitting(false)
        return
      }

      // Trouver la branche par son slug (priorité) ou nom
      let selectedBranch = null

      if (bookingData.branchSlug) {
        selectedBranch = branchesData.branches?.find((b: { name: string; slug: string }) =>
          b.slug?.toLowerCase().trim() === bookingData.branchSlug?.toLowerCase().trim()
        )
      }

      if (!selectedBranch && bookingData.branch) {
        const branchNameLower = bookingData.branch.toLowerCase().trim()
        selectedBranch = branchesData.branches?.find((b: { name: string; slug: string }) => {
          const nameMatch = b.name?.toLowerCase().trim() === branchNameLower ||
                            b.name?.toLowerCase().trim().includes(branchNameLower) ||
                            branchNameLower.includes(b.name?.toLowerCase().trim() || '')
          const slugMatch = b.slug?.toLowerCase().trim() === branchNameLower ||
                            b.slug?.toLowerCase().trim().includes(branchNameLower) ||
                            branchNameLower.includes(b.slug?.toLowerCase().trim() || '')
          return nameMatch || slugMatch
        })
      }

      if (!selectedBranch) {
        alert(`Branche "${bookingData.branch}" non trouvée. Veuillez réessayer.`)
        setIsSubmitting(false)
        return
      }

      // Utiliser le gameArea sélectionné par l'utilisateur
      let gameArea: 'ACTIVE' | 'LASER' | null = null
      let customerNotes = bookingData.specialRequest || ''

      if (bookingData.gameArea) {
        if (bookingData.gameArea === 'MIX') {
          gameArea = 'ACTIVE'
          customerNotes = `[DEMANDE MIX Active + Laser] ${customerNotes}`.trim()
        } else {
          gameArea = bookingData.gameArea
        }
      }

      // ÉTAPE 1: Créer la commande
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: selectedBranch.id,
          order_type: bookingData.type === 'event' ? 'EVENT' : 'GAME',
          requested_date: bookingData.date,
          requested_time: bookingData.time,
          participants_count: bookingData.players || 1,
          customer_first_name: bookingData.firstName,
          customer_last_name: bookingData.lastName || '',
          customer_phone: bookingData.phone ? formatIsraeliPhone(bookingData.phone) : bookingData.phone,
          customer_email: bookingData.email || null,
          customer_notes: customerNotes || null,
          game_area: gameArea,
          number_of_games: bookingData.numberOfGames,
          event_type: bookingData.eventType || null,
          event_celebrant_age: bookingData.eventAge || null,
          terms_accepted: bookingData.termsAccepted,
          locale: locale === 'he' ? 'he' : 'en',
        }),
      })

      const result = await response.json()

      if (!result.success) {
        console.error('Error saving order:', result.error)
        alert(`Erreur: ${result.error || t('booking.errors.save_reservation')}`)
        setIsSubmitting(false)
        return
      }

      const orderId = result.order_id

      // ÉTAPE 2: Si acompte requis, effectuer le paiement
      if (depositInfo && depositInfo.amount > 0) {
        setIsProcessingPayment(true)

        try {
          const paymentResponse = await fetch('/api/public/pay-deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              order_id: orderId,
              amount: depositInfo.amount,
              card_info: {
                cc_number: cardData.cc_number.replace(/\s/g, ''),
                cc_validity: cardData.cc_validity.replace('/', ''),
                cc_cvv: cardData.cc_cvv,
                cc_holder_id: cardData.cc_holder_id,
                cc_holder_name: cardData.cc_holder_name || `${bookingData.firstName} ${bookingData.lastName || ''}`.trim(),
              },
            }),
          })

          const paymentResult = await paymentResponse.json()

          if (!paymentResult.success) {
            // Paiement échoué - la commande est créée mais pas payée
            setPaymentError(paymentResult.error || t('booking.payment.payment_failed'))
            setIsSubmitting(false)
            setIsProcessingPayment(false)
            return
          }

          // Paiement réussi
          setPaymentSuccess(true)
        } catch (payError) {
          console.error('Payment error:', payError)
          setPaymentError(t('booking.payment.processing_error'))
          setIsSubmitting(false)
          setIsProcessingPayment(false)
          return
        } finally {
          setIsProcessingPayment(false)
        }
      }

      // Succès final
      setReservationNumber(result.reference)
      setOrderStatus(result.status)
      setOrderMessage(result.message || t('booking.payment.confirmed'))
      setStep(8)

    } catch (error) {
      console.error('Error confirming reservation:', error)
      alert(t('booking.errors.confirmation_error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00')
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }
    return date.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', options)
  }

  const availableDates = getAvailableDates()
  const availableTimes = useMemo(() => getAvailableTimes(), [bookingData.date])

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale)
    setTranslations(getTranslations(newLocale))
    localStorage.setItem('locale', newLocale)
    document.documentElement.dir = getDirection(newLocale)
    document.documentElement.lang = newLocale
    // Notifier les autres composants (GlobalWidgets) du changement de locale
    window.dispatchEvent(new Event('localeChange'))
  }

  return (
    <div dir={dir}>
      <Header 
        translations={translations} 
        locale={locale} 
        onLocaleChange={handleLocaleChange} 
      />
      <div className="min-h-screen bg-dark text-white pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="section-title text-4xl md:text-5xl mb-4">
            {translations.booking?.title || 'Book your session'}
          </h1>
        </motion.div>

        {/* Progress Steps */}
        <div className="flex justify-center items-center mb-12 gap-4">
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                  step >= s
                    ? 'bg-primary text-dark shadow-[0_0_20px_rgba(0,240,255,0.5)]'
                    : 'bg-dark-200 text-gray-400'
                }`}
              >
                    {step > s ? <Check className="w-6 h-6" /> : s}
                  </div>
                  {s < 5 && (
                <div
                  className={`w-16 h-1 mx-2 transition-all duration-300 ${
                    step > s ? 'bg-primary' : 'bg-dark-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Steps Content */}
        <AnimatePresence mode="wait">
          {/* Step 1: Select Branch */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? -50 : 50 }}
              className="bg-dark-100/50 backdrop-blur-sm rounded-2xl p-8 border border-primary/30"
            >
              <div className="text-center mb-8">
                <MapPin className="w-16 h-16 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  {translations.booking?.step1?.title || 'Select branch'}
                </h2>
                <p className="text-gray-400">{translations.booking?.step1?.subtitle || 'Choose the location where you want to play'}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {branches.map((branch, index) => (
                  <motion.button
                    key={index}
                    onClick={() => handleBranchSelect(branch.name, branch.slug)}
                    className="bg-dark-200/50 hover:bg-dark-200 border-2 border-primary/30 hover:border-primary/70 rounded-xl p-6 text-left transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,240,255,0.3)]"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-start gap-4">
                      <MapPin className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          {branch.name}
                        </h3>
                        <p className="text-gray-400 text-sm mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          {branch.address}
                        </p>
                        <p className="text-primary text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          {branch.venue}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Select Type */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? -50 : 50 }}
              className="bg-dark-100/50 backdrop-blur-sm rounded-2xl p-8 border border-primary/30"
            >
              <div className="text-center mb-8">
                <Users className="w-16 h-16 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  {translations.booking?.step2?.title || 'Reservation Type'}
                </h2>
                <p className="text-gray-400">{translations.booking?.step2?.subtitle || 'Choose the type of activity'}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Game */}
                <motion.button
                  onClick={() => handleTypeSelect('game')}
                  className={`border-2 rounded-xl p-6 text-left transition-all duration-300 ${
                    bookingData.type === 'game'
                      ? 'bg-dark-200 border-primary/70 shadow-[0_0_20px_rgba(0,240,255,0.3)]'
                      : 'bg-dark-200/50 border-primary/30 hover:border-primary/70 hover:shadow-[0_0_20px_rgba(0,240,255,0.3)]'
                  }`}
                  whileHover={{ scale: bookingData.type === 'game' ? 1 : 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-start gap-4">
                    <Gamepad2 className={`w-8 h-8 flex-shrink-0 mt-1 ${
                      bookingData.type === 'game' ? 'text-primary' : 'text-primary/70'
                    }`} />
                    <div>
                      <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        {translations.booking?.type?.game?.title || 'Game'}
                      </h3>
                      <p className="text-gray-400 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        {translations.booking?.type?.game?.description || 'Unlimited games for one hour'}
                      </p>
                    </div>
                  </div>
                </motion.button>

                {/* Event */}
                <motion.button
                  onClick={() => handleTypeSelect('event')}
                  className={`border-2 rounded-xl p-6 text-left transition-all duration-300 ${
                    bookingData.type === 'event'
                      ? 'bg-dark-200 border-primary/70 shadow-[0_0_20px_rgba(0,240,255,0.3)]'
                      : 'bg-dark-200/50 border-primary/30 hover:border-primary/70 hover:shadow-[0_0_20px_rgba(0,240,255,0.3)]'
                  }`}
                  whileHover={{ scale: bookingData.type === 'event' ? 1 : 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-start gap-4">
                    <Users className={`w-8 h-8 flex-shrink-0 mt-1 ${
                      bookingData.type === 'event' ? 'text-primary' : 'text-primary/70'
                    }`} />
                    <div>
                      <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        {translations.booking?.type?.event?.title || 'Event'}
                      </h3>
                      <p className="text-gray-400 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        {translations.booking?.type?.event?.description || 'Event package with private room'}
                      </p>
                    </div>
                  </div>
                </motion.button>
              </div>

              {/* Number of Players - Appears when Game or Event is selected */}
              {(bookingData.type === 'game' || bookingData.type === 'event') && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6"
                >
                  <label className="block text-white mb-3 text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {translations.booking?.type?.players?.label || 'Number of players'}
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="relative">
                      <input
                        type="number"
                        min={bookingData.type === 'event' ? 15 : 1}
                        max="100"
                        value={bookingData.players || ''}
                        onChange={(e) => {
                          // Allow empty input or any number, validation happens on continue
                          const value = e.target.value === '' ? null : (e.target.value ? parseInt(e.target.value) : null)
                          handlePlayersChange(value)
                        }}
                        placeholder={translations.booking?.type?.players?.placeholder || 'Enter number of players'}
                        className="w-full border border-primary/30 rounded-lg px-4 py-3 pr-12 font-medium hover:border-primary/70 transition-all backdrop-blur-sm"
                        style={{ 
                          fontFamily: 'Poppins, sans-serif',
                          backgroundColor: 'rgba(50, 50, 70, 0.7)',
                          color: '#00f0ff',
                          outline: 'none'
                        }}
                      />
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const minValue = bookingData.type === 'event' ? 15 : 1
                            const current = bookingData.players || minValue
                            if (current < 100) handlePlayersChange(current + 1)
                          }}
                          className="p-1 hover:bg-primary/20 rounded transition-colors"
                          style={{ color: '#00f0ff' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 3L9 6H3L6 3Z" fill="currentColor" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const minValue = bookingData.type === 'event' ? 15 : 1
                            const current = bookingData.players || minValue
                            if (current > minValue) {
                              const newValue = current - 1
                              handlePlayersChange(newValue >= minValue ? newValue : null)
                            }
                          }}
                          className="p-1 hover:bg-primary/20 rounded transition-colors"
                          style={{ color: '#00f0ff' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 9L3 6H9L6 9Z" fill="currentColor" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div></div>
                  </div>
                  {/* Info text below input - en dehors du wrapper relatif */}
                  {bookingData.type === 'event' && (
                    <p className="mt-2 text-xs text-gray-400 text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {translations.booking?.type?.players?.info_event || 'Minimum 15 players required'}
                    </p>
                  )}
                  
                  {/* Continue button */}
                  {bookingData.players && bookingData.players >= (bookingData.type === 'event' ? 15 : 1) && (
                    <div className="mt-6 text-center">
                      <button
                        onClick={handleContinueToStep3}
                        className="glow-button inline-flex items-center gap-2"
                      >
                        {translations.booking?.next || 'Next'}
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                  {bookingData.type === 'event' && bookingData.players && bookingData.players < 15 && (
                    <p className="mt-2 text-sm text-primary text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {translations.booking?.type?.event?.min_players_note || 'Minimum 15 players required for events'}
                    </p>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 3: Game Type + Number of Games (for Game) OR Event Type (for Event) */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? -50 : 50 }}
              className="bg-dark-100/50 backdrop-blur-sm rounded-2xl p-8 border border-primary/30"
            >
              {/* Pour les GAMES */}
              {bookingData.type === 'game' && (
                <>
                  <div className="text-center mb-8">
                    <Gamepad2 className="w-16 h-16 text-primary mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>{t('booking.step3_game.title')}</h2>
                    <p className="text-gray-400">{t('booking.step3_game.subtitle')}</p>
                  </div>

                  <div className={`grid grid-cols-1 ${bookingData.branchSlug === 'glilot' ? 'md:grid-cols-1' : 'md:grid-cols-3'} gap-6 mb-8`}>
                    {/* Active Games - Zap bleu comme dans l'admin - Caché pour Glilot */}
                    {bookingData.branchSlug !== 'glilot' && (
                      <motion.button
                        onClick={() => handleGameAreaSelect('ACTIVE')}
                        className={`border-2 rounded-xl p-6 text-center transition-all duration-300 ${
                          bookingData.gameArea === 'ACTIVE'
                            ? 'bg-dark-200 border-blue-500/70 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                            : 'bg-dark-200/50 border-primary/30 hover:border-blue-500/70 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Zap className="w-12 h-12 mx-auto mb-3 text-blue-500" />
                        <h3 className="text-xl font-bold mb-2">Active Games</h3>
                        <p className="text-gray-400 text-sm">{t('booking.game_area.active.description')}</p>
                      </motion.button>
                    )}

                    {/* Laser - Target violet comme dans l'admin - Toujours affiché */}
                    <motion.button
                      onClick={() => handleGameAreaSelect('LASER')}
                      className={`border-2 rounded-xl p-6 text-center transition-all duration-300 ${
                        bookingData.gameArea === 'LASER'
                          ? 'bg-dark-200 border-purple-500/70 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                          : 'bg-dark-200/50 border-primary/30 hover:border-purple-500/70 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Target className="w-12 h-12 mx-auto mb-3 text-purple-500" />
                      <h3 className="text-xl font-bold mb-2">Laser City</h3>
                      <p className="text-gray-400 text-sm">{t('booking.game_area.laser.description')}</p>
                    </motion.button>

                    {/* Mix/Sur mesure - Gamepad2 cyan - Caché pour Glilot */}
                    {bookingData.branchSlug !== 'glilot' && (
                      <motion.button
                        onClick={() => handleGameAreaSelect('MIX')}
                        className={`border-2 rounded-xl p-6 text-center transition-all duration-300 ${
                          bookingData.gameArea === 'MIX'
                            ? 'bg-dark-200 border-cyan-500/70 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                            : 'bg-dark-200/50 border-primary/30 hover:border-cyan-500/70 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Gamepad2 className="w-12 h-12 mx-auto mb-3 text-cyan-500" />
                        <h3 className="text-xl font-bold mb-2">{t('booking.game_area.mix.title')}</h3>
                        <p className="text-gray-400 text-sm">{t('booking.game_area.mix.description')}</p>
                      </motion.button>
                    )}
                  </div>

                  {/* Durée/Parties - apparaît après sélection du type */}
                  {bookingData.gameArea && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border-t border-primary/20 pt-6"
                    >
                      {/* Active Games = durée en heures */}
                      {bookingData.gameArea === 'ACTIVE' && (
                        <>
                          <h3 className="text-lg font-bold text-center mb-4">{t('booking.game_duration.title')}</h3>
                          <div className="flex justify-center gap-4 mb-6">
                            {[
                              { value: 2, label: '1h' },
                              { value: 3, label: '1h30' },
                              { value: 4, label: '2h' },
                            ].map((option) => (
                              <motion.button
                                key={option.value}
                                onClick={() => handleNumberOfGamesChange(option.value)}
                                className={`px-6 py-4 rounded-xl border-2 text-xl font-bold transition-all ${
                                  bookingData.numberOfGames === option.value
                                    ? 'bg-primary text-dark border-primary shadow-[0_0_15px_rgba(0,240,255,0.5)]'
                                    : 'bg-dark-200/50 border-primary/30 text-white hover:border-primary/70'
                                }`}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                {option.label}
                              </motion.button>
                            ))}
                          </div>
                          <p className="text-center text-gray-400 text-sm mb-6">{t('booking.game_duration.unlimited')}</p>
                        </>
                      )}

                      {/* Laser = nombre de parties */}
                      {bookingData.gameArea === 'LASER' && (
                        <>
                          <h3 className="text-lg font-bold text-center mb-4">{t('booking.game_parties.title')}</h3>
                          <div className="flex justify-center gap-4 mb-6">
                            {[1, 2, 3].map((num) => (
                              <motion.button
                                key={num}
                                onClick={() => handleNumberOfGamesChange(num)}
                                className={`w-16 h-16 rounded-xl border-2 text-xl font-bold transition-all ${
                                  bookingData.numberOfGames === num
                                    ? 'bg-primary text-dark border-primary shadow-[0_0_15px_rgba(0,240,255,0.5)]'
                                    : 'bg-dark-200/50 border-primary/30 text-white hover:border-primary/70'
                                }`}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                {num}
                              </motion.button>
                            ))}
                          </div>
                          <p className="text-center text-gray-400 text-sm mb-6">
                            {bookingData.numberOfGames} partie{bookingData.numberOfGames > 1 ? 's' : ''} de laser
                          </p>
                        </>
                      )}

                      {/* Mix = message explicatif */}
                      {bookingData.gameArea === 'MIX' && (
                        <>
                          <h3 className="text-lg font-bold text-center mb-4">{t('booking.custom_formula.title')}</h3>
                          <div className={`p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 mb-6`}>
                            <p className="text-center text-purple-300">{t('booking.custom_formula.description')}<br/>
                              <span className="text-sm text-gray-400">{t('booking.custom_formula.note')}</span>
                            </p>
                          </div>
                        </>
                      )}
                      
                      <div className="text-center">
                        <button
                          onClick={handleContinueToDate}
                          className="glow-button inline-flex items-center gap-2"
                        >{t('booking.continue')}<ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </>
              )}

              {/* Pour les EVENTS - Choix du type de jeu */}
              {bookingData.type === 'event' && (
                <>
                  <div className="text-center mb-8">
                    <Cake className="w-16 h-16 text-primary mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>{t('booking.step3_event.title')}</h2>
                    <p className="text-gray-400">{t('booking.step3_event.subtitle')}</p>
                  </div>

                  <div className={`grid grid-cols-1 ${bookingData.branchSlug === 'glilot' ? 'md:grid-cols-1' : 'md:grid-cols-3'} gap-6 mb-6`}>
                    {/* Active Games 1h - Zap bleu comme dans l'admin - Caché pour Glilot */}
                    {bookingData.branchSlug !== 'glilot' && (
                      <motion.button
                        onClick={() => {
                          setBookingData({ ...bookingData, gameArea: 'ACTIVE', numberOfGames: 2, eventType: 'event_active' })
                        }}
                        className={`border-2 rounded-xl p-6 text-center transition-all duration-300 ${
                          bookingData.gameArea === 'ACTIVE'
                            ? 'bg-dark-200 border-blue-500/70 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                            : 'bg-dark-200/50 border-primary/30 hover:border-blue-500/70 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Zap className="w-12 h-12 mx-auto mb-3 text-blue-500" />
                        <h3 className="text-xl font-bold mb-2">Active Games</h3>
                        <p className="text-gray-400 text-sm">{t('booking.event_game.active_1h')}</p>
                      </motion.button>
                    )}

                    {/* Laser 2 parties - Target violet comme dans l'admin - Toujours affiché */}
                    <motion.button
                      onClick={() => {
                        setBookingData({ ...bookingData, gameArea: 'LASER', numberOfGames: 2, eventType: 'event_laser' })
                      }}
                      className={`border-2 rounded-xl p-6 text-center transition-all duration-300 ${
                        bookingData.gameArea === 'LASER'
                          ? 'bg-dark-200 border-purple-500/70 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                          : 'bg-dark-200/50 border-primary/30 hover:border-purple-500/70 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Target className="w-12 h-12 mx-auto mb-3 text-purple-500" />
                      <h3 className="text-xl font-bold mb-2">Laser City</h3>
                      <p className="text-gray-400 text-sm">{t('booking.event_game.laser_2games')}</p>
                    </motion.button>

                    {/* Mix - Gamepad2 cyan - Caché pour Glilot */}
                    {bookingData.branchSlug !== 'glilot' && (
                      <motion.button
                        onClick={() => {
                          setBookingData({ ...bookingData, gameArea: 'MIX', numberOfGames: 2, eventType: 'event_mix' })
                        }}
                        className={`border-2 rounded-xl p-6 text-center transition-all duration-300 ${
                          bookingData.gameArea === 'MIX'
                            ? 'bg-dark-200 border-cyan-500/70 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                            : 'bg-dark-200/50 border-primary/30 hover:border-cyan-500/70 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Gamepad2 className="w-12 h-12 mx-auto mb-3 text-cyan-500" />
                        <h3 className="text-xl font-bold mb-2">Mix</h3>
                        <p className="text-gray-400 text-sm">{t('booking.event_game.mix')}</p>
                      </motion.button>
                    )}
                  </div>

                  {/* Bouton Continuer */}
                  {bookingData.gameArea && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center"
                    >
                      <button
                        onClick={handleContinueToDate}
                        className="glow-button inline-flex items-center gap-2"
                      >{t('booking.continue')}<ChevronRight className="w-5 h-5" />
                      </button>
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* Step 4: Select Date */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? -50 : 50 }}
              className="bg-dark-100/50 backdrop-blur-sm rounded-2xl p-8 border border-primary/30"
            >
              <div className="text-center mb-6">
                <Calendar className="w-16 h-16 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  {translations.booking?.step3?.title || 'Select date'}
                </h2>
                <p className="text-gray-400">{translations.booking?.step3?.subtitle || 'Choose the day for your session'}</p>
              </div>

              {/* Month/Year Selector */}
              <div className="mb-6 flex items-center justify-center gap-4">
                {(() => {
                  const availableMonths = getAvailableMonths()
                  const currentMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
                  const currentIndex = availableMonths.findIndex(m => m.key === currentMonthKey)
                  
                  return (
                    <>
                      <button
                        onClick={() => {
                          if (currentIndex > 0) {
                            const prevMonth = availableMonths[currentIndex - 1]
                            setSelectedYear(prevMonth.year)
                            setSelectedMonth(prevMonth.month)
                          }
                        }}
                        disabled={currentIndex === 0}
                        className="p-2 rounded-lg bg-dark-200/50 hover:bg-dark-200 border border-primary/30 hover:border-primary/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-5 h-5 text-primary" />
                      </button>

                      <button
                        onClick={() => {
                          if (currentIndex < availableMonths.length - 1) {
                            const nextMonth = availableMonths[currentIndex + 1]
                            setSelectedYear(nextMonth.year)
                            setSelectedMonth(nextMonth.month)
                          }
                        }}
                        disabled={currentIndex === availableMonths.length - 1}
                        className="p-2 rounded-lg bg-dark-200/50 hover:bg-dark-200 border border-primary/30 hover:border-primary/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-5 h-5 text-primary" />
                      </button>
                    </>
                  )
                })()}
              </div>

              {/* Current Month Display */}
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-primary" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  {new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString(isRTL ? 'he-IL' : 'en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </h3>
              </div>

              {/* Week header - More visible */}
              <div className="grid grid-cols-7 gap-2 mb-3">
                {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                  const dayNames = isRTL 
                    ? ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
                    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                  return (
                    <div 
                      key={dayIndex} 
                      className="text-center text-sm font-bold text-primary py-2 border-b border-primary/30" 
                      style={{ fontFamily: 'Poppins, sans-serif' }}
                    >
                      {dayNames[dayIndex]}
                    </div>
                  )
                })}
              </div>

              {/* Calendar grid - 7 days per row with proper alignment */}
              <div className="grid grid-cols-7 gap-2 max-h-[500px] overflow-y-auto pr-2">
                {/* Empty cells for days before month starts */}
                {Array.from({ length: getFirstDayOffset() }).map((_, i) => (
                  <div key={`empty-${i}`} className="p-2" />
                ))}
                
                {/* Dates for selected month */}
                {getDatesForSelectedMonth().map((date) => {
                  const dateObj = new Date(date + 'T00:00:00')
                  
                  return (
                    <motion.button
                      key={date}
                      onClick={() => handleDateSelect(date)}
                      className={`rounded-lg p-3 border-2 transition-all duration-300 ${
                        bookingData.date === date
                          ? 'bg-primary text-dark border-primary shadow-[0_0_15px_rgba(0,240,255,0.5)]'
                          : 'bg-dark-200/50 border-primary/30 hover:border-primary/70 text-white'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className="text-center">
                        <div className="text-xs text-gray-400 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          {dateObj.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', { weekday: 'short' })}
                        </div>
                        <div className="text-base font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          {dateObj.getDate()}
                        </div>
                      </div>
                    </motion.button>
                  )
                })}
              </div>

              {bookingData.date && (
                <div className="mt-6 text-center">
                  <button
                    onClick={handleNext}
                    className="glow-button inline-flex items-center gap-2"
                  >
                    {translations.booking?.next || 'Next'}
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 5: Select Time */}
          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? -50 : 50 }}
              className="bg-dark-100/50 backdrop-blur-sm rounded-2xl p-8 border border-primary/30"
            >
              <div className="text-center mb-8">
                <Clock className="w-16 h-16 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  {translations.booking?.step4?.title || 'Select time'}
                </h2>
                <p className="text-gray-400">{translations.booking?.step4?.subtitle || 'Choose the time slot'}</p>
              </div>

              <div className="grid grid-cols-4 md:grid-cols-6 gap-3 mb-4">
                {availableTimes.map((time) => (
                  <motion.button
                    key={time}
                    onClick={() => handleTimeSelect(time)}
                    className={`rounded-lg p-3 border-2 transition-all duration-300 ${
                      bookingData.time === time
                        ? 'bg-primary text-dark border-primary shadow-[0_0_15px_rgba(0,240,255,0.5)]'
                        : 'bg-dark-200/50 border-primary/30 hover:border-primary/70 text-white'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="text-center font-bold text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {time}
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Note about arriving 10 minutes early */}
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-6">
                <p className="text-sm text-primary text-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {translations.booking?.arrival_note || 'Please arrive at least 10 minutes before your scheduled time'}
                </p>
              </div>


              {bookingData.time && (
                <div className="mt-6 text-center">
                  <button
                    onClick={handleNext}
                    className="glow-button inline-flex items-center gap-2"
                  >
                    {translations.booking?.next || 'Next'}
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 6: Contact Information */}
          {step === 6 && (
            <motion.div
              key="step6"
              initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? -50 : 50 }}
              className="bg-dark-100/50 backdrop-blur-sm rounded-2xl p-8 border border-primary/30"
            >
              <div className="text-center mb-8">
                <User className="w-16 h-16 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  {bookingData.type === 'event' 
                    ? (translations.booking?.step5?.title_event || 'Event Information & Contact')
                    : (translations.booking?.step5?.title || 'Contact Information')}
                </h2>
                <p className="text-gray-400">
                  {bookingData.type === 'event'
                    ? (translations.booking?.step5?.subtitle_event || 'Please fill in your contact details and event order information')
                    : (translations.booking?.step5?.subtitle || 'Please fill in your details')}
                </p>
              </div>

              <div className="space-y-6">
                {/* First Name and Last Name on same line */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* First Name */}
                  <div>
                    <label className="block text-white mb-2 text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {translations.booking?.contact?.first_name || 'First Name'}
                      <span className="text-primary ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      value={bookingData.firstName || ''}
                      onChange={(e) => handleContactInfoChange('firstName', e.target.value)}
                      placeholder={translations.booking?.contact?.first_name_placeholder || 'Enter first name'}
                      className="w-full border border-primary/30 rounded-lg px-4 py-3 font-medium hover:border-primary/70 transition-all backdrop-blur-sm"
                      style={{ 
                        fontFamily: 'Poppins, sans-serif',
                        backgroundColor: 'rgba(50, 50, 70, 0.7)',
                        color: '#00f0ff',
                        outline: 'none'
                      }}
                      required
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-white mb-2 text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {translations.booking?.contact?.last_name || 'Last Name'}
                      <span className="text-primary ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      value={bookingData.lastName || ''}
                      onChange={(e) => handleContactInfoChange('lastName', e.target.value)}
                      placeholder={translations.booking?.contact?.last_name_placeholder || 'Enter last name'}
                      className="w-full border border-primary/30 rounded-lg px-4 py-3 font-medium hover:border-primary/70 transition-all backdrop-blur-sm"
                      style={{ 
                        fontFamily: 'Poppins, sans-serif',
                        backgroundColor: 'rgba(50, 50, 70, 0.7)',
                        color: '#00f0ff',
                        outline: 'none'
                      }}
                      required
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-white mb-2 text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {translations.booking?.contact?.phone || 'Phone Number'}
                    <span className="text-primary ml-1">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-primary" />
                    <input
                      type="tel"
                      value={bookingData.phone || ''}
                      onChange={(e) => handleContactInfoChange('phone', e.target.value)}
                      placeholder="05XXXXXXXX"
                      className={`w-full border ${validationErrors.phone ? 'border-red-500' : 'border-primary/30'} rounded-lg pl-12 pr-4 py-3 font-medium hover:border-primary/70 transition-all backdrop-blur-sm`}
                      style={{ 
                        fontFamily: 'Poppins, sans-serif',
                        backgroundColor: 'rgba(50, 50, 70, 0.7)',
                        color: '#00f0ff',
                        outline: 'none'
                      }}
                      required
                    />
                    {validationErrors.phone && (
                      <div className="flex items-center gap-1 mt-1 text-red-500 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        <span>{validationErrors.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Email - Optional */}
                <div>
                  <label className="block text-white mb-2 text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {translations.booking?.contact?.email || 'Email'}
                    {bookingData.type === 'event' && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-primary" />
                    <input
                      type="email"
                      value={bookingData.email || ''}
                      onChange={(e) => handleContactInfoChange('email', e.target.value)}
                      placeholder="example@email.com"
                      className={`w-full border ${validationErrors.email ? 'border-red-500' : 'border-primary/30'} rounded-lg pl-12 pr-4 py-3 font-medium hover:border-primary/70 transition-all backdrop-blur-sm`}
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        backgroundColor: 'rgba(50, 50, 70, 0.7)',
                        color: '#00f0ff',
                        outline: 'none'
                      }}
                      required={bookingData.type === 'event'}
                    />
                    {validationErrors.email && (
                      <div className="flex items-center gap-1 mt-1 text-red-500 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        <span>{validationErrors.email}</span>
                      </div>
                    )}
                  </div>
                </div>


                {/* Special Request - Optional */}
                <div>
                  <label className="block text-white mb-2 text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {translations.booking?.contact?.special_request || 'Special Request'}
                  </label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-4 w-5 h-5 text-primary" />
                    <textarea
                      value={bookingData.specialRequest || ''}
                      onChange={(e) => handleContactInfoChange('specialRequest', e.target.value)}
                      placeholder={translations.booking?.contact?.special_request_placeholder || 'If you have any special requests, please mention them here (optional)'}
                      rows={4}
                      className="w-full border border-primary/30 rounded-lg pl-12 pr-4 py-3 font-medium hover:border-primary/70 transition-all backdrop-blur-sm resize-none"
                      style={{ 
                        fontFamily: 'Poppins, sans-serif',
                        backgroundColor: 'rgba(50, 50, 70, 0.7)',
                        color: '#00f0ff',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 7: Summary, Terms & Payment */}
          {step === 7 && (
            <motion.div
              key="step7"
              initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? -50 : 50 }}
              className="bg-dark-100/50 backdrop-blur-sm rounded-2xl p-8 border border-primary/30"
            >
              <div className="text-center mb-8">
                <Check className="w-16 h-16 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  {translations.booking?.step7?.title || 'Review & Payment'}
                </h2>
                <p className="text-gray-400">
                  {translations.booking?.step7?.subtitle || 'Please review your booking and complete the payment'}
                </p>
              </div>

              {/* Booking Summary */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-dark-200/50 rounded-xl p-6 border border-primary/30"
              >
                <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  {translations.booking?.summary?.title || 'Booking Summary'}
                </h3>
                <div className="space-y-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{translations.booking?.summary?.branch || 'Branch:'}</span>
                    <span className="font-bold">{bookingData.branch}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{translations.booking?.summary?.type || 'Type:'}</span>
                    <span className="font-bold">
                      {bookingData.type === 'game'
                        ? (translations.booking?.type?.game?.title || 'Game')
                        : (translations.booking?.type?.event?.title || 'Event')}
                    </span>
                  </div>
                  {/* Activity type (Laser/Active/Mix) */}
                  {bookingData.gameArea && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">{translations.booking?.summary?.activity || 'Activity:'}</span>
                      <span className="font-bold">
                        {bookingData.gameArea === 'ACTIVE' && (translations.booking?.game_area?.active?.title || 'Active Games')}
                        {bookingData.gameArea === 'LASER' && (translations.booking?.game_area?.laser?.title || 'Laser City')}
                        {bookingData.gameArea === 'MIX' && (translations.booking?.game_area?.mix?.title || 'Mix Active + Laser')}
                      </span>
                    </div>
                  )}
                  {/* Duration/parties for GAME */}
                  {bookingData.type === 'game' && bookingData.gameArea && bookingData.numberOfGames && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">{translations.booking?.summary?.duration || 'Duration:'}</span>
                      <span className="font-bold">
                        {bookingData.gameArea === 'ACTIVE' && (
                          bookingData.numberOfGames === 2 ? '1h' :
                          bookingData.numberOfGames === 3 ? '1h30' :
                          bookingData.numberOfGames === 4 ? '2h' :
                          bookingData.numberOfGames === 5 ? '2h30' :
                          bookingData.numberOfGames === 6 ? '3h' :
                          `${Math.floor(bookingData.numberOfGames * 30 / 60)}h${bookingData.numberOfGames * 30 % 60 > 0 ? (bookingData.numberOfGames * 30 % 60) : ''}`
                        )}
                        {bookingData.gameArea === 'LASER' && (
                          `${bookingData.numberOfGames} ${bookingData.numberOfGames === 1
                            ? (translations.booking?.game_area?.laser?.party || 'party')
                            : (translations.booking?.game_area?.laser?.parties || 'parties')}`
                        )}
                        {bookingData.gameArea === 'MIX' && t('booking.event_game.mix')}
                      </span>
                    </div>
                  )}
                  {bookingData.players && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">{translations.booking?.type?.players?.label || 'Players:'}</span>
                      <span className="font-bold">{bookingData.players}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">{translations.booking?.summary?.date || 'Date:'}</span>
                    <span className="font-bold">{bookingData.date && formatDate(bookingData.date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{translations.booking?.summary?.time || 'Time:'}</span>
                    <span className="font-bold">{bookingData.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{translations.booking?.summary?.name || 'Name:'}</span>
                    <span className="font-bold">{bookingData.firstName} {bookingData.lastName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{translations.booking?.summary?.phone || 'Phone:'}</span>
                    <span className="font-bold">{bookingData.phone}</span>
                  </div>
                  {bookingData.email && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">{translations.booking?.summary?.email || 'Email:'}</span>
                      <span className="font-bold">{bookingData.email}</span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Terms and Conditions Checkbox */}
              <div className="mt-6 p-4 bg-dark-200/30 rounded-lg border border-primary/20">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="terms-checkbox"
                    checked={bookingData.termsAccepted}
                    onChange={(e) => setBookingData({ ...bookingData, termsAccepted: e.target.checked })}
                    className="mt-0.5 w-5 h-5 rounded border-primary/30 bg-dark-200/50 text-primary focus:ring-primary focus:ring-2 cursor-pointer"
                    style={{ 
                      accentColor: '#00f0ff',
                      flexShrink: 0
                    }}
                  />
                  <div className="flex-1">
                    <label htmlFor="terms-checkbox" className="text-white text-sm cursor-pointer flex items-center" style={{ fontFamily: 'Poppins, sans-serif', lineHeight: '1.5' }}>
                      {translations.booking?.contact?.terms?.label || 'I have read and agree to the terms and rules'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="mt-3 ml-0 inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors text-sm underline"
                      style={{ fontFamily: 'Poppins, sans-serif' }}
                    >
                      <FileText className="w-4 h-4" />
                      {translations.booking?.contact?.terms?.read_terms || 'Read terms and rules'}
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Price Summary & Deposit Section */}
              {depositInfo && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-dark-200/50 rounded-xl p-6 mt-6 border border-primary/30"
                >
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    <CreditCard className="w-5 h-5 text-primary" />
                    {translations.booking?.payment?.title || 'Price Summary'}
                  </h3>

                  {/* Price breakdown */}
                  <div className="space-y-3 mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{translations.booking?.payment?.breakdown || 'Breakdown:'}</span>
                      <span className="font-bold text-white">{depositInfo.breakdown}</span>
                    </div>
                    <div className="flex justify-between text-lg">
                      <span className="text-gray-400">{translations.booking?.payment?.total || 'Total:'}</span>
                      <span className="font-bold text-primary">{depositInfo.total}₪</span>
                    </div>
                    <div className="border-t border-primary/20 pt-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-gray-400">{translations.booking?.payment?.deposit || 'Deposit to pay now:'}</span>
                          <p className="text-xs text-gray-500 mt-1">{depositInfo.explanation}</p>
                        </div>
                        <span className="font-bold text-2xl text-primary">{depositInfo.amount}₪</span>
                      </div>
                    </div>
                  </div>

                  {/* Credit Card Form */}
                  {depositInfo.amount > 0 && (
                    <div className="border-t border-primary/20 pt-6">
                      <h4 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                        <Lock className="w-4 h-4 text-green-400" />
                        {translations.booking?.payment?.card_title || 'Secure Payment'}
                      </h4>

                      <div className="space-y-4">
                        {/* Card Number */}
                        <div>
                          <label className="block text-white mb-2 text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                            {translations.booking?.payment?.card_number || 'Card Number'}
                            <span className="text-primary ml-1">*</span>
                          </label>
                          <input
                            type="text"
                            value={cardData.cc_number}
                            onChange={(e) => handleCardChange('cc_number', e.target.value)}
                            placeholder="1234 5678 9012 3456"
                            maxLength={19}
                            className="w-full border border-primary/30 rounded-lg px-4 py-3 font-medium hover:border-primary/70 transition-all backdrop-blur-sm"
                            style={{
                              fontFamily: 'monospace',
                              backgroundColor: 'rgba(50, 50, 70, 0.7)',
                              color: '#00f0ff',
                              outline: 'none',
                              letterSpacing: '2px'
                            }}
                          />
                        </div>

                        {/* Validity and CVV on same line */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-white mb-2 text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                              {translations.booking?.payment?.expiry || 'Expiry'}
                              <span className="text-primary ml-1">*</span>
                            </label>
                            <input
                              type="text"
                              value={cardData.cc_validity}
                              onChange={(e) => handleCardChange('cc_validity', e.target.value)}
                              placeholder="MM/YY"
                              maxLength={5}
                              className="w-full border border-primary/30 rounded-lg px-4 py-3 font-medium hover:border-primary/70 transition-all backdrop-blur-sm"
                              style={{
                                fontFamily: 'monospace',
                                backgroundColor: 'rgba(50, 50, 70, 0.7)',
                                color: '#00f0ff',
                                outline: 'none',
                                letterSpacing: '2px'
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-white mb-2 text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                              CVV
                              <span className="text-primary ml-1">*</span>
                            </label>
                            <input
                              type="text"
                              value={cardData.cc_cvv}
                              onChange={(e) => handleCardChange('cc_cvv', e.target.value)}
                              placeholder="123"
                              maxLength={4}
                              className="w-full border border-primary/30 rounded-lg px-4 py-3 font-medium hover:border-primary/70 transition-all backdrop-blur-sm"
                              style={{
                                fontFamily: 'monospace',
                                backgroundColor: 'rgba(50, 50, 70, 0.7)',
                                color: '#00f0ff',
                                outline: 'none',
                                letterSpacing: '2px'
                              }}
                            />
                          </div>
                        </div>

                        {/* Card Holder ID */}
                        <div>
                          <label className="block text-white mb-2 text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                            {translations.booking?.payment?.holder_id || 'ID Number (Teudat Zehut)'}
                            <span className="text-primary ml-1">*</span>
                          </label>
                          <input
                            type="text"
                            value={cardData.cc_holder_id}
                            onChange={(e) => handleCardChange('cc_holder_id', e.target.value)}
                            placeholder="123456789"
                            maxLength={9}
                            className="w-full border border-primary/30 rounded-lg px-4 py-3 font-medium hover:border-primary/70 transition-all backdrop-blur-sm"
                            style={{
                              fontFamily: 'monospace',
                              backgroundColor: 'rgba(50, 50, 70, 0.7)',
                              color: '#00f0ff',
                              outline: 'none'
                            }}
                          />
                        </div>

                        {/* Payment Error */}
                        {paymentError && (
                          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-red-500">
                              <AlertCircle className="w-5 h-5" />
                              <span style={{ fontFamily: 'Poppins, sans-serif' }}>{paymentError}</span>
                            </div>
                          </div>
                        )}

                        {/* Security Notice */}
                        <div className="flex items-center gap-2 text-gray-400 text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          <Lock className="w-3 h-3" />
                          {translations.booking?.payment?.secure_notice || 'Your payment information is encrypted and secure'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Loading state */}
                  {isLoadingDeposit && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      <span className="ml-2 text-gray-400">{translations.booking?.payment?.loading || 'Calculating...'}</span>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 8: Confirmation */}
          {step === 8 && reservationNumber && (
            <motion.div
              key="step8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`bg-dark-100/50 backdrop-blur-sm rounded-2xl p-8 border-2 shadow-[0_0_30px_rgba(0,240,255,0.3)] ${
                orderStatus === 'pending' 
                  ? 'border-yellow-500/50' 
                  : 'border-primary/50'
              }`}
            >
              <div className="text-center">
                {/* Success/Pending Icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${
                    orderStatus === 'pending' 
                      ? 'bg-yellow-500/20' 
                      : 'bg-primary/20'
                  }`}
                >
                  {orderStatus === 'pending' ? (
                    <Clock className="w-12 h-12 text-yellow-500" />
                  ) : (
                    <Check className="w-12 h-12 text-primary" />
                  )}
                </motion.div>

                {/* Title */}
                <h2 className={`text-3xl font-bold mb-2 ${orderStatus === 'pending' ? 'text-yellow-500' : 'text-primary'}`} style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  {orderStatus === 'pending' 
                    ? t('booking.confirmation.request_received')
                    : (translations.booking?.confirmation?.title || 'Reservation Confirmed!')}
                </h2>
                <p className="text-gray-300 mb-8" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {orderStatus === 'pending'
                    ? t('booking.confirmation.contact_soon')
                    : (translations.booking?.confirmation?.subtitle || 'Thank you for your reservation')}
                </p>

                {/* Pending Message */}
                {orderStatus === 'pending' && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                    <p className="text-yellow-500" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {orderMessage || t('booking.confirmation.contact_soon')}
                    </p>
                  </div>
                )}

                {/* Reservation/Request Number */}
                <div className={`border rounded-lg p-4 mb-8 ${
                  orderStatus === 'pending'
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-primary/10 border-primary/30'
                }`}>
                  <p className="text-gray-400 text-sm mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {orderStatus === 'pending'
                      ? t('booking.confirmation.request_number')
                      : (translations.booking?.confirmation?.reservation_number || 'Reservation Number')}
                  </p>
                  <p className={`text-2xl font-bold ${orderStatus === 'pending' ? 'text-yellow-500' : 'text-primary'}`} style={{ fontFamily: 'Orbitron, sans-serif', letterSpacing: '2px' }}>
                    {reservationNumber}
                  </p>
                </div>

                {/* Payment Success Banner */}
                {paymentSuccess && depositInfo && depositInfo.amount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-8"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                        <Check className="w-6 h-6 text-green-500" />
                      </div>
                      <div className="text-left">
                        <p className="text-green-500 font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          {translations.booking?.confirmation?.payment_success || 'Payment Successful!'}
                        </p>
                        <p className="text-green-400 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          {translations.booking?.confirmation?.deposit_paid || 'Deposit paid:'} {depositInfo.amount}₪
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Booking Summary */}
                <div className="bg-dark-200/50 rounded-xl p-6 mb-8 border border-primary/30 text-left max-w-2xl mx-auto">
                  <h3 className="text-xl font-bold mb-4 text-primary" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    {translations.booking?.summary?.title || 'Booking Summary'}
                  </h3>
                  <div className="space-y-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{translations.booking?.summary?.branch || 'Branch:'}</span>
                      <span className="font-bold text-white">{bookingData.branch}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{translations.booking?.summary?.type || 'Type:'}</span>
                      <span className="font-bold text-white">
                        {bookingData.type === 'game' 
                          ? (translations.booking?.type?.game?.title || 'Game')
                          : (translations.booking?.type?.event?.title || 'Event')}
                      </span>
                    </div>
                    {bookingData.players && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">{translations.booking?.type?.players?.label || 'Players:'}</span>
                        <span className="font-bold text-white">{bookingData.players}</span>
                      </div>
                    )}
                    {/* Activity type (Laser/Active/Mix) */}
                    {bookingData.gameArea && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">{translations.booking?.summary?.activity || 'Activity:'}</span>
                        <span className="font-bold text-white">
                          {bookingData.gameArea === 'ACTIVE' && (translations.booking?.game_area?.active?.title || 'Active Games')}
                          {bookingData.gameArea === 'LASER' && (translations.booking?.game_area?.laser?.title || 'Laser City')}
                          {bookingData.gameArea === 'MIX' && (translations.booking?.game_area?.mix?.title || 'Mix Active + Laser')}
                        </span>
                      </div>
                    )}
                    {/* Duration/parties for GAME */}
                    {bookingData.type === 'game' && bookingData.gameArea && bookingData.numberOfGames && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">{translations.booking?.summary?.duration || 'Duration:'}</span>
                        <span className="font-bold text-white">
                          {bookingData.gameArea === 'ACTIVE' && (
                            bookingData.numberOfGames === 2 ? '1h' :
                            bookingData.numberOfGames === 3 ? '1h30' :
                            bookingData.numberOfGames === 4 ? '2h' :
                            bookingData.numberOfGames === 5 ? '2h30' :
                            bookingData.numberOfGames === 6 ? '3h' :
                            `${Math.floor(bookingData.numberOfGames * 30 / 60)}h${bookingData.numberOfGames * 30 % 60 > 0 ? (bookingData.numberOfGames * 30 % 60) : ''}`
                          )}
                          {bookingData.gameArea === 'LASER' && (
                            `${bookingData.numberOfGames} ${bookingData.numberOfGames === 1
                              ? (translations.booking?.game_area?.laser?.party || 'party')
                              : (translations.booking?.game_area?.laser?.parties || 'parties')}`
                          )}
                          {bookingData.gameArea === 'MIX' && t('booking.event_game.mix')}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">{translations.booking?.summary?.date || 'Date:'}</span>
                      <span className="font-bold text-white">{bookingData.date && formatDate(bookingData.date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{translations.booking?.summary?.time || 'Time:'}</span>
                      <span className="font-bold text-white">{bookingData.time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('booking.summary.name')}</span>
                      <span className="font-bold text-white">{bookingData.firstName} {bookingData.lastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('booking.summary.phone')}</span>
                      <span className="font-bold text-white">{bookingData.phone}</span>
                    </div>
                    {bookingData.email && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('booking.summary.email')}</span>
                        <span className="font-bold text-white">{bookingData.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Back to Site Button */}
                <Link
                  href="/"
                  className="glow-button inline-flex items-center gap-2"
                >
                  <Home className="w-5 h-5" />
                  {translations.booking?.confirmation?.back_to_site || 'Back to Site'}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        {step !== 8 && (
        <div className="flex justify-between mt-8">
          <button
            onClick={handlePrevious}
            disabled={step === 1}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${
              step === 1
                ? 'bg-dark-200/50 text-gray-500 cursor-not-allowed'
                : 'bg-dark-200/50 hover:bg-dark-200 text-white border border-primary/30 hover:border-primary/70'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            {translations.booking?.previous || 'Previous'}
          </button>

          {/* Step 6: Next button to go to payment step */}
          {step === 6 && (
            <button
              onClick={async () => {
                await createAbortedOrder()
                setStep(7)
              }}
              disabled={
                !bookingData.firstName ||
                !bookingData.lastName ||
                !bookingData.phone ||
                !!validationErrors.phone ||
                !!(bookingData.email && validationErrors.email) ||
                (bookingData.type === 'event' && !bookingData.email)
              }
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${
                bookingData.firstName &&
                bookingData.lastName &&
                bookingData.phone &&
                !validationErrors.phone &&
                (!bookingData.email || !validationErrors.email) &&
                (bookingData.type !== 'event' || bookingData.email)
                  ? 'glow-button'
                  : 'bg-dark-200 border-2 border-primary/30 text-gray-300 cursor-not-allowed hover:border-primary/40'
              }`}
            >
              {translations.booking?.next || 'Next'}
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* Step 7: Pay and confirm button */}
          {step === 7 && (
            <button
              onClick={handleConfirm}
              disabled={
                isSubmitting ||
                isProcessingPayment ||
                !bookingData.termsAccepted ||
                !!(depositInfo && depositInfo.amount > 0 && !isCardValid())
              }
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${
                !isSubmitting &&
                !isProcessingPayment &&
                bookingData.termsAccepted &&
                (!depositInfo || depositInfo.amount === 0 || isCardValid())
                  ? 'glow-button'
                  : 'bg-dark-200 border-2 border-primary/30 text-gray-300 cursor-not-allowed hover:border-primary/40'
              }`}
              style={{
                opacity: (
                  bookingData.termsAccepted &&
                  (!depositInfo || depositInfo.amount === 0 || isCardValid())
                ) ? 1 : 0.75
              }}
            >
              {isSubmitting || isProcessingPayment ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isProcessingPayment
                    ? (translations.booking?.payment?.processing || 'Processing payment...')
                    : (translations.booking?.submitting || 'Submitting...')}
                </>
              ) : (
                <>
                  {depositInfo && depositInfo.amount > 0 ? (
                    <>
                      <CreditCard className="w-5 h-5" />
                      {translations.booking?.pay_and_confirm || `Pay ${depositInfo.amount}₪ and confirm`}
                    </>
                  ) : (
                    <>
                      {translations.booking?.confirm || 'Confirm booking'}
                      <Check className="w-5 h-5" />
                    </>
                  )}
                </>
              )}
            </button>
          )}
        </div>
        )}
        </div>
      </div>
      <Footer translations={translations} />

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)', backdropFilter: 'blur(5px)' }}
          onClick={() => setShowTermsModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-dark-100 rounded-2xl border border-primary/30 max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-primary/30">
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                {translations.booking?.contact?.terms?.title || 'Terms and Rules'}
              </h2>
              <button
                onClick={() => setShowTermsModal(false)}
                className="p-2 hover:bg-dark-200 rounded-lg transition-colors"
                style={{ color: '#00f0ff' }}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {termsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : (
                <div className="terms-content-wrapper">
                  {/* Display HTML content from database based on booking type */}
                  {bookingData.type === 'event' && termsContent.event ? (
                    <div
                      className="terms-html-content"
                      dangerouslySetInnerHTML={{ __html: termsContent.event }}
                    />
                  ) : termsContent.game ? (
                    <div
                      className="terms-html-content"
                      dangerouslySetInnerHTML={{ __html: termsContent.game }}
                    />
                  ) : (
                    /* Fallback if no content from database */
                    <div className="text-gray-400 text-center py-8">
                      {translations.booking?.contact?.terms?.loading_error || 'Terms and conditions are being loaded...'}
                    </div>
                  )}
                </div>
              )}
              <style jsx global>{`
                .terms-html-content {
                  color: #d1d5db;
                  line-height: 1.7;
                }
                .terms-html-content h2 {
                  color: #00f0ff;
                  font-size: 1.5rem;
                  font-weight: bold;
                  margin-bottom: 1rem;
                  margin-top: 1.5rem;
                  font-family: 'Orbitron', sans-serif;
                }
                .terms-html-content h2:first-child {
                  margin-top: 0;
                }
                .terms-html-content h3 {
                  color: #00f0ff;
                  font-size: 1.25rem;
                  font-weight: 600;
                  margin-bottom: 0.75rem;
                  margin-top: 1.25rem;
                }
                .terms-html-content ul {
                  list-style-type: disc;
                  padding-left: 1.5rem;
                  margin-bottom: 1rem;
                }
                .terms-html-content li {
                  margin-bottom: 0.5rem;
                }
                .terms-html-content p {
                  margin-bottom: 0.75rem;
                }
                .terms-html-content strong {
                  color: #00f0ff;
                  font-weight: 600;
                }
                .terms-html-content hr {
                  border-color: rgba(0, 240, 255, 0.3);
                  margin: 1.5rem 0;
                }
              `}</style>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-primary/30 flex justify-end">
              <button
                onClick={() => setShowTermsModal(false)}
                className="glow-button inline-flex items-center gap-2"
              >
                {translations.booking?.contact?.terms?.close || 'Close'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )
}

// Export default with Suspense wrapper
export default function ReservationPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ReservationContent />
    </Suspense>
  )
}
