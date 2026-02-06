/**
 * Moteur d'exécution du Messenger
 * Gère le flux conversationnel basé sur les workflows
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import Anthropic from '@anthropic-ai/sdk'
import type {
  Workflow,
  WorkflowStep,
  WorkflowOutput,
  Module,
  Conversation,
  Message,
  Locale,
  ValidationFormat
} from '@/types/messenger'

// Initialiser le client Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
})

export interface ExecuteStepResult {
  success: boolean
  message?: string
  nextStepRef?: string | null
  conversationStatus?: 'active' | 'completed' | 'abandoned'
  error?: string
  moduleType?: string
  choices?: Array<{ id: string; label: string; value: string }> | null
}

/**
 * Démarrer une nouvelle conversation
 */
export async function startConversation(
  sessionId: string,
  branchId?: string,
  contactId?: string,
  userLocale?: Locale
): Promise<{
  conversationId: string
  firstMessage: string
  locale: Locale
  moduleType: string
  choices: Array<{ id: string; label: string; value: string }> | null
}> {
  const supabase = createServiceRoleClient() as any

  console.log('[Engine] Starting conversation for session:', sessionId)

  // Récupérer le workflow actif
  const { data: activeWorkflow, error: workflowError } = await supabase
    .from('messenger_workflows')
    .select('*')
    .eq('is_active', true)
    .single()

  if (workflowError) {
    console.error('[Engine] Error fetching active workflow:', workflowError)
    throw new Error('No active workflow found')
  }

  if (!activeWorkflow) {
    throw new Error('No active workflow found')
  }

  console.log('[Engine] Found active workflow:', activeWorkflow.id)

  // Récupérer le point d'entrée
  const { data: entryStep, error: stepError } = await supabase
    .from('messenger_workflow_steps')
    .select('*')
    .eq('workflow_id', activeWorkflow.id)
    .eq('is_entry_point', true)
    .single()

  if (stepError) {
    console.error('[Engine] Error fetching entry step:', stepError)
    throw new Error('No entry point found')
  }

  if (!entryStep) {
    throw new Error('No entry point found')
  }

  console.log('[Engine] Found entry step:', entryStep.step_ref)

  // Déterminer la locale depuis le paramètre ou défaut fr
  const locale: Locale = userLocale || 'fr'

  // Utiliser upsert pour créer ou récupérer la conversation existante
  const { data: conversation, error: convError } = await supabase
    .from('messenger_conversations')
    .upsert(
      {
        session_id: sessionId,
        branch_id: branchId || null,
        contact_id: contactId || null,
        current_step_ref: entryStep.step_ref,
        current_workflow_id: activeWorkflow.id,
        collected_data: {},
        status: 'active',
        locale: locale,
        last_activity_at: new Date().toISOString()
      },
      {
        onConflict: 'session_id',
        ignoreDuplicates: false
      }
    )
    .select()
    .single()

  if (convError) {
    console.error('[Engine] Error upserting conversation:', convError)
    throw new Error('Failed to create/retrieve conversation: ' + convError.message)
  }

  if (!conversation) {
    throw new Error('Failed to create/retrieve conversation')
  }

  console.log('[Engine] Conversation ready:', conversation.id)

  // Vérifier si cette conversation a déjà des messages
  const { data: existingMessages } = await supabase
    .from('messenger_messages')
    .select('id')
    .eq('conversation_id', conversation.id)
    .limit(1)

  const isNewConversation = !existingMessages || existingMessages.length === 0

  // Récupérer le module du point d'entrée
  const { data: module } = await supabase
    .from('messenger_modules')
    .select('*')
    .eq('ref_code', entryStep.module_ref)
    .single()

  if (!module) {
    throw new Error('Module not found')
  }

  // Formatter le message selon le type de module
  let firstMessage = module.content[locale] || ''

  // Note: On n'ajoute plus les options numérotées dans le texte car elles sont affichées comme boutons dans l'UI

  // Si c'est une nouvelle conversation, enregistrer le message de bienvenue
  if (isNewConversation) {
    await supabase.from('messenger_messages').insert({
      conversation_id: conversation.id,
      role: 'assistant',
      content: firstMessage,
      step_ref: entryStep.step_ref
    })
  }

  // Préparer les choix si c'est un module choix_multiples
  const choices = module.module_type === 'choix_multiples' && module.choices
    ? module.choices.map((choice: any, index: number) => ({
        id: choice.id,
        label: choice.label[locale] || choice.label.fr || choice.label.en,
        value: `${index + 1}`
      }))
    : null

  return {
    conversationId: conversation.id,
    firstMessage,
    locale,
    moduleType: module.module_type,
    choices
  }
}

