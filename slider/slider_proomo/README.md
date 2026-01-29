# Split Hero Slider - Laser City + Active Games

## Fichiers

- **SplitHeroSection.tsx** - Le composant React du slider split-screen
- **laser-city-bg.jpg** - Image de fond pour le côté Laser City

## Côté Gauche - LASER CITY
- Image de fond: laser-city-bg.jpg
- Titre: לייזר סיטי (blanc avec glow cyan)
- Sous-titre: חוויה בלתי נשכחת (cyan #00D4FF)
- Description: לייזר סיטי מביא לישראל את חווית הלייזר טאג האולטימטיבית...
- Boutons: 2 boutons identiques cyan avec bordure
- Animation scroll: flèche blanche

## Côté Droit - ACTIVE GAMES
- Vidéo de fond: /videos/grid.mp4
- Utilise les translations du système
- Police: Orbitron
- Couleurs: magenta (#FF00E5) et cyan (#08F7FE)
- Boutons: glow-button class

## Animation
- Hover sur chaque côté: agrandit à 60% / réduit l'autre à 40%
- Barre de séparation suit le mouvement
- Transition smooth de 0.6s

## Dépendances
- framer-motion
- lucide-react (pour ChevronDown)
- useState pour gérer leftWidth
