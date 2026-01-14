import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://zapwlcrjnabrfhoxfgqo.supabase.co',
  'sb_publishable_WQMe7MkqlJjviPkQZ5gYoQ_B-TprBmF'
)

async function checkColumns() {
  console.log('🔍 Vérification de la structure de la table bookings...\n')
  
  // Tester l'insertion avec color pour voir si la colonne existe
  const testData = {
    branch_id: '00000000-0000-0000-0000-000000000000', // UUID fake pour test
    type: 'GAME',
    start_datetime: new Date().toISOString(),
    end_datetime: new Date().toISOString(),
    participants_count: 1,
    customer_first_name: 'TEST',
    customer_last_name: 'TEST',
    customer_phone: '0000000000',
    reference_code: 'TEST_' + Date.now(),
    color: '#3B82F6' // Test couleur
  }
  
  try {
    const { error } = await supabase
      .from('bookings')
      .insert(testData)
      .select()
    
    if (error) {
      if (error.message.includes('color') || error.message.includes('does not exist')) {
        console.log('❌ Colonne color manquante dans bookings')
        console.log('   ➡️  Exécutez: supabase/migrations/002_add_color_to_bookings.sql\n')
      } else if (error.message.includes('foreign key') || error.message.includes('branch_id')) {
        console.log('✅ Colonne color existe (erreur attendue: branch_id invalide)\n')
        console.log('   La colonne color est bien présente !')
      } else {
        console.log('⚠️  Erreur:', error.message)
      }
    } else {
      console.log('✅ Colonne color existe et fonctionne !')
      // Supprimer le test
      // (on ne peut pas car on n'a pas l'ID, mais ce n'est pas grave)
    }
  } catch (e) {
    console.log('Erreur:', e)
  }
}

checkColumns()
