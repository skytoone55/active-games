# Active Laser - Système de Gestion de Réservations

Système complet de gestion de réservations pour Active Games / Laser City avec interface d'administration.

## 🚀 Installation Rapide

### Prérequis
- Node.js 18+ 
- npm ou yarn
- Accès à Supabase (les clés sont déjà configurées dans `.env.local`)

### Installation

1. **Cloner le projet**
```bash
git clone https://github.com/mymy770/activelaser.git
cd activelaser
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Les variables d'environnement sont déjà configurées**
Le fichier `.env.local` contient déjà toutes les clés Supabase nécessaires. Aucune configuration supplémentaire n'est requise.

4. **Lancer le serveur de développement**
```bash
npm run dev
```

5. **Ouvrir dans le navigateur**
- Page d'accueil : http://localhost:3000
- Interface admin : http://localhost:3000/admin

## 📁 Structure du Projet

```
activelaser/
├── src/
│   ├── app/
│   │   ├── admin/          # Interface d'administration
│   │   │   ├── page.tsx     # Page principale admin (agenda)
│   │   │   └── components/  # Composants admin
│   │   ├── page.tsx         # Page d'accueil publique
│   │   ├── layout.tsx       # Layout principal
│   │   └── globals.css      # Styles globaux
│   ├── components/          # Composants publics
│   ├── hooks/               # Hooks React personnalisés
│   ├── lib/                 # Utilitaires et configurations
│   │   ├── supabase/        # Client Supabase
│   │   └── scheduler/       # Moteur de planification
│   ├── i18n/                # Traductions (EN, FR, HE)
│   └── data/                # Données statiques
├── public/                  # Assets (images, vidéos)
├── .env.local              # Variables d'environnement (déjà configuré)
└── package.json            # Dépendances
```

## 🛠️ Scripts Disponibles

- `npm run dev` - Lance le serveur de développement (port 3000)
- `npm run dev:3003` - Lance le serveur sur le port 3003
- `npm run build` - Build de production
- `npm run start` - Lance le serveur de production
- `npm run lint` - Vérifie le code avec ESLint

## 🔐 Configuration Supabase

Les clés Supabase sont déjà configurées dans `.env.local` :
- `NEXT_PUBLIC_SUPABASE_URL` - URL du projet
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Clé publique
- `SUPABASE_SERVICE_ROLE_KEY` - Clé de service (admin)

**Note** : Ces clés sont incluses dans le dépôt pour faciliter le démarrage. En production, utilisez des variables d'environnement sécurisées.

## 📝 Fonctionnalités

### Interface Admin (`/admin`)
- 📅 Agenda avec 3 grilles (ACTIVE, LASER, ROOMS)
- ➕ Création/Modification de réservations
- 👥 Gestion des contacts
- 🏢 Gestion multi-branches
- ⚙️ Paramètres configurables
- 📊 Calcul d'overbooking automatique

### Page Publique (`/`)
- 🎮 Présentation des jeux
- 📍 Informations sur les branches
- 💬 Formulaire de contact
- 🌐 Support multi-langues (EN, FR, HE)

## 🗄️ Base de Données

Le projet utilise Supabase (PostgreSQL) avec les tables suivantes :
- `bookings` - Réservations
- `game_sessions` - Sessions de jeu
- `contacts` - Contacts clients
- `branches` - Succursales
- `rooms` - Salles d'anniversaire
- `laser_rooms` - Salles laser
- `settings` - Paramètres par branche

## 🚨 Dépannage

### Le serveur ne démarre pas
- Vérifiez que Node.js 18+ est installé : `node --version`
- Supprimez `node_modules` et `.next` puis relancez `npm install`

### Erreur Supabase
- Vérifiez que `.env.local` existe et contient les bonnes clés
- Redémarrez le serveur après modification de `.env.local`

### Port déjà utilisé
- Utilisez `npm run dev:3003` pour un autre port
- Ou tuez le processus : `lsof -ti:3000 | xargs kill`

## 📄 Licence

Propriétaire - Active Games World

## 👥 Support

Pour toute question, contactez l'équipe de développement.
