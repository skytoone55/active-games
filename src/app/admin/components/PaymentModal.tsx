'use client'

import { useState } from 'react'
import { X, CreditCard, Banknote, Building2, FileText, Loader2, AlertCircle, CheckCircle, Lock, ShieldCheck } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'

export type PaymentMode = 'payment' | 'preauth' // paiement immédiat ou pré-autorisation

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: PaymentData) => Promise<{ success: boolean; error?: string }>
  orderId: string
  orderRef: string
  totalAmount: number
  paidAmount: number
  isDark: boolean
  // Mode initial (paiement ou pré-autorisation)
  initialMode?: PaymentMode
  // Optionnel: si on a une carte stockée pour ce client
  storedCard?: {
    tokenId: number
    last4: string
    type: string
  } | null
  // Optionnel: si on a une pré-autorisation existante
  existingPreauth?: {
    code: string
    amount: number
    ccLast4: string
  } | null
}

export interface PaymentData {
  amount: number
  paymentType: 'full' | 'deposit' | 'balance'
  paymentMethod: 'card' | 'cash' | 'transfer' | 'check'
  // Mode: paiement immédiat ou pré-autorisation
  mode?: PaymentMode
  // Pour les cartes
  cardInfo?: {
    cc_number: string
    cc_validity: string
    cc_cvv: string
    cc_holder_id: string
    cc_holder_name?: string
  }
  tokenId?: number
  saveCard?: boolean // Sauvegarder la carte pour utilisation future
  // Pour utiliser une pré-autorisation existante (J5)
  usePreauth?: boolean
  preauthCode?: string
  // Pour les chèques
  checkNumber?: string
  checkBank?: string
  checkDate?: string
  // Pour les virements
  transferReference?: string
  // Notes
  notes?: string
}

