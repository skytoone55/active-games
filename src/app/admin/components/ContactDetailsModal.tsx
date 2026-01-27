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
import { useTranslation } from '@/contexts/LanguageContext'
import type { Contact } from '@/lib/supabase/types'

interface ContactDetailsModalProps {
  contactId: string
  onClose: () => void
  isDark: boolean
  branchId?: string // Optionnel - pour filtrer par branche si fourni
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
  const { t, locale } = useTranslation()
  const [contact, setContact] = useState<Contact | null>(null)

  // Helper pour obtenir la locale de date en fonction de la langue
  const getDateLocale = () => {
    switch (locale) {
      case 'he': return 'he-IL'
      case 'en': return 'en-US'
      default: return 'fr-FR'
    }
  }
  const [contactStats, setContactStats] = useState<ContactStats | null>(null)
  const [linkedBookings, setLinkedBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingBookings, setLoadingBookings] = useState(true)

  const getDisplayName = (c: Contact) => {
    if (c.first_name || c.last_name) {
      return `${c.first_name || ''} ${c.last_name || ''}`.trim()
    }
    return c.phone || t('admin.clients.contact_no_name')
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

      // Charger les ORDERS liées au contact (pas les bookings)
      // Les orders contiennent TOUTES les commandes, y compris annulées
      const ordersList: any[] = []
      
      // Méthode 1: Via contact_id directement
      const { data: contactOrders, error: contactOrdersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_type,
          status,
          requested_date,
          requested_time,
          participants_count,
          game_area,
          request_reference,
          source,
          created_at,
          booking:bookings(id, reference_code, start_datetime, status)
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })

      if (contactOrdersError) {
        console.error('Error fetching orders by contact_id:', contactOrdersError)
      }
      if (contactOrders && Array.isArray(contactOrders)) {
        ordersList.push(...contactOrders)
      }
      
      // Méthode 2: Via téléphone (fallback pour anciennes commandes sans contact_id)
      const phoneNumber = (contactData as Contact).phone
      if (phoneNumber && ordersList.length === 0) {
        const { data: phoneOrders, error: phoneOrdersError } = await supabase
          .from('orders')
          .select(`
            id,
            order_type,
            status,
            requested_date,
            requested_time,
            participants_count,
            game_area,
            request_reference,
            source,
            created_at,
            booking:bookings(id, reference_code, start_datetime, status)
          `)
          .eq('customer_phone', phoneNumber)
          .order('created_at', { ascending: false })

        if (phoneOrdersError) {
          console.error('Error fetching orders by phone:', phoneOrdersError)
        }
        if (phoneOrders && Array.isArray(phoneOrders)) {
          // Fusionner et dédupliquer
          const existingIds = new Set(ordersList.map((o: any) => o.id))
          phoneOrders.forEach((o: any) => {
            if (!existingIds.has(o.id)) {
              ordersList.push(o)
            }
          })
        }
      }
      
      const orders = ordersList

      // Transformer les orders pour l'affichage (format similaire aux anciens bookings)
      const linkedItems = orders.map((order: any) => ({
        id: order.id,
        type: order.order_type,
        status: order.status === 'cancelled' ? 'CANCELLED' : 
                order.status === 'pending' ? 'PENDING' : 'CONFIRMED',
        start_datetime: order.booking?.start_datetime || `${order.requested_date}T${order.requested_time}`,
        participants_count: order.participants_count,
        reference_code: order.booking?.reference_code || order.request_reference,
        game_area: order.game_area,
        source: order.source,
        isOrder: true, // Flag pour identifier que c'est une order
        booking_id: order.booking?.id || null
      }))

      setLinkedBookings(linkedItems)

      // Calculer les statistiques basées sur les orders
      const now = new Date()
      const gameCount = linkedItems.filter((b: any) => b.type === 'GAME').length
      const eventCount = linkedItems.filter((b: any) => b.type === 'EVENT').length
      const totalParticipants = linkedItems
        .filter((b: any) => b.status !== 'CANCELLED')
        .reduce((sum: number, b: any) => sum + (b.participants_count || 0), 0)
      const upcomingCount = linkedItems.filter((b: any) => 
        new Date(b.start_datetime) >= now && b.status !== 'CANCELLED'
      ).length
      const lastItem = linkedItems.find((b: any) => b.status !== 'CANCELLED')

