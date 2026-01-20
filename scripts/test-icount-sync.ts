import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  console.log('=== Test: Vérification des produits iCount ===\n')
  
  // 1. Récupérer les produits locaux
  const { data: products, error } = await supabase
    .from('icount_products')
    .select('*')
    .limit(5)
  
  if (error) {
    console.log('Erreur:', error.message)
    return
  }
  
  console.log('Produits locaux:')
  products?.forEach(p => {
    console.log(`\n- ${p.code}`)
    console.log(`  name: ${p.name}`)
    console.log(`  name_he: ${p.name_he}`)
    console.log(`  unit_price: ${p.unit_price}`)
    console.log(`  icount_item_id: ${p.icount_item_id}`)
    console.log(`  icount_synced_at: ${p.icount_synced_at}`)
  })
  
  // 2. Vérifier les credentials iCount
  console.log('\n\n=== Credentials iCount ===')
  const { data: creds } = await supabase
    .from('payment_credentials')
    .select('*')
    .eq('provider', 'icount')
    .single()
  
  if (creds) {
    console.log('CID:', creds.cid)
    console.log('Username:', creds.username)
    console.log('Has password:', !!creds.password)
  } else {
    console.log('Pas de credentials iCount trouvés!')
  }
}

main().catch(console.error)
