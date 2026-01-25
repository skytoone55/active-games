import type { Metadata } from 'next'
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
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
        <GlobalWidgets />
      </body>
    </html>
  )
}
