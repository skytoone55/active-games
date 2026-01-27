#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESERVATION_FILE = path.join(__dirname, '../src/app/reservation/page.tsx');

console.log('🧹 Nettoyage final des textes hardcodés...\n');

let content = fs.readFileSync(RESERVATION_FILE, 'utf8');
let count = 0;

// Remplacements simples (textes isolés)
const SIMPLE_REPLACEMENTS = [
  ['>Name:<', '>{t(\'booking.summary.name\')}<'],
  ['>Phone:<', '>{t(\'booking.summary.phone\')}<'],
  ['>Email:<', '>{t(\'booking.summary.email\')}<'],
  ['30min Active + 1 Laser', 'booking.event_game.mix'],  // dans le gameArea MIX inline
];

SIMPLE_REPLACEMENTS.forEach(([from, to]) => {
  const before = content;
  if (to.startsWith('>')) {
    content = content.replace(from, to);
  } else {
    // C'est une clé seulement
    content = content.replace(new RegExp(`'${escapeRegex(from)}'`, 'g'), `t('${to}')`);
    content = content.replace(new RegExp(`"${escapeRegex(from)}"`, 'g'), `t('${to}')`);
  }
  if (before !== content) {
    count++;
    console.log(`  ✓ ${from} → ${to}`);
  }
});

// Remplacer alert() avec traductions interpolées
content = content.replace(
  /alert\('Erreur lors de la confirmation\. Veuillez réessayer\.'\)/g,
  "alert(t('booking.errors.confirmation_error'))"
);

if (content.includes("alert(t('booking.errors.confirmation_error'))")) {
  count++;
  console.log("  ✓ alert('Erreur...') → alert(t('booking.errors.confirmation_error'))");
}

fs.writeFileSync(RESERVATION_FILE, content, 'utf8');

console.log(`\n✅ Nettoyage terminé: ${count} remplacements supplémentaires\n`);

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
