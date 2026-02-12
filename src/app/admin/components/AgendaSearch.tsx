'use client'

import { Search } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'
import { toIsraelLocalDate } from '@/lib/dates'
import type { BookingWithSlots } from '@/hooks/useBookings'
import type { Contact } from '@/lib/supabase/types'

interface AgendaSearchProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  searchResults: BookingWithSlots[]
  onSelectBooking: (booking: BookingWithSlots, bookingDate: Date) => void
  isDark: boolean
}

// Helper pour obtenir les données du contact
function getContactDisplayData(booking: BookingWithSlots) {
  if (booking.primaryContact) {
    return {
      firstName: booking.primaryContact.first_name || '',
      lastName: booking.primaryContact.last_name || '',
      phone: booking.primaryContact.phone || '',
      email: booking.primaryContact.email || '',
      notes: booking.primaryContact.notes_client || '',
    }
  }

  return {
    firstName: booking.customer_first_name || '',
    lastName: booking.customer_last_name || '',
    phone: booking.customer_phone || '',
    email: booking.customer_email || '',
    notes: booking.customer_notes_at_booking || '',
  }
}

export function AgendaSearch({
  searchQuery,
  onSearchChange,
  searchResults,
  onSelectBooking,
  isDark,
}: AgendaSearchProps) {
  const { t, locale } = useTranslation()

  const getDateLocale = () => {
    switch (locale) {
      case 'he': return 'he-IL'
      case 'en': return 'en-US'
      default: return 'fr-FR'
    }
  }

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

        {/* Liste des résultats de recherche */}
        {searchQuery && searchResults.length > 0 && (
          <div className={`w-96 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'} rounded-lg shadow-xl max-h-96 overflow-y-auto`}>
            <div className={`px-3 py-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} ${isDark ? 'text-white' : 'text-gray-900'} font-semibold text-sm`}>
              {searchResults.length} {t('admin.agenda.results_found')}
            </div>
            <div className="divide-y divide-gray-700">
              {searchResults.map((booking) => {
                const bookingDate = toIsraelLocalDate(new Date(booking.start_datetime))
                const dateFormatted = bookingDate.toLocaleDateString(getDateLocale(), {
                  timeZone: 'Asia/Jerusalem',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })
                const timeFormatted = `${String(bookingDate.getHours()).padStart(2, '0')}:${String(bookingDate.getMinutes()).padStart(2, '0')}`
                const contactData = getContactDisplayData(booking)
                const customerName = `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim() || t('admin.agenda.booking.no_name')

                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onSelectBooking(booking, bookingDate)}
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
        {searchQuery && searchResults.length === 0 && (
          <div className={`w-96 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'} rounded-lg shadow-xl px-4 py-3 ${isDark ? 'text-gray-400' : 'text-gray-600'} text-sm`}>
            {t('admin.agenda.no_results')}
          </div>
        )}
      </div>
    </div>
  )
}
