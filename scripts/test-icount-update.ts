import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  // Get credentials
  const { data: creds } = await supabase
    .from('payment_credentials')
    .select('*')
    .eq('provider', 'icount')
    .single()
  
  if (!creds) {
    console.log('No credentials')
    return
  }
  
  // Test: Update item 17 (laser_4) with unit_price_includes_vat: true
  console.log('=== TEST: Update item 17 with unit_price_includes_vat: true ===\n')
  
  const updateParams = {
    cid: creds.cid,
    user: creds.username,
    pass: creds.password,
    inventory_item_id: 17,
    unitprice: 180,
    unit_price_includes_vat: true  // <-- On veut que 180 soit TTC
  }
  
  console.log('Sending params:', JSON.stringify(updateParams, null, 2))
  
  const response = await fetch('https://api.icount.co.il/api/v3.php/inventory/update_item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateParams)
  })
  
  const data = await response.json()
  console.log('\nResponse:', JSON.stringify(data, null, 2))
  
  // Now get the item to see if the flag changed
  console.log('\n\n=== Fetching item 17 after update ===\n')
  
  const response2 = await fetch('https://api.icount.co.il/api/v3.php/inventory/get_item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cid: creds.cid,
      user: creds.username,
      pass: creds.password,
      inventory_item_id: 17
    })
  })
  
  const data2 = await response2.json()
  console.log('unitprice:', data2.item_info?.unitprice)
  console.log('unitprice_incvat:', data2.item_info?.unitprice_incvat)
  console.log('unitprice_incvat_entered:', data2.item_info?.unitprice_incvat_entered)
}

main().catch(console.error)
