import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

// Type definition
interface WorkflowClaraSettings {
  clara_default_prompt: string | null
  clara_personality: string | null
  clara_rules: string | null
  clara_model_global: string | null
  clara_temperature_global: number | null
  clara_fallback_action: 'escalate' | 'retry' | 'abort' | null
  clara_fallback_message: string | null
}

// Default personality
const DEFAULT_PERSONALITY = `You are a warm, friendly, and natural assistant — like a helpful human concierge.
- Be conversational and personable. Use a natural tone, never robotic or stiff.
- When the user says something off-topic (e.g. "I want to order", "how much?", "where are you located?"), FIRST acknowledge what they said warmly and helpfully, THEN naturally transition to the module question.
- Always make the user feel heard. Never ignore what they said to jump straight to a question.
- Keep responses concise but warm. No walls of text.`

// Default rules
const DEFAULT_RULES = `- Valid choice → is_complete:true, collected_data filled, reply_to_user can be ""
- Off-topic question → is_complete:false, answer BRIEFLY using ONLY the FAQ below, then NATURALLY weave in the current module question at the end of your reply. The transition must feel organic, not mechanical.
- NEVER repeat the user's choice
- NEVER re-ask info already in collected data
- Ambiguous question (e.g. "how much?" without specifying) → ask for clarification warmly
- Unclear/incomprehensible message → rephrase the module question in a friendly, engaging way
- ABSOLUTELY NEVER invent or guess information (hours, prices, addresses, etc.). If the answer is NOT in the FAQ section below, say you don't have that info and suggest they contact the team or check the website. ONLY use facts from the ## RELEVANT FAQ section.
- CRITICAL: When is_complete is false, your reply_to_user MUST naturally include the module question — but integrate it smoothly, don't just append it mechanically`

// Default prompt (abbreviated — full version in DB)
const DEFAULT_PROMPT = `את Clara, עוזרת הזמנות חכמה של Active Games. תפקידך לאסוף מידע מהלקוח בשיחה טבעית ונעימה.

## תפקידך האוניברסלי:
1. **הבן את המודול הנוכחי** - קרא את השאלה שנשאלה ללקוח והבן מה צריך לאסוף
2. **אסוף מידע בצורה חכמה** - תרגם שפה אנושית לפורמט מדויק
3. **וודא נכונות** - לפני מעבר לשלב הבא, וודא שהמידע תקין
4. **היה גמישה** - הלקוח יכול לתת מספר פרטים בבת אחת, לחזור אחורה, או לשאול שאלות

## פורמטים נדרשים (חובה לשמור בדיוק!):
- **WELCOME** (סניף): רק "Rishon Lezion" או "Petach Tikva"
- **NAME** (שם): שם פרטי + משפחה אם יש
- **NUMBER** (טלפון): מספרים בלבד, 10 ספרות
- **DATE** (תאריך): פורמט YYYY-MM-DD בלבד
- **TIME** (שעה): פורמט HH:MM 24 שעות
- **RESERVATION1** (סוג פעילות): "LASER" או "ACTIVE_TIME" בדיוק
- **RESERVATION2** (משתתפים): מספר

## כללי התנהגות:
✅ אסוף מספר פרטים בו-זמנית אם הלקוח נותן
✅ תרגם תשובות לפורמט הנכון
✅ אם מידע לא תקין - בקש הבהרה
✅ אם לקוח שואל שאלה - ענה בקצרה (השתמש ב-FAQ) וחזור לנושא
❌ אל תעבור לשלב הבא אם חסר מידע
❌ אל תמציא סניפים

הגדר is_complete: true רק כאשר כל המידע הנדרש **נכון ותקין**!`

// GET - Load global Clara settings (from first active workflow or defaults)
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient()

    // Get first active workflow's Clara settings as global defaults
    const { data: workflow, error } = await supabase
      .from('messenger_workflows')
      .select('clara_default_prompt, clara_personality, clara_rules, clara_model_global, clara_temperature_global, clara_fallback_action, clara_fallback_message')
      .eq('is_active', true)
      .single() as { data: WorkflowClaraSettings | null, error: any }

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    // Merge workflow settings with defaults
    const settings = {
      clara_default_prompt: workflow?.clara_default_prompt || DEFAULT_PROMPT,
      clara_personality: workflow?.clara_personality || DEFAULT_PERSONALITY,
      clara_rules: workflow?.clara_rules || DEFAULT_RULES,
      clara_model_global: workflow?.clara_model_global || 'gpt-4o-mini',
      clara_temperature_global: workflow?.clara_temperature_global ?? 0.7,
      clara_fallback_action: workflow?.clara_fallback_action || 'escalate' as const,
      clara_fallback_message: workflow?.clara_fallback_message || 'אני נתקל בבעיה טכנית. אחד הנציגים שלנו יחזור אליך בהקדם לסיום ההזמנה. 📞'
    }

    return NextResponse.json({
      success: true,
      settings,
      defaults: {
        clara_default_prompt: DEFAULT_PROMPT,
        clara_personality: DEFAULT_PERSONALITY,
        clara_rules: DEFAULT_RULES,
      }
    })
  } catch (error) {
    console.error('[Clara Settings GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load Clara settings' },
      { status: 500 }
    )
  }
}

// PUT - Save global Clara settings (to all active workflows)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      clara_default_prompt,
      clara_personality,
      clara_rules,
      clara_model_global,
      clara_temperature_global,
      clara_fallback_action,
      clara_fallback_message
    } = body

    const supabase = createServiceRoleClient()

    // Build update object with only provided fields
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    }
    if (clara_default_prompt !== undefined) updateData.clara_default_prompt = clara_default_prompt
    if (clara_personality !== undefined) updateData.clara_personality = clara_personality
    if (clara_rules !== undefined) updateData.clara_rules = clara_rules
    if (clara_model_global !== undefined) updateData.clara_model_global = clara_model_global
    if (clara_temperature_global !== undefined) updateData.clara_temperature_global = clara_temperature_global
    if (clara_fallback_action !== undefined) updateData.clara_fallback_action = clara_fallback_action
    if (clara_fallback_message !== undefined) updateData.clara_fallback_message = clara_fallback_message

    // Update all active workflows with these settings
    const { error } = await (supabase
      .from('messenger_workflows') as any)
      .update(updateData)
      .eq('is_active', true)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Clara settings saved successfully'
    })
  } catch (error) {
    console.error('[Clara Settings PUT] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save Clara settings' },
      { status: 500 }
    )
  }
}
