# PHASE 4 : PAIEMENTS iCOUNT - AVANCEMENT

> Suivi d'implementation de la Phase 4
> Debut : 2026-01-19
> Derniere MAJ : 2026-01-21

---

## STATUT GLOBAL

| Etape | Description | Statut |
|-------|-------------|--------|
| 1 | Infrastructure & Tables | ✅ Termine |
| 2 | Provider Abstraction Layer | ✅ Termine |
| 3 | Page Settings Paiements | ✅ Termine |
| 4 | Gestion des Produits/Catalogue | ✅ Termine |
| 5 | Synchronisation Clients | ✅ Termine |
| 6 | Paiements en ligne | ⏳ A faire |
| 7 | Webhooks Provider | ⏳ A faire |
| 8 | Paiements par Telephone | ⏳ A faire |
| 9 | Garantie Carte | ⏳ A faire |
| 10 | Paiements Caisse | ⏳ A faire |
| 11 | Factures | 🔄 Partiel |
| 12 | Rapports | ⏳ A faire |

**Legende** : ✅ Termine | 🔄 En cours | ⏳ A faire | ❌ Bloque

---

## ETAPE 1 : Infrastructure & Tables ✅

### Taches
- [x] Migration SQL : Table `icount_products` (produits/articles)
- [x] Migration SQL : Table `icount_rooms` (salles)
- [x] Migration SQL : Table `icount_event_formulas` (formules evenements)
- [x] Migration SQL : Table `payment_credentials` (credentials iCount par branch)
- [x] Migration SQL : Colonne `contacts.icount_client_id`
- [x] Types TypeScript dans `types.ts`

### Notes
- Structure orientee catalogue de produits/services plutot que paiements directs
- Chaque branche a ses propres credentials et catalogue iCount
- Les contacts sont lies a leur ID client iCount pour la sync

---

## ETAPE 2 : Provider Abstraction Layer ✅

### Taches
- [x] Interface `lib/payment-provider/types.ts`
- [x] Implementation iCount : `client.ts` (auth/session)
- [x] Implementation iCount : `clients.ts` (sync contacts vers iCount)
- [x] Implementation iCount : `items.ts` (gestion articles/produits)
- [x] Implementation iCount : `documents.ts` (factures/documents)
- [x] Export principal : `lib/payment-provider/index.ts`
- [x] Service sync dedié : `lib/icount-sync.ts`
- [x] Service documents : `lib/icount-documents.ts`

### Notes
- Architecture modulaire avec un client central et des modules specialises
- `ICountClient` gere l'authentification et la session
- `ICountClientsModule` gere la creation/update des clients dans iCount
- `ICountItemsModule` gere les articles/produits
- `ICountDocumentsModule` gere les factures et documents

---

## ETAPE 3 : Page Settings Paiements ✅

### Taches
- [x] Composant `CredentialsSection` dans settings
- [x] Formulaire credentials (cid, user, pass) par branche
- [x] Bouton "Tester la connexion" avec retour visuel
- [x] Sauvegarde credentials avec masquage password
- [x] Affichage statut derniere connexion (date, succes/erreur)
- [x] API route `GET/POST /api/payment-credentials`
- [x] API route `POST /api/payment-credentials/test`

### Notes
- Chaque branche peut avoir ses propres credentials iCount
- Test de connexion en temps reel avec feedback utilisateur
- Historique du dernier test (date, statut, erreur eventuelle)

---

## ETAPE 4 : Gestion des Produits/Catalogue ✅

### Taches
- [x] Composant `ICountCatalogSection` dans settings
- [x] Onglet "Products" : liste des articles iCount
- [x] Onglet "Rooms" : liste des salles de reception
- [x] Onglet "Formulas" : formules evenements (prix/participant, game type)
- [x] Modal creation/edition produit
- [x] Modal creation/edition salle
- [x] Modal creation/edition formule
- [x] Activation/Desactivation avec toggle
- [x] API routes CRUD : `/api/icount-products`
- [x] API routes CRUD : `/api/icount-rooms`
- [x] API routes CRUD : `/api/icount-event-formulas`

### Notes
- Catalogue complet par branche
- Support multilingue (name, name_he, name_en)
- Formules liees aux types de jeux (LASER, ACTIVE, BOTH)
- Tri par ordre de priorite/sort_order

---

## ETAPE 5 : Synchronisation Clients ✅

### Taches
- [x] Fonction `syncContactToICount()` dans `icount-sync.ts`
- [x] Fonction `syncContactToICountBackground()` (non-bloquant)
- [x] Hook creation contact → sync iCount automatique
- [x] Hook modification contact → sync iCount automatique
- [x] Stockage `icount_client_id` dans table contacts
- [x] Gestion erreurs (log warning, ne bloque pas le flow)
- [x] Support par branche (credentials differents)

