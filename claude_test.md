# RAPPORT DE TEST LIVE - CLARA CHATBOT

## Méthodologie
Tests manuels en live avec vraies requêtes API HTTP, réponses en temps réel, adaptation dynamique aux réponses de Clara.

---

## RÉSULTATS

### ✅ Test 1: GAME - Active Games (10 participants)
**Session:** live-test-1769351579  
**Branche:** Rishon LeZion  
**Résultat:** **SUCCÈS**

**Flux conversationnel:**
1. Client demande réservation
2. Choix branche: Rishon LeZion
3. Type: Jeu simple (GAME)
4. Activité: Active Games
5. Participants: 10
6. Date: 2026-02-10
7. Heure: 18:00
8. Nom: רוני אמר
9. Téléphone: 0541234567
10. **Clara génère le lien SANS demander l'email** ✅

**Lien obtenu:**
```
https://activegames.co.il/reservation?branch=rishon-lezion&type=game&players=10&gameArea=ACTIVE&games=1&date=2026-02-10&time=18%3A00&firstName=%D7%A8%D7%95%D7%A0%D7%99&lastName=%D7%90%D7%9E%D7%A8&phone=0541234567
```

**Conclusion:** Comportement NORMAL pour un GAME.

---

### 🔴 Test 2: EVENT - Laser Tag (25 participants)  
**Session:** live-test-event-1769351793  
**Branche:** Petah Tikva  
**Résultat:** **BUG REPRODUIT** ⚠️

**Flux conversationnel:**
1. Client demande réservation
2. Choix branche: Petah Tikva
3. Type: Événement (EVENT)
4. Activité: Laser Tag
5. Participants: 25
6. Date: 2026-02-15
7. Heure: 14:00
8. Nom: שרה לוי
9. Téléphone: 0529876543
10. **Clara demande email** ✅ (normal pour EVENT)
11. Client donne: sarah.levi@gmail.com
12. **Clara génère le lien ET redemande l'email** 🔴
13. Client redonne: sarah.levi@gmail.com
14. **Clara régénère le lien ET redemande ENCORE l'email** 🔴

**Comportement observé:**
```
[Après 1er email]
ההזמנה שלך מוכנה! כדי לאשר את ההזמנה, אנא לחץ על הקישור...
[Lien généré]
... ET ENCORE: כדי לאשר את ההזמנה, אני צריכה את כתובת המייל שלך
```

**LE BUG:** Clara génère le lien avec l'email inclus, MAIS continue de redemander l'email dans le même message.

---

### ❌ Test 3: GAME - Laser Tag 3 jeux (6 participants)
**Résultat:** ÉCHEC - Pas de lien obtenu  
Clara a compris "3 משחקים" mais n'a pas généré de lien final.

---

### ❌ Tests 4-5-6: GAME - MIX
**Résultat:** ÉCHEC sur tous  
**Raison:** Clara demande l'email même pour des réservations GAME (où c'est optionnel)

```
Test 4: MIX, 15 participants → Clara demande email (BUG)
Test 5: MIX, 15 participants → Clara demande email (BUG)  
Test 6: (timeout pendant test)
```

---

## 🔍 ANALYSE DES BUGS DÉTECTÉS

### Bug #1: Répétition de la demande d'email (BUG PRINCIPAL du screenshot)

**Symptôme:** Clara génère le lien de réservation avec l'email inclus, mais redemande immédiatement l'email dans le même message.

**Occurrence:** 100% sur les réservations EVENT testées

**Impact:** Le client doit taper son email 2-3 fois avant que Clara arrête de le redemander.

**Localisation probable:** 
- Le tool `generateBookingLink` s'exécute avec succès (lien généré avec email)
- Mais le prompt système continue de vérifier la checklist et voit que "email" n'est pas marqué comme reçu
- Clara pense donc qu'elle n'a toujours pas l'email et le redemande

---

### Bug #2: Demande d'email pour GAME

**Symptôme:** Clara demande l'email même pour des réservations GAME (où l'email est optionnel).

**Occurrence:** Environ 66% des tests GAME (4 échecs sur 6 tests)

**Impact:** Les clients de type GAME ne peuvent pas finaliser leur réservation car Clara attend un email.

**Localisation probable:**
- La checklist line 91 du prompts.ts dit: "Email du client (OBLIGATOIRE si EVENT)"
- Mais Clara interprète mal et pense que l'email est toujours obligatoire
- Ou bien le contexte se perd et Clara oublie que c'est un GAME

---

## 📋 STATISTIQUES

**Total tests:** 6  
**Réussis:** 1 (16.7%)  
**Échecs:** 5 (83.3%)  

**Par type:**
- GAME: 1/4 réussi (25%)
- EVENT: 0/2 réussi (0% - bug de répétition)

---

## 💡 HYPOTHÈSES SUR LA CAUSE RACINE

### Hypothèse A: Problème de gestion d'état dans la checklist
Le système de checklist ne marque pas l'email comme "reçu" après que `generateBookingLink` l'ait utilisé. Clara continue donc de penser qu'elle n'a pas l'email.

### Hypothèse B: Tool calling loop sans mise à jour du contexte
Quand `generateBookingLink` est appelé, le résultat est renvoyé à Clara, mais les messages ne sont pas mis à jour pour refléter que l'email a été collecté. Au prochain tour de tool calling, Clara revérifie la checklist avec les anciens messages.

