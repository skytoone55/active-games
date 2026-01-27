const fs = require('fs');
const path = require('path');

// Lire le fichier BookingModal.tsx
const filePath = path.join(__dirname, 'src/app/admin/components/BookingModal.tsx');
const content = fs.readFileSync(filePath, 'utf-8');

// Patterns pour extraire les textes hardcodés
const patterns = {
  // Textes entre guillemets simples
  singleQuotes: /'([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÆŒÇ][^']{2,}[a-zàâäéèêëïîôùûüÿæœç :,\-éàèù\.!\?])'/g,
  // Textes entre guillemets doubles
  doubleQuotes: /"([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÆŒÇ][^"]{2,}[a-zàâäéèêëïîôùûüÿæœç :,\-éàèù\.!\?])"/g,
  // Textes dans JSX (entre balises)
  jsxText: />([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÆŒÇ][a-zàâäéèêëïîôùûüÿæœç :,\-éàèù\.!\?]{2,})</g,
  // Appels t() déjà existants pour éviter de les re-extraire
  existingT: /t\(['"]([^'"]+)['"]\)/g
};

const strings = new Map();
const lines = content.split('\n');

// Fonction pour nettoyer une chaîne
function cleanString(str) {
  return str.trim().replace(/\\n/g, ' ').replace(/\s+/g, ' ');
}

// Fonction pour vérifier si un texte est valide (français)
function isValidFrenchText(text) {
  // Ignorer les constantes de code
  if (['GAME', 'EVENT', 'ACTIVE', 'LASER', 'CUSTOM', 'MIX'].includes(text)) return false;
  // Ignorer les noms de couleurs (déjà traduits)
  if (['Bleu', 'Vert', 'Rouge', 'Orange', 'Violet', 'Rose', 'Cyan', 'Jaune', 'Indigo', 'Emeraude'].includes(text)) return false;
  // Doit contenir au moins un mot français
  return /[àâäéèêëïîôùûüÿæœç]/i.test(text) || text.length > 15;
}

// Extraire les textes déjà traduits (pour éviter de les ré-extraire)
const existingTranslations = new Set();
let match;
while ((match = patterns.existingT.exec(content)) !== null) {
  existingTranslations.add(match[1]);
}

console.log(`Found ${existingTranslations.size} existing translations`);

// Extraire tous les textes français
lines.forEach((line, index) => {
  const lineNum = index + 1;

  // Ignorer les commentaires
  if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
    return;
  }

  // Extraire les textes entre guillemets simples
  let m;
  while ((m = patterns.singleQuotes.exec(line)) !== null) {
    const text = cleanString(m[1]);
    if (isValidFrenchText(text) && text.length > 3) {
      if (!strings.has(text)) {
        strings.set(text, []);
      }
      strings.get(text).push({ line: lineNum, context: line.trim().substring(0, 80) });
    }
  }

  // Extraire les textes entre guillemets doubles
  while ((m = patterns.doubleQuotes.exec(line)) !== null) {
    const text = cleanString(m[1]);
    if (isValidFrenchText(text) && text.length > 3) {
      if (!strings.has(text)) {
        strings.set(text, []);
      }
      strings.get(text).push({ line: lineNum, context: line.trim().substring(0, 80) });
    }
  }

  // Extraire les textes JSX
  while ((m = patterns.jsxText.exec(line)) !== null) {
    const text = cleanString(m[1]);
    if (isValidFrenchText(text) && text.length > 2) {
      if (!strings.has(text)) {
        strings.set(text, []);
      }
      strings.get(text).push({ line: lineNum, context: line.trim().substring(0, 80) });
    }
  }
});

// Générer le rapport
console.log(`\n=== EXTRACTED ${strings.size} FRENCH STRINGS ===\n`);

const report = [];
const translationKeys = {};
let keyCounter = 1;

for (const [text, occurrences] of strings.entries()) {
  report.push(`\n[${keyCounter}] "${text}"`);
  report.push(`   Found ${occurrences.length} time(s):`);
  occurrences.forEach(occ => {
    report.push(`   Line ${occ.line}: ${occ.context}`);
  });

  // Générer une clé de traduction
  const key = `string_${keyCounter}`;
  translationKeys[key] = text;
  keyCounter++;
}

// Sauvegarder le rapport
fs.writeFileSync('booking-modal-strings-report.txt', report.join('\n'));
console.log('Report saved to booking-modal-strings-report.txt');

// Sauvegarder les clés
fs.writeFileSync('booking-modal-translation-keys.json', JSON.stringify(translationKeys, null, 2));
console.log('Translation keys saved to booking-modal-translation-keys.json');

console.log(`\nTotal: ${strings.size} unique French strings found`);
