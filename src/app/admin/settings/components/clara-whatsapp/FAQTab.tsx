'use client'

import { FAQSection } from './FAQSection'

interface FAQTabProps {
  isDark: boolean
}

export function FAQTab({ isDark }: FAQTabProps) {
  return <FAQSection isDark={isDark} />
}
