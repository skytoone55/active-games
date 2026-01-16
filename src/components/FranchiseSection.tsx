'use client'

import { motion } from 'framer-motion'
import { 
  TrendingUp, 
  Zap, 
  Rocket, 
  Globe, 
  DollarSign, 
  Flag 
} from 'lucide-react'

interface FranchiseSectionProps {
  translations: {
    franchise: {
      title: string
      subtitle: string
      description: string
      benefits: Array<{
        title: string
        description: string
      }>
    }
  }
}

const icons = [TrendingUp, Zap, Rocket, Globe, DollarSign, Flag]

export default function FranchiseSection({ translations }: FranchiseSectionProps) {
  return (
    <section className="py-20 md:py-32 bg-dark relative overflow-hidden">
      {/* Background Effect */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="section-title gradient-text">{translations.franchise.title}</h2>
          <p className="text-primary font-medium text-xl mb-6">
            {translations.franchise.subtitle}
          </p>
          <p className="text-gray-400 max-w-4xl mx-auto text-lg leading-relaxed">
            {translations.franchise.description}
          </p>
        </motion.div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {translations.franchise.benefits.map((benefit, index) => {
            const Icon = icons[index % icons.length]
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative group"
              >
                <div className="bg-dark-100 p-6 rounded-2xl border border-dark-200 hover:border-primary/50 transition-all duration-300 h-full">
                  {/* Icon */}
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-bold text-white mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {benefit.description}
                  </p>
                </div>

                {/* Glow Effect on Hover */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/0 via-primary/5 to-secondary/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
