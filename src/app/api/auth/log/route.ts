/**
 * API Route pour logger les événements d'authentification
 * POST: Logger une connexion ou déconnexion
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { logUserAction, getClientIpFromHeaders } from '@/lib/activity-logger'
import type { UserRole, Profile } from '@/lib/supabase/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body // 'login' ou 'logout'

    if (!action || !['login', 'logout'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // Pour logout, on peut ne pas avoir d'utilisateur
      if (action === 'logout') {
        return NextResponse.json({ success: true })
      }
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Récupérer le profil
    const serviceClient = createServiceRoleClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single<Profile>()

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      )
    }

    const ipAddress = getClientIpFromHeaders(request.headers)

    // Logger l'action
    await logUserAction({
      userId: user.id,
      userRole: profile.role as UserRole,
      userName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
      action: action as 'login' | 'logout',
      targetUserId: user.id,
      targetUserName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
      details: {
        email: user.email,
        method: action === 'login' ? 'password' : undefined
      },
      ipAddress
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error logging auth event:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
