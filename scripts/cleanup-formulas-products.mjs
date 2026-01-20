/**
 * Script to delete all EVENT formulas and their associated products
 * This is a cleanup script to start fresh with the new formula → product logic
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const branchId = '5e3b466e-0327-4ef6-ad5a-02a8ed4b367e';

console.log('=== CLEANUP: Formulas and EVENT Products ===');
console.log('');

// 1. Get all formulas
const { data: formulas, error: formulasError } = await supabase
  .from('icount_event_formulas')
  .select('id, name, product_id')
  .eq('branch_id', branchId);

if (formulasError) {
  console.error('Error fetching formulas:', formulasError);
  process.exit(1);
}

console.log('Formulas to delete:', formulas?.length || 0);
formulas?.forEach(f => console.log('  -', f.name, f.product_id ? `(product: ${f.product_id})` : ''));

// 2. Get all EVENT products (code starts with 'event_')
const { data: eventProducts, error: productsError } = await supabase
  .from('icount_products')
  .select('id, code, name')
  .eq('branch_id', branchId)
  .like('code', 'event_%');

if (productsError) {
  console.error('Error fetching products:', productsError);
  process.exit(1);
}

console.log('');
console.log('EVENT products to delete:', eventProducts?.length || 0);
eventProducts?.forEach(p => console.log('  -', p.code, '-', p.name));

// 3. Delete formulas first (they reference products)
console.log('');
console.log('Deleting formulas...');
const { error: deleteFormulasError } = await supabase
  .from('icount_event_formulas')
  .delete()
  .eq('branch_id', branchId);

if (deleteFormulasError) {
  console.error('Error deleting formulas:', deleteFormulasError);
  process.exit(1);
}
console.log('✓ Formulas deleted');

// 4. Delete EVENT products
console.log('Deleting EVENT products...');
const { error: deleteProductsError } = await supabase
  .from('icount_products')
  .delete()
  .eq('branch_id', branchId)
  .like('code', 'event_%');

if (deleteProductsError) {
  console.error('Error deleting products:', deleteProductsError);
  process.exit(1);
}
console.log('✓ EVENT products deleted');

// 5. Verify
const { data: remainingFormulas } = await supabase
  .from('icount_event_formulas')
  .select('id')
  .eq('branch_id', branchId);

const { data: remainingProducts } = await supabase
  .from('icount_products')
  .select('id, code')
  .eq('branch_id', branchId);

console.log('');
console.log('=== RESULT ===');
console.log('Remaining formulas:', remainingFormulas?.length || 0);
console.log('Remaining products:', remainingProducts?.length || 0);
remainingProducts?.forEach(p => console.log('  -', p.code));
console.log('');
console.log('Now sync with iCount to remove orphan products there too.');
