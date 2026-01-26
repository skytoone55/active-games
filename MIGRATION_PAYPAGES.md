# Migration vers iCount PayPages - Guide Complet

**Date:** 26 Janvier 2026
**Objectif:** Conformité PCI-DSS en utilisant les pages de paiement hébergées iCount

---

## ✅ FICHIERS CRÉÉS

### 1. Migration Base de Données
- `supabase/migrations/20260126_add_paypages_fields.sql`
  - Ajoute champs pour PayPages dans table `payments`
  - Index pour performance et idempotence

### 2. Service iCount PayPages
- `src/lib/payment-provider/icount/paypages.ts`
  - Module pour générer les URLs de paiement
  - Types TypeScript pour PayPages

### 3. API Publique
- `src/app/api/public/initiate-payment/route.ts`
  - Remplace `/api/public/pay-deposit`
  - Crée payment et retourne URL PayPages

### 4. Webhook iCount
- `src/app/api/webhooks/icount-paypage/route.ts`
  - Reçoit notifications de paiement
  - Met à jour payments et orders
  - Idempotence via `sale_uniqid`

### 5. API Admin
- `src/app/api/orders/[id]/payment-admin/route.ts`
  - Version sécurisée pour admin
  - Supporte iframe

### 6. CRON Nettoyage
- `src/app/api/cron/cleanup-expired-payments/route.ts`
  - Nettoie payments expirés 1x/jour
  - Ajouté dans `vercel.json`

---

## 🔄 NOUVEAU FLUX DE PAIEMENT

### AVANT (Non conforme PCI-DSS):
```
Client → Formulaire CB → Ton serveur (reçoit cc_number, cc_cvv) → iCount API
```
**Problème:** Ton serveur touche les données CB = Certification PCI-DSS requise

### APRÈS (Conforme PCI-DSS):
```
Client → Ton serveur (crée payment) → Redirection vers iCount → Client paie → iCount webhook → Ton serveur (mise à jour)
```
**Avantage:** Ton serveur ne voit JAMAIS les données CB

---

## 📋 ÉTAPES DE DÉPLOIEMENT

### 1. Appliquer la migration DB
```bash
# Via Supabase CLI ou Dashboard
supabase migration up
```

### 2. Configurer PayPage ID dans iCount
- Se connecter sur iCount Dashboard
- Créer un PayPage (ou utiliser existant)
- Noter le `paypage_id`
- Mettre à jour dans le code (actuellement hardcodé à `1`)

### 3. Configurer l'URL webhook dans iCount
- URL: `https://activegames.co.il/api/webhooks/icount-paypage`
- Activer IPN (Instant Payment Notifications)

### 4. Déployer sur Vercel
```bash
git add .
git commit -m "feat: Migrate to iCount PayPages for PCI-DSS compliance"
git push
```

### 5. Vérifier variables d'environnement Vercel
- `NEXT_PUBLIC_APP_URL` = https://activegames.co.il
- `CRON_SECRET` = [valeur existante]
- `SUPABASE_SERVICE_ROLE_KEY` = [valeur existante]

---

## 🧪 TESTS À EFFECTUER

### Test 1: Paiement Réussi
1. Créer une commande
2. Appeler `/api/public/initiate-payment`
3. Ouvrir `payment_url` dans navigateur
4. Payer avec carte test iCount
5. Vérifier webhook reçu
6. Vérifier `payment.status = 'completed'`
7. Vérifier `order.payment_status = 'deposit_paid'`

### Test 2: Paiement Échoué
1. Utiliser carte test refusée
2. Vérifier `payment.status = 'failed'`
3. Vérifier que l'order reste 'pending'
4. Vérifier possibilité de réessayer

### Test 3: Timeout / Abandon
1. Créer payment
2. Ne pas payer (attendre 2h10)
3. Vérifier CRON marque comme 'failed'

### Test 4: Double Webhook (Idempotence)
1. Payer normalement
2. Re-envoyer manuellement le même webhook
3. Vérifier pas de double crédit

### Test 5: Admin Payment
1. Se connecter en admin
2. Créer payment via `/api/orders/[id]/payment-admin`
3. Ouvrir URL en iframe ou nouvelle fenêtre
4. Payer et vérifier sync

