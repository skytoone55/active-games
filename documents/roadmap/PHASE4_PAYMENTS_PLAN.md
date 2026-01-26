# PHASE 4 : SYSTEME DE PAIEMENTS & INTEGRATION iCOUNT

> Document detaille pour l'implementation de la Phase 4
> Date de creation : 2026-01-19
> Derniere mise a jour : 2026-01-19
> Auteurs : Jeremy & Claude

---

## DECISIONS CLES (V1)

| Decision | Choix |
|----------|-------|
| Paiement en ligne | **Redirection** (hosted payment page iCount) |
| Paiement telephone | **V1** (saisie carte back-office) |
| Garantie carte | **V1** (pre-autorisation J5) |
| Multi-contacts / split | **Hors scope V1** |
| Paiement differe | **Hors scope V1** |
| Annulation / Refund | **Manuel uniquement** (pas d'automatisation V1) |
| Facture | **Apres paiement confirme** via iCount |
| Comptes iCount | **Un compte par branche** (comptabilites separees) |
| Produits | **Par branche** (autonomie totale) |
| Architecture | **Provider-agnostic** (ActiveLaser = source de verite) |

---

## CREDENTIALS iCOUNT (PRODUCTION - Rishon LeZion)

```
user: rishonlezion
cid: rishonlaser
pass: LASER2025.
```

**Test** : Creer un compte separe sur https://www.icount.co.il/ pour les tests.

---

## RESUME EXECUTIF

**Objectif** : Unifier la gestion des paiements dans ActiveLaser en integrant l'API iCount, eliminer la double saisie entre l'agenda et la comptabilite.

**Principe cle** :
- **ActiveLaser** = source de verite unique (clients, produits, paiements, factures)
- **iCount** = provider de paiement/facturation (interchangeable demain)
- **Caisse physique** = facture ce qu'elle encaisse sur place
- **Chaque branche** = 100% autonome (son compte iCount, ses produits, ses prix)

**Architecture provider-agnostic** : Toute la data est stockee dans ActiveLaser. iCount (ou un autre provider demain) recoit les infos et execute les operations. On peut changer de provider sans perdre de donnees.

---

## ARCHITECTURE GLOBALE

```
┌─────────────────────────────────────────────────────────────────┐
│                        ACTIVELASER                               │
│                 (Source de verite unique)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   CLIENTS    │  │   PRODUITS   │  │  PAIEMENTS   │           │
│  │  (contacts)  │  │ (par branch) │  │  (tous)      │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                 │                    │
│         ▼                 ▼                 ▼                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              PROVIDER ABSTRACTION LAYER                  │    │
│  │                  (lib/payment-provider/)                 │    │
│  │                                                          │    │
│  │  Interface:                                              │    │
│  │  - syncClient()                                          │    │
│  │  - syncProduct()                                         │    │
│  │  - chargeCard()                                          │    │
│  │  - preAuthorize()                                        │    │
│  │  - generatePaymentLink()                                 │    │
│  │  - createInvoice()                                       │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                              ▼
                 ┌────────────────────────┐
                 │   iCount Provider      │
                 │   (lib/icount/)        │
                 │                        │
                 │  Aujourd'hui: iCount   │
                 │  Demain: autre ou      │
                 │  solution interne      │
                 └────────────────────────┘
```

---

## SCENARIOS UTILISATEUR (V1)

### Scenario 1 : Client reserve et paie en ligne

1. Client reserve sur le site web
2. Selon `deposit_mode` de la branche : montant calcule (full/fixed/percent)
3. Redirection vers page de paiement iCount
4. Client paie
5. iCount notifie ActiveLaser via webhook (ipn_url)
6. ActiveLaser stocke le paiement + met a jour le statut
7. Facture generee par iCount, reference stockee dans ActiveLaser
8. Email de confirmation envoye au client

### Scenario 2 : Prise de carte par telephone

1. Client appelle ou ecrit sur WhatsApp
2. Employe cree la reservation dans ActiveLaser
3. Employe ouvre le modal "Paiement"
4. Il saisit la carte (numero, expiration, CVV)
5. Il choisit : **Prelever** (tout ou acompte) OU **Garantie seulement**
6. ActiveLaser appelle iCount → `/cc/bill` ou `/cc/j5`
7. Resultat stocke dans ActiveLaser
8. Si paiement : facture iCount, reference stockee

### Scenario 3 : Garantie carte (pre-autorisation)

1. Employe prend la carte par telephone
2. Choisit "Garantie seulement" (montant configurable, ex: 1 ILS ou montant acompte)
3. ActiveLaser appelle `/cc/j5` → blocage sans debit
4. Plus tard :
   - Si tout OK → liberation automatique (apres X jours)
   - Si probleme → debit du montant via `/cc/bill` avec `use_j5_if_available`

### Scenario 4 : Client paie a la caisse

1. Client arrive, paie a la caisse physique
2. Employe clique "Paye caisse" dans ActiveLaser
3. Paiement enregistre avec `method = 'cash_register'`
4. Si garantie carte existait → liberation programmee (delai 5 jours configurable)
5. Pas de facture iCount (la caisse fait sa propre facture)

---

## TABLES BASE DE DONNEES

### Table `products` (NOUVELLE)

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) NOT NULL,

  -- Identifiant
  code TEXT NOT NULL,  -- Ex: 'LASER_GAME', 'EVENT_15_29', 'BRACELET'
  name TEXT NOT NULL,
  description TEXT,

  -- Prix TTC
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'ILS',

  -- TVA
  vat_rate DECIMAL(5,2) DEFAULT 17.00,  -- 17% en Israel
  price_includes_vat BOOLEAN DEFAULT true,

  -- Sync provider
  provider_product_id TEXT,  -- ID cote iCount (ou autre provider)
  provider_sku TEXT,

  -- Statut
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contraintes
  UNIQUE(branch_id, code)
);

