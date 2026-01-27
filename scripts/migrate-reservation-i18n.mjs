#!/usr/bin/env node

/**
 * Script complet de migration i18n pour reservation/page.tsx
 * Remplace TOUS les textes hardcodés français par des appels à t()
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemins
const RESERVATION_FILE = path.join(__dirname, '../src/app/reservation/page.tsx');
const EN_FILE = path.join(__dirname, '../src/i18n/locales/en.json');
const FR_FILE = path.join(__dirname, '../src/i18n/locales/fr.json');
const HE_FILE = path.join(__dirname, '../src/i18n/locales/he.json');

// Liste complète des textes à traduire
// Format: clé => [en, fr, he]
const NEW_TRANSLATIONS = {
  // Step 3 - Game Type
  'booking.step3_game.title': ['Game Type', 'Type de jeu', 'סוג משחק'],
  'booking.step3_game.subtitle': ['Choose your activity', 'Choisissez votre activité', 'בחר את הפעילות שלך'],

  // Game areas
  'booking.game_area.active.description': ['Interactive games and challenges', 'Jeux interactifs et challenges', 'משחקים אינטראקטיביים ואתגרים'],
  'booking.game_area.laser.description': ['Laser maze', 'Labyrinthe laser', 'מבוך לייזר'],
  'booking.game_area.mix.title': ['Custom', 'Sur mesure', 'מותאם אישית'],
  'booking.game_area.mix.description': ['Active + Laser combination', 'Combinaison Active + Laser', 'שילוב Active + Laser'],

  // Duration
  'booking.game_duration.title': ['Game Duration', 'Durée de jeu', 'משך משחק'],
  'booking.game_duration.unlimited': ['Unlimited games during the chosen duration', 'Jeux illimités pendant la durée choisie', 'משחקים ללא הגבלה במשך הזמן שנבחר'],

  // Parties
  'booking.game_parties.title': ['Number of games', 'Nombre de parties', 'מספר משחקים'],
  'booking.game_parties.laser_singular': ['laser game', 'partie de laser', 'משחק לייזר'],
  'booking.game_parties.laser_plural': ['laser games', 'parties de laser', 'משחקי לייזר'],

  // Custom formula
  'booking.custom_formula.title': ['Custom Package', 'Formule Sur Mesure', 'חבילה מותאמת אישית'],
  'booking.custom_formula.description': ['Active Games + Laser City combination', 'Combinaison Active Games + Laser City', 'שילוב Active Games + Laser City'],
  'booking.custom_formula.note': ['We will contact you to customize your experience', 'Nous vous contacterons pour personnaliser votre expérience', 'ניצור איתך קשר להתאמה אישית'],

  // Continue button
  'booking.continue': ['Continue', 'Continuer', 'המשך'],

  // Event game selection
  'booking.step3_event.title': ['Type of games', 'Type de jeux', 'סוג משחקים'],
  'booking.step3_event.subtitle': ['Which activity for your event?', 'Quelle activité pour votre événement ?', 'איזו פעילות לאירוע שלך?'],
  'booking.event_game.active_1h': ['1 hour of games', '1 heure de jeux', 'שעה של משחקים'],
  'booking.event_game.laser_2games': ['2 laser games', '2 parties de laser', '2 משחקי לייזר'],
  'booking.event_game.mix': ['30min Active + 1 Laser', '30min Active + 1 Laser', '30 דקות Active + 1 Laser'],

  // Summary
  'booking.summary.name': ['Name', 'Nom', 'שם'],
  'booking.summary.phone': ['Phone', 'Téléphone', 'טלפון'],
  'booking.summary.email': ['Email', 'Email', 'אימייל'],

  // Payment
  'booking.payment.breakdown': ['Breakdown', 'Détails', 'פירוט'],
  'booking.payment.total': ['Total', 'Total', 'סה"כ'],
  'booking.payment.deposit': ['Deposit to pay now', 'Acompte à payer maintenant', 'מקדמה לתשלום כעת'],
  'booking.payment.card_title': ['Secure Payment', 'Paiement sécurisé', 'תשלום מאובטח'],
  'booking.payment.card_number': ['Card Number', 'Numéro de carte', 'מספר כרטיס'],
  'booking.payment.expiry': ['Expiry', 'Validité', 'תוקף'],
  'booking.payment.holder_id': ['ID Number (Teudat Zehut)', 'Carte d\'identité du titulaire', 'ת.ז.'],
  'booking.payment.secure_notice': ['Your payment information is encrypted and secure', 'Vos informations de paiement sont cryptées et sécurisées', 'פרטי התשלום שלך מוצפנים ומאובטחים'],
  'booking.payment.loading': ['Calculating...', 'Calcul en cours...', 'מחשב...'],

  // Confirmation
  'booking.confirmation.title': ['Reservation Confirmed!', 'Réservation confirmée !', 'ההזמנה אושרה!'],
  'booking.confirmation.subtitle': ['Thank you for your reservation', 'Merci pour votre réservation', 'תודה על ההזמנה'],
  'booking.confirmation.reservation_number': ['Reservation Number', 'Numéro de réservation', 'מספר הזמנה'],
  'booking.confirmation.request_received': ['Request Received!', 'Demande reçue !', 'הבקשה התקבלה!'],
  'booking.confirmation.contact_soon': ['We will contact you shortly to confirm your reservation', 'Nous vous contacterons prochainement pour confirmer votre réservation', 'ניצור איתך קשר בקרוב לאישור ההזמנה'],
  'booking.confirmation.request_number': ['Request Number', 'Numéro de demande', 'מספר בקשה'],
  'booking.confirmation.contact_info': ['We have sent you a confirmation email. We will contact you shortly.', 'Nous vous avons envoyé un email de confirmation. Nous vous contacterons prochainement.', 'שלחנו לך אימייל אישור. ניצור איתך קשר בקרוב.'],
  'booking.confirmation.back_home': ['Back to Home', 'Retour à l\'accueil', 'חזרה לדף הבית'],
  'booking.confirmation.new_booking': ['New Booking', 'Nouvelle réservation', 'הזמנה חדשה'],

  // Errors
  'booking.errors.no_branches': ['No branches available. Please contact support.', 'Aucune branche disponible. Veuillez contacter le support.', 'אין סניפים זמינים. אנא צור קשר עם התמיכה.'],
  'booking.errors.select_branch': ['Please select a branch.', 'Veuillez sélectionner une branche.', 'אנא בחר סניף.'],
  'booking.errors.branch_not_found': ['Branch "{{branch}}" not found. Please try again.', 'Branche "{{branch}}" non trouvée. Veuillez réessayer.', 'סניף "{{branch}}" לא נמצא. אנא נסה שוב.'],
  'booking.errors.save_error': ['Error: {{error}}', 'Erreur : {{error}}', 'שגיאה: {{error}}'],
  'booking.errors.confirmation_error': ['Error during confirmation. Please try again.', 'Erreur lors de la confirmation. Veuillez réessayer.', 'שגיאה באישור. אנא נסה שוב.'],
  'booking.errors.save_reservation': ['Error saving the reservation', 'Erreur lors de la sauvegarde de la réservation', 'שגיאה בשמירת ההזמנה'],

  // Payment errors
  'booking.payment.fill_card_details': ['Please fill in all card details', 'Veuillez remplir tous les détails de la carte', 'אנא מלא את כל פרטי הכרטיס'],
  'booking.payment.payment_failed': ['Payment failed. Please try again.', 'Le paiement a échoué. Veuillez réessayer.', 'התשלום נכשל. אנא נסה שוב.'],
  'booking.payment.processing_error': ['Payment processing error. Please try again.', 'Erreur de traitement du paiement. Veuillez réessayer.', 'שגיאה בעיבוד התשלום. אנא נסה שוב.'],
  'booking.payment.confirmed': ['Booking confirmed', 'Réservation confirmée', 'הזמנה אושרה'],

  // Step 7
  'booking.step7.title': ['Review & Payment', 'Vérification et paiement', 'סקירה ותשלום'],
  'booking.step7.subtitle': ['Please review your booking and complete the payment', 'Veuillez vérifier votre réservation et compléter le paiement', 'אנא בדוק את ההזמנה והשלם את התשלום'],

  // Game area party/parties
  'booking.game_area.laser.party': ['party', 'partie', 'משחק'],
  'booking.game_area.laser.parties': ['parties', 'parties', 'משחקים'],
};

// Mapping de remplacement pour le fichier TSX
// Format: [texte_français, clé_traduction, type_de_remplacement]
const TSX_REPLACEMENTS = [
  // Step 3 - Game
  ['Type de jeu', 'booking.step3_game.title', 'jsx'],
  ['Choisissez votre activité', 'booking.step3_game.subtitle', 'jsx'],
  ['Jeux interactifs et challenges', 'booking.game_area.active.description', 'jsx'],
  ['Labyrinthe laser', 'booking.game_area.laser.description', 'jsx'],
  ['Sur mesure', 'booking.game_area.mix.title', 'jsx'],
  ['Combinaison Active + Laser', 'booking.game_area.mix.description', 'jsx'],

  // Duration
  ['Durée de jeu', 'booking.game_duration.title', 'jsx'],
  ['Jeux illimités pendant la durée choisie', 'booking.game_duration.unlimited', 'jsx'],

  // Parties
  ['Nombre de parties', 'booking.game_parties.title', 'jsx'],
  ['partie de laser', 'booking.game_parties.laser_singular', 'string'],
  ['parties de laser', 'booking.game_parties.laser_plural', 'string'],

  // Custom
  ['Formule Sur Mesure', 'booking.custom_formula.title', 'jsx'],
  ['Combinaison Active Games + Laser City', 'booking.custom_formula.description', 'jsx'],
  ['Nous vous contacterons pour personnaliser votre expérience', 'booking.custom_formula.note', 'jsx'],

  // Continue
  ['Continuer', 'booking.continue', 'jsx'],

  // Event
  ['Type de jeux', 'booking.step3_event.title', 'jsx'],
  ['Quelle activité pour votre événement ?', 'booking.step3_event.subtitle', 'jsx'],
  ['1 heure de jeux', 'booking.event_game.active_1h', 'jsx'],
  ['2 parties de laser', 'booking.event_game.laser_2games', 'jsx'],
  ['30min Active + 1 Laser', 'booking.event_game.mix', 'jsx'],

  // Errors
  ['Aucune branche disponible. Veuillez contacter le support.', 'booking.errors.no_branches', 'string'],
  ['Veuillez sélectionner une branche.', 'booking.errors.select_branch', 'string'],
  ['Erreur lors de la confirmation. Veuillez réessayer.', 'booking.errors.confirmation_error', 'string'],
  ['Erreur lors de la sauvegarde de la réservation', 'booking.errors.save_reservation', 'string'],

  // Payment
  ['Please fill in all card details', 'booking.payment.fill_card_details', 'string'],
  ['Payment failed. Please try again.', 'booking.payment.payment_failed', 'string'],
  ['Payment processing error. Please try again.', 'booking.payment.processing_error', 'string'],
  ['Booking confirmed', 'booking.payment.confirmed', 'string'],

  // Confirmation
  ['Request Received!', 'booking.confirmation.request_received', 'string'],
  ['We will contact you shortly to confirm your reservation', 'booking.confirmation.contact_soon', 'string'],
  ['Request Number', 'booking.confirmation.request_number', 'string'],
];

console.log('🚀 Début de la migration i18n pour reservation/page.tsx\n');

// Lire les fichiers de traduction
console.log('📖 Lecture des fichiers de traduction...');
const en = JSON.parse(fs.readFileSync(EN_FILE, 'utf8'));
const fr = JSON.parse(fs.readFileSync(FR_FILE, 'utf8'));
const he = JSON.parse(fs.readFileSync(HE_FILE, 'utf8'));

// Fonction pour définir une clé nested
function setNestedKey(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

// Ajouter les nouvelles traductions
console.log('✏️  Ajout des traductions manquantes...');
let addedCount = 0;
Object.entries(NEW_TRANSLATIONS).forEach(([key, [textEn, textFr, textHe]]) => {
  setNestedKey(en, key, textEn);
  setNestedKey(fr, key, textFr);
  setNestedKey(he, key, textHe);
  addedCount++;
  console.log(`  ✓ ${key}`);
});

// Sauvegarder les fichiers de traduction
console.log('\n💾 Sauvegarde des fichiers de traduction...');
fs.writeFileSync(EN_FILE, JSON.stringify(en, null, 2), 'utf8');
fs.writeFileSync(FR_FILE, JSON.stringify(fr, null, 2), 'utf8');
fs.writeFileSync(HE_FILE, JSON.stringify(he, null, 2), 'utf8');
console.log('  ✓ en.json, fr.json, he.json sauvegardés');

// Lire le fichier TSX
console.log('\n📖 Lecture de reservation/page.tsx...');
let content = fs.readFileSync(RESERVATION_FILE, 'utf8');

// Effectuer les remplacements
console.log('\n🔄 Remplacement des textes hardcodés...');
let replacementCount = 0;

TSX_REPLACEMENTS.forEach(([text, key, type]) => {
  const before = content;

  if (type === 'jsx') {
    // Remplacer dans JSX: >texte< devient >{t('key')}<
    const pattern = new RegExp(`>\\s*${escapeRegex(text)}\\s*<`, 'g');
    content = content.replace(pattern, `>{t('${key}')}<`);
  } else {
    // Remplacer string: 'texte' ou "texte" devient t('key')
    const pattern1 = new RegExp(`'${escapeRegex(text)}'`, 'g');
    const pattern2 = new RegExp(`"${escapeRegex(text)}"`, 'g');
    content = content.replace(pattern1, `t('${key}')`);
    content = content.replace(pattern2, `t('${key}')`);
  }

  if (before !== content) {
    replacementCount++;
    console.log(`  ✓ "${text}" → t('${key}')`);
  }
});

// Remplacements spéciaux avec interpolation
console.log('\n🔧 Remplacements spéciaux avec interpolation...');

// Erreur "Branche X non trouvée"
content = content.replace(
  /`Branche "\\$\{bookingData\.branch\}" non trouvée\. Veuillez réessayer\.`/g,
  "t('booking.errors.branch_not_found', { branch: bookingData.branch })"
);
content = content.replace(
  /`Erreur: \$\{result\.error \|\| 'Erreur lors de la sauvegarde de la réservation'\}`/g,
  "t('booking.errors.save_error', { error: result.error || t('booking.errors.save_reservation') })"
);

// Message conditionnel de confirmation
content = content.replace(
  /\{orderMessage \|\| 'Your request has been received\. We will contact you shortly to confirm your reservation\.'\}/g,
  "{orderMessage || t('booking.confirmation.contact_soon')}"
);

// Sauvegarder le fichier modifié
console.log('\n💾 Sauvegarde de reservation/page.tsx...');
fs.writeFileSync(RESERVATION_FILE, content, 'utf8');

console.log(`\n✅ Migration terminée avec succès!`);
console.log(`   📝 ${addedCount} clés de traduction ajoutées`);
console.log(`   🔄 ${replacementCount} remplacements effectués`);
console.log(`\n🔍 Prochaine étape: npm run build pour vérifier\n`);

// Fonction pour échapper les regex
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