### Fichiers implementes
- `src/lib/icount-sync.ts` : Service principal de synchronisation
- `src/app/api/contacts/route.ts` : Sync a la creation
- `src/app/api/contacts/[id]/route.ts` : Sync a la modification
- `src/app/api/orders/route.ts` : Sync lors de creation order avec nouveau contact

### Notes
- Synchronisation en arriere-plan (non-bloquante)
- Mapping automatique des champs contact → client iCount
- Ne sync pas les contacts archives

---

## ETAPE 6 : Paiements en ligne ⏳

### Taches
- [ ] Modification flow reservation
- [ ] Calcul montant selon deposit_mode
- [ ] Generation lien paiement iCount
- [ ] Redirection client
- [ ] Pages success/failed
- [ ] Gestion blocage temporaire (paid_only)
- [ ] CRON liberation slots expires

### Notes
_A implementer_

---

## ETAPE 7 : Webhooks Provider ⏳

### Taches
- [ ] API route `POST /api/webhooks/icount`
- [ ] Validation origine
- [ ] Parsing payload
- [ ] Logique idempotente
- [ ] Update statut paiement
- [ ] Declenchement facture
- [ ] Email confirmation

### Notes
_A implementer_

---

## ETAPE 8 : Paiements par Telephone ⏳

### Taches
- [ ] Modal paiement dans BookingModal
- [ ] Onglet "Nouvelle carte" (saisie)
- [ ] Onglet "Carte enregistree" (tokens)
- [ ] Choix type (full/deposit/garantie)
- [ ] Appel API charge/preauth
- [ ] Enregistrement paiement
- [ ] Option tokeniser carte

### Notes
_A implementer_

---

## ETAPE 9 : Garantie Carte ⏳

### Taches
- [ ] Pre-autorisation via modal
- [ ] Enregistrement `is_guarantee = true`
- [ ] CRON liberation automatique
- [ ] Bouton "Debiter garantie"
- [ ] Appel `chargePreAuth()`

### Notes
_A implementer_

---

## ETAPE 10 : Paiements Caisse ⏳

### Taches
- [ ] Bouton "Paye caisse" dans modal
- [ ] Enregistrement `method = 'cash_register'`
- [ ] Liberation garantie si existante

### Notes
_A implementer_

---

## ETAPE 11 : Factures 🔄

### Taches
- [x] Module `ICountDocumentsModule` cree
- [x] Service `lib/icount-documents.ts` cree
- [ ] Generation auto apres paiement
- [ ] Appel `createInvoice()`
- [ ] Stockage reference locale
- [ ] Affichage lien facture dans UI

### Notes
- Infrastructure prete, integration avec flow paiement a faire

---

## ETAPE 12 : Rapports ⏳

### Taches
- [ ] Page `/admin/payments`
- [ ] Liste avec filtres
- [ ] Totaux par periode
- [ ] Distinction methodes
- [ ] Export CSV

### Notes
_A implementer_

---

## AUTRES FONCTIONNALITES IMPLEMENTEES (Hors Phase 4)

### Systeme CGV (Conditions Generales de Vente) ✅
- [x] Page validation CGV : `/cgv/[token]`
- [x] API CGV : `/api/cgv/[token]` (GET info, POST validation)
- [x] Token unique par commande (`cgv_token`)
- [x] Envoi lien CGV par email pour commandes admin
- [x] Validation auto CGV pour commandes website
- [x] Affichage statut CGV dans OrdersTable et OrderDetailModal
- [x] Support multilingue CGV (he/fr/en) basé sur `preferred_locale` du contact

### Langue preferee contacts ✅
- [x] Champ `preferred_locale` dans contacts (he/fr/en)
- [x] Selecteur drapeau dans ClientModal (creation/edition)
- [x] Affichage langue dans ContactDetailsModal
- [x] Emails envoyes dans la langue du contact
- [x] Re-envoi email utilise la langue du contact

### Emails ✅
- [x] Templates multilingues (he/fr/en)
- [x] Email confirmation avec/sans lien CGV
- [x] API re-envoi email : `/api/orders/[id]/resend-email`
- [x] Gestion erreurs et logs

---

## JOURNAL DE BORD

### 2026-01-21
- MAJ complete du document PHASE4_PROGRESS.md
- Sync CGV auto pour commandes website (cgv_validated_at)
- Affichage CGV pour tous types de commandes (plus seulement admin)
- Push vers repos secondaires (skytoone55, mymy770)

### 2026-01-20
- Implementation `preferred_locale` sur contacts
- Selecteur drapeau dans ClientModal
- Emails envoyes dans langue du contact
- Page CGV multilingue

### 2026-01-19
- Creation de la branche `payment` depuis `main`
- Implementation infrastructure iCount (Etapes 1-5)
- Page Settings avec CredentialsSection et ICountCatalogSection
- Sync automatique contacts vers iCount

---

*Document mis a jour par Jeremy & Claude*
