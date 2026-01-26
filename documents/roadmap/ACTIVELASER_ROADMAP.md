# ACTIVELASER - ROADMAP DE DEVELOPPEMENT

> Document de suivi du projet CRM/Booking ActiveLaser
> Derniere mise a jour : 2026-01-18
> Branche de travail : `dev` (merge dans `main` apres stabilisation de chaque phase)

---

## RESUME DU PROJET

**Objectif** : Transformer le systeme de reservation ActiveLaser en un CRM complet avec :
- Tracabilite complete des actions (audit)
- Permissions granulaires par role
- Documents professionnels (PDF)
- Communication automatisee (emails)
- Confirmation client (signature electronique)
- Paiements en ligne et manuels (avec acomptes)
- Reporting et statistiques

---

## PHASES DE DEVELOPPEMENT

### PHASE 1 : FONDATIONS - Logs & Permissions
**Statut** : [ ] Non commence
**Estimation** : 2-3 semaines
**Priorite** : CRITIQUE

#### 1.1 Journal d'activite (Activity Logs)
- [ ] Creer table `activity_logs` dans Supabase
  ```sql
  - id UUID PRIMARY KEY
  - user_id UUID (qui a fait l'action)
  - entity_type TEXT (booking, contact, order, user, settings)
  - entity_id UUID (ID de l'entite modifiee)
  - action TEXT (create, update, delete, archive, confirm, cancel, restore)
  - old_data JSONB (donnees avant modification)
  - new_data JSONB (donnees apres modification)
  - ip_address TEXT
  - user_agent TEXT
  - branch_id UUID (contexte branche)
  - created_at TIMESTAMPTZ
  ```
- [ ] Creer hook/utilitaire `logActivity()` reutilisable
- [ ] Integrer logging dans useBookings (create, update, delete, cancel)
- [ ] Integrer logging dans useContacts (create, update, archive, restore)
- [ ] Integrer logging dans useOrders (create, update, cancel, delete)
- [ ] Integrer logging dans useUsers (create, update, delete)
- [ ] Creer page admin `/admin/logs` pour consulter les logs
  - Filtres : par utilisateur, par type d'entite, par action, par date
  - Pagination
  - Export CSV
- [ ] Ajouter politique de retention (configurable, defaut 1 an)
- [ ] Tests et validation

#### 1.2 Systeme de permissions granulaires
- [ ] Creer table `permissions`
  ```sql
  - id UUID PRIMARY KEY
  - code TEXT UNIQUE (ex: 'bookings.create', 'bookings.delete')
  - name TEXT (nom affiche)
  - description TEXT
  - category TEXT (bookings, contacts, orders, users, settings, logs)
  ```
- [ ] Creer table `role_permissions`
  ```sql
  - id UUID PRIMARY KEY
  - role TEXT (super_admin, branch_admin, agent)
  - permission_id UUID
  - branch_id UUID (NULL = toutes branches)
  - granted BOOLEAN
  - UNIQUE(role, permission_id, branch_id)
  ```
- [ ] Definir la liste des permissions :
  ```
  BOOKINGS:
  - bookings.read (voir les reservations)
  - bookings.create (creer une reservation)
  - bookings.update (modifier une reservation)
  - bookings.delete (supprimer une reservation)
  - bookings.cancel (annuler une reservation)
  - bookings.confirm (confirmer une reservation pending)

  CONTACTS:
  - contacts.read
  - contacts.create
  - contacts.update
  - contacts.archive
  - contacts.restore
  - contacts.delete_permanent (suppression definitive)

  ORDERS:
  - orders.read
  - orders.create
  - orders.update
  - orders.confirm
  - orders.cancel
  - orders.delete

  USERS:
  - users.read
  - users.create
  - users.update
  - users.delete
  - users.manage_permissions

  SETTINGS:
  - settings.read
  - settings.update
  - settings.branches.manage

  LOGS:
  - logs.read
  - logs.export

  REPORTS:
  - reports.read
  - reports.export
  ```
- [ ] Creer hook `usePermissions()` pour verifier les droits cote client
- [ ] Creer utilitaire `checkPermission()` pour les API routes
- [ ] Modifier `lib/permissions.ts` pour integrer le nouveau systeme
- [ ] Creer UI dans `/admin/users` pour gerer les permissions par utilisateur
- [ ] Ajouter permissions par defaut selon le role :
  - super_admin : TOUTES les permissions
  - branch_admin : tout sauf users.manage_permissions, settings.branches.manage
  - agent : read + create + update (pas delete/archive)
- [ ] Migrer les verifications existantes vers le nouveau systeme
- [ ] Tests et validation

#### 1.3 Migration et retrocompatibilite
- [ ] Script de migration pour initialiser les permissions par defaut
- [ ] Gerer les utilisateurs existants (leur donner les permissions de leur role)
- [ ] Verifier que rien ne casse pour les utilisateurs actuels

---

### PHASE 2 : DOCUMENTS & INFRASTRUCTURE EMAIL
**Statut** : [ ] Non commence
**Estimation** : 2-3 semaines
**Prerequis** : Phase 1 complete
**Priorite** : HAUTE

#### 2.1 Generation de documents PDF
- [ ] Installer @react-pdf/renderer
- [ ] Creer table `documents`
  ```sql
  - id UUID PRIMARY KEY
  - booking_id UUID (nullable)
  - order_id UUID (nullable)
  - contact_id UUID (nullable)
  - type TEXT (confirmation, invoice, quote, receipt)
  - filename TEXT
  - storage_path TEXT (chemin Supabase Storage)
  - metadata JSONB (infos additionnelles)
  - created_by UUID
  - created_at TIMESTAMPTZ
  ```
- [ ] Configurer Supabase Storage bucket `documents`
- [ ] Template PDF : Confirmation de reservation
  - Logo ActiveLaser
  - Informations client (nom, tel, email)
  - Details reservation (date, heure, type, nb personnes)
  - Details branche (adresse, telephone)
  - Conditions generales resumees
  - QR code unique (pour check-in rapide)
  - Numero de reference
- [ ] Template PDF : Devis evenement
  - Memes infos + details tarifs
  - Conditions d'annulation
  - Validite du devis
  - Zone signature client
- [ ] Template PDF : Facture/Recu
  - Infos legales (SIRET equivalent israelien)
  - Details des prestations
  - Montant HT/TVA/TTC
  - Statut paiement
  - Mentions legales
- [ ] API route pour generer PDF a la demande
- [ ] Bouton "Telecharger PDF" dans BookingModal
- [ ] Bouton "Telecharger PDF" dans OrderDetailModal
- [ ] Stockage automatique des PDF generes
- [ ] Tests et validation

#### 2.2 Infrastructure Email
- [ ] Creer compte Resend (ou SendGrid)
- [ ] Configurer domaine activegames.co.il (SPF, DKIM, DMARC)
- [ ] Creer table `email_logs`
  ```sql
  - id UUID PRIMARY KEY
  - recipient_email TEXT
  - recipient_name TEXT
  - template TEXT (booking_confirmation, reminder_24h, cancellation, etc.)
  - subject TEXT
  - body_preview TEXT (premiers 200 chars)
  - entity_type TEXT
  - entity_id UUID
  - attachments JSONB (liste des fichiers joints)
  - status TEXT (pending, queued, sent, delivered, opened, bounced, failed)
  - provider_id TEXT (ID Resend/SendGrid)
  - error_message TEXT
  - metadata JSONB
  - scheduled_for TIMESTAMPTZ (pour envois programmes)
  - sent_at TIMESTAMPTZ
  - delivered_at TIMESTAMPTZ
  - opened_at TIMESTAMPTZ
  - created_at TIMESTAMPTZ
  ```
- [ ] Creer utilitaire `sendEmail()` avec queue
- [ ] Templates email HTML responsive :
  - Template de base (header logo, footer contact)
  - Confirmation de reservation
  - Rappel J-1
  - Annulation
  - Modification de reservation
  - Bienvenue nouveau client
- [ ] Gestion des pieces jointes (PDF)
- [ ] Webhook Resend pour tracking (delivered, opened, bounced)
- [ ] Page admin `/admin/emails` pour voir l'historique des envois
- [ ] Tests et validation (mode sandbox)

---

### PHASE 3 : COMMUNICATION AUTOMATISEE
**Statut** : [ ] Non commence
**Estimation** : 2-3 semaines
**Prerequis** : Phase 2 complete
**Priorite** : HAUTE

#### 3.1 Emails automatiques
- [ ] Creer table `email_templates`
  ```sql
  - id UUID PRIMARY KEY
  - code TEXT UNIQUE (confirmation, reminder_24h, etc.)
  - name TEXT
  - subject_template TEXT (avec variables {{client_name}}, etc.)
  - body_template TEXT (HTML avec variables)
  - attachments TEXT[] (types de PDF a joindre)
  - is_active BOOLEAN
  - branch_id UUID (NULL = global)
  - created_at, updated_at
  ```
- [ ] Creer table `email_schedules` (pour les rappels programmes)
  ```sql
  - id UUID PRIMARY KEY
  - email_log_id UUID
  - booking_id UUID
  - trigger_type TEXT (immediate, before_booking, after_booking)
  - trigger_offset_hours INTEGER (ex: -24 pour J-1)
  - scheduled_for TIMESTAMPTZ
  - status TEXT (pending, sent, cancelled)
  - created_at
  ```
- [ ] Email automatique : Confirmation immediate
  - Declencheur : nouvelle reservation confirmee
  - Contenu : details + PDF confirmation
  - Pour : reservations admin ET commandes en ligne
- [ ] Email automatique : Rappel J-1
  - Declencheur : CRON job quotidien
  - Contenu : rappel + instructions arrivee
  - Configurable par branche (actif/inactif)
- [ ] Email automatique : Annulation
  - Declencheur : reservation annulee
  - Contenu : confirmation annulation + politique remboursement
- [ ] Email automatique : Modification
  - Declencheur : reservation modifiee (date, heure, nb personnes)
  - Contenu : nouveau recapitulatif
- [ ] Email automatique : Relance commande pending
  - Declencheur : commande pending > 2h sans action
  - Contenu : "Votre demande est en cours de traitement"
- [ ] Interface admin pour activer/desactiver les emails par type
- [ ] Interface admin pour personnaliser les templates
- [ ] Tests et validation

#### 3.2 Lien de confirmation client (signature electronique)
- [ ] Creer table `confirmation_tokens`
  ```sql
  - id UUID PRIMARY KEY
  - order_id UUID UNIQUE
  - booking_id UUID
  - token TEXT UNIQUE (32 chars aleatoires)
  - expires_at TIMESTAMPTZ (7 jours par defaut)
  - confirmed_at TIMESTAMPTZ
  - confirmed_ip TEXT
  - confirmed_user_agent TEXT
  - terms_accepted BOOLEAN
  - created_at TIMESTAMPTZ
  ```
- [ ] Generer token unique a la creation de commande/reservation
- [ ] Page publique `/confirm/[token]`
  - Affichage recapitulatif reservation (lecture seule)
  - Conditions generales completes (scrollable)
  - Checkbox "J'ai lu et j'accepte les conditions"
  - Bouton "Confirmer ma reservation"
  - Message de succes apres confirmation
  - Gestion token expire/invalide
- [ ] Mise a jour automatique du statut :
  - Order : pending -> client_confirmed (nouveau statut)
  - Booking : ajouter champ `client_confirmed_at`
- [ ] Email avec lien de confirmation inclus
- [ ] Notification admin quand client confirme
- [ ] Historique des confirmations dans les logs
- [ ] Tests et validation

---

### PHASE 4 : PAIEMENTS
**Statut** : [ ] Non commence
**Estimation** : 3-4 semaines
**Prerequis** : Phase 3 complete
**Priorite** : MOYENNE-HAUTE

#### 4.1 Infrastructure paiement
- [ ] Creer compte Stripe (mode test)
- [ ] Configurer webhooks Stripe
- [ ] Creer table `payments`
  ```sql
  - id UUID PRIMARY KEY
  - booking_id UUID
  - order_id UUID
  - contact_id UUID
  - amount DECIMAL(10,2)
  - currency TEXT DEFAULT 'ILS'
  - type TEXT (full, deposit, balance, refund)
  - method TEXT (stripe, cash, card_terminal, check, transfer)
  - status TEXT (pending, processing, completed, failed, refunded, partially_refunded)
  - stripe_payment_intent_id TEXT
  - stripe_charge_id TEXT
  - stripe_refund_id TEXT
  - reference TEXT (numero de transaction interne)
  - notes TEXT
  - metadata JSONB
  - processed_by UUID (pour paiements manuels)
  - processed_at TIMESTAMPTZ
  - created_at TIMESTAMPTZ
  - updated_at TIMESTAMPTZ
  ```
- [ ] Creer table `payment_settings` (par branche)
  ```sql
  - branch_id UUID PRIMARY KEY
  - deposit_required BOOLEAN
  - deposit_percentage INTEGER (ex: 30)
  - deposit_fixed_amount DECIMAL (alternative au %)
  - full_payment_required_for_games BOOLEAN
  - payment_methods_enabled TEXT[] (stripe, cash, etc.)
  - stripe_account_id TEXT (si comptes separes par branche)
  - created_at, updated_at
  ```
- [ ] Definir regles de calcul acompte :
  - GAME simple : paiement complet OU gratuit (selon config)
  - EVENT : acompte 30% a la reservation, solde jour J
  - Configurable par branche

#### 4.2 Paiement en ligne (Stripe)
- [ ] Integration Stripe Checkout ou Payment Elements
- [ ] Flow de paiement pour commandes en ligne :
  1. Client remplit formulaire reservation
  2. Calcul du montant (total ou acompte)
  3. Redirection Stripe Checkout
  4. Webhook payment_intent.succeeded
  5. Creation reservation + email confirmation
