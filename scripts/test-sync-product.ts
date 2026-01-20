import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

// Import the actual sync function
import { syncProductToICount } from '../src/lib/icount-sync'

async function main() {
  console.log('=== Test syncProductToICount ===\n')
  
  const product = {
    id: 'test-id',
    branch_id: '5e3b466e-0327-4ef6-ad5a-02a8ed4b367e',
    code: 'laser_4',
    name: 'Laser 4 parties',
    name_he: 'לייזר 4 משחקים',
    name_en: 'Laser 4 games',
    unit_price: 180, // Restore original price
    is_active: true
  }
  
  console.log('Syncing product with price:', product.unit_price)
  
  const result = await syncProductToICount(product)
  
  console.log('\nResult:', JSON.stringify(result, null, 2))
}

main().catch(console.error)
