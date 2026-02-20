/**
 * WhatsApp Media Utility — Download (inbound) & Upload+Send (outbound)
 *
 * Inbound:  WhatsApp webhook → downloadAndStoreMedia() → Supabase Storage
 * Outbound: Admin uploads file → uploadAndSendMedia() → Supabase Storage + WhatsApp API
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'

// ============================================================
// Types
// ============================================================

export interface MediaDownloadInfo {
  mediaId: string
  mimeType: string
  filename?: string
}

export interface StoredMedia {
  publicUrl: string
  storagePath: string
}

// ============================================================
// INBOUND — Download from WhatsApp and store in Supabase
// ============================================================

/**
 * Download media from WhatsApp Cloud API and store in Supabase Storage.
 *
 * 1. GET graph.facebook.com/v21.0/{media-id} → temporary download URL
 * 2. GET that URL (with Bearer token) → binary file
 * 3. Upload to Supabase Storage 'whatsapp-media' bucket
 * 4. Return permanent public URL
 */
export async function downloadAndStoreMedia(media: MediaDownloadInfo): Promise<StoredMedia | null> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!accessToken) {
    console.error('[WA MEDIA] WHATSAPP_ACCESS_TOKEN not configured')
    return null
  }

  try {
    // Step 1: Get temporary download URL from WhatsApp
    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/${media.mediaId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )

    if (!metaRes.ok) {
      console.error('[WA MEDIA] Failed to get media URL:', metaRes.status)
      return null
    }

    const metaData = await metaRes.json()
    const downloadUrl = metaData.url
    if (!downloadUrl) {
      console.error('[WA MEDIA] No download URL in response')
      return null
    }

    // Step 2: Download the actual file (also needs Bearer token)
    const fileRes = await fetch(downloadUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    if (!fileRes.ok) {
      console.error('[WA MEDIA] Failed to download file:', fileRes.status)
      return null
    }

    const fileBuffer = Buffer.from(await fileRes.arrayBuffer())

    // Step 3: Upload to Supabase Storage
    const ext = getExtensionFromMime(media.mimeType)
    const storagePath = `inbound/${Date.now()}_${media.mediaId}${ext}`

    const supabase = createServiceRoleClient()
    const { error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(storagePath, fileBuffer, {
        contentType: media.mimeType.split(';')[0].trim(),
        upsert: false,
      })

    if (uploadError) {
      console.error('[WA MEDIA] Upload error:', uploadError)
      return null
    }

    // Step 4: Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(storagePath)

    console.log('[WA MEDIA] Stored inbound:', storagePath)

    // FIFO cleanup (non-blocking) — 50 Mo limit
    cleanupOldMedia(supabase, 'inbound').catch(() => {})

    return { publicUrl, storagePath }
  } catch (error) {
    console.error('[WA MEDIA] Download error:', error)
    return null
  }
}

// ============================================================
// OUTBOUND — Upload admin file to Storage + send via WhatsApp
// ============================================================

/**
 * Upload a file to Supabase Storage and send it to a WhatsApp contact.
 *
 * 1. Upload file to Supabase Storage
 * 2. Get public URL
 * 3. POST to WhatsApp API with media type (image/audio/video/document)
 * 4. Return stored media info + WhatsApp message ID
 */
export async function uploadAndSendMedia(
  fileBuffer: Buffer,
  mimeType: string,
  filename: string,
  recipientPhone: string,
  caption?: string,
  overridePhoneNumberId?: string
): Promise<{ stored: StoredMedia; waMessageId: string | null } | null> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = overridePhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!accessToken || !phoneNumberId) {
    console.error('[WA MEDIA] WhatsApp not configured')
    return null
  }

  try {
    // Step 1: Upload to Supabase Storage
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const finalPath = `outbound/${Date.now()}_${safeName}`

    const supabase = createServiceRoleClient()
    const { error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(finalPath, fileBuffer, {
        contentType: mimeType.split(';')[0].trim(),
        upsert: false,
      })

    if (uploadError) {
      console.error('[WA MEDIA] Upload error:', uploadError)
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(finalPath)

    console.log('[WA MEDIA] Uploaded to:', finalPath, '| publicUrl:', publicUrl)

    // Step 2: Determine WhatsApp media type from MIME
    const waType = getWhatsAppMediaType(mimeType)
    const cleanMime = mimeType.split(';')[0].trim()

    // Step 3: Upload file directly to WhatsApp Media API (more reliable than link-based)
    const formDataWa = new FormData()
    formDataWa.append('messaging_product', 'whatsapp')
    formDataWa.append('type', cleanMime)
    const fileBlob = new Blob([new Uint8Array(fileBuffer)], { type: cleanMime })
    formDataWa.append('file', fileBlob, filename)

    console.log('[WA MEDIA] Uploading to WhatsApp Media API:', { type: cleanMime, filename, size: fileBuffer.length })

    const uploadRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/media`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formDataWa,
      }
    )

    const uploadResult = await uploadRes.json()

    if (!uploadRes.ok || !uploadResult.id) {
      console.error('[WA MEDIA] WhatsApp media upload error:', uploadRes.status, JSON.stringify(uploadResult))
      // Fallback: try link-based approach
      console.log('[WA MEDIA] Falling back to link-based send...')
      return await sendViaLink(publicUrl, waType, recipientPhone, phoneNumberId, accessToken, filename, caption, finalPath)
    }

    const waMediaId = uploadResult.id
    console.log('[WA MEDIA] WhatsApp media uploaded, id:', waMediaId)

    // Step 4: Send message with uploaded media ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mediaPayload: any = { id: waMediaId }
    if (caption && (waType === 'image' || waType === 'video' || waType === 'document')) {
      mediaPayload.caption = caption
    }
    if (waType === 'document') {
      mediaPayload.filename = filename
    }

    const waBody = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: waType,
      [waType]: mediaPayload,
    }

    console.log('[WA MEDIA] Sending message with media id:', waMediaId)

    const waRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(waBody),
      }
    )

    const waResult = await waRes.json()

    if (!waRes.ok) {
      console.error('[WA MEDIA] WhatsApp send error:', waRes.status, JSON.stringify(waResult))
      return null
    }

    const waMessageId = waResult.messages?.[0]?.id || null
    console.log('[WA MEDIA] Sent outbound:', waType, '→', recipientPhone, '| msgId:', waMessageId)

    // FIFO cleanup (non-blocking) — 50 Mo limit
    cleanupOldMedia(supabase, 'outbound').catch(() => {})

    return {
      stored: { publicUrl, storagePath: finalPath },
      waMessageId,
    }
  } catch (error) {
    console.error('[WA MEDIA] Send error:', error)
    return null
  }
}

// ============================================================
// Fallback: send via link URL (used if direct upload fails)
// ============================================================
async function sendViaLink(
  publicUrl: string,
  waType: string,
  recipientPhone: string,
  phoneNumberId: string,
  accessToken: string,
  filename: string,
  caption?: string,
  storagePath?: string,
): Promise<{ stored: StoredMedia; waMessageId: string | null } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mediaPayload: any = { link: publicUrl }
  if (caption && (waType === 'image' || waType === 'video' || waType === 'document')) {
    mediaPayload.caption = caption
  }
  if (waType === 'document') {
    mediaPayload.filename = filename
  }

  const waBody = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientPhone,
    type: waType,
    [waType]: mediaPayload,
  }

  const waRes = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(waBody),
    }
  )

  const waResult = await waRes.json()
  if (!waRes.ok) {
    console.error('[WA MEDIA] Link fallback also failed:', waRes.status, JSON.stringify(waResult))
    return null
  }

  const waMessageId = waResult.messages?.[0]?.id || null
  console.log('[WA MEDIA] Sent via link fallback:', waType, '→', recipientPhone, '| msgId:', waMessageId)
  return {
    stored: { publicUrl, storagePath: storagePath || '' },
    waMessageId,
  }
}

// ============================================================
// FIFO Cleanup — Keep storage under 50 Mo
// ============================================================

const MAX_FILES_PER_FOLDER = 80 // ~50 Mo budget split across inbound/outbound

/**
 * Delete oldest files in a storage folder to stay under the limit.
 * Called after each upload. Non-blocking — errors are silently ignored.
 * Pattern: same as src/app/api/cron/backup/route.ts cleanup.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cleanupOldMedia(supabase: any, folder: 'inbound' | 'outbound') {
  try {
    const { data: files } = await supabase.storage
      .from('whatsapp-media')
      .list(folder, {
        limit: 500,
        sortBy: { column: 'created_at', order: 'desc' },
      })

    if (files && files.length > MAX_FILES_PER_FOLDER) {
      const filesToDelete = files
        .slice(MAX_FILES_PER_FOLDER)
        .map((f: { name: string }) => `${folder}/${f.name}`)

      const { error } = await supabase.storage
        .from('whatsapp-media')
        .remove(filesToDelete)

      if (!error) {
        console.log(`[WA MEDIA] Cleanup: deleted ${filesToDelete.length} old files from ${folder}/`)
      }
    }
  } catch {
    // Silent — cleanup is best-effort
  }
}

// ============================================================
// Helpers
// ============================================================

function getExtensionFromMime(mimeType: string): string {
  const base = mimeType.split(';')[0].trim().toLowerCase()
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'audio/ogg': '.ogg',
    'audio/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/aac': '.aac',
    'audio/amr': '.amr',
    'audio/mp4': '.m4a',
    'video/mp4': '.mp4',
    'video/3gpp': '.3gp',
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/msword': '.doc',
    'text/plain': '.txt',
  }
  return map[base] || ''
}

export function getWhatsAppMediaType(mimeType: string): 'image' | 'audio' | 'video' | 'document' {
  const base = mimeType.split(';')[0].trim().toLowerCase()
  if (base.startsWith('image/')) return 'image'
  // Only ogg/opus is reliably supported as WhatsApp voice message
  // Other audio formats (mp4, webm, m4a) are sent as document to avoid rejection
  if (base === 'audio/ogg') return 'audio'
  if (base.startsWith('audio/')) return 'document'
  if (base.startsWith('video/')) return 'video'
  return 'document'
}
