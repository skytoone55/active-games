import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function check() {
  console.log('=== Checking if product_id column exists ===\n')

  // Check if product_id column exists on icount_event_formulas
  const { data, error } = await supabase
    .from('icount_event_formulas')
    .select('id, name, game_type, min_participants, max_participants, price_per_person, product_id')
    .limit(10)

  if (error) {
    console.log('Error:', error.message)
    console.log('Code:', error.code)
    if (error.message.includes('product_id')) {
      console.log('\n=> Column product_id does NOT exist yet.')
      console.log('=> You need to apply the migration:')
      console.log('   supabase/migrations/20260121_add_product_id_to_event_formulas.sql')
    }
  } else {
    console.log('Column product_id EXISTS!\n')
    console.log('Formulas found:', data?.length || 0)
    console.log('')
    data?.forEach(f => {
      const code = `event_${f.game_type.toLowerCase()}_${f.min_participants}_${f.max_participants}`
      console.log(`- ${f.name}`)
      console.log(`  code: ${code}`)
      console.log(`  price: ${f.price_per_person}`)
      console.log(`  product_id: ${f.product_id || 'NOT LINKED'}`)
      console.log('')
    })

    if (data && data.length > 0 && data.every(f => !f.product_id)) {
      console.log('\n=> All formulas need migration!')
      console.log('=> Run: npx tsx scripts/migrate-event-products-tier.ts')
    }
  }
}

check().catch(console.error)
