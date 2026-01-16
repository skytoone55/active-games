# Refonte du système LASER - Gestion flexible et visuelle claire

## 1. AFFICHAGE LASER - Colonnes adaptatives sans chevauchement

### Objectif
Afficher toutes les réservations LASER de manière claire, sans jamais qu'aucune ne disparaisse, avec division côte à côte.

### Modifications dans `src/app/admin/page.tsx`

**Grille LASER adaptative** :
- Si 1 salle LASER → 1 colonne (100%)
- Si 2 salles LASER → 2 colonnes (L1 = 66%, L2 = 33%) avec `gridTemplateColumns`
- Si 3+ salles → colonnes égales adaptatives

**Affichage côte à côte pour multiples réservations** :
- Fonction `getSegmentsForCellLaser` modifiée pour retourner TOUTES les réservations (pas seulement la première)
- Division horizontale de la case : `width: calc(100% / ${nombreRésas})`
- Utiliser `display: flex` avec `flex-direction: row` pour aligner côte à côte
- Chaque réservation a son propre div avec sa couleur et son contour gris

**Exemple visuel** :
```
Créneau 10:00 - L1 (grand laby):
┌─────────────────────────────────┐
│ Nom1-10p │ Nom2-8p │ Nom3-5p   │  ← 3 réservations côte à côte
└─────────────────────────────────┘
```

### Code clé à modifier

Dans `page.tsx`, section LASER cells (lignes ~2515-2770) :
- Remplacer la logique actuelle qui masque les segments suivants
- Récupérer `allSegmentsForCell = getSegmentsForCellLaser()` (retourne tableau)
- Boucler sur tous les segments pour les afficher côte à côte
- CSS : `display: flex`, `width: calc(100% / segments.length)`

## 2. FENÊTRES RÉTRACTABLES - Boutons agrandir/réduire

### Objectif
Permettre d'agrandir une zone (ACTIVE, LASER, ou ROOMS) en masquant les autres pour mieux voir les détails.

### Modifications dans `src/app/admin/page.tsx`

**État pour gérer la visibilité** :
```typescript
const [visibleGrids, setVisibleGrids] = useState({
  active: true,
  laser: true,
  rooms: true
})
```

**Boutons au-dessus de l'agenda** (avant la grille, ligne ~2200) :
- 3 boutons : "ACTIVE" / "LASER" / "ROOMS"
- Cliquer → toggle la visibilité
- CSS : `display: none` si masqué, `flex: 1 1 auto` si visible
- Adapter la largeur dynamiquement selon le nombre de grilles visibles

**Interface** :
- Boutons style toggle (actif = surligné en bleu)
- Positionnement : juste au-dessus de la grille, alignés à gauche
- Style cohérent avec le thème dark/light

## 3. ALLOCATION INTELLIGENTE - Auto avec override manuel

### Objectif
Proposer automatiquement la meilleure allocation de salles LASER, avec possibilité de forcer manuellement.

### Modifications dans `src/app/admin/components/BookingModal.tsx`

**Nouveau paramètre dans Settings** (ligne ~37) :
```typescript
laser_single_group_threshold: number // Défaut 8
```

**Logique d'allocation dans `findBestLaserRoom`** (`page.tsx` ligne ~1331) :

1. Si `participants >= threshold` :
   - Chercher une salle entière disponible
   - Priorité : plus petite salle suffisante (optimiser l'espace)
   
2. Si `participants < threshold` :
   - Chercher à partager avec d'autres groupes
   - Vérifier capacité totale de la salle
   - Retourner la salle avec le plus d'espace libre

**Champs manuels dans BookingModal** (section LASER, ligne ~2200) :
- Radio buttons : "Auto" / "Petit laby seul" / "Grand laby seul" / "Maxi (les deux)"
- Si manuel → forcer l'allocation choisie (ignorer l'auto)
- Afficher un avertissement si le choix manuel crée un conflit

**Bouton "Réorganiser la journée"** :
- Nouveau bouton en haut de page (à côté de la date)
- Fonction `reorganizeLaserDay()` :
  - Parcourt toutes les réservations LASER de la journée
  - Réalloue les salles selon la logique optimale
  - Propose les modifications avant de les appliquer
  - Modal de confirmation avec aperçu des changements

## 4. GESTION DES VESTES - Limite stricte + spare

### Objectif
Bloquer strictement à la limite de vestes, avec possibilité d'autoriser le spare.

