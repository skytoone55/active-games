/**
 * Script pour corriger le flag TTC/HT sur tous les produits iCount
 *
 * Probleme: Les produits ont ete crees avec unitprice_incvat_entered: 0 (HT)
 * Solution: Mettre a jour chaque produit avec unit_price_includes_vat: true
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

interface ICountCredentials {
  cid: string
  username: string
  password: string
}

interface ICountProduct {
  id: string
  code: string
  name: string
  name_he: string
  unit_price: number
  icount_item_id: number
}

async function getCredentials(): Promise<ICountCredentials | null> {
  const { data } = await supabase
    .from('payment_credentials')
    .select('cid, username, password')
    .eq('provider', 'icount')
    .single()

  return data as ICountCredentials | null
}

async function getProducts(): Promise<ICountProduct[]> {
  const { data, error } = await supabase
    .from('icount_products')
    .select('id, code, name, name_he, unit_price, icount_item_id')
    .not('icount_item_id', 'is', null)

  if (error) {
    console.error('Error fetching products:', error)
    return []
  }

  return data as ICountProduct[]
}

async function updateProductVatFlag(
  creds: ICountCredentials,
  product: ICountProduct
): Promise<{ success: boolean; before?: any; after?: any; error?: string }> {

  // 1. Get current state
  const getResponse = await fetch('https://api.icount.co.il/api/v3.php/inventory/get_item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cid: creds.cid,
      user: creds.username,
      pass: creds.password,
      inventory_item_id: product.icount_item_id
    })
  })

  const getData = await getResponse.json()

  if (!getData.status) {
    return { success: false, error: `Get failed: ${getData.reason}` }
  }

  const before = {
    unitprice: getData.item_info?.unitprice,
    unitprice_incvat: getData.item_info?.unitprice_incvat,
    unitprice_incvat_entered: getData.item_info?.unitprice_incvat_entered
  }

  // Skip if already TTC
  if (getData.item_info?.unitprice_incvat_entered === '1') {
    return { success: true, before, after: before }
  }

  // 2. Update with unit_price_includes_vat: true
  const updateResponse = await fetch('https://api.icount.co.il/api/v3.php/inventory/update_item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cid: creds.cid,
      user: creds.username,
      pass: creds.password,
      inventory_item_id: product.icount_item_id,
      unitprice: product.unit_price,
      unit_price_includes_vat: true
    })
  })

  const updateData = await updateResponse.json()

  if (!updateData.status) {
    return { success: false, before, error: `Update failed: ${updateData.reason}` }
  }

  // 3. Verify
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

  const after = {
    unitprice: verifyData.item_info?.unitprice,
    unitprice_incvat: verifyData.item_info?.unitprice_incvat,
    unitprice_incvat_entered: verifyData.item_info?.unitprice_incvat_entered
  }

  return { success: true, before, after }
}

async function main() {
  console.log('=== Fix iCount VAT Flag ===\n')

  const creds = await getCredentials()
  if (!creds) {
    console.error('No iCount credentials found!')
    return
  }

  const products = await getProducts()
  console.log(`Found ${products.length} products with icount_item_id\n`)

  let fixed = 0
  let skipped = 0
  let errors = 0

  for (const product of products) {
    console.log(`\n--- ${product.code} (iCount ID: ${product.icount_item_id}) ---`)
    console.log(`  Local price: ${product.unit_price} NIS`)

    const result = await updateProductVatFlag(creds, product)

    if (!result.success) {
      console.log(`  ERROR: ${result.error}`)
      errors++
      continue
    }

    if (result.before?.unitprice_incvat_entered === '1') {
      console.log(`  SKIPPED: Already TTC (unitprice_incvat_entered: 1)`)
      skipped++
      continue
    }

    console.log(`  BEFORE: unitprice=${result.before?.unitprice}, incvat=${result.before?.unitprice_incvat}, flag=${result.before?.unitprice_incvat_entered}`)
    console.log(`  AFTER:  unitprice=${result.after?.unitprice}, incvat=${result.after?.unitprice_incvat}, flag=${result.after?.unitprice_incvat_entered}`)
    console.log(`  FIXED!`)
    fixed++

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  console.log('\n\n=== Summary ===')
  console.log(`Fixed: ${fixed}`)
  console.log(`Skipped (already OK): ${skipped}`)
  console.log(`Errors: ${errors}`)
}

main().catch(console.error)