CREATE INDEX idx_products_branch ON products(branch_id);
CREATE INDEX idx_products_active ON products(is_active);
```

### Table `payments`

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liens
  branch_id UUID REFERENCES branches(id) NOT NULL,
  booking_id UUID REFERENCES bookings(id),
  order_id UUID REFERENCES orders(id),
  contact_id UUID REFERENCES contacts(id),

  -- Montant
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'ILS',

  -- Type de paiement
  payment_type TEXT NOT NULL,  -- 'full', 'deposit', 'partial', 'balance', 'guarantee', 'refund'

  -- Methode
  method TEXT NOT NULL,  -- 'online', 'phone', 'cash_register'

  -- Statut
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'completed', 'failed', 'refunded'

  -- Idempotency (UNIQUE pour eviter doublons webhooks)
  provider_payment_id TEXT UNIQUE,

  -- Provider (iCount) - infos copiees pour historique
  provider_name TEXT DEFAULT 'icount',
  provider_transaction_id TEXT,
  provider_confirmation_code TEXT,
  provider_doc_type TEXT,
  provider_doc_num INTEGER,
  provider_doc_url TEXT,

  -- Pour garantie carte
  is_guarantee BOOLEAN DEFAULT false,
  guarantee_amount DECIMAL(10,2),
  guarantee_released_at TIMESTAMPTZ,
  guarantee_release_scheduled_at TIMESTAMPTZ,
  guarantee_charged_at TIMESTAMPTZ,  -- Si on a debite la garantie

  -- Infos carte (masquees)
  card_last4 TEXT,
  card_type TEXT,
  card_token_id UUID REFERENCES card_tokens(id),

  -- Lignes produits (copie pour historique)
  items JSONB,  -- [{product_id, name, quantity, unit_price, total}]

  -- Audit
  reference TEXT,  -- Numero interne unique (ex: PAY-2026-0001)
  notes TEXT,
  processed_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_payments_branch ON payments(branch_id);
CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_contact ON payments(contact_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_method ON payments(method);
CREATE INDEX idx_payments_created ON payments(created_at);
CREATE INDEX idx_payments_provider ON payments(provider_payment_id);
```

### Table `payment_settings`

```sql
CREATE TABLE payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) UNIQUE,

  -- Provider credentials (un compte par branche)
  provider_name TEXT DEFAULT 'icount',
  provider_cid TEXT,  -- Company ID
  provider_user TEXT,
  provider_pass TEXT,  -- Chiffre en production
  provider_enabled BOOLEAN DEFAULT false,

  -- Mode de depot
  deposit_mode TEXT DEFAULT 'none',  -- 'none', 'full', 'fixed', 'percent'
  deposit_value DECIMAL(10,2),  -- Montant si fixed, pourcentage si percent

  -- Regle de confirmation
  confirmation_rule TEXT DEFAULT 'allow_unpaid',  -- 'paid_only', 'allow_unpaid'
  hold_expiration_minutes INTEGER DEFAULT 30,

  -- Garantie carte
  guarantee_enabled BOOLEAN DEFAULT true,
  guarantee_default_amount DECIMAL(10,2) DEFAULT 1.00,
  guarantee_release_delay_days INTEGER DEFAULT 5,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table `card_tokens`

```sql
CREATE TABLE card_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) NOT NULL,
  branch_id UUID REFERENCES branches(id) NOT NULL,

  -- Provider token
  provider_name TEXT DEFAULT 'icount',
  provider_token_id TEXT NOT NULL,

  -- Infos carte (masquees)
  card_last4 TEXT NOT NULL,
  card_type TEXT,
  card_expiry TEXT,
  holder_name TEXT,

  -- Statut
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(branch_id, contact_id, provider_token_id)
);

