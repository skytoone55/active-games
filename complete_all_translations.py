#!/usr/bin/env python3
"""
Script pour compléter TOUTES les traductions manquantes
Analyse les 3 fichiers et génère les traductions manquantes pour chaque langue
"""
import json
from pathlib import Path

# Traductions complètes pour les sections les plus utilisées
TRANSLATIONS = {
    # Admin - Status colors
    'admin.status.pending': {'he': 'ממתין', 'fr': 'En attente', 'en': 'Pending'},
    'admin.status.auto_confirmed': {'he': 'מאושר אוטומטית', 'fr': 'Auto confirmé', 'en': 'Auto confirmed'},
    'admin.status.manually_confirmed': {'he': 'מאושר ידנית', 'fr': 'Confirmé manuellement', 'en': 'Manually confirmed'},
    'admin.status.cancelled': {'he': 'מבוטל', 'fr': 'Annulé', 'en': 'Cancelled'},
    'admin.status.closed': {'he': 'סגור', 'fr': 'Clôturé', 'en': 'Closed'},

    # Admin - Statistics tabs
    'admin.stats.tabs.overview': {'he': 'סקירה כללית', 'fr': "Vue d'ensemble", 'en': 'Overview'},
    'admin.stats.tabs.revenue': {'he': 'הכנסות', 'fr': "Chiffre d'affaires", 'en': 'Revenue'},
    'admin.stats.tabs.orders': {'he': 'הזמנות', 'fr': 'Commandes', 'en': 'Orders'},
    'admin.stats.tabs.clients': {'he': 'לקוחות', 'fr': 'Clients', 'en': 'Clients'},
    'admin.stats.tabs.team': {'he': 'צוות', 'fr': 'Équipe', 'en': 'Team'},

    # Admin - Common actions
    'admin.common.loading': {'he': 'טוען...', 'fr': 'Chargement...', 'en': 'Loading...'},
    'admin.common.saving': {'he': 'שומר...', 'fr': 'Enregistrement...', 'en': 'Saving...'},
    'admin.common.deleting': {'he': 'מוחק...', 'fr': 'Suppression...', 'en': 'Deleting...'},
    'admin.common.error': {'he': 'שגיאה', 'fr': 'Erreur', 'en': 'Error'},
    'admin.common.success': {'he': 'הצלחה', 'fr': 'Succès', 'en': 'Success'},
    'admin.common.confirm': {'he': 'אשר', 'fr': 'Confirmer', 'en': 'Confirm'},
    'admin.common.cancel': {'he': 'בטל', 'fr': 'Annuler', 'en': 'Cancel'},
    'admin.common.close': {'he': 'סגור', 'fr': 'Fermer', 'en': 'Close'},
    'admin.common.add': {'he': 'הוסף', 'fr': 'Ajouter', 'en': 'Add'},
    'admin.common.edit': {'he': 'ערוך', 'fr': 'Modifier', 'en': 'Edit'},
    'admin.common.delete': {'he': 'מחק', 'fr': 'Supprimer', 'en': 'Delete'},
    'admin.common.search': {'he': 'חיפוש', 'fr': 'Rechercher', 'en': 'Search'},
    'admin.common.filter': {'he': 'סנן', 'fr': 'Filtrer', 'en': 'Filter'},
    'admin.common.export': {'he': 'ייצא', 'fr': 'Exporter', 'en': 'Export'},
    'admin.common.import': {'he': 'ייבא', 'fr': 'Importer', 'en': 'Import'},
    'admin.common.refresh': {'he': 'רענן', 'fr': 'Actualiser', 'en': 'Refresh'},
    'admin.common.view': {'he': 'צפה', 'fr': 'Voir', 'en': 'View'},
    'admin.common.create': {'he': 'צור', 'fr': 'Créer', 'en': 'Create'},
    'admin.common.update': {'he': 'עדכן', 'fr': 'Mettre à jour', 'en': 'Update'},
    'admin.common.remove': {'he': 'הסר', 'fr': 'Retirer', 'en': 'Remove'},
    'admin.common.select': {'he': 'בחר', 'fr': 'Sélectionner', 'en': 'Select'},
    'admin.common.all': {'he': 'הכל', 'fr': 'Tous', 'en': 'All'},
    'admin.common.none': {'he': 'ללא', 'fr': 'Aucun', 'en': 'None'},
    'admin.common.yes': {'he': 'כן', 'fr': 'Oui', 'en': 'Yes'},
    'admin.common.no': {'he': 'לא', 'fr': 'Non', 'en': 'No'},
    'admin.common.name': {'he': 'שם', 'fr': 'Nom', 'en': 'Name'},
    'admin.common.email': {'he': 'אימייל', 'fr': 'Email', 'en': 'Email'},
    'admin.common.phone': {'he': 'טלפון', 'fr': 'Téléphone', 'en': 'Phone'},
    'admin.common.date': {'he': 'תאריך', 'fr': 'Date', 'en': 'Date'},
    'admin.common.time': {'he': 'שעה', 'fr': 'Heure', 'en': 'Time'},
    'admin.common.status': {'he': 'סטטוס', 'fr': 'Statut', 'en': 'Status'},
    'admin.common.action': {'he': 'פעולה', 'fr': 'Action', 'en': 'Action'},
    'admin.common.actions': {'he': 'פעולות', 'fr': 'Actions', 'en': 'Actions'},
    'admin.common.details': {'he': 'פרטים', 'fr': 'Détails', 'en': 'Details'},
    'admin.common.description': {'he': 'תיאור', 'fr': 'Description', 'en': 'Description'},
    'admin.common.notes': {'he': 'הערות', 'fr': 'Notes', 'en': 'Notes'},
    'admin.common.total': {'he': 'סה"כ', 'fr': 'Total', 'en': 'Total'},
    'admin.common.price': {'he': 'מחיר', 'fr': 'Prix', 'en': 'Price'},
    'admin.common.amount': {'he': 'סכום', 'fr': 'Montant', 'en': 'Amount'},
    'admin.common.quantity': {'he': 'כמות', 'fr': 'Quantité', 'en': 'Quantity'},
    'admin.common.discount': {'he': 'הנחה', 'fr': 'Remise', 'en': 'Discount'},
    'admin.common.subtotal': {'he': 'ביניים', 'fr': 'Sous-total', 'en': 'Subtotal'},

    # Admin - Users modal
    'admin.users.modal.first_name': {'he': 'שם פרטי', 'fr': 'Prénom', 'en': 'First name'},
    'admin.users.modal.last_name': {'he': 'שם משפחה', 'fr': 'Nom', 'en': 'Last name'},
    'admin.users.modal.email': {'he': 'אימייל', 'fr': 'Email', 'en': 'Email'},
    'admin.users.modal.phone': {'he': 'טלפון', 'fr': 'Téléphone', 'en': 'Phone'},
    'admin.users.modal.password': {'he': 'סיסמה', 'fr': 'Mot de passe', 'en': 'Password'},
    'admin.users.modal.password_placeholder': {'he': 'הזן סיסמה', 'fr': 'Entrer le mot de passe', 'en': 'Enter password'},
    'admin.users.modal.role': {'he': 'תפקיד', 'fr': 'Rôle', 'en': 'Role'},
    'admin.users.modal.branches': {'he': 'סניפים', 'fr': 'Agences', 'en': 'Branches'},
    'admin.users.modal.select_branches': {'he': 'בחר סניפים', 'fr': 'Sélectionner les agences', 'en': 'Select branches'},
    'admin.users.modal.temp_password': {'he': 'סיסמה זמנית', 'fr': 'Mot de passe temporaire', 'en': 'Temporary password'},
    'admin.users.modal.copy_password': {'he': 'העתק סיסמה', 'fr': 'Copier le mot de passe', 'en': 'Copy password'},
}

def set_nested_value(d, key_path, value):
    """Définit une valeur nested dans un dict"""
    keys = key_path.split('.')
    current = d
    for k in keys[:-1]:
        if k not in current:
            current[k] = {}
        current = current[k]
    current[keys[-1]] = value

# Charger les 3 fichiers
files = {}
for lang in ['he', 'fr', 'en']:
    with open(f'src/i18n/locales/{lang}.json', 'r', encoding='utf-8') as f:
        files[lang] = json.load(f)

# Ajouter les traductions manquantes
added_count = {}