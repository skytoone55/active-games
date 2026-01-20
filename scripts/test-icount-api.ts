import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  // 1. Get credentials
  const { data: creds } = await supabase
    .from('payment_credentials')
    .select('*')
    .eq('provider', 'icount')
    .single()
  
  if (!creds) {
    console.log('No credentials')
    return
  }
  
  // 2. Call iCount API directly to get item 17 (laser_4)
  console.log('=== Fetching item 17 from iCount API ===\n')
  
  const response = await fetch('https://api.icount.co.il/api/v3.php/inventory/get_item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cid: creds.cid,
      user: creds.username,
      pass: creds.password,
      inventory_item_id: 17
    })
  })
  
  const data = await response.json()
  console.log('Response:', JSON.stringify(data, null, 2))
  
  // 3. Get all items to see the list
  console.log('\n\n=== Fetching all items from iCount ===\n')
  
  const response2 = await fetch('https://api.icount.co.il/api/v3.php/inventory/get_items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cid: creds.cid,
      user: creds.username,
      pass: creds.password,
      limit: 10
    })
  })
  
  const data2 = await response2.json()
  
  if (data2.items && Array.isArray(data2.items)) {
    console.log(`Found ${data2.items.length} items:`)
    data2.items.forEach((item: any) => {
      console.log(`\n- ID: ${item.inventory_item_id}`)
      console.log(`  SKU: ${item.sku}`)
      console.log(`  Description: ${item.description}`)
      console.log(`  Unit price: ${item.unitprice}`)
      console.log(`  unit_price_includes_vat: ${item.unit_price_includes_vat}`)
    })
  } else {
    console.log('Raw response:', JSON.stringify(data2, null, 2))
  }
}

main().catch(console.error)
