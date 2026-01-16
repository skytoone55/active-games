'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Send } from 'lucide-react'

interface ContactSectionProps {
  translations: {
    contact: {
      title: string
      subtitle: string
      form: {
        name: string
        email: string
        message: string
        send: string
      }
      info: {
        phone: string
        email: string
      }
    }
  }
}

export default function ContactSection({ translations }: ContactSectionProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Form submission will be handled later
    console.log('Form submitted:', formData)
  }

  return (
    <section id="contact" className="py-10 md:py-16 relative overflow-hidden" style={{
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
          className="text-center mb-6"
        >
          <h2 className="section-title">{translations.contact.title}</h2>
          <p className="text-white max-w-2xl mx-auto text-lg" style={{ fontFamily: 'Poppins, sans-serif', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {translations.contact.subtitle}
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-white mb-2 text-sm" style={{ fontFamily: 'Poppins, sans-serif', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                  {translations.contact.form.name}
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-input backdrop-blur-sm border-primary/30"
                  required
                  style={{ fontFamily: 'Poppins, sans-serif', backgroundColor: 'rgba(50, 50, 70, 0.7)' }}
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-white mb-2 text-sm" style={{ fontFamily: 'Poppins, sans-serif', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                  {translations.contact.form.email}
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="form-input backdrop-blur-sm border-primary/30"
                  required
                  style={{ fontFamily: 'Poppins, sans-serif', backgroundColor: 'rgba(50, 50, 70, 0.7)' }}
                />
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-white mb-2 text-sm" style={{ fontFamily: 'Poppins, sans-serif', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                  {translations.contact.form.message}
                </label>
                <textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={5}
                  className="form-input backdrop-blur-sm border-primary/30 resize-none"
                  required
                  style={{ fontFamily: 'Poppins, sans-serif', backgroundColor: 'rgba(50, 50, 70, 0.7)' }}
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-center">
                <button
                  type="submit"
                  className="glow-button w-auto px-8 flex items-center justify-center gap-2 text-dark font-semibold"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  <Send size={18} />
                  {translations.contact.form.send}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
