'use client'

import { CreditCard, Smartphone, Grid3x3, Target, Trophy } from 'lucide-react'

interface HowItWorksSectionProps {
  translations: {
    howItWorks: {
      title: string
      subtitle: string
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

  const steps = [
    { icon: CreditCard, color: 'from-pink-500 to-purple-500' },
    { icon: Smartphone, color: 'from-purple-500 to-blue-500' },
    { icon: Grid3x3, color: 'from-blue-500 to-cyan-500' },
    { icon: Target, color: 'from-cyan-500 to-green-500' },
    { icon: Trophy, color: 'from-green-500 to-yellow-500' }
  ]

  return (
    <section className="relative py-12 px-8 bg-gradient-to-b from-black via-purple-900 to-black overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-500 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '1000ms' }}></div>
      </div>

      <div className="container mx-auto relative z-10">
        {/* Section Title */}
        <div className="text-center mb-12">
          <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
            {translations.howItWorks.title}
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            {translations.howItWorks.subtitle}
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 max-w-6xl mx-auto items-stretch">
          {translations.howItWorks.steps.map((step, index) => {
            const Icon = steps[index].icon
            const color = steps[index].color

            return (
              <div
                key={index}
                className="relative group flex"
              >
                {/* Connector Line */}
                {index < translations.howItWorks.steps.length - 1 && (
                  <div className="hidden md:block absolute top-20 left-[60%] w-[80%] h-1 bg-gradient-to-r from-purple-500/50 to-transparent z-0" />
                )}

                {/* Step Card */}
                <div className="relative backdrop-blur-sm bg-white/5 rounded-2xl p-4 border border-white/10 hover:border-purple-400/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] group-hover:scale-105 flex-1 flex flex-col">
                  {/* Icon with Gradient Background */}
                  <div className="flex justify-center mb-4">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r ${color} shadow-2xl group-hover:scale-110 transition-transform`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                  </div>

                  {/* Step Number Badge */}
                  <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-lg font-bold text-white shadow-lg">
                    {step.number}
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold mb-2 text-center bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {step.title}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-300 text-center text-sm leading-relaxed flex-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
