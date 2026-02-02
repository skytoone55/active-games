/**
 * Script pour mettre à jour les appels existants sans contact_id
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zapwlcrjnabrfhoxfgqo.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixCalls() {
  console.log('=== CORRECTION DES APPELS EXISTANTS ===\n')

  // Récupérer tous les appels inbound sans contact_id
  const { data: calls, error: callsError } = await supabase
    .from('calls')
    .select('*')
    .eq('direction', 'inbound')
    .is('contact_id', null)
    .not('from_number_normalized', 'is', null)

  if (callsError) {
    console.error('Erreur récupération calls:', callsError)
    return
  }

  console.log(`Nombre d'appels à corriger: ${calls?.length}\n`)

  let fixed = 0
  let notFound = 0

  for (const call of calls || []) {
    console.log(`\nRecherche contact pour: "${call.from_number_normalized}"`)

    // Chercher un contact avec ce numéro (non archivé)
    const { data: contacts, error: contactError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .eq('phone', call.from_number_normalized)
      .is('archived_at', null)
      .limit(1)

    console.log(`Résultat query:`, contacts, contactError)

    if (contacts && contacts.length > 0) {
      const contact = contacts[0]

      // Mettre à jour l'appel
      const { error: updateError } = await supabase
        .from('calls')
        .update({
          contact_id: contact.id,
          contact_linked_at: new Date().toISOString()
        })
        .eq('id', call.id)

      if (updateError) {
        console.error(`❌ Erreur update appel ${call.id}:`, updateError)
      } else {
        console.log(`✅ Appel ${call.id} lié à ${contact.first_name} ${contact.last_name}`)
        fixed++
      }
    } else {
      console.log(`⚠️  Aucun contact trouvé pour ${call.from_number_normalized}`)
      notFound++
    }
  }

  console.log(`\n=== RÉSUMÉ ===`)
  console.log(`Appels corrigés: ${fixed}`)
  console.log(`Contacts non trouvés: ${notFound}`)
}

fixCalls().catch(console.error)
