/**
 * Webhook Telnyx pour synchroniser les appels
 * Reçoit les événements Call Control API de Telnyx et crée/met à jour les appels dans Supabase
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

// Types Telnyx webhook events
interface TelnyxWebhookEvent {
  data: {
    event_type: string
    id: string
    occurred_at: string
    payload: {
      call_control_id: string
      call_session_id?: string
      call_leg_id?: string
      direction?: 'incoming' | 'outgoing'
      state?: string
      from?: string
      to?: string
      start_time?: string
      answer_time?: string
      end_time?: string
      hangup_cause?: string
      recording_urls?: string[]
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TelnyxWebhookEvent = await request.json()
    const { event_type, payload, occurred_at } = body.data

    console.log('📞 Telnyx webhook received:', event_type, payload.call_control_id)

    const supabase = createServiceRoleClient()

    // Événement de début d'appel
    if (event_type === 'call.initiated' || event_type === 'call.ringing') {
      const direction: CallDirection = payload.direction === 'incoming' ? 'inbound' : 'outbound'
      const fromNumber = payload.from || ''
      const toNumber = payload.to || ''
      const fromNormalized = normalizePhone(fromNumber)
      const toNormalized = normalizePhone(toNumber)

      // Vérifier si l'appel existe déjà
      const { data: existingCall } = await (supabase as any)
        .from('calls')
        .select('id')
        .eq('telnyx_call_control_id', payload.call_control_id)
        .single()

      if (existingCall) {
        console.log('✅ Call already exists:', payload.call_control_id)
        return NextResponse.json({ success: true, message: 'Call already exists' })
      }

      // Auto-détection du contact pour les appels entrants
      let contactId: string | null = null
      let branchId: string | null = null

      if (direction === 'inbound' && fromNormalized) {
        // Chercher le contact par numéro de téléphone
        const { data: contacts } = await (supabase as any)
          .from('contacts')
          .select('id, branch_id')
          .eq('phone', fromNormalized)
          .limit(2)

        // Auto-lier seulement si exactement 1 contact trouvé
        if (contacts && contacts.length === 1) {
          contactId = contacts[0].id
          branchId = contacts[0].branch_id
          console.log('🔗 Auto-linked to contact:', contactId)
        }
      }

      // Si pas de branch_id trouvé via contact, prendre la première branche disponible
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

      // Créer l'appel
      const { data: newCall, error } = await (supabase as any)
        .from('calls')
        .insert({
          telnyx_call_control_id: payload.call_control_id,
          telnyx_call_session_id: payload.call_session_id || null,
          direction,
          status: 'completed' as CallStatus,
          from_number: fromNumber,
          to_number: toNumber,
          from_number_normalized: fromNormalized,
          to_number_normalized: toNormalized,
          started_at: payload.start_time || occurred_at,
          contact_id: contactId,
          branch_id: branchId,
          contact_linked_at: contactId ? new Date().toISOString() : null,
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Error creating call:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      console.log('✅ Call created:', newCall.id)

      // Log l'activité
      if (branchId) {
        await (supabase as any).from('activity_logs').insert({
          user_id: null,
          action_type: 'call_created',
          target_type: 'call',
          target_id: newCall.id,
          branch_id: branchId,
          details: {
            direction,
            from: fromNumber,
            to: toNumber,
            auto_created: true,
          },
        })
      }

      return NextResponse.json({ success: true, call_id: newCall.id })
    }

    // Événement de réponse
    if (event_type === 'call.answered') {
      const { data: call } = await (supabase as any)
        .from('calls')
        .update({
          answered_at: payload.answer_time || occurred_at,
          status: 'completed',
        })
        .eq('telnyx_call_control_id', payload.call_control_id)
        .select()
        .single()

      console.log('✅ Call answered:', payload.call_control_id)
      return NextResponse.json({ success: true })
    }

    // Événement de fin d'appel
    if (event_type === 'call.hangup') {
      // Déterminer le statut final
      let finalStatus: CallStatus = 'completed'
      if (payload.hangup_cause === 'NO_ANSWER' || payload.hangup_cause === 'USER_BUSY') {
        finalStatus = 'no-answer'
      } else if (payload.hangup_cause === 'CALL_REJECTED') {
        finalStatus = 'missed'
      } else if (payload.hangup_cause === 'NORMAL_CLEARING') {
        finalStatus = 'completed'
      }

      // Calculer la durée
      let durationSeconds = 0
      if (payload.start_time && payload.end_time) {
        const start = new Date(payload.start_time).getTime()
        const end = new Date(payload.end_time).getTime()
        durationSeconds = Math.floor((end - start) / 1000)
      }

      const { data: call } = await (supabase as any)
        .from('calls')
        .update({
          ended_at: payload.end_time || occurred_at,
          status: finalStatus,
          duration_seconds: durationSeconds,
        })
        .eq('telnyx_call_control_id', payload.call_control_id)
        .select()
        .single()

      console.log('✅ Call ended:', payload.call_control_id, 'Status:', finalStatus)
      return NextResponse.json({ success: true })
    }

    // Événement d'enregistrement disponible
    if (event_type === 'call.recording.saved') {
      const recordingUrl = payload.recording_urls?.[0] || null

      const { data: call } = await (supabase as any)
        .from('calls')
        .update({
          recording_url: recordingUrl,
        })
        .eq('telnyx_call_control_id', payload.call_control_id)
        .select()
        .single()

      console.log('✅ Recording saved:', payload.call_control_id)
      return NextResponse.json({ success: true })
    }

    // Autres événements ignorés
    console.log('ℹ️ Ignoring event type:', event_type)
    return NextResponse.json({ success: true, message: 'Event ignored' })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET pour vérifier que l'endpoint est actif
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/webhooks/telnyx',
    message: 'Telnyx webhook endpoint is ready to receive events'
  })
}