- [ ] Flow de paiement pour solde (apres acompte) :
  - Email avec lien de paiement du solde
  - Page `/pay/[token]` pour payer le reste
- [ ] Gestion des echecs de paiement
- [ ] Gestion des remboursements (admin)
- [ ] Tests en mode sandbox

#### 4.3 Paiement manuel (caisse)
- [ ] Interface admin pour enregistrer un paiement
  - Depuis BookingModal : bouton "Enregistrer paiement"
  - Choix methode : especes, CB terminal, cheque, virement
  - Montant (total, partiel, acompte)
  - Notes/reference
- [ ] Calcul automatique du solde restant
- [ ] Historique des paiements par reservation
- [ ] Historique des paiements par client
- [ ] Alerte si reservation non payee a J-1
- [ ] Rapport de caisse journalier

#### 4.4 Factures et recus
- [ ] Generation automatique de recu apres paiement
- [ ] Generation de facture sur demande
- [ ] Numerotation sequentielle des factures (legal)
- [ ] Export comptable (CSV)

---

### PHASE 5 : REPORTING & DASHBOARD
**Statut** : [ ] Non commence
**Estimation** : 2 semaines
**Prerequis** : Phase 4 complete
**Priorite** : MOYENNE

#### 5.1 Dashboard statistiques
- [ ] Nouvelle page `/admin/dashboard` (ou enrichir page existante)
- [ ] Widgets :
  - CA du jour / semaine / mois
  - Nombre de reservations par periode
  - Taux de remplissage par creneau
  - Repartition GAME vs EVENT
  - Top 10 clients (CA, frequence)
  - Reservations a venir (aujourd'hui, demain)
  - Commandes pending a traiter
- [ ] Graphiques :
  - Evolution CA sur 12 mois
  - Comparaison N vs N-1
  - Repartition par jour de semaine
  - Heures de pointe
- [ ] Filtres : par branche, par periode

#### 5.2 Exports et rapports
- [ ] Export reservations (CSV/Excel)
- [ ] Export clients (CSV/Excel)
- [ ] Export paiements (CSV/Excel)
- [ ] Rapport de TVA mensuel
- [ ] Rapport de caisse (par jour, par branche)
- [ ] Envoi automatique rapport hebdo par email (optionnel)

---

## NOTES TECHNIQUES

### Stack technique
- **Frontend** : Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend** : Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Emails** : Resend (recommande) ou SendGrid
- **PDF** : @react-pdf/renderer
- **Paiements** : Stripe
- **Deploiement** : Vercel

### Conventions
- Toutes les dates en UTC dans la DB, conversion Israel cote client
- Montants en ILS (shekel israelien)
- Logs en JSON pour faciliter la recherche
- Soft delete privilegie (archived_at) sauf logs

### Securite
- Verifier permissions a CHAQUE action (API + client)
- Logger TOUTES les actions sensibles
- Tokens de confirmation expires apres 7 jours
- Webhooks Stripe signes et verifies
- Pas de donnees sensibles dans les URLs

---

## SUIVI DES SPRINTS

### Sprint actuel : -
**Objectif** : -
**Debut** : -
**Fin prevue** : -

### Historique
| Sprint | Phase | Dates | Statut |
|--------|-------|-------|--------|
| - | - | - | - |

---

## DECISIONS PRISES

| Question | Decision | Date |
|----------|----------|------|
| Retention des logs | **1 an** (avec possibilite d'export/backup avant suppression) | 2026-01-18 |
| Acompte | **Configurable par branche** : pourcentage OU montant fixe (ex: 500 ILS) | 2026-01-18 |
| Paiement | **Compte separe par branche** + recherche solution adaptee Israel | 2026-01-18 |

---

## QUESTIONS OUVERTES

1. ~~Politique de retention des logs~~ → **RESOLU : 1 an**
2. **Emails** : Resend ou SendGrid ? (Resend recommande - plus simple)
3. ~~Acompte~~ → **RESOLU : configurable par branche (% ou fixe)**
4. ~~Stripe~~ → **RESOLU : compte separe par branche**
5. **Templates email** : Qui redige le contenu final ? (textes marketing)
6. **Solution paiement Israel** : Alternatives a Stripe pour Israel ?
   - Options a explorer : PayPlus, Tranzila, CardCom, Meshulam, iCredit
   - Criteres : cout, facilite integration, support ILS, API moderne

---

## CHANGELOG

### 2026-01-18
- Creation du document de roadmap
- Definition des 5 phases principales
- Reorganisation : Phase 2 (PDF) avant Phase 3 (Emails automatiques)
- Detail des tables SQL necessaires
- Liste des permissions granulaires
- **DECISIONS** : retention logs 1 an, acompte configurable par branche, comptes paiement separes

---

*Document maintenu par Claude & Jeremy*
