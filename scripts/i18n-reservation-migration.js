#!/usr/bin/env node

/**
 * Script de migration i18n pour reservation/page.tsx
 * Remplace tous les textes hardcodés par des appels à t()
 */

const fs = require('fs');
const path = require('path');

// Chemins
const RESERVATION_FILE = path.join(__dirname, '../src/app/reservation/page.tsx');
const EN_FILE = path.join(__dirname, '../src/i18n/locales/en.json');
const FR_FILE = path.join(__dirname, '../src/i18n/locales/fr.json');
const HE_FILE = path.join(__dirname, '../src/i18n/locales/he.json');

// Mapping de tous les textes hardcodés trouvés dans le fichier
// Format: [texte_en_dur, clé_traduction, texte_en, texte_fr, texte_he]
const TRANSLATIONS = {
  // Step 3 - Game Area Selection
  'Type de jeu': ['booking.step3_game.title', 'Game Type', 'Type de jeu', 'סוג משחק'],
  'Choisissez votre activité': ['booking.step3_game.subtitle', 'Choose your activity', 'Choisissez votre activité', 'בחר את הפעילות שלך'],
  'Active Games': ['booking.game_area.active.title', 'Active Games', 'Active Games', 'Active Games'],
  'Jeux interactifs et challenges': ['booking.game_area.active.description', 'Interactive games and challenges', 'Jeux interactifs et challenges', 'משחקים אינטראקטיביים ואתגרים'],
  'Laser City': ['booking.game_area.laser.title', 'Laser City', 'Laser City', 'Laser City'],
  'Labyrinthe laser': ['booking.game_area.laser.description', 'Laser maze', 'Labyrinthe laser', 'מבוך לייזר'],
  'Sur mesure': ['booking.game_area.mix.title', 'Custom', 'Sur mesure', 'מותאם אישית'],
  'Combinaison Active + Laser': ['booking.game_area.mix.description', 'Active + Laser combination', 'Combinaison Active + Laser', 'שילוב Active + Laser'],

  // Duration / Number of games
  'Durée de jeu': ['booking.game_duration.title', 'Game Duration', 'Durée de jeu', 'משך משחק'],
  'Jeux illimités pendant la durée choisie': ['booking.game_duration.unlimited_games', 'Unlimited games during the chosen duration', 'Jeux illimités pendant la durée choisie', 'משחקים ללא הגבלה במהלך המשך הזמן שנבחר'],
  'Nombre de parties': ['booking.game_parties.title', 'Number of games', 'Nombre de parties', 'מספר משחקים'],
  'partie de laser': ['booking.game_parties.laser_game_singular', 'laser game', 'partie de laser', 'משחק לייזר'],
  'parties de laser': ['booking.game_parties.laser_game_plural', 'laser games', 'parties de laser', 'משחקי לייזר'],
  'Formule Sur Mesure': ['booking.custom_formula.title', 'Custom Package', 'Formule Sur Mesure', 'חבילה מותאמת אישית'],
  'Combinaison Active Games + Laser City': ['booking.custom_formula.description', 'Active Games + Laser City combination', 'Combinaison Active Games + Laser City', 'שילוב Active Games + Laser City'],
  'Nous vous contacterons pour personnaliser votre expérience': ['booking.custom_formula.contact_note', 'We will contact you to customize your experience', 'Nous vous contacterons pour personnaliser votre expérience', 'ניצור איתך קשר כדי להתאים אישית את החוויה שלך'],
  'Continuer': ['booking.continue', 'Continue', 'Continuer', 'המשך'],

  // Step 3 - Event Game Selection
  'Type de jeux': ['booking.step3_event.title', 'Type of games', 'Type de jeux', 'סוג משחקים'],
  'Quelle activité pour votre événement ?': ['booking.step3_event.subtitle', 'Which activity for your event?', 'Quelle activité pour votre événement ?', 'איזו פעילות לאירוע שלך?'],
  '1 heure de jeux': ['booking.event_game.active_1h', '1 hour of games', '1 heure de jeux', 'שעה של משחקים'],
  '2 parties de laser': ['booking.event_game.laser_2games', '2 laser games', '2 parties de laser', '2 משחקי לייזר'],
  '30min Active + 1 Laser': ['booking.event_game.mix', '30min Active + 1 Laser', '30min Active + 1 Laser', '30 דקות Active + 1 Laser'],

  // Errors and validation
  'Aucune branche disponible. Veuillez contacter le support.': ['booking.errors.no_branches', 'No branches available. Please contact support.', 'Aucune branche disponible. Veuillez contacter le support.', 'לא נמצאו סניפים. אנא צור קשר עם התמיכה.'],
  'Veuillez sélectionner une branche.': ['booking.errors.select_branch', 'Please select a branch.', 'Veuillez sélectionner une branche.', 'אנא בחר סניף.'],
  'Branche "{{branch}}" non trouvée. Veuillez réessayer.': ['booking.errors.branch_not_found', 'Branch "{{branch}}" not found. Please try again.', 'Branche "{{branch}}" non trouvée. Veuillez réessayer.', 'סניף "{{branch}}" לא נמצא. אנא נסה שוב.'],
  'Erreur: {{error}}': ['booking.errors.save_error', 'Error: {{error}}', 'Erreur : {{error}}', 'שגיאה: {{error}}'],
  'Erreur lors de la confirmation. Veuillez réessayer.': ['booking.errors.confirmation_error', 'Error during confirmation. Please try again.', 'Erreur lors de la confirmation. Veuillez réessayer.', 'שגיאה באישור. אנא נסה שוב.'],

  // Payment
  'Please fill in all card details': ['booking.payment.fill_card_details', 'Please fill in all card details', 'Veuillez remplir tous les détails de la carte', 'אנא מלא את כל פרטי הכרטיס'],
  'Payment failed. Please try again.': ['booking.payment.payment_failed', 'Payment failed. Please try again.', 'Le paiement a échoué. Veuillez réessayer.', 'התשלום נכשל. אנא נסה שוב.'],
  'Payment processing error. Please try again.': ['booking.payment.processing_error', 'Payment processing error. Please try again.', 'Erreur de traitement du paiement. Veuillez réessayer.', 'שגיאה בעיבוד התשלום. אנא נסה שוב.'],
  'Booking confirmed': ['booking.payment.confirmed', 'Booking confirmed', 'Réservation confirmée', 'הזמנה אושרה'],

  // Summary
  'Résumé de votre réservation': ['booking.summary.title', 'Booking Summary', 'Résumé de votre réservation', 'סיכום ההזמנה שלך'],
  'Branche': ['booking.summary.branch', 'Branch', 'Branche', 'סניף'],
  'Type': ['booking.summary.type', 'Type', 'Type', 'סוג'],
  'Jeu': ['booking.summary.game', 'Game', 'Jeu', 'משחק'],
  'Événement': ['booking.summary.event', 'Event', 'Événement', 'אירוע'],
  'Activité': ['booking.summary.activity', 'Activity', 'Activité', 'פעילות'],
  'Durée': ['booking.summary.duration', 'Duration', 'Durée', 'משך'],
  'Parties': ['booking.summary.games', 'Games', 'Parties', 'משחקים'],
  'Participants': ['booking.summary.participants', 'Participants', 'Participants', 'משתתפים'],
  'Date': ['booking.summary.date', 'Date', 'Date', 'תאריך'],
  'Heure': ['booking.summary.time', 'Time', 'Heure', 'שעה'],
  'Retour': ['booking.back', 'Back', 'Retour', 'חזרה'],
  'Confirmer': ['booking.confirm', 'Confirm', 'Confirmer', 'אישור'],

  // Confirmation messages
  'Merci pour votre réservation !': ['booking.confirmation.thank_you', 'Thank you for your booking!', 'Merci pour votre réservation !', 'תודה על ההזמנה שלך!'],
  'Votre réservation a été enregistrée avec succès': ['booking.confirmation.success', 'Your booking has been successfully registered', 'Votre réservation a été enregistrée avec succès', 'ההזמנה שלך נרשמה בהצלחה'],
  'Numéro de réservation': ['booking.confirmation.reference_number', 'Booking number', 'Numéro de réservation', 'מספר הזמנה'],
  'Nous vous avons envoyé un email de confirmation': ['booking.confirmation.email_sent', 'We have sent you a confirmation email', 'Nous vous avons envoyé un email de confirmation', 'שלחנו לך אימייל אישור'],
  'Retour à l\'accueil': ['booking.confirmation.back_home', 'Back to home', 'Retour à l\'accueil', 'חזרה לדף הבית'],
  'Nouvelle réservation': ['booking.confirmation.new_booking', 'New booking', 'Nouvelle réservation', 'הזמנה חדשה'],

  // Payment step
  'Informations de paiement': ['booking.payment.title', 'Payment Information', 'Informations de paiement', 'מידע תשלום'],
  'Un acompte est requis pour confirmer votre réservation': ['booking.payment.deposit_required', 'A deposit is required to confirm your booking', 'Un acompte est requis pour confirmer votre réservation', 'נדרש מקדמה כדי לאשר את ההזמנה שלך'],
  'Acompte à payer': ['booking.payment.deposit_to_pay', 'Deposit to pay', 'Acompte à payer', 'מקדמה לתשלום'],
  'Total estimé': ['booking.payment.estimated_total', 'Estimated total', 'Total estimé', 'סה"כ משוער'],
  'Prix unitaire': ['booking.payment.unit_price', 'Unit price', 'Prix unitaire', 'מחיר ליחידה'],
  'Salle': ['booking.payment.room', 'Room', 'Salle', 'חדר'],
  'Frais de salle': ['booking.payment.room_fee', 'Room fee', 'Frais de salle', 'דמי חדר'],
  'Informations de carte bancaire': ['booking.payment.card_info', 'Credit card information', 'Informations de carte bancaire', 'פרטי כרטיס אשראי'],
  'Numéro de carte': ['booking.payment.card_number', 'Card number', 'Numéro de carte', 'מספר כרטיס'],
  'Validité (MM/AA)': ['booking.payment.validity', 'Expiry (MM/YY)', 'Validité (MM/AA)', 'תוקף (MM/YY)'],
  'CVV': ['booking.payment.cvv', 'CVV', 'CVV', 'CVV'],
  'Carte d\'identité du titulaire': ['booking.payment.holder_id', 'ID of cardholder', 'Carte d\'identité du titulaire', 'ת.ז. של בעל הכרטיס'],
  'Nom du titulaire': ['booking.payment.holder_name', 'Cardholder name', 'Nom du titulaire', 'שם בעל הכרטיס'],
  'Optionnel - utilisera le nom du contact si vide': ['booking.payment.holder_name_optional', 'Optional - will use contact name if empty', 'Optionnel - utilisera le nom du contact si vide', 'אופציונלי - ישתמש בשם איש הקשר אם ריק'],
  'Traitement du paiement...': ['booking.payment.processing', 'Processing payment...', 'Traitement du paiement...', 'מעבד תשלום...'],
  'Paiement effectué': ['booking.payment.completed', 'Payment completed', 'Paiement effectué', 'התשלום הושלם'],
  'Confirmation en cours...': ['booking.payment.confirming', 'Confirming...', 'Confirmation en cours...', 'מאשר...'],
  'Paiement sécurisé': ['booking.payment.secure', 'Secure payment', 'Paiement sécurisé', 'תשלום מאובטח'],
  'Toutes les transactions sont cryptées et sécurisées': ['booking.payment.secure_note', 'All transactions are encrypted and secure', 'Toutes les transactions sont cryptées et sécurisées', 'כל העסקאות מוצפנות ומאובטחות'],
  'Erreur de paiement': ['booking.payment.error_title', 'Payment error', 'Erreur de paiement', 'שגיאת תשלום'],
  'Chargement des informations de paiement...': ['booking.payment.loading', 'Loading payment information...', 'Chargement des informations de paiement...', 'טוען מידע תשלום...'],
};

