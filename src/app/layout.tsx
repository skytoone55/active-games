import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { GlobalWidgets } from '@/components'

export const metadata: Metadata = {
  title: 'Active Games - New Generation Leisure Activities',
  description: 'Fully immersive interactive arenas, where neon lighting, sound, and physical challenges combine to create unique experiences.',
  keywords: ['active games', 'interactive games', 'LED games', 'entertainment', 'franchise', 'laser', 'arena'],
  authors: [{ name: 'Active Games World' }],
  openGraph: {
    title: 'Active Games - New Generation Leisure Activities',
    description: 'Fully immersive interactive arenas, where neon lighting, sound, and physical challenges combine to create unique experiences.',
    url: 'https://activegamesworld.com',
    siteName: 'Active Games',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Google Analytics GA4 */}
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-2PPM01Z55V"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-2PPM01Z55V');
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Disable mouse wheel on number inputs globally
              document.addEventListener('wheel', function(e) {
                if (document.activeElement.type === 'number') {
                  document.activeElement.blur();
                }
              });
            `,
          }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {/* Skip link - OBLIGATOIRE IS 5568 Level AA (WCAG 2.4.1) */}
        <a href="#main-content" className="skip-link">
          דלג לתוכן הראשי
        </a>
        {children}
        <GlobalWidgets />
      </body>
    </html>
  )
}
