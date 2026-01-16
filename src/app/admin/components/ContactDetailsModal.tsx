'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  X, 
  Loader2, 
  Calendar, 
  TrendingUp, 
  Gamepad2, 
  PartyPopper, 
  Clock,
  Zap,
  Target
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Contact } from '@/lib/supabase/types'

interface ContactDetailsModalProps {
  contactId: string
  onClose: () => void
  isDark: boolean
}

interface ContactStats {
  totalBookings: number
  upcomingBookings: number
  totalParticipants: number
  gameBookings: number
  eventBookings: number
  lastActivity: string | null
}

export function ContactDetailsModal({
  contactId,
  onClose,
  isDark,
}: ContactDetailsModalProps) {
  const router = useRouter()
  const [contact, setContact] = useState<Contact | null>(null)
  const [contactStats, setContactStats] = useState<ContactStats | null>(null)
  const [linkedBookings, setLinkedBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingBookings, setLoadingBookings] = useState(true)

  const getDisplayName = (c: Contact) => {
    if (c.first_name || c.last_name) {
      return `${c.first_name || ''} ${c.last_name || ''}`.trim()
    }
    return c.phone || 'Contact sans nom'
  }

  const loadContactData = useCallback(async () => {
    setLoading(true)
    setLoadingBookings(true)
    const supabase = createClient()

    // Charger le contact
    const { data: contactData } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single()

    if (contactData) {
      setContact(contactData)

      // Charger les réservations liées - 2 méthodes pour couvrir tous les cas
      let bookings: any[] = []
      const bookingIds = new Set<string>()
      
      // Méthode 1: Via booking_contacts (relation explicite)
      const { data: bookingContactsData } = await supabase
        .from('booking_contacts')
        .select('booking_id')
        .eq('contact_id', contactId)

      if (bookingContactsData) {
        bookingContactsData.forEach((bc: any) => {
          if (bc.booking_id) bookingIds.add(bc.booking_id)
        })
      }
      
      // Méthode 2: Via primary_contact_id (relation directe)
      const { data: directBookingsData } = await supabase
        .from('bookings')
        .select('id')
        .eq('primary_contact_id', contactId)

      if (directBookingsData) {
        directBookingsData.forEach((b: any) => {
          if (b.id) bookingIds.add(b.id)
        })
      }
      
      // Charger tous les bookings trouvés
      if (bookingIds.size > 0) {
        const { data: bookingsData } = await supabase
          .from('bookings')
          .select(`
            id,
            booking_type,
            booking_date,
            start_time,
            start_datetime,
            participants_count,
            status,
            reference_code,
            game_sessions (
              id,
              game_area
            )
          `)
          .in('id', Array.from(bookingIds))

        if (bookingsData) {
          bookings = bookingsData.map((b: any) => ({
            ...b,
            type: b.booking_type
          }))
        }
      }

      // Trier par date décroissante
      bookings.sort((a: any, b: any) => 
        new Date(b.start_datetime || b.booking_date).getTime() - 
        new Date(a.start_datetime || a.booking_date).getTime()
      )

      setLinkedBookings(bookings)

      // Calculer les statistiques
      const now = new Date()
      const gameCount = bookings.filter((b: any) => b.booking_type === 'GAME').length
      const eventCount = bookings.filter((b: any) => b.booking_type === 'EVENT').length
      const totalParticipants = bookings.reduce((sum: number, b: any) => sum + (b.participants_count || 0), 0)
      const upcomingCount = bookings.filter((b: any) => 
        new Date(b.start_datetime || b.booking_date) >= now && b.status !== 'CANCELLED'
      ).length
      const lastBooking = bookings.find((b: any) => b.status !== 'CANCELLED')

      setContactStats({
        totalBookings: bookings.length,
        gameBookings: gameCount,
        eventBookings: eventCount,
        totalParticipants,
        upcomingBookings: upcomingCount,
        lastActivity: lastBooking ? (lastBooking.start_datetime || lastBooking.booking_date) : null,
      })
    }

    setLoading(false)
    setLoadingBookings(false)
  }, [contactId])

  useEffect(() => {
    loadContactData()
  }, [loadContactData])

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className={`rounded-lg border p-8 ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <Loader2 className={`w-8 h-8 animate-spin ${
            isDark ? 'text-blue-400' : 'text-blue-600'
          }`} />
        </div>
      </div>
    )
  }

  if (!contact) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={`rounded-lg border max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-xl font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>Détails du contact</h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
            >
              <X className={`w-5 h-5 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`} />
            </button>
          </div>
          <div className="space-y-6">
            {/* Informations de base */}
            <div className="space-y-4">
              <div>
                <label className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>Nom complet</label>
                <p className={`font-medium text-lg ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>{getDisplayName(contact)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>Téléphone</label>
                  <p className={isDark ? 'text-white' : 'text-gray-900'}>{contact.phone}</p>
                </div>
                {contact.email && (
                  <div>
                    <label className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>Email</label>
                    <p className={isDark ? 'text-white' : 'text-gray-900'}>{contact.email}</p>
                  </div>
                )}
              </div>
              {contact.notes_client && (
                <div>
                  <label className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>Notes client</label>
                  <p className={`whitespace-pre-wrap p-3 rounded-lg ${
                    isDark
                      ? 'text-white bg-gray-700/50'
                      : 'text-gray-900 bg-gray-100'
                  }`}>{contact.notes_client}</p>
                </div>
              )}
            </div>

            {/* Statistiques */}
            {contactStats && (
              <div className={`pt-4 border-t ${
                isDark ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  <TrendingUp className="w-5 h-5" />
                  Statistiques
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className={`p-4 rounded-lg ${
                    isDark ? 'bg-gray-700/50' : 'bg-gray-100'
                  }`}>
                    <div className="text-2xl font-bold text-blue-400">{contactStats.totalBookings}</div>
                    <div className={`text-sm mt-1 ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>Réservations totales</div>
                  </div>
                  <div className={`p-4 rounded-lg ${
                    isDark ? 'bg-gray-700/50' : 'bg-gray-100'
                  }`}>
                    <div className="text-2xl font-bold text-green-400">{contactStats.upcomingBookings}</div>
                    <div className={`text-sm mt-1 ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>À venir</div>
                  </div>
                  <div className={`p-4 rounded-lg ${
                    isDark ? 'bg-gray-700/50' : 'bg-gray-100'
                  }`}>
                    <div className="text-2xl font-bold text-purple-400">{contactStats.totalParticipants}</div>
                    <div className={`text-sm mt-1 ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>Participants totaux</div>
                  </div>
                  <div className={`p-4 rounded-lg ${
                    isDark ? 'bg-gray-700/50' : 'bg-gray-100'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold text-yellow-400">{contactStats.gameBookings}</div>
                      <Gamepad2 className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-2xl font-bold text-green-400">{contactStats.eventBookings}</div>
                      <PartyPopper className="w-5 h-5 text-green-400" />
                    </div>
                    <div className={`text-sm mt-1 ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>Jeux / Événements</div>
                  </div>
                </div>
                {contactStats.lastActivity && (
                  <div className={`mt-4 flex items-center gap-2 text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <Clock className="w-4 h-4" />
                    Dernière activité: {new Date(contactStats.lastActivity).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Réservations liées */}
          <div className={`mt-6 pt-6 border-t ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              <Calendar className="w-5 h-5" />
              Réservations liées ({linkedBookings.length})
            </h3>
            {loadingBookings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className={`w-6 h-6 animate-spin ${
                  isDark ? 'text-blue-400' : 'text-blue-600'
                }`} />
              </div>
            ) : linkedBookings.length === 0 ? (
              <p className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>Aucune réservation liée à ce contact</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {linkedBookings.map((booking) => {
                  const bookingDate = new Date(booking.start_datetime || booking.booking_date)
                  const isPast = bookingDate < new Date()
                  
                  // Déterminer le type de jeu pour les GAME
                  let gameIcon = null
                  if (booking.type === 'GAME') {
                    const sessions = booking.game_sessions || []
                    if (Array.isArray(sessions) && sessions.length > 0) {
                      const gameAreas = sessions
                        .map((s: any) => {
                          return (typeof s === 'object' && s !== null) ? s.game_area : s
                        })
                        .filter(Boolean)
                      
                      const hasActive = gameAreas.includes('ACTIVE')
                      const hasLaser = gameAreas.includes('LASER')
                      
                      if (hasActive && !hasLaser) {
                        gameIcon = <Zap className="w-5 h-5 flex-shrink-0 text-blue-400" />
                      } else if (hasLaser && !hasActive) {
                        gameIcon = <Target className="w-5 h-5 flex-shrink-0 text-purple-400" />
                      } else {
                        gameIcon = <Gamepad2 className="w-5 h-5 flex-shrink-0 text-blue-400" />
                      }
                    } else {
                      gameIcon = <Gamepad2 className="w-5 h-5 flex-shrink-0 text-blue-400" />
                    }
                  }
                  
                  return (
                    <div
                      key={booking.id}
                      onClick={() => {
                        const bookingDateStr = bookingDate.toISOString().split('T')[0]
                        router.push(`/admin?date=${bookingDateStr}&booking=${booking.id}`)
                        onClose()
                      }}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isPast
                          ? isDark
                            ? 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                            : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                          : 'bg-blue-600/10 border-blue-600/30 hover:bg-blue-600/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {booking.type === 'EVENT' ? (
                            <PartyPopper className="w-5 h-5 flex-shrink-0 text-green-400" />
                          ) : (
                            gameIcon || <Gamepad2 className="w-5 h-5 flex-shrink-0 text-blue-400" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium truncate ${
                              isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                              {booking.reference_code || 'N/A'} - {booking.participants_count || 0} pers.
                            </div>
                            <div className={`text-sm ${
                              isDark ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {bookingDate.toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })} à {booking.start_time?.slice(0, 5) || ''}
                            </div>
                          </div>
                        </div>
                        {booking.status === 'CANCELLED' && (
                          <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400">
                            Annulé
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