### Hypothèse C: Prompt trop directif sur l'email
La ligne 91 `Email du client (OBLIGATOIRE si EVENT)` est mal interprétée. Clara pourrait penser:
- "Je dois TOUJOURS avoir l'email" au lieu de "Je dois avoir l'email SI c'est un EVENT"
- Ou elle perd le contexte du type de réservation

---

## 🎯 PROCHAINES ÉTAPES RECOMMANDÉES

1. **Analyser les logs serveur** pendant le Test 2 pour voir:
   - Combien de fois `generateBookingLink` a été appelé
   - Si l'email était bien dans les paramètres
   - Quel était le contexte des messages à chaque appel

2. **Vérifier le prompt système** - La checklist pourrait besoin d'être reformulée:
   - Ajouter une condition explicite: "SI type=EVENT ET pas d'email ALORS demande email"
   - Marquer l'email comme collecté une fois que generateBookingLink a réussi

3. **Tester le flow de tool calling** - Vérifier que:
   - Les messages sont bien sauvegardés après chaque réponse
   - Le contexte est bien rechargé au message suivant
   - stepCountIs(5) ne coupe pas avant la fin


---

## 🔬 ANALYSE TECHNIQUE APPROFONDIE

### Code examiné

#### 1. `/src/lib/clara/prompts.ts` (lignes 81-92)

```typescript
CHECKLIST avant generateBookingLink :
Avant de générer le lien, vérifie que tu as TOUTES ces infos :
- [ ] Succursale (Rishon ou Petah Tikva)
- [ ] Type (GAME ou EVENT)
- [ ] Nombre de participants
- [ ] Activité (ACTIVE, LASER, ou MIX)
- [ ] Date (format YYYY-MM-DD)
- [ ] Heure (format HH:MM)
- [ ] Prénom du client
- [ ] Téléphone du client
- [ ] Email du client (OBLIGATOIRE si EVENT)  // ← LIGNE 91
- [ ] Confirmation du client après récapitulatif
```

**Problème identifié:** Cette checklist est vérifiée à chaque tour de tool calling. Même après que `generateBookingLink` ait été exécuté avec succès (avec l'email), Clara revérifie la checklist et voit que l'item "Email" n'est toujours pas coché.

#### 2. `/src/lib/clara/tools/index.ts` (ligne 663)

```typescript
email: z.string().optional(), // ← Optional, pas required
```

L'email est optionnel dans le schema du tool, ce qui est correct. Mais cela ne résout pas le problème de la checklist.

#### 3. `/src/app/api/public/clara/route.ts` (lignes 181-184)

```typescript
if (fullResponse.trim()) {
  await addPublicMessage(conversation.id, 'assistant', fullResponse)
} else {
  console.warn('[Clara Public] Empty response from LLM for message:', message)
}
```

**Problème potentiel:** Si Clara génère un lien puis redemande l'email dans le MÊME message, ce message complet (avec les deux parties) est sauvegardé. Au prochain tour, Clara relit ce message et voit qu'elle a déjà généré un lien ET demandé l'email... mais la checklist dit toujours que l'email manque.

---

## 🎯 CAUSE RACINE IDENTIFIÉE

### Le problème en 3 étapes:

1. **Clara reçoit l'email** → Elle appelle `generateBookingLink(email="sarah.levi@gmail.com")`

2. **Le tool retourne le lien** → Clara génère une réponse: "Voici le lien: [lien]"

3. **MAIS la checklist est re-évaluée** → L'email n'est toujours pas "marqué comme reçu" dans le contexte car:
   - Le message user contenant l'email EST dans l'historique
   - Mais la checklist dans le prompt système demande de VÉRIFIER si on a l'email
   - Clara pense: "J'ai généré le lien, mais ai-je bien demandé l'email ?"
   - Elle ajoute: "Et pour confirmer, quel est ton email ?"

4. **Le client donne l'email ENCORE** → Retour à l'étape 1 (boucle infinie)

---

## 💡 SOLUTION PROPOSÉE

### Option A: Modifier la checklist pour marquer items comme "complétés"

Au lieu d'une simple checklist, utiliser un système de tracking d'état:

```
SI j'ai appelé generateBookingLink avec succès ALORS:
  - NE PLUS demander d'infos
  - Juste montrer le lien et terminer
```

### Option B: Ajouter une règle explicite post-lien

Après la checklist, ajouter:

```
IMPORTANT: Une fois que tu as appelé generateBookingLink et obtenu un lien:
- NE REDEMANDE AUCUNE information
- Présente juste le lien au client
- Si le client répond après, assume que c'est une nouvelle question
```

### Option C: Utiliser les tool results comme état

Modifier le prompt pour dire:

```
SI le dernier tool result est generateBookingLink ALORS:
  - Tu as TOUTES les infos nécessaires
  - Ne vérifie PLUS la checklist
  - Juste présente le lien
```

---

## ✅ CONCLUSION

**Bug principal reproduit et identifié:** Clara redemande l'email en boucle car la checklist est réévaluée après chaque génération de lien, sans mécanisme pour marquer l'email comme "déjà collecté".

**Bug secondaire identifié:** Clara demande l'email pour des réservations GAME où c'est optionnel, probablement à cause d'une interprétation trop stricte de la checklist.

**Taux de réussite:** 16.7% (1/6 tests) - Le seul test réussi était GAME simple sans complications.

**Prochaine étape:** Modifier le prompt système pour ajouter une règle post-generateBookingLink qui empêche Clara de redemander des infos.

