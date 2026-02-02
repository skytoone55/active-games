#!/bin/bash

# Configuration
DB_HOST="db.zapwlcrjnabrfhoxfgqo.supabase.co"
DB_PORT="6543"
DB_USER="postgres"
DB_NAME="postgres"
DB_PASSWORD="Activegames20000"
BACKUP_DIR="$HOME/Desktop/claude/activelaser/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Créer le dossier si nécessaire
mkdir -p $BACKUP_DIR

# Export avec pg_dump
PGPASSWORD="$DB_PASSWORD" /opt/homebrew/opt/libpq/bin/pg_dump \
  -h $DB_HOST \
  -p $DB_PORT \
  -U $DB_USER \
  -d $DB_NAME \
  --clean \
  --if-exists \
  -f $BACKUP_DIR/backup_$DATE.sql

# Vérifier si le backup a réussi
if [ $? -eq 0 ]; then
  echo "✅ Backup créé avec succès: backup_$DATE.sql"

  # Garder seulement les 30 derniers backups
  cd $BACKUP_DIR
  ls -t backup_*.sql | tail -n +31 | xargs rm -f 2>/dev/null

  echo "📦 Nombre de backups conservés: $(ls -1 backup_*.sql 2>/dev/null | wc -l | tr -d ' ')"
else
  echo "❌ Erreur lors du backup"
  exit 1
fi
