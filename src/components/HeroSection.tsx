'use client'

import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

interface HeroSectionProps {
  translations: {
    hero: {
      subtitle: string
      title: string
      description: string
      cta_games: string
      cta_concept: string
    }
  }
}

export default function HeroSection({ translations }: HeroSectionProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Video */}
      <div className="absolute inset-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
        >
          <source src="/videos/grid.mp4" type="video/mp4" />
        </video>
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-dark/70 via-dark/50 to-dark" />
        {/* Animated glow effects */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/30 rounded-full blur-[120px] animate-pulse delay-1000" />
        </div>
      </div>

      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 240, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 240, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              color: '#FF00E5',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 'clamp(16px, 2.4vw, 24px)',
              fontWeight: 700,
              textShadow: '0 0 10px rgba(255, 0, 229, 0.9), 0 0 30px rgba(255, 0, 229, 0.5)',
              marginBottom: 'clamp(-5px, -0.5vw, -2px)',
              marginTop: 0,
            }}
            className="uppercase tracking-widest"
          >
            {translations.hero.subtitle}
          </motion.p>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            style={{
              color: '#08F7FE',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 'clamp(38px, 6.5vw, 72px)',
              fontWeight: 700,
              textTransform: 'uppercase',
              textShadow: '0 0 15px rgba(8, 247, 254, 0.9), 0 0 40px rgba(8, 247, 254, 0.55), 0 0 60px rgba(8, 247, 254, 0.3)',
              marginBottom: 'clamp(5px, 1vw, 10px)',
              marginTop: 0,
            }}
            className="tracking-tight"
          >
            {translations.hero.title}
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            style={{
              color: '#D2DDFF',
              fontFamily: 'Poppins, sans-serif',
              fontSize: 'clamp(16px, 2.5vw, 22px)',
              fontWeight: 400,
              lineHeight: '1.5',
              marginTop: 'clamp(5px, 1vw, 10px)',
              marginBottom: 'clamp(30px, 5vw, 60px)',
              maxWidth: 'min(90vw, 768px)',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
            className="text-center"
          >
            {translations.hero.description}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-8"
          >
            <a
              href="#games"
              onClick={(e) => {
                e.preventDefault()
                document.querySelector('#games')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="glow-button text-dark font-semibold"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {translations.hero.cta_games}
            </a>
            <a
              href="#concept"
              onClick={(e) => {
                e.preventDefault()
                document.querySelector('#concept')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="glow-button text-dark font-semibold"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {translations.hero.cta_concept}
            </a>
          </motion.div>

          {/* Scroll Indicator - Maintenant juste après les boutons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            style={{ marginTop: 'clamp(10px, 2vw, 20px)' }}
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ color: '#08F7FE' }}
            >
              <ChevronDown size={32} />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