/**
 * Traiter un message utilisateur
 */
export async function processUserMessage(
  conversationId: string,
  userMessage: string
): Promise<ExecuteStepResult> {
  const supabase = createServiceRoleClient() as any

  // Récupérer la conversation
  const { data: conversation } = await supabase
    .from('messenger_conversations')
    .select('*')
    .eq('id', conversationId)
    .single()

  if (!conversation || !conversation.current_step_ref) {
    return { success: false, error: 'Conversation not found' }
  }

  // Enregistrer le message utilisateur
  await supabase.from('messenger_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: userMessage,
    step_ref: conversation.current_step_ref
  })

  // Récupérer la step actuelle
  const { data: currentStep } = await supabase
    .from('messenger_workflow_steps')
    .select('*')
    .eq('workflow_id', conversation.current_workflow_id)
    .eq('step_ref', conversation.current_step_ref)
    .single()

  if (!currentStep) {
    return { success: false, error: 'Step not found' }
  }

  // Récupérer le module
  const { data: module } = await supabase
    .from('messenger_modules')
    .select('*')
    .eq('ref_code', currentStep.module_ref)
    .single()

  if (!module) {
    return { success: false, error: 'Module not found' }
  }

  // Utiliser la locale de la conversation
  const locale: Locale = (conversation.locale as Locale) || 'fr'

  let outputType = 'success'
  let isValid = true
  let errorMessage = ''

  switch (module.module_type) {
    case 'message_text':
      // Aucune validation, on continue
      break

    case 'collect':
      // Valider l'input
      if (module.validation_format_code) {
        const { data: format } = await supabase
          .from('messenger_validation_formats')
          .select('*')
          .eq('format_code', module.validation_format_code)
          .single()

        if (format && format.validation_regex) {
          const regex = new RegExp(format.validation_regex)
          isValid = regex.test(userMessage.trim())
          if (!isValid) {
            // Utiliser le message d'erreur personnalisé du module s'il existe, sinon celui du format
            errorMessage = module.custom_error_message?.[locale] || format.error_message[locale]
          }
        }
      }

      // Stocker la donnée collectée si valide
      if (isValid) {
        const collectedData = { ...conversation.collected_data, [currentStep.step_ref]: userMessage }
        await supabase
          .from('messenger_conversations')
          .update({ collected_data: collectedData })
          .eq('id', conversationId)
      }
      break

    case 'choix_multiples':
      // Trouver le choix sélectionné
      const choices = module.choices || []
      let selectedChoice = null

      console.log('[Engine] choix_multiples - userMessage:', userMessage)
      console.log('[Engine] choix_multiples - locale:', locale)
      console.log('[Engine] choix_multiples - choices:', JSON.stringify(choices))

      // D'abord essayer de matcher par numéro (1, 2, 3...)
      const choiceIndex = parseInt(userMessage) - 1
      if (choiceIndex >= 0 && choiceIndex < choices.length) {
        selectedChoice = choices[choiceIndex]
        console.log('[Engine] Matched by index:', selectedChoice.id)
      } else {
        // Sinon, chercher par texte avec fuzzy matching
        const userInput = userMessage.toLowerCase().trim()
        console.log('[Engine] Trying text match for:', userInput)

        // Essayer d'abord une correspondance exacte
        selectedChoice = choices.find((choice: any) => {
          const label = (choice.label[locale] || choice.label.fr || choice.label.en || '').toLowerCase()
          console.log('[Engine] Comparing with label:', label)
          return label === userInput
        })

        // Si pas de correspondance exacte, chercher une correspondance partielle
        if (!selectedChoice) {
          selectedChoice = choices.find((choice: any) => {
            const label = (choice.label[locale] || choice.label.fr || choice.label.en || '').toLowerCase()
            return label.includes(userInput) || userInput.includes(label)
          })
        }

        // Si toujours pas trouvé, utiliser la distance de Levenshtein simplifiée
        if (!selectedChoice && userInput.length >= 3) {
          let bestMatch = null
          let bestScore = 0

          for (const choice of choices) {
            const label = (choice.label[locale] || choice.label.fr || choice.label.en || '').toLowerCase()
            // Calculer un score de similarité simple basé sur les caractères communs
            let commonChars = 0
            for (const char of userInput) {
              if (label.includes(char)) commonChars++
            }
            const score = commonChars / Math.max(userInput.length, label.length)

            if (score > bestScore && score > 0.5) {
              bestScore = score
              bestMatch = choice
            }
          }

          if (bestMatch) {
            selectedChoice = bestMatch
          }
        }
      }

      if (selectedChoice) {
        outputType = `choice_${selectedChoice.id}`
        console.log('[Engine] Selected choice, outputType:', outputType)
      } else {
        console.log('[Engine] No choice matched!')
        isValid = false
        errorMessage = locale === 'fr' ? 'Choix invalide' : (locale === 'en' ? 'Invalid choice' : 'בחירה לא חוקית')
      }
      break

    case 'clara_llm':
      // Traiter avec Clara LLM
      const claraResult = await processClaraLLM(
        conversationId,
        userMessage,
        module,
        conversation.collected_data,
        locale,
        supabase
      )

      if (!claraResult.success) {
        isValid = false
        errorMessage = claraResult.error || 'Erreur Clara LLM'
      } else {
        outputType = claraResult.outputType || 'clara_default'

        // Si Clara a généré une réponse, l'enregistrer
        if (claraResult.response) {
          await supabase.from('messenger_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: claraResult.response,
            step_ref: currentStep.step_ref
          })
        }
      }
      break
  }

  // Si erreur de validation, rester sur la même step
  if (!isValid) {
    await supabase.from('messenger_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: errorMessage,
      step_ref: currentStep.step_ref
    })

    return {
      success: false,
      message: errorMessage,
      nextStepRef: currentStep.step_ref
    }
  }

  // Trouver la sortie
  const { data: output } = await supabase
    .from('messenger_workflow_outputs')
    .select('*')
    .eq('workflow_id', conversation.current_workflow_id)
    .eq('from_step_ref', currentStep.step_ref)
    .eq('output_type', outputType)
    .single()

  if (!output) {
    return { success: false, error: 'No output defined' }
  }

  // Gérer la destination
  if (output.destination_type === 'end') {
    await supabase
      .from('messenger_conversations')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', conversationId)

    return {
      success: true,
      message: 'Conversation terminée',
      conversationStatus: 'completed'
    }
  }

  if (output.destination_type === 'step' && output.destination_ref) {
    // Récupérer la step suivante
    const { data: nextStep } = await supabase
      .from('messenger_workflow_steps')
      .select('*')
      .eq('workflow_id', conversation.current_workflow_id)
      .eq('step_ref', output.destination_ref)
      .single()

    if (!nextStep) {
      return { success: false, error: 'Next step not found' }
    }

    // Récupérer le module suivant
    const { data: nextModule } = await supabase
      .from('messenger_modules')
      .select('*')
      .eq('ref_code', nextStep.module_ref)
      .single()

    if (!nextModule) {
      return { success: false, error: 'Next module not found' }
    }

    // Mettre à jour la conversation
    await supabase
      .from('messenger_conversations')
      .update({
        current_step_ref: nextStep.step_ref,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', conversationId)

    // Formatter le message selon le type de module
    let nextMessage = nextModule.content[locale] || ''

    // Note: On n'ajoute plus les options numérotées dans le texte car elles sont affichées comme boutons dans l'UI

    // Enregistrer le message assistant
    await supabase.from('messenger_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: nextMessage,
      step_ref: nextStep.step_ref
    })

    // Préparer les choix si c'est un module choix_multiples
    const nextChoices = nextModule.module_type === 'choix_multiples' && nextModule.choices
      ? nextModule.choices.map((choice: any, index: number) => ({
          id: choice.id,
          label: choice.label[locale] || choice.label.fr || choice.label.en,
          value: `${index + 1}`
        }))
      : null

    return {
      success: true,
      message: nextMessage,
      nextStepRef: nextStep.step_ref,
      moduleType: nextModule.module_type,
      choices: nextChoices
    }
  }

  if (output.destination_type === 'workflow' && output.destination_ref) {
    console.log('[Engine] Switching to workflow:', output.destination_ref)
    // Changer vers un autre workflow
    const { data: targetWorkflow } = await supabase
      .from('messenger_workflows')
      .select('*')
      .eq('id', output.destination_ref)
      .single()

    console.log('[Engine] Target workflow:', targetWorkflow?.name)
    if (!targetWorkflow) {
      console.log('[Engine] ERROR: Target workflow not found')
      return { success: false, error: 'Target workflow not found' }
    }

    // Trouver le point d'entrée du workflow cible
    const { data: targetEntryStep } = await supabase
      .from('messenger_workflow_steps')
      .select('*')
      .eq('workflow_id', targetWorkflow.id)
      .eq('is_entry_point', true)
      .single()

    console.log('[Engine] Target entry step:', targetEntryStep?.step_ref)
    if (!targetEntryStep) {
      console.log('[Engine] ERROR: No entry point found')
      return { success: false, error: 'Target workflow has no entry point' }
    }

    // Récupérer le module du point d'entrée
    const { data: targetModule } = await supabase
      .from('messenger_modules')
      .select('*')
      .eq('ref_code', targetEntryStep.module_ref)
      .single()

    console.log('[Engine] Target module:', targetModule?.ref_code, 'type:', targetModule?.module_type)
    if (!targetModule) {
      console.log('[Engine] ERROR: Target module not found')
      return { success: false, error: 'Target module not found' }
    }

    // Mettre à jour la conversation pour pointer vers le nouveau workflow
    console.log('[Engine] Updating conversation to new workflow')
    await supabase
      .from('messenger_conversations')
      .update({
        current_workflow_id: targetWorkflow.id,
        current_step_ref: targetEntryStep.step_ref,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', conversationId)

    // Enregistrer le message du nouveau point d'entrée
    const targetMessage = targetModule.content[locale] || ''
    console.log('[Engine] Target message:', targetMessage)
    await supabase.from('messenger_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: targetMessage,
      step_ref: targetEntryStep.step_ref
    })

    // Préparer les choix si c'est un module choix_multiples
    console.log('[Engine] Module type:', targetModule.module_type)
    console.log('[Engine] Module choices:', targetModule.choices)
    const targetChoices = targetModule.module_type === 'choix_multiples' && targetModule.choices
      ? targetModule.choices.map((choice: any, index: number) => ({
          id: choice.id,
          label: choice.label[locale] || choice.label.fr || choice.label.en,
          value: `${index + 1}`
        }))
      : null

    console.log('[Engine] Returning - message:', targetMessage, 'choices:', targetChoices?.length || 0, 'full choices:', targetChoices)
    return {
      success: true,
      message: targetMessage,
      nextStepRef: targetEntryStep.step_ref,
      moduleType: targetModule.module_type,
      choices: targetChoices
    }
  }

  return { success: false, error: 'Invalid destination type' }
}

/**
 * Traiter un message avec Clara LLM
 */
async function processClaraLLM(
  conversationId: string,
  userMessage: string,
  module: Module,
  collectedData: any,
  locale: Locale,
  supabase: any
): Promise<{
  success: boolean
  outputType?: string
  response?: string
  error?: string
}> {
  try {
    // Récupérer l'historique de conversation pour le contexte
    const { data: messages } = await supabase
      .from('messenger_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    const conversationHistory = messages || []

    // Construire le contexte FAQ si activé
    let faqContext = ''
    if (module.llm_config?.use_faq_context) {
      const { data: faqs } = await supabase
        .from('messenger_faq')
        .select('*')
        .eq('is_active', true)
        .order('order_index')

      if (faqs && faqs.length > 0) {
        faqContext = '\n\n## Base de connaissances FAQ\n\n'
        faqs.forEach((faq: any) => {
          const question = faq.question[locale] || faq.question.fr || faq.question.en
          const answer = faq.answer[locale] || faq.answer.fr || faq.answer.en
          faqContext += `Q: ${question}\nR: ${answer}\n\n`
        })
      }
    }

    // Construire le prompt système
    const systemPrompt = `${module.llm_config?.system_prompt || 'Tu es Clara, un assistant virtuel serviable et amical.'}

## Données collectées jusqu'ici
${JSON.stringify(collectedData, null, 2)}
${faqContext}

Réponds au message de l'utilisateur de manière naturelle et pertinente. Si tu as besoin de collecter plus d'informations, pose des questions claires.`

    // Construire les messages pour l'API
    const apiMessages: Anthropic.MessageParam[] = []

    // Ajouter l'historique (sauf le dernier message user qui est déjà dans userMessage)
    conversationHistory.slice(0, -1).forEach((msg: any) => {
      apiMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      })
    })

    // Ajouter le message actuel
    apiMessages.push({
      role: 'user',
      content: userMessage
    })

    // Appeler l'API Anthropic
    const response = await anthropic.messages.create({
      model: module.llm_config?.model || 'claude-3-5-sonnet-20241022',
      max_tokens: module.llm_config?.max_tokens || 1024,
      temperature: module.llm_config?.temperature || 0.7,
      system: systemPrompt,
      messages: apiMessages
    })

    // Extraire la réponse
    const claraResponse = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    return {
      success: true,
      response: claraResponse,
      outputType: 'clara_default'
    }
  } catch (error) {
    console.error('[Clara LLM] Error:', error)
    return {
      success: false,
      error: 'Une erreur est survenue lors du traitement de votre message.'
    }
  }
}
