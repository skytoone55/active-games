'use client'

interface ClaraButtonProps {
  onClick: () => void
  isOpen?: boolean
}

export function ClaraButton({ onClick, isOpen }: ClaraButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 overflow-hidden ${
        isOpen
          ? 'bg-gradient-to-r from-cyan-500 to-teal-400 shadow-lg shadow-cyan-500/30'
          : 'bg-gray-800 hover:bg-gray-700 border border-cyan-500/30 hover:border-cyan-400'
      }`}
      title="Clara - Assistant IA"
    >
      {/* Icône vague / battement de coeur */}
      <svg
        viewBox="0 0 24 24"
        className={`w-5 h-5 ${isOpen ? 'text-white' : 'text-cyan-400'}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Forme de vague / battement cardiaque */}
        <path d="M2 12h2l3-9 4 18 4-9 3 0h4" />
      </svg>

      {/* Animation de pulse quand fermé */}
      {!isOpen && (
        <>
          {/* Onde qui s'étend */}
          <span className="absolute inset-0 rounded-full animate-ping bg-cyan-400/20"></span>
          {/* Petit point lumineux */}
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-300"></span>
          </span>
        </>
      )}

      {/* Effet de glow quand ouvert */}
      {isOpen && (
        <span className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/20 to-teal-400/20 animate-pulse"></span>
      )}
    </button>
  )
}