// Fonction pour échapper les regex
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Lire le fichier de réservation
console.log('📖 Lecture du fichier reservation/page.tsx...');
let content = fs.readFileSync(RESERVATION_FILE, 'utf8');

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

// Ajouter les traductions manquantes
console.log('✏️  Ajout des traductions manquantes...');
Object.entries(TRANSLATIONS).forEach(([hardcoded, [key, textEn, textFr, textHe]]) => {
  setNestedKey(en, key, textEn);
  setNestedKey(fr, key, textFr);
  setNestedKey(he, key, textHe);
});

// Sauvegarder les fichiers de traduction
console.log('💾 Sauvegarde des fichiers de traduction...');
fs.writeFileSync(EN_FILE, JSON.stringify(en, null, 2), 'utf8');
fs.writeFileSync(FR_FILE, JSON.stringify(fr, null, 2), 'utf8');
fs.writeFileSync(HE_FILE, JSON.stringify(he, null, 2), 'utf8');

// Remplacer les textes hardcodés dans le fichier TSX
console.log('🔄 Remplacement des textes hardcodés...');
let replacementCount = 0;

Object.entries(TRANSLATIONS).forEach(([hardcoded, [key]]) => {
  // Pattern pour match le texte hardcodé (entre quotes ou dans du JSX)
  const patterns = [
    // Dans du JSX: >texte<
    new RegExp(`>\\s*${escapeRegex(hardcoded)}\\s*<`, 'g'),
    // String littéral avec simple quotes
    new RegExp(`'${escapeRegex(hardcoded)}'`, 'g'),
    // String littéral avec double quotes
    new RegExp(`"${escapeRegex(hardcoded)}"`, 'g'),
  ];

  patterns.forEach((pattern, index) => {
    const before = content;
    if (index === 0) {
      // JSX: remplacer par {t('key')}
      content = content.replace(pattern, `>{t('${key}')}<`);
    } else {
      // String: remplacer par t('key')
      content = content.replace(pattern, `t('${key}')`);
    }
    if (before !== content) {
      replacementCount++;
      console.log(`  ✓ Remplacé "${hardcoded}" par t('${key}')`);
    }
  });
});

