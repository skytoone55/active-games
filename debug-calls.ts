/**
 * Script de debug pour vérifier la détection des contacts dans les appels
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zapwlcrjnabrfhoxfgqo.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugCalls() {
  console.log('=== DEBUG CALLS ===\n')

  // 1. Récupérer quelques appels
  const { data: calls, error: callsError } = await supabase
    .from('calls')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(3)

  if (callsError) {
    console.error('Erreur récupération calls:', callsError)
    return
  }

  console.log(`Nombre d'appels récupérés: ${calls?.length}\n`)

  // 2. Récupérer tous les contacts pour comparaison
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, phone')
    .limit(10)

  if (contactsError) {
    console.error('Erreur récupération contacts:', contactsError)
    return
  }

  console.log(`Nombre de contacts: ${contacts?.length}`)
  console.log('Contacts dans la base:')
  contacts?.forEach(c => {
    console.log(`  - ${c.first_name} ${c.last_name}: ${c.phone}`)
  })
  console.log('\n')

  // 3. Analyser chaque appel
  calls?.forEach((call, index) => {
    console.log(`--- APPEL ${index + 1} ---`)
    console.log(`ID: ${call.id}`)
    console.log(`Direction: ${call.direction}`)
    console.log(`From: ${call.from_number}`)
    console.log(`From normalized: ${call.from_number_normalized}`)
    console.log(`To: ${call.to_number}`)
    console.log(`Contact ID: ${call.contact_id || 'NULL'}`)

    // Essayer de matcher manuellement
    if (call.direction === 'inbound' && call.from_number_normalized) {
      const matchedContact = contacts?.find(c => c.phone === call.from_number_normalized)
      if (matchedContact) {
        console.log(`✅ MATCH TROUVÉ: ${matchedContact.first_name} ${matchedContact.last_name}`)
      } else {
        console.log(`❌ AUCUN MATCH pour: ${call.from_number_normalized}`)
        console.log(`   Comparaison avec contacts:`)
        contacts?.forEach(c => {
          console.log(`   - "${c.phone}" === "${call.from_number_normalized}" ? ${c.phone === call.from_number_normalized}`)
        })
      }
    }
    console.log('\n')
  })
}

debugCalls().catch(console.error)
