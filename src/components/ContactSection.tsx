'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Check, AlertCircle, Loader2, ChevronDown, MapPin } from 'lucide-react'

interface Branch {
  id: string
  slug: string
  name: string
  name_en: string | null
}

interface ContactSectionProps {
  translations: {
    contact: {
      title: string
      subtitle: string
      form: {
        name: string
        email: string
        phone: string
        phone_placeholder: string
        message: string
        branch: string
        branch_placeholder: string
        send: string
        sending: string
        sent: string
        success_message: string
        error_message: string
      }
      info: {
        phone: string
        email: string
      }
    }
  }
}

type FormStatus = 'idle' | 'loading' | 'success' | 'error'

export default function ContactSection({ translations }: ContactSectionProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    branch_id: '',
  })
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setBranchDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Charger les branches au montage
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch('/api/branches')
        const data = await response.json()
        if (data.success && data.branches) {
          setBranches(data.branches)
        }
      } catch (error) {
        console.error('Error fetching branches:', error)
      } finally {
        setLoadingBranches(false)
      }
    }
    fetchBranches()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    try {
      const response = await fetch('/api/public/contact-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setStatus('success')
        setFormData({ name: '', email: '', phone: '', message: '', branch_id: '' })
        setTimeout(() => setStatus('idle'), 5000)
      } else {
        const data = await response.json()
        setErrorMessage(data.error || translations.contact.form.error_message)
        setStatus('error')
      }
    } catch {
      setErrorMessage(translations.contact.form.error_message)
      setStatus('error')
    }
  }

  const labelStyle = { fontFamily: 'Poppins, sans-serif', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }
  const inputStyle = { fontFamily: 'Poppins, sans-serif', backgroundColor: 'rgba(50, 50, 70, 0.7)' }

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
          <p className="text-white max-w-2xl mx-auto text-lg" style={labelStyle}>
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
              {/* Branch selector - Custom dropdown */}
              <div>
                <label className="block text-white mb-2 text-sm" style={labelStyle}>
                  {translations.contact.form.branch} *
                </label>
                {/* Hidden input for form validation */}
                <input
                  type="text"
                  value={formData.branch_id}
                  required
                  tabIndex={-1}
                  className="sr-only"
                  onChange={() => {}}
                />
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => !loadingBranches && setBranchDropdownOpen(!branchDropdownOpen)}
                    className="form-input backdrop-blur-sm border-primary/30 w-full text-left cursor-pointer flex items-center justify-between gap-2 transition-all duration-200 hover:border-primary/50"
                    style={{
                      ...inputStyle,
                      borderColor: branchDropdownOpen ? 'rgba(0, 240, 255, 0.6)' : undefined,
                      boxShadow: branchDropdownOpen ? '0 0 15px rgba(0, 240, 255, 0.2)' : undefined,
                    }}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <MapPin className="w-4 h-4 text-primary/70 flex-shrink-0" />
                      <span className={formData.branch_id ? 'text-white' : 'text-white/40'}>
                        {loadingBranches
                          ? '...'
                          : formData.branch_id
                            ? branches.find(b => b.id === formData.branch_id)?.name
                            : translations.contact.form.branch_placeholder}
                      </span>
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-white/50 flex-shrink-0 transition-transform duration-200 ${branchDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  <AnimatePresence>
                    {branchDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 top-full left-0 right-0 mt-2 rounded-xl overflow-hidden border border-primary/30 shadow-2xl"
                        style={{
                          backgroundColor: 'rgba(30, 30, 50, 0.95)',
                          backdropFilter: 'blur(20px)',
                          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 240, 255, 0.1)',
                        }}
                      >
                        {branches.map((branch, index) => (
                          <button
                            key={branch.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, branch_id: branch.id })
                              setBranchDropdownOpen(false)
                            }}
                            className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-all duration-150 ${
                              formData.branch_id === branch.id
                                ? 'bg-primary/20 text-primary'
                                : 'text-white/80 hover:bg-white/10 hover:text-white'
                            } ${index !== branches.length - 1 ? 'border-b border-white/5' : ''}`}
                            style={{ fontFamily: 'Poppins, sans-serif' }}
                          >
                            <MapPin className={`w-4 h-4 flex-shrink-0 ${
                              formData.branch_id === branch.id ? 'text-primary' : 'text-white/30'
                            }`} />
                            <span className="truncate">{branch.name}</span>
                            {formData.branch_id === branch.id && (
                              <Check className="w-4 h-4 text-primary ml-auto flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-white mb-2 text-sm" style={labelStyle}>
                  {translations.contact.form.name} *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-input backdrop-blur-sm border-primary/30"
                  required
                  style={inputStyle}
                />
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-white mb-2 text-sm" style={labelStyle}>
                  {translations.contact.form.phone} *
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={translations.contact.form.phone_placeholder}
                  className="form-input backdrop-blur-sm border-primary/30"
                  required
                  style={inputStyle}
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-white mb-2 text-sm" style={labelStyle}>
                  {translations.contact.form.email}
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="form-input backdrop-blur-sm border-primary/30"
                  style={inputStyle}
                />
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-white mb-2 text-sm" style={labelStyle}>
                  {translations.contact.form.message} *
                </label>
                <textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={5}
                  className="form-input backdrop-blur-sm border-primary/30 resize-none"
                  required
                  style={inputStyle}
                />
              </div>

              {/* Submit Button */}
              <div className="flex flex-col items-center gap-3">
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="glow-button w-auto px-8 flex items-center justify-center gap-2 text-dark font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  {status === 'loading' ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : status === 'success' ? (
                    <Check size={18} />
                  ) : (
                    <Send size={18} />
                  )}
                  {status === 'loading'
                    ? translations.contact.form.sending
                    : status === 'success'
                      ? translations.contact.form.sent
                      : translations.contact.form.send}
                </button>

                {status === 'success' && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-green-300 text-sm flex items-center gap-2"
                  >
                    <Check size={16} />
                    {translations.contact.form.success_message}
                  </motion.p>
                )}

                {status === 'error' && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-300 text-sm flex items-center gap-2"
                  >
                    <AlertCircle size={16} />
                    {errorMessage}
                  </motion.p>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
