# Backups Supabase - Base de données ActiveLaser

## Fichiers disponibles

### 📦 `backup_REFERENCE_2026-02-04_19-30.sql`
- **Date**: 4 février 2026, 19h30
- **Description**: Backup de référence avec configuration messenger complète et fonctionnelle en local
- **Taille**: 1.4 MB
- **Contenu**: Structure complète + données incluant modules messenger, workflows, validation formats

### 📦 `backup_CURRENT_2026-02-07_16-50.sql`
- **Date**: 7 février 2026, 16h50
- **Description**: Backup actuel avec système i18n pour les formats de validation
- **Taille**: 1.6 MB
- **Contenu**: Structure complète + données avec traductions multilingues (FR/EN/HE) pour les formats
- **Nouveautés**:
  - Format de validation "prenom_simple" (prénom sans nom obligatoire)
  - Système i18n pour les noms de formats
  - Traductions complètes FR/EN/HE

## 🔄 Comment restaurer un backup

### Méthode 1: Via Supabase Dashboard (Recommandé)
1. Aller sur https://supabase.com/dashboard/project/zapwlcrjnabrfhoxfgqo
2. SQL Editor
3. Copier/coller le contenu du fichier .sql
4. Exécuter

### Méthode 2: Via ligne de commande
```bash
# Se connecter à la base
psql "postgresql://postgres:Activegames20000@db.zapwlcrjnabrfhoxfgqo.supabase.co:6543/postgres"

# Ou restaurer directement depuis le fichier
PGPASSWORD="Activegames20000" psql \
  -h db.zapwlcrjnabrfhoxfgqo.supabase.co \
  -p 6543 \
  -U postgres \
  -d postgres \
  -f backup_CURRENT_2026-02-07_16-50.sql
```

### Méthode 3: Via script automatique
```bash
# Utiliser le script de backup
cd /Users/jeremy/Desktop/claude/activelaser
./scripts/backup-supabase.sh
```

## 🆕 Créer un nouveau backup

### Via script shell (le plus simple)
```bash
cd /Users/jeremy/Desktop/claude/activelaser
./scripts/backup-supabase.sh
```

### Via commande manuelle
```bash
DATE=$(date +%Y-%m-%d_%H-%M)
PGPASSWORD="Activegames20000" /opt/homebrew/opt/libpq/bin/pg_dump \
  -h db.zapwlcrjnabrfhoxfgqo.supabase.co \
  -p 6543 \
  -U postgres \
  -d postgres \
  --clean \
  --if-exists \
  -f "supabase/backups/backup_${DATE}.sql"
```

## ⚠️ IMPORTANT - Avant de restaurer

1. **Sauvegarder la base actuelle** avant toute restauration
2. Les fichiers .sql contiennent `DROP` et `CREATE` statements - ils vont **écraser** la base existante
3. Les backups incluent toutes les tables, policies, functions, triggers, etc.
4. Vérifier que les variables d'environnement sont correctes après restauration

## 📋 Contenu des backups

Les backups incluent:
- ✅ Structure complète des tables
- ✅ Toutes les données (users, orders, messenger, etc.)
- ✅ Row Level Security (RLS) policies
- ✅ Functions et triggers PostgreSQL
- ✅ Indexes et constraints
- ✅ Storage buckets configuration

## 🔍 Vérifier un backup

```bash
# Compter les lignes
wc -l backup_CURRENT_2026-02-07_16-50.sql

# Vérifier la présence d'une table spécifique
grep "messenger_validation_formats" backup_CURRENT_2026-02-07_16-50.sql

# Voir les données d'une table
grep -A 50 "COPY public.messenger_validation_formats" backup_CURRENT_2026-02-07_16-50.sql
```

## 📁 Stockage

Les backups sont stockés dans deux emplacements:
1. **Projet local**: `/Users/jeremy/Desktop/claude/activelaser/supabase/backups/`
2. **Référence externe**: `/Users/jeremy/Desktop/claude/data/supabase/`

## 🔐 Sécurité

⚠️ Les fichiers de backup contiennent des données sensibles:
- Mots de passe hashés
- Emails clients
- Informations de paiement
- Configuration système

**NE PAS** commiter ces fichiers dans Git (déjà dans .gitignore)
