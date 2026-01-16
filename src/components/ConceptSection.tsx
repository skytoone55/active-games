'use client'

import { Watch, Users, Clock, Gamepad2, Trophy, Zap } from 'lucide-react'

interface ConceptSectionProps {
  translations: {
    concept: {
      title: string
      intro: string
      features: {
        players: string
        duration: string
        bracelet: string
        rooms: string
        modes: string
        strategy: string
      }
      description: string[]
    }
  }
}

export default function ConceptSection({ translations }: ConceptSectionProps) {
  // Debug: vérifier que les traductions sont présentes
  if (!translations?.concept) {
    console.error('ConceptSection: translations.concept is missing', translations)
    return <section id="concept" className="py-20 md:py-32 bg-dark-100 min-h-[400px]"><div className="container mx-auto px-4"><p className="text-white">Loading translations...</p></div></section>
  }

  const features = [
    {
      icon: Users,
      text: translations.concept.features.players,
    },
    {
      icon: Clock,
      text: translations.concept.features.duration,
    },
    {
      icon: Watch,
      text: translations.concept.features.bracelet,
    },
    {
      icon: Gamepad2,
      text: translations.concept.features.rooms,
    },
    {
      icon: Trophy,
      text: translations.concept.features.modes,
    },
    {
      icon: Zap,
      text: translations.concept.features.strategy,
    },
  ]

  return (
    <section id="concept" className="py-10 md:py-16 min-h-[400px] w-full relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, rgba(255, 0, 229, 0.7) 0%, rgba(255, 0, 255, 0.6) 25%, rgba(255, 50, 200, 0.7) 50%, rgba(255, 0, 255, 0.6) 75%, rgba(255, 0, 229, 0.8) 100%)'
    }}>
      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-95">
        <div className="absolute top-0 left-1/4 w-[700px] h-[700px] bg-secondary/60 rounded-full blur-[250px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 right-1/4 w-[700px] h-[700px] bg-secondary/50 rounded-full blur-[250px] animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-secondary/40 rounded-full blur-[350px]" />
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-6">
          <h2 className="section-title">{translations.concept.title}</h2>
          <p className="text-white max-w-4xl mx-auto text-lg leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {translations.concept.intro}
          </p>
        </div>

        {/* Features Grid - 2 lignes de 3 */}
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-3 gap-4 mb-12">
            {features.map((feature, index) => (
              <div
                key={index}
                className="backdrop-blur-sm rounded-xl p-4 text-center border border-primary/30 hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,240,255,0.2)]"
                style={{ backgroundColor: 'rgba(50, 50, 70, 0.7)' }}
              >
                <feature.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                <p className="text-gray-300 text-sm font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>{feature.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Description Paragraphs */}
        <div className="max-w-4xl mx-auto space-y-6">
          {translations.concept.description.map((paragraph, index) => (
            <p key={index} className="text-white leading-relaxed text-center md:text-start" style={{ fontFamily: 'Poppins, sans-serif', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              {paragraph}
            </p>
          ))}
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
