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
      id: 'other_week',
      label: locale === 'fr' ? 'Choisir une autre semaine' :
             locale === 'en' ? 'Choose another week' :
             'לבחור שבוע אחר'
    })

    choices = suggestionChoices.map((choice, index) => ({
      id: choice.id,
      label: choice.label,
      value: `${index + 1}`
    }))
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

    case 'availability_check':
      // Vérifier la disponibilité via l'API
      console.log('[Engine] availability_check - collected_data:', conversation.collected_data)

      try {
        const metadata = module.metadata || {}
        const branchSlug = metadata.branch_slug || 'tel-aviv'

        // Récupérer les données collectées
        const collectedData = conversation.collected_data as Record<string, any>
        const date = collectedData.date
        const time = collectedData.time
        const participants = parseInt(collectedData.participants || '1')
        const gameType = collectedData.game_type || 'GAME'
        const gameArea = collectedData.game_area || 'ACTIVE'
        const numberOfGames = parseInt(collectedData.game_count || '1')

        console.log('[Engine] Checking availability:', { branchSlug, date, time, participants, gameArea, numberOfGames })

        // Appeler l'API de disponibilité
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/public/clara/check-availability`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branchSlug,
            date,
            time,
            participants,
            type: gameType,
            gameArea,
            numberOfGames
          })
        })

        const result = await response.json()
        console.log('[Engine] Availability result:', result)

        if (result.available) {
          // Disponible → output_available
          outputType = 'available'

          // Enregistrer le message de succès
          const successMessage = module.success_message?.[locale] || module.content[locale] || ''
          await supabase.from('messenger_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: successMessage,
            step_ref: currentStep.step_ref
          })
        } else {
          // Non disponible → output_unavailable
          outputType = 'unavailable'

          // Stocker les alternatives dans collected_data pour le module de suggestions
          const updatedData = {
            ...collectedData,
            alternatives: result.alternatives
          }
          await supabase
            .from('messenger_conversations')
            .update({ collected_data: updatedData })
            .eq('id', conversationId)

          // Enregistrer le message d'échec
          const failureMessage = module.failure_message?.[locale] || module.content[locale] || ''
          await supabase.from('messenger_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: failureMessage,
            step_ref: currentStep.step_ref
          })
        }
      } catch (error) {
        console.error('[Engine] availability_check error:', error)
        isValid = false
        errorMessage = locale === 'fr'
          ? 'Erreur lors de la vérification de disponibilité'
          : (locale === 'en' ? 'Error checking availability' : 'שגיאה בבדיקת זמינות')
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
        id: 'other_week',
        label: {
          fr: 'Choisir une autre semaine',
          en: 'Choose another week',
          he: 'לבחור שבוע אחר'
        }
      })

      // Trouver le choix sélectionné
      let selectedSuggestion = null
      const userInput = userMessage.toLowerCase().trim()

      // Essayer de matcher par numéro d'abord
      const suggestionIndex = parseInt(userMessage) - 1
      if (suggestionIndex >= 0 && suggestionIndex < suggestionChoices.length) {
        selectedSuggestion = suggestionChoices[suggestionIndex]
      } else {
        // Sinon chercher par texte
        selectedSuggestion = suggestionChoices.find((choice: any) => {
          const label = (choice.label[locale] || choice.label.fr || '').toLowerCase()
          return label.includes(userInput) || userInput.includes(label)
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
          updatedData.time = newTime
          outputType = 'time_changed'
        } else if (selectedSuggestion.id.startsWith('day_')) {
          // Changer la date
          const selectedDay = alternatives.sameTimeOtherDays.find((d: any) =>
            selectedSuggestion.id.includes(d.date.replace(/-/g, ''))
          )
          if (selectedDay) {
            updatedData.date = selectedDay.date
            outputType = 'date_changed'
          }
        } else if (selectedSuggestion.id === 'other_week') {
          // Demander une autre semaine
          outputType = 'other_week'
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

      if (!claraResult.success) {
        isValid = false
        errorMessage = claraResult.error || 'Erreur Clara LLM'
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
        id: 'other_week',
        label: locale === 'fr' ? 'Choisir une autre semaine' :
               locale === 'en' ? 'Choose another week' :
               'לבחור שבוע אחר'
      })

      nextChoices = suggestionChoices.map((choice, index) => ({
        id: choice.id,
        label: choice.label,
        value: `${index + 1}`
      }))
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

    if (module.llm_config?.enable_workflow_navigation && module.llm_config?.available_workflows) {
      const { data: workflows } = await supabase
        .from('messenger_workflows')
        .select('*')
        .in('id', module.llm_config.available_workflows)
        .eq('is_active', true)

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

    // Appeler l'API Anthropic
    const response = await anthropic.messages.create({
      model: module.llm_config?.model || 'claude-3-5-sonnet-20241022',
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

      return {
        success: true,
        response: '', // Pas de réponse textuelle, on redirige directement
        outputType: 'navigate_workflow',
        workflowToActivate: input.workflow_id
      }
    }

    // Extraire la réponse textuelle
    const textBlocks = response.content.filter(block => block.type === 'text')
    const claraResponse = textBlocks.length > 0
      ? textBlocks.map(block => block.type === 'text' ? block.text : '').join('\n')
      : ''

    return {
      success: true,
      response: claraResponse,
      outputType: 'clara_continue' // Continue dans le même workflow
    }
  } catch (error) {
    console.error('[Clara LLM] Error:', error)
    return {
      success: false,
      error: 'Une erreur est survenue lors du traitement de votre message.'
    }
  }
}