### Modifications dans `src/app/admin/components/SettingsModal.tsx`

**Nouveaux paramètres** (ligne ~37) :
```typescript
laser_total_vests: number        // Limite principale (ex: 30)
laser_spare_vests: number        // Vestes de spare (ex: 5)
laser_spare_enabled: boolean     // Autoriser spare pour cette journée
```

**Toggle dans l'interface Settings** :
- Switch "Vestes spare disponibles aujourd'hui" 
- Si activé → limite = total + spare
- Si désactivé → limite = total seulement

### Modifications dans `BookingModal.tsx` (validation)

**Popup quand dépassement de la limite principale** (ligne ~1577) :
```
"Limite de 30 vestes atteinte. 
Les 5 vestes de spare sont-elles disponibles ?
[Oui - Autoriser] [Non - Annuler]"
```

Si Oui → active temporairement le spare pour cette réservation
Si Non → bloque + propose alternatives (voir point 5)

## 5. PROPOSITION DE SOLUTIONS EN CAS DE CONFLIT

### Objectif
Quand la limite est atteinte, proposer des alternatives intelligentes au lieu de juste bloquer.

### Modifications dans `BookingModal.tsx`

**Nouvelle fonction `suggestLaserAlternatives`** :

Analyse toutes les réservations LASER de la journée et suggère :

1. **Décalages temporels** :
   - "Décaler [Nom-10p] de +15 min (vers 10h15) ?" 
   - "Décaler [Nom-8p] de -15 min (vers 9h45) ?"
   - Calculer si le décalage libère assez de vestes

2. **Fusions de groupes** :
   - "Fusionner [Nom1-5p] et [Nom2-6p] dans le petit laby ?"
   - Vérifier capacité de la salle

3. **Changement de créneau** :
   - "Déplacer [Nom-8p] vers 14h00 (créneau libre) ?"
   - Proposer seulement les créneaux réellement libres

**Modal de propositions** :
- Liste des 3-5 meilleures suggestions
- Bouton "Appliquer" pour chaque suggestion
- Bouton "Réorganiser toute la journée" → optimisation globale

## 6. DIFFÉRENCIATION JEUX / ÉVÉNEMENTS

### Objectif
Traiter différemment les jeux normaux (flexibles ±15 min) et les événements (timing strict).

### Modifications dans `BookingModal.tsx` et `page.tsx`

**Marqueur dans le booking** :
- Utiliser `booking.type` : 'GAME' = flexible, 'EVENT' = strict

**Logique de proposition** :
- Si conflit avec EVENT → pas de décalage automatique, afficher :
  ```
  "Conflit avec événement [Nom] à [heure]. 
   Les événements ont un timing fixe. 
   Modifiez manuellement l'une des réservations."
  ```
- Si conflit avec GAME → proposer décalages ±15 min

**Affichage visuel** :
- Pas de changement de couleur (garde le système actuel)
- Le type est déjà géré dans la base de données

## 7. CONFIGURATION PAR BRANCHE

### Objectif
Permettre à chaque branche d'avoir ses propres paramètres LASER.

### Modifications dans `src/app/admin/components/SettingsModal.tsx`

**Section "Paramètres LASER"** (après la section active, ligne ~450) :

Nouveaux champs :
- Nombre total de vestes (défaut 30)
- Vestes de spare (défaut 5)
- Seuil "groupe seul" (défaut 8 personnes)
- Capacité par salle LASER (déjà existant dans laser_rooms)

**Validation** :
- Total vestes > 0
- Spare vestes >= 0
- Seuil groupe > 0

### Modifications dans `src/lib/supabase/types.ts`

**Type BranchSettings** (ligne ~60) :
```typescript
laser_total_vests: number
laser_spare_vests: number
laser_single_group_threshold: number
```

## 8. REFONTE DE `buildUISegments` POUR LASER

### Objectif
Modifier la construction des segments pour supporter l'affichage côte à côte sans perte de réservations.

### Modifications dans `src/app/admin/page.tsx`

**Fonction `getSegmentsForCellLaser`** (ligne ~1526) :

Actuellement retourne 1 segment → modifier pour retourner TOUS les segments :

```typescript
function getSegmentsForCellLaser(hour, minute, roomIndex): UISegment[] {
  // Au lieu de retourner le premier segment, retourner TOUS les segments
  return segments // tableau complet
}
```

