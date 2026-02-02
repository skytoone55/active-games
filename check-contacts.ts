/**
 * Vérifier les contacts avec ce numéro
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zapwlcrjnabrfhoxfgqo.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkContacts() {
  console.log('=== VÉRIFICATION CONTACTS ===\n')

  // Chercher tous les contacts avec 0586266770 (archivés ou non)
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, archived_at, branch_id_main')
    .eq('phone', '0586266770')

  if (error) {
    console.error('Erreur:', error)
    return
  }

  console.log(`Contacts trouvés avec 0586266770: ${contacts?.length}`)
  contacts?.forEach(c => {
    console.log(`  ID: ${c.id}`)
    console.log(`  Nom: ${c.first_name} ${c.last_name}`)
    console.log(`  Téléphone: ${c.phone}`)
    console.log(`  Archivé: ${c.archived_at ? 'OUI' : 'NON'}`)
    console.log(`  Branch ID Main: ${c.branch_id_main || 'NULL'}`)
    console.log()
  })

  // Chercher aussi sans filtre archived pour être sûr
  const { data: allContacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, archived_at, branch_id_main')
    .ilike('phone', '%586266770%')

  console.log(`\nTous les contacts avec 586266770 dans le numéro: ${allContacts?.length}`)
  allContacts?.forEach(c => {
    console.log(`  ${c.phone} - ${c.first_name} ${c.last_name} (archived: ${c.archived_at ? 'OUI' : 'NON'}, branch: ${c.branch_id_main || 'NULL'})`)
  })
}

checkContacts().catch(console.error)
