import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const branchId = '5e3b466e-0327-4ef6-ad5a-02a8ed4b367e';

// Get iCount credentials
const { data: creds, error } = await supabase
  .from('payment_credentials')
  .select('cid, username, password')
  .eq('branch_id', branchId)
  .eq('provider', 'icount')
  .eq('is_active', true)
  .single();

if (error || !creds) {
  console.log('Error:', error);
  process.exit(1);
}

console.log('iCount CID:', creds.cid);

// Call iCount API to list all items
const response = await fetch('https://api.icount.co.il/api/v3.php/inventory/get_items', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cid: creds.cid,
    user: creds.username,
    pass: creds.password,
    limit: 0
  })
});

const data = await response.json();

if (!data.status) {
  console.log('iCount error:', data.reason || data.error_description);
  process.exit(1);
}

// Convert items object to array
const items = data.items || {};
const itemsArray = Object.values(items);

console.log('');
console.log('=== PRODUITS SUR ICOUNT (' + itemsArray.length + ') ===');
console.log('');

// Get Supabase products for comparison
const { data: supabaseProducts } = await supabase
  .from('icount_products')
  .select('code')
  .eq('branch_id', branchId)
  .eq('is_active', true);

const supabaseCodes = new Set(supabaseProducts?.map(p => p.code) || []);

itemsArray.sort((a, b) => a.sku.localeCompare(b.sku)).forEach(item => {
  const inSupabase = supabaseCodes.has(item.sku);
  const status = inSupabase ? '✓' : '✗ A SUPPRIMER';
  console.log(
    item.inventory_item_id.toString().padStart(3),
    item.sku.padEnd(25),
    (item.unitprice + '₪').padStart(6),
    status
  );
});

console.log('');
console.log('Total iCount:', itemsArray.length);
console.log('Total Supabase:', supabaseCodes.size);
console.log('A supprimer:', itemsArray.filter(i => !supabaseCodes.has(i.sku)).length);