---

## ⚠️ POINTS D'ATTENTION

### PayPage ID
**Actuellement hardcodé:**
```typescript
paypage_id: 1 // TODO: Récupérer depuis branch_settings
```

**À faire:**
- Stocker `paypage_id` par branche dans `branch_settings`
- Ou créer table `payment_configs`

### Montants
**Validation server-side:**
```typescript
// Dans /api/public/initiate-payment
// IMPORTANT: Recalculer le montant attendu
const expectedAmount = calculateDeposit(order)
if (amount !== expectedAmount) {
  return error
}
```

**Actuellement:** Le frontend passe le montant librement
**À corriger:** Recalculer server-side pour éviter fraude

### Webhook Signature
**Actuellement:** Pas de vérification HMAC
**À ajouter** si iCount le supporte:
```typescript
const signature = request.headers.get('x-icount-signature')
if (!verifyHMAC(signature, payload, secret)) {
  return 401
}
```

---

## 🔒 SÉCURITÉ

### Protection Double Paiement
✅ Vérification payments 'pending' existants
✅ Idempotence via `sale_uniqid`
✅ Nettoyage automatique des vieux payments

### Rate Limiting
✅ 5 requêtes/min par IP sur `/api/public/initiate-payment`

### Validation Webhook
✅ Vérification `sale_uniqid` existe
✅ Vérification montant correspond
✅ Vérification status != 'completed' (déjà traité)
⚠️ TODO: Ajouter HMAC signature si disponible

---

## 🗑️ ANCIEN CODE À SUPPRIMER

### Une fois migration validée:
```bash
# Supprimer ancien endpoint paiement direct
rm src/app/api/public/pay-deposit/route.ts

# Supprimer dans /api/orders/[id]/payment/route.ts:
# - Tout le code qui accepte body.cardInfo
# - Appels à provider.creditCard.billCard avec cardInfo
```

**ATTENTION:** Garder billCard uniquement pour:
- Paiements cash/chèque/virement admin
- J5 pré-autorisations (si utilisé)

---

## 📊 MONITORING

### Logs à surveiller
```bash
# Webhooks reçus
grep "ICOUNT-WEBHOOK" /var/log/vercel.log

# Payments expirés nettoyés
grep "CLEANUP-PAYMENTS" /var/log/vercel.log

# Erreurs PayPages
grep "INITIATE-PAYMENT.*error" /var/log/vercel.log
```

### Métriques Supabase
```sql
-- Payments par statut
SELECT status, COUNT(*)
FROM payments
WHERE payment_method = 'paypage'
GROUP BY status;

-- Payments expirés (>2h en pending)
SELECT COUNT(*)
FROM payments
WHERE status = 'pending'
  AND payment_method = 'paypage'
  AND created_at < NOW() - INTERVAL '2 hours 10 minutes';
```

---

## 🆘 ROLLBACK

### Si problème critique en production:

1. **Désactiver nouveau flow:**
```typescript
// Dans /api/public/initiate-payment/route.ts
// Ajouter au début:
return NextResponse.json({ error: 'Temporarily disabled' }, { status: 503 })
```

2. **Restaurer ancien endpoint:**
```bash
git revert [commit-hash]
git push
```

3. **Notifications:**
- Informer clients par email
- Message sur site

---

## ✅ CHECKLIST AVANT MISE EN PRODUCTION

- [ ] Migration DB appliquée
- [ ] PayPage créé dans iCount Dashboard
- [ ] Webhook URL configuré dans iCount
- [ ] Variables env Vercel vérifiées
- [ ] Tests paiement réussi ✅
- [ ] Tests paiement échoué ✅
- [ ] Tests timeout ✅
- [ ] Tests idempotence ✅
- [ ] Tests admin ✅
- [ ] Monitoring configuré
- [ ] Plan rollback documenté
- [ ] Équipe formée sur nouveau flow

---

## 📞 SUPPORT

**Questions iCount PayPages:**
- Documentation: ~/Desktop/claude/data/icount/PayPages-API.yaml
- Support iCount: support@icount.co.il

**Questions techniques:**
- Voir ce fichier
- Logs Vercel
- Logs Supabase

---

**Bonne migration ! 🚀**
