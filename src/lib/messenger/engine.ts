/**
 * Moteur d'exécution du Messenger
 * Gère le flux conversationnel basé sur les workflows
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { parseDate, parseTime, formatDateForDisplay, formatTimeForDisplay } from './date-time-parser'
import { processWithClara } from './clara-service'
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

// Initialiser les clients AI
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

const gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '')

export interface ExecuteStepResult {
  success: boolean
  message?: string
  nextStepRef?: string | null
  conversationStatus?: 'active' | 'completed' | 'abandoned'
  error?: string
  moduleType?: string
  choices?: Array<{ id: string; label: string; value: string }> | null
  autoExecute?: boolean
  isComplete?: boolean  // For Clara: indicates conversation is complete
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

  // Préparer les choix selon le type de module
  let choices = null

  if (module.module_type === 'choix_multiples' && module.choices) {
    choices = module.choices.map((choice: any, index: number) => ({
      id: choice.id,
      label: choice.label[locale] || choice.label.fr || choice.label.en,
      value: `${index + 1}`
    }))
  } else if (module.module_type === 'availability_suggestions') {
    // Construire les choix dynamiquement à partir des alternatives
    const collectedData = conversation.collected_data as Record<string, any>
    const alternatives = collectedData?.alternatives || {}
    const suggestionChoices = []

    if (alternatives.beforeSlot) {
      suggestionChoices.push({
        id: `before_${alternatives.beforeSlot.replace(':', '')}`,
        label: locale === 'fr' ? `${alternatives.beforeSlot} (plus tôt le même jour)` :
               locale === 'en' ? `${alternatives.beforeSlot} (earlier same day)` :
               `${alternatives.beforeSlot} (מוקדם יותר באותו היום)`
      })
    }

    if (alternatives.afterSlot) {
      suggestionChoices.push({
        id: `after_${alternatives.afterSlot.replace(':', '')}`,
        label: locale === 'fr' ? `${alternatives.afterSlot} (plus tard le même jour)` :
               locale === 'en' ? `${alternatives.afterSlot} (later same day)` :
               `${alternatives.afterSlot} (מאוחר יותר באותו היום)`
      })
    }

    if (alternatives.sameTimeOtherDays && alternatives.sameTimeOtherDays.length > 0) {
      for (const day of alternatives.sameTimeOtherDays.slice(0, 3)) {
        suggestionChoices.push({
          id: `day_${day.date.replace(/-/g, '')}`,
          label: `${day.dayName} ${day.date}`
        })
      }
    }

    suggestionChoices.push({
      id: 'other_date',
      label: locale === 'fr' ? 'Choisir une autre date' :
             locale === 'en' ? 'Choose another date' :
             'לבחור תאריך אחר'
    })

    choices = suggestionChoices.map((choice, index) => ({
      id: choice.id,
      label: choice.label,
      value: `${index + 1}`
    }))
  }

  // Auto-exécuter availability_check ou order_generation si c'est le module
  if (module.module_type === 'availability_check' || module.module_type === 'order_generation') {
    const result = await processUserMessage(conversation.id, '')
    return {
      conversationId: conversation.id,
      firstMessage: result.message || '',
      locale,
      moduleType: result.moduleType || module.module_type,
      choices: result.choices || null
    }
  }

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

  // ============================================================================
  // CLARA AI PROCESSING
  // ============================================================================
  // Si Clara est activé pour ce module, traiter avec l'IA
  if (module.clara_enabled && module.clara_prompt) {
    console.log('[Engine] Clara enabled for module:', module.ref_code)

    try {
      // Récupérer l'historique de conversation (derniers 10 messages)
      const { data: messageHistory } = await supabase
        .from('messenger_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(10)

      const conversationHistory = (messageHistory || []).reverse().map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))

      // Charger les branches disponibles
      const { data: branches } = await supabase
        .from('branches')
        .select('name')
        .eq('is_active', true)
      const branchNames = branches?.map((b: any) => b.name) || []

      // Charger FAQ pour questions hors-sujet
      const { data: faqs } = await supabase
        .from('messenger_faq')
        .select('question, answer')
        .eq('is_active', true)
        .order('order_index')
        .limit(10)
      const faqItems = faqs?.map((f: any) => ({
        question: f.question[locale] || f.question.he || f.question.fr || f.question.en || '',
        answer: f.answer[locale] || f.answer.he || f.answer.fr || f.answer.en || ''
      })) || []

      // Appeler Clara avec context enrichi
      const claraResponse = await processWithClara({
        userMessage,
        conversationHistory,
        collectedData: conversation.collected_data || {},
        config: {
          enabled: true,
          prompt: module.clara_prompt,
          model: module.clara_model || 'gpt-4o-mini',
          temperature: module.clara_temperature ?? 0.7,
          timeout_ms: module.clara_timeout_ms ?? 5000
        },
        moduleContext: {
          content: module.content[locale] || module.content.he || module.content.fr || '',
          choices: module.choices || undefined,
          validationFormat: module.validation_format_code || undefined
        },
        systemContext: {
          branches: branchNames,
          faqItems: faqItems
        }
      })

      // Si Clara réussit
      if (claraResponse.success && claraResponse.reply) {
        console.log('[Engine] Clara response:', claraResponse.reply)

        // Mettre à jour les données collectées
        const updatedData = {
          ...conversation.collected_data,
          ...claraResponse.collected_data
        }

        await supabase
          .from('messenger_conversations')
          .update({ collected_data: updatedData })
          .eq('id', conversationId)

        // Replace variables in Clara's reply ({{firstName}}, {{branch}}, etc.)
        const personalizedReply = replaceDynamicVariables(claraResponse.reply, updatedData)

        // Enregistrer la réponse de Clara
        await supabase.from('messenger_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: personalizedReply,
          step_ref: currentStep.step_ref
        })

        // If Clara wants to show buttons, prepare them
        const claraChoices = claraResponse.show_buttons
          ? claraResponse.show_buttons.map((btn: any, index: number) => ({
              id: btn.id,
              label: typeof btn.label === 'string' ? btn.label : btn.label[locale] || btn.label.he || btn.label.fr || btn.label.en,
              value: `${index + 1}`
            }))
          : null

        // If not complete, return Clara's message + buttons (if any)
        if (!claraResponse.is_complete) {
          return {
            success: true,
            message: personalizedReply,
            nextStepRef: currentStep.step_ref,
            moduleType: module.module_type,
            choices: claraChoices
          }
        }

        // Si Clara indique que la collecte est complète, passer à l'étape suivante
        if (claraResponse.is_complete) {
          console.log('[Engine] Clara marked step as complete')

          // Chercher la transition
          const { data: outputs } = await supabase
            .from('messenger_workflow_outputs')
            .select('*')
            .eq('workflow_id', conversation.current_workflow_id)
            .eq('from_step_ref', currentStep.step_ref)
            .eq('output_type', 'success')
            .order('priority', { ascending: true })

          if (outputs && outputs.length > 0) {
            const nextOutput = outputs[0]

            if (nextOutput.destination_type === 'step' && nextOutput.destination_ref) {
              // Transition vers step suivante
              await supabase
                .from('messenger_conversations')
                .update({ current_step_ref: nextOutput.destination_ref })
                .eq('id', conversationId)

              // Récupérer le module suivant
              const { data: nextStep } = await supabase
                .from('messenger_workflow_steps')
                .select('*')
                .eq('workflow_id', conversation.current_workflow_id)
                .eq('step_ref', nextOutput.destination_ref)
                .single()

              if (nextStep) {
                const { data: nextModule } = await supabase
                  .from('messenger_modules')
                  .select('*')
                  .eq('ref_code', nextStep.module_ref)
                  .single()

                if (nextModule) {
                  const nextMessage = replaceDynamicVariables(nextModule.content[locale] || '', updatedData)

                  await supabase.from('messenger_messages').insert({
                    conversation_id: conversationId,
                    role: 'assistant',
                    content: nextMessage,
                    step_ref: nextOutput.destination_ref
                  })

                  // Préparer choices si nécessaire
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
                    nextStepRef: nextOutput.destination_ref,
                    moduleType: nextModule.module_type,
                    choices: nextChoices
                  }
                }
              }
            } else if (nextOutput.destination_type === 'end') {
              // Fin du workflow
              await supabase
                .from('messenger_conversations')
                .update({ status: 'completed' })
                .eq('id', conversationId)

              return {
                success: true,
                message: claraResponse.reply,
                isComplete: true
              }
            }
          }
        }

        // Retourner la réponse de Clara sans changer d'étape
        return {
          success: false, // false = reste sur la même étape
          message: claraResponse.reply,
          nextStepRef: currentStep.step_ref,
          moduleType: module.module_type
        }
      }

      // Si Clara échoue ou timeout, fallback au workflow manuel
      if (claraResponse.timeout) {
        console.log('[Engine] Clara timeout - falling back to manual workflow')
      } else {
        console.log('[Engine] Clara failed:', claraResponse.error)
      }

      // Charger le message de fallback depuis les paramètres globaux
      const { data: workflow } = await supabase
        .from('messenger_workflows')
        .select('clara_fallback_message, clara_fallback_action')
        .eq('id', conversation.current_workflow_id)
        .single()

      const fallbackMessage = workflow?.clara_fallback_message ||
        'Je rencontre un problème technique. Un conseiller va vous rappeler. 📞'

      await supabase.from('messenger_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: fallbackMessage,
        step_ref: currentStep.step_ref
      })

      // Selon fallback_action
      const fallbackAction = workflow?.clara_fallback_action || 'escalate'

      if (fallbackAction === 'escalate') {
        // Marquer pour rappel humain
        await supabase
          .from('messenger_conversations')
          .update({ status: 'completed', collected_data: { ...conversation.collected_data, needs_callback: true } })
          .eq('id', conversationId)

        return {
          success: true,
          message: fallbackMessage,
          isComplete: true
        }
      } else if (fallbackAction === 'retry') {
        // Réessayer le même module (garde la même étape)
        return {
          success: false,
          message: fallbackMessage,
          nextStepRef: currentStep.step_ref,
          moduleType: module.module_type
        }
      } else if (fallbackAction === 'abort') {
        // Abandonner la conversation
        await supabase
          .from('messenger_conversations')
          .update({ status: 'abandoned' })
          .eq('id', conversationId)

        return {
          success: true,
          message: fallbackMessage,
          isComplete: true
        }
      }

      // Continue avec workflow manuel (fallthrough)
    } catch (error) {
      console.error('[Engine] Clara processing error:', error)
      // Continue avec workflow manuel en cas d'erreur
    }
  }
  // Fin Clara AI Processing
  // ============================================================================

  // Fonction pour remplacer les variables dynamiques dans un texte
  function replaceDynamicVariables(text: string, collectedData: Record<string, any>): string {
    // Formater date et heure pour affichage
    let dateDisplay = collectedData.DATE || ''
    if (dateDisplay && /^\d{4}-\d{2}-\d{2}$/.test(dateDisplay)) {
      dateDisplay = formatDateForDisplay(dateDisplay, locale)
    }

    let timeDisplay = collectedData.TIME || ''
    if (timeDisplay && /^\d{2}:\d{2}$/.test(timeDisplay)) {
      timeDisplay = formatTimeForDisplay(timeDisplay, locale)
    }

    // Remplacer les variables
    // Note: Les URLs seront détectées et converties en boutons par le frontend (ClaraWidget)
    let result = text
      .replace(/@branch/g, collectedData.WELCOME || '')
      .replace(/@name/g, collectedData.NAME || '')
      .replace(/@phone/g, collectedData.NUMBER || '')
      .replace(/@game_area/g, collectedData.RESERVATION1 || '')
      .replace(/@participants/g, collectedData.RESERVATION2 || '')
      .replace(/@number_of_games/g, collectedData.LASER_GAME_NUMBER || collectedData.ACTIVE_TIME_GAME || '')
      .replace(/@date/g, dateDisplay)
      .replace(/@time/g, timeDisplay)
      .replace(/@email/g, collectedData.EMAIL || '')

    // Gérer @order(texte du bouton) ou @order simple
    // Format: @order(Click here to pay) ou juste @order
    const orderUrl = collectedData.ORDER_URL || ''
    if (orderUrl) {
      // Chercher @order(...) avec texte personnalisé
      const orderWithTextMatch = result.match(/@order\(([^)]+)\)/)
      if (orderWithTextMatch) {
        const buttonText = orderWithTextMatch[1]
        // Remplacer @order(texte) par [BTN:texte]URL
        result = result.replace(/@order\([^)]+\)/, `[BTN:${buttonText}]${orderUrl}`)
      } else {
        // Remplacer @order simple par URL
        result = result.replace(/@order/g, orderUrl)
      }
    }

    return result
  }

  // Pour message_text_auto, utiliser output_type 'auto' au lieu de 'success'
  let outputType = module.module_type === 'message_text_auto' ? 'auto' : 'success'
  let isValid = true
  let errorMessage = ''

  switch (module.module_type) {
    case 'message_text':
    case 'message_text_auto':
    case 'availability_check':
      // Aucune validation, on continue (ces modules s'exécutent automatiquement)
      break

    case 'collect':
      // Parser intelligent pour dates et heures
      let valueToStore = userMessage.trim()
      let parsedDisplay = userMessage.trim()
      let needsConfirmation = false

      // Détecter si c'est une date ou heure selon le step_ref
      if (currentStep.step_ref === 'DATE' || currentStep.step_ref.includes('DATE')) {
        const parsedDate = parseDate(userMessage, locale)
        if (parsedDate) {
          valueToStore = parsedDate.date // YYYY-MM-DD pour DB
          parsedDisplay = formatDateForDisplay(parsedDate.date, locale)
          needsConfirmation = parsedDate.confidence !== 'high' || !!parsedDate.ambiguous
          
          if (parsedDate.ambiguous) {
            console.log('[Engine] Date ambiguous:', parsedDate.ambiguous)
          }
        } else {
          isValid = false
          errorMessage = locale === 'fr' 
            ? 'Format de date non reconnu. Essayez: "5 février", "05/02/2025", "demain"...'
            : locale === 'en'
            ? 'Date format not recognized. Try: "February 5", "02/05/2025", "tomorrow"...'
            : 'תאריך לא מזוהה'
        }
      } else if (currentStep.step_ref === 'TIME' || currentStep.step_ref.includes('TIME')) {
        const parsedTime = parseTime(userMessage, locale)
        if (parsedTime) {
          valueToStore = parsedTime.time // HH:MM pour DB
          parsedDisplay = formatTimeForDisplay(parsedTime.time, locale)
          needsConfirmation = parsedTime.confidence !== 'high' || !!parsedTime.ambiguous
          
          if (parsedTime.ambiguous) {
            console.log('[Engine] Time ambiguous:', parsedTime.ambiguous)
          }
        } else {
          isValid = false
          errorMessage = locale === 'fr'
            ? 'Format d\'heure non reconnu. Essayez: "14h", "14h30", "2:30 PM"...'
            : locale === 'en'
            ? 'Time format not recognized. Try: "2pm", "14:30", "2:30 PM"...'
            : 'שעה לא מזוהה'
        }
      } else {
        // Validation classique pour autres champs
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
              errorMessage = module.custom_error_message?.[locale] || format.error_message[locale]
            }
          }
        }
      }

      // Si besoin de confirmation (date/heure ambiguë)
      if (isValid && needsConfirmation) {
        const confirmMessage = locale === 'fr'
          ? `Vous voulez dire : ${parsedDisplay} ?`
          : locale === 'en'
          ? `You mean: ${parsedDisplay}?`
          : `אתה מתכוון: ${parsedDisplay}?`

        const yesLabel = locale === 'fr' ? 'Oui' : locale === 'en' ? 'Yes' : 'כן'
        const noLabel = locale === 'fr' ? 'Non' : locale === 'en' ? 'No' : 'לא'

        // Sauvegarder temporairement la valeur parsée
        const tempData = {
          ...conversation.collected_data,
          [`${currentStep.step_ref}_PENDING`]: valueToStore,
          [`${currentStep.step_ref}_DISPLAY`]: parsedDisplay
        }
        await supabase
          .from('messenger_conversations')
          .update({ collected_data: tempData })
          .eq('id', conversationId)

        // Envoyer le message de confirmation
        await supabase.from('messenger_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: confirmMessage,
          step_ref: currentStep.step_ref
        })
        
        return {
          success: false,
          message: confirmMessage,
          nextStepRef: currentStep.step_ref,
          moduleType: module.module_type,
          choices: [
            { id: 'yes', label: yesLabel, value: yesLabel },
            { id: 'no', label: noLabel, value: noLabel }
          ]
        }
      }

      // Gérer la confirmation (Oui/Non après parsing)
      const pendingKey = `${currentStep.step_ref}_PENDING`
      const displayKey = `${currentStep.step_ref}_DISPLAY`
      if (conversation.collected_data[pendingKey]) {
        const userResponse = userMessage.toLowerCase().trim()
        const isYes = ['oui', 'yes', 'y', 'o', 'כן'].includes(userResponse)
        const isNo = ['non', 'no', 'n', 'לא'].includes(userResponse)

        if (isYes) {
          // Confirmer la valeur
          valueToStore = conversation.collected_data[pendingKey]
          const { [pendingKey]: _, [displayKey]: __, ...cleanedData } = conversation.collected_data
          const collectedData = { ...cleanedData, [currentStep.step_ref]: valueToStore }
          await supabase
            .from('messenger_conversations')
            .update({ collected_data: collectedData })
            .eq('id', conversationId)

          // Marquer comme valide et ne pas continuer
          // la validation - on a déjà confirmé la bonne valeur
          isValid = true
          // Skip le stockage ci-dessous car déjà fait
        } else if (isNo) {
          // Redemander
          const retryMessage = locale === 'fr'
            ? 'D\'accord, veuillez entrer à nouveau :'
            : locale === 'en'
            ? 'Okay, please enter again:'
            : 'בסדר, אנא הזן שוב:'

          // Nettoyer les données temporaires
          const { [pendingKey]: _, [displayKey]: __, ...cleanedData } = conversation.collected_data
          await supabase
            .from('messenger_conversations')
            .update({ collected_data: cleanedData })
            .eq('id', conversationId)

          await supabase.from('messenger_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: retryMessage,
            step_ref: currentStep.step_ref
          })

          return {
            success: false,
            message: retryMessage,
            nextStepRef: currentStep.step_ref
          }
        } else {
          // Réponse invalide
          errorMessage = locale === 'fr'
            ? 'Veuillez répondre par Oui ou Non'
            : locale === 'en'
            ? 'Please answer Yes or No'
            : 'אנא ענה כן או לא'
          isValid = false

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
      }

      // Stocker la donnée collectée si valide (seulement si pas déjà fait dans confirmation)
      if (isValid && !conversation.collected_data[pendingKey]) {
        const collectedData = { ...conversation.collected_data, [currentStep.step_ref]: valueToStore }
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

      // D'abord chercher par texte avec fuzzy matching
      const userInput = userMessage.toLowerCase().trim()
      console.log('[Engine] Trying text match for:', userInput)

      // Essayer d'abord une correspondance exacte
      selectedChoice = choices.find((choice: any) => {
        const label = (choice.label[locale] || choice.label.fr || choice.label.en || '').toLowerCase()
        console.log('[Engine] Comparing with label:', label)
        return label === userInput
      })

      // Si pas de match texte ET userMessage est un pur nombre, essayer par index
      if (!selectedChoice && /^\d+$/.test(userMessage)) {
        const choiceIndex = parseInt(userMessage) - 1
        if (choiceIndex >= 0 && choiceIndex < choices.length) {
          selectedChoice = choices[choiceIndex]
          console.log('[Engine] Matched by index:', selectedChoice.id)
        }
      }

      // Si toujours pas trouvé, chercher correspondance partielle
      if (!selectedChoice) {

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

        // Sauvegarder le choix dans collected_data
        const choiceLabel = selectedChoice.label[locale] || selectedChoice.label.fr || selectedChoice.label.en || ''
        const updatedCollectedData = {
          ...conversation.collected_data,
          [currentStep.step_ref]: choiceLabel
        }
        await supabase
          .from('messenger_conversations')
          .update({ collected_data: updatedCollectedData })
          .eq('id', conversationId)

        console.log('[Engine] Saved choice to collected_data:', { [currentStep.step_ref]: choiceLabel })
      } else {
        console.log('[Engine] No choice matched!')
        isValid = false
        errorMessage = locale === 'fr' ? 'Choix invalide' : (locale === 'en' ? 'Invalid choice' : 'בחירה לא חוקית')
      }
      break

    case 'availability_suggestions':
      // Présenter les alternatives sous forme de choix
      console.log('[Engine] availability_suggestions - collected_data:', conversation.collected_data)

      const collectedData = conversation.collected_data as Record<string, any>
      const alternatives = collectedData.alternatives || {}

      // Créer des choix dynamiques basés sur les alternatives disponibles
      const suggestionChoices = []

      if (alternatives.beforeSlot) {
        suggestionChoices.push({
          id: `before_${alternatives.beforeSlot.replace(':', '')}`,
          label: {
            fr: `${alternatives.beforeSlot} (plus tôt le même jour)`,
            en: `${alternatives.beforeSlot} (earlier same day)`,
            he: `${alternatives.beforeSlot} (מוקדם יותר באותו היום)`
          }
        })
      }

      if (alternatives.afterSlot) {
        suggestionChoices.push({
          id: `after_${alternatives.afterSlot.replace(':', '')}`,
          label: {
            fr: `${alternatives.afterSlot} (plus tard le même jour)`,
            en: `${alternatives.afterSlot} (later same day)`,
            he: `${alternatives.afterSlot} (מאוחר יותר באותו היום)`
          }
        })
      }

      if (alternatives.sameTimeOtherDays && alternatives.sameTimeOtherDays.length > 0) {
        for (const day of alternatives.sameTimeOtherDays.slice(0, 3)) {
          suggestionChoices.push({
            id: `day_${day.date.replace(/-/g, '')}`,
            label: {
              fr: `${day.dayName} ${day.date}`,
              en: `${day.dayName} ${day.date}`,
              he: `${day.dayName} ${day.date}`
            }
          })
        }
      }

      suggestionChoices.push({
        id: 'other_date',
        label: {
          fr: 'Choisir une autre date',
          en: 'Choose another date',
          he: 'לבחור תאריך אחר'
        }
      })

      // Trouver le choix sélectionné
      let selectedSuggestion = null
      const suggestionUserInput = userMessage.toLowerCase().trim()

      // Essayer de matcher par numéro d'abord
      const suggestionIndex = parseInt(userMessage) - 1
      if (suggestionIndex >= 0 && suggestionIndex < suggestionChoices.length) {
        selectedSuggestion = suggestionChoices[suggestionIndex]
      } else {
        // Sinon chercher par texte
        selectedSuggestion = suggestionChoices.find((choice: any) => {
          const label = (choice.label[locale] || choice.label.fr || '').toLowerCase()
          return label.includes(suggestionUserInput) || suggestionUserInput.includes(label)
        })
      }

      if (selectedSuggestion) {
        // Mettre à jour les données collectées selon le choix
        const updatedData = { ...collectedData }

        if (selectedSuggestion.id.startsWith('before_') || selectedSuggestion.id.startsWith('after_')) {
          // Changer l'heure
          const newTime = selectedSuggestion.id.startsWith('before_')
            ? alternatives.beforeSlot
            : alternatives.afterSlot
          updatedData.TIME = newTime
          outputType = 'time_changed'
        } else if (selectedSuggestion.id.startsWith('day_')) {
          // Changer la date
          const selectedDay = alternatives.sameTimeOtherDays.find((d: any) =>
            selectedSuggestion.id.includes(d.date.replace(/-/g, ''))
          )
          if (selectedDay) {
            updatedData.DATE = selectedDay.date
            outputType = 'date_changed'
          }
        } else if (selectedSuggestion.id === 'other_date') {
          // Demander une autre date
          outputType = 'other_date'
        }

        await supabase
          .from('messenger_conversations')
          .update({ collected_data: updatedData })
          .eq('id', conversationId)

        console.log('[Engine] Selected suggestion, outputType:', outputType)
      } else {
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

      console.log('[Engine] Clara result:', JSON.stringify(claraResult, null, 2))

      if (!claraResult.success) {
        isValid = false
        errorMessage = claraResult.error || 'Erreur Clara LLM'
        console.log('[Engine] Clara failed, errorMessage:', errorMessage)
      } else {
        // Si Clara a décidé de naviguer vers un workflow
        if (claraResult.outputType === 'navigate_workflow' && claraResult.workflowToActivate) {
          console.log('[Engine] Clara is navigating to workflow:', claraResult.workflowToActivate)

          // Trouver le workflow cible
          const { data: targetWorkflow } = await supabase
            .from('messenger_workflows')
            .select('*')
            .eq('id', claraResult.workflowToActivate)
            .single()

          if (targetWorkflow) {
            // Trouver le point d'entrée
            const { data: targetEntryStep } = await supabase
              .from('messenger_workflow_steps')
              .select('*')
              .eq('workflow_id', targetWorkflow.id)
              .eq('is_entry_point', true)
              .single()

            if (targetEntryStep) {
              // Récupérer le module du point d'entrée
              const { data: targetModule } = await supabase
                .from('messenger_modules')
                .select('*')
                .eq('ref_code', targetEntryStep.module_ref)
                .single()

              if (targetModule) {
                // Mettre à jour la conversation
                await supabase
                  .from('messenger_conversations')
                  .update({
                    current_workflow_id: targetWorkflow.id,
                    current_step_ref: targetEntryStep.step_ref,
                    last_activity_at: new Date().toISOString()
                  })
                  .eq('id', conversationId)

                // Enregistrer le message du nouveau workflow
                const targetMessage = targetModule.content[locale] || ''
                await supabase.from('messenger_messages').insert({
                  conversation_id: conversationId,
                  role: 'assistant',
                  content: targetMessage,
                  step_ref: targetEntryStep.step_ref
                })

                // Préparer les choix si nécessaire
                const targetChoices = targetModule.module_type === 'choix_multiples' && targetModule.choices
                  ? targetModule.choices.map((choice: any, index: number) => ({
                      id: choice.id,
                      label: choice.label[locale] || choice.label.fr || choice.label.en,
                      value: `${index + 1}`
                    }))
                  : null

                return {
                  success: true,
                  message: targetMessage,
                  nextStepRef: targetEntryStep.step_ref,
                  moduleType: targetModule.module_type,
                  choices: targetChoices
                }
              }
            }
          }
        }

        outputType = claraResult.outputType || 'clara_continue'

        // Si Clara a généré une réponse, l'enregistrer
        if (claraResult.response) {
          await supabase.from('messenger_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: claraResult.response,
            step_ref: currentStep.step_ref
          })

          // Si outputType est 'clara_continue', retourner immédiatement sans chercher d'output
          if (outputType === 'clara_continue') {
            console.log('[Engine] Clara continue - returning response without workflow transition')
            return {
              success: true,
              message: claraResult.response,
              nextStepRef: currentStep.step_ref
            }
          }
        }
      }
      break
  }

  // Traiter order_generation (exécution automatique sans user input)
  if (module.module_type === 'order_generation') {
    try {
      console.log('[Engine] order_generation - collected_data:', conversation.collected_data)
      const collectedData = conversation.collected_data as Record<string, any>

      // Mapper branch name vers branch_id
      const branchName = collectedData.WELCOME || 'Rishon Lezion'
      const { data: branch } = await supabase
        .from('branches')
        .select('id, slug')
        .ilike('name', branchName)
        .single()

      if (!branch) {
        console.error('[Engine] Branch not found:', branchName)
        outputType = 'error'
        throw new Error('Branch not found')
      }

      // Extract contact info from collected data
      const phone = collectedData.NUMBER || ''
      const firstName = collectedData.NAME?.split(' ')[0] || 'Client'
      const lastName = collectedData.NAME?.split(' ').slice(1).join(' ') || ''
      const email = collectedData.MAIL || collectedData.EMAIL || null
      console.log('[Engine] Contact creation check - phone:', phone, 'type:', typeof phone, 'exists:', !!phone, 'NUMBER:', collectedData.NUMBER)

      // Find or create contact (like Clara AI does)
      let contactId: string | null = null
      if (phone) {
        const { data: existingContact, error: contactError } = await supabase
          .from('contacts')
          .select('id')
          .eq('branch_id_main', branch.id)
          .eq('phone', phone)
          .single()

        if (contactError && contactError.code !== 'PGRST116') {
          console.error('[Engine] Error checking existing contact:', contactError)
        }

        if (existingContact) {
          contactId = existingContact.id
          console.log('[Engine] Contact found:', contactId)
        } else {
          const { data: newContact, error: insertError } = await supabase
            .from('contacts')
            .insert({
              branch_id_main: branch.id,
              first_name: firstName,
              last_name: lastName,
              phone,
              email,
              notes_client: 'Contact créé depuis messenger chatbot (order aborted)',
              source: 'website'
            })
            .select('id')
            .single()

          if (insertError) {
            console.error('[Engine] Error creating contact:', insertError)
          }

          if (newContact) {
            contactId = newContact.id
            console.log('[Engine] Contact created:', contactId)
          }
        }
      }

      // Générer référence commande
      const generateShortReference = () => Math.random().toString(36).substring(2, 8).toUpperCase()
      const requestReference = generateShortReference()

      // Convertir date DD/MM/YYYY → YYYY-MM-DD
      let orderDate = collectedData.DATE || ''
      if (orderDate) {
        const ddmmyyyyMatch = orderDate.match(/(\d{2})\/(\d{2})\/(\d{4})/)
        if (ddmmyyyyMatch) {
          orderDate = `${ddmmyyyyMatch[3]}-${ddmmyyyyMatch[2]}-${ddmmyyyyMatch[1]}`
        }
      }

      // Formater TIME en HH:MM
      let orderTime = collectedData.TIME || ''
      if (orderTime && typeof orderTime === 'string') {
        orderTime = orderTime.toLowerCase().replace(/h/gi, ':').replace(/\s/g, '')
        const timeMatch = orderTime.match(/(\d{1,2}):?(\d{2})?/)
        if (timeMatch) {
          const hour = parseInt(timeMatch[1])
          const minute = timeMatch[2] || '00'
          orderTime = `${hour.toString().padStart(2, '0')}:${minute}`
        }
      }

      // Determine game parameters
      const participantsCount = parseInt(collectedData.RESERVATION2 || '1')
      const gameArea = collectedData.RESERVATION1?.includes('Active') ? 'ACTIVE' : collectedData.RESERVATION1?.includes('Laser') ? 'LASER' : 'MIX'

      // Calculate numberOfGames based on game type
      let numberOfGames = 2 // default
      if (gameArea === 'LASER') {
        // For LASER: use number of parties directly from LASER_GAME_NUMBER
        numberOfGames = parseInt(collectedData.LASER_GAME_NUMBER?.match(/\d+/)?.[0] || '2')
      } else if (gameArea === 'ACTIVE') {
        // For ACTIVE: convert time duration to number of games
        if (collectedData.ACTIVE_TIME_GAME?.includes('2H') || collectedData.ACTIVE_TIME_GAME?.includes('2h')) {
          numberOfGames = 4
        } else if (collectedData.ACTIVE_TIME_GAME?.includes('1H30') || collectedData.ACTIVE_TIME_GAME?.includes('1h30')) {
          numberOfGames = 3
        } else {
          numberOfGames = 2 // 1H default
        }
      }

      // Insérer commande aborted avec contact_id (comme Clara)
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          branch_id: branch.id,
          contact_id: contactId,
          order_type: 'GAME',
          participants_count: participantsCount,
          game_area: gameArea,
          number_of_games: numberOfGames,
          requested_date: orderDate,
          requested_time: orderTime,
          customer_first_name: firstName,
          customer_last_name: lastName,
          customer_phone: phone,
          customer_email: email,
          status: 'aborted',
          source: 'messenger_chatbot',
          request_reference: requestReference,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (orderError || !newOrder) {
        console.error('[Engine] Order creation error:', orderError)
        outputType = 'error'
      } else {
        console.log('[Engine] Order created:', newOrder.id, requestReference)

        // Generate reservation URL with pre-filled parameters (like Clara AI)
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://activegames.co.il'
        const params = new URLSearchParams()

        // Use actual branch slug from database
        params.set('branch', branch.slug)
        params.set('type', 'game')
        params.set('players', String(participantsCount))
        params.set('gameArea', gameArea) // Keep UPPERCASE (ACTIVE, LASER, MIX)
        if (numberOfGames) {
          params.set('games', String(numberOfGames))
        }
        if (orderDate) {
          params.set('date', orderDate)
        }
        if (orderTime) {
          params.set('time', orderTime)
        }
        if (firstName) {
          params.set('firstName', firstName)
        }
        if (lastName) {
          params.set('lastName', lastName)
        }
        if (phone) {
          params.set('phone', phone)
        }
        if (email) {
          params.set('email', email)
        }

        const orderUrl = `${baseUrl}/reservation?${params.toString()}`

        const updatedData = {
          ...collectedData,
          ORDER_URL: orderUrl,
          ORDER_REFERENCE: requestReference
        }
        await supabase
          .from('messenger_conversations')
          .update({ collected_data: updatedData })
          .eq('id', conversationId)

        outputType = 'success'
      }
    } catch (error) {
      console.error('[Engine] order_generation error:', error)
      outputType = 'error'
    }
  }

  // Traiter availability_check (exécution automatique sans user input)
  if (module.module_type === 'availability_check') {
    try {
      console.log('[Engine] availability_check - collected_data:', conversation.collected_data)
      const metadata = module.metadata || {}
      const collectedData = conversation.collected_data as Record<string, any>

      // Branch
      let branchSlug = metadata.branch_slug || 'rishon-lezion'
      const welcomeChoice = collectedData.WELCOME
      if (welcomeChoice) {
        branchSlug = welcomeChoice.toLowerCase().replace(/\s+/g, '-')
      }

      // Date: convertir DD/MM/YYYY → YYYY-MM-DD
      let date = collectedData.DATE || collectedData.date
      if (date && typeof date === 'string') {
        const ddmmyyyyMatch = date.match(/(\d{2})\/(\d{2})\/(\d{4})/)
        if (ddmmyyyyMatch) {
          date = `${ddmmyyyyMatch[3]}-${ddmmyyyyMatch[2]}-${ddmmyyyyMatch[1]}`
        } else {
          const yyyymmddMatch = date.match(/(\d{4})-(\d{2})-(\d{2})/)
          if (yyyymmddMatch) {
            date = `${yyyymmddMatch[1]}-${yyyymmddMatch[2]}-${yyyymmddMatch[3]}`
          }
        }
      }

      // Time
      let time = collectedData.TIME || collectedData.time
      if (time && typeof time === 'string') {
        time = time.toLowerCase().replace(/h/gi, ':').replace(/\s/g, '')
        const timeMatch = time.match(/(\d{1,2}):?(\d{2})?/)
        if (timeMatch) {
          const hour = parseInt(timeMatch[1])
          const minute = timeMatch[2] || '00'
          time = `${hour.toString().padStart(2, '0')}:${minute}`
        }
      }

      // Participants
      let participantsStr = collectedData.RESERVATION2 || collectedData.participants || '1'
      if (typeof participantsStr === 'string') {
        const numMatch = participantsStr.match(/\d+/)
        participantsStr = numMatch ? numMatch[0] : '1'
      }
      const participants = parseInt(participantsStr)

      // Game type
      const gameType = 'GAME'

      // Game area
      let gameArea = 'ACTIVE'
      const reservation1Choice = collectedData.RESERVATION1
      if (reservation1Choice) {
        if (reservation1Choice.includes('Active')) gameArea = 'ACTIVE'
        else if (reservation1Choice.includes('Laser')) gameArea = 'LASER'
        else if (reservation1Choice.includes('Mix')) gameArea = 'MIX'
      }

      // Number of games
      let numberOfGames = 1
      const laserGameChoice = collectedData.LASER_GAME_NUMBER
      const activeTimeChoice = collectedData.ACTIVE_TIME_GAME

      if (laserGameChoice) {
        const numMatch = laserGameChoice.match(/(\d+)/)
        if (numMatch) numberOfGames = parseInt(numMatch[1])
      } else if (activeTimeChoice) {
        if (activeTimeChoice.includes('2H') || activeTimeChoice.includes('2h')) numberOfGames = 4
        else if (activeTimeChoice.includes('1H30') || activeTimeChoice.includes('1h30')) numberOfGames = 3
        else if (activeTimeChoice.includes('1H') || activeTimeChoice.includes('1h')) numberOfGames = 2
      }

      console.log('[Engine] Checking availability:', { branchSlug, date, time, participants, gameType, gameArea, numberOfGames })

      // Convertir branchSlug en branchId
      const { data: branch } = await supabase
        .from('branches')
        .select('id')
        .ilike('slug', `%${branchSlug.replace(/\s+/g, '-')}%`)
        .single()

      if (!branch) {
        throw new Error('Branch not found')
      }

      // Appel direct de la fonction partagée (pas de HTTP)
      const { checkAvailability } = await import('@/lib/availability-checker')
      const result = await checkAvailability({
        branchId: branch.id,
        date,
        time,
        participants,
        type: gameType,
        gameArea: gameArea as 'ACTIVE' | 'LASER' | 'MIX' | undefined,
        numberOfGames
      })

      console.log('[Engine] Availability result:', result)

      if (result.available) {
        outputType = 'available'
      } else {
        outputType = 'unavailable'
        const updatedData = {
          ...collectedData,
          alternatives: result.alternatives
        }
        await supabase
          .from('messenger_conversations')
          .update({ collected_data: updatedData })
          .eq('id', conversationId)
      }
    } catch (error) {
      console.error('[Engine] availability_check error:', error)
      isValid = false
      errorMessage = locale === 'fr'
        ? 'Erreur lors de la vérification de disponibilité'
        : (locale === 'en' ? 'Error checking availability' : 'שגיאה בבדיקת זמינות')
    }
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

    // Recharger les collected_data depuis la DB pour avoir les dernières valeurs
    // (importantes après order_generation qui ajoute ORDER_URL)
    const { data: freshConversation } = await supabase
      .from('messenger_conversations')
      .select('collected_data')
      .eq('id', conversationId)
      .single()

    const currentCollectedData = freshConversation?.collected_data || conversation.collected_data || {}

    // Formatter le message selon le type de module
    let nextMessage = nextModule.content[locale] || ''

    // Remplacer les variables dynamiques (@branch, @name, etc.)
    nextMessage = replaceDynamicVariables(nextMessage, currentCollectedData)

    // Note: On n'ajoute plus les options numérotées dans le texte car elles sont affichées comme boutons dans l'UI

    // Enregistrer le message assistant
    await supabase.from('messenger_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: nextMessage,
      step_ref: nextStep.step_ref
    })

    // Préparer les choix si c'est un module choix_multiples
    // Préparer les choix selon le type de module
    let nextChoices = null

    if (nextModule.module_type === 'choix_multiples' && nextModule.choices) {
      nextChoices = nextModule.choices.map((choice: any, index: number) => ({
        id: choice.id,
        label: choice.label[locale] || choice.label.fr || choice.label.en,
        value: `${index + 1}`
      }))
    } else if (nextModule.module_type === 'availability_suggestions') {
      // Construire les choix dynamiquement à partir des alternatives
      const { data: updatedConversation } = await supabase
        .from('messenger_conversations')
        .select('collected_data')
        .eq('id', conversationId)
        .single()

      const collectedData = updatedConversation?.collected_data as Record<string, any>
      const alternatives = collectedData?.alternatives || {}
      const suggestionChoices = []

      if (alternatives.beforeSlot) {
        suggestionChoices.push({
          id: `before_${alternatives.beforeSlot.replace(':', '')}`,
          label: locale === 'fr' ? `${alternatives.beforeSlot} (plus tôt le même jour)` :
                 locale === 'en' ? `${alternatives.beforeSlot} (earlier same day)` :
                 `${alternatives.beforeSlot} (מוקדם יותר באותו היום)`
        })
      }

      if (alternatives.afterSlot) {
        suggestionChoices.push({
          id: `after_${alternatives.afterSlot.replace(':', '')}`,
          label: locale === 'fr' ? `${alternatives.afterSlot} (plus tard le même jour)` :
                 locale === 'en' ? `${alternatives.afterSlot} (later same day)` :
                 `${alternatives.afterSlot} (מאוחר יותר באותו היום)`
        })
      }

      if (alternatives.sameTimeOtherDays && alternatives.sameTimeOtherDays.length > 0) {
        for (const day of alternatives.sameTimeOtherDays.slice(0, 3)) {
          suggestionChoices.push({
            id: `day_${day.date.replace(/-/g, '')}`,
            label: `${day.dayName} ${day.date}`
          })
        }
      }

      suggestionChoices.push({
        id: 'other_date',
        label: locale === 'fr' ? 'Choisir une autre date' :
               locale === 'en' ? 'Choose another date' :
               'לבחור תאריך אחר'
      })

      nextChoices = suggestionChoices.map((choice, index) => ({
        id: choice.id,
        label: choice.label,
        value: `${index + 1}`
      }))
    }

    // Auto-exécuter availability_check et order_generation
    // Ces modules s'exécutent automatiquement sans attendre l'utilisateur et sans afficher de message
    if (nextModule.module_type === 'availability_check' ||
        nextModule.module_type === 'order_generation') {
      return await processUserMessage(conversationId, '')
    }

    // Pour message_text_auto : afficher le message puis traiter automatiquement l'output "auto"
    if (nextModule.module_type === 'message_text_auto') {
      // Retourner le message avec autoExecute pour que le frontend l'affiche
      // puis appelle automatiquement l'API avec un message vide pour traiter l'output "auto"
      return {
        success: true,
        message: nextMessage,
        nextStepRef: nextStep.step_ref,
        moduleType: nextModule.module_type,
        choices: nextChoices,
        autoExecute: true  // Signal pour le frontend de continuer automatiquement
      }
    }

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
  workflowToActivate?: string // ID du workflow à activer si Clara décide de rediriger
}> {
  try {
    // Récupérer le provider et modèle globaux depuis system_settings
    const { data: messengerAI } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'messenger_ai')
      .single()

    const provider = messengerAI?.value?.provider || 'anthropic'
    const model = messengerAI?.value?.model || 'claude-3-5-sonnet-20241022'

    console.log('[Clara LLM] Using provider:', provider, 'model:', model)

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

    // Construire le contexte des workflows disponibles
    let workflowsContext = ''
    let tools: Anthropic.Tool[] = []

    console.log('[Clara LLM] Checking workflow navigation:', {
      enable_workflow_navigation: module.llm_config?.enable_workflow_navigation,
      available_workflows: module.llm_config?.available_workflows
    })

    if (module.llm_config?.enable_workflow_navigation && module.llm_config?.available_workflows) {
      const { data: workflows } = await supabase
        .from('messenger_workflows')
        .select('*')
        .in('id', module.llm_config.available_workflows)

      console.log('[Clara LLM] Found workflows:', workflows)

      if (workflows && workflows.length > 0) {
        workflowsContext = '\n\n## Workflows disponibles\n\n'
        workflowsContext += 'Tu peux rediriger le client vers ces workflows quand c\'est pertinent:\n\n'

        workflows.forEach((wf: any) => {
          workflowsContext += `- **${wf.name}** (ID: ${wf.id}): ${wf.description || 'Pas de description'}\n`
        })

        // Ajouter le tool pour changer de workflow
        tools.push({
          name: 'navigate_to_workflow',
          description: 'Redirige le client vers un workflow spécifique. Utilise ceci quand le client exprime une intention claire (réserver, obtenir des infos, etc.)',
          input_schema: {
            type: 'object',
            properties: {
              workflow_id: {
                type: 'string',
                description: 'L\'ID du workflow vers lequel rediriger',
                enum: workflows.map((wf: any) => wf.id)
              },
              reason: {
                type: 'string',
                description: 'Courte explication de pourquoi tu rediriges (pour les logs)'
              }
            },
            required: ['workflow_id', 'reason']
          }
        })

        console.log('[Clara LLM] Tool created:', tools[0])
      }
    }

    // Construire le prompt système
    const systemPrompt = `${module.llm_config?.system_prompt || 'Tu es Clara, un assistant virtuel serviable et amical.'}

## Données collectées jusqu'ici
${JSON.stringify(collectedData, null, 2)}
${faqContext}
${workflowsContext}

Réponds au message de l'utilisateur de manière naturelle et pertinente. Si tu détectes une intention claire du client qui correspond à un workflow disponible, utilise le tool navigate_to_workflow pour le rediriger.`

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

    // Appeler le LLM approprié selon le provider
    let claraResponse = ''
    let workflowToActivate: string | undefined

    if (provider === 'anthropic') {
      // Anthropic (Claude)
      console.log('[Clara LLM] Calling Anthropic API...')
      const response = await anthropic.messages.create({
        model,
        max_tokens: module.llm_config?.max_tokens || 1024,
        temperature: module.llm_config?.temperature || 0.7,
        system: systemPrompt,
        messages: apiMessages,
        tools: tools.length > 0 ? tools : undefined
      })

      // Vérifier si Clara a décidé de changer de workflow
      const toolUse = response.content.find(block => block.type === 'tool_use')
      if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'navigate_to_workflow') {
        const input = toolUse.input as { workflow_id: string; reason: string }
        console.log('[Clara LLM] Redirecting to workflow:', input.workflow_id, '- Reason:', input.reason)
        workflowToActivate = input.workflow_id
      } else {
        // Extraire la réponse textuelle
        const textBlocks = response.content.filter(block => block.type === 'text')
        claraResponse = textBlocks.length > 0
          ? textBlocks.map(block => block.type === 'text' ? block.text : '').join('\n')
          : ''
      }

    } else if (provider === 'openai') {
      // OpenAI (ChatGPT)
      console.log('[Clara LLM] Calling OpenAI API...')
      const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...apiMessages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        }))
      ]

      // Tools pour OpenAI (si workflow navigation activé)
      const openaiTools = tools.length > 0 ? tools.map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }
      })) : undefined

      console.log('[Clara LLM] Tools array length:', tools.length)
      console.log('[Clara LLM] OpenAI tools:', JSON.stringify(openaiTools, null, 2))
      console.log('[Clara LLM] OpenAI request:', { model, messages: openaiMessages.length, hasTools: !!openaiTools })

      const response = await openai.chat.completions.create({
        model,
        max_tokens: module.llm_config?.max_tokens || 1024,
        temperature: module.llm_config?.temperature || 0.7,
        messages: openaiMessages,
        tools: openaiTools
      })

      console.log('[Clara LLM] OpenAI response:', JSON.stringify(response, null, 2))

      const choice = response.choices[0]
      if (!choice) {
        throw new Error('No choice in OpenAI response')
      }

      console.log('[Clara LLM] Choice message:', choice.message)

      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        const toolCall = choice.message.tool_calls[0]
        if (toolCall.type === 'function' && toolCall.function.name === 'navigate_to_workflow') {
          const args = JSON.parse(toolCall.function.arguments) as { workflow_id: string; reason: string }
          console.log('[Clara LLM] Redirecting to workflow:', args.workflow_id, '- Reason:', args.reason)
          workflowToActivate = args.workflow_id
        }
      } else {
        claraResponse = choice.message.content || ''
        console.log('[Clara LLM] OpenAI response text:', claraResponse)
      }

    } else if (provider === 'gemini') {
      // Google Gemini
      console.log('[Clara LLM] Calling Gemini API...')
      const geminiModel = gemini.getGenerativeModel({ model })

      // Construire l'historique pour Gemini
      const geminiHistory = apiMessages.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
      }))

      // Démarrer le chat
      const chat = geminiModel.startChat({
        history: geminiHistory,
        generationConfig: {
          maxOutputTokens: module.llm_config?.max_tokens || 1024,
          temperature: module.llm_config?.temperature || 0.7,
        }
      })

      // Envoyer le message avec le system prompt préfixé
      const fullPrompt = `${systemPrompt}\n\nUser: ${userMessage}`
      const result = await chat.sendMessage(fullPrompt)
      const response = result.response
      claraResponse = response.text()

      // Note: Gemini ne supporte pas les tools de la même manière,
      // donc on ne gère pas la navigation de workflow pour l'instant
    }

    // Retourner le résultat
    if (workflowToActivate) {
      return {
        success: true,
        response: '',
        outputType: 'navigate_workflow',
        workflowToActivate
      }
    }

    return {
      success: true,
      response: claraResponse,
      outputType: 'clara_continue'
    }
  } catch (error) {
    console.error('[Clara LLM] Error:', error)
    console.error('[Clara LLM] Error details:', error instanceof Error ? error.message : String(error))
    console.error('[Clara LLM] Error stack:', error instanceof Error ? error.stack : 'No stack')
    return {
      success: false,
      error: `Clara LLM error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}
