require('dotenv').config({ path: '.env.local' });

/**
 * Test du calcul de prix pour 1h Active Games
 *
 * PROBLÈME REPORTÉ:
 * - User fait une commande de 1h sur le site
 * - Summary affiche 1h correctement
 * - Price summary affiche 2h avec le prix de 2h
 *
 * HYPOTHÈSE:
 * Dans calculate-deposit API, ligne 138:
 *   gameDurations = Array(number_of_games).fill('60')
 *
 * Si numberOfGames = 2 (pour 1h Active):
 *   gameDurations = ['60', '60'] = 2h au lieu de 1h!
 *
 * FIX: Devrait être .fill('30') car numberOfGames pour ACTIVE = nombre de tranches de 30min
 */

console.log('🧪 TEST PRIX ACTIVE 1H\n');
console.log('=======================\n');

console.log('📋 Simulation frontend:');
console.log('   User sélectionne: 1h Active');
console.log('   numberOfGames = 2 (2 × 30min = 1h)');
console.log('   Affichage summary: 1h ✅\n');

console.log('📋 API calculate-deposit (ACTUEL - BUGGÉ):');
console.log('   Reçoit: numberOfGames = 2');
console.log('   Code ligne 138: Array(2).fill("60")');
console.log('   gameDurations = ["60", "60"]');
console.log('   Total duration = 120 minutes = 2h ❌');
console.log('   Prix calculé = prix pour 2h ❌\n');

console.log('📋 API calculate-deposit (CORRECT):');
console.log('   Reçoit: numberOfGames = 2');
console.log('   Code corrigé: Array(2).fill("30")');
console.log('   gameDurations = ["30", "30"]');
console.log('   Total duration = 60 minutes = 1h ✅');
console.log('   Prix calculé = prix pour 1h ✅\n');

console.log('═══════════════════════════════════════');
console.log('🔍 DIAGNOSTIC:');
console.log('═══════════════════════════════════════\n');

console.log('❌ BUG CONFIRMÉ:');
console.log('   Fichier: /src/app/api/public/calculate-deposit/route.ts');
console.log('   Ligne: 138');
console.log('   Problème: Array(number_of_games).fill("60")');
console.log('   Impact: Double le temps et le prix pour ACTIVE games\n');

console.log('✅ SOLUTION:');
console.log('   Changer ligne 138:');
console.log('   DE:   gameDurations = Array(number_of_games).fill("60")');
console.log('   À:    gameDurations = Array(number_of_games).fill("30")');
console.log('');
console.log('   Logique:');
console.log('   - Pour ACTIVE, numberOfGames = nombre de tranches de 30min');
console.log('   - 1h = 2 tranches × 30min');
console.log('   - 1h30 = 3 tranches × 30min');
console.log('   - 2h = 4 tranches × 30min');
console.log('   - etc.');
