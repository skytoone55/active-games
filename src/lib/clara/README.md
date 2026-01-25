# Clara AI - Assistant Virtuel Active Games

## Vue d'ensemble

Clara est l'assistante IA intégrée à Active Games, utilisant **Gemini 1.5 Flash** via le **Vercel AI SDK**.

### Deux contextes d'utilisation :

1. **Chat Public** - Widget sur le site web
   - Accueil des visiteurs
   - Infos sur les activités, prix, horaires
   - Vérification des disponibilités
   - Orientation vers la réservation

2. **Chat CRM** - Interface admin
   - Recherche de commandes/clients
   - Statistiques business
   - Assistance aux agents

## Installation

```bash
# Installer les dépendances
npm install ai @ai-sdk/google zod

# Ou avec pnpm
pnpm add ai @ai-sdk/google zod
```

## Configuration

### Variables d'environnement

```env
# Google AI (Gemini)
GOOGLE_AI_API_KEY=your_api_key_here
```

### Migration Supabase

Exécuter la migration : `supabase/migrations/20260124_clara_settings.sql`

Cette migration crée :
- Table `system_settings` (config globale)
- Table `public_conversations` (chats visiteurs)
- Table `public_messages` (messages visiteurs)
- Table `clara_rate_limits` (rate limiting)
- Colonnes `clara_enabled` et `clara_settings` dans `branch_settings`

## Architecture

```
src/lib/clara/
├── index.ts          # Exports principaux
├── gemini.ts         # Client Gemini + streaming
├── service.ts        # Service d'orchestration
├── prompts.ts        # Prompts système
├── tools/
│   └── index.ts      # Function calling (tools)
└── supabase-schema.ts # Documentation DB pour Clara
```

## API Endpoints

### POST /api/clara/chat (CRM)
Chat pour utilisateurs authentifiés.

```typescript
// Request
{
  conversationId?: string,  // Optionnel, créé si absent
  message: string,
  branchId?: string
}

// Response: Server-Sent Events (SSE)
data: { type: 'conversation', id: 'uuid' }
data: { type: 'text', content: 'Bonjour...' }
data: { type: 'text', content: ' comment...' }
data: { type: 'done' }
```

### POST /api/public/clara (Public)
Chat pour visiteurs du site.

```typescript
// Request
{
  sessionId: string,  // ID session navigateur
  message: string,
  branchId?: string,
  locale?: 'he' | 'en' | 'fr'
}

// Response: Server-Sent Events (SSE)
data: { type: 'init', conversationId: 'uuid', remaining: 28 }
data: { type: 'text', content: 'שלום...' }
data: { type: 'done' }
```

## Tools (Function Calling)

### Tools Publics
- `getBranchInfo` - Infos branches (adresse, horaires)
- `getPricing` - Tarifs et formules
- `checkAvailability` - Vérifier disponibilités
- `getEventRooms` - Salles d'événements

### Tools CRM (en plus des publics)
- `searchOrders` - Rechercher commandes
- `searchContacts` - Rechercher clients
- `getStats` - Statistiques business
- `getOrderDetails` - Détails commande

## Rate Limiting

- **Public** : 30 requêtes/minute par IP+session
- **CRM** : Pas de limite (utilisateurs authentifiés)

## Exemple d'utilisation (Frontend)

```typescript
// Initialiser le chat
const response = await fetch('/api/public/clara?locale=he')
const { welcomeMessage, quickReplies } = await response.json()

// Envoyer un message avec streaming
const response = await fetch('/api/public/clara', {
  method: 'POST',
  body: JSON.stringify({
    sessionId: 'unique-session-id',
    message: 'מה שעות הפעילות?',
    locale: 'he'
  })
})

// Lire le stream SSE
const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const text = decoder.decode(value)
  const lines = text.split('\n').filter(line => line.startsWith('data: '))

  for (const line of lines) {
    const data = JSON.parse(line.substring(6))
    if (data.type === 'text') {
      // Afficher le texte progressivement
      appendToChat(data.content)
    }
  }
}
```

## Sécurité

- Rate limiting sur les endpoints publics
- Authentification JWT pour le CRM
- RLS Supabase sur toutes les tables
- Pas d'accès aux données sensibles via tools publics
- Logs des conversations pour audit
