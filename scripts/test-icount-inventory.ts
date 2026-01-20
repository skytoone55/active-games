/**
 * Test script pour l'API iCount Inventory
 * Usage: npx tsx scripts/test-icount-inventory.ts
 *
 * Ce script:
 * 1. Récupère les credentials iCount depuis payment_credentials
 * 2. Teste l'endpoint inventory/get_items
 * 3. Teste la création d'un item test
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { ICountClient, ICountItemsModule } from '../src/lib/payment-provider'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function getCredentials() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await supabase
    .from('payment_credentials')
    .select('cid, username, password, branch_id')
    .eq('provider', 'icount')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (error || !data) {
    throw new Error('No iCount credentials found in payment_credentials table')
  }

  return {
    cid: data.cid,
    user: data.username,
    pass: data.password,
  }
}

async function main() {
  console.log('=== Test iCount Inventory API ===\n')

  // Get credentials
  console.log('1. Fetching credentials from database...')
  const credentials = await getCredentials()
  console.log('   CID:', credentials.cid)
  console.log('   User:', credentials.user)
  console.log('')

  // Create client
  const client = new ICountClient(credentials)
  const itemsModule = new ICountItemsModule(client)

  // Test 1: List existing items (direct API call for debug)
  console.log('2. Testing inventory/get_items (direct call for debug)...')
  const rawResult = await client.request('inventory', 'get_items', { limit: 5 })
  console.log('   Raw response:', JSON.stringify(rawResult, null, 2))

  // Test via module
  console.log('2b. Testing via listItems module...')
  const listResult = await itemsModule.listItems()

  if (listResult.success) {
    console.log('   ✓ API works!')
    console.log('   Items found:', listResult.data?.length || 0)
    if (listResult.data && listResult.data.length > 0) {
      console.log('   First 3 items:')
      listResult.data.slice(0, 3).forEach((item) => {
        console.log(`   - ${item.code}: ${item.name} (₪${item.unitPrice}) [ID: ${item.providerId}]`)
      })
    }
  } else {
    console.log('   ✗ Failed:', listResult.error)
  }
  console.log('')

  // Test 2: Create a test item
  console.log('3. Testing inventory/add_item (creating test item)...')
  const testItem = {
    id: 'test-' + Date.now(),
    code: 'TEST_ITEM_' + Date.now(),
    name: 'Test Item (can be deleted)',
    nameHe: 'פריט בדיקה',
    nameEn: 'Test Item',
    unitPrice: 99.99,
  }

  const createResult = await itemsModule.syncItem(testItem)

  if (createResult.success) {
    console.log('   ✓ Item created!')
    console.log('   inventory_item_id:', createResult.data?.providerId)
    console.log('   SKU:', createResult.data?.itemCode)
    console.log('   Action:', createResult.data?.action)
    console.log('')
    console.log('   Note: You can delete this test item from iCount dashboard')
  } else {
    console.log('   ✗ Failed:', createResult.error)
  }

  console.log('\n=== Test Complete ===')
}

main().catch(console.error)
