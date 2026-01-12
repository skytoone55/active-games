'use client'

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark text-gray-900 dark:text-white flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-dark-100 backdrop-blur-sm rounded-2xl p-8 border-2 border-gray-300 dark:border-primary/30">
          <h1 className="text-3xl font-bold mb-6 text-center" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            404 - Page non trouvée
          </h1>
          <p className="text-center mb-6 text-gray-600 dark:text-gray-400">
            La page admin demandée n'existe pas.
          </p>
          <Link
            href="/admin"
            className="glow-button w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-base"
          >
            Retour à l'admin
          </Link>
        </div>
      </div>
    </div>
  )
}
