'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getClient } from '@/lib/supabase/client'

interface PeriodStats {
  withRoom: number
  withoutRoom: number
  totalParticipants: number
}

export interface AgendaStatsData {
  day: PeriodStats & { dateStr: string }
  week: PeriodStats & { period: string }
  month: PeriodStats & { period: string }
}

interface BookingStatsRow {
  event_room_id: string | null
  participants_count: number
}

/**
 * Hook dédié aux statistiques de l'agenda (Jour, Semaine, Mois).
 *
 * - Stats JOUR : calculées depuis les bookings déjà chargés (allBookings) pour éviter une requête supplémentaire
 * - Stats SEMAINE et MOIS : fetch Supabase léger séparé (seulement 2 colonnes) pour avoir les vraies données
 * - Se charge indépendamment de l'agenda → pas de blocage
 */
export function useAgendaStats(
  branchId: string | null,
  selectedDate: Date,
  dayBookings: Array<{ event_room_id: string | null; participants_count: number }> | null,
  locale: string
) {
  const [weekStats, setWeekStats] = useState<PeriodStats>({ withRoom: 0, withoutRoom: 0, totalParticipants: 0 })
  const [monthStats, setMonthStats] = useState<PeriodStats>({ withRoom: 0, withoutRoom: 0, totalParticipants: 0 })
  const [loading, setLoading] = useState(false)
  const fetchIdRef = useRef(0) // Pour annuler les fetches obsolètes

  const getDateLocale = () => {
    switch (locale) {
      case 'he': return 'he-IL'
      case 'en': return 'en-US'
      default: return 'fr-FR'
    }
  }

  // Calcule les bornes de la semaine (dimanche → samedi, standard israélien)
  const getWeekBounds = useCallback((date: Date) => {
    const dayOfWeek = date.getDay() // 0=dimanche, 6=samedi
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - dayOfWeek) // recule jusqu'au dimanche
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6) // samedi
    weekEnd.setHours(23, 59, 59, 999)
    return { weekStart, weekEnd }
  }, [])

  // Calcule les bornes du mois
  const getMonthBounds = useCallback((date: Date) => {
    const year = date.getFullYear()
    const monthStart = new Date(year, date.getMonth(), 1)
    monthStart.setHours(0, 0, 0, 0)
    const monthEnd = new Date(year, date.getMonth() + 1, 0)
    monthEnd.setHours(23, 59, 59, 999)
    return { monthStart, monthEnd }
  }, [])

  // Fetch les stats pour une période donnée (query légère : seulement 2 colonnes)
  const fetchPeriodStats = useCallback(async (
    branchId: string,
    startDate: string,
    endDate: string
  ): Promise<PeriodStats> => {
    const supabase = getClient()

    const { data, error } = await supabase
      .from('bookings')
      .select('event_room_id, participants_count')
      .eq('branch_id', branchId)
      .neq('status', 'CANCELLED')
      .gte('start_datetime', startDate)
      .lte('start_datetime', endDate)
      .returns<BookingStatsRow[]>()

    if (error) {
      console.error('[useAgendaStats] Error fetching period stats:', error)
      return { withRoom: 0, withoutRoom: 0, totalParticipants: 0 }
    }

    const rows = data || []
    return {
      withRoom: rows.filter(b => b.event_room_id !== null).length,
      withoutRoom: rows.filter(b => b.event_room_id === null).length,
      totalParticipants: rows.reduce((sum, b) => sum + b.participants_count, 0),
    }
  }, [])

  // Fetch week + month stats quand la date ou branche change
  useEffect(() => {
    if (!branchId) {
      setWeekStats({ withRoom: 0, withoutRoom: 0, totalParticipants: 0 })
      setMonthStats({ withRoom: 0, withoutRoom: 0, totalParticipants: 0 })
      return
    }

    const currentFetchId = ++fetchIdRef.current
    setLoading(true)

    const fetchStats = async () => {
      try {
        const { weekStart, weekEnd } = getWeekBounds(selectedDate)
        const { monthStart, monthEnd } = getMonthBounds(selectedDate)

        // Format dates pour Supabase (ISO)
        const formatForQuery = (d: Date): string => {
          const year = d.getFullYear()
          const month = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        }

        const weekStartStr = `${formatForQuery(weekStart)}T00:00:00.000Z`
        const weekEndStr = `${formatForQuery(weekEnd)}T23:59:59.999Z`
        const monthStartStr = `${formatForQuery(monthStart)}T00:00:00.000Z`
        const monthEndStr = `${formatForQuery(monthEnd)}T23:59:59.999Z`

        // Fetch les deux en parallèle
        const [week, month] = await Promise.all([
          fetchPeriodStats(branchId, weekStartStr, weekEndStr),
          fetchPeriodStats(branchId, monthStartStr, monthEndStr),
        ])

        // Vérifier que ce fetch est encore pertinent (pas de changement de date/branche entre-temps)
        if (currentFetchId !== fetchIdRef.current) return

        setWeekStats(week)
        setMonthStats(month)
      } catch (err) {
        console.error('[useAgendaStats] Error:', err)
      } finally {
        if (currentFetchId === fetchIdRef.current) {
          setLoading(false)
        }
      }
    }

    void fetchStats()
  }, [branchId, selectedDate, getWeekBounds, getMonthBounds, fetchPeriodStats])

  // Stats jour — calculées depuis les bookings déjà chargés (pas de requête supplémentaire)
  const dayStats: PeriodStats = dayBookings
    ? {
        withRoom: dayBookings.filter(b => b.event_room_id !== null).length,
        withoutRoom: dayBookings.filter(b => b.event_room_id === null).length,
        totalParticipants: dayBookings.reduce((sum, b) => sum + b.participants_count, 0),
      }
    : { withRoom: 0, withoutRoom: 0, totalParticipants: 0 }

  // Formater les labels de période
  const dateLocale = getDateLocale()
  const { weekStart, weekEnd } = getWeekBounds(selectedDate)

  const stats: AgendaStatsData = {
    day: {
      ...dayStats,
      dateStr: selectedDate.toLocaleDateString(dateLocale, { timeZone: 'Asia/Jerusalem', day: '2-digit', month: 'short' }),
    },
    week: {
      ...weekStats,
      period: `${weekStart.toLocaleDateString(dateLocale, { timeZone: 'Asia/Jerusalem', day: '2-digit', month: 'short' })} - ${weekEnd.toLocaleDateString(dateLocale, { timeZone: 'Asia/Jerusalem', day: '2-digit', month: 'short', year: 'numeric' })}`,
    },
    month: {
      ...monthStats,
      period: selectedDate.toLocaleDateString(dateLocale, { timeZone: 'Asia/Jerusalem', month: 'long', year: 'numeric' }),
    },
  }

  // Refresh function — peut être appelée après une mutation booking
  const refreshStats = useCallback(() => {
    if (!branchId) return
    // Incrémenter fetchId va déclencher un re-fetch via le useEffect
    fetchIdRef.current++
    // Force re-run the effect by updating a state that triggers it
    // Actually, since the effect depends on branchId and selectedDate which haven't changed,
    // we need a different trigger. Let's use a simple re-fetch approach.
    setLoading(true)
    const { weekStart, weekEnd } = getWeekBounds(selectedDate)
    const { monthStart, monthEnd } = getMonthBounds(selectedDate)

    const formatForQuery = (d: Date): string => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const currentFetchId = fetchIdRef.current

    Promise.all([
      fetchPeriodStats(branchId, `${formatForQuery(weekStart)}T00:00:00.000Z`, `${formatForQuery(weekEnd)}T23:59:59.999Z`),
      fetchPeriodStats(branchId, `${formatForQuery(monthStart)}T00:00:00.000Z`, `${formatForQuery(monthEnd)}T23:59:59.999Z`),
    ]).then(([week, month]) => {
      if (currentFetchId !== fetchIdRef.current) return
      setWeekStats(week)
      setMonthStats(month)
    }).catch(err => {
      console.error('[useAgendaStats] Refresh error:', err)
    }).finally(() => {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false)
      }
    })
  }, [branchId, selectedDate, getWeekBounds, getMonthBounds, fetchPeriodStats])

  return { stats, loading, refreshStats }
}
