'use client'

import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import Image from 'next/image'

interface BranchesSectionProps {
  translations: {
    branches: {
      title: string
      subtitle: string
      items: Array<{
        name: string
        address: string
        city: string
        phone: string
        venue: string
      }>
    }
  }
}

export default function BranchesSection({ translations }: BranchesSectionProps) {
  if (!translations?.branches) {
    return null
  }

  return (
    <section id="branches" className="py-10 md:py-16 relative overflow-hidden" style={{
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
        <div className="absolute top-0 right-1/4 w-[700px] h-[700px] bg-primary/60 rounded-full blur-[250px] animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }} />
        <div className="absolute bottom-0 left-1/4 w-[700px] h-[700px] bg-primary/50 rounded-full blur-[250px] animate-pulse" style={{ animationDuration: '5s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-primary/40 rounded-full blur-[350px]" />
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="section-title">{translations.branches.title}</h2>
          <p className="text-white max-w-2xl mx-auto text-lg" style={{ fontFamily: 'Poppins, sans-serif', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {translations.branches.subtitle}
          </p>
        </motion.div>

        {/* Branches Grid */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {translations.branches.items.map((branch, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="backdrop-blur-sm rounded-xl p-6 border border-primary/30 hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,240,255,0.2)]"
              style={{ backgroundColor: 'rgba(50, 50, 70, 0.7)' }}
            >
              <div className="flex items-start gap-4 w-full">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-xl mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {branch.name}
                  </h3>
                  <p className="text-gray-300 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {branch.address}
                  </p>
                  <div className="flex items-center gap-6 mb-1">
                    <p className="text-primary font-medium text-base" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {branch.venue}
                    </p>
                    <a 
                      href="https://laser-city.co.il" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-block transition-opacity hover:opacity-90"
                      style={{ 
                        maxWidth: '120px', 
                        maxHeight: '42px',
                        opacity: 1,
                        filter: 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.6)) brightness(1.2)'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Image
                        src="/images/logo_laser_city.png"
                        alt="Laser City"
                        width={120}
                        height={42}
                        style={{ width: '120px', height: 'auto', maxWidth: '120px', display: 'block' }}
                        unoptimized
                      />
                    </a>
                  </div>
                  <a 
                    href={`tel:${branch.phone.replace(/[^\d]/g, '')}`}
                    className="text-primary hover:text-primary/80 transition-colors font-medium"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {branch.phone}
                  </a>
                </div>
              </div>
            </motion.div>
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
