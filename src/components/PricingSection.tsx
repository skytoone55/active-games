'use client'

import { Check, Sparkles, PartyPopper, Zap } from 'lucide-react'
import Link from 'next/link'

interface PricingSectionProps {
  translations: {
    pricing: {
      title: string
      subtitle: string
      active: {
        title: string
        price: string
        currency: string
        duration: string
        features: string[]
      }
      mix: {
        title: string
        price: string
        currency: string
        description: string
        features: string[]
      }
      event: {
        title: string
        description: string
        tiers: {
          label: string
          price: string
          currency: string
        }[]
        roomPrice: string
        roomLabel: string
        features: string[]
      }
      mixEvent: {
        title: string
        description: string
        tiers: {
          label: string
          price: string
          currency: string
        }[]
        roomPrice: string
        roomLabel: string
        features: string[]
      }
    }
    booking?: {
      order_now: string
    }
  }
  isRTL?: boolean
}

export default function PricingSection({ translations, isRTL }: PricingSectionProps) {
  if (!translations?.pricing) {
    console.error('PricingSection: translations.pricing is missing', translations)
    return <section id="pricing" className="py-20 md:py-32 bg-dark min-h-[600px]"><div className="container mx-auto px-4"><p className="text-white">Loading translations...</p></div></section>
  }

  const t = translations.pricing

  return (
    <section id="pricing" className="py-10 md:py-16 min-h-[600px] w-full relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, rgba(255, 0, 229, 0.7) 0%, rgba(255, 0, 255, 0.6) 25%, rgba(255, 50, 200, 0.7) 50%, rgba(255, 0, 255, 0.6) 75%, rgba(255, 0, 229, 0.8) 100%)'
    }}>
      {/* Wave separator from previous section */}
      <div className="absolute top-0 left-0 right-0" style={{ transform: 'translateY(-100%)' }}>
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ width: '100%', height: '60px', display: 'block' }}>
          <path d="M0,60 Q300,20 600,60 T1200,60 L1200,120 L0,120 Z" fill="rgba(255, 0, 229, 0.7)" />
        </svg>
      </div>

      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-95">
        <div className="absolute top-1/3 left-1/4 w-[700px] h-[700px] bg-secondary/60 rounded-full blur-[250px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/3 right-1/4 w-[700px] h-[700px] bg-secondary/50 rounded-full blur-[250px] animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-secondary/40 rounded-full blur-[350px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-8">
          <h2 className="section-title">{t.title}</h2>
          <p className="text-white max-w-2xl mx-auto text-lg" style={{ fontFamily: 'Poppins, sans-serif', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {t.subtitle}
          </p>
        </div>

        {/* === GAME PRICES: Active + Mix === */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-12">
          {/* Active Card */}
          <div className="backdrop-blur-sm rounded-2xl p-6 border border-primary/30 hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,240,255,0.2)] text-center" style={{ backgroundColor: 'rgba(50, 50, 70, 0.7)' }}>
            <Sparkles className="w-10 h-10 text-secondary mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>{t.active.title}</h3>
            <p className="text-white/80 text-sm mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>{t.active.duration}</p>

            <div className="flex items-center justify-center gap-2 mb-5">
              <span className="text-5xl font-display font-bold text-white">{t.active.price}</span>
              <span className="text-xl text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{t.active.currency}</span>
            </div>

            <ul className="space-y-2">
              {t.active.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-white text-sm justify-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  <Check size={16} className="text-secondary flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Mix Card */}
          <div className="backdrop-blur-sm rounded-2xl p-6 border border-secondary/40 hover:border-secondary/60 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,0,255,0.2)] text-center" style={{ backgroundColor: 'rgba(50, 50, 70, 0.7)' }}>
            <Zap className="w-10 h-10 text-secondary mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>{t.mix.title}</h3>
            <p className="text-white/80 text-sm mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>{t.mix.description}</p>

            <div className="flex items-center justify-center gap-2 mb-5">
              <span className="text-5xl font-display font-bold text-white">{t.mix.price}</span>
              <span className="text-xl text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{t.mix.currency}</span>
            </div>

            <ul className="space-y-2">
              {t.mix.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-white text-sm justify-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  <Check size={16} className="text-secondary flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* === EVENT PRICES === */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-6">
            <PartyPopper className="w-8 h-8 text-secondary" />
            <h3 className="text-3xl font-bold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {t.event.title}
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-8">
          {/* Event Card */}
          <div className="backdrop-blur-sm rounded-2xl p-6 border border-primary/30 hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,240,255,0.2)]" style={{ backgroundColor: 'rgba(50, 50, 70, 0.7)' }}>
            <h4 className="text-lg font-bold text-white text-center mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {t.event.description}
            </h4>

            {/* Price tiers */}
            <div className="space-y-3 mb-4">
              {t.event.tiers.map((tier, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2">
                  <span className="text-white/90 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>{tier.label}</span>
                  <span className="text-white font-bold text-lg" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {tier.price} {tier.currency}
                  </span>
                </div>
              ))}
              {/* Room price */}
              <div className="flex items-center justify-between bg-secondary/10 rounded-lg px-4 py-2 border border-secondary/20">
                <span className="text-secondary text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{t.event.roomLabel}</span>
                <span className="text-secondary font-bold text-lg" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  +{t.event.roomPrice}
                </span>
              </div>
            </div>

            <ul className={`space-y-1.5 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t.event.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-white text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  <Check size={14} className="text-secondary flex-shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Mix Event Card */}
          <div className="backdrop-blur-sm rounded-2xl p-6 border border-secondary/40 hover:border-secondary/60 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,0,255,0.2)]" style={{ backgroundColor: 'rgba(50, 50, 70, 0.7)' }}>
            <h4 className="text-lg font-bold text-white text-center mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {t.mixEvent.description}
            </h4>

            {/* Price tiers */}
            <div className="space-y-3 mb-4">
              {t.mixEvent.tiers.map((tier, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2">
                  <span className="text-white/90 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>{tier.label}</span>
                  <span className="text-white font-bold text-lg" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {tier.price} {tier.currency}
                  </span>
                </div>
              ))}
              {/* Room price */}
              <div className="flex items-center justify-between bg-secondary/10 rounded-lg px-4 py-2 border border-secondary/20">
                <span className="text-secondary text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{t.mixEvent.roomLabel}</span>
                <span className="text-secondary font-bold text-lg" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  +{t.mixEvent.roomPrice}
                </span>
              </div>
            </div>

            <ul className={`space-y-1.5 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t.mixEvent.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-white text-xs" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  <Check size={14} className="text-secondary flex-shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Order Now Button */}
        <div className="text-center mt-10">
          <Link
            href="/reservation"
            className="glow-button inline-flex items-center gap-3 px-10 py-4 text-lg font-bold text-dark hover:scale-105 transition-transform duration-300"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            <Sparkles className="w-6 h-6" />
            {translations.booking?.order_now || 'Order now'}
          </Link>
        </div>
      </div>

      {/* Wave separator to next section */}
      <div className="absolute bottom-0 left-0 right-0" style={{ transform: 'translateY(100%)' }}>
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ width: '100%', height: '60px', display: 'block' }}>
          <path d="M0,0 Q300,40 600,0 T1200,0 L1200,120 L0,120 Z" fill="rgba(0, 240, 255, 0.7)" />
        </svg>
      </div>
    </section>
  )
}