// Ajouter l'import de useTranslations si pas présent
if (!content.includes('import { useTranslations }')) {
  console.log('📦 Ajout de l\'import useTranslations...');
  content = content.replace(
    /import.*from 'next-intl'/,
    "import { useTranslations } from 'next-intl'"
  );
}

// Ajouter const t = useTranslations() dans le composant si pas présent
if (!content.includes('const t = useTranslations()')) {
  console.log('📦 Ajout de const t = useTranslations()...');
  // Trouver le début du composant ReservationContent
  const componentStart = content.indexOf('function ReservationContent() {');
  if (componentStart !== -1) {
    const insertPosition = content.indexOf('{', componentStart) + 1;
    content =
      content.slice(0, insertPosition) +
      '\n  const t = useTranslations()\n' +
      content.slice(insertPosition);
  }
}

// Sauvegarder le fichier modifié
console.log('💾 Sauvegarde du fichier modifié...');
fs.writeFileSync(RESERVATION_FILE, content, 'utf8');

console.log(`\n✅ Migration terminée!`);
console.log(`   - ${replacementCount} remplacements effectués`);
console.log(`   - ${Object.keys(TRANSLATIONS).length} clés de traduction ajoutées`);
console.log(`\n🔍 Vérification du build recommandée: npm run build`);
