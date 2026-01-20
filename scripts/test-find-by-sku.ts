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
  
  // Search for laser_4 by SKU
  console.log('=== Searching for laser_4 by SKU ===\n')
  
  const response = await fetch('https://api.icount.co.il/api/v3.php/inventory/get_items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cid: creds.cid,
      user: creds.username,
      pass: creds.password,
      sku: 'laser_4',
      limit: 1
    })
  })
  
  const data = await response.json()
  
  console.log('Response type of items:', typeof data.items)
  console.log('Is Array?:', Array.isArray(data.items))
  console.log('Keys:', Object.keys(data.items || {}))
  
  // Get values
  const values = Object.values(data.items || {}) as any[]
  console.log('\nItems found:', values.length)
  
  if (values.length > 0) {
    console.log('First item SKU:', values[0].sku)
    console.log('First item ID:', values[0].inventory_item_id)
  }
  
  console.log('\n\nRaw items response:')
  console.log(JSON.stringify(data.items, null, 2))
}

main().catch(console.error)
