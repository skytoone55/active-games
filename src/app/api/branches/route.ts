/**
 * API Route pour récupérer les branches
 * GET: Liste toutes les branches actives
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * GET /api/branches
 * Retourne toutes les branches actives
 * Query params:
 * - slug: filtre par slug (retourne une seule branche)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    // Si slug fourni, chercher une branche spécifique
    if (slug) {
      const { data: branch, error } = await supabase
        .from('branches')
        .select('id, slug, name, name_en, address, phone, is_active')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()

      if (error) {
        console.error('Error fetching branch:', error)
        return NextResponse.json(
          { success: false, error: 'Branch not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        branch
      })
    }

    // Sinon, retourner toutes les branches
    const { data: branches, error } = await supabase
      .from('branches')
      .select('id, slug, name, name_en, address, phone, is_active')
      .eq('is_active', true)
      .order('sort_order')

    if (error) {
      console.error('Error fetching branches:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch branches' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      branches
    })
    
  } catch (error) {
    console.error('Error fetching branches:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
