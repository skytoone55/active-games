/**
 * Synchronise les appels depuis l'API Telnyx CDR
 * Endpoint appelé manuellement depuis l'interface admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { CallDirection, CallStatus } from '@/lib/supabase/types'

// Normalisation des numéros de téléphone (format israélien)
function normalizePhone(phone: string): string | null {
  if (!phone) return null
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')
  // Chercher le pattern "5" suivi de 8 chiffres, peu importe le préfixe
  const match = cleaned.match(/(5\d{8})/)
  if (match) return '0' + match[1]
  return null
}

export async function POST(request: NextRequest) {
  try {
    const TELNYX_API_KEY = process.env.TELNYX_API_KEY || 'KEY019C1F348A06708E3B0DDC047C124F63_O5PjwekPrQmV5Vj1jWuOAd'

    // Récupérer les enregistrements des dernières 48h depuis Telnyx
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    const response = await fetch(
      `https://api.telnyx.com/v2/recordings?filter[created_at][gte]=${twoDaysAgo}&page[size]=250`,
      {
        headers: {
          'Authorization': `Bearer ${TELNYX_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Telnyx API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const recordings = data.data || []

    const supabase = createServiceRoleClient()
    let imported = 0
    let skipped = 0
    let errors = 0

    for (const recording of recordings) {
      try {
        // Vérifier si l'appel existe déjà (par call_session_id)
        const { data: existing } = await (supabase as any)
          .from('calls')
          .select('id')
          .eq('telnyx_call_session_id', recording.call_session_id)
          .single()

        if (existing) {
          skipped++
          continue
        }

        // Déterminer la direction (si to = notre numéro, c'est inbound)
        const ourNumber = '+97233821918'
        const direction: CallDirection = recording.to === ourNumber ? 'inbound' : 'outbound'
        const fromNumber = recording.from || ''
        const toNumber = recording.to || ''
        const fromNormalized = normalizePhone(fromNumber)
        const toNormalized = normalizePhone(toNumber)

        // Tous les enregistrements sont considérés comme completed
        const status: CallStatus = 'completed'

        // Auto-détection du contact pour les appels entrants
        let contactId: string | null = null
        let branchId: string | null = null

        if (direction === 'inbound' && fromNormalized) {
          const { data: contacts } = await (supabase as any)
            .from('contacts')
            .select('id')
            .eq('phone', fromNormalized)
            .is('archived_at', null)
            .limit(1)

          if (contacts && contacts.length > 0) {
            contactId = contacts[0].id
          }
        }

        // Si pas de branch_id, prendre la première disponible
        if (!branchId) {
          const { data: firstBranch } = await (supabase as any)
            .from('branches')
            .select('id')
            .limit(1)
            .single()

          if (firstBranch) {
            branchId = firstBranch.id
          }
        }

        // Calculer la durée en secondes
        const durationSeconds = Math.floor((recording.duration_millis || 0) / 1000)

        // Créer l'appel
        const { error } = await (supabase as any)
          .from('calls')
          .insert({
            telnyx_call_control_id: recording.call_control_id || recording.id,
            telnyx_call_session_id: recording.call_session_id,
            direction,
            status,
            from_number: fromNumber,
            to_number: toNumber,
            from_number_normalized: fromNormalized,
            to_number_normalized: toNormalized,
            started_at: recording.recording_started_at,
            answered_at: recording.recording_started_at,
            ended_at: recording.recording_ended_at,
            duration_seconds: durationSeconds,
            recording_url: recording.download_urls?.wav || null,
            contact_id: contactId,
            branch_id: branchId,
            contact_linked_at: contactId ? new Date().toISOString() : null,
          })

        if (error) {
          console.error('Error importing call:', error)
          errors++
        } else {
          imported++
        }

      } catch (err) {
        console.error('Error processing CDR:', err)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors,
      total: recordings.length,
    })

  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
