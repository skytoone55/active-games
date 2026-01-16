'use client'

import { motion } from 'framer-motion'
import { 
  Award, 
  MapPin, 
  Headphones, 
  User, 
  Palette 
} from 'lucide-react'

interface WhyChooseUsSectionProps {
  translations: {
    whyChooseUs: {
      title: string
      subtitle: string
      reasons: Array<{
        title: string
        description: string
      }>
    }
  }
}

const icons = [Award, MapPin, Headphones, User, Palette]

export default function WhyChooseUsSection({ translations }: WhyChooseUsSectionProps) {
  return (
    <section id="concept" className="py-20 md:py-32 bg-dark-100">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="section-title gradient-text">{translations.whyChooseUs.title}</h2>
          <p className="text-gray-400 max-w-3xl mx-auto text-lg">
            {translations.whyChooseUs.subtitle}
          </p>
        </motion.div>

        {/* Reasons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {translations.whyChooseUs.reasons.map((reason, index) => {
            const Icon = icons[index % icons.length]
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-dark-200/50 p-8 rounded-2xl border border-dark-300 hover:border-primary/30 transition-all duration-300 group"
              >
                {/* Icon */}
                <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Icon className="w-7 h-7 text-primary" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-white mb-3">
                  {reason.title}
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  {reason.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
