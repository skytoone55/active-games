'use client'

import { useState } from 'react'
import { Loader2, CheckCircle, AlertCircle, Calculator } from 'lucide-react'

interface MaintenanceSectionProps {
  isDark: boolean
}

export function MaintenanceSection({ isDark }: MaintenanceSectionProps) {
  const [backfillLoading, setBackfillLoading] = useState(false)
  const [backfillResult, setBackfillResult] = useState<{
    success: boolean
    message: string
    updated?: number
    errors?: number
  } | null>(null)

  const runBackfillTotals = async () => {
    setBackfillLoading(true)
    setBackfillResult(null)

    try {
      const response = await fetch('/api/admin/backfill-totals', {
        method: 'POST'
      })
      const data = await response.json()
      setBackfillResult(data)
    } catch (error) {
      setBackfillResult({
        success: false,
        message: `Erreur: ${error}`
      })
    } finally {
      setBackfillLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Maintenance
        </h2>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Outils de maintenance et migration des données
        </p>
      </div>

      {/* Backfill Total Amount */}
      <div className={`rounded-lg border p-6 ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
            isDark ? 'bg-blue-500/20' : 'bg-blue-100'
          }`}>
            <Calculator className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <div className="flex-1">
            <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Recalculer les montants des commandes
            </h3>
            <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Calcule et stocke le total_amount pour les commandes qui n&apos;en ont pas.
              Nécessaire pour que Clara puisse afficher les statistiques de chiffre d&apos;affaires.
            </p>

            <button
              onClick={runBackfillTotals}
              disabled={backfillLoading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                backfillLoading
                  ? 'bg-gray-500 cursor-not-allowed'
                  : isDark
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {backfillLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Calcul en cours...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  Lancer le calcul
                </>
              )}
            </button>

            {backfillResult && (
              <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
                backfillResult.success
                  ? isDark ? 'bg-green-500/20' : 'bg-green-100'
                  : isDark ? 'bg-red-500/20' : 'bg-red-100'
              }`}>
                {backfillResult.success ? (
                  <CheckCircle className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                ) : (
                  <AlertCircle className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                )}
                <div>
                  <p className={`font-medium ${
                    backfillResult.success
                      ? isDark ? 'text-green-400' : 'text-green-700'
                      : isDark ? 'text-red-400' : 'text-red-700'
                  }`}>
                    {backfillResult.message}
                  </p>
                  {backfillResult.updated !== undefined && (
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {backfillResult.updated} commande(s) mise(s) à jour
                      {backfillResult.errors ? `, ${backfillResult.errors} erreur(s)` : ''}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
