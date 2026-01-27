#!/usr/bin/env python3
"""
Script pour compléter les traductions manquantes dans fr.json et en.json
"""
import json
import copy
from pathlib import Path

def get_nested_value(d, key_path):
    """Récupère une valeur nested dans un dict avec un chemin comme 'admin.common.save'"""
    keys = key_path.split('.')
    value = d
    for k in keys:
        if isinstance(value, dict) and k in value:
            value = value[k]
        else:
            return None
    return value

def set_nested_value(d, key_path, value):
    """Définit une valeur nested dans un dict"""
    keys = key_path.split('.')
    current = d
    for k in keys[:-1]:
        if k not in current:
            current[k] = {}
        current = current[k]
    current[keys[-1]] = value

def get_all_keys(d, prefix=''):
    """Extrait toutes les clés d'un dict nested"""
    keys = []
    for k, v in d.items():
        full_key = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            keys.extend(get_all_keys(v, full_key))
        else:
            keys.append(full_key)
    return keys

# Traductions manuelles (HE -> FR, EN)
MANUAL_TRANSLATIONS = {
    # Admin - Stats (le problème principal mentionné)
    'הכנסות לפי שעה': {'fr': 'Revenus par heure', 'en': 'Revenue per hour'},
    'שעה': {'fr': 'Heure', 'en': 'Hour'},
    'הכנסות': {'fr': 'Revenus', 'en': 'Revenue'},
    'סטטיסטיקות': {'fr': 'Statistiques', 'en': 'Statistics'},
    'סטטיסטיקות יומיות': {'fr': 'Statistiques quotidiennes', 'en': 'Daily statistics'},
