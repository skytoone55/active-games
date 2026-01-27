#!/usr/bin/env python3
"""
Script pour trouver tous les textes hardcodés dans le code
qui devraient être dans les fichiers de traduction
"""
import os
import re
from pathlib import Path

def is_french_text(text):
    """Détecte si un texte est probablement en français"""
    french_indicators = [
        'é', 'è', 'à', 'ç', 'ê', 'ô', 'û', 'ù', 'î', 'ï', 'ë',
        'le ', 'la ', 'les ', 'des ', 'une ', 'un ',
        'est ', 'sont ', 'avec ', 'pour ', 'dans ',
    ]
    text_lower = text.lower()
    return any(ind in text_lower for ind in french_indicators)

def is_hebrew_text(text):
    """Détecte si un texte contient de l'hébreu"""
    return any('\u0590' <= c <= '\u05FF' for c in text)

def extract_hardcoded_strings(filepath):
    """Extrait les strings hardcodées d'un fichier"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Patterns pour trouver les strings
    patterns = [
        # Strings entre guillemets simples
        r"'([^']{3,})'",
        # Strings entre guillemets doubles
        r'"([^"]{3,})"',
        # Strings dans template literals (sans variables)
        r'`([^`$]{3,})`',
    ]

    hardcoded = []

    for pattern in patterns:
        matches = re.finditer(pattern, content)
        for match in matches:
            text = match.group(1)

            # Ignorer les cas évidents qui ne sont pas du texte UI
            if any([
                text.startswith('http'),
                text.startswith('/'),
                text.startswith('@'),
                text.startswith('#'),
                text in ['ltr', 'rtl', 'light', 'dark'],
                text.startswith('admin.'),
                text.startswith('booking.'),
                text.startswith('errors.'),
                '{{' in text,  # Variables de template
                len(text) < 3,
                text.isdigit(),
                re.match(r'^[A-Z_]+$', text),  # Constantes
                re.match(r'^[a-z_]+$', text),  # IDs/clés
            ]):
                continue

            # Détecter la langue
            is_french = is_french_text(text)
            is_hebrew = is_hebrew_text(text)

            if is_french or is_hebrew:
                line_num = content[:match.start()].count('\n') + 1
                hardcoded.append({
                    'line': line_num,
                    'text': text,
                    'is_french': is_french,
                    'is_hebrew': is_hebrew
                })

    return hardcoded

# Scanner tous les fichiers .tsx et .ts dans src/
src_dir = Path('src')
results = {}

for filepath in src_dir.rglob('*.tsx'):
    # Ignorer node_modules et .next
    if 'node_modules' in str(filepath) or '.next' in str(filepath):
        continue

    hardcoded = extract_hardcoded_strings(filepath)
    if hardcoded:
        results[str(filepath)] = hardcoded

# Afficher les résultats
print("="*80)
print("RAPPORT: TEXTES HARDCODÉS TROUVÉS")
print("="*80)

french_total = 0
hebrew_total = 0

for filepath, items in sorted(results.items()):
    french_in_file = [x for x in items if x['is_french']]
    hebrew_in_file = [x for x in items if x['is_hebrew']]

    if not french_in_file and not hebrew_in_file:
        continue

    print(f"\n📁 {filepath}")
    print(f"   {len(french_in_file)} textes en FRANÇAIS, {len(hebrew_in_file)} en HÉBREU")

    # Afficher quelques exemples
    for item in (french_in_file + hebrew_in_file)[:5]:
        lang = "🇫🇷 FR" if item['is_french'] else "🇮🇱 HE"
        print(f"   Ligne {item['line']}: {lang} '{item['text'][:60]}...'")

    if len(french_in_file) + len(hebrew_in_file) > 5:
        print(f"   ... et {len(french_in_file) + len(hebrew_in_file) - 5} autres")

    french_total += len(french_in_file)
    hebrew_total += len(hebrew_in_file)

print(f"\n{'='*80}")
print(f"TOTAL: {french_total} textes FRANÇAIS hardcodés, {hebrew_total} HÉBREU hardcodés")
print(f"{'='*80}")

# Top 10 des fichiers les plus problématiques
print("\n🔥 TOP 10 DES FICHIERS AVEC LE PLUS DE TEXTES HARDCODÉS:")
sorted_files = sorted(results.items(), key=lambda x: len(x[1]), reverse=True)[:10]
for i, (filepath, items) in enumerate(sorted_files, 1):
    print(f"{i}. {filepath}: {len(items)} textes hardcodés")
