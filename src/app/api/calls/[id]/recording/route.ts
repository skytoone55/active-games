/**
 * Génère une URL fraîche pour l'enregistrement audio depuis Telnyx
 * Les URLs Telnyx expirent après 10 minutes, donc on régénère à chaque demande
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: callId } = await params
    const TELNYX_API_KEY = process.env.TELNYX_API_KEY || 'KEY019C1F348A06708E3B0DDC047C124F63_O5PjwekPrQmV5Vj1jWuOAd'

    // Récupérer l'appel depuis la base de données
    const supabase = createServiceRoleClient()
    const { data: call, error } = await (supabase as any)
      .from('calls')
      .select('telnyx_call_session_id, recording_url')
      .eq('id', callId)
      .single()

    if (error || !call) {
      return NextResponse.json(
        { success: false, error: 'Appel non trouvé' },
        { status: 404 }
      )
    }

    // Si on a un telnyx_call_session_id, on peut régénérer l'URL via l'API
    if (call.telnyx_call_session_id) {
      // Récupérer le recording depuis l'API Telnyx
      const response = await fetch(
        `https://api.telnyx.com/v2/recordings?filter[call_session_id]=${call.telnyx_call_session_id}`,
        {
          headers: {
            'Authorization': `Bearer ${TELNYX_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        const recordings = data.data || []

        if (recordings.length > 0 && recordings[0].download_urls?.wav) {
          // Rediriger vers la nouvelle URL fraîche
          return NextResponse.redirect(recordings[0].download_urls.wav)
        }
      }
    }

    // Fallback: utiliser l'URL stockée (même si elle est peut-être expirée)
    if (call.recording_url) {
      return NextResponse.redirect(call.recording_url)
    }

    return NextResponse.json(
      { success: false, error: 'Enregistrement non disponible' },
      { status: 404 }
    )

  } catch (error) {
    console.error('Error fetching recording:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
