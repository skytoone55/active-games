'use client'

import { Check } from 'lucide-react'

interface HowItWorksSectionProps {
  translations: {
    howItWorks: {
      title: string
      steps: Array<{
        number: string
        title: string
        description: string
      }>
    }
  }
}

export default function HowItWorksSection({ translations }: HowItWorksSectionProps) {
  if (!translations?.howItWorks) {
    console.error('HowItWorksSection: translations.howItWorks is missing', translations)
    return null
  }

  return (
    <section id="how-it-works" className="py-20 md:py-32 bg-dark-100 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Title */}
        <div className="text-center mb-16">
          <h2 className="section-title">{translations.howItWorks.title}</h2>
        </div>

        {/* Steps Grid */}
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-4">
          {translations.howItWorks.steps.map((step, index) => (
            <div
              key={index}
              className="relative group"
            >
              {/* Connector line (hidden on last item and mobile) */}
              {index < translations.howItWorks.steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary/50 to-primary/20" />
              )}

              {/* Step Card */}
              <div className="relative bg-dark-200/50 backdrop-blur-sm rounded-2xl p-6 border border-primary/20 hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,240,255,0.3)] hover:scale-105">
                {/* Step Number */}
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-primary/50">
                    {step.number}
                  </div>
                </div>

                {/* Step Title */}
                <h3 className="text-white font-bold text-center mb-3 text-lg" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {step.title}
                </h3>

                {/* Step Description */}
                <p className="text-gray-300 text-center text-sm leading-relaxed" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {step.description}
                </p>

                {/* Check Icon */}
                <div className="flex justify-center mt-4">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
