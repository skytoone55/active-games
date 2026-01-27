#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESERVATION_FILE = path.join(__dirname, '../src/app/reservation/page.tsx');

console.log('⚙️  Ajout de la fonction helper t()...\n');

let content = fs.readFileSync(RESERVATION_FILE, 'utf8');

// Trouver l'endroit où insérer la fonction t après les useState
const insertPoint = content.indexOf('const [paymentSuccess, setPaymentSuccess] = useState(false)');
if (insertPoint === -1) {
  console.error('❌ Point d\'insertion non trouvé');
  process.exit(1);
}

const endOfLine = content.indexOf('\n', insertPoint);

// Ajouter la fonction t helper
const tHelper = `

  // Helper function for translations
  const t = (key: string, params?: Record<string, any>) => {
    const keys = key.split('.')
    let value: any = translations
    for (const k of keys) {
      value = value?.[k]
      if (!value) return key // Fallback to key if translation not found
    }
    // Handle interpolation
    if (params && typeof value === 'string') {
      return Object.entries(params).reduce((str, [paramKey, paramValue]) => {
        return str.replace(\`{{\${paramKey}}}\`, String(paramValue))
      }, value)
    }
    return value || key
  }`;

content = content.slice(0, endOfLine + 1) + tHelper + content.slice(endOfLine + 1);

fs.writeFileSync(RESERVATION_FILE, content, 'utf8');

console.log('✅ Fonction t() ajoutée avec succès\n');
