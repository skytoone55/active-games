/**
 * API pour l'assistant IA admin virtuel
 * Peut répondre aux questions ET proposer/exécuter des actions
 * Utilise Claude via l'API Anthropic avec tool_use
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyApiPermission } from '@/lib/permissions'
import Anthropic from '@anthropic-ai/sdk'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
})

// Define the tools/actions the AI can propose
const AI_TOOLS: Anthropic.Tool[] = [
  {
    name: 'close_orders',
    description: 'Fermer des commandes terminées (paiement complet reçu). Utile pour nettoyer les commandes qui sont fully_paid mais encore en statut confirmed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        order_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Liste des IDs de commandes à fermer'
        },
        reason: {
          type: 'string',
          description: 'Raison de la fermeture'
        }
      },
      required: ['order_ids']
    }
  },
  {
    name: 'cancel_orders',
    description: 'Annuler des commandes. Utile pour les commandes non payées depuis longtemps ou demandes d\'annulation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        order_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Liste des IDs de commandes à annuler'
        },
        reason: {
          type: 'string',
          description: 'Raison de l\'annulation'
        }
      },
      required: ['order_ids', 'reason']
    }
  },
  {
    name: 'send_payment_reminder',
    description: 'Envoyer un rappel de paiement aux clients avec des commandes non payées.',
    input_schema: {
      type: 'object' as const,
      properties: {
        order_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Liste des IDs de commandes pour lesquelles envoyer un rappel'
        }
      },
      required: ['order_ids']
    }
  },
  {
    name: 'fix_payment_status',
    description: 'Corriger le statut de paiement des commandes où il y a une incohérence entre le montant payé et le statut.',
    input_schema: {
      type: 'object' as const,
      properties: {
        order_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Liste des IDs de commandes à corriger'
        }
      },
      required: ['order_ids']
    }
  },
  {
    name: 'merge_duplicate_contacts',
    description: 'Fusionner des contacts en double (même email ou téléphone).',
    input_schema: {
      type: 'object' as const,
      properties: {
        keep_contact_id: {
          type: 'string',
          description: 'ID du contact à garder'
        },
        merge_contact_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs des contacts à fusionner dans le contact principal'
        }
      },
      required: ['keep_contact_id', 'merge_contact_ids']
    }
  },
  {
    name: 'clean_old_pending_orders',
    description: 'Nettoyer les commandes en attente depuis plus de X jours sans paiement.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days_old: {
          type: 'number',
          description: 'Nombre de jours depuis la création'
        },
        action: {
          type: 'string',
          enum: ['cancel', 'archive'],
          description: 'Action à effectuer: cancel (annuler) ou archive (archiver)'
        }
      },
      required: ['days_old', 'action']
    }
  },
  {
    name: 'get_help',
    description: 'Fournir de l\'aide sur l\'utilisation du logiciel ActiveLaser.',
    input_schema: {
      type: 'object' as const,
      properties: {
        topic: {
          type: 'string',
          description: 'Sujet sur lequel l\'utilisateur a besoin d\'aide'
        }
      },
      required: ['topic']
    }
  },
  {
    name: 'analyze_data',
    description: 'Analyser les données et fournir un rapport. Utiliser pour les questions purement statistiques sans action.',
    input_schema: {
      type: 'object' as const,
      properties: {
        analysis_type: {
          type: 'string',
          description: 'Type d\'analyse demandée'
        }
      },
      required: ['analysis_type']
    }
  }
]

// Helper to get date range
function getDateRange(range: string): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  let start = new Date(now)
  start.setHours(0, 0, 0, 0)

  switch (range) {
    case 'today':
      break
    case 'week':
      start.setDate(start.getDate() - start.getDay())
      break
    case 'month':
      start.setDate(1)
      break
    case 'quarter':
      const quarter = Math.floor(start.getMonth() / 3)
      start.setMonth(quarter * 3, 1)
      break
    case 'year':
      start.setMonth(0, 1)
      break
    case 'all':
      start = new Date('2020-01-01')
      break
  }

  return { start, end }
}

interface ActionResult {
  success: boolean
  message: string
  details?: Record<string, unknown>
}

// Execute an action
async function executeAction(
  actionName: string,
  params: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string
): Promise<ActionResult> {
  console.log(`[AI-ACTION] Executing ${actionName}:`, params)

  switch (actionName) {
    case 'close_orders': {
      const orderIds = params.order_ids as string[]
      const reason = params.reason as string || 'Fermé par assistant IA'

      const { data, error } = await (supabase as unknown as {
        from: (table: string) => {
          update: (data: Record<string, unknown>) => {
            in: (column: string, values: string[]) => {
              select: () => Promise<{ data: unknown[]; error: Error | null }>
            }
          }
        }
      }).from('orders')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: userId,
          notes: reason
        })
        .in('id', orderIds)
        .select()

      if (error) {
        return { success: false, message: `Erreur: ${error.message}` }
      }

      return {
        success: true,
        message: `${(data as unknown[])?.length || 0} commande(s) fermée(s) avec succès.`,
        details: { closed: (data as unknown[])?.length || 0 }
      }
    }

    case 'cancel_orders': {
      const orderIds = params.order_ids as string[]
      const reason = params.reason as string

      const { data, error } = await (supabase as unknown as {
        from: (table: string) => {
          update: (data: Record<string, unknown>) => {
            in: (column: string, values: string[]) => {
              select: () => Promise<{ data: unknown[]; error: Error | null }>
            }
          }
        }
      }).from('orders')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason
        })
        .in('id', orderIds)
        .select()

      if (error) {
        return { success: false, message: `Erreur: ${error.message}` }
      }

      return {
        success: true,
        message: `${(data as unknown[])?.length || 0} commande(s) annulée(s). Raison: ${reason}`,
        details: { cancelled: (data as unknown[])?.length || 0 }
      }
    }

    case 'fix_payment_status': {
      const orderIds = params.order_ids as string[]
      let fixed = 0

      for (const orderId of orderIds) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: order } = await (supabase as any)
          .from('orders')
          .select('id, total_amount, paid_amount, payment_status')
          .eq('id', orderId)
          .single()

        if (order) {
          let newStatus = 'unpaid'
          if (order.paid_amount >= order.total_amount && order.total_amount > 0) {
            newStatus = 'fully_paid'
          } else if (order.paid_amount > 0) {
            newStatus = 'deposit_paid'
          }

          if (newStatus !== order.payment_status) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from('orders')
              .update({ payment_status: newStatus })
              .eq('id', orderId)
            fixed++
          }
        }
      }

      return {
        success: true,
        message: `${fixed} statut(s) de paiement corrigé(s).`,
        details: { fixed }
      }
    }

    case 'clean_old_pending_orders': {
      const daysOld = params.days_old as number
      const action = params.action as string

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: oldOrders } = await (supabase as any)
        .from('orders')
        .select('id')
        .eq('payment_status', 'unpaid')
        .in('status', ['pending', 'confirmed'])
        .lt('created_at', cutoffDate.toISOString())

      if (!oldOrders || oldOrders.length === 0) {
        return { success: true, message: `Aucune commande de plus de ${daysOld} jours en attente de paiement.` }
      }

      const orderIds = oldOrders.map((o: { id: string }) => o.id)
      const newStatus = action === 'cancel' ? 'cancelled' : 'archived'

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('orders')
        .update({
          status: newStatus,
          [`${action === 'cancel' ? 'cancelled' : 'archived'}_at`]: new Date().toISOString(),
          notes: `Auto-${action === 'cancel' ? 'annulé' : 'archivé'} par assistant IA (${daysOld}+ jours sans paiement)`
        })
        .in('id', orderIds)

      return {
        success: true,
        message: `${orderIds.length} commande(s) ${action === 'cancel' ? 'annulée(s)' : 'archivée(s)'}.`,
        details: { count: orderIds.length, action }
      }
    }

    case 'send_payment_reminder': {
      // For now, just return info - actual email sending would need implementation
      const orderIds = params.order_ids as string[]
      return {
        success: true,
        message: `Rappels de paiement préparés pour ${orderIds.length} commande(s). (Envoi email à implémenter)`,
        details: { orderIds }
      }
    }

    case 'merge_duplicate_contacts': {
      const keepId = params.keep_contact_id as string
      const mergeIds = params.merge_contact_ids as string[]

      // Update all orders to point to the kept contact
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updated } = await (supabase as any)
        .from('orders')
        .update({ contact_id: keepId })
        .in('contact_id', mergeIds)
        .select()

      // Delete the merged contacts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('contacts')
        .delete()
        .in('id', mergeIds)

      return {
        success: true,
        message: `${mergeIds.length} contact(s) fusionné(s). ${(updated as unknown[])?.length || 0} commande(s) mises à jour.`,
        details: { merged: mergeIds.length, ordersUpdated: (updated as unknown[])?.length || 0 }
      }
    }

    case 'get_help':
    case 'analyze_data':
      // These are informational, no action needed
      return { success: true, message: 'Information fournie dans la réponse.' }

    default:
      return { success: false, message: `Action inconnue: ${actionName}` }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { success, user, errorResponse } = await verifyApiPermission('orders', 'view')
    if (!success || !user) {
      return errorResponse
    }

    const body = await request.json()
    const { question, dateRange = 'month', branchId, executeActions = false, pendingAction = null } = body

    if (!question && !pendingAction) {
      return NextResponse.json({ success: false, error: 'Question required' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceRoleClient() as any
    const { start, end } = getDateRange(dateRange)

    // If we're executing a pending action
    if (pendingAction && executeActions) {
      const result = await executeAction(
        pendingAction.name,
        pendingAction.params,
        supabase,
        user.id
      )
      return NextResponse.json({
        success: true,
        actionExecuted: true,
        actionResult: result
      })
    }

    // Fetch all relevant data for the AI to analyze
    let ordersQuery = supabase
      .from('orders')
      .select(`
        id,
        request_reference,
        total_amount,
        paid_amount,
        payment_status,
        status,
        order_type,
        game_area,
        participants_count,
        created_at,
        booking_date,
        booking_time,
        branch_id,
        contact_id,
        created_by,
        customer_first_name,
        customer_last_name,
        customer_email,
        customer_phone
      `)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false })
      .limit(500)

    if (branchId && branchId !== 'all') {
      ordersQuery = ordersQuery.eq('branch_id', branchId)
    }

    const { data: orders } = await ordersQuery

    // Get payments data
    let paymentsQuery = supabase
      .from('payments')
      .select('id, amount, payment_method, payment_type, status, created_at, order_id')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    if (branchId && branchId !== 'all') {
      paymentsQuery = paymentsQuery.eq('branch_id', branchId)
    }

    const { data: payments } = await paymentsQuery

    // Get contacts
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, phone, email, created_at')
      .limit(1000)

    // Get branches
    const { data: branches } = await supabase
      .from('branches')
      .select('id, name')

    // Get users
    const { data: users } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')

    // Calculate summary stats for context
    const totalOrders = orders?.length || 0
    const totalRevenue = orders?.reduce((sum: number, o: { total_amount: number | null }) => sum + (o.total_amount || 0), 0) || 0
    const paidRevenue = orders?.reduce((sum: number, o: { paid_amount: number | null }) => sum + (o.paid_amount || 0), 0) || 0
    const totalClients = contacts?.length || 0

    const gameOrders = orders?.filter((o: { order_type: string }) => o.order_type === 'GAME').length || 0
    const eventOrders = orders?.filter((o: { order_type: string }) => o.order_type === 'EVENT').length || 0

    const todayOrders = orders?.filter((o: { created_at: string }) => {
      const d = new Date(o.created_at)
      const today = new Date()
      return d.toDateString() === today.toDateString()
    }).length || 0

    // Find potential issues
    const unpaidOldOrders = orders?.filter((o: { payment_status: string; status: string; created_at: string }) => {
      const daysSinceCreation = (Date.now() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24)
      return o.payment_status === 'unpaid' && ['pending', 'confirmed'].includes(o.status) && daysSinceCreation > 7
    }) || []

    const statusMismatches = orders?.filter((o: { total_amount: number | null; paid_amount: number | null; payment_status: string }) => {
      if ((o.paid_amount || 0) >= (o.total_amount || 0) && (o.total_amount || 0) > 0 && o.payment_status !== 'fully_paid') return true
      if ((o.paid_amount || 0) > 0 && (o.paid_amount || 0) < (o.total_amount || 0) && o.payment_status !== 'deposit_paid') return true
      return false
    }) || []

    const fullyPaidNotClosed = orders?.filter((o: { payment_status: string; status: string }) =>
      o.payment_status === 'fully_paid' && o.status === 'confirmed'
    ) || []

    // Find duplicate contacts (same phone or email)
    const duplicateContacts: { phone?: string; email?: string; ids: string[] }[] = []
    const phoneMap: Record<string, string[]> = {}
    const emailMap: Record<string, string[]> = {}

    contacts?.forEach((c: { id: string; phone: string | null; email: string | null }) => {
      if (c.phone) {
        const normalized = c.phone.replace(/\D/g, '')
        if (!phoneMap[normalized]) phoneMap[normalized] = []
        phoneMap[normalized].push(c.id)
      }
      if (c.email) {
        const normalized = c.email.toLowerCase()
        if (!emailMap[normalized]) emailMap[normalized] = []
        emailMap[normalized].push(c.id)
      }
    })

    Object.entries(phoneMap).forEach(([phone, ids]) => {
      if (ids.length > 1) duplicateContacts.push({ phone, ids })
    })
    Object.entries(emailMap).forEach(([email, ids]) => {
      if (ids.length > 1) duplicateContacts.push({ email, ids })
    })

    // Build context for Claude
    const dataContext = `
DONNÉES DE L'APPLICATION ACTIVELASER (Période: ${dateRange})
============================================================

RÉSUMÉ:
- Total commandes: ${totalOrders}
- Chiffre d'affaires total: ${totalRevenue}₪
- CA encaissé: ${paidRevenue}₪
- CA en attente: ${totalRevenue - paidRevenue}₪
- Commandes Games: ${gameOrders}
- Commandes Events: ${eventOrders}
- Commandes aujourd'hui: ${todayOrders}
- Total clients: ${totalClients}

BRANCHES:
${branches?.map((b: { id: string; name: string }) => `- ${b.name} (ID: ${b.id})`).join('\n') || 'Aucune'}

UTILISATEURS:
${users?.map((u: { id: string; first_name: string; last_name: string }) => `- ${u.first_name} ${u.last_name}`).join('\n') || 'Aucun'}

PROBLÈMES DÉTECTÉS:
- Commandes non payées depuis +7 jours: ${unpaidOldOrders.length}
${unpaidOldOrders.slice(0, 5).map((o: { id: string; request_reference: string; total_amount: number | null; created_at: string }) =>
  `  * ${o.request_reference} (${o.total_amount}₪) - créée le ${new Date(o.created_at).toLocaleDateString('fr-FR')} - ID: ${o.id}`
).join('\n')}

- Incohérences statut paiement: ${statusMismatches.length}
${statusMismatches.slice(0, 5).map((o: { id: string; request_reference: string; paid_amount: number | null; total_amount: number | null; payment_status: string }) =>
  `  * ${o.request_reference}: payé ${o.paid_amount}/${o.total_amount}₪ mais statut "${o.payment_status}" - ID: ${o.id}`
).join('\n')}

- Commandes payées non fermées: ${fullyPaidNotClosed.length}
${fullyPaidNotClosed.slice(0, 5).map((o: { id: string; request_reference: string; total_amount: number | null }) =>
  `  * ${o.request_reference} (${o.total_amount}₪) - ID: ${o.id}`
).join('\n')}

- Contacts en double détectés: ${duplicateContacts.length}

DERNIÈRES COMMANDES (max 20):
${orders?.slice(0, 20).map((o: {
  id: string
  request_reference: string
  total_amount: number | null
  paid_amount: number | null
  payment_status: string
  status: string
  order_type: string
  created_at: string
  customer_first_name: string
  customer_last_name: string
}) =>
  `- ${o.request_reference}: ${o.total_amount}₪ (payé: ${o.paid_amount || 0}₪), ${o.payment_status}, ${o.status}, ${o.order_type}, ${new Date(o.created_at).toLocaleDateString('fr-FR')}, ${o.customer_first_name} ${o.customer_last_name} - ID: ${o.id}`
).join('\n') || 'Aucune'}

STATUTS DES COMMANDES:
${Object.entries(
  orders?.reduce((acc: Record<string, number>, o: { status: string }) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {}) || {}
).map(([status, count]) => `- ${status}: ${count}`).join('\n')}

MÉTHODES DE PAIEMENT:
${Object.entries(
  payments?.reduce((acc: Record<string, number>, p: { payment_method: string; amount: number }) => {
    acc[p.payment_method] = (acc[p.payment_method] || 0) + p.amount
    return acc
  }, {}) || {}
).map(([method, amount]) => `- ${method}: ${amount}₪`).join('\n')}

TOP 10 CLIENTS PAR CA:
${(() => {
  const clientRevenue: Record<string, { name: string; total: number; count: number }> = {}
  orders?.forEach((o: { contact_id: string | null; total_amount: number | null; customer_first_name: string; customer_last_name: string }) => {
    if (o.contact_id) {
      if (!clientRevenue[o.contact_id]) {
        clientRevenue[o.contact_id] = { name: `${o.customer_first_name} ${o.customer_last_name}`, total: 0, count: 0 }
      }
      clientRevenue[o.contact_id].total += o.total_amount || 0
      clientRevenue[o.contact_id].count++
    }
  })
  return Object.values(clientRevenue)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((c, i) => `${i + 1}. ${c.name}: ${c.total}₪ (${c.count} commandes)`)
    .join('\n')
})()}
`

    // Call Claude API with tools
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: `Tu es l'assistant IA admin virtuel pour ActiveLaser, une entreprise de loisirs (laser game et jeux actifs en salle).

Tu peux:
1. ANALYSER les données et répondre aux questions statistiques
2. PROPOSER des actions pour corriger des problèmes ou effectuer des tâches administratives
3. AIDER les utilisateurs à comprendre comment utiliser le logiciel

RÈGLES IMPORTANTES:
- Réponds toujours en français, de manière concise et professionnelle
- Utilise les chiffres exacts des données fournies
- Formate les montants en shekels (₪)
- Si tu proposes une action, utilise le tool approprié
- Pour les questions purement informatives, utilise analyze_data ou get_help
- Sois proactif: si tu détectes des problèmes dans les données, mentionne-les
- Si une action peut affecter beaucoup de données, préviens l'utilisateur

GUIDE D'UTILISATION DU LOGICIEL (pour get_help):
- Créer une commande: Cliquer sur un créneau dans l'agenda, remplir les infos client et réservation
- Paiement: Dans la fiche commande, section "Paiements", cliquer sur "Ajouter paiement"
- Remboursement: Dans la fiche commande, cliquer sur l'icône remboursement à côté du paiement
- Fermer une commande: Bouton "Fermer" quand le paiement est complet et la prestation effectuée
- Clients: Menu Clients pour voir tous les contacts et leur historique
- Stats: Menu Statistiques pour les rapports et analyses`,
      tools: AI_TOOLS,
      messages: [
        {
          role: 'user',
          content: `${dataContext}\n\nDemande de l'utilisateur: ${question}`
        }
      ]
    })

    // Process the response
    let answer = ''
    let proposedAction: { name: string; params: Record<string, unknown>; description: string } | null = null

    for (const content of message.content) {
      if (content.type === 'text') {
        answer += content.text
      } else if (content.type === 'tool_use') {
        // AI wants to use a tool - this is a proposed action
        proposedAction = {
          name: content.name,
          params: content.input as Record<string, unknown>,
          description: getActionDescription(content.name, content.input as Record<string, unknown>)
        }
      }
    }

    return NextResponse.json({
      success: true,
      answer,
      proposedAction
    })

  } catch (error) {
    console.error('Error in statistics ask API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', answer: "Désolé, une erreur est survenue." },
      { status: 500 }
    )
  }
}

// Helper to generate human-readable action description
function getActionDescription(actionName: string, params: Record<string, unknown>): string {
  switch (actionName) {
    case 'close_orders':
      return `Fermer ${(params.order_ids as string[])?.length || 0} commande(s)`
    case 'cancel_orders':
      return `Annuler ${(params.order_ids as string[])?.length || 0} commande(s). Raison: ${params.reason || 'Non spécifiée'}`
    case 'send_payment_reminder':
      return `Envoyer un rappel de paiement pour ${(params.order_ids as string[])?.length || 0} commande(s)`
    case 'fix_payment_status':
      return `Corriger le statut de paiement de ${(params.order_ids as string[])?.length || 0} commande(s)`
    case 'merge_duplicate_contacts':
      return `Fusionner ${(params.merge_contact_ids as string[])?.length || 0} contact(s) en double`
    case 'clean_old_pending_orders':
      return `${params.action === 'cancel' ? 'Annuler' : 'Archiver'} les commandes non payées depuis ${params.days_old} jours`
    default:
      return actionName
  }
}
