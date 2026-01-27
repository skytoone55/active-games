'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { Loader2, CheckCircle, AlertCircle, FileText, Calendar, Users, X, Receipt } from 'lucide-react'
import { getTranslations, type Locale } from '@/i18n'

interface PriceBreakdownLine {
  description: string
  label?: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface OrderInfo {
  id: string
  request_reference: string
  customer_first_name: string
  customer_last_name: string | null
  requested_date: string
  requested_time: string
  participants_count: number
  event_type: string | null
  cgv_validated_at: string | null
  branch_name: string
  booking_type: 'game' | 'event'
  preferred_locale: 'he' | 'fr' | 'en'
  priceBreakdown: PriceBreakdownLine[]
  subtotal: number
  discountAmount: number
  totalAmount: number
}

function CGVValidationContent() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [cgvAccepted, setCgvAccepted] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [termsContent, setTermsContent] = useState<{ game: string | null; event: string | null }>({ game: null, event: null })
  const [termsLoading, setTermsLoading] = useState(false)

  useEffect(() => {
    fetchOrder()
  }, [token])

  // Charger les CGV quand on a les infos de la commande
  useEffect(() => {
    if (order && !termsContent.game && !termsContent.event) {
      fetchTerms(order.preferred_locale)
    }
  }, [order])

  const fetchTerms = async (locale: string) => {
    setTermsLoading(true)
    try {
      const response = await fetch(`/api/terms?lang=${locale}`)
      if (response.ok) {
        const data = await response.json()
        setTermsContent({
          game: data.game,
          event: data.event
        })
      }
    } catch (err) {
      console.error('Error fetching terms:', err)
    } finally {
      setTermsLoading(false)
    }
  }

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/cgv/${token}`)
      const data = await response.json()

      if (!data.success) {
        setError(data.error || t('cgv.error.invalid_link'))
        return
      }

      setOrder(data.order)
    } catch (err) {
      console.error('Error fetching order:', err)
      setError(t('cgv.error.loading_error'))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!cgvAccepted) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/cgv/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true })
      })

      const data = await response.json()

      if (!data.success) {
        setError(data.error || t('cgv.error.loading_error'))
        return
      }

      setSuccess(true)
    } catch (err) {
      console.error('Error validating CGV:', err)
      setError(t('cgv.error.loading_error'))
    } finally {
      setSubmitting(false)
    }
  }


  // Translation helper that uses order's locale
  const t = (key: string) => {
    const locale = (order?.preferred_locale || 'he') as Locale
    const translations = getTranslations(locale)
    const keys = key.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = translations

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return key
      }
    }

    return typeof value === 'string' ? value : key
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const locale = order?.preferred_locale || 'he'
    const localeMap = { he: 'he-IL', fr: 'fr-FR', en: 'en-US' }
    return date.toLocaleDateString(localeMap[locale], {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const isRTL = order?.preferred_locale === 'he'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-red-900/30 rounded-full">
              <AlertCircle className="w-12 h-12 text-red-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{t('cgv.error.invalid_link')}</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return null
  }

  // Déjà validé - afficher quand même les détails
  if (order.cgv_validated_at || success) {
    return (
      <div className={`min-h-screen bg-gray-900 px-4 py-8 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="max-w-lg mx-auto">
          {/* Logos */}
          <div className="flex justify-center items-center gap-6 mb-8">
            <Image
              src="/images/logo-activegames.png"
              alt="Active Games"
              width={120}
              height={45}
              className="h-12 w-auto object-contain"
            />
            <Image
              src="/images/logo_laser_city.png"
              alt="Laser City"
              width={120}
              height={45}
              className="h-12 w-auto object-contain"
            />
          </div>

          {/* Success banner */}
          <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 mb-6 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-green-400">{t('cgv.already_validated')}</h2>
              <p className="text-green-300/80 text-sm">{t('cgv.already_validated_message')}</p>
            </div>
          </div>

          {/* Order details card */}
          <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4">
              <h1 className="text-xl font-bold text-white">{t('cgv.order_details')}</h1>
            </div>

            <div className="p-6">
              {/* Reference */}
              <div className="bg-gray-700/50 rounded-xl p-4 mb-6">
                <p className="text-sm text-gray-400 mb-1">{t('cgv.reservation_number')}</p>
                <p className="text-2xl font-bold text-white">{order.request_reference}</p>
              </div>

