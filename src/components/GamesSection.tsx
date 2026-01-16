'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { X, Volume2, VolumeX } from 'lucide-react'
import { localAssets } from '@/data/games'

interface GamesSectionProps {
  translations: {
    games: {
      title: string
      subtitle: string
      more_info: string
      items: Record<string, {
        name: string
        description: string
        popup_description: string
        features: string[]
      }>
    }
  }
}

export default function GamesSection({ translations }: GamesSectionProps) {
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [mutedVideos, setMutedVideos] = useState<Record<string, boolean>>({})
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})

  // Filtrer pour exclure "control" (8 jeux seulement pour le franchisé)
  const gameKeys = (Object.keys(localAssets.games) as Array<keyof typeof localAssets.games>)
    .filter(key => key !== 'control')

  const toggleMute = (gameKey: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const video = videoRefs.current[gameKey]
    if (video) {
      video.muted = !video.muted
      setMutedVideos(prev => ({ ...prev, [gameKey]: video.muted }))
    }
  }

  return (
    <section id="games" className="py-10 md:py-16 relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.7) 0%, rgba(0, 240, 255, 0.6) 25%, rgba(0, 200, 255, 0.7) 50%, rgba(0, 240, 255, 0.6) 75%, rgba(0, 240, 255, 0.8) 100%)'
    }}>
      {/* Wave separator from previous section */}
      <div className="absolute top-0 left-0 right-0" style={{ transform: 'translateY(-100%)' }}>
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ width: '100%', height: '60px', display: 'block' }}>
          <path d="M0,60 Q300,20 600,60 T1200,60 L1200,120 L0,120 Z" fill="rgba(0, 240, 255, 0.7)" />
        </svg>
      </div>
      
      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-95">
        <div className="absolute top-1/4 right-1/4 w-[700px] h-[700px] bg-primary/60 rounded-full blur-[250px] animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 left-1/4 w-[700px] h-[700px] bg-primary/50 rounded-full blur-[250px] animate-pulse" style={{ animationDuration: '5s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-primary/40 rounded-full blur-[350px]" />
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6"
        >
          <h2 className="section-title">{translations.games.title}</h2>
          <p className="text-white mx-auto text-lg" style={{ fontFamily: 'Poppins, sans-serif', textShadow: '0 2px 4px rgba(0,0,0,0.3)', lineHeight: '1.7', maxWidth: 'clamp(768px, 85vw, 1200px)', paddingLeft: 'clamp(40px, 6vw, 100px)', paddingRight: 'clamp(40px, 6vw, 100px)' }}>
            {translations.games.subtitle}
          </p>
        </motion.div>

        {/* Games Grid - Layout avec texte EN DESSOUS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {gameKeys.map((gameKey, index) => {
            const gameData = translations.games.items[gameKey]
            const assets = localAssets.games[gameKey]
            const hasVideo = assets.video !== null
            const isMuted = mutedVideos[gameKey] !== false
            
            if (!gameData) return null

            return (
              <motion.div
                key={gameKey}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="game-card-new group cursor-pointer bg-dark-100/90 backdrop-blur-sm rounded-2xl overflow-hidden border border-primary/30 hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,240,255,0.2)]"
                onClick={() => setSelectedGame(gameKey)}
              >
                {/* Vidéo/Image Container */}
                <div className="relative aspect-video overflow-hidden">
                  {hasVideo ? (
                    <>
                      <video
                        ref={(el) => { videoRefs.current[gameKey] = el }}
                        src={assets.video!}
                        muted={isMuted}
                        loop
                        playsInline
                        autoPlay
                        className="w-full h-full object-cover"
                      />
                      {/* Bouton Mute */}
                      <button
                        onClick={(e) => toggleMute(gameKey, e)}
                        className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100"
                      >
                        {isMuted ? (
                          <VolumeX size={14} className="text-white" />
                        ) : (
                          <Volume2 size={14} className="text-white" />
                        )}
                      </button>
                    </>
                  ) : (
                    <Image
                      src={assets.thumb}
                      alt={gameData.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </div>

                {/* Texte EN DESSOUS de la vidéo */}
                <div className="p-5">
                  <h3 className="font-display text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors">
                    {gameData.name}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-3 mb-3 leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {gameData.description}
                  </p>
                  <button className="text-primary text-sm font-medium hover:underline flex items-center gap-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {translations.games.more_info}
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Game Modal */}
      <AnimatePresence>
        {selectedGame && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setSelectedGame(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedGame(null)}
                className="absolute top-4 right-4 z-10 w-10 h-10 bg-dark-200 rounded-full flex items-center justify-center hover:bg-dark-300 transition-colors"
              >
                <X size={20} />
              </button>

              {/* Modal Content */}
              {(() => {
                const gameData = translations.games.items[selectedGame]
                const assets = localAssets.games[selectedGame as keyof typeof localAssets.games]
                
                if (!gameData || !assets) return null

                const hasVideo = assets.video !== null

                return (
                  <>
                    {/* Vidéo ou Image */}
                    <div className="relative aspect-video bg-black">
                      {hasVideo ? (
                        <video
                          src={assets.video!}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover rounded-t-[20px]"
                        />
                      ) : (
                        <Image
                          src={assets.popup}
                          alt={gameData.name}
                          fill
                          className="object-cover rounded-t-[20px]"
                          unoptimized
                        />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-8">
                      <h3 className="font-display text-3xl font-bold gradient-text mb-4">
                        {gameData.name}
                      </h3>
                      <p className="text-gray-300 mb-6 leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        {gameData.popup_description}
                      </p>
                      
                      {/* Features */}
                      <ul className="space-y-3">
                        {gameData.features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-3 text-gray-400" style={{ fontFamily: 'Poppins, sans-serif' }}>
                            <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Wave separator to next section */}
      <div className="absolute bottom-0 left-0 right-0" style={{ transform: 'translateY(100%)' }}>
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ width: '100%', height: '60px', display: 'block' }}>
          <path d="M0,0 Q300,40 600,0 T1200,0 L1200,120 L0,120 Z" fill="rgba(255, 0, 229, 0.7)" />
        </svg>
      </div>
    </section>
  )
}
