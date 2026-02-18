'use client'

import { usePathname } from 'next/navigation'
import WhatsAppButton from './WhatsAppButton'
import { AccessibilityWidget } from './AccessibilityWidget'

/**
 * GlobalWidgets - Displays WhatsApp button and accessibility widget on public pages
 * Does NOT render on admin pages
 */
export function GlobalWidgets() {
  const pathname = usePathname()

  // Don't show widgets on admin pages
  if (pathname?.startsWith('/admin')) {
    return null
  }

  return (
    <>
      <WhatsAppButton />
      <AccessibilityWidget />
    </>
  )
}
