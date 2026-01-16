'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Locale, languageFlags, locales } from '@/i18n'

interface HeaderProps {
  translations: {
    nav: {
      concept: string
      games: string
      pricing: string
      branches: string
      contact: string
    }
    booking?: {
      order_now: string
    }
  }
  locale: Locale
  onLocaleChange: (locale: Locale) => void
}

export default function Header({ translations, locale, onLocaleChange }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLangOpen, setIsLangOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth >= 768) {
        setIsMenuOpen(false)
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobile && isMenuOpen) {
        const target = event.target as HTMLElement
        if (!target.closest('header') && !target.closest('nav')) {
          setIsMenuOpen(false)
        }
      }
    }

    if (isMenuOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [isMobile, isMenuOpen])

  // Menu items
  const menuItems = [
    { href: '#concept', label: translations.nav.concept },
    { href: '#games', label: translations.nav.games },
    { href: '#pricing', label: translations.nav.pricing },
    { href: '#branches', label: translations.nav.branches },
    { href: '#contact', label: translations.nav.contact },
  ]

  const handleMenuItemClick = (href: string) => {
    const element = document.querySelector(href)
    element?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header 
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(26, 26, 46, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(8, 247, 254, 0.3)',
        height: '75px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div className="container mx-auto px-4" style={{ height: '75px' }}>
        <div className="flex items-center justify-between" style={{ height: '75px' }}>
          {/* Logo + Order Now Button (always visible) */}
          <div className="flex items-center gap-36 md:gap-44" style={{ flexShrink: 0 }}>
            <Link href="/" className="relative z-10 flex items-center" style={{ height: '75px', flexShrink: 0 }}>
              <Image
                src="/images/logo.png"
                alt="Active Games"
                width={220}
                height={60}
                className="h-auto"
                style={{ 
                  height: 'clamp(45px, 6vw, 60px)',
                  width: 'auto',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5)) drop-shadow(0 0 8px rgba(0, 240, 255, 0.4)) brightness(1.15)',
                }}
                priority
              />
            </Link>
            
            {/* Order Now Button - Always visible, like logo */}
            <Link
              href="/reservation"
              className="glow-button inline-flex items-center gap-1 md:gap-2 px-2 md:px-5 py-1.5 md:py-2 text-[10px] md:text-xs font-bold text-dark hover:scale-105 transition-transform duration-300"
              style={{ 
                fontFamily: 'Orbitron, sans-serif',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                height: 'auto',
                flexShrink: 0
              }}
            >
              {translations.booking?.order_now || 'Order now'}
            </Link>
          </div>

          {/* Desktop Navigation */}
          {!isMobile && (
            <nav className="flex items-center gap-0" style={{ height: '75px', marginRight: '0' }}>

              {menuItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault()
                    handleMenuItemClick(item.href)
                  }}
                  className="uppercase transition-all relative"
                  style={{
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: 'clamp(12px, 1.6vw, 18px)',
                    fontWeight: 700,
                    lineHeight: '10px',
                    letterSpacing: '0.8px',
                    color: '#05f6f7',
                    paddingLeft: 'clamp(6px, 1.2vw, 14px)',
                    paddingRight: 'clamp(6px, 1.2vw, 14px)',
                    paddingTop: '11px',
                    paddingBottom: '11px',
                    backgroundImage: 'linear-gradient(to right, #00F0FF, #F000F0)',
                    backgroundPosition: 'bottom left',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '0% 3px',
                    transition: 'background-size 0.3s ease, color 0.3s ease',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundSize = '100% 3px'
                    e.currentTarget.style.color = '#C7D0FF'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundSize = '0% 3px'
                    e.currentTarget.style.color = '#05f6f7'
                  }}
                >
                  {item.label}
                </a>
              ))}
              
              {/* Laser City Logo */}
              <a 
                href="https://laser-city.co.il" 
                target="_blank" 
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-90"
                style={{ 
                  marginLeft: '8px',
                  marginRight: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  height: '75px',
                  opacity: 1,
                  filter: 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.6)) brightness(1.2)'
                }}
              >
                <Image
                  src="/images/logo_laser_city.png"
                  alt="Laser City"
                  width={100}
                  height={35}
                  style={{ 
                    height: 'auto',
                    width: '100px',
                    maxWidth: '100px'
                  }}
                  unoptimized
                />
              </a>
              
              {/* Language Selector */}
              <div 
                className="relative" 
                style={{ marginLeft: '0' }}
                onMouseEnter={() => setIsLangOpen(true)}
                onMouseLeave={() => setIsLangOpen(false)}
              >
                <button
                  onClick={() => setIsLangOpen(!isLangOpen)}
                    style={{
                      backgroundColor: 'transparent',
                      color: '#05f6f7',
                      border: 'none',
                      fontSize: 'clamp(12px, 1.6vw, 18px)',
                      fontFamily: 'Roboto, sans-serif',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: '11px clamp(6px, 1.2vw, 14px)',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'color 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#C7D0FF'
                  }}
                  onMouseLeave={(e) => {
                    if (!isLangOpen) {
                      e.currentTarget.style.color = '#05f6f7'
                    }
                  }}
                >
                  <span>{languageFlags[locale]}</span>
                  <svg 
                    style={{ 
                      width: '12px', 
                      height: '12px', 
                      fill: 'currentColor', 
                      transition: 'transform 0.3s ease', 
                      transform: isLangOpen ? 'rotate(180deg)' : 'rotate(0deg)' 
                    }} 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </button>
                {isLangOpen && (
                  <div 
                    onMouseEnter={() => setIsLangOpen(true)}
                    onMouseLeave={() => setIsLangOpen(false)}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      ...(locale === 'he' ? { left: '0' } : { right: '0' }),
                      paddingTop: '8px',
                      backgroundColor: 'transparent',
                    }}
                  >
                    <div style={{
                      backgroundColor: 'rgba(26, 26, 46, 0.95)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '4px',
                      border: '1px solid rgba(8, 247, 254, 0.3)',
                      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
                      zIndex: 1000,
                      minWidth: '120px',
                      padding: '4px 0'
                    }}>
                    {locales.map((loc) => (
                      <button
                        key={loc}
                        onClick={() => {
                          onLocaleChange(loc)
                          setIsLangOpen(false)
                        }}
                        style={{
                          width: '100%',
                          backgroundColor: 'transparent',
                          color: locale === loc ? '#C7D0FF' : '#05f6f7',
                          border: 'none',
                          fontSize: 'clamp(12px, 1.6vw, 18px)',
                          fontFamily: 'Roboto, sans-serif',
                          fontWeight: locale === loc ? 700 : 400,
                          cursor: 'pointer',
                          padding: '10px 16px',
                          textAlign: locale === 'he' ? 'right' : 'left',
                          outline: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'background-color 0.3s ease, color 0.3s ease',
                          whiteSpace: 'nowrap',
                          flexDirection: locale === 'he' ? 'row-reverse' : 'row'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(8, 247, 254, 0.1)'
                          e.currentTarget.style.color = '#C7D0FF'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                          e.currentTarget.style.color = locale === loc ? '#C7D0FF' : '#05f6f7'
                        }}
                      >
                        <span style={{ fontSize: '18px' }}>{languageFlags[loc]}</span>
                        <span style={{ fontSize: '14px', fontWeight: 400 }}>
                          {loc === 'en' ? 'English' : 'עברית'}
                        </span>
                      </button>
                    ))}
                    </div>
                  </div>
                )}
              </div>
            </nav>
          )}

          {/* Mobile Menu Button */}
          {isMobile && (
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                outline: 'none'
              }}
              aria-label="Toggle menu"
            >
              <span style={{
                display: 'block',
                width: '25px',
                height: '3px',
                backgroundColor: '#05f6f7',
                borderRadius: '2px',
                transition: 'all 0.3s ease',
                transform: isMenuOpen ? 'rotate(45deg) translate(8px, 8px)' : 'none'
              }}></span>
              <span style={{
                display: 'block',
                width: '25px',
                height: '3px',
                backgroundColor: '#05f6f7',
                borderRadius: '2px',
                transition: 'all 0.3s ease',
                opacity: isMenuOpen ? 0 : 1
              }}></span>
              <span style={{
                display: 'block',
                width: '25px',
                height: '3px',
                backgroundColor: '#05f6f7',
                borderRadius: '2px',
                transition: 'all 0.3s ease',
                transform: isMenuOpen ? 'rotate(-45deg) translate(7px, -7px)' : 'none'
              }}></span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobile && (
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                position: 'fixed',
                top: '75px',
                left: 0,
                right: 0,
                backgroundColor: 'rgba(26, 26, 46, 0.98)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(8, 247, 254, 0.3)',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
                zIndex: 1000,
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              {menuItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault()
                    setIsMenuOpen(false)
                    handleMenuItemClick(item.href)
                  }}
                  style={{
                    fontFamily: 'Roboto, sans-serif',
                          fontSize: '16px',
                    fontWeight: 700,
                    letterSpacing: '0.8px',
                    color: '#05f6f7',
                    textDecoration: 'none',
                    padding: '12px 0',
                    borderBottom: '1px solid rgba(8, 247, 254, 0.2)',
                    transition: 'color 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#C7D0FF'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#05f6f7'
                  }}
                >
                  {item.label}
                </a>
              ))}
              <div style={{
                display: 'flex',
                gap: '16px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(8, 247, 254, 0.2)'
              }}>
                {locales.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => {
                      onLocaleChange(loc)
                      setIsMenuOpen(false)
                    }}
                    style={{
                      backgroundColor: 'transparent',
                      color: locale === loc ? '#C7D0FF' : '#05f6f7',
                      border: '1px solid rgba(8, 247, 254, 0.3)',
                      borderRadius: '4px',
                      fontSize: '16px',
                      fontFamily: 'Roboto, sans-serif',
                      fontWeight: locale === loc ? 700 : 400,
                      cursor: 'pointer',
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(8, 247, 254, 0.1)'
                      e.currentTarget.style.color = '#C7D0FF'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = locale === loc ? '#C7D0FF' : '#05f6f7'
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>{languageFlags[loc]}</span>
                    <span>{loc === 'en' ? 'English' : 'עברית'}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </header>
  )
}