/**
 * Documentation complète de la base de données Supabase pour Clara
 * Ce fichier sert de "carte" pour que Clara puisse naviguer dans la base de données
 */

export const SUPABASE_SCHEMA_DOCUMENTATION = `
# CARTE DE LA BASE DE DONNÉES SUPABASE - ACTIVELASER

## 🏢 STRUCTURE MULTI-BRANCHES

L'application gère plusieurs branches (agences) d'un centre de jeux.
Chaque branche a ses propres réglages, salles, tarifs et équipes.

---

## 📋 TABLES PRINCIPALES

### 1. BRANCHES (branches)
Centre de jeux/agence. Toutes les données sont liées à une branche.
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID unique |
| slug | string | Identifiant court (ex: "tel-aviv") |
| name | string | Nom de la branche |
| address | string | Adresse physique |
| phone | string | Téléphone |
| timezone | string | Fuseau horaire |
| is_active | boolean | Branche active ou non |

### 2. BRANCH_SETTINGS (branch_settings)
Configuration détaillée de chaque branche.
| Colonne | Type | Description |
|---------|------|-------------|
| branch_id | uuid | FK vers branches |
| max_concurrent_players | int | Joueurs max simultanés |
| slot_duration_minutes | int | Durée d'un créneau |
| game_duration_minutes | int | Durée d'une partie |
| laser_total_vests | int | Nombre total de gilets laser |
| laser_enabled | boolean | Laser game activé |
| opening_hours | json | Horaires d'ouverture |

---

## 👤 UTILISATEURS & PERMISSIONS

### 3. PROFILES (profiles)
Utilisateurs de l'application (staff).
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID (même que auth.users) |
| first_name | string | Prénom |
| last_name | string | Nom |
| phone | string | Téléphone |
| role | string | Rôle (super_admin, branch_admin, agent) |
| role_id | uuid | FK vers roles |

### 4. ROLES (roles)
Définition des rôles avec hiérarchie.
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID unique |
| name | string | Slug (ex: "branch_admin") |
| display_name | string | Nom affiché |
| level | int | Niveau hiérarchique (1=plus haut) |
| is_system | boolean | Rôle système non modifiable |

### 5. USER_BRANCHES (user_branches)
Association utilisateurs ↔ branches.
| Colonne | Type | Description |
|---------|------|-------------|
| user_id | uuid | FK vers profiles |
| branch_id | uuid | FK vers branches |

### 6. ROLE_PERMISSIONS (role_permissions)
Permissions par rôle et ressource.
| Colonne | Type | Description |
|---------|------|-------------|
| role_id | uuid | FK vers roles |
| resource | string | agenda, orders, clients, users, logs, settings |
| can_view | boolean | Peut voir |
| can_create | boolean | Peut créer |
| can_edit | boolean | Peut modifier |
| can_delete | boolean | Peut supprimer |

---

## 📦 COMMANDES & RÉSERVATIONS

### 7. ORDERS (orders)
Commandes en ligne (demandes de réservation).
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID unique |
| branch_id | uuid | FK vers branches |
| request_reference | string | Référence unique (ex: "ORD-2024-001") |
| order_type | string | GAME ou EVENT |
| status | string | pending, auto_confirmed, manually_confirmed, cancelled, closed |
| customer_first_name | string | Prénom client |
| customer_last_name | string | Nom client |
| customer_phone | string | Téléphone |
| customer_email | string | Email |
| requested_date | date | Date demandée |
| requested_time | time | Heure demandée |
| participants_count | int | Nombre de participants |
| game_area | string | ACTIVE, LASER, MIX, CUSTOM |
| total_amount | decimal | Montant total calculé |
| paid_amount | decimal | Montant payé |
| payment_status | string | unpaid, deposit_paid, fully_paid |
| booking_id | uuid | FK vers bookings (si confirmée) |
| contact_id | uuid | FK vers contacts |
| terms_accepted | boolean | CGV acceptées |
| cgv_validated_at | timestamp | Date validation CGV |
| processed_by | uuid | Traité par (user_id) |
| created_at | timestamp | Date création |

**STATUTS ORDER:**
- pending: En attente de traitement
- auto_confirmed: Confirmée automatiquement
- manually_confirmed: Confirmée manuellement
- cancelled: Annulée
- closed: Terminée/Clôturée

### 8. BOOKINGS (bookings)
Réservations confirmées dans l'agenda.
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID unique |
| branch_id | uuid | FK vers branches |
| type | string | GAME ou EVENT |
| status | string | DRAFT, CONFIRMED, CANCELLED |
| reference_code | string | Code référence |
| start_datetime | timestamp | Début réservation |
| end_datetime | timestamp | Fin réservation |
| participants_count | int | Nombre participants |
| event_room_id | uuid | FK vers event_rooms |
| customer_first_name | string | Prénom |
| customer_last_name | string | Nom |
| customer_phone | string | Téléphone |
| customer_email | string | Email |
| total_price | decimal | Prix total |
| discount_type | string | percent ou fixed |
| discount_value | decimal | Valeur réduction |
| primary_contact_id | uuid | FK vers contacts |
| icount_offer_id | int | ID devis iCount |

### 9. GAME_SESSIONS (game_sessions)
Sessions de jeu dans une réservation.
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID unique |
| booking_id | uuid | FK vers bookings |
| game_area | string | ACTIVE, LASER, MIX |
| start_datetime | timestamp | Début session |
| end_datetime | timestamp | Fin session |
| laser_room_id | uuid | FK vers laser_rooms |
| session_order | int | Ordre de la session |

### 10. BOOKING_SLOTS (booking_slots)
Créneaux réservés pour vérifier la disponibilité.
| Colonne | Type | Description |
|---------|------|-------------|
| booking_id | uuid | FK vers bookings |
| branch_id | uuid | FK vers branches |
| slot_start | timestamp | Début créneau |
| slot_end | timestamp | Fin créneau |
| participants_count | int | Participants |
| slot_type | string | Type de créneau |

---

## 👥 CONTACTS & CLIENTS

### 11. CONTACTS (contacts)
Base de données clients.
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID unique |
| branch_id_main | uuid | Branche principale |
| first_name | string | Prénom |
| last_name | string | Nom |
| phone | string | Téléphone (unique) |
| email | string | Email |
| client_type | string | individual ou company |
| company_name | string | Nom entreprise |
| status | string | active ou archived |
| source | string | admin_agenda, public_booking, website |
| icount_client_id | int | ID client iCount |
| notes_client | string | Notes |

### 12. BOOKING_CONTACTS (booking_contacts)
Lien réservation ↔ contacts.
| Colonne | Type | Description |
|---------|------|-------------|
| booking_id | uuid | FK vers bookings |
| contact_id | uuid | FK vers contacts |
| is_primary | boolean | Contact principal |

---

## 🏠 SALLES

### 13. EVENT_ROOMS (event_rooms)
Salles d'événements/anniversaires.
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID unique |
| branch_id | uuid | FK vers branches |
| slug | string | Identifiant |
| name | string | Nom de la salle |
| capacity | int | Capacité max |
| is_active | boolean | Active |

### 14. LASER_ROOMS (laser_rooms)
Arènes laser game.
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID unique |
| branch_id | uuid | FK vers branches |
| slug | string | Identifiant |
| name | string | Nom |
| capacity | int | Capacité |

---

## 💰 TARIFICATION (iCount)

### 15. ICOUNT_PRODUCTS (icount_products)
Produits/tarifs synchronisés avec iCount.
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID unique |
| branch_id | uuid | FK vers branches |
| code | string | Code produit |
| name | string | Nom |
| unit_price | decimal | Prix unitaire |
| price_type | string | per_person, flat, per_game |
| category | string | game, room, event_tariff, other |
| is_active | boolean | Actif |

### 16. ICOUNT_EVENT_FORMULAS (icount_event_formulas)
Formules événements avec tarifs par tranche.
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID unique |
| branch_id | uuid | FK vers branches |
| name | string | Nom formule |
| game_type | string | LASER, ACTIVE, BOTH |
| min_participants | int | Participants min |
| max_participants | int | Participants max |
| price_per_person | decimal | Prix/personne |
| room_id | uuid | Salle associée |

### 17. ICOUNT_ROOMS (icount_rooms)
Prix des salles pour facturation.
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID unique |
| branch_id | uuid | FK vers branches |
| name | string | Nom |
| price | decimal | Prix |

---

## 💳 PAIEMENTS

### 18. PAYMENTS (payments)
Enregistrement des paiements.
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID unique |
| order_id | uuid | FK vers orders |
| booking_id | uuid | FK vers bookings |
| contact_id | uuid | FK vers contacts |
| branch_id | uuid | FK vers branches |
| amount | decimal | Montant |
| currency | string | Devise (ILS) |
| payment_type | string | full, deposit, balance, refund |
| payment_method | string | card, cash, transfer, check |
| status | string | Statut paiement |
| icount_transaction_id | string | ID transaction iCount |

### 19. PAYMENT_CREDENTIALS (payment_credentials)
Configuration paiement par branche.
| Colonne | Type | Description |
|---------|------|-------------|
| branch_id | uuid | FK vers branches |
| provider | string | Fournisseur (icount) |
| credentials | json | Identifiants chiffrés |

---

## 📧 EMAILS

### 20. EMAIL_TEMPLATES (email_templates)
Templates d'emails.
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID unique |
| code | string | Code unique (ex: "booking_confirmation") |
| name | string | Nom |
| subject_template | string | Sujet avec variables |
| body_template | string | Corps HTML |
| is_system | boolean | Template système |
| branch_id | uuid | FK vers branches (null = global) |

### 21. EMAIL_LOGS (email_logs)
Historique des emails envoyés.
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID unique |
| recipient_email | string | Email destinataire |
| subject | string | Sujet |
| status | string | pending, sent, delivered, failed |
| entity_type | string | booking, order, contact |
| entity_id | uuid | ID de l'entité |
| template_code | string | Code template utilisé |

---

## 📊 LOGS & ACTIVITÉ

### 22. ACTIVITY_LOGS (activity_logs)
Journal d'activité des utilisateurs.
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID unique |
| user_id | uuid | FK vers profiles |
| user_name | string | Nom utilisateur |
| user_role | string | Rôle au moment de l'action |
| action_type | string | Type action (voir ci-dessous) |
| target_type | string | booking, order, contact, user, etc. |
| target_id | uuid | ID cible |
| target_name | string | Nom cible |
| branch_id | uuid | FK vers branches |
| details | json | Détails supplémentaires |
| ip_address | string | IP |
| created_at | timestamp | Date |

**TYPES D'ACTIONS:**
- booking_created, booking_updated, booking_cancelled, booking_deleted
- order_created, order_updated, order_confirmed, order_cancelled
- contact_created, contact_updated, contact_archived
- user_created, user_updated, user_login
- settings_updated, permission_changed

---

## 🤖 CONVERSATIONS IA

### 23. AI_CONVERSATIONS (ai_conversations)
Conversations avec Clara.
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID unique |
| user_id | uuid | FK vers profiles |
| branch_id | uuid | FK vers branches |
| is_active | boolean | Conversation active |
| created_at | timestamp | Création |
| updated_at | timestamp | Dernière mise à jour |

### 24. AI_MESSAGES (ai_messages)
Messages dans les conversations.
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | ID unique |
| conversation_id | uuid | FK vers ai_conversations |
| role | string | user ou assistant |
| content | string | Contenu du message |
| metadata | json | Données supplémentaires |
| created_at | timestamp | Date |

---

## 🔗 RELATIONS CLÉS

\`\`\`
branches
├── branch_settings (1:1)
├── event_rooms (1:N)
├── laser_rooms (1:N)
├── icount_products (1:N)
├── icount_event_formulas (1:N)
├── orders (1:N)
├── bookings (1:N)
└── contacts (1:N via branch_id_main)

orders
├── → branches
├── → contacts
├── → bookings (après confirmation)
└── payments (1:N)

bookings
├── → branches
├── → event_rooms
├── game_sessions (1:N)
├── booking_slots (1:N)
├── booking_contacts (N:N avec contacts)
└── payments (1:N)

profiles
├── user_branches (N:N avec branches)
├── → roles
└── activity_logs (1:N)
\`\`\`

---

## 📈 REQUÊTES UTILES POUR STATISTIQUES

### CA du mois
\`\`\`sql
SELECT SUM(total_amount) as ca_total, SUM(paid_amount) as ca_encaisse
FROM orders
WHERE created_at >= date_trunc('month', now())
AND status NOT IN ('cancelled')
\`\`\`

### Commandes par statut
\`\`\`sql
SELECT status, COUNT(*) as count
FROM orders
WHERE created_at >= date_trunc('month', now())
GROUP BY status
\`\`\`

### Clients actifs ce mois
\`\`\`sql
SELECT COUNT(DISTINCT contact_id) as clients_actifs
FROM orders
WHERE created_at >= date_trunc('month', now())
\`\`\`

### Réservations par type
\`\`\`sql
SELECT order_type, COUNT(*) as count, SUM(total_amount) as ca
FROM orders
WHERE status NOT IN ('cancelled')
GROUP BY order_type
\`\`\`

---

## ⚠️ POINTS D'ATTENTION

1. **total_amount sur orders**: Calculé automatiquement via price-calculator
2. **payment_status vs paid_amount**: Vérifier la cohérence
3. **Commandes pending +7j**: Signaler les commandes non traitées
4. **Commandes payées non fermées**: Proposer de les clôturer
5. **CGV non validées**: Suivre cgv_validated_at
`

/**
 * Résumé court pour le system prompt de Clara
 */
export const CLARA_SCHEMA_SUMMARY = `
Tu as accès à ces tables Supabase:

COMMANDES: orders (statuts: pending/confirmed/cancelled/closed, payment_status: unpaid/deposit_paid/fully_paid)
RÉSERVATIONS: bookings, game_sessions, booking_slots
CLIENTS: contacts, booking_contacts
BRANCHES: branches, branch_settings
SALLES: event_rooms, laser_rooms
TARIFS: icount_products, icount_event_formulas, icount_rooms
PAIEMENTS: payments
UTILISATEURS: profiles, roles, user_branches, role_permissions
LOGS: activity_logs, email_logs
EMAILS: email_templates

Colonnes clés orders: id, request_reference, total_amount, paid_amount, payment_status, status, order_type, customer_first_name, customer_phone, created_at
Colonnes clés bookings: id, reference_code, type, status, start_datetime, participants_count, total_price, customer_first_name
Colonnes clés contacts: id, first_name, last_name, phone, email, client_type, company_name
`
