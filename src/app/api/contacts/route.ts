/**
 * API Route pour gérer les contacts
 * GET: Liste des contacts avec filtres et pagination
 * POST: Créer un nouveau contact
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { logContactAction, getClientIpFromHeaders } from '@/lib/activity-logger'
import { validateIsraeliPhone, formatIsraeliPhone } from '@/lib/validation'
import type { UserRole, Contact } from '@/lib/supabase/types'

/**
 * GET /api/contacts
 * Liste les contacts avec filtres et pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier les permissions
    const { success, user, errorResponse } = await verifyApiPermission('clients', 'view')
    if (!success || !user) {
      return errorResponse
    }

    const searchParams = request.nextUrl.searchParams
    // Support both naming conventions (branchId and branch_id)
    const branchId = searchParams.get('branchId') || searchParams.get('branch_id')
    const query = searchParams.get('query')
    const status = searchParams.get('status') || 'active'
    const includeArchived = searchParams.get('includeArchived') === 'true' || searchParams.get('include_archived') === 'true'
    const source = searchParams.get('source')
    const dateFrom = searchParams.get('dateFrom') || searchParams.get('date_from')
    const dateTo = searchParams.get('dateTo') || searchParams.get('date_to')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || searchParams.get('page_size') || '50')

    // Mode vérification de doublons
    const checkDuplicates = searchParams.get('checkDuplicates') === 'true'
    const phone = searchParams.get('phone')
    const email = searchParams.get('email')
    const excludeId = searchParams.get('excludeId')

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: 'branchId is required', messageKey: 'errors.branchRequired' },
        { status: 400 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(branchId)) {
      return NextResponse.json(
        { success: false, error: 'Branch access denied', messageKey: 'errors.branchAccessDenied' },
        { status: 403 }
      )
    }

    const supabase = createServiceRoleClient()

    // Mode checkDuplicates
    if (checkDuplicates && phone) {
      const formattedPhone = formatIsraeliPhone(phone)

      // Chercher par téléphone
      let phoneQuery = supabase
        .from('contacts')
        .select('*')
        .eq('branch_id_main', branchId)
        .eq('phone', formattedPhone)

      if (excludeId) {
        phoneQuery = phoneQuery.neq('id', excludeId)
      }

      const { data: phoneMatches } = await phoneQuery.returns<Contact[]>()

      // Chercher par email si fourni
      let emailMatches: Contact[] = []
      if (email && email.trim()) {
        let emailQuery = supabase
          .from('contacts')
          .select('*')
          .eq('branch_id_main', branchId)
          .eq('email', email.trim())

        if (excludeId) {
          emailQuery = emailQuery.neq('id', excludeId)
        }

        const { data: emailData } = await emailQuery.returns<Contact[]>()
        emailMatches = emailData || []
      }

      return NextResponse.json({
        success: true,
        phoneMatches: phoneMatches || [],
        emailMatches
      })
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // Construire la requête
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dbQuery = (supabase as any)
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('branch_id_main', branchId)

    // Filtrer par status
    if (!includeArchived) {
      if (status) {
        dbQuery = dbQuery.eq('status', status)
      } else {
        dbQuery = dbQuery.eq('status', 'active')
      }
    }

    // Filtrer par source
    if (source) {
      dbQuery = dbQuery.eq('source', source)
    }

    // Filtrer par date
    if (dateFrom) {
      dbQuery = dbQuery.gte('created_at', dateFrom)
    }
    if (dateTo) {
      dbQuery = dbQuery.lte('created_at', dateTo + 'T23:59:59')
    }

    // Recherche multi-champs
    if (query && query.trim().length > 0) {
      const searchQuery = query.trim()
      dbQuery = dbQuery.or(
        `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`
      )
    }

    // Tri et pagination
    dbQuery = dbQuery
      .order('created_at', { ascending: false })
      .range(from, to)

    const { data: contacts, error, count } = await dbQuery

    if (error) {
      console.error('Error fetching contacts:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contacts', messageKey: 'errors.fetchFailed' },
        { status: 500 }
      )
    }

    const total = count || 0
    const totalPages = Math.ceil(total / pageSize)

    return NextResponse.json({
      success: true,
      contacts: contacts || [],
      total,
      page,
      pageSize,
      totalPages
    })

  } catch (error) {
    console.error('Error in GET /api/contacts:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', messageKey: 'errors.internalError' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/contacts
 * Créer un nouveau contact
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier les permissions
    const { success, user, errorResponse } = await verifyApiPermission('clients', 'create')
    if (!success || !user) {
      return errorResponse
    }

    const body = await request.json()
    const {
      branch_id_main,
      first_name,
      last_name,
      phone,
      email,
      notes_client,
      alias,
      source = 'admin_agenda'
    } = body

    // Validation des champs requis
    if (!branch_id_main || !first_name || !phone) {
      return NextResponse.json(
        { success: false, error: 'branch_id_main, first_name, and phone are required', messageKey: 'errors.missingFields' },
        { status: 400 }
      )
    }

    // Vérifier l'accès à la branche
    if (user.role !== 'super_admin' && !user.branchIds.includes(branch_id_main)) {
      return NextResponse.json(
        { success: false, error: 'Branch access denied', messageKey: 'errors.branchAccessDenied' },
        { status: 403 }
      )
    }

    // Valider le format téléphone
    if (!validateIsraeliPhone(phone)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone format (expected 05XXXXXXXX)', messageKey: 'errors.invalidPhoneFormat' },
        { status: 400 }
      )
    }

    const formattedPhone = formatIsraeliPhone(phone)
    const supabase = createServiceRoleClient()
    const ipAddress = getClientIpFromHeaders(request.headers)

    // Vérifier les doublons
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .eq('branch_id_main', branch_id_main)
      .eq('phone', formattedPhone)
      .single<{ id: string; first_name: string; last_name: string | null }>()

    if (existingContact) {
      return NextResponse.json(
        {
          success: false,
          error: `A contact with this phone already exists: ${existingContact.first_name} ${existingContact.last_name || ''}`.trim(),
          messageKey: 'errors.duplicatePhone',
          existingContact
        },
        { status: 409 }
      )
    }

    // Créer le contact
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contact, error } = await (supabase as any)
      .from('contacts')
      .insert({
        branch_id_main,
        first_name: first_name.trim(),
        last_name: last_name?.trim() || null,
        phone: formattedPhone,
        email: email?.trim() || null,
        notes_client: notes_client?.trim() || null,
        alias: alias?.trim() || null,
        source,
        status: 'active'
      })
      .select()
      .single() as { data: Contact | null; error: any }

    if (error || !contact) {
      console.error('Error creating contact:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create contact', messageKey: 'errors.createFailed' },
        { status: 500 }
      )
    }

    // Logger la création
    await logContactAction({
      userId: user.id,
      userRole: user.role as UserRole,
      userName: `${user.profile.first_name} ${user.profile.last_name}`.trim(),
      action: 'created',
      contactId: contact.id,
      contactName: `${contact.first_name} ${contact.last_name || ''}`.trim(),
      branchId: branch_id_main,
      details: {
        phone: contact.phone,
        email: contact.email,
        source: contact.source
      },
      ipAddress
    })

    return NextResponse.json({ success: true, contact }, { status: 201 })

  } catch (error) {
    console.error('Error in POST /api/contacts:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', messageKey: 'errors.internalError' },
      { status: 500 }
    )
  }
}
