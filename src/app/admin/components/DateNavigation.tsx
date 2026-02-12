'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'

interface DateNavigationProps {
  selectedDate: Date
  onDateChange: (date: Date) => void
  view: 'day' | 'week'
  onViewChange: (view: 'day' | 'week') => void
}

export function DateNavigation({
  selectedDate,
  onDateChange,
  view,
  onViewChange,
}: DateNavigationProps) {
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

  // Helper pour obtenir les jours de la semaine traduits (format court)
  const getDaysShort = (): string[] => {
    const days = tArray('admin.agenda.days_short')
    return days.length > 0 ? days : ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  }

  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(selectedDate.getMonth())
  const [calendarYear, setCalendarYear] = useState(selectedDate.getFullYear())
  const [mounted, setMounted] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)

  // Éviter les problèmes d'hydratation
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fermer le calendrier quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false)
      }
    }

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCalendar])

  const formatDateLong = (date: Date) => {
    return date.toLocaleDateString(getDateLocale(), {
      timeZone: 'Asia/Jerusalem',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const formatWeekRange = () => {
    const startOfWeek = getStartOfWeek(selectedDate)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(endOfWeek.getDate() + 6)

    const startStr = startOfWeek.toLocaleDateString(getDateLocale(), { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'short' })
    const endStr = endOfWeek.toLocaleDateString(getDateLocale(), { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'short', year: 'numeric' })

    return `${startStr} - ${endStr}`
  }

  const getStartOfWeek = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const handlePrevious = () => {
    const newDate = new Date(selectedDate)
    if (view === 'day') {
      newDate.setDate(newDate.getDate() - 1)
    } else {
      newDate.setDate(newDate.getDate() - 7)
    }
    onDateChange(newDate)
  }

  const handleNext = () => {
    const newDate = new Date(selectedDate)
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + 1)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    onDateChange(newDate)
  }

  const handleToday = () => {
    onDateChange(new Date())
    setShowCalendar(false)
  }

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (month: number, year: number) => {
    const day = new Date(year, month, 1).getDay()
    return day === 0 ? 6 : day - 1 // Lundi = 0
  }

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calendarMonth, calendarYear)
    const firstDay = getFirstDayOfMonth(calendarMonth, calendarYear)
    const days = []

    // Jours du mois précédent
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2" />)
    }

    // Jours du mois
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(calendarYear, calendarMonth, day)
      const isToday = date.toDateString() === new Date().toDateString()
      const isSelected = date.toDateString() === selectedDate.toDateString()

      days.push(
        <button
          key={day}
          onClick={() => {
            onDateChange(date)
            setShowCalendar(false)
          }}
          className={`p-2 rounded-lg text-sm transition-colors ${
            isSelected
              ? 'bg-blue-600 text-white'
              : isToday
              ? 'bg-blue-600/20 text-blue-400'
              : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          {day}
        </button>
      )
    }

    return days
  }

  // monthNames est maintenant dynamique via getMonthName()

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Sélecteur de vue */}
      <div className="flex bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => onViewChange('day')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === 'day'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {t('admin.agenda.view.day')}
        </button>
        <button
          onClick={() => onViewChange('week')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === 'week'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {t('admin.agenda.view.week')}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePrevious}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div ref={calendarRef} className="relative">
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors min-w-[200px] justify-center"
          >
            <CalendarDays className="w-5 h-5 text-blue-400" />
            <span className="font-medium">
              {view === 'day' ? formatDateLong(selectedDate) : formatWeekRange()}
            </span>
          </button>

          {mounted && showCalendar && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 p-4">
              {/* Navigation mois */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => {
                    if (calendarMonth === 0) {
                      setCalendarMonth(11)
                      setCalendarYear(calendarYear - 1)
                    } else {
                      setCalendarMonth(calendarMonth - 1)
                    }
                  }}
                  className="p-1 hover:bg-gray-700 rounded-lg"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-400" />
                </button>
                <span className="text-white font-medium">
                  {getMonthName(calendarMonth)} {calendarYear}
                </span>
                <button
                  onClick={() => {
                    if (calendarMonth === 11) {
                      setCalendarMonth(0)
                      setCalendarYear(calendarYear + 1)
                    } else {
                      setCalendarMonth(calendarMonth + 1)
                    }
                  }}
                  className="p-1 hover:bg-gray-700 rounded-lg"
                >
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Jours de la semaine */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {getDaysShort().map((day, i) => (
                  <div key={i} className="p-2 text-center text-xs text-gray-500 font-medium">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendrier */}
              <div className="grid grid-cols-7 gap-1">
                {renderCalendar()}
              </div>

              {/* Bouton Aujourd'hui */}
              <button
                onClick={handleToday}
                className="w-full mt-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {t('admin.agenda.today')}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleNext}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Bouton Aujourd'hui (raccourci) */}
      <button
        onClick={handleToday}
        className="px-3 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-800 rounded-lg transition-colors"
      >
        Aujourd&apos;hui
      </button>
    </div>
  )
}