**Fonction `buildUISegmentsLaser`** (nouvelle) :

Créer une fonction dédiée pour LASER (inspirée de `buildUISegments` mais adaptée) :
- Pour chaque créneau de 15 min, lister TOUTES les réservations LASER actives
- Grouper par salle (L1, L2, etc.)
- Permettre plusieurs segments sur la même salle/créneau
- Chaque segment garde son identifiant unique

## 9. ADAPTATION AU NOMBRE DE SALLES

### Objectif
Le système doit s'adapter automatiquement selon le nombre de salles LASER de la branche.

### Modifications dans `src/app/admin/page.tsx`

**Calcul dynamique des colonnes** (ligne ~2489) :

```typescript
// Au lieu de hardcoder repeat(2, ...), calculer dynamiquement
const laserGridColumns = TOTAL_LASER_ROOMS === 1 
  ? '1fr' 
  : TOTAL_LASER_ROOMS === 2 
    ? '2fr 1fr' // 66% / 33%
    : `repeat(${TOTAL_LASER_ROOMS}, 1fr)` // Égales si 3+
```

**Largeur des colonnes** :
- 1 salle → 100%
- 2 salles → L1 = 66%, L2 = 33%
- 3+ salles → égales (33.3% chacune)

## 10. SIMPLIFICATION VISUELLE

### Objectif
Pas de badges, pas de changement de couleur automatique, garder l'interface simple.

### Ce qu'on NE fait PAS :
- Pas de codage couleur orange/rouge pour limites
- Pas de badges "x résa" ou icônes
- Pas de changement de couleur selon l'état

### Ce qu'on garde :
- Couleurs choisies manuellement (vert/bleu/autre)
- Contour gris autour des réservations
- Quadrillage simple
- Affichage Nom-XPers

## Fichiers principaux à modifier

1. **`src/app/admin/page.tsx`** (lignes 1526-2770)
   - Refonte `getSegmentsForCellLaser` pour retourner tableau
   - Modification affichage LASER cells pour côte à côte
   - Ajout boutons rétractables
   - Calcul colonnes dynamique
   - Fonction `reorganizeLaserDay`

2. **`src/app/admin/components/BookingModal.tsx`** (lignes 1400-1700, 2200-2400)
   - Ajout champs manuels Grand/Petit/Maxi laby
   - Popup spare vests
   - Fonction `suggestLaserAlternatives`
   - Validation stricte vestes

3. **`src/app/admin/components/SettingsModal.tsx`** (lignes 450-650)
   - Nouveaux paramètres LASER
   - Toggle spare vests
   - Seuil groupe seul

4. **`src/lib/supabase/types.ts`** (ligne 60)
   - Nouveaux champs BranchSettings

5. **`src/hooks/useLaserRooms.ts`** (ligne 168)
   - Déjà corrigé (filtre par branche)

## Ordre d'implémentation recommandé

1. **D'abord** : Paramètres et types (SettingsModal + types.ts)
2. **Ensuite** : Affichage côte à côte (page.tsx - segments)
3. **Puis** : Allocation intelligente (findBestLaserRoom)
4. **Après** : Champs manuels (BookingModal - override)
5. **Enfin** : Propositions alternatives et réorganisation

## Points d'attention

- **Compatibilité** : Tester avec 1, 2, 3 salles LASER
- **Performance** : `getSegmentsForCellLaser` appelé souvent, garder optimisé
- **Data integrity** : Ne jamais perdre une réservation dans le système
- **UX** : Toujours montrer ce qui se passe (pas de disparition silencieuse)

## Todos

- [ ] Ajouter les nouveaux paramètres LASER dans SettingsModal et types (vestes, spare, seuil)
- [ ] Refondre getSegmentsForCellLaser pour retourner toutes les réservations (tableau)
- [ ] Implémenter l'affichage côte à côte des réservations LASER (flex row, division horizontale)
- [ ] Ajouter les 3 boutons rétractables (ACTIVE/LASER/ROOMS) avec état et toggle
- [ ] Améliorer findBestLaserRoom avec logique de seuil et optimisation d'espace
- [ ] Ajouter champs manuels Grand/Petit/Maxi laby dans BookingModal
- [ ] Implémenter popup spare vests quand limite principale atteinte
- [ ] Créer fonction suggestLaserAlternatives avec propositions de décalage/fusion
- [ ] Implémenter bouton 'Réorganiser la journée' avec optimisation globale
