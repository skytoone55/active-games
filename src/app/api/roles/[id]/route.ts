/**
 * API Roles - Gestion individuelle d'un rôle
 *
 * GET /api/roles/[id] - Détails d'un rôle
 * PUT /api/roles/[id] - Modifier un rôle
 * DELETE /api/roles/[id] - Supprimer un rôle
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * GET /api/roles/[id]
 * Récupérer les détails d'un rôle
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const serviceClient = createServiceRoleClient()

    const { data: role, error } = await serviceClient
      .from('roles')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !role) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      role
    })

  } catch (error) {
    console.error('Error in roles GET API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/roles/[id]
 * Modifier un rôle existant
 * Règles:
 * - Les rôles is_system ne peuvent pas être modifiés
 * - L'utilisateur doit avoir un level < au level du rôle à modifier
 * - Le level ne peut pas être changé vers un level <= userLevel
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const serviceClient = createServiceRoleClient()

    // Récupérer le level de l'utilisateur
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      )
    }

    const { data: userRole } = await serviceClient
      .from('roles')
      .select('level')
      .eq('name', profile.role)
      .single()

    const userLevel = userRole?.level ?? 10

    // Récupérer le rôle à modifier
    const { data: targetRole, error: roleError } = await serviceClient
      .from('roles')
      .select('*')
      .eq('id', id)
      .single()

    if (roleError || !targetRole) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      )
    }

    // Vérifier que le rôle n'est pas un rôle système
    if (targetRole.is_system) {
      return NextResponse.json(
        { success: false, error: 'System roles cannot be modified' },
        { status: 403 }
      )
    }

    // Vérifier la hiérarchie: l'utilisateur doit avoir un level < au level du rôle
    // Exception: le super_admin (level 1) peut modifier tous les rôles non-système
    if (userLevel !== 1 && userLevel >= targetRole.level) {
      return NextResponse.json(
        { success: false, error: 'You can only modify roles with level greater than yours' },
        { status: 403 }
      )
    }

    // Parser le body
    const body = await request.json()
    const { display_name, description, level, color, icon } = body

    // Construire l'objet de mise à jour
    const updates: Record<string, unknown> = {}

    if (display_name !== undefined) {
      if (typeof display_name !== 'string' || display_name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Display name cannot be empty' },
          { status: 400 }
        )
      }
      updates.display_name = display_name.trim()
    }

    if (description !== undefined) {
      updates.description = description?.trim() || null
    }

    if (level !== undefined) {
      if (typeof level !== 'number' || level < 1 || level > 10) {
        return NextResponse.json(
          { success: false, error: 'Level must be between 1 and 10' },
          { status: 400 }
        )
      }
      // Le nouveau level doit être > userLevel (sauf pour super_admin level 1)
      if (userLevel !== 1 && level <= userLevel) {
        return NextResponse.json(
          { success: false, error: `You can only set level greater than ${userLevel}` },
          { status: 403 }
        )
      }
      // Le level 1 est réservé
      if (level === 1) {
        return NextResponse.json(
          { success: false, error: 'Level 1 is reserved for system super_admin' },
          { status: 403 }
        )
      }
      updates.level = level
    }

    if (color !== undefined) {
      updates.color = color || '#3B82F6'
    }

    if (icon !== undefined) {
      updates.icon = icon || 'User'
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes to apply',
        role: targetRole
      })
    }

    // Mettre à jour le rôle
    const { data: updatedRole, error: updateError } = await serviceClient
      .from('roles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating role:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update role' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      role: updatedRole
    })

  } catch (error) {
    console.error('Error in roles PUT API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/roles/[id]
 * Supprimer un rôle
 * Règles:
 * - Les rôles is_system ne peuvent pas être supprimés
 * - L'utilisateur doit avoir un level < au level du rôle
 * - Si des utilisateurs ont ce rôle, la suppression est refusée (sauf si reassign_to est fourni)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const serviceClient = createServiceRoleClient()

    // Récupérer le level de l'utilisateur
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      )
    }

    const { data: userRole } = await serviceClient
      .from('roles')
      .select('level')
      .eq('name', profile.role)
      .single()

    const userLevel = userRole?.level ?? 10

    // Récupérer le rôle à supprimer
    const { data: targetRole, error: roleError } = await serviceClient
      .from('roles')
      .select('*')
      .eq('id', id)
      .single()

    if (roleError || !targetRole) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      )
    }

    // Vérifier que le rôle n'est pas un rôle système
    if (targetRole.is_system) {
      return NextResponse.json(
        { success: false, error: 'System roles cannot be deleted' },
        { status: 403 }
      )
    }

    // Vérifier la hiérarchie (sauf super_admin level 1)
    if (userLevel !== 1 && userLevel >= targetRole.level) {
      return NextResponse.json(
        { success: false, error: 'You can only delete roles with level greater than yours' },
        { status: 403 }
      )
    }

    // Vérifier si des utilisateurs ont ce rôle
    const { data: usersWithRole, error: usersError } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('role_id', id)

    if (usersError) {
      console.error('Error checking users with role:', usersError)
      return NextResponse.json(
        { success: false, error: 'Failed to check users with this role' },
        { status: 500 }
      )
    }

    // Vérifier le paramètre force_remove pour mettre les utilisateurs sans rôle
    const url = new URL(request.url)
    const forceRemove = url.searchParams.get('force_remove') === 'true'

    if (usersWithRole && usersWithRole.length > 0) {
      if (!forceRemove) {
        // Retourner le nombre d'utilisateurs affectés pour que le frontend affiche un popup de confirmation
        return NextResponse.json(
          {
            success: false,
            error: `Ce rôle est assigné à ${usersWithRole.length} utilisateur(s). Ces utilisateurs seront mis sans rôle et n'auront plus accès au système jusqu'à réassignation.`,
            users_count: usersWithRole.length,
            requires_confirmation: true
          },
          { status: 409 }
        )
      }

      // Mettre les utilisateurs sans rôle (role = null, role_id = null)
      const { error: removeRoleError } = await serviceClient
        .from('profiles')
        .update({
          role: null,
          role_id: null
        })
        .eq('role_id', id)

      if (removeRoleError) {
        console.error('Error removing role from users:', removeRoleError)
        return NextResponse.json(
          { success: false, error: 'Failed to remove role from users' },
          { status: 500 }
        )
      }
    }

    // Supprimer les permissions du rôle
    await serviceClient
      .from('role_permissions')
      .delete()
      .eq('role_id', id)

    // Supprimer le rôle
    const { error: deleteError } = await serviceClient
      .from('roles')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting role:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete role' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully'
    })

  } catch (error) {
    console.error('Error in roles DELETE API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
