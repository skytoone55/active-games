import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 })
    }

    // Vérifier que l'utilisateur est super_admin
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const profile = profileData as { role: string } | null
    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Accès réservé aux super administrateurs' }, { status: 403 })
    }

    const body = await request.json()
    const { password } = body

    if (!password) {
      return NextResponse.json({ success: false, error: 'Mot de passe requis' }, { status: 400 })
    }

    // Vérifier le mot de passe
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: password
    })

    if (signInError) {
      return NextResponse.json({ success: false, error: 'Mot de passe incorrect' }, { status: 401 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[VERIFY-PASSWORD] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
