export default function Loading() {
  const columns = Array.from({ length: 7 })
  const rows = Array.from({ length: 8 })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 py-4">
      {/* Barre d'outils (date + boutons) */}
      <div className="flex items-center justify-between mb-4 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="w-44 h-9 rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-28 h-9 rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="w-28 h-9 rounded-lg bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>

      {/* Grille agenda */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* En-têtes de colonnes */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800 animate-pulse">
          {columns.map((_, i) => (
            <div key={i} className="h-12 border-r last:border-r-0 border-gray-200 dark:border-gray-800 flex items-center justify-center">
              <div className="w-16 h-4 rounded bg-gray-200 dark:bg-gray-800" />
            </div>
          ))}
        </div>
        {/* Cellules */}
        {rows.map((_, r) => (
          <div key={r} className="grid grid-cols-7 border-b last:border-b-0 border-gray-100 dark:border-gray-800/60 animate-pulse">
            {columns.map((_, c) => (
              <div key={c} className="h-20 border-r last:border-r-0 border-gray-100 dark:border-gray-800/60 p-2">
                {(r + c) % 3 === 0 && (
                  <div className="w-full h-full rounded-md bg-gray-200/70 dark:bg-gray-800/70" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
