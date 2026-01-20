/**
 * Test manual sync of a product to iCount
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  // 1. Get a product with icount_item_id
  const { data: product } = await supabase
    .from('icount_products')
    .select('*')
    .eq('icount_item_id', 17)
    .single()
  
  if (!product) {
    console.log('Product not found')
    return
  }
  
  console.log('Product from DB:')
  console.log('  code:', product.code)
  console.log('  unit_price:', product.unit_price)
  console.log('  icount_item_id:', product.icount_item_id)
  
  // 2. Get credentials
  const { data: creds } = await supabase
    .from('payment_credentials')
    .select('*')
    .eq('provider', 'icount')
    .single()
  
  if (!creds) {
    console.log('No credentials')
    return
  }
  
  // 3. Check what's on iCount
  console.log('\n\nChecking iCount...')
  const response = await fetch('https://api.icount.co.il/api/v3.php/inventory/get_item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cid: creds.cid,
      user: creds.username,
      pass: creds.password,
      inventory_item_id: product.icount_item_id
    })
  })
  
  const data = await response.json()
  console.log('iCount current state:')
  console.log('  unitprice:', data.item_info?.unitprice)
  console.log('  unitprice_incvat:', data.item_info?.unitprice_incvat)
  console.log('  unitprice_incvat_entered:', data.item_info?.unitprice_incvat_entered)
  
  // 4. Simulate changing the price to 200 and syncing
  console.log('\n\n=== Simulating price change to 200 ===')
  
  const updateResponse = await fetch('https://api.icount.co.il/api/v3.php/inventory/update_item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cid: creds.cid,
      user: creds.username,
      pass: creds.password,
      inventory_item_id: product.icount_item_id,
      unitprice: 200,
      unit_price_includes_vat: true
    })
  })
  
  const updateData = await updateResponse.json()
  console.log('Update response:', updateData.status, updateData.reason)
  
  // 5. Verify
  console.log('\n\nVerifying after update...')
  const verifyResponse = await fetch('https://api.icount.co.il/api/v3.php/inventory/get_item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cid: creds.cid,
      user: creds.username,
      pass: creds.password,
      inventory_item_id: product.icount_item_id
    })
  })
  
  const verifyData = await verifyResponse.json()
  console.log('iCount after update:')
  console.log('  unitprice:', verifyData.item_info?.unitprice)
  console.log('  unitprice_incvat:', verifyData.item_info?.unitprice_incvat)
  console.log('  unitprice_incvat_entered:', verifyData.item_info?.unitprice_incvat_entered)
  
  // 6. Restore original price
  console.log('\n\n=== Restoring original price (180) ===')
  
  await fetch('https://api.icount.co.il/api/v3.php/inventory/update_item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cid: creds.cid,
      user: creds.username,
      pass: creds.password,
      inventory_item_id: product.icount_item_id,
      unitprice: 180,
      unit_price_includes_vat: true
    })
  })
  
  console.log('Restored!')
}

main().catch(console.error)
