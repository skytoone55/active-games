declare function gtag(...args: unknown[]): void
declare function fbq(...args: unknown[]): void

// ─── Google Ads conversions ───────────────────────────────────────────────────

export function trackPhoneCall() {
  if (typeof gtag !== 'undefined') {
    gtag('event', 'conversion', {
      send_to: 'AW-18086069664/4XcpCMOO85scEKCLjrBD',
    })
  }
  // Meta Pixel — Contact
  if (typeof fbq !== 'undefined') {
    fbq('track', 'Contact')
  }
}

export function trackWhatsApp() {
  if (typeof gtag !== 'undefined') {
    gtag('event', 'conversion', {
      send_to: 'AW-18086069664/pBxZCMaO85scEKCLjrBD',
    })
  }
  // Meta Pixel — Contact
  if (typeof fbq !== 'undefined') {
    fbq('track', 'Contact')
  }
}

export function trackLeadForm() {
  if (typeof gtag !== 'undefined') {
    gtag('event', 'conversion', {
      send_to: 'AW-18086069664/xxaxCPvG85scEKCLjrBD',
    })
  }
  // Meta Pixel — Lead
  if (typeof fbq !== 'undefined') {
    fbq('track', 'Lead')
  }
}
