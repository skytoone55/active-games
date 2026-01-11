'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Calendar, Clock, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { getTranslations, getDirection, Locale, defaultLocale } from '@/i18n'
import { Header, Footer } from '@/components'

type BookingStep = 1 | 2 | 3

interface BookingData {
  branch: string | null
  date: string | null
  time: string | null
}

export default function ReservationPage() {
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>(defaultLocale)
  const [translations, setTranslations] = useState(getTranslations(defaultLocale))
  const [step, setStep] = useState<BookingStep>(1)
  const [bookingData, setBookingData] = useState<BookingData>({
    branch: null,
    date: null,
    time: null,
  })
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') as Locale
    if (savedLocale && ['en', 'he'].includes(savedLocale)) {
      setLocale(savedLocale)
      setTranslations(getTranslations(savedLocale))
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
    // Start from tomorrow, generate 365 days
    for (let i = 1; i <= 365; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      dates.push(date.toISOString().split('T')[0])
    }
    return dates
  }

  // Group dates by month
  const getDatesByMonth = () => {
    const dates = getAvailableDates()
    const grouped: { [key: string]: string[] } = {}
    
    dates.forEach((date) => {
      const dateObj = new Date(date + 'T00:00:00')
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth()).padStart(2, '0')}`
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
  const getAvailableTimes = () => {
    const times: string[] = []
    for (let hour = 10; hour <= 23; hour++) {
      // Add :00 and :30 for each hour
      times.push(`${hour.toString().padStart(2, '0')}:00`)
      if (hour < 23) { // Don't add 23:30, only go to 23:00
        times.push(`${hour.toString().padStart(2, '0')}:30`)
      }
    }
    return times
  }

  const handleBranchSelect = (branchName: string) => {
    setBookingData({ ...bookingData, branch: branchName })
    setTimeout(() => setStep(2), 300)
  }

  const handleDateSelect = (date: string) => {
    setBookingData({ ...bookingData, date })
    setTimeout(() => setStep(3), 300)
  }

  const handleTimeSelect = (time: string) => {
    setBookingData({ ...bookingData, time })
  }

  const handleNext = () => {
    if (step < 3) {
      setStep((step + 1) as BookingStep)
    }
  }

  const handlePrevious = () => {
    if (step > 1) {
      setStep((step - 1) as BookingStep)
    }
  }

  const handleConfirm = () => {
    // TODO: Submit booking data to backend
    console.log('Booking confirmed:', bookingData)
    alert(`Reservation confirmed!\nBranch: ${bookingData.branch}\nDate: ${bookingData.date}\nTime: ${bookingData.time}`)
    router.push('/')
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
  const availableTimes = getAvailableTimes()

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
          {[1, 2, 3].map((s) => (
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
              {s < 3 && (
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

          {/* Step 2: Select Date */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? -50 : 50 }}
              className="bg-dark-100/50 backdrop-blur-sm rounded-2xl p-8 border border-primary/30"
            >
              <div className="text-center mb-6">
                <Calendar className="w-16 h-16 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  {translations.booking?.step2?.title || 'Select date'}
                </h2>
                <p className="text-gray-400">{translations.booking?.step2?.subtitle || 'Choose the day for your session'}</p>
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
                          className="border border-primary/30 rounded-lg px-4 py-2 pr-10 font-bold text-lg hover:border-primary/70 transition-all cursor-pointer backdrop-blur-sm"
                          style={{ 
                            fontFamily: 'Orbitron, sans-serif',
                            backgroundColor: 'rgba(42, 42, 62, 0.9)',
                            color: '#00f0ff',
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                            textShadow: '0 0 8px rgba(0, 240, 255, 0.6)',
                            minWidth: '200px'
                          }}
                        >
                          {availableMonths.map(({ year, month, key }) => (
                            <option key={key} value={key} style={{ backgroundColor: 'rgba(26, 26, 46, 0.98)', color: '#00f0ff' }}>
                              {new Date(year, month, 1).toLocaleDateString(isRTL ? 'he-IL' : 'en-US', { 
                                month: 'long', 
                                year: 'numeric' 
                              })}
                            </option>
                          ))}
                        </select>
                        <div 
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none"
                          style={{ color: '#00f0ff' }}
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
                  {new Date(selectedYear, selectedMonth, 1).toLocaleDateString(isRTL ? 'he-IL' : 'en-US', { 
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

          {/* Step 3: Select Time */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? -50 : 50 }}
              className="bg-dark-100/50 backdrop-blur-sm rounded-2xl p-8 border border-primary/30"
            >
              <div className="text-center mb-8">
                <Clock className="w-16 h-16 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  {translations.booking?.step3?.title || 'Select time'}
                </h2>
                <p className="text-gray-400">{translations.booking?.step3?.subtitle || 'Choose the time slot'}</p>
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
                  {(translations.booking as any)?.arrival_note || 'Please arrive at least 10 minutes before your scheduled time'}
                </p>
              </div>

              {/* Booking Summary */}
              {bookingData.time && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-dark-200/50 rounded-xl p-6 mb-6 border border-primary/30"
                >
                  <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    Booking Summary
                  </h3>
                  <div className="space-y-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Branch:</span>
                      <span className="font-bold">{bookingData.branch}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Date:</span>
                      <span className="font-bold">{bookingData.date && formatDate(bookingData.date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Time:</span>
                      <span className="font-bold">{bookingData.time}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
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

          {step === 3 && bookingData.time && (
            <button
              onClick={handleConfirm}
              className="glow-button inline-flex items-center gap-2"
            >
              {translations.booking?.confirm || 'Confirm booking'}
              <Check className="w-5 h-5" />
            </button>
          )}
        </div>
        </div>
      </div>
      <Footer translations={translations} />
    </div>
  )
}