export function PaymentModal({
  isOpen,
  onClose,
  onSubmit,
  orderRef,
  totalAmount,
  paidAmount,
  isDark,
  initialMode = 'payment',
  storedCard,
  existingPreauth,
}: PaymentModalProps) {
  const { t } = useTranslation()
  const remainingAmount = Math.max(0, totalAmount - paidAmount)

  // State
  const [mode, setMode] = useState<PaymentMode>(initialMode)
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'transfer' | 'check'>('card')
  const [paymentType, setPaymentType] = useState<'full' | 'deposit' | 'balance'>('full')
  // Si préauth existe, utiliser son montant par défaut (ou le reste à payer si inférieur)
  const [amount, setAmount] = useState(
    existingPreauth
      ? Math.min(existingPreauth.amount, remainingAmount).toString()
      : remainingAmount.toString()
  )
  const [useStoredCard, setUseStoredCard] = useState(!!storedCard && !existingPreauth)
  // Sélectionner la préauth par défaut si elle existe
  const [useExistingPreauth, setUseExistingPreauth] = useState(!!existingPreauth)

  // Card fields
  const [ccNumber, setCcNumber] = useState('')
  const [ccValidity, setCcValidity] = useState('')
  const [ccCvv, setCcCvv] = useState('')
  const [ccHolderId, setCcHolderId] = useState('')
  const [ccHolderName, setCcHolderName] = useState('')
  const [saveCard, setSaveCard] = useState(false)

  // Check fields
  const [checkNumber, setCheckNumber] = useState('')
  const [checkBank, setCheckBank] = useState('')
  const [checkDate, setCheckDate] = useState('')

  // Transfer fields
  const [transferReference, setTransferReference] = useState('')

  // Notes
  const [notes, setNotes] = useState('')

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const formatCurrency = (value: number) => {
    return `${value.toLocaleString('he-IL')}₪`
  }

  // Format card number as user types (add spaces every 4 digits)
  const handleCardNumberChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 16)
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ')
    setCcNumber(formatted)
  }

  // Format validity as MM/YY
  const handleValidityChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4)
    if (cleaned.length >= 2) {
      setCcValidity(`${cleaned.slice(0, 2)}/${cleaned.slice(2)}`)
    } else {
      setCcValidity(cleaned)
    }
  }

  // Validate form
  const isValid = () => {
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return false

    // Pour pré-autorisation, montant minimum 5₪
    if (mode === 'preauth' && parsedAmount < 5) return false

    // Pour paiement, ne pas dépasser le reste à payer
    if (mode === 'payment' && parsedAmount > remainingAmount) return false

    if (paymentMethod === 'card' || mode === 'preauth') {
      // Si on utilise une pré-auth existante pour payer
      if (useExistingPreauth && existingPreauth) return true
      // Si on utilise une carte stockée
      if (useStoredCard && storedCard) return true
      // Sinon valider les champs carte
      const cleanedNumber = ccNumber.replace(/\s/g, '')
      if (cleanedNumber.length < 13 || cleanedNumber.length > 19) return false
      if (ccValidity.length !== 5) return false // MM/YY format
      if (ccCvv.length < 3 || ccCvv.length > 4) return false
      if (ccHolderId.length < 5) return false
    }

    if (paymentMethod === 'check') {
      if (!checkNumber || !checkBank) return false
    }

    return true
  }

  const handleSubmit = async () => {
    if (!isValid()) return

    setLoading(true)
    setError(null)

    const data: PaymentData = {
      amount: parseFloat(amount),
      paymentType,
      paymentMethod: mode === 'preauth' ? 'card' : paymentMethod,
      mode,
    }

    // Mode pré-autorisation ou paiement par carte
    if (mode === 'preauth' || paymentMethod === 'card') {
      // En mode préauth, on doit TOUJOURS envoyer les infos de carte (les tokens ne marchent pas pour J5)
      if (mode === 'preauth') {
        data.cardInfo = {
          cc_number: ccNumber.replace(/\s/g, ''),
          cc_validity: ccValidity.replace('/', ''),
          cc_cvv: ccCvv,
          cc_holder_id: ccHolderId,
          cc_holder_name: ccHolderName || undefined,
        }
      }
      // Mode paiement: utiliser une pré-autorisation existante pour payer
      else if (useExistingPreauth && existingPreauth) {
        data.usePreauth = true
        data.preauthCode = existingPreauth.code
      }
      // Mode paiement: utiliser une carte stockée
      else if (useStoredCard && storedCard) {
        data.tokenId = storedCard.tokenId
      }
      // Mode paiement: nouvelle carte
      else {
        data.cardInfo = {
          cc_number: ccNumber.replace(/\s/g, ''),
          cc_validity: ccValidity.replace('/', ''),
          cc_cvv: ccCvv,
          cc_holder_id: ccHolderId,
          cc_holder_name: ccHolderName || undefined,
        }
        // Sauvegarder la carte si demandé
        if (saveCard) {
          data.saveCard = true
        }
      }
    } else if (paymentMethod === 'check') {
      data.checkNumber = checkNumber
      data.checkBank = checkBank
      data.checkDate = checkDate || undefined
    } else if (paymentMethod === 'transfer') {
      data.transferReference = transferReference || undefined
    }

    if (notes) {
      data.notes = notes
    }

    try {
      const result = await onSubmit(data)
      if (result.success) {
        setLoading(false)
        setSuccess(true)
        // Ne pas fermer automatiquement - l'utilisateur fermera manuellement
      } else {
        setLoading(false)
        setError(result.error || t('admin.payment.error_generic'))
      }
    } catch (err) {
      console.error('Payment modal error:', err)
      setLoading(false)
      setError(t('admin.payment.error_generic'))
    }
  }

  const methodButtons = [
    { id: 'card' as const, icon: CreditCard, label: t('admin.payment.method_card') },
    { id: 'cash' as const, icon: Banknote, label: t('admin.payment.method_cash') },
    { id: 'transfer' as const, icon: Building2, label: t('admin.payment.method_transfer') },
    { id: 'check' as const, icon: FileText, label: t('admin.payment.method_check') },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`relative w-full max-w-lg mx-4 rounded-2xl border shadow-2xl ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div>
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('admin.payment.title')}
            </h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('admin.payment.order_ref')}: {orderRef}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success state */}
        {success ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {t('admin.payment.success')}
            </h3>
            <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {formatCurrency(parseFloat(amount))} {t('admin.payment.paid_successfully')}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
            >
              {t('admin.common.close')}
            </button>
          </div>
        ) : (
          <>
            {/* Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

              {/* Préautorisation disponible - Affichage prioritaire */}
              {existingPreauth && mode === 'payment' && (
                <div
                  onClick={() => setUseExistingPreauth(true)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    useExistingPreauth
                      ? 'border-green-500 bg-green-500/10'
                      : isDark
                        ? 'border-blue-500/50 bg-blue-500/10 hover:border-blue-500'
                        : 'border-blue-300 bg-blue-50 hover:border-blue-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        useExistingPreauth
                          ? 'bg-green-500/20'
                          : isDark ? 'bg-blue-500/20' : 'bg-blue-100'
                      }`}>
                        <ShieldCheck className={`w-6 h-6 ${
                          useExistingPreauth ? 'text-green-500' : isDark ? 'text-blue-400' : 'text-blue-600'
                        }`} />
                      </div>
                      <div>
                        <p className={`font-semibold ${
                          useExistingPreauth ? 'text-green-500' : isDark ? 'text-blue-300' : 'text-blue-700'
                        }`}>
                          {t('admin.payment.preauth_available_title')}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-lg font-bold ${
                            useExistingPreauth ? 'text-green-400' : isDark ? 'text-blue-400' : 'text-blue-600'
                          }`}>
                            {formatCurrency(existingPreauth.amount)}
                          </span>
                          <span className={`text-sm font-mono ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            •••• {existingPreauth.ccLast4}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      useExistingPreauth
                        ? 'border-green-500 bg-green-500'
                        : isDark ? 'border-gray-500' : 'border-gray-300'
                    }`}>
                      {useExistingPreauth && (
                        <CheckCircle className="w-4 h-4 text-white" />
                      )}
                    </div>
                  </div>
                  {useExistingPreauth && (
                    <p className={`text-xs mt-2 ${isDark ? 'text-green-400/70' : 'text-green-600/70'}`}>
                      {t('admin.payment.preauth_will_be_captured')}
                    </p>
                  )}
                </div>
              )}

              {/* Mode selection: Payment vs Preauthorization */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode('payment')}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    mode === 'payment'
                      ? 'border-green-500 bg-green-500/10'
                      : isDark
                        ? 'border-gray-700 hover:border-gray-600 bg-gray-800'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <CreditCard className={`w-6 h-6 ${
                    mode === 'payment' ? 'text-green-500' : isDark ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                  <div className="text-left">
                    <p className={`font-medium ${
                      mode === 'payment' ? 'text-green-500' : isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {t('admin.payment.mode_payment')}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {t('admin.payment.mode_payment_desc')}
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setMode('preauth')}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    mode === 'preauth'
                      ? 'border-blue-500 bg-blue-500/10'
                      : isDark
                        ? 'border-gray-700 hover:border-gray-600 bg-gray-800'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <ShieldCheck className={`w-6 h-6 ${
                    mode === 'preauth' ? 'text-blue-500' : isDark ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                  <div className="text-left">
                    <p className={`font-medium ${
                      mode === 'preauth' ? 'text-blue-500' : isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {t('admin.payment.mode_preauth')}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {t('admin.payment.mode_preauth_desc')}
                    </p>
                  </div>
                </button>
              </div>

              {/* Amount summary */}
              <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                    {t('admin.payment.total')}
                  </span>
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                    {t('admin.payment.already_paid')}
                  </span>
                  <span className="text-green-500 font-medium">
                    {formatCurrency(paidAmount)}
                  </span>
                </div>
                <div className={`flex justify-between items-center pt-2 border-t ${
                  isDark ? 'border-gray-700' : 'border-gray-200'
                }`}>
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {t('admin.payment.remaining')}
                  </span>
                  <span className={`text-lg font-bold ${
                    remainingAmount > 0 ? 'text-orange-500' : 'text-green-500'
                  }`}>
                    {formatCurrency(remainingAmount)}
                  </span>
                </div>
              </div>

              {/* Payment method selection - only in payment mode */}
              {mode === 'payment' ? (
              <div>
                <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('admin.payment.method')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {methodButtons.map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setPaymentMethod(id)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                        paymentMethod === id
                          ? 'border-blue-500 bg-blue-500/10'
                          : isDark
                            ? 'border-gray-700 hover:border-gray-600 bg-gray-800'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${
                        paymentMethod === id ? 'text-blue-500' : isDark ? 'text-gray-400' : 'text-gray-500'
                      }`} />
                      <span className={`text-xs ${
                        paymentMethod === id
                          ? 'text-blue-500 font-medium'
                          : isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              ) : (
                /* En mode préauthorisation, afficher un indicateur que c'est uniquement par carte */
                <div className={`p-3 rounded-xl flex items-center gap-3 ${
                  isDark ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'
                }`}>
                  <CreditCard className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                  <span className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                    {t('admin.payment.preauth_card_only')}
                  </span>
                </div>
              )}

              {/* Amount input */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('admin.payment.amount')}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min="0"
                      max={remainingAmount}
                      step="0.01"
                      dir="ltr"
                      className={`w-full py-3 ps-10 pe-4 rounded-xl border text-lg font-medium text-left ${
                        isDark
                          ? 'bg-gray-900 border-gray-700 text-white'
                          : 'bg-white border-gray-200 text-gray-900'
                      }`}
                    />
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                      isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      ₪
                    </span>
                  </div>
                  <button
                    onClick={() => setAmount(remainingAmount.toString())}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      isDark
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {t('admin.payment.pay_full')}
                  </button>
                </div>
                {/* Quick amount buttons */}
                <div className="flex gap-2 mt-2">
                  {[100, 200, 500].map((quickAmount) => (
                    <button
                      key={quickAmount}
                      onClick={() => setAmount(Math.min(quickAmount, remainingAmount).toString())}
                      disabled={quickAmount > remainingAmount}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        isDark
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-50'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50'
                      }`}
                    >
                      {quickAmount}₪
                    </button>
                  ))}
                </div>
              </div>

              {/* Card payment fields - show for card payment or preauth mode */}
              {(paymentMethod === 'card' || mode === 'preauth') && (
                <div className="space-y-4">
                  {/* Existing preauthorization option - only in payment mode */}
                  {mode === 'payment' && existingPreauth && (
                    <div className={`p-4 rounded-xl border ${
                      useExistingPreauth
                        ? 'border-green-500 bg-green-500/10'
                        : isDark ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useExistingPreauth}
                          onChange={(e) => {
                            setUseExistingPreauth(e.target.checked)
                            if (e.target.checked) setUseStoredCard(false)
                          }}
                          className="w-5 h-5 rounded border-gray-300 text-green-500 focus:ring-green-500"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <ShieldCheck className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-500'}`} />
                            <span className={isDark ? 'text-white' : 'text-gray-900'}>
                              {t('admin.payment.use_preauth')}
                            </span>
                            <span className={`font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              •••• {existingPreauth.ccLast4}
                            </span>
                          </div>
                          <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {t('admin.payment.preauth_available')}: {existingPreauth.amount}₪
                          </p>
                        </div>
                      </label>
                    </div>
                  )}

                  {/* Stored card option - only in payment mode and if no preauth selected */}
                  {mode === 'payment' && storedCard && !useExistingPreauth && (
                    <div className={`p-4 rounded-xl border ${
                      useStoredCard
                        ? 'border-blue-500 bg-blue-500/10'
                        : isDark ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useStoredCard}
                          onChange={(e) => setUseStoredCard(e.target.checked)}
                          className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-2">
                          <CreditCard className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                          <span className={isDark ? 'text-white' : 'text-gray-900'}>
                            {t('admin.payment.use_stored_card')}
                          </span>
                          <span className={`font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            •••• {storedCard.last4}
                          </span>
                        </div>
                      </label>
                    </div>
                  )}

                  {/* New card fields - show if:
                      - In preauth mode (always need card for new preauth)
                      - In payment mode without preauth selected and without stored card selected */}
                  {(mode === 'preauth' || (!useExistingPreauth && (!storedCard || !useStoredCard))) && (
                    <div className="space-y-4">
                      {/* Card number */}
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {t('admin.payment.card_number')}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={ccNumber}
                            onChange={(e) => handleCardNumberChange(e.target.value)}
                            placeholder="1234 5678 9012 3456"
                            maxLength={19}
                            dir="ltr"
                            className={`w-full px-4 py-3 ps-10 rounded-xl border font-mono text-left ${
                              isDark
                                ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600'
                                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                            }`}
                          />
                          <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                            isDark ? 'text-gray-600' : 'text-gray-400'
                          }`} />
                        </div>
                      </div>

                      {/* Validity and CVV */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('admin.payment.card_validity')}
                          </label>
                          <input
                            type="text"
                            value={ccValidity}
                            onChange={(e) => handleValidityChange(e.target.value)}
                            placeholder="MM/YY"
                            maxLength={5}
                            dir="ltr"
                            className={`w-full px-4 py-3 rounded-xl border font-mono text-left ${
                              isDark
                                ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600'
                                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                            }`}
                          />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            CVV
                          </label>
                          <input
                            type="text"
                            value={ccCvv}
                            onChange={(e) => setCcCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="123"
                            maxLength={4}
                            dir="ltr"
                            className={`w-full px-4 py-3 rounded-xl border font-mono text-left ${
                              isDark
                                ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600'
                                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Holder ID */}
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {t('admin.payment.card_holder_id')}
                        </label>
                        <input
                          type="text"
                          value={ccHolderId}
                          onChange={(e) => setCcHolderId(e.target.value.replace(/\D/g, '').slice(0, 9))}
                          placeholder="123456789"
                          maxLength={9}
                          dir="ltr"
                          className={`w-full px-4 py-3 rounded-xl border font-mono text-left ${
                            isDark
                              ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600'
                              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                          }`}
                        />
                      </div>

                      {/* Holder name (optional) */}
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {t('admin.payment.card_holder_name')} <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>({t('admin.common.optional')})</span>
                        </label>
                        <input
                          type="text"
                          value={ccHolderName}
                          onChange={(e) => setCcHolderName(e.target.value)}
                          placeholder="John Doe"
                          className={`w-full px-4 py-3 rounded-xl border ${
                            isDark
                              ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600'
                              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                          }`}
                        />
                      </div>

                      {/* Save card option - only in payment mode */}
                      {mode === 'payment' && (
                        <div className={`p-4 rounded-xl border ${
                          isDark ? 'border-gray-700' : 'border-gray-200'
                        }`}>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={saveCard}
                              onChange={(e) => setSaveCard(e.target.checked)}
                              className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                            />
                            <div>
                              <span className={isDark ? 'text-white' : 'text-gray-900'}>
                                {t('admin.payment.save_card')}
                              </span>
                              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {t('admin.payment.save_card_description')}
                              </p>
                            </div>
                          </label>
                        </div>
                      )}

                      {/* Preauth info message */}
                      {mode === 'preauth' && (
                        <div className={`p-4 rounded-xl border ${
                          isDark ? 'border-blue-500/30 bg-blue-500/10' : 'border-blue-200 bg-blue-50'
                        }`}>
                          <div className="flex items-start gap-3">
                            <ShieldCheck className={`w-5 h-5 mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                            <div>
                              <p className={`font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                {t('admin.payment.preauth_info_title')}
                              </p>
                              <p className={`text-sm mt-1 ${isDark ? 'text-blue-400/70' : 'text-blue-600/70'}`}>
                                {t('admin.payment.preauth_info_desc')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Check payment fields */}
              {paymentMethod === 'check' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {t('admin.payment.check_number')}
                      </label>
                      <input
                        type="text"
                        value={checkNumber}
                        onChange={(e) => setCheckNumber(e.target.value)}
                        className={`w-full px-4 py-3 rounded-xl border ${
                          isDark
                            ? 'bg-gray-900 border-gray-700 text-white'
                            : 'bg-white border-gray-200 text-gray-900'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {t('admin.payment.check_bank')}
                      </label>
                      <input
                        type="text"
                        value={checkBank}
                        onChange={(e) => setCheckBank(e.target.value)}
                        className={`w-full px-4 py-3 rounded-xl border ${
                          isDark
                            ? 'bg-gray-900 border-gray-700 text-white'
                            : 'bg-white border-gray-200 text-gray-900'
                        }`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {t('admin.payment.check_date')} <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>({t('admin.common.optional')})</span>
                    </label>
                    <input
                      type="date"
                      value={checkDate}
                      onChange={(e) => setCheckDate(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border ${
                        isDark
                          ? 'bg-gray-900 border-gray-700 text-white'
                          : 'bg-white border-gray-200 text-gray-900'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Transfer payment fields */}
              {paymentMethod === 'transfer' && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('admin.payment.transfer_reference')} <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>({t('admin.common.optional')})</span>
                  </label>
                  <input
                    type="text"
                    value={transferReference}
                    onChange={(e) => setTransferReference(e.target.value)}
                    placeholder="REF-123456"
                    className={`w-full px-4 py-3 rounded-xl border ${
                      isDark
                        ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t('admin.payment.notes')} <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>({t('admin.common.optional')})</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={`w-full px-4 py-3 rounded-xl border resize-none ${
                    isDark
                      ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-600'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-500">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-between px-6 py-4 border-t ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <button
                onClick={onClose}
                disabled={loading}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {t('admin.common.cancel')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !isValid()}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl font-medium transition-colors ${
                  isValid() && !loading
                    ? mode === 'preauth'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('admin.payment.processing')}
                  </>
                ) : mode === 'preauth' ? (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    {t('admin.payment.authorize')} {formatCurrency(parseFloat(amount) || 0)}
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    {t('admin.payment.pay')} {formatCurrency(parseFloat(amount) || 0)}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
