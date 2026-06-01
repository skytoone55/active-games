import type { Metadata } from 'next'
import './globals.css'
import { GlobalWidgets } from '@/components'
import { TrackingScripts } from '@/components/TrackingScripts'

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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Disable mouse wheel on number inputs globally (passif: pas de preventDefault)
              document.addEventListener('wheel', function(e) {
                if (document.activeElement && document.activeElement.type === 'number') {
                  document.activeElement.blur();
                }
              }, { passive: true });
            `,
          }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {/* Meta Pixel noscript fallback */}
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=800335057915446&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {/* Skip link - OBLIGATOIRE IS 5568 Level AA (WCAG 2.4.1) */}
        <a href="#main-content" className="skip-link">
          דלג לתוכן הראשי
        </a>
        {children}
        <GlobalWidgets />
        <TrackingScripts />
      </body>
    </html>
  )
}
