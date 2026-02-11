/**
 * Moteur d'exécution du Messenger
 * Gère le flux conversationnel basé sur les workflows
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { parseDate, parseTime, formatDateForDisplay, formatTimeForDisplay } from './date-time-parser'
import { processWithClara, validateCriticalFormats } from './clara-service'
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

/**
 * After collecting data, resolve branch_id from WELCOME choice
 * and contact_id from NUMBER. Updates the conversation row.
 */
async function resolveConversationLinks(
  supabase: any,
  conversationId: string,
  collectedData: Record<string, any>,
  stepRef: string
) {
  const updates: Record<string, any> = {}

  // When WELCOME (branch) is collected, resolve to branch_id
  if (stepRef === 'WELCOME' && collectedData.WELCOME) {
    const branchName = collectedData.WELCOME
    // Try matching by name, name_en, name_he
    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .or(`name.ilike.%${branchName}%,name_en.ilike.%${branchName}%,name_he.eq.${branchName}`)
      .limit(1)
      .single()

    if (branch) {
      updates.branch_id = branch.id
      console.log('[Engine] Resolved branch_id:', branch.id, 'from:', branchName)
    }
  }

  // When NUMBER (phone) is collected, try to find existing contact
  if (stepRef === 'NUMBER' && collectedData.NUMBER) {
    const phone = collectedData.NUMBER.trim()
    const branchId = updates.branch_id || (await supabase
      .from('messenger_conversations')
      .select('branch_id')
      .eq('id', conversationId)
      .single()
    ).data?.branch_id

    // Search contact by phone (try exact match, then without leading 0)
    let contactQuery = supabase
      .from('contacts')
      .select('id, branch_id_main')
      .or(`phone.eq.${phone},phone.eq.0${phone},phone.eq.${phone.replace(/^0/, '')}`)
      .limit(1)

    // If we have a branch, prefer contacts from that branch
    if (branchId) {
      contactQuery = supabase
        .from('contacts')
        .select('id, branch_id_main')
        .eq('branch_id_main', branchId)
        .or(`phone.eq.${phone},phone.eq.0${phone},phone.eq.${phone.replace(/^0/, '')}`)
        .limit(1)
    }

    const { data: contact } = await contactQuery.single()
    if (contact) {
      updates.contact_id = contact.id
      // Also set branch from contact if not already set
      if (!updates.branch_id && contact.branch_id_main) {
        updates.branch_id = contact.branch_id_main
      }
      console.log('[Engine] Resolved contact_id:', contact.id, 'from phone:', phone)
    }
  }

  // Apply updates if any
  if (Object.keys(updates).length > 0) {
    await supabase
      .from('messenger_conversations')
      .update(updates)
      .eq('id', conversationId)
    console.log('[Engine] Updated conversation links:', updates)
  }
}

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
  if (module.clara_enabled) {
    console.log('[Engine] Clara enabled for module:', module.ref_code)

    // Charger le prompt (module-specific ou global par défaut)
    let claraPrompt = module.clara_prompt

    if (!claraPrompt) {
      console.log('[Engine] No module prompt, loading global Clara prompt from workflow')
      const { data: workflow } = await supabase
        .from('messenger_workflows')
        .select('clara_default_prompt')
        .eq('id', conversation.current_workflow_id)
        .single()

      claraPrompt = workflow?.clara_default_prompt
    }

    // Si toujours pas de prompt, skip Clara
    if (!claraPrompt) {
      console.warn('[Engine] Clara enabled but no prompt configured (module or global)')
    } else {
      try {
        // Récupérer TOUT l'historique de conversation (messages courts, pas besoin de limiter)
        const { data: messageHistory } = await supabase
          .from('messenger_messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })

        const conversationHistory = (messageHistory || []).map((msg: any) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }))

        // Charger les branches disponibles
        const { data: branches } = await supabase
          .from('branches')
          .select('name')
          .eq('is_active', true)
        const branchNames = branches?.map((b: any) => b.name) || []

        // Recherche FAQ intelligente : seulement si le message ressemble à une question
        // On cherche les FAQ pertinentes par mots-clés au lieu d'injecter les 43
        let faqItems: Array<{ question: string; answer: string }> = []
        const userWords = userMessage.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)

        if (userWords.length > 0) {
          // Chercher les FAQ qui matchent les mots-clés du message
          const searchPattern = userWords.join('|')
          const { data: faqs } = await supabase
            .from('messenger_faq')
            .select('question, answer, category')
            .eq('is_active', true)
            .order('order_index')

          if (faqs && faqs.length > 0) {
            // Filtrer côté client : chercher dans question ET answer dans toutes les langues
            const matchedFaqs = faqs.filter((f: any) => {
              const allText = [
                f.question?.fr, f.question?.en, f.question?.he,
                f.answer?.fr, f.answer?.en, f.answer?.he,
                f.category
              ].filter(Boolean).join(' ').toLowerCase()
              return userWords.some((word: string) => allText.includes(word))
            }).slice(0, 3) // Max 3 FAQ pertinentes

            // Detect user language for FAQ content
            const faqDetectLang = (text: string): string => {
              if (/[\u0590-\u05FF]/.test(text)) return 'he'
              if (/[àâçéèêëîïôùûüÿœæ]/i.test(text) || /\b(je|tu|nous|vous|merci|bonjour|oui|non)\b/i.test(text)) return 'fr'
              return 'en'
            }
            const faqLang = faqDetectLang(userMessage)
            faqItems = matchedFaqs.map((f: any) => ({
              question: f.question[faqLang] || f.question[locale] || f.question.he || f.question.fr || f.question.en || '',
              answer: f.answer[faqLang] || f.answer[locale] || f.answer.he || f.answer.fr || f.answer.en || ''
            }))
          }
        }

        // Appeler Clara avec context optimisé
        const claraResponse = await processWithClara({
          userMessage,
          conversationHistory,
          collectedData: conversation.collected_data || {},
          locale,
          config: {
            enabled: true,
            prompt: claraPrompt,
            model: module.clara_model || 'gpt-4o-mini',
            temperature: module.clara_temperature ?? 0.7,
            timeout_ms: module.clara_timeout_ms ?? 8000
          },
        moduleContext: {
          content: module.content[locale] || module.content.he || module.content.fr || '',
          choices: module.choices || undefined,
          validationFormat: module.validation_format_code || undefined
        },
        systemContext: {
          branches: branchNames,
          faqItems: faqItems.length > 0 ? faqItems : undefined
        }
      })

      // Si Clara réussit (accepter reply vide si is_complete=true)
      if (claraResponse.success && (claraResponse.reply || claraResponse.is_complete)) {
        console.log('[Engine] Clara response:', claraResponse.reply, 'is_complete:', claraResponse.is_complete)

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
        const personalizedReply = claraResponse.reply ? replaceDynamicVariables(claraResponse.reply, updatedData) : ''

        // Enregistrer la réponse de Clara (seulement si non vide)
        if (personalizedReply) {
          await supabase.from('messenger_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: personalizedReply,
            step_ref: currentStep.step_ref
          })
        }

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

        // Si Clara indique que la collecte est complète, VALIDER d'abord les formats
        if (claraResponse.is_complete) {
          console.log('[Engine] Clara marked step as complete')

          // Validation uniquement sur les données du step actuel (pas tout le collected_data)
          const stepData: Record<string, any> = {}
          if (claraResponse.collected_data) {
            Object.assign(stepData, claraResponse.collected_data)
          }
          const validation = validateCriticalFormats(stepData)

          if (!validation.isValid) {
            console.error('[Engine] Clara validation failed:', validation.invalidFields)

            const errorMessages: Record<string, string> = {
              fr: 'Il y a un problème avec les données fournies. Pourriez-vous réessayer ?',
              en: 'There is an issue with the provided data. Could you please try again?',
              he: 'יש בעיה עם הנתונים. אנא נסה שוב.'
            }
            const errorMessage = errorMessages[locale] || errorMessages.fr

            await supabase.from('messenger_messages').insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: errorMessage,
              step_ref: currentStep.step_ref
            })

            return {
              success: true,
              message: errorMessage,
              nextStepRef: currentStep.step_ref,
              moduleType: module.module_type,
              choices: null
            }
          }

          console.log('[Engine] Clara validation passed ✓')

          // Déterminer le output_type correct pour la transition
          // Pour choix_multiples: output_type = "choice_{choiceId}" (pas "success")
          // Pour saisie_texte et autres: output_type = "success"
          let claraOutputType = 'success'

          if (module.module_type === 'choix_multiples' && module.choices && module.choices.length > 0) {
            // Clara a retourné collected_data avec l'ID ou le label du choix
            // Chercher quel choice a été sélectionné
            const claraData = claraResponse.collected_data || {}
            const claraValues = Object.values(claraData).map((v: any) => String(v).toLowerCase().trim())
            console.log('[Engine] Clara collected_data values:', claraValues)

            let matchedChoice = null

            // 1. Match par choice ID exact dans collected_data
            for (const choice of module.choices) {
              if (claraValues.includes(choice.id.toLowerCase())) {
                matchedChoice = choice
                break
              }
            }

            // 2. Match par label dans collected_data
            if (!matchedChoice) {
              for (const choice of module.choices) {
                const labels = [
                  choice.label?.he, choice.label?.fr, choice.label?.en
                ].filter(Boolean).map((l: string) => l.toLowerCase().trim())

                for (const val of claraValues) {
                  if (labels.includes(val) || labels.some((l: string) => l.includes(val) || val.includes(l))) {
                    matchedChoice = choice
                    break
                  }
                }
                if (matchedChoice) break
              }
            }

            // 3. Fallback: match par texte utilisateur contre les labels
            if (!matchedChoice) {
              const userInput = userMessage.toLowerCase().trim()
              matchedChoice = module.choices.find((choice: any) => {
                const label = (choice.label[locale] || choice.label.fr || choice.label.en || '').toLowerCase()
                return label === userInput || label.includes(userInput) || userInput.includes(label)
              })
            }

            if (matchedChoice) {
              claraOutputType = `choice_${matchedChoice.id}`
              console.log('[Engine] Clara choix_multiples matched choice:', matchedChoice.id, '→ outputType:', claraOutputType)
            } else {
              console.warn('[Engine] Clara choix_multiples: could not match any choice, trying all outputs')
              // Fallback: chercher TOUS les outputs pour ce step (pas filtrer par type)
            }
          }

          // Chercher la transition
          let outputsQuery = supabase
            .from('messenger_workflow_outputs')
            .select('*')
            .eq('workflow_id', conversation.current_workflow_id)
            .eq('from_step_ref', currentStep.step_ref)

          // Si on a un output type spécifique, filtrer par ce type
          if (claraOutputType !== 'success' || module.module_type !== 'choix_multiples') {
            outputsQuery = outputsQuery.eq('output_type', claraOutputType)
          }
          // Si choix_multiples mais pas de match → chercher tous les outputs et prendre le premier

          const { data: outputs } = await outputsQuery.order('priority', { ascending: true })

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
            } else if (nextOutput.destination_type === 'workflow' && nextOutput.destination_ref) {
              // Transition vers un autre workflow
              console.log('[Engine] Clara: switching to workflow:', nextOutput.destination_ref)
              const { data: targetWorkflow } = await supabase
                .from('messenger_workflows')
                .select('*')
                .eq('id', nextOutput.destination_ref)
                .single()

              if (targetWorkflow) {
                const { data: targetEntryStep } = await supabase
                  .from('messenger_workflow_steps')
                  .select('*')
                  .eq('workflow_id', targetWorkflow.id)
                  .eq('is_entry_point', true)
                  .single()

                if (targetEntryStep) {
                  const { data: targetModule } = await supabase
                    .from('messenger_modules')
                    .select('*')
                    .eq('ref_code', targetEntryStep.module_ref)
                    .single()

                  if (targetModule) {
                    await supabase
                      .from('messenger_conversations')
                      .update({
                        current_workflow_id: targetWorkflow.id,
                        current_step_ref: targetEntryStep.step_ref,
                        last_activity_at: new Date().toISOString()
                      })
                      .eq('id', conversationId)

                    const targetMessage = targetModule.content[locale] || ''
                    await supabase.from('messenger_messages').insert({
                      conversation_id: conversationId,
                      role: 'assistant',
                      content: targetMessage,
                      step_ref: targetEntryStep.step_ref
                    })

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

      // Si Clara échoue ou timeout, check si le message est une question
      // Si oui, re-poser la question du module au lieu de valider le message comme réponse
      const looksLikeQuestion = /\?/.test(userMessage) || /^(est-ce|is |are |do |does |can |could |when |where |what |how |who |why |combien|quand|comment|pourquoi|האם|מה |מתי|איפה|כמה|למה|איך)/.test(userMessage.trim().toLowerCase())

      if (looksLikeQuestion) {
        console.log('[Engine] Clara failed but message is a question - re-asking module question instead of manual validation')
        // Detect message language first so we can pick the right module content
        const detectMsgLang = (text: string): string => {
          if (/[\u0590-\u05FF]/.test(text)) return 'he'
          if (/[àâçéèêëîïôùûüÿœæ]/i.test(text) || /\b(je|tu|nous|vous|merci|bonjour|oui|non)\b/i.test(text)) return 'fr'
          return 'en'
        }
        const msgLang = detectMsgLang(userMessage)
        // Pick module content in the user's detected language, not the site locale
        const moduleContent = module.content[msgLang] || module.content[locale] || module.content.he || module.content.fr || ''
        const fallbackMessages: Record<string, string> = {
          fr: `Je ne peux pas répondre à cette question pour le moment. ${moduleContent}`,
          en: `I can't answer that question right now. ${moduleContent}`,
          he: `אני לא יכולה לענות על השאלה הזו כרגע. ${moduleContent}`
        }
        const fallbackMsg = fallbackMessages[msgLang] || fallbackMessages[locale] || fallbackMessages.he

        await supabase.from('messenger_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: fallbackMsg,
          step_ref: currentStep.step_ref
        })

        return {
          success: true,
          message: fallbackMsg,
          nextStepRef: currentStep.step_ref,
          moduleType: module.module_type,
          choices: null
        }
      }

      if (claraResponse.timeout) {
        console.log('[Engine] Clara timeout - falling back to MANUAL workflow processing')
      } else {
        console.log('[Engine] Clara failed:', claraResponse.error, '- falling back to MANUAL workflow processing')
      }
      // Ne PAS afficher de message d'erreur — on continue avec le traitement normal du module
      // Le code continue vers le switch/case standard plus bas

      } catch (error) {
        console.error('[Engine] Clara processing error:', error)
        // Continue avec workflow manuel en cas d'erreur
      }
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

          // Resolve branch/contact links after confirmed data
          await resolveConversationLinks(supabase, conversationId, collectedData, currentStep.step_ref)

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

        // Resolve branch/contact links after data collection
        await resolveConversationLinks(supabase, conversationId, collectedData, currentStep.step_ref)
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

      // VALIDATION STRICTE EN MODE MANUEL (sans Clara)
      // Si Clara n'est pas activé pour ce module, on accepte SEULEMENT:
      // 1. Correspondance exacte du label
      // 2. Numéro de choix (1, 2, 3...)
      // Pas de fuzzy matching, pas de correspondance partielle
      const isManualMode = !module.clara_enabled

      if (!selectedChoice && !isManualMode) {
        // Si Clara activé, utiliser fuzzy matching (mode flexible)
        // Si pas de correspondance exacte, chercher une correspondance partielle
        selectedChoice = choices.find((choice: any) => {
          const label = (choice.label[locale] || choice.label.fr || choice.label.en || '').toLowerCase()
          return label.includes(userInput) || userInput.includes(label)
        })

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

        // Resolve branch/contact links after data collection
        await resolveConversationLinks(supabase, conversationId, updatedCollectedData, currentStep.step_ref)
      } else {
        console.log('[Engine] No choice matched!')
        isValid = false

        // Message d'erreur différent selon mode manuel ou Clara
        if (isManualMode) {
          // Mode manuel strict: liste les choix valides
          const validChoices = choices.map((c: any, idx: number) =>
            `${idx + 1}. ${c.label[locale] || c.label.fr || c.label.en}`
          ).join('\n')

          errorMessage = locale === 'fr'
            ? `Veuillez choisir parmi les options suivantes:\n${validChoices}`
            : locale === 'en'
            ? `Please choose from the following options:\n${validChoices}`
            : `אנא בחר מהאפשרויות הבאות:\n${validChoices}`
        } else {
          // Mode Clara flexible: message simple
          errorMessage = locale === 'fr'
            ? 'Choix invalide'
            : (locale === 'en' ? 'Invalid choice' : 'בחירה לא חוקית')
        }
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

        // Si Clara a généré une réponse, l'enregistrer
        if (claraResult.response) {
          await supabase.from('messenger_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: claraResult.response,
            step_ref: currentStep.step_ref
          })
        }

        // Déterminer si le workflow doit continuer
        // Si enable_workflow_navigation est activé et Clara n'a pas navigué, rester sur le même step
        // Sinon, considérer le module comme complété et chercher la sortie 'success'
        if (module.llm_config?.enable_workflow_navigation) {
          // Mode conversation libre: Clara reste sur ce step tant qu'elle ne navigue pas
          console.log('[Engine] Clara LLM with workflow navigation - staying on step (clara_continue)')
          return {
            success: true,
            message: claraResult.response || '',
            nextStepRef: currentStep.step_ref
          }
        } else {
          // Mode step normal: le module est traité, on continue le workflow
          outputType = 'success'
          console.log('[Engine] Clara LLM without workflow navigation - advancing with outputType: success')
        }
      }
      break
  }

  // Traiter order_generation (exécution automatique sans user input)
  if (module.module_type === 'order_generation') {
    try {
      console.log('[Engine] order_generation - collected_data:', conversation.collected_data)
      const collectedData = conversation.collected_data as Record<string, any>

      // Mapper branch name vers branch_id (supports EN/HE labels)
      const branchName = collectedData.WELCOME || 'Rishon Lezion'
      let branch = null
      // Try name first, then name_he
      const { data: branchByName } = await supabase
        .from('branches')
        .select('id, slug')
        .ilike('name', branchName)
        .single()

      if (branchByName) {
        branch = branchByName
      } else {
        // Try Hebrew name
        const { data: branchByHe } = await supabase
          .from('branches')
          .select('id, slug')
          .eq('name_he', branchName)
          .single()
        branch = branchByHe
      }

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
      const r1 = collectedData.RESERVATION1 || ''
      const gameArea = (r1.includes('Active') || r1.includes('אקטיב')) ? 'ACTIVE' : (r1.includes('Laser') || r1.includes('לייזר')) ? 'LASER' : 'MIX'

      // Calculate numberOfGames based on game type
      let numberOfGames = 2 // default
      if (gameArea === 'LASER') {
        // For LASER: use number of parties directly from LASER_GAME_NUMBER
        const laserNum = collectedData.LASER_GAME_NUMBER || ''
        const laserDigit = laserNum.match(/\d+/)?.[0]
        if (laserDigit) {
          numberOfGames = parseInt(laserDigit)
        } else if (laserNum.includes('שעתיים')) {
          numberOfGames = 3
        } else if (laserNum.includes('וחצי')) {
          numberOfGames = 2
        } else {
          numberOfGames = 2
        }
      } else if (gameArea === 'ACTIVE') {
        // For ACTIVE: convert time duration to number of games
        const activeTime = collectedData.ACTIVE_TIME_GAME || ''
        if (activeTime.includes('2H') || activeTime.includes('2h') || activeTime.includes('שעתיים')) {
          numberOfGames = 4
        } else if (activeTime.includes('1H30') || activeTime.includes('1h30') || activeTime.includes('וחצי')) {
          numberOfGames = 3
        } else {
          numberOfGames = 2 // 1H / שעה default
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

      // Branch (supports EN/HE labels)
      let branchSlug = metadata.branch_slug || 'rishon-lezion'
      const welcomeChoice = collectedData.WELCOME
      if (welcomeChoice) {
        // If Hebrew name, look up slug from DB; otherwise convert to slug
        const hasHebrew = /[\u0590-\u05FF]/.test(welcomeChoice)
        if (hasHebrew) {
          const { data: branchLookup } = await supabase
            .from('branches')
            .select('slug')
            .eq('name_he', welcomeChoice)
            .single()
          if (branchLookup) {
            branchSlug = branchLookup.slug
          }
        } else {
          branchSlug = welcomeChoice.toLowerCase().replace(/\s+/g, '-')
        }
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
        if (reservation1Choice.includes('Active') || reservation1Choice.includes('אקטיב')) gameArea = 'ACTIVE'
        else if (reservation1Choice.includes('Laser') || reservation1Choice.includes('לייזר')) gameArea = 'LASER'
        else if (reservation1Choice.includes('Mix') || reservation1Choice.includes('מיקס')) gameArea = 'MIX'
      }

      // Number of games
      let numberOfGames = 1
      const laserGameChoice = collectedData.LASER_GAME_NUMBER
      const activeTimeChoice = collectedData.ACTIVE_TIME_GAME

      if (laserGameChoice) {
        const numMatch = laserGameChoice.match(/(\d+)/)
        if (numMatch) numberOfGames = parseInt(numMatch[1])
        else if (laserGameChoice.includes('שעתיים')) numberOfGames = 3
        else if (laserGameChoice.includes('וחצי')) numberOfGames = 2
      } else if (activeTimeChoice) {
        if (activeTimeChoice.includes('2H') || activeTimeChoice.includes('2h') || activeTimeChoice.includes('שעתיים')) numberOfGames = 4
        else if (activeTimeChoice.includes('1H30') || activeTimeChoice.includes('1h30') || activeTimeChoice.includes('וחצי')) numberOfGames = 3
        else if (activeTimeChoice.includes('1H') || activeTimeChoice.includes('1h') || activeTimeChoice.includes('שעה')) numberOfGames = 2
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

    // Detect user language from their message (declared early — used for FAQ + prompt)
    const detectLang = (text: string): string => {
      if (/[\u0590-\u05FF]/.test(text)) return 'he'
      if (/[àâçéèêëîïôùûüÿœæ]/i.test(text) || /\b(je|tu|il|nous|vous|merci|bonjour|oui|non|est|les|des|une|pour)\b/i.test(text)) return 'fr'
      return 'en'
    }

    // Build FAQ context if enabled — use detected user language, not site locale
    const userLangForFaq = detectLang(userMessage)
    let faqContext = ''
    if (module.llm_config?.use_faq_context) {
      const { data: faqs } = await supabase
        .from('messenger_faq')
        .select('*')
        .eq('is_active', true)
        .order('order_index')

      if (faqs && faqs.length > 0) {
        faqContext = '\n\n## FAQ Knowledge Base\n\n'
        faqs.forEach((faq: any) => {
          // Try detected language first, then fallback chain
          const question = faq.question[userLangForFaq] || faq.question[locale] || faq.question.he || faq.question.fr || faq.question.en
          const answer = faq.answer[userLangForFaq] || faq.answer[locale] || faq.answer.he || faq.answer.fr || faq.answer.en
          faqContext += `Q: ${question}\nA: ${answer}\n\n`
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
        workflowsContext = '\n\n## Available Workflows\n\n'
        workflowsContext += 'You can redirect the user to these workflows when relevant:\n\n'

        workflows.forEach((wf: any) => {
          workflowsContext += `- **${wf.name}** (ID: ${wf.id}): ${wf.description || 'No description'}\n`
        })

        // Add tool for workflow navigation
        tools.push({
          name: 'navigate_to_workflow',
          description: 'Redirect the user to a specific workflow. Use this when the user expresses a clear intent (book, get info, etc.)',
          input_schema: {
            type: 'object',
            properties: {
              workflow_id: {
                type: 'string',
                description: 'The ID of the workflow to redirect to',
                enum: workflows.map((wf: any) => wf.id)
              },
              reason: {
                type: 'string',
                description: 'Short explanation of why you are redirecting (for logs)'
              }
            },
            required: ['workflow_id', 'reason']
          }
        })

        console.log('[Clara LLM] Tool created:', tools[0])
      }
    }

    const userLang = detectLang(userMessage)
    const langInstruction = userLang === 'he' ? 'עברית' : userLang === 'fr' ? 'français' : 'English'

    // Construire le prompt système
    const systemPrompt = `ABSOLUTE RULE #1: You MUST respond in the SAME LANGUAGE as the user's last message. Detected language: ${langInstruction}. French→French, English→English, עברית→עברית.

${module.llm_config?.system_prompt || 'You are Clara, a helpful and friendly virtual assistant.'}

## Collected data
${JSON.stringify(collectedData, null, 2)}
${faqContext}
${workflowsContext}

IMPORTANT RULES:
- NEVER repeat the user's choice or answer (no "Thank you, you chose X"). Get straight to the point.
- Respond concisely and naturally.
- ALWAYS respond in ${langInstruction} — match the user's language.
- If you detect a clear intent matching an available workflow, use the navigate_to_workflow tool to redirect.`

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
