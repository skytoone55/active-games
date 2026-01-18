/**
 * API Roles - Gestion des rôles dynamiques
 *
 * GET /api/roles - Liste tous les rôles (triés par level)
 * POST /api/roles - Créer un nouveau rôle (selon hiérarchie)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { Role } from '@/lib/supabase/types'

/**
 * GET /api/roles
 * Liste tous les rôles disponibles, triés par niveau (1 = plus haute autorité)
 * Accessible à tous les utilisateurs authentifiés
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Utiliser le service role client pour fetch les rôles
    const serviceClient = createServiceRoleClient()

    const { data: roles, error } = await serviceClient
      .from('roles')
      .select('*')
      .order('level', { ascending: true })

    if (error) {
      console.error('Error fetching roles:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch roles' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      roles: roles || []
    })

  } catch (error) {
    console.error('Error in roles API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/roles
 * Créer un nouveau rôle
 * Règles de hiérarchie:
 * - L'utilisateur doit avoir un level < au level du nouveau rôle
 * - Le level 1 ne peut pas être créé (réservé à super_admin système)
 * - Le nom doit être unique
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Récupérer le profil et le rôle de l'utilisateur
    const serviceClient = createServiceRoleClient()

    const { data: profileData, error: profileError } = await serviceClient
      .from('profiles')
      .select('role, role_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profileData) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      )
    }

    const profile = profileData as { role?: string | null; role_id?: string | null }

    // Récupérer le level de l'utilisateur
    const { data: userRole, error: userRoleError } = await serviceClient
      .from('roles')
      .select('level')
      .eq('name', profile.role || '')
      .single<{ level: number }>()

    if (userRoleError || !userRole) {
      return NextResponse.json(
        { success: false, error: 'User role not found' },
        { status: 404 }
      )
    }

    const userLevel = userRole.level

    // Parser le body
    const body = await request.json()
    const { name, display_name, description, level, color, icon } = body

    // Validations
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      )
    }

    if (!display_name || typeof display_name !== 'string' || display_name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Display name is required' },
        { status: 400 }
      )
    }

    if (typeof level !== 'number' || level < 1 || level > 10) {
      return NextResponse.json(
        { success: false, error: 'Level must be between 1 and 10' },
        { status: 400 }
      )
    }

    // Vérifier la hiérarchie: l'utilisateur ne peut créer que des rôles avec level > son level
    if (level <= userLevel) {
      return NextResponse.json(
        { success: false, error: `You can only create roles with level greater than ${userLevel}` },
        { status: 403 }
      )
    }

    // Le level 1 est réservé au super_admin système
    if (level === 1) {
      return NextResponse.json(
        { success: false, error: 'Level 1 is reserved for system super_admin' },
        { status: 403 }
      )
    }

    // Vérifier que le nom est unique
    const { data: existingRole } = await serviceClient
      .from('roles')
      .select('id')
      .eq('name', name.trim().toLowerCase().replace(/\s+/g, '_'))
      .single()

    if (existingRole) {
      return NextResponse.json(
        { success: false, error: 'A role with this name already exists' },
        { status: 409 }
      )
    }

    // Créer le rôle
    const newRole: Partial<Role> = {
      name: name.trim().toLowerCase().replace(/\s+/g, '_'),
      display_name: display_name.trim(),
      description: description?.trim() || null,
      level,
      color: color || '#3B82F6',
      icon: icon || 'User',
      is_system: false
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: createdRole, error: createError } = await (serviceClient as any)
      .from('roles')
      .insert(newRole)
      .select()
      .single()

    if (createError) {
      console.error('Error creating role:', createError)
      return NextResponse.json(
        { success: false, error: 'Failed to create role' },
        { status: 500 }
      )
    }

    // Créer les permissions par défaut pour ce nouveau rôle (toutes à false)
    const resources = ['agenda', 'orders', 'clients', 'users', 'logs', 'settings', 'permissions']
    const permissionsToInsert = resources.map(resource => ({
      role: createdRole.name,
      role_id: createdRole.id,
      resource,
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient as any)
      .from('role_permissions')
      .insert(permissionsToInsert)

    return NextResponse.json({
      success: true,
      role: createdRole
    })

  } catch (error) {
    console.error('Error in roles POST API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
