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
  if (cleaned.startsWith('+9725')) return '0' + cleaned.substring(5)
  if (cleaned.startsWith('9725')) return '0' + cleaned.substring(4)
  if (cleaned.startsWith('+972')) return '0' + cleaned.substring(4)
  if (cleaned.startsWith('972')) return '0' + cleaned.substring(3)
  if (cleaned.match(/^05\d{8}$/)) return cleaned
  return null
}

export async function POST(request: NextRequest) {
  try {
    const TELNYX_API_KEY = process.env.TELNYX_API_KEY || 'KEY019C1F348A06708E3B0DDC047C124F63_O5PjwekPrQmV5Vj1jWuOAd'

    // Récupérer les appels des dernières 48h depuis Telnyx CDR
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    const response = await fetch(
      `https://api.telnyx.com/v2/call_detail_records?filter[created_at][gte]=${twoDaysAgo}&page[size]=250`,
      {
        headers: {
          'Authorization': `Bearer ${TELNYX_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Telnyx API error: ${response.status}`)
    }

    const data = await response.json()
    const cdrs = data.data || []

    const supabase = createServiceRoleClient()
    let imported = 0
    let skipped = 0
    let errors = 0

    for (const cdr of cdrs) {
      try {
        // Vérifier si l'appel existe déjà
        const { data: existing } = await (supabase as any)
          .from('calls')
          .select('id')
          .eq('telnyx_call_control_id', cdr.call_control_id)
          .single()

        if (existing) {
          skipped++
          continue
        }

        const direction: CallDirection = cdr.direction === 'incoming' ? 'inbound' : 'outbound'
        const fromNumber = cdr.from || ''
        const toNumber = cdr.to || ''
        const fromNormalized = normalizePhone(fromNumber)
        const toNormalized = normalizePhone(toNumber)

        // Déterminer le statut
        let status: CallStatus = 'completed'
        if (cdr.hangup_cause === 'NO_ANSWER' || cdr.hangup_cause === 'USER_BUSY') {
          status = 'no-answer'
        } else if (cdr.hangup_cause === 'CALL_REJECTED') {
          status = 'missed'
        }

        // Auto-détection du contact pour les appels entrants
        let contactId: string | null = null
        let branchId: string | null = null

        if (direction === 'inbound' && fromNormalized) {
          const { data: contacts } = await (supabase as any)
            .from('contacts')
            .select('id, branch_id')
            .eq('phone', fromNormalized)
            .limit(2)

          if (contacts && contacts.length === 1) {
            contactId = contacts[0].id
            branchId = contacts[0].branch_id
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

        // Calculer la durée
        const durationSeconds = cdr.duration || 0

        // Créer l'appel
        const { error } = await (supabase as any)
          .from('calls')
          .insert({
            telnyx_call_control_id: cdr.call_control_id,
            telnyx_call_session_id: cdr.call_session_id || null,
            direction,
            status,
            from_number: fromNumber,
            to_number: toNumber,
            from_number_normalized: fromNormalized,
            to_number_normalized: toNormalized,
            started_at: cdr.start_time,
            answered_at: cdr.answer_time || null,
            ended_at: cdr.end_time || null,
            duration_seconds: durationSeconds,
            recording_url: cdr.recording_urls?.[0] || null,
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
      total: cdrs.length,
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
