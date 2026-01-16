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
  }
}

export default function Footer({ translations }: FooterProps) {
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
              {translations.branches.items[0]?.name || translations.branches.title}
            </h4>
            {translations.branches.items[0] && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  <p className="text-gray-400 text-sm">{translations.branches.items[0].address}</p>
                </div>
                <p className="text-primary text-sm pl-6">{translations.branches.items[0].venue}</p>
                <a
                  href={`tel:${translations.branches.items[0].phone.replace(/[^\d]/g, '')}`}
                  className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors text-sm pl-6"
                >
                  <Phone className="w-3 h-3" />
                  {translations.branches.items[0].phone}
                </a>
              </div>
            )}
          </div>

          {/* Second Branch (Petah Tikva) */}
          <div>
            <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">
              {translations.branches.items[1]?.name || ''}
            </h4>
            {translations.branches.items[1] && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  <p className="text-gray-400 text-sm">{translations.branches.items[1].address}</p>
                </div>
                <p className="text-primary text-sm pl-6">{translations.branches.items[1].venue}</p>
                <a
                  href={`tel:${translations.branches.items[1].phone.replace(/[^\d]/g, '')}`}
                  className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors text-sm pl-6"
                >
                  <Phone className="w-3 h-3" />
                  {translations.branches.items[1].phone}
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
              <li>
                <a
                  href={`tel:${translations.contact.info.phone.replace(/\s/g, '')}`}
                  className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors text-sm"
                >
                  <Phone className="w-4 h-4" />
                  {translations.contact.info.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${translations.contact.info.email}`}
                  className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors text-sm"
                >
                  <Mail className="w-4 h-4" />
                  {translations.contact.info.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-dark-200 mt-8 pt-8 text-center">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} Active Games Rishon LeZion. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
