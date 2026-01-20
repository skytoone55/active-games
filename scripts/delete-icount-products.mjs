import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const branchId = '5e3b466e-0327-4ef6-ad5a-02a8ed4b367e';

// IDs des produits à supprimer sur iCount (identifiés par list-icount-products.mjs)
const ITEMS_TO_DELETE = [
  { id: 57, sku: 'event_active_100' },
  { id: 67, sku: 'event_both_120' },
  { id: 62, sku: 'event_both_130' },
  { id: 52, sku: 'event_laser_100' },
  { id: 47, sku: 'event_laser_120' },
  { id: 77, sku: 'room_event_500' },
];

// Get iCount credentials
const { data: creds, error } = await supabase
  .from('payment_credentials')
  .select('cid, username, password')
  .eq('branch_id', branchId)
  .eq('provider', 'icount')
  .eq('is_active', true)
  .single();

if (error || !creds) {
  console.log('Error getting credentials:', error);
  process.exit(1);
}

console.log('=== SUPPRESSION DES PRODUITS ICOUNT ===');
console.log('');
console.log('Produits à supprimer:');
ITEMS_TO_DELETE.forEach(item => {
  console.log(' -', item.id, item.sku);
});
console.log('');

// Call iCount delete_items API
const response = await fetch('https://api.icount.co.il/api/v3.php/inventory/delete_items', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cid: creds.cid,
    user: creds.username,
    pass: creds.password,
    inventory_item_ids: ITEMS_TO_DELETE.map(i => i.id)
  })
});

const data = await response.json();

console.log('Réponse iCount:', JSON.stringify(data, null, 2));

if (data.status) {
  console.log('');
  console.log('✓ Suppression réussie!');
  console.log('');
  console.log('Vérification...');

  // Verify by listing items again
  const verifyResponse = await fetch('https://api.icount.co.il/api/v3.php/inventory/get_items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cid: creds.cid,
      user: creds.username,
      pass: creds.password,
      limit: 0
    })
  });

  const verifyData = await verifyResponse.json();
  const items = Object.values(verifyData.items || {});

  console.log('');
  console.log('Produits restants sur iCount:', items.length);
} else {
  console.log('');
  console.log('✗ Erreur:', data.reason || data.error_description);
}
