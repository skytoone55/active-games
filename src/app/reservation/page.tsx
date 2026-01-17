'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Calendar, Clock, ChevronRight, ChevronLeft, Check, Users, Gamepad2, User, Phone, Mail, MessageSquare, FileText, ExternalLink, X, Home, Cake, Download, Target, Zap } from 'lucide-react'
import { getTranslations, getDirection, Locale, defaultLocale } from '@/i18n'
import { Header, Footer } from '@/components'

type BookingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7

interface BookingData {
  branch: string | null
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

export default function ReservationPage() {
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>(defaultLocale)
  const [translations, setTranslations] = useState(getTranslations(defaultLocale))
  const [step, setStep] = useState<BookingStep>(1)
  const [bookingData, setBookingData] = useState<BookingData>({
    branch: null,
    type: null,
    gameArea: null,
    numberOfGames: 2, // Par défaut 2 jeux pour Active, 1 pour Laser
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem('locale') as Locale
      if (savedLocale && ['en', 'he'].includes(savedLocale)) {
        setLocale(savedLocale)
        setTranslations(getTranslations(savedLocale))
      }
    }
  }, [])

  const isRTL = locale === 'he'
  const dir = getDirection(locale)

  // Branches from translations
  const branches = translations.branches?.items || []

  // Generate available dates (next 365 days - unlimited)
  const getAvailableDates = () => {
    const dates: string[] = []
    const today = new Date()
    
    console.log('[getAvailableDates] Today RAW:', today.toString())
    
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
    
    console.log('[getAvailableDates] First 3 dates:', dates.slice(0, 3))
    
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
    
    console.log('[getDatesByMonth] Grouped keys:', Object.keys(grouped).slice(0, 3))
    
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
    
    console.log('[getAvailableTimes] Now:', now.toISOString(), 'Selected date:', selectedDateStr, 'IsToday:', isToday)
    
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
    
    console.log('[getAvailableTimes] Generated', times.length, 'time slots, first:', times[0], 'last:', times[times.length - 1])
    
    return times
  }

  const handleBranchSelect = (branchName: string) => {
    setBookingData({ ...bookingData, branch: branchName })
    setTimeout(() => setStep(2), 300)
  }