CREATE INDEX idx_card_tokens_contact ON card_tokens(contact_id);
CREATE INDEX idx_card_tokens_branch ON card_tokens(branch_id);
```

### Table `invoices` (copie locale des factures)

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) NOT NULL,
  payment_id UUID REFERENCES payments(id),
  contact_id UUID REFERENCES contacts(id),

  -- Provider info
  provider_name TEXT DEFAULT 'icount',
  provider_doc_type TEXT,  -- 'invoice', 'receipt', 'invrec'
  provider_doc_num INTEGER,
  provider_doc_url TEXT,

  -- Copie des infos pour historique
  amount DECIMAL(10,2),
  vat_amount DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  currency TEXT DEFAULT 'ILS',
  items JSONB,

  -- Client info (copie)
  client_name TEXT,
  client_email TEXT,

  -- Statut
  status TEXT DEFAULT 'issued',  -- 'issued', 'sent', 'cancelled'
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_branch ON invoices(branch_id);
CREATE INDEX idx_invoices_payment ON invoices(payment_id);
CREATE INDEX idx_invoices_contact ON invoices(contact_id);
```

### Modifications table `orders`

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS
  payment_status TEXT DEFAULT 'unpaid';  -- 'unpaid', 'deposit_paid', 'guarantee_taken', 'paid', 'paid_cash'

ALTER TABLE orders ADD COLUMN IF NOT EXISTS
  total_amount DECIMAL(10,2);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS
  deposit_amount DECIMAL(10,2);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS
  amount_paid DECIMAL(10,2) DEFAULT 0;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS
  slot_hold_until TIMESTAMPTZ;
```

### Modifications table `contacts`

```sql
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS
  provider_client_id TEXT;  -- ID synchronise avec le provider (iCount)
