'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'
import { toIsraelLocalDate } from '@/lib/dates'
import { getClient } from '@/lib/supabase/client'
import type { Booking, Contact } from '@/lib/supabase/types'

// Résultat de recherche = booking + contact CRM lié
interface SearchResultBooking extends Booking {
  primaryContact?: Pick<Contact, 'id' | 'first_name' | 'last_name' | 'phone' | 'email'> | null
}

interface AgendaSearchProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onSelectBooking: (bookingId: string, bookingDate: Date) => void
  isDark: boolean
  branchId: string | null
}

function getDisplayName(booking: SearchResultBooking): { firstName: string; lastName: string } {
  if (booking.primaryContact) {
    return {
      firstName: booking.primaryContact.first_name || '',
      lastName: booking.primaryContact.last_name || '',
    }
  }
  return {
    firstName: booking.customer_first_name || '',
    lastName: booking.customer_last_name || '',
  }
}

export function AgendaSearch({
  searchQuery,
  onSearchChange,
  onSelectBooking,
  isDark,
  branchId,
}: AgendaSearchProps) {
  const { t, locale } = useTranslation()
  const [results, setResults] = useState<SearchResultBooking[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getDateLocale = () => {
    switch (locale) {
      case 'he': return 'he-IL'
      case 'en': return 'en-US'
      default: return 'fr-FR'
    }
  }

  // Recherche Supabase avec debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const query = searchQuery.trim()
    if (query.length < 2 || !branchId) {
      setResults([])
      setHasSearched(false)
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    debounceRef.current = setTimeout(async () => {
      try {
        const supabase = getClient()
        const pattern = `%${query}%`

        const { data, error } = await supabase
          .from('bookings')
          .select('*, primaryContact:primary_contact_id(id, first_name, last_name, phone, email)')
          .eq('branch_id', branchId)
          .neq('status', 'CANCELLED')
          .or(
            `customer_first_name.ilike.${pattern},customer_last_name.ilike.${pattern},customer_phone.ilike.${pattern},customer_email.ilike.${pattern},reference_code.ilike.${pattern},notes.ilike.${pattern}`
          )
          .order('start_datetime', { ascending: false })
          .limit(20)

        if (error) {
          console.error('[AgendaSearch] Error:', error)
          setResults([])
        } else {
          setResults((data || []) as SearchResultBooking[])
        }
      } catch (err) {
        console.error('[AgendaSearch] Fetch error:', err)
        setResults([])
      } finally {
        setIsSearching(false)
        setHasSearched(true)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, branchId])

  return (
    <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 border ${isDark ? 'border-gray-700' : 'border-gray-200'} mb-6`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 relative">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('admin.agenda.search_placeholder')}
            className={`w-full pl-10 pr-4 py-3 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg text-base placeholder-gray-500 focus:border-blue-500 focus:outline-none`}
          />
        </div>

        {/* Loading */}
        {searchQuery.trim().length >= 2 && isSearching && (
          <div className={`w-96 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'} rounded-lg shadow-xl px-4 py-3 flex items-center gap-2`}>
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('admin.agenda.searching')}</span>
          </div>
        )}

        {/* Liste des résultats de recherche */}
        {searchQuery.trim().length >= 2 && !isSearching && results.length > 0 && (
          <div className={`w-96 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'} rounded-lg shadow-xl max-h-96 overflow-y-auto`}>
            <div className={`px-3 py-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} ${isDark ? 'text-white' : 'text-gray-900'} font-semibold text-sm`}>
              {results.length} {t('admin.agenda.results_found')}
            </div>
            <div className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {results.map((booking) => {
                const bookingDate = toIsraelLocalDate(new Date(booking.start_datetime))
                const dateFormatted = bookingDate.toLocaleDateString(getDateLocale(), {
                  timeZone: 'Asia/Jerusalem',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })
                const timeFormatted = `${String(bookingDate.getHours()).padStart(2, '0')}:${String(bookingDate.getMinutes()).padStart(2, '0')}`
                const { firstName, lastName } = getDisplayName(booking)
                const customerName = `${firstName} ${lastName}`.trim() || t('admin.agenda.booking.no_name')

                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onSelectBooking(booking.id, bookingDate)}
                    className={`w-full text-left px-3 py-2 ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'} truncate`}>
                          {customerName}
                        </div>
                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-0.5`}>
                          {dateFormatted} à {timeFormatted}
                        </div>
                        {booking.reference_code && (
                          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-0.5`}>
                            {t('admin.agenda.ref')}: {booking.reference_code}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: booking.status === 'CANCELLED' ? '#ef4444' : (booking.color || (booking.type === 'EVENT' ? '#22c55e' : '#3b82f6')) }}
                        />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Message si aucun résultat */}
        {searchQuery.trim().length >= 2 && !isSearching && hasSearched && results.length === 0 && (
          <div className={`w-96 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'} rounded-lg shadow-xl px-4 py-3 ${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>
            {t('admin.agenda.no_results')}
          </div>
        )}
      </div>
    </div>
  )
}
