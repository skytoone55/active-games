import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createRemoteJWKSet, jwtVerify } from 'jose'

// ─────────────────────────────────────────────────────────────────────────────
// PERF: l'ancien middleware appelait supabase.auth.getUser() — un ALLER-RETOUR
// RÉSEAU vers le serveur d'auth Supabase — sur CHAQUE requête /admin/* et
// /api/chat/*. Avec des utilisateurs en Israël et Supabase aux USA, chaque
// navigation/appel API payait ~100-200 ms de péage avant même de commencer.
//
// Désormais : vérification LOCALE du JWT (signature ES256 via JWKS, mis en
// cache par jose) — zéro réseau dans le cas normal. On ne retombe sur le
// chemin réseau (getUser + refresh des cookies) que si le token est absent,
// invalide ou expiré. Comportement fonctionnel identique, latence en moins.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// JWKS distant, mis en cache par jose entre les invocations du même isolate.
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))

// Extrait l'access token du cookie @supabase/ssr (sb-<ref>-auth-token),
// en gérant les cookies fragmentés (.0/.1/…) et le préfixe "base64-".
function getAccessTokenFromCookies(request: NextRequest): string | null {
  const chunks = request.cookies
    .getAll()
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
  if (chunks.length === 0) return null

  chunks.sort((a, b) => {
    const ai = a.name.match(/\.(\d+)$/)
    const bi = b.name.match(/\.(\d+)$/)
    return (ai ? parseInt(ai[1], 10) : -1) - (bi ? parseInt(bi[1], 10) : -1)
  })

  let raw = chunks.map((c) => c.value).join('')
  try {
    if (raw.startsWith('base64-')) {
      // base64url → base64 standard puis décodage
      const b64 = raw.slice(7).replace(/-/g, '+').replace(/_/g, '/')
      const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
      raw = atob(padded)
    }
    const session = JSON.parse(raw) as { access_token?: string }
    return session?.access_token ?? null
  } catch {
    return null
  }
}

// Vérification locale du JWT — pas de réseau (hors 1er chargement du JWKS).
async function verifyLocally(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, JWKS, { clockTolerance: 10 })
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  const isLoginPage = request.nextUrl.pathname === '/admin/login'
  const isChatApiRoute = request.nextUrl.pathname.startsWith('/api/chat')

  // ── Chemin RAPIDE : token présent et signature/expiration valides ──────────
  const token = getAccessTokenFromCookies(request)
  if (token && (await verifyLocally(token))) {
    if (isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  // ── Chemin LENT (token absent/expiré) : getUser() réseau + refresh cookies ─
  // Create a response to modify
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired — required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // API routes: return 401 JSON if not authenticated
  if (isChatApiRoute && !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // If accessing admin pages (not login) without auth → redirect to login
  if (isAdminRoute && !isLoginPage && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  // If on login page but already authenticated → redirect to admin
  if (isLoginPage && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Match all admin routes
    '/admin/:path*',
    // Match all chat API routes (require authentication)
    '/api/chat/:path*',
  ],
}
