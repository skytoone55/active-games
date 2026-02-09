'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Mail, Phone, MapPin } from 'lucide-react'

interface FooterProps {
  translations: {
    footer: {
      games_title: string
      concept_title: string
      pricing_title: string
    }
    branches: {
      title: string
      items: Array<{
        name: string
        address: string
        city: string
        phone: string
        venue: string
      }>
    }
    contact: {
      info: {
        phone: string
        email: string
      }
    }
    accessibility?: {
      statement?: string
    }
  }
}

export default function Footer({ translations }: FooterProps) {
  // Protection contre les traductions manquantes
  const branches = translations?.branches?.items || []
  const branch1 = branches[0]
  const branch2 = branches[1]
  const branchesTitle = translations?.branches?.title || 'Locations'
  const contactPhone = translations?.contact?.info?.phone || ''
  const contactEmail = translations?.contact?.info?.email || ''

  return (
    <footer className="bg-dark border-t border-dark-200 py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo + Laser City */}
          <div className="flex flex-col items-center space-y-4">
            <Link href="/" className="block">
              <Image
                src="/images/logo.png"
                alt="Active Games"
                width={250}
                height={65}
                className="h-auto w-auto"
                style={{
                  height: '65px',
                  width: 'auto',
                  filter: 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.4)) brightness(1.15)'
                }}
              />
            </Link>
            <a
              href="https://laser-city.co.il"
              target="_blank"
              rel="noopener noreferrer"
              className="block transition-opacity hover:opacity-90"
              style={{
                opacity: 1,
                filter: 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.6)) brightness(1.2)'
              }}
            >
              <Image
                src="/images/logo_laser_city.png"
                alt="Laser City"
                width={200}
                height={71}
                className="h-auto w-auto max-w-[200px]"
                unoptimized
              />
            </a>
          </div>

          {/* First Branch (Rishon LeZion) */}
          <div>
            <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">
              {branch1?.name || branchesTitle}
            </h4>
            {branch1 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  <p className="text-gray-400 text-sm">{branch1.address}</p>
                </div>
                <p className="text-primary text-sm pl-6">{branch1.venue}</p>
                <a
                  href={`tel:${branch1.phone?.replace(/[^\d]/g, '') || ''}`}
                  className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors text-sm pl-6"
                >
                  <Phone className="w-3 h-3" />
                  {branch1.phone}
                </a>
              </div>
            )}
          </div>

          {/* Second Branch (Petah Tikva) */}
          <div>
            <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">
              {branch2?.name || ''}
            </h4>
            {branch2 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  <p className="text-gray-400 text-sm">{branch2.address}</p>
                </div>
                <p className="text-primary text-sm pl-6">{branch2.venue}</p>
                <a
                  href={`tel:${branch2.phone?.replace(/[^\d]/g, '') || ''}`}
                  className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors text-sm pl-6"
                >
                  <Phone className="w-3 h-3" />
                  {branch2.phone}
                </a>
              </div>
            )}
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">
              Contact
            </h4>
            <ul className="space-y-3">
              {contactPhone && (
                <li>
                  <a
                    href={`tel:${contactPhone.replace(/\s/g, '')}`}
                    className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors text-sm"
                  >
                    <Phone className="w-4 h-4" />
                    {contactPhone}
                  </a>
                </li>
              )}
              {contactEmail && (
                <li>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors text-sm"
                  >
                    <Mail className="w-4 h-4" />
                    {contactEmail}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Copyright + Accessibility */}
        <div className="border-t border-dark-200 mt-8 pt-8 text-center">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} Active Games Rishon LeZion. All rights reserved.
          </p>
          <div className="mt-3">
            <Link
              href="/accessibility-statement"
              className="text-gray-400 hover:text-primary transition-colors text-sm underline"
            >
              {translations?.accessibility?.statement || 'Accessibility Statement'}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
