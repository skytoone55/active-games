import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const branchId = '5e3b466e-0327-4ef6-ad5a-02a8ed4b367e';

// Get all products
const { data: products } = await supabase
  .from('icount_products')
  .select('id, code, name, name_he, unit_price, is_active')
  .eq('branch_id', branchId)
  .order('code');

// Get all formulas with their linked products
const { data: formulas } = await supabase
  .from('icount_event_formulas')
  .select('id, name, game_type, min_participants, max_participants, price_per_person, room_id, product_id, is_active')
  .eq('branch_id', branchId)
  .order('game_type')
  .order('min_participants');

// Get rooms
const { data: rooms } = await supabase
  .from('icount_rooms')
  .select('id, name, price')
  .eq('branch_id', branchId);

console.log('=== ANALYSE DES PRODUITS ===');
console.log('');

// Products needed for GAME
const gameProducts = ['laser_1', 'laser_2', 'laser_3', 'laser_4', 'active_30', 'active_60', 'active_90', 'active_120'];
console.log('-- GAME: Produits necessaires --');
gameProducts.forEach(code => {
  const p = products?.find(pr => pr.code === code);
  if (p) {
    console.log('OK', code.padEnd(15), p.unit_price + '₪', p.is_active ? '' : '(INACTIF!)');
  } else {
    console.log('MANQUANT', code);
  }
});

console.log('');
console.log('-- EVENT: Formules et leurs produits --');
formulas?.forEach(f => {
  const linkedProduct = products?.find(p => p.id === f.product_id);
  const room = rooms?.find(r => r.id === f.room_id);

  // Expected product code based on tier
  const expectedCode = 'event_' + f.game_type.toLowerCase() + '_' + f.min_participants + '_' + f.max_participants;
  const expectedProduct = products?.find(p => p.code === expectedCode);

  console.log('');
  console.log('Formula:', f.name, '(' + f.game_type + ', ' + f.min_participants + '-' + f.max_participants + ' pers)');
  console.log('  Prix formule:', f.price_per_person + '₪/pers');
  console.log('  Salle:', room ? room.name + ' (' + room.price + '₪)' : 'Aucune');
  console.log('  Produit lie (product_id):', linkedProduct ? linkedProduct.code + ' @ ' + linkedProduct.unit_price + '₪' : 'AUCUN!');
  console.log('  Produit attendu:', expectedCode, expectedProduct ? '@ ' + expectedProduct.unit_price + '₪' : '(non trouve)');

  if (linkedProduct && linkedProduct.unit_price !== f.price_per_person) {
    console.log('  ⚠️ MISMATCH: produit=' + linkedProduct.unit_price + '₪ vs formule=' + f.price_per_person + '₪');
  }
});

console.log('');
console.log('-- Produits EVENT potentiellement inutiles (anciens codes avec prix) --');
const oldStyleEventProducts = products?.filter(p => {
  if (!p.code.includes('event')) return false;
  // Old style: event_active_100, event_laser_120, etc. (price in code)
  const match = p.code.match(/event_(active|laser|both)_(\d+)$/);
  return match !== null;
});
oldStyleEventProducts?.forEach(p => {
  console.log('  ', p.code, '-', p.unit_price + '₪', p.is_active ? '' : '(deja inactif)');
});

console.log('');
console.log('-- Produits salles (room_event_*) --');
const roomProducts = products?.filter(p => p.code.startsWith('room_event_'));
roomProducts?.forEach(p => {
  const matchingRoom = rooms?.find(r => r.price === p.unit_price);
  console.log('  ', p.code, '-', p.unit_price + '₪', matchingRoom ? '-> lie a: ' + matchingRoom.name : 'PAS DE SALLE CORRESPONDANTE');
});
