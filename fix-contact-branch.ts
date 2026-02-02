/**
 * Mettre à jour les contacts sans branch_id_main
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zapwlcrjnabrfhoxfgqo.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixContactBranches() {
  console.log('=== CORRECTION BRANCH_ID_MAIN MANQUANTS ===\n')

  // Récupérer la branche Rishon LeZion
  const { data: rishonBranch, error: branchError } = await supabase
    .from('branches')
    .select('id, name')
    .or('slug.eq.rishon-lezion,name.ilike.%Rishon%')
    .limit(1)
    .single()

  if (branchError || !rishonBranch) {
    console.error('Impossible de trouver la branche Rishon LeZion')
    return
  }

  console.log(`Branche trouvée: ${rishonBranch.name} (${rishonBranch.id})\n`)

  // Récupérer tous les contacts sans branch_id_main
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, phone')
    .is('branch_id_main', null)

  if (contactsError) {
    console.error('Erreur récupération contacts:', contactsError)
    return
  }

  console.log(`Contacts sans branch_id_main: ${contacts?.length}\n`)

  if (!contacts || contacts.length === 0) {
    console.log('Aucun contact à corriger !')
    return
  }

  let fixed = 0
  for (const contact of contacts) {
    const { error: updateError } = await supabase
      .from('contacts')
      .update({ branch_id_main: rishonBranch.id })
      .eq('id', contact.id)

    if (updateError) {
      console.error(`❌ Erreur pour ${contact.first_name} ${contact.last_name}:`, updateError)
    } else {
      console.log(`✅ ${contact.first_name} ${contact.last_name} (${contact.phone}) -> ${rishonBranch.name}`)
      fixed++
    }
  }

  console.log(`\n=== RÉSUMÉ ===`)
  console.log(`Contacts corrigés: ${fixed}`)
}

fixContactBranches().catch(console.error)
