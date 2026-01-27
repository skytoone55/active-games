#!/usr/bin/env python3
import json
from pathlib import Path

def flatten_dict(d, parent_key='', sep='.'):
    """Aplatit un dictionnaire imbriqué en utilisant la notation pointée."""
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        elif isinstance(v, list):
            # Pour les listes, on ne les aplatit pas, on les garde telles quelles
            items.append((new_key, v))
        else:
            items.append((new_key, v))
    return dict(items)

# Chemins des fichiers
base_path = Path("/Users/jeremy/Desktop/claude/activelaser/src/i18n/locales")
he_path = base_path / "he.json"
fr_path = base_path / "fr.json"
en_path = base_path / "en.json"

# Charger les fichiers
with open(he_path, 'r', encoding='utf-8') as f:
    he_data = json.load(f)
with open(fr_path, 'r', encoding='utf-8') as f:
    fr_data = json.load(f)
with open(en_path, 'r', encoding='utf-8') as f:
    en_data = json.load(f)

# Aplatir les dictionnaires
he_flat = flatten_dict(he_data)
fr_flat = flatten_dict(fr_data)
en_flat = flatten_dict(en_data)

# Extraire les ensembles de clés
he_keys = set(he_flat.keys())
fr_keys = set(fr_flat.keys())
en_keys = set(en_flat.keys())

# Trouver les clés manquantes
missing_in_he = (fr_keys | en_keys) - he_keys
missing_in_fr = (he_keys | en_keys) - fr_keys
missing_in_en = (he_keys | fr_keys) - en_keys

# Trouver les clés uniques à chaque langue
only_in_he = he_keys - (fr_keys | en_keys)
only_in_fr = fr_keys - (he_keys | en_keys)
only_in_en = en_keys - (he_keys | fr_keys)

# Afficher le rapport
print("=" * 80)
print("RAPPORT D'ANALYSE DES TRADUCTIONS")
print("=" * 80)
print()

print("STATISTIQUES")
print("-" * 80)
print(f"Total clés en hébreu (he):    {len(he_keys)}")
print(f"Total clés en français (fr):  {len(fr_keys)}")
print(f"Total clés en anglais (en):   {len(en_keys)}")
print()

# Union de toutes les clés
all_keys = he_keys | fr_keys | en_keys
print(f"Total clés uniques (toutes langues confondues): {len(all_keys)}")
print()

print("=" * 80)
print("CLÉS MANQUANTES EN HÉBREU (he)")
print("=" * 80)
if missing_in_he:
    print(f"Nombre de clés manquantes: {len(missing_in_he)}\n")
    for key in sorted(missing_in_he):
        print(f"  - {key}")
else:
    print("✓ Aucune clé manquante")
print()

print("=" * 80)
print("CLÉS MANQUANTES EN FRANÇAIS (fr)")
print("=" * 80)
if missing_in_fr:
    print(f"Nombre de clés manquantes: {len(missing_in_fr)}\n")
    for key in sorted(missing_in_fr):
        print(f"  - {key}")
else:
    print("✓ Aucune clé manquante")
print()

print("=" * 80)
print("CLÉS MANQUANTES EN ANGLAIS (en)")
print("=" * 80)
if missing_in_en:
    print(f"Nombre de clés manquantes: {len(missing_in_en)}\n")
    for key in sorted(missing_in_en):
        print(f"  - {key}")
else:
    print("✓ Aucune clé manquante")
print()

print("=" * 80)
print("CLÉS PRÉSENTES UNIQUEMENT DANS UNE LANGUE")
print("=" * 80)
if only_in_he or only_in_fr or only_in_en:
    if only_in_he:
        print(f"\nUniquement en hébreu ({len(only_in_he)} clés):")
        for key in sorted(only_in_he):
            print(f"  - {key}")
    
    if only_in_fr:
        print(f"\nUniquement en français ({len(only_in_fr)} clés):")
        for key in sorted(only_in_fr):
            print(f"  - {key}")
    
    if only_in_en:
        print(f"\nUniquement en anglais ({len(only_in_en)} clés):")
        for key in sorted(only_in_en):
            print(f"  - {key}")
else:
    print("✓ Aucune clé unique à une seule langue")
print()

print("=" * 80)
print("RÉSUMÉ")
print("=" * 80)
total_missing = len(missing_in_he) + len(missing_in_fr) + len(missing_in_en)
if total_missing == 0:
    print("✓ PARFAIT ! Toutes les clés sont présentes dans les 3 langues.")
else:
    print(f"⚠ {total_missing} clé(s) manquante(s) au total")
    print(f"  - {len(missing_in_he)} manquante(s) en hébreu")
    print(f"  - {len(missing_in_fr)} manquante(s) en français")
    print(f"  - {len(missing_in_en)} manquante(s) en anglais")
print()
