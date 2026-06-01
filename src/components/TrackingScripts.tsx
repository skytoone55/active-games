'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'

/**
 * Scripts de tracking marketing (GA4, Google Ads, Meta Pixel).
 * Chargés UNIQUEMENT sur les pages publiques — jamais sur l'admin, pour ne pas
 * consommer le thread principal des employés (l'admin n'a aucun besoin de tracking).
 */
export function TrackingScripts() {
  const pathname = usePathname()

  if (pathname?.startsWith('/admin')) {
    return null
  }

  return (
    <>
      {/* Google Analytics GA4 + Google Ads */}
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
            gtag('config', 'AW-18086069664');
          `,
        }}
      />
      {/* Meta Pixel */}
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init','800335057915446');
            fbq('track','PageView');
          `,
        }}
      />
    </>
  )
}