```

---

## ETAPES D'IMPLEMENTATION (V1)

> **Scope V1** : Paiement en ligne + telephone + garantie + caisse + webhooks + factures + produits
> **Hors scope V1** : Multi-contacts, split, differe, refund auto

---

### ETAPE 1 : Infrastructure & Tables

**Objectif** : Base technique

- [ ] Migrations SQL
  - Table `products`
  - Table `payments` (avec `provider_payment_id` UNIQUE)
  - Table `payment_settings`
  - Table `card_tokens`
  - Table `invoices`
  - Modifications `orders` et `contacts`

- [ ] Creer compte iCount de TEST
  - Separe de la production
  - Pour tous les tests d'integration

---

### ETAPE 2 : Provider Abstraction Layer

**Objectif** : Architecture interchangeable

- [ ] Creer interface `lib/payment-provider/types.ts`
  ```typescript
  interface PaymentProvider {
    // Clients
    syncClient(contact: Contact): Promise<string>  // retourne provider_client_id

    // Produits
    syncProduct(product: Product): Promise<string>  // retourne provider_product_id

    // Paiements
    chargeCard(params: ChargeParams): Promise<ChargeResult>
    preAuthorize(params: PreAuthParams): Promise<PreAuthResult>
    releasePreAuth(preAuthId: string): Promise<void>
    chargePreAuth(preAuthId: string, amount: number): Promise<ChargeResult>

    // Liens paiement
    generatePaymentLink(params: PaymentLinkParams): Promise<string>

    // Factures
    createInvoice(params: InvoiceParams): Promise<InvoiceResult>

    // Tokens carte
    storeCard(params: StoreCardParams): Promise<CardToken>
    deleteCard(tokenId: string): Promise<void>
  }
  ```

- [ ] Creer implementation iCount `lib/payment-provider/icount/`
  - `client.ts` : Authentification, session, requetes
  - `clients.ts` : Sync contacts
  - `products.ts` : Sync produits
  - `billing.ts` : Paiements carte
  - `paypage.ts` : Liens paiement
  - `documents.ts` : Factures
  - `cards.ts` : Tokenisation

---

### ETAPE 3 : Page Settings Paiements

**Objectif** : Configuration par branche

- [ ] Page `/admin/settings/payments`
  - Credentials provider (cid, user, pass)
  - Bouton "Tester la connexion"
  - Mode depot : none / full / fixed / percent
  - Valeur depot (montant ou %)
  - Regle confirmation : paid_only / allow_unpaid
  - Duree blocage si paid_only
  - Garantie : active / montant par defaut / delai liberation

---

### ETAPE 4 : Gestion des Produits

**Objectif** : CRUD produits avec sync provider

- [ ] Page `/admin/settings/products`
  - Liste des produits de la branche
  - Creer / Modifier / Supprimer
  - Champs : code, nom, description, prix TTC, TVA
  - Statut actif/inactif
  - Ordre d'affichage

- [ ] Sync automatique vers provider
  - A la creation → `syncProduct()`
  - A la modification → `syncProduct()` (update)
  - A la suppression → desactiver cote provider

---

### ETAPE 5 : Synchronisation Clients

**Objectif** : Clients copies vers provider automatiquement

- [ ] Hook sur creation/modification contact
  - Appeler `syncClient()` vers provider de la branche
  - Stocker `provider_client_id` dans contacts

- [ ] Script batch pour clients existants

---

### ETAPE 6 : Paiements en ligne (Redirection)

**Objectif** : Client paie lors de sa reservation web

- [ ] Modifier flow de reservation en ligne
  1. Client remplit formulaire
  2. Calcul montant selon `deposit_mode`
  3. Si paiement requis → `generatePaymentLink()`
  4. Redirection vers page provider
  5. Retour sur `/reservation/success` ou `/reservation/failed`

- [ ] Gestion blocage temporaire (si `paid_only`)
  - Creneau bloque pendant `hold_expiration_minutes`
  - CRON job pour liberer les expires

---

### ETAPE 7 : Webhooks Provider (IPN)

**Objectif** : Recevoir notifications en temps reel

- [ ] API route `POST /api/webhooks/icount`
  - Validation origine
  - Parsing payload

- [ ] Logique IDEMPOTENTE
  ```
  1. Extraire provider_payment_id
  2. Si existe dans payments → ignorer
  3. Si nouveau → creer payment + update order status
  ```

- [ ] Actions post-paiement
  - Creer facture via provider
  - Stocker reference dans `invoices`
  - Envoyer email confirmation

---

### ETAPE 8 : Paiements par Telephone

**Objectif** : Employe peut prelever carte depuis back-office

- [ ] Modal "Paiement" dans BookingModal / OrderModal
  - Onglet "Nouvelle carte"
    - Saisie : numero, expiration, CVV, titulaire
  - Onglet "Carte enregistree" (si tokens existent)
    - Liste des cartes du client
    - Selection rapide

- [ ] Choix du type
  - Prelever tout
  - Prelever acompte (montant editable)
  - Garantie seulement

- [ ] Execution
  - Appel `chargeCard()` ou `preAuthorize()`
  - Resultat affiche
  - Paiement enregistre dans `payments`

- [ ] Option "Enregistrer la carte"
  - Checkbox pour tokeniser
  - Token stocke dans `card_tokens`

---

### ETAPE 9 : Garantie Carte

**Objectif** : Bloquer montant sans debiter

- [ ] Pre-autorisation
  - Via modal paiement, option "Garantie seulement"
  - Appel `preAuthorize()`
  - Paiement cree avec `is_guarantee = true`

- [ ] Liberation automatique
  - CRON job quotidien
  - Verifie `guarantee_release_scheduled_at`
  - Appelle `releasePreAuth()` si date passee

- [ ] Debit de la garantie (si probleme)
  - Bouton "Debiter la garantie" dans le modal
  - Appelle `chargePreAuth()`
  - Met a jour le paiement

---

### ETAPE 10 : Paiements Caisse

**Objectif** : Enregistrer paiements physiques

- [ ] Bouton "Paye caisse" dans BookingModal / OrderModal
  - Un clic = paiement enregistre
  - `method = 'cash_register'`
  - Pas de facture provider

- [ ] Liberation garantie si existante
  - Programme liberation (delai configurable)

---

### ETAPE 11 : Factures

**Objectif** : Factures generees et copiees localement

- [ ] Generation automatique
  - Apres paiement confirme (webhook ou direct)
  - Appel `createInvoice()`
  - Reference stockee dans `invoices`

- [ ] Affichage
  - Lien vers facture dans historique paiements
  - PDF accessible via URL provider

---

### ETAPE 12 : Rapports

**Objectif** : Vue des paiements

- [ ] Page `/admin/payments`
  - Liste avec filtres (date, methode, statut)
  - Totaux par periode
  - Distinction : en ligne / telephone / caisse

- [ ] Export CSV

---

## HORS SCOPE V1 (POUR PLUS TARD)

### Multi-contacts / Split (V2)
- Plusieurs payeurs par commande
- Repartition des montants

### Paiements differes (V2)
- Clients entreprise
- J+15, J+30

### Remboursements automatises (V2)
- Refund via API provider
- Actuellement : refund manuel dans iCount directement

---

## API iCOUNT - ENDPOINTS UTILISES

### Authentification
| Endpoint | Usage |
|----------|-------|
| `POST /auth/login` | Demarrer session (retourne `sid`) |
| `POST /auth/logout` | Fermer session |

### Clients
| Endpoint | Usage |
|----------|-------|
| `POST /client/create_or_update` | Sync contact (custom_client_id = UUID) |
| `POST /client/info` | Recuperer infos |

### Produits (Inventory)
| Endpoint | Usage |
|----------|-------|
| `POST /inventory/create` | Creer produit |
| `POST /inventory/update` | Modifier produit |
| `POST /inventory/info` | Infos produit |

### Paiements carte
| Endpoint | Usage |
|----------|-------|
| `POST /cc/bill` | Debiter carte |
| `POST /cc/j5` | Pre-autorisation (garantie) |
| `POST /cc/store_card_info` | Tokeniser carte |

### Stockage carte
| Endpoint | Usage |
|----------|-------|
| `POST /cc_storage/store` | Stocker token |
| `POST /cc_storage/delete` | Supprimer token |

### Pages de paiement
| Endpoint | Usage |
|----------|-------|
| `POST /paypage/generate_sale` | Generer lien paiement |

### Documents
| Endpoint | Usage |
|----------|-------|
| `POST /doc/create` | Creer facture/recu |
| `POST /doc/email` | Envoyer par email |

### Webhooks
| Endpoint | Usage |
|----------|-------|
| `POST /webhook/add` | Enregistrer webhook |

---

## SECURITE

### Credentials Provider
- Stockes chiffres dans `payment_settings`
- Variable d'environnement `ENCRYPTION_KEY`
- Jamais exposes cote client

### Donnees Carte
- **JAMAIS** stockees dans ActiveLaser
- Saisie → envoi direct API provider → token retourne
- Seuls `card_last4` et `card_type` conserves

### Webhooks
- Validation origine (IP / signature si disponible)
- Idempotency via `provider_payment_id` UNIQUE
- Logging complet

### Permissions
- `payments.view` : Voir les paiements
- `payments.record_cash` : Enregistrer paiement caisse
- `payments.charge` : Prelever carte
- `payments.guarantee` : Prendre/liberer garantie
- `payments.settings` : Configurer paiements
- `products.manage` : Gerer produits

---

## VARIABLES D'ENVIRONNEMENT

```env
# Provider API
PAYMENT_PROVIDER_URL=https://api.icount.co.il/api/v3.php

# Encryption (pour credentials en DB)
ENCRYPTION_KEY=xxx

# Webhooks (si signature supportee)
WEBHOOK_SECRET=xxx
```

---

## TESTS

### Tests unitaires
- [ ] Provider abstraction layer
- [ ] Calcul acompte
- [ ] Logique de statuts

### Tests integration (compte TEST iCount)
- [ ] Sync client
- [ ] Sync produit
- [ ] Charge carte
- [ ] Pre-autorisation
- [ ] Generation lien paiement
- [ ] Webhook reception
- [ ] Creation facture

### Tests manuels
- [ ] Scenario 1 : Reservation + paiement en ligne
- [ ] Scenario 2 : Prise carte telephone
- [ ] Scenario 3 : Garantie carte
- [ ] Scenario 4 : Paiement caisse

---

## CHANGELOG

### 2026-01-19
- Creation du document Phase 4
- **MAJ** : Paiement telephone + garantie carte → V1
- **MAJ** : Architecture provider-agnostic
- **MAJ** : Table products par branche
- **MAJ** : Sync produits vers provider
- **MAJ** : Table invoices (copie locale)
- Definition des 12 etapes d'implementation

---

*Document maintenu par Jeremy & Claude*
