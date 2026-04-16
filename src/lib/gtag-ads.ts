declare function gtag(...args: unknown[]): void

export function trackPhoneCall() {
  if (typeof gtag !== 'undefined') {
    gtag('event', 'conversion', {
      send_to: 'AW-18086069664/4XcpCMOO85scEKCLjrBD',
    })
  }
}

export function trackWhatsApp() {
  if (typeof gtag !== 'undefined') {
    gtag('event', 'conversion', {
      send_to: 'AW-18086069664/pBxZCMaO85scEKCLjrBD',
    })
  }
}

export function trackLeadForm() {
  if (typeof gtag !== 'undefined') {
    gtag('event', 'conversion', {
      send_to: 'AW-18086069664/xxaxCPvG85scEKCLjrBD',
    })
  }
}
