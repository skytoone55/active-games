/**
 * API pour l'assistant IA Clara
 * - Répond naturellement aux questions
 * - Garde une mémoire de conversation via Supabase
 * - N'utilise les tools que pour les vraies ACTIONS (fermer, annuler, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import { CLARA_SCHEMA_SUMMARY } from '@/lib/clara/supabase-schema'

// Tools UNIQUEMENT pour les vraies actions (pas pour les questions!)
const ACTION_TOOLS = [
  {
    name: 'close_orders',
    description: 'Fermer des commandes terminées. Utiliser SEULEMENT si l\'utilisateur demande explicitement de fermer des commandes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        order_ids: { type: 'array', items: { type: 'string' }, description: 'IDs des commandes à fermer' },
        reason: { type: 'string', description: 'Raison' }
      },
      required: ['order_ids']
    }
  },
  {
    name: 'cancel_orders',
    description: 'Annuler des commandes. Utiliser SEULEMENT si l\'utilisateur demande explicitement d\'annuler.',
    input_schema: {
      type: 'object' as const,
      properties: {
        order_ids: { type: 'array', items: { type: 'string' }, description: 'IDs des commandes' },
        reason: { type: 'string', description: 'Raison' }
      },
      required: ['order_ids', 'reason']
    }
  },
  {
    name: 'fix_payment_status',
    description: 'Corriger les statuts de paiement incohérents. Utiliser SEULEMENT si demandé.',
    input_schema: {
      type: 'object' as const,
      properties: {
        order_ids: { type: 'array', items: { type: 'string' }, description: 'IDs des commandes' }
      },
      required: ['order_ids']
    }
  }
]

interface ActionResult {
  success: boolean
  message: string
  details?: Record<string, unknown>
}

// Exécuter une action
async function executeAction(
  actionName: string,
  params: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<ActionResult> {
  console.log(`[Clara] Executing ${actionName}:`, params)

  switch (actionName) {
    case 'close_orders': {
      const orderIds = params.order_ids as string[]
      const reason = params.reason as string || 'Fermé par Clara'
      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: userId, notes: reason })
        .in('id', orderIds)
        .select()
      if (error) return { success: false, message: `Erreur: ${error.message}` }
      return { success: true, message: `${data?.length || 0} commande(s) fermée(s).`, details: { closed: data?.length || 0 } }
    }

    case 'cancel_orders': {
      const orderIds = params.order_ids as string[]
      const reason = params.reason as string
      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: reason })
        .in('id', orderIds)
        .select()
      if (error) return { success: false, message: `Erreur: ${error.message}` }
      return { success: true, message: `${data?.length || 0} commande(s) annulée(s).`, details: { cancelled: data?.length || 0 } }
    }

    case 'fix_payment_status': {
      const orderIds = params.order_ids as string[]
      let fixed = 0
      for (const orderId of orderIds) {
        const { data: order } = await supabase
          .from('orders')
          .select('id, total_amount, paid_amount, payment_status')
          .eq('id', orderId)
          .single()
        if (order) {
          let newStatus = 'unpaid'
          if (order.paid_amount >= order.total_amount && order.total_amount > 0) newStatus = 'fully_paid'
          else if (order.paid_amount > 0) newStatus = 'deposit_paid'
          if (newStatus !== order.payment_status) {
            await supabase.from('orders').update({ payment_status: newStatus }).eq('id', orderId)
            fixed++
          }
        }
      }
      return { success: true, message: `${fixed} statut(s) corrigé(s).`, details: { fixed } }
    }

    default:
      return { success: false, message: `Action inconnue: ${actionName}` }
  }
}

// Récupérer les données business pour le contexte
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getBusinessContext(supabase: any, branchId?: string): Promise<string> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)

  // Commandes du mois
  let ordersQuery = supabase
    .from('orders')
    .select('id, request_reference, total_amount, paid_amount, payment_status, status, order_type, created_at, customer_first_name, customer_last_name')
    .gte('created_at', startOfMonth.toISOString())
    .order('created_at', { ascending: false })
    .limit(100)
  if (branchId && branchId !== 'all') ordersQuery = ordersQuery.eq('branch_id', branchId)
  const { data: orders } = await ordersQuery

  // Stats calculées
  const totalOrders = orders?.length || 0
  const totalRevenue = orders?.reduce((s: number, o: { total_amount: number | null }) => s + (o.total_amount || 0), 0) || 0
  const paidRevenue = orders?.reduce((s: number, o: { paid_amount: number | null }) => s + (o.paid_amount || 0), 0) || 0

  const todayOrders = orders?.filter((o: { created_at: string }) => new Date(o.created_at) >= startOfToday) || []
  const yesterdayOrders = orders?.filter((o: { created_at: string }) => {
    const d = new Date(o.created_at)
    return d >= startOfYesterday && d < startOfToday
  }) || []

  const todayCA = todayOrders.reduce((s: number, o: { total_amount: number | null }) => s + (o.total_amount || 0), 0)
  const yesterdayCA = yesterdayOrders.reduce((s: number, o: { total_amount: number | null }) => s + (o.total_amount || 0), 0)

  // Problèmes détectés
  const unpaidOld = orders?.filter((o: { payment_status: string; status: string; created_at: string }) => {
    const days = (Date.now() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24)
    return o.payment_status === 'unpaid' && ['pending', 'confirmed'].includes(o.status) && days > 7
  }) || []

  const statusMismatch = orders?.filter((o: { total_amount: number | null; paid_amount: number | null; payment_status: string }) => {
    if ((o.paid_amount || 0) >= (o.total_amount || 0) && (o.total_amount || 0) > 0 && o.payment_status !== 'fully_paid') return true
    if ((o.paid_amount || 0) > 0 && (o.paid_amount || 0) < (o.total_amount || 0) && o.payment_status !== 'deposit_paid') return true
    return false
  }) || []

  const fullyPaidNotClosed = orders?.filter((o: { payment_status: string; status: string }) =>
    o.payment_status === 'fully_paid' && o.status === 'confirmed'
  ) || []

  return `
DONNÉES ACTUELLES (${now.toLocaleDateString('fr-FR')}):

📊 CE MOIS:
- Commandes: ${totalOrders}
- CA total: ${totalRevenue.toLocaleString()}₪
- Encaissé: ${paidRevenue.toLocaleString()}₪
- En attente: ${(totalRevenue - paidRevenue).toLocaleString()}₪

📅 AUJOURD'HUI: ${todayOrders.length} commandes, ${todayCA.toLocaleString()}₪
📅 HIER: ${yesterdayOrders.length} commandes, ${yesterdayCA.toLocaleString()}₪

⚠️ PROBLÈMES DÉTECTÉS:
- Commandes non payées +7j: ${unpaidOld.length}
- Incohérences paiement: ${statusMismatch.length}
- Payées non fermées: ${fullyPaidNotClosed.length}

${unpaidOld.length > 0 ? `\nCommandes impayées (+7j):\n${unpaidOld.slice(0, 5).map((o: { request_reference: string; total_amount: number | null; id: string }) => `- ${o.request_reference}: ${o.total_amount}₪ (ID: ${o.id})`).join('\n')}` : ''}
${statusMismatch.length > 0 ? `\nIncohérences:\n${statusMismatch.slice(0, 5).map((o: { request_reference: string; paid_amount: number | null; total_amount: number | null; payment_status: string; id: string }) => `- ${o.request_reference}: payé ${o.paid_amount}/${o.total_amount}₪, statut "${o.payment_status}" (ID: ${o.id})`).join('\n')}` : ''}
${fullyPaidNotClosed.length > 0 ? `\nÀ fermer:\n${fullyPaidNotClosed.slice(0, 5).map((o: { request_reference: string; total_amount: number | null; id: string }) => `- ${o.request_reference}: ${o.total_amount}₪ (ID: ${o.id})`).join('\n')}` : ''}

DERNIÈRES COMMANDES:
${orders?.slice(0, 10).map((o: { request_reference: string; total_amount: number | null; paid_amount: number | null; payment_status: string; status: string; created_at: string; customer_first_name: string; customer_last_name: string }) =>
  `- ${o.request_reference}: ${o.total_amount}₪ (payé: ${o.paid_amount || 0}₪) - ${o.status} - ${o.customer_first_name} ${o.customer_last_name}`
).join('\n') || 'Aucune'}
`
}

// Appeler Claude avec l'historique de conversation
async function callClaude(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  useTools: boolean = false
) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY non configurée')

  const body: Record<string, unknown> = {
    model: 'claude-haiku-3-5-20241022',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map(m => ({ role: m.role, content: m.content }))
  }

  // N'ajouter les tools que si explicitement demandé
  if (useTools) {
    body.tools = ACTION_TOOLS
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

// Détecter si le message demande une action
function isActionRequest(message: string): boolean {
  const actionKeywords = [
    'ferme', 'fermer', 'close',
    'annule', 'annuler', 'cancel',
    'corrige', 'corriger', 'fix',
    'nettoie', 'nettoyer', 'clean',
    'supprime', 'supprimer', 'delete',
    'exécute', 'execute', 'fais-le', 'fais le', 'vas-y', 'ok fais', 'oui fais'
  ]
  const lower = message.toLowerCase()
  return actionKeywords.some(k => lower.includes(k))
}

export async function POST(request: NextRequest) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('orders', 'view')
    if (!success || !user) return errorResponse

    const body = await request.json()
    const {
      question,
      conversationId,
      branchId,
      executeActions = false,
      pendingAction = null
    } = body

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceRoleClient() as any

    // Exécution d'une action en attente
    if (pendingAction && executeActions) {
      const result = await executeAction(pendingAction.name, pendingAction.params, supabase, user.id)

      // Sauvegarder le résultat dans la conversation
      if (conversationId) {
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: result.message,
          metadata: { actionResult: result }
        })
      }

      return NextResponse.json({ success: true, actionExecuted: true, actionResult: result })
    }

    if (!question) {
      return NextResponse.json({ success: false, error: 'Question requise' }, { status: 400 })
    }

    // Récupérer ou créer une conversation
    let convId = conversationId
    if (!convId) {
      // Chercher une conversation active ou en créer une
      const { data: activeConv } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (activeConv) {
        convId = activeConv.id
      } else {
        // Créer une nouvelle conversation
        const { data: newConv } = await supabase
          .from('ai_conversations')
          .insert({ user_id: user.id, title: question.substring(0, 50) })
          .select()
          .single()
        convId = newConv?.id
      }
    }

    // Récupérer l'historique de la conversation (limité aux 20 derniers messages)
    const { data: history } = await supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(20)

    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> =
      history?.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })) || []

    // Ajouter le message utilisateur
    conversationHistory.push({ role: 'user', content: question })

    // Sauvegarder le message utilisateur
    await supabase.from('ai_messages').insert({
      conversation_id: convId,
      role: 'user',
      content: question
    })

    // Récupérer le contexte business
    const businessContext = await getBusinessContext(supabase, branchId)

    // Construire le prompt système
    const systemPrompt = `Tu es Clara, l'assistante IA d'ActiveLaser. Tu es chaleureuse, naturelle et efficace.

PERSONNALITÉ:
- Parle de façon naturelle, comme une collègue sympathique
- Sois concise mais complète
- Utilise des emojis avec modération pour être plus vivante
- Tutoie l'utilisateur naturellement

RÈGLES IMPORTANTES:
1. Pour les QUESTIONS (stats, infos, aide): Réponds directement et naturellement, SANS utiliser de tools
2. Pour les ACTIONS (fermer, annuler, corriger): Utilise les tools appropriés
3. Utilise les données fournies pour répondre précisément
4. Si tu ne sais pas, dis-le honnêtement

${businessContext}

STRUCTURE DE LA BASE DE DONNÉES:
${CLARA_SCHEMA_SUMMARY}

AIDE SUR LE LOGICIEL:
- Agenda: Page principale avec calendrier, cliquer sur un créneau pour créer une réservation
- Commandes: Liste des commandes en ligne, filtrable par statut/date/branche
- Clients: Base de contacts avec historique des réservations
- Équipe: Gestion des utilisateurs et permissions par rôle
- Statistiques: Tableaux de bord avec KPIs et graphiques
- Paramètres: Configuration branche, salles, tarifs, emails

WORKFLOW COMMANDES:
1. Client fait une demande → status "pending"
2. Agent confirme → status "confirmed", booking créé
3. Client paie → payment_status "fully_paid"
4. Événement terminé → status "closed"

AIDE TECHNIQUE:
- Créer commande: Cliquer sur un créneau dans l'agenda
- Paiement: Section "Paiements" dans la fiche commande
- Remboursement: Icône à côté du paiement
- Fermer commande: Bouton "Fermer" quand payé et terminé
- Voir logs: Menu Logs pour l'historique des actions`

    // Détecter si c'est une demande d'action
    const wantsAction = isActionRequest(question)

    // Appeler Claude
    const response = await callClaude(systemPrompt, conversationHistory, wantsAction)

    // Traiter la réponse
    let answer = ''
    let proposedAction: { name: string; params: Record<string, unknown>; description: string } | null = null

    for (const content of response.content) {
      if (content.type === 'text') {
        answer += content.text
      } else if (content.type === 'tool_use') {
        proposedAction = {
          name: content.name,
          params: content.input as Record<string, unknown>,
          description: getActionDescription(content.name, content.input as Record<string, unknown>)
        }
      }
    }

    // Si pas de réponse texte mais une action, générer un message
    if (!answer && proposedAction) {
      answer = `Je vais ${proposedAction.description.toLowerCase()}. Tu veux que je procède ?`
    }

    // Sauvegarder la réponse de Clara
    await supabase.from('ai_messages').insert({
      conversation_id: convId,
      role: 'assistant',
      content: answer,
      metadata: proposedAction ? { proposedAction } : {}
    })

    return NextResponse.json({
      success: true,
      answer,
      proposedAction,
      conversationId: convId
    })

  } catch (error) {
    console.error('[Clara] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne', answer: "Désolée, j'ai eu un souci. Réessaie !" },
      { status: 500 }
    )
  }
}

function getActionDescription(actionName: string, params: Record<string, unknown>): string {
  switch (actionName) {
    case 'close_orders':
      return `Fermer ${(params.order_ids as string[])?.length || 0} commande(s)`
    case 'cancel_orders':
      return `Annuler ${(params.order_ids as string[])?.length || 0} commande(s)`
    case 'fix_payment_status':
      return `Corriger le statut de ${(params.order_ids as string[])?.length || 0} commande(s)`
    default:
      return actionName
  }
}

// Endpoint pour récupérer l'historique d'une conversation
export async function GET(request: NextRequest) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('orders', 'view')
    if (!success || !user) return errorResponse

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceRoleClient() as any

    if (conversationId) {
      // Récupérer les messages d'une conversation spécifique
      const { data: messages } = await supabase
        .from('ai_messages')
        .select('id, role, content, metadata, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      return NextResponse.json({ success: true, messages })
    } else {
      // Récupérer la conversation active
      const { data: activeConv } = await supabase
        .from('ai_conversations')
        .select('id, title, created_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (activeConv) {
        const { data: messages } = await supabase
          .from('ai_messages')
          .select('id, role, content, metadata, created_at')
          .eq('conversation_id', activeConv.id)
          .order('created_at', { ascending: true })

        return NextResponse.json({
          success: true,
          conversationId: activeConv.id,
          title: activeConv.title,
          messages
        })
      }

      return NextResponse.json({ success: true, conversationId: null, messages: [] })
    }
  } catch (error) {
    console.error('[Clara] GET Error:', error)
    return NextResponse.json({ success: false, error: 'Erreur' }, { status: 500 })
  }
}

// Endpoint pour créer une nouvelle conversation
export async function DELETE(request: NextRequest) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('orders', 'view')
    if (!success || !user) return errorResponse

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceRoleClient() as any

    // Désactiver toutes les conversations existantes
    await supabase
      .from('ai_conversations')
      .update({ is_active: false })
      .eq('user_id', user.id)

    return NextResponse.json({ success: true, message: 'Nouvelle conversation prête' })
  } catch (error) {
    console.error('[Clara] DELETE Error:', error)
    return NextResponse.json({ success: false, error: 'Erreur' }, { status: 500 })
  }
}
