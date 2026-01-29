'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

interface SplitHeroSectionProps {
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

export default function SplitHeroSection({ translations }: SplitHeroSectionProps) {
  const [leftWidth, setLeftWidth] = useState(50)

  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* Container for split layout */}
      <div className="absolute inset-0 flex flex-col md:flex-row">

        {/* LEFT SIDE - LASER CITY */}
        <motion.div
          className="relative h-full group"
          style={{ width: `${leftWidth}%` }}
          onMouseEnter={() => setLeftWidth(60)}
          onMouseLeave={() => setLeftWidth(50)}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Background Video - Laser City */}
          <div className="absolute inset-0">
            <video
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            >
              <source src="lasercity.mp4" type="video/mp4" />
            </video>
          </div>

          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />

          {/* Animated glow effects */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00D4FF]/40 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#FFA500]/40 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          {/* Content - Laser City with REAL content */}
          <div className="relative z-10 flex flex-col items-center justify-center h-full px-8 text-center" dir="rtl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-4xl"
            >
              {/* Title - REAL from site */}
              <motion.h1
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                style={{
                  color: '#ffffff',
                  fontFamily: 'Heebo, sans-serif',
                  fontSize: 'clamp(48px, 8vw, 96px)',
                  fontWeight: 900,
                  textShadow: '0 0 20px rgba(0, 212, 255, 0.8), 0 0 40px rgba(0, 212, 255, 0.4)',
                  marginBottom: 'clamp(10px, 2vw, 20px)',
                  marginTop: 0,
                  letterSpacing: '0.05em',
                }}
              >
                לייזר סיטי
              </motion.h1>

              {/* Subtitle - REAL from site */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                style={{
                  color: '#00D4FF',
                  fontFamily: 'Heebo, sans-serif',
                  fontSize: 'clamp(20px, 3vw, 32px)',
                  fontWeight: 700,
                  textShadow: '0 0 10px rgba(0, 212, 255, 0.8)',
                  marginBottom: 'clamp(15px, 3vw, 30px)',
                }}
              >
                חוויה בלתי נשכחת
              </motion.p>

              {/* Description - REAL from site */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                style={{
                  color: '#ffffff',
                  fontFamily: 'Heebo, sans-serif',
                  fontSize: 'clamp(16px, 2vw, 20px)',
                  fontWeight: 400,
                  lineHeight: '1.6',
                  marginBottom: 'clamp(30px, 5vw, 50px)',
                  textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
                }}
              >
                לייזר סיטי מביא לישראל את חווית הלייזר טאג האולטימטיבית<br />
                עם מתחמי ענק בראשל"צ, גלילות ופתח תקווה
              </motion.p>

              {/* CTAs - REAL from site */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="flex flex-col sm:flex-row gap-4 justify-center"
              >
                <a
                  href="#contact"
                  onClick={(e) => {
                    e.preventDefault()
                    document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="px-10 py-4 rounded-full font-bold transition-all hover:scale-105"
                  style={{
                    fontFamily: 'Heebo, sans-serif',
                    fontSize: 'clamp(16px, 2vw, 20px)',
                    background: 'transparent',
                    border: '3px solid #00D4FF',
                    color: '#00D4FF',
                    boxShadow: '0 0 30px rgba(0, 212, 255, 0.5)',
                  }}
                >
                  הזמינו משחק
                </a>
                <a
                  href="#contact"
                  onClick={(e) => {
                    e.preventDefault()
                    document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="px-10 py-4 rounded-full font-bold transition-all hover:scale-105"
                  style={{
                    fontFamily: 'Heebo, sans-serif',
                    fontSize: 'clamp(16px, 2vw, 20px)',
                    background: 'transparent',
                    border: '3px solid #00D4FF',
                    color: '#00D4FF',
                    boxShadow: '0 0 30px rgba(0, 212, 255, 0.5)',
                  }}
                >
                  צרו קשר
                </a>
              </motion.div>

              {/* Scroll Indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                style={{ marginTop: 'clamp(20px, 3vw, 40px)' }}
              >
                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ color: '#ffffff' }}
                >
                  <ChevronDown size={32} />
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {/* SEPARATOR LINE - moves with hover */}
        <motion.div
          className="absolute top-0 bottom-0 w-[3px] bg-gradient-to-b from-transparent via-cyan-500/80 to-transparent hidden md:block z-50"
          style={{ left: `${leftWidth}%`, transform: 'translateX(-50%)' }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="absolute inset-0 bg-cyan-400/50 blur-md animate-pulse" />
        </motion.div>

        {/* RIGHT SIDE - ACTIVE GAMES (exact copy from activelaser) */}
        <motion.div
          className="relative h-full group"
          style={{ width: `${100 - leftWidth}%` }}
          onMouseEnter={() => setLeftWidth(40)}
          onMouseLeave={() => setLeftWidth(50)}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Background Video */}
          <div className="absolute inset-0">
            <video
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            >
              <source src="activegames.mp4" type="video/mp4" />
            </video>
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-dark/70 via-dark/50 to-dark" />
            {/* Animated glow effects */}
            <div className="absolute inset-0 opacity-40">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-[120px] animate-pulse" />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/30 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
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
          <div className="relative z-10 flex items-center justify-center h-full px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-4xl"
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
                }}
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

              {/* Scroll Indicator */}
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
        </motion.div>
      </div>
    </section>
  )
}
