import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  compress: true,

  // Cache agressif pour les vidéos — réduit drastiquement le Fast Data Transfer Vercel.
  // immutable + 1 an : le CDN edge garde la vidéo en cache, pas de re-transfert
  // à chaque visiteur depuis la même région.
  async headers() {
    return [
      {
        source: '/videos/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'activegamesworld.com',
      },
    ],
  },
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{ kebabCase member }}',
    },
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
}

export default nextConfig