      setContactStats({
        totalBookings: linkedItems.length,
        gameBookings: gameCount,
        eventBookings: eventCount,
        totalParticipants,
        upcomingBookings: upcomingCount,
        lastActivity: lastItem ? lastItem.start_datetime : null,
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
            }`}>{t('admin.clients.contact_details')}</h2>
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
                }`}>{t('admin.clients.full_name')}</label>
                <p className={`font-medium text-lg ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>{getDisplayName(contact)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>{t('admin.clients.table.phone')}</label>
                  <p className={isDark ? 'text-white' : 'text-gray-900'}>{contact.phone}</p>
                </div>
                {contact.email && (
                  <div>
                    <label className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>{t('admin.clients.table.email')}</label>
                    <p className={isDark ? 'text-white' : 'text-gray-900'}>{contact.email}</p>
                  </div>
                )}
              </div>
              {/* Langue préférée pour les emails */}
              <div>
                <label className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>{t('admin.clients.email_language') || 'Email Language'}</label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl">
                    {contact.preferred_locale === 'he' ? '🇮🇱' : contact.preferred_locale === 'fr' ? '🇫🇷' : '🇬🇧'}
                  </span>
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>
                    {contact.preferred_locale === 'he' ? 'עברית (Hebrew)' :
                     contact.preferred_locale === 'fr' ? 'Français (French)' : 'English'}
                  </span>
                </div>
              </div>
              {contact.notes_client && (
                <div>
                  <label className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>{t('admin.clients.table.notes')}</label>
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
                  {t('admin.clients.statistics')}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className={`p-4 rounded-lg ${
                    isDark ? 'bg-gray-700/50' : 'bg-gray-100'
                  }`}>
                    <div className="text-2xl font-bold text-blue-400">{contactStats.totalBookings}</div>
                    <div className={`text-sm mt-1 ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>{t('admin.clients.stats.total_bookings')}</div>
                  </div>
                  <div className={`p-4 rounded-lg ${
                    isDark ? 'bg-gray-700/50' : 'bg-gray-100'
                  }`}>
                    <div className="text-2xl font-bold text-green-400">{contactStats.upcomingBookings}</div>
                    <div className={`text-sm mt-1 ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>{t('admin.clients.stats.upcoming')}</div>
                  </div>
                  <div className={`p-4 rounded-lg ${
                    isDark ? 'bg-gray-700/50' : 'bg-gray-100'
                  }`}>
                    <div className="text-2xl font-bold text-purple-400">{contactStats.totalParticipants}</div>
                    <div className={`text-sm mt-1 ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>{t('admin.clients.stats.total_participants')}</div>
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
                    }`}>{t('admin.clients.stats.games_events')}</div>
                  </div>
                </div>
                {contactStats.lastActivity && (
                  <div className={`mt-4 flex items-center gap-2 text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <Clock className="w-4 h-4" />
                    {t('admin.clients.stats.last_activity')}: {new Date(contactStats.lastActivity).toLocaleDateString(getDateLocale(), {
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
              {t('admin.clients.linked_bookings')} ({linkedBookings.length})
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
              }`}>{t('admin.clients.no_linked_bookings')}</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {linkedBookings.map((booking) => {
                  const bookingDate = new Date(booking.start_datetime)
                  const isPast = bookingDate < new Date()
                  const isCancelled = booking.status === 'CANCELLED'
                  const isPending = booking.status === 'PENDING'
                  
                  // Déterminer l'icône selon le type et la zone
                  let icon = null
                  if (booking.type === 'EVENT') {
                    icon = <PartyPopper className="w-5 h-5 flex-shrink-0 text-green-400" />
                  } else if (booking.game_area === 'LASER') {
                    icon = <Target className="w-5 h-5 flex-shrink-0 text-purple-400" />
                  } else {
                    icon = <Zap className="w-5 h-5 flex-shrink-0 text-blue-400" />
                  }
                  
                  return (
                    <div
                      key={booking.id}
                      onClick={() => {
                        // Toujours aller vers la fiche order dans /admin/orders
                        router.push(`/admin/orders?order=${booking.id}`)
                        onClose()
                      }}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                        isCancelled
                          ? isDark
                            ? 'bg-red-900/20 border-red-800/50 opacity-60'
                            : 'bg-red-50 border-red-200 opacity-60'
                          : isPast
                            ? isDark
                              ? 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                              : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                            : 'bg-blue-600/10 border-blue-600/30 hover:bg-blue-600/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {icon}
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium truncate ${
                              isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                              {booking.reference_code || t('admin.common.na')} - {booking.participants_count || 0} {t('admin.common.people_short')}
                            </div>
                            <div className={`text-sm flex items-center gap-2 ${
                              isDark ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              <span>
                                {bookingDate.toLocaleDateString(getDateLocale(), {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })} {t('admin.common.at')} {bookingDate.toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {booking.source && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  booking.source === 'admin_agenda'
                                    ? 'bg-orange-500/20 text-orange-400'
                                    : 'bg-teal-500/20 text-teal-400'
                                }`}>
                                  {booking.source === 'admin_agenda' ? t('admin.common.source_admin') : t('admin.common.source_site')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCancelled && (
                            <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400">
                              {t('admin.orders.status.cancelled')}
                            </span>
                          )}
                          {isPending && (
                            <span className="px-2 py-1 text-xs rounded bg-yellow-500/20 text-yellow-400">
                              {t('admin.orders.status.pending')}
                            </span>
                          )}
                        </div>
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