              {/* Date & Participants */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-700 rounded-lg">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">{t('cgv.date')}</p>
                    <p className="text-white text-sm">{formatDate(order.requested_date)}</p>
                    <p className="text-cyan-400 font-medium">{order.requested_time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-700 rounded-lg">
                    <Users className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">{t('cgv.participants')}</p>
                    <p className="text-white">{order.participants_count} {t('cgv.persons')}</p>
                  </div>
                </div>
              </div>

              {/* Price Breakdown Table - Same format as AccountingModal */}
              {order.priceBreakdown && order.priceBreakdown.length > 0 && (
                <div className="border-t border-gray-700 pt-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    {t('cgv.price_breakdown')}
                  </h3>

                  {/* Table */}
                  <div className="rounded-xl border border-gray-700 overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium bg-gray-700/50 text-gray-400">
                      <div className="col-span-5">{t('cgv.description')}</div>
                      <div className="col-span-2 text-center">{t('cgv.qty')}</div>
                      <div className="col-span-2 text-right">{t('cgv.unit_price')}</div>
                      <div className="col-span-3 text-right">{t('cgv.total')}</div>
                    </div>

                    {/* Table Rows */}
                    <div className="divide-y divide-gray-700">
                      {order.priceBreakdown.map((line, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 px-4 py-3 text-gray-300">
                          <div className="col-span-5">
                            <span className="font-medium text-white">{line.description}</span>
                            {line.label && (
                              <span className="block text-xs text-gray-500 mt-0.5">{line.label}</span>
                            )}
                          </div>
                          <div className="col-span-2 text-center">{line.quantity}</div>
                          <div className="col-span-2 text-right">{line.unitPrice.toLocaleString()} ₪</div>
                          <div className="col-span-3 text-right font-medium text-white">
                            {line.totalPrice.toLocaleString()} ₪
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer - Totals */}
                    <div className="px-4 py-3 bg-gray-700/30 space-y-2">
                      {/* Discount if any */}
                      {order.discountAmount > 0 && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">{t('cgv.subtotal')}</span>
                            <span className="text-gray-300">{order.subtotal.toLocaleString()} ₪</span>
                          </div>
                          <div className="flex justify-between text-sm text-green-400">
                            <span>{t('cgv.discount')}</span>
                            <span>-{order.discountAmount.toLocaleString()} ₪</span>
                          </div>
                        </>
                      )}

                      {/* Total */}
                      <div className={`flex justify-between items-center pt-2 ${
                        order.discountAmount > 0 ? 'border-t border-gray-600' : ''
                      }`}>
                        <span className="text-lg font-bold text-white">{t('cgv.total')}</span>
                        <span className="text-2xl font-bold text-cyan-400">{order.totalAmount.toLocaleString()} ₪</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-gray-500 text-sm mt-6">
            {order.branch_name} • Active Games World
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-900 px-4 py-8 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-lg mx-auto">
        {/* Logos */}
        <div className="flex justify-center items-center gap-6 mb-8">
          <Image
            src="/images/logo-activegames.png"
            alt="Active Games"
            width={140}
            height={53}
            className="h-14 w-auto object-contain"
          />
          <Image
            src="/images/logo_laser_city.png"
            alt="Laser City"
            width={140}
            height={53}
            className="h-14 w-auto object-contain"
          />
        </div>

        {/* Action Required Banner */}
        <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="w-8 h-8 text-amber-400 flex-shrink-0" />
          <div>
            <h2 className="text-lg font-semibold text-amber-400">{t('cgv.action_required')}</h2>
            <p className="text-amber-300/80 text-sm">{t('cgv.page_subtitle')}</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4">
            <h1 className="text-xl font-bold text-white">{t('orderDetails')}</h1>
          </div>

          {/* Order Info */}
          <div className="p-6">
            {/* Reference - Highlighted */}
            <div className="bg-gray-700/50 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-400 mb-1">{t('reservationNumber')}</p>
              <p className="text-2xl font-bold text-white">{order.request_reference}</p>
            </div>

            {/* Date & Participants */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-700 rounded-lg">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">{t('date')}</p>
                  <p className="text-white text-sm">{formatDate(order.requested_date)}</p>
                  <p className="text-cyan-400 font-medium">{order.requested_time}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-700 rounded-lg">
                  <Users className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">{t('participants')}</p>
                  <p className="text-white">{order.participants_count} {t('persons')}</p>
                </div>
              </div>
            </div>

            {order.event_type && (
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gray-700 rounded-lg">
                  <FileText className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">{t('cgv.event_type')}</p>
                  <p className="text-white">{order.event_type}</p>
                </div>
              </div>
            )}

            {/* Price Breakdown Table - DEVIS */}
            {order.priceBreakdown && order.priceBreakdown.length > 0 && (
              <div className="border-t border-gray-700 pt-4 mb-6">
                <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  {t('priceBreakdown')}
                </h3>

                {/* Table */}
                <div className="rounded-xl border border-gray-700 overflow-hidden">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium bg-gray-700/50 text-gray-400">
                    <div className="col-span-5">{t('description')}</div>
                    <div className="col-span-2 text-center">{t('qty')}</div>
                    <div className="col-span-2 text-right">{t('unitPrice')}</div>
                    <div className="col-span-3 text-right">{t('total')}</div>
                  </div>

                  {/* Table Rows */}
                  <div className="divide-y divide-gray-700">
                    {order.priceBreakdown.map((line, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 px-4 py-3 text-gray-300">
                        <div className="col-span-5">
                          <span className="font-medium text-white">{line.description}</span>
                          {line.label && (
                            <span className="block text-xs text-gray-500 mt-0.5">{line.label}</span>
                          )}
                        </div>
                        <div className="col-span-2 text-center">{line.quantity}</div>
                        <div className="col-span-2 text-right">{line.unitPrice.toLocaleString()} ₪</div>
                        <div className="col-span-3 text-right font-medium text-white">
                          {line.totalPrice.toLocaleString()} ₪
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer - Totals */}
                  <div className="px-4 py-3 bg-gray-700/30 space-y-2">
                    {/* Discount if any */}
                    {order.discountAmount > 0 && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">{t('subtotal')}</span>
                          <span className="text-gray-300">{order.subtotal.toLocaleString()} ₪</span>
                        </div>
                        <div className="flex justify-between text-sm text-green-400">
                          <span>{t('discount')}</span>
                          <span>-{order.discountAmount.toLocaleString()} ₪</span>
                        </div>
                      </>
                    )}

                    {/* Total */}
                    <div className={`flex justify-between items-center pt-2 ${
                      order.discountAmount > 0 ? 'border-t border-gray-600' : ''
                    }`}>
                      <span className="text-lg font-bold text-white">{t('total')}</span>
                      <span className="text-2xl font-bold text-cyan-400">{order.totalAmount.toLocaleString()} ₪</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CGV Checkbox */}
            <div className="border-t border-gray-700 pt-6">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={cgvAccepted}
                  onChange={(e) => setCgvAccepted(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-gray-800"
                />
                <span className="text-gray-300 text-sm leading-relaxed">
                  {t('cgv.terms_checkbox')}{' '}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="text-cyan-400 hover:text-cyan-300 underline"
                  >
                    {t('cgv.terms_link')}
                  </button>
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!cgvAccepted || submitting}
              className={`w-full mt-6 py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                cgvAccepted && !submitting
                  ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('cgv.validating')}
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  {t('cgv.validate_button')}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          {order.branch_name} • Active Games World
        </p>
      </div>

      {/* Modal CGV */}
      {showTermsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowTermsModal(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">
                {t('cgv.modal.title')}
              </h2>
              <button
                onClick={() => setShowTermsModal(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {termsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                </div>
              ) : (
                <div className="terms-content-wrapper">
                  {order.booking_type === 'event' && termsContent.event ? (
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
                    <p className="text-gray-400 text-center py-8">
                      {t('cgv.modal.loading')}
                    </p>
                  )}
                </div>
              )}
              <style jsx global>{`
                .terms-html-content {
                  color: #e5e7eb;
                  line-height: 1.6;
                }
                .terms-html-content h2 {
                  color: #fff;
                  font-size: 1.25rem;
                  font-weight: 600;
                  margin-top: 1.5rem;
                  margin-bottom: 0.75rem;
                }
                .terms-html-content h2:first-child {
                  margin-top: 0;
                }
                .terms-html-content h3 {
                  color: #fff;
                  font-size: 1.1rem;
                  font-weight: 600;
                  margin-top: 1.25rem;
                  margin-bottom: 0.5rem;
                }
                .terms-html-content ul {
                  list-style-type: disc;
                  padding-left: 1.5rem;
                  margin: 0.5rem 0;
                }
                .terms-html-content li {
                  margin-bottom: 0.25rem;
                }
                .terms-html-content p {
                  margin-bottom: 0.75rem;
                }
                .terms-html-content strong {
                  color: #fff;
                  font-weight: 600;
                }
                .terms-html-content hr {
                  border-color: #374151;
                  margin: 1.5rem 0;
                }
              `}</style>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => setShowTermsModal(false)}
                className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-medium transition-colors"
              >
                {t('cgv.modal.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CGVValidationPage() {
  return <CGVValidationContent />
}
