/**
 * Re-lier TOUS les appels aux contacts (même ceux déjà liés)
 * Utile quand les contacts ont changé
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zapwlcrjnabrfhoxfgqo.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

async function relinkAllContacts() {
  console.log('=== RE-LIAISON DE TOUS LES CONTACTS ===\n')

  // Récupérer TOUS les appels inbound avec from_number_normalized
  const { data: calls, error: callsError } = await supabase
    .from('calls')
    .select('id, from_number_normalized, contact_id')
    .eq('direction', 'inbound')
    .not('from_number_normalized', 'is', null)
    .order('started_at', { ascending: false })

  if (callsError) {
    console.error('Erreur récupération calls:', callsError)
    return
  }

  console.log(`Appels à vérifier: ${calls?.length}\n`)

  let updated = 0
  let unchanged = 0
  let cleared = 0
  let notFound = 0

  for (const call of calls || []) {
    // Chercher le contact actuel avec ce numéro (non archivé)
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .eq('phone', call.from_number_normalized)
      .is('archived_at', null)
      .limit(1)

    const newContactId = contacts && contacts.length > 0 ? contacts[0].id : null

    // Si le contact_id a changé, mettre à jour
    if (newContactId !== call.contact_id) {
      const { error: updateError } = await supabase
        .from('calls')
        .update({
          contact_id: newContactId,
          contact_linked_at: newContactId ? new Date().toISOString() : null
        })
        .eq('id', call.id)

      if (updateError) {
        console.error(`❌ Erreur pour appel ${call.id}:`, updateError)
      } else {
        if (newContactId) {
          const contact = contacts![0]
          console.log(`✅ Appel ${call.from_number_normalized} → ${contact.first_name} ${contact.last_name}`)
          updated++
        } else {
          console.log(`🔄 Appel ${call.from_number_normalized} → Contact supprimé/archivé`)
          cleared++
        }
      }
    } else {
      if (newContactId) {
        unchanged++
      } else {
        notFound++
      }
    }
  }

  console.log(`\n=== RÉSUMÉ ===`)
  console.log(`Mis à jour: ${updated}`)
  console.log(`Liens supprimés (contact archivé): ${cleared}`)
  console.log(`Inchangés: ${unchanged}`)
  console.log(`Aucun contact trouvé: ${notFound}`)
}

relinkAllContacts().catch(console.error)