  // Sélection du type (Game ou Event) - reste sur étape 2 pour saisir participants
  const handleTypeSelect = (type: 'game' | 'event') => {
    setBookingData({ 
      ...bookingData, 
      type, 
      gameArea: null,
      numberOfGames: type === 'game' ? 2 : 2, // 2 jeux par défaut
      players: null,
      eventType: type === 'event' ? null : null,
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
    const defaultGames = gameArea === 'LASER' ? 1 : 2
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

  const handleContactInfoChange = (field: 'firstName' | 'lastName' | 'phone' | 'email' | 'specialRequest', value: string | number) => {
    setBookingData({ ...bookingData, [field]: value })
  }

  // État pour le message de confirmation
  const [orderStatus, setOrderStatus] = useState<'auto_confirmed' | 'pending' | null>(null)
  const [orderMessage, setOrderMessage] = useState<string>('')

  const handleConfirm = async () => {
    // Protection double-click
    if (isSubmitting) {
      console.log('[handleConfirm] Already submitting, ignoring click')
      return
    }
    
    setIsSubmitting(true)
    try {
      // D'abord, récupérer le branch_id depuis le nom de la branche
      const branchesResponse = await fetch('/api/branches')
      const branchesData = await branchesResponse.json()
      
      // Trouver la branche par son nom (case insensitive)
      const selectedBranch = branchesData.branches?.find((b: { name: string; slug: string }) => 
        b.name.toLowerCase().includes(bookingData.branch?.toLowerCase() || '') ||
        b.slug.toLowerCase().includes(bookingData.branch?.toLowerCase() || '')
      )
      
      if (!selectedBranch) {
        alert('Branche non trouvée. Veuillez réessayer.')
        setIsSubmitting(false)
        return
      }
      
        // Utiliser le gameArea sélectionné par l'utilisateur
      let gameArea: 'ACTIVE' | 'LASER' | null = null
      let customerNotes = bookingData.specialRequest || ''
      
      // Pour Game et Event, on a maintenant toujours un gameArea sélectionné
      if (bookingData.gameArea) {
        if (bookingData.gameArea === 'MIX') {
          // Si "Mix", on envoie ACTIVE par défaut et on note la demande
          gameArea = 'ACTIVE'
          customerNotes = `[DEMANDE MIX Active + Laser] ${customerNotes}`.trim()
        } else {
          gameArea = bookingData.gameArea
        }
      }
      
      // Appeler la nouvelle API orders
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branch_id: selectedBranch.id,
          order_type: bookingData.type === 'event' ? 'EVENT' : 'GAME',
          requested_date: bookingData.date,
          requested_time: bookingData.time,
          participants_count: bookingData.players || 1,
          customer_first_name: bookingData.firstName,
          customer_last_name: bookingData.lastName || '',
          customer_phone: bookingData.phone,
          customer_email: bookingData.email || null,
          customer_notes: customerNotes || null,
          game_area: gameArea,
          number_of_games: bookingData.numberOfGames,
          event_type: bookingData.eventType || null,
          event_celebrant_age: bookingData.eventAge || null,
          terms_accepted: bookingData.termsAccepted,
        }),
      })
      
      const result = await response.json()
      
      console.log('[handleConfirm] API result:', result)
      
      if (result.success) {
        // L'API retourne directement reference, status, message
        setReservationNumber(result.reference)
        setOrderStatus(result.status)
        setOrderMessage(result.message || 'Booking confirmed')
        setStep(7)
      } else {
        console.error('Error saving order:', result.error)
        alert(`Erreur: ${result.error || 'Erreur lors de la sauvegarde de la réservation'}`)
      }
    } catch (error) {
      console.error('Error confirming reservation:', error)
      alert('Erreur lors de la confirmation. Veuillez réessayer.')
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
                    onClick={() => handleBranchSelect(branch.name)}
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
                    <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      Type de jeu
                    </h2>
                    <p className="text-gray-400">Choisissez votre activité</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Active Games - Zap bleu comme dans l'admin */}
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
                      <p className="text-gray-400 text-sm">Jeux interactifs et challenges</p>
                    </motion.button>

                    {/* Laser - Target violet comme dans l'admin */}
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
                      <p className="text-gray-400 text-sm">Labyrinthe laser</p>
                    </motion.button>

                    {/* Mix/Sur mesure - Gamepad2 cyan */}
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
                      <h3 className="text-xl font-bold mb-2">Sur mesure</h3>
                      <p className="text-gray-400 text-sm">Combinaison Active + Laser</p>
                    </motion.button>
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
                          <h3 className="text-lg font-bold text-center mb-4">Durée de jeu</h3>
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
                          <p className="text-center text-gray-400 text-sm mb-6">
                            Jeux illimités pendant la durée choisie
                          </p>
                        </>
                      )}

                      {/* Laser = nombre de parties */}
                      {bookingData.gameArea === 'LASER' && (
                        <>
                          <h3 className="text-lg font-bold text-center mb-4">Nombre de parties</h3>
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
                          <h3 className="text-lg font-bold text-center mb-4">Formule Sur Mesure</h3>
                          <div className={`p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 mb-6`}>
                            <p className="text-center text-purple-300">
                              Combinaison Active Games + Laser City<br/>
                              <span className="text-sm text-gray-400">Nous vous contacterons pour personnaliser votre expérience</span>
                            </p>
                          </div>
                        </>
                      )}
                      
                      <div className="text-center">
                        <button
                          onClick={handleContinueToDate}
                          className="glow-button inline-flex items-center gap-2"
                        >
                          Continuer
                          <ChevronRight className="w-5 h-5" />
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
                    <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      Type de jeux
                    </h2>
                    <p className="text-gray-400">Quelle activité pour votre événement ?</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Active Games 1h - Zap bleu comme dans l'admin */}
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
                      <p className="text-gray-400 text-sm">1 heure de jeux</p>
                    </motion.button>

                    {/* Laser 2 parties - Target violet comme dans l'admin */}
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
                      <p className="text-gray-400 text-sm">2 parties de laser</p>
                    </motion.button>

                    {/* Mix - Gamepad2 cyan */}
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
                      <p className="text-gray-400 text-sm">30min Active + 1 Laser</p>
                    </motion.button>
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
                      >
                        Continuer
                        <ChevronRight className="w-5 h-5" />
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
                      
                      <div className="relative">
                        <select
                          value={currentMonthKey}
                          onChange={(e) => {
                            const [year, month] = e.target.value.split('-').map(Number)
                            setSelectedYear(year)
                            setSelectedMonth(month)
                          }}
                          className="month-selector border-2 border-primary/30 rounded-lg px-4 py-2 pr-10 font-bold text-lg hover:border-primary/70 transition-all cursor-pointer backdrop-blur-sm"
                          style={{ 
                            minWidth: '200px',
                            outline: 'none'
                          }}
                        >
                          {availableMonths.map(({ year, month, key }) => (
                            <option 
                              key={key} 
                              value={key}
                            >
                              {new Date(year, month, 1).toLocaleDateString(isRTL ? 'he-IL' : 'en-US', { 
                                month: 'long', 
                                year: 'numeric' 
                              })}
                            </option>
                          ))}
                        </select>
                        <div 
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none"
                          style={{ color: '#00f0ff', zIndex: 1 }}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 9L1 4h10z" fill="currentColor" />
                          </svg>
                        </div>
                      </div>

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
                      placeholder={translations.booking?.contact?.phone_placeholder || 'Enter phone number'}
                      className="w-full border border-primary/30 rounded-lg pl-12 pr-4 py-3 font-medium hover:border-primary/70 transition-all backdrop-blur-sm"
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

                {/* Email - Optional */}
                <div>
                  <label className="block text-white mb-2 text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {translations.booking?.contact?.email || 'Email'}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-primary" />
                    <input
                      type="email"
                      value={bookingData.email || ''}
                      onChange={(e) => handleContactInfoChange('email', e.target.value)}
                      placeholder={translations.booking?.contact?.email_placeholder || 'Enter email (optional)'}
                      className="w-full border border-primary/30 rounded-lg pl-12 pr-4 py-3 font-medium hover:border-primary/70 transition-all backdrop-blur-sm"
                      style={{ 
                        fontFamily: 'Poppins, sans-serif',
                        backgroundColor: 'rgba(50, 50, 70, 0.7)',
                        color: '#00f0ff',
                        outline: 'none'
                      }}
                    />
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

              {/* Booking Summary */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-dark-200/50 rounded-xl p-6 mt-6 border border-primary/30"
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
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Step 7: Confirmation */}
          {step === 7 && reservationNumber && (
            <motion.div
              key="step7"
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
                    ? (translations.booking?.confirmation?.pending_title || 'Request Received!')
                    : (translations.booking?.confirmation?.title || 'Reservation Confirmed!')}
                </h2>
                <p className="text-gray-300 mb-8" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {orderStatus === 'pending'
                    ? (translations.booking?.confirmation?.pending_subtitle || 'We will contact you shortly to confirm your reservation')
                    : (translations.booking?.confirmation?.subtitle || 'Thank you for your reservation')}
                </p>

                {/* Pending Message */}
                {orderStatus === 'pending' && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                    <p className="text-yellow-500" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {orderMessage || 'Your request has been received. We will contact you shortly to confirm your reservation.'}
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
                      ? (translations.booking?.confirmation?.request_number || 'Request Number')
                      : (translations.booking?.confirmation?.reservation_number || 'Reservation Number')}
                  </p>
                  <p className={`text-2xl font-bold ${orderStatus === 'pending' ? 'text-yellow-500' : 'text-primary'}`} style={{ fontFamily: 'Orbitron, sans-serif', letterSpacing: '2px' }}>
                    {reservationNumber}
                  </p>
                </div>

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
                    {bookingData.gameArea && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Type de jeu:</span>
                          <span className="font-bold text-white">
                            {bookingData.gameArea === 'ACTIVE' && 'Active Games'}
                            {bookingData.gameArea === 'LASER' && 'Laser City'}
                            {bookingData.gameArea === 'MIX' && 'Mix Active + Laser'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">
                            {bookingData.gameArea === 'ACTIVE' ? 'Durée:' : 'Parties:'}
                          </span>
                          <span className="font-bold text-white">
                            {bookingData.gameArea === 'ACTIVE' && (
                              bookingData.numberOfGames === 2 ? '1h' :
                              bookingData.numberOfGames === 3 ? '1h30' :
                              bookingData.numberOfGames === 4 ? '2h' : `${bookingData.numberOfGames} parties`
                            )}
                            {bookingData.gameArea === 'LASER' && `${bookingData.numberOfGames} partie${bookingData.numberOfGames > 1 ? 's' : ''}`}
                            {bookingData.gameArea === 'MIX' && '30min Active + 1 Laser'}
                          </span>
                        </div>
                      </>
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
                      <span className="text-gray-400">Name:</span>
                      <span className="font-bold text-white">{bookingData.firstName} {bookingData.lastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Phone:</span>
                      <span className="font-bold text-white">{bookingData.phone}</span>
                    </div>
                    {bookingData.email && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Email:</span>
                        <span className="font-bold text-white">{bookingData.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Download Button */}
                <div className="flex justify-center items-center mb-6">
                  <button
                    onClick={() => {
                      // TODO: Generate and download reservation/order PDF
                      console.log('Download reservation/order:', bookingData)
                    }}
                    className="glow-button inline-flex items-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    {translations.booking?.confirmation?.download_reservation || 'Download Reservation'}
                  </button>
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
        {step !== 7 && (
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

          {step === 6 && (
            <button
              onClick={handleConfirm}
              disabled={
                isSubmitting ||
                !bookingData.firstName || 
                !bookingData.lastName || 
                !bookingData.phone || 
                !bookingData.termsAccepted
              }
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${
                !isSubmitting &&
                bookingData.firstName && 
                bookingData.lastName && 
                bookingData.phone && 
                bookingData.termsAccepted
                  ? 'glow-button'
                  : 'bg-dark-200 border-2 border-primary/30 text-gray-300 cursor-not-allowed hover:border-primary/40'
              }`}
              style={{
                opacity: (
                  bookingData.firstName && 
                  bookingData.lastName && 
                  bookingData.phone && 
                  bookingData.termsAccepted
                ) ? 1 : 0.75
              }}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  {translations.booking?.confirm || 'Confirm booking'}
                  <Check className="w-5 h-5" />
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
              <div className="space-y-4 text-gray-300">
                {/* Show different terms for Event vs Game */}
                {bookingData.type === 'event' ? (
                  /* Event Terms - Simplified to avoid errors */
                  <div>
                    <div>
                      <h3 className="text-xl font-bold text-primary mb-2">Event Booking Information</h3>
                      <ul className="list-disc list-inside space-y-2 ml-4">
                        <li>Event reservations require a minimum of 15 participants</li>
                        <li>Please arrive at least 15 minutes before your scheduled time for setup</li>
                        <li>Reservations are confirmed upon payment</li>
                        <li>Changes or cancellations must be made at least 48 hours in advance</li>
                      </ul>
                    </div>
                    <div className="mt-4">
                      <h3 className="text-xl font-bold text-primary mb-2">Event Rules and Regulations</h3>
                      <ul className="list-disc list-inside space-y-2 ml-4">
                        <li>Follow all safety instructions provided by staff</li>
                        <li>Respect other participants and maintain a friendly environment</li>
                        <li>No food or drinks inside the game rooms without authorization</li>
                        <li>Smoking is strictly prohibited</li>
                        <li>Children under 12 must be accompanied by an adult</li>
                        <li>Any damage to equipment will result in additional charges</li>
                      </ul>
                    </div>
                    <div className="mt-4">
                      <h3 className="text-xl font-bold text-primary mb-2">Event Payment Details</h3>
                      <ul className="list-disc list-inside space-y-2 ml-4">
                        <li>Payment is required at the time of booking</li>
                        <li>Accepted payment methods: Cash, Credit Card, Bank Transfer</li>
                        <li>Refunds are available only for cancellations made 48+ hours in advance</li>
                        <li>Event packages include smart bracelet in the price</li>
                      </ul>
                    </div>
                    <div className="pt-4 border-t border-primary/30 mt-4">
                      <p className="text-sm text-gray-400">
                        By checking the box, you acknowledge that you have read, understood, and agree to all event terms and conditions stated above.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Game Terms - Original */
                  <>
                    {translations.booking?.contact?.terms?.booking_info && (
                      <div>
                        <h3 className="text-xl font-bold text-primary mb-2">
                          {translations.booking.contact.terms.booking_info.title || 'Booking Information'}
                        </h3>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                          {(translations.booking.contact.terms.booking_info.items || []).map((item: string, index: number) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {translations.booking?.contact?.terms?.rules && (
                      <div>
                        <h3 className="text-xl font-bold text-primary mb-2">
                          {translations.booking.contact.terms.rules.title || 'Rules and Regulations'}
                        </h3>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                          {(translations.booking.contact.terms.rules.items || []).map((item: string, index: number) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {translations.booking?.contact?.terms?.payment && (
                      <div>
                        <h3 className="text-xl font-bold text-primary mb-2">
                          {translations.booking.contact.terms.payment.title || 'Payment Details'}
                        </h3>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                          {(translations.booking.contact.terms.payment.items || []).map((item: string, index: number) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {translations.booking?.contact?.terms?.contact && (
                      <div>
                        <h3 className="text-xl font-bold text-primary mb-2">
                          {translations.booking.contact.terms.contact.title || 'Contact Information'}
                        </h3>
                        <p>{translations.booking.contact.terms.contact.description || 'For questions or special requests, please contact us:'}</p>
                        <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                          {(translations.booking.contact.terms.contact.items || []).map((item: string, index: number) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {translations.booking?.contact?.terms?.acknowledgment && (
                      <div className="pt-4 border-t border-primary/30">
                        <p className="text-sm text-gray-400">
                          {translations.booking.contact.terms.acknowledgment}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
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
