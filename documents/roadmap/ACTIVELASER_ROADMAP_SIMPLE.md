# ActiveLaser - Plan de Developpement (Version Simple)

## Objectif

Ameliorer le CRM pour :
- Savoir QUI a fait QUOI et QUAND
- Controler ce que chaque utilisateur peut faire ou pas
- Envoyer des emails automatiquement aux clients
- Creer des documents PDF (devis, confirmations)
- Permettre aux clients de confirmer par lien
- Accepter les paiements en ligne avec acompte

---

## ETAPE 1 : Historique des Actions + Droits Utilisateurs

### Pourquoi ?
- Aujourd'hui, si quelqu'un supprime une reservation par erreur, on ne sait pas qui l'a fait
- Tous les utilisateurs peuvent tout faire, meme supprimer des donnees importantes

### Ce qu'on va faire :

**Partie A - Historique des actions**
- [ ] Enregistrer automatiquement chaque action (creation, modification, suppression)
- [ ] Garder : qui a fait l'action, quand, sur quoi, les anciennes valeurs
- [ ] Creer une page dans l'admin pour voir l'historique
- [ ] Pouvoir filtrer par utilisateur, par date, par type d'action
- [ ] Supprimer automatiquement les logs de plus d'1 an

**Partie B - Droits par utilisateur**
- [ ] Definir ce que chaque role peut faire :
  - Super Admin : tout
  - Admin de branche : sa branche uniquement
  - Agent : actions limitees (pas de suppression par exemple)
- [ ] Pour chaque section (Agenda, Commandes, Clients, Users, Parametres) definir :
  - Qui peut voir
  - Qui peut creer
  - Qui peut modifier
  - Qui peut supprimer
- [ ] Bloquer les boutons si l'utilisateur n'a pas le droit
- [ ] Afficher un message si quelqu'un essaie de faire quelque chose sans autorisation

---

## ETAPE 2 : Documents PDF

### Pourquoi ?
- Pouvoir envoyer un devis propre au client
- Avoir une confirmation de reservation officielle
- Garder une trace des documents envoyes

### Ce qu'on va faire :

- [ ] Creer un modele de devis PDF avec :
  - Logo Active Games
  - Informations du client
  - Details de la reservation (date, heure, nombre de personnes, prix)
  - Conditions generales
- [ ] Creer un modele de confirmation de reservation PDF
- [ ] Pouvoir telecharger le PDF depuis l'admin
- [ ] Stocker les PDF generes pour les retrouver plus tard

---

## ETAPE 3 : Emails Automatiques

### Pourquoi ?
- Aujourd'hui tout est manuel
- Le client ne recoit rien apres sa reservation
- On oublie parfois de relancer les clients

### Ce qu'on va faire :

**Configuration de base**
- [ ] Connecter un service d'envoi d'emails (Resend ou SendGrid)
- [ ] Creer les modeles d'emails avec le design Active Games

**Emails automatiques a creer :**
- [ ] Confirmation de reservation (envoye automatiquement)
- [ ] Rappel 24h avant l'evenement
- [ ] Rappel 2h avant l'evenement
- [ ] Email apres la visite (merci + avis)
- [ ] Email pour les reservations en attente (relance)

**Lien de confirmation client**
- [ ] Creer une page web ou le client peut voir sa reservation
- [ ] Bouton pour confirmer (signature electronique simple)
- [ ] Enregistrer quand le client a confirme

**Suivi**
- [ ] Voir dans l'admin si l'email a ete envoye
- [ ] Voir si le client a ouvert l'email
- [ ] Voir si le client a clique sur le lien

---

## ETAPE 4 : Paiements

### Pourquoi ?
- Aujourd'hui les paiements sont tous manuels
- Pas d'acompte pour securiser les reservations
- Pas de trace claire des paiements

### Ce qu'on va faire :

**Paiement en ligne**
- [ ] Choisir une solution de paiement adaptee a Israel (PayPlus, Tranzila, etc.)
- [ ] Chaque branche aura son propre compte de paiement
- [ ] Le client peut payer depuis son email de confirmation
- [ ] Page de paiement securisee

**Acompte**
- [ ] Configurer le montant de l'acompte par branche :
  - Soit un pourcentage (ex: 30%)
  - Soit un montant fixe (ex: 500 shekels)
- [ ] L'acompte est demande a la reservation
- [ ] Le reste est paye sur place

**Paiement manuel (sur place)**
- [ ] Enregistrer les paiements faits sur place
- [ ] Choisir le mode de paiement (especes, carte, cheque)
- [ ] Voir le solde restant a payer

**Suivi**
- [ ] Voir l'historique des paiements pour chaque reservation
- [ ] Voir le statut : paye, partiellement paye, non paye
- [ ] Tableau de bord des paiements par jour/semaine/mois

---

## ETAPE 5 : Tableaux de Bord (Bonus)

### Pourquoi ?
- Avoir une vue d'ensemble de l'activite
- Prendre des decisions basees sur les chiffres

### Ce qu'on va faire :

- [ ] Nombre de reservations par jour/semaine/mois
- [ ] Chiffre d'affaires par periode
- [ ] Taux de remplissage des creneaux
- [ ] Clients les plus fideles
- [ ] Comparaison entre branches

---

## DECISIONS DEJA PRISES

| Question | Reponse |
|----------|---------|
| Combien de temps garder l'historique ? | 1 an |
| Comment calculer l'acompte ? | Configurable par branche (% ou montant fixe) |
| Un compte de paiement par branche ? | Oui, separe |

---

## QUESTIONS A DECIDER

1. **Emails** : Quel service utiliser ? (Resend recommande)
2. **Textes des emails** : Qui ecrit le contenu ?
3. **Paiement** : Quelle solution choisir pour Israel ?
   - Options : PayPlus, Tranzila, CardCom, Meshulam, iCredit

---

## ORDRE DE REALISATION

```
ETAPE 1 (Historique + Droits)
         |
         v
ETAPE 2 (PDF)
         |
         v
ETAPE 3 (Emails + Confirmation client)
         |
         v
ETAPE 4 (Paiements)
         |
         v
ETAPE 5 (Tableaux de bord) - BONUS
```

Chaque etape doit etre terminee et testee avant de passer a la suivante.

---

## RESUME EN UNE PHRASE PAR ETAPE

1. **Etape 1** : Savoir qui fait quoi et controler les acces
2. **Etape 2** : Creer des documents PDF professionnels
3. **Etape 3** : Envoyer des emails automatiques et permettre la confirmation en ligne
4. **Etape 4** : Accepter les paiements en ligne avec acompte
5. **Etape 5** : Voir les statistiques de l'activite

---

*Document cree le 18 janvier 2026*
