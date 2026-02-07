# Changelog des backups

## backup_CURRENT_2026-02-07_16-50.sql

### ✨ Nouveautés

#### Système i18n pour les formats de validation
- **Fichiers modifiés**:
  - `src/i18n/locales/fr.json` - Ajout `messenger.formats.names.*`
  - `src/i18n/locales/en.json` - Ajout `messenger.formats.names.*`
  - `src/i18n/locales/he.json` - Ajout `messenger.formats.names.*`

- **Traductions ajoutées**:
  - `full_name`: "Nom complet (prénom + nom)" / "Full name (first + last)" / "שם מלא"
  - `prenom_simple`: "Prénom simple" / "First name only" / "שם פרטי בלבד"
  - `phone`: "Numéro de téléphone" / "Phone number" / "מספר טלפון"
  - `email`: "Adresse email" / "Email address" / "כתובת אימייל"
  - `date`: "Date JJ/MM/AAAA" / "Date DD/MM/YYYY" / "תאריך"
  - `number`: "Nombre" / "Number" / "מספר"
  - `text_free`: "Texte libre" / "Free text" / "טקסט חופשי"

#### Nouveau format de validation: prenom_simple
- **Code**: `prenom_simple`
- **Description**: Accepte uniquement le prénom sans exiger le nom de famille
- **Regex**: `^[a-zA-Zà-žÀ-Ž\s''-]{2,50}$`
- **Usage**: Pour des commandes simples où seul le prénom suffit
- **Messages d'erreur multilingues**: FR/EN/HE

#### Composants React mis à jour
- `ModuleEditor.tsx`: Utilise maintenant `t(\`messenger.formats.names.${fmt.format_name}\`)`
- `ValidationFormatsModal.tsx`: Affiche les noms traduits + ajout du hook `useTranslation()`

#### Migration SQL
- Script `fix-format-names-clean.sql` pour normaliser les `format_name` existants
- Convertit les chemins complets (`messenger.formats.names.date`) en clés simples (`date`)
- Normalise les textes français/anglais vers les clés i18n

### 📊 Statistiques
- **Lignes**: 19,045 (+2,503 vs REFERENCE)
- **Taille**: 1.6 MB (+200 KB vs REFERENCE)
- **Tables modifiées**:
  - `messenger_validation_formats` (nouveaux formats + normalisation)
  - Aucune modification de structure

### 🔧 Changements techniques
1. Les `format_name` dans la DB sont maintenant des clés i18n simples (ex: "prenom_simple")
2. Les composants React résolvent ces clés via `t('messenger.formats.names.{key}')`
3. Support complet de 3 langues: Français, English, עברית (Hebrew)

### ⚙️ Configuration requise après restauration
- Redémarrer le serveur Next.js pour recharger les fichiers i18n
- Vérifier que les traductions s'affichent correctement dans l'interface admin

---

## backup_REFERENCE_2026-02-04_19-30.sql

### 📋 Description
Backup de référence avec configuration messenger complète et fonctionnelle en local.

### ✅ Contenu
- Configuration messenger complète
- Modules de base (availability_check, message_text, collect, etc.)
- Workflows fonctionnels
- Formats de validation de base (email, phone, full_name)

### ⚠️ Limitations connues
- URLs de commande pointent vers Vercel au lieu de activegames.co.il
- API `/api/public/clara/check-availability` bloquée par auth Vercel en production
- Noms de formats en français hardcodés (pas de système i18n)

### 📊 Statistiques
- **Lignes**: 16,542
- **Taille**: 1.4 MB
- **Date de création**: 4 février 2026, 19h30

---

## 🔄 Comment passer de REFERENCE à CURRENT

Si vous avez restauré le backup REFERENCE et voulez mettre à jour vers CURRENT:

```sql
-- 1. Ajouter le nouveau format prenom_simple
INSERT INTO messenger_validation_formats (
  format_code,
  format_name,
  validation_regex,
  error_message,
  description,
  is_active
) VALUES (
  'prenom_simple',
  'prenom_simple',
  '^[a-zA-Zà-žÀ-Ž\s''-]{2,50}$',
  '{"en": "Please enter a valid first name (2-50 characters)", "fr": "Veuillez entrer un prénom valide (2-50 caractères)", "he": "אנא הזן שם פרטי תקף (2-50 תווים)"}'::jsonb,
  'Accepte uniquement le prénom sans exiger le nom de famille.',
  true
);

-- 2. Normaliser les format_name existants
UPDATE messenger_validation_formats
SET format_name = SUBSTRING(format_name FROM 'messenger\.formats\.names\.(.*)')
WHERE format_name LIKE 'messenger.formats.names.%';

UPDATE messenger_validation_formats SET format_name = 'email' WHERE format_name LIKE '%Email%';
UPDATE messenger_validation_formats SET format_name = 'phone' WHERE format_name LIKE '%Phone%' OR format_name LIKE '%Téléphone%';
UPDATE messenger_validation_formats SET format_name = 'full_name' WHERE format_name LIKE '%Nom complet%';
UPDATE messenger_validation_formats SET format_name = 'date' WHERE format_name LIKE '%Date%';
UPDATE messenger_validation_formats SET format_name = 'number' WHERE format_name LIKE '%Nombre%';
UPDATE messenger_validation_formats SET format_name = 'text_free' WHERE format_name LIKE '%Texte libre%';
```

Puis redémarrer le serveur Next.js et pull le code avec les fichiers i18n mis à jour.
