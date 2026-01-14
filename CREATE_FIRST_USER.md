# 🔐 Créer le Premier Utilisateur Admin

Vous avez besoin de créer un utilisateur pour vous connecter à l'application.

## 🎯 Méthode 1 : Via le Dashboard Supabase (Recommandé - Plus Simple)

1. **Allez sur https://supabase.com/dashboard**
2. **Sélectionnez votre projet** (`zapwlcrjnabrfhoxfgqo`)
3. **Allez dans "Authentication"** (menu de gauche)
4. **Cliquez sur "Users"**
5. **Cliquez sur "Add user"** (ou "Create new user")
6. **Remplissez :**
   - Email : `admin@votredomaine.com` (ou l'email que vous voulez)
   - Password : Choisissez un mot de passe (min 6 caractères)
   - **Cochez "Auto Confirm User"** (pour éviter la confirmation email)
7. **Cliquez sur "Create user"**

8. **Créer le profil dans la table `profiles` :**
   - Allez dans **"Table Editor"**
   - Sélectionnez la table **`profiles`**
   - Cliquez sur **"Insert row"**
   - Remplissez :
     - `id` : Copiez l'ID de l'utilisateur créé (depuis Authentication > Users)
     - `role` : `super_admin`
     - `full_name` : Votre nom (optionnel)
   - Cliquez sur **"Save"**

## 🎯 Méthode 2 : Via Script Node.js

```bash
cd /Users/jeremy/Desktop/cursor/claude-agenda
NEXT_PUBLIC_SUPABASE_URL=https://zapwlcrjnabrfhoxfgqo.supabase.co SUPABASE_SERVICE_ROLE_KEY=sb_secret_G1LaEDDOvFm8_ASVRousRA_05co6r_O npx tsx scripts/create-admin-user.ts
```

Le script vous demandera :
- Email
- Mot de passe

Il créera automatiquement :
- L'utilisateur dans Supabase Auth
- Le profil dans la table `profiles` avec le rôle `super_admin`

## ✅ Après la création

1. Allez sur http://localhost:3000/admin/login (ou votre URL)
2. Connectez-vous avec :
   - Email : celui que vous avez créé
   - Mot de passe : celui que vous avez défini

## 🔑 Rôles disponibles

- `super_admin` : Accès à toutes les branches
- `branch_admin` : Admin d'une ou plusieurs branches
- `agent` : Agent avec accès limité

Pour le premier utilisateur, utilisez `super_admin`.
