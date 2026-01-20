'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { Loader2, CheckCircle, AlertCircle, FileText, Calendar, Users } from 'lucide-react'

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
}

export default function CGVValidationPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [cgvAccepted, setCgvAccepted] = useState(false)

  useEffect(() => {
    fetchOrder()
  }, [token])

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/cgv/${token}`)
      const data = await response.json()

      if (!data.success) {
        setError(data.error || 'Lien invalide ou expiré')
        return
      }

      setOrder(data.order)
    } catch (err) {
      console.error('Error fetching order:', err)
      setError('Erreur lors du chargement')
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
        setError(data.error || 'Erreur lors de la validation')
        return
      }

      setSuccess(true)
    } catch (err) {
      console.error('Error validating CGV:', err)
      setError('Erreur lors de la validation')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

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
          <h1 className="text-2xl font-bold text-white mb-2">Lien invalide</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return null
  }

  // Déjà validé
  if (order.cgv_validated_at || success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="max-w-md w-full text-center">
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

          <div className="flex justify-center mb-6">
            <div className="p-4 bg-green-900/30 rounded-full">
              <CheckCircle className="w-12 h-12 text-green-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">CGV acceptées</h1>
          <p className="text-gray-400 mb-4">
            Merci ! Vous avez accepté les conditions générales de vente pour votre réservation.
          </p>
          <div className="bg-gray-800 rounded-xl p-4 text-left">
            <p className="text-sm text-gray-400">Réservation</p>
            <p className="text-lg font-semibold text-white">{order.request_reference}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-8">
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

        {/* Card */}
        <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4">
            <h1 className="text-xl font-bold text-white">Validation des CGV</h1>
            <p className="text-cyan-100 text-sm mt-1">
              Merci de confirmer votre acceptation des conditions générales de vente
            </p>
          </div>

          {/* Order Info */}
          <div className="p-6">
            {/* Reference - Highlighted */}
            <div className="bg-gray-700/50 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-400 mb-1">Numéro de réservation</p>
              <p className="text-2xl font-bold text-white">{order.request_reference}</p>
            </div>

            {/* Details */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-700 rounded-lg">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Date</p>
                  <p className="text-white">{formatDate(order.requested_date)} à {order.requested_time}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-700 rounded-lg">
                  <Users className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Participants</p>
                  <p className="text-white">{order.participants_count} personnes</p>
                </div>
              </div>

              {order.event_type && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-700 rounded-lg">
                    <FileText className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Type d'événement</p>
                    <p className="text-white">{order.event_type}</p>
                  </div>
                </div>
              )}
            </div>

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
                  J'ai lu et j'accepte les{' '}
                  <a
                    href="/cgv"
                    target="_blank"
                    className="text-cyan-400 hover:text-cyan-300 underline"
                  >
                    conditions générales de vente
                  </a>
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
                  Validation en cours...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Confirmer et accepter les CGV
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
    </div>
  )
}
