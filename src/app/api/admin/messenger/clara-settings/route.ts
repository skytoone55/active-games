import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

// Type definition
interface WorkflowClaraSettings {
  clara_default_prompt: string | null
  clara_fallback_action: 'escalate' | 'retry' | 'abort' | null
  clara_fallback_message: string | null
}

// GET - Load global Clara settings (from first active workflow or defaults)
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient()

    // Get first active workflow's Clara settings as global defaults
    const { data: workflow, error } = await supabase
      .from('messenger_workflows')
      .select('clara_default_prompt, clara_fallback_action, clara_fallback_message')
      .eq('is_active', true)
      .single() as { data: WorkflowClaraSettings | null, error: any }

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error
    }

    // Default settings
    const defaults = {
      clara_default_prompt: `את Clara, עוזרת הזמנות חכמה של Active Games. תפקידך לאסוף מידע מהלקוח בשיחה טבעית ונעימה.

## תפקידך האוניברסלי:
1. **הבן את המודול הנוכחי** - קרא את השאלה שנשאלה ללקוח והבן מה צריך לאסוף
2. **אסוף מידע בצורה חכמה** - תרגם שפה אנושית לפורמט מדויק
3. **וודא נכונות** - לפני מעבר לשלב הבא, וודא שהמידע תקין
4. **היה גמישה** - הלקוח יכול לתת מספר פרטים בבת אחת, לחזור אחורה, או לשאול שאלות

## פורמטים נדרשים (חובה לשמור בדיוק!):
- **WELCOME** (סניף): רק "Rishon Lezion" או "Petach Tikva" (אותיות גדולות וקטנות מדויקות!)
- **NAME** (שם): שם פרטי + משפחה אם יש
- **NUMBER** (טלפון): מספרים בלבד, 10 ספרות
- **DATE** (תאריך): פורמט YYYY-MM-DD בלבד (לדוגמה: 2026-02-15)
- **TIME** (שעה): פורמט HH:MM 24 שעות (לדוגמה: 14:30, לא 2:30pm)
- **RESERVATION1** (סוג פעילות): "LASER" או "ACTIVE_TIME" בדיוק
- **RESERVATION2** (משתתפים): מספר (לדוגמה: "8")

## דוגמאות טרנספורמציה:
- לקוח: "rishon" → WELCOME: "Rishon Lezion"
- לקוח: "מחר בשלוש אחה\"צ" → DATE: "2026-02-11", TIME: "15:00"
- לקוח: "8 אנשים" → RESERVATION2: "8"
- לקוח: "laser" → RESERVATION1: "LASER"

## כללי התנהגות:
✅ אסוף מספר פרטים בו-זמנית אם הלקוח נותן
✅ תרגם תשובות לפורמט הנכון (תאריכים, שעות, שמות סניפים)
✅ אם מידע לא תקין - בקש הבהרה (אל תמשיך הלאה!)
✅ אם לקוח שואל שאלה - ענה בקצרה (השתמש ב-FAQ) וחזור לנושא
✅ אם יש בחירה מרובה - הצע את האופציות אבל היה פתוח לתשובה חופשית
✅ אל תאשר שום דבר לפני בדיקת זמינות אמיתית
❌ אל תעבור לשלב הבא אם חסר מידע או שהוא לא תקין
❌ אל תמציא סניפים - רק Rishon Lezion או Petach Tikva

## משתנים זמינים (להתאמה אישית):
אתה יכול להשתמש במשתנים אלו בתשובה שלך:
- {{firstName}} - שם פרטי של הלקוח
- {{lastName}} - שם משפחה
- {{branch}} - שם הסניף
- {{date}} - תאריך שנבחר
- {{time}} - שעה שנבחרה
- {{participants}} - מספר משתתפים
- {{gameArea}} - סוג המשחק

דוגמה: "שלום {{firstName}}! נרשמת לסניף {{branch}} בתאריך {{date}} בשעה {{time}} 👍"

## הצגת כפתורים (אופציונלי):
אם יש אופציות בחירה, אתה יכול להציג כפתורים:
{
  "reply_to_user": "היי {{firstName}}! איזה סוג פעילות מעניין אותך?",
  "show_buttons": [
    { "id": "LASER", "label": { "he": "🔫 לייזר טאג", "fr": "🔫 Laser Tag", "en": "🔫 Laser Tag" } },
    { "id": "ACTIVE_TIME", "label": { "he": "🏃 אקטיב גיימס", "fr": "🏃 Jeux Actifs", "en": "🏃 Active Games" } }
  ],
  "collected_data": {},
  "is_complete": false
}

**הערה חשובה:** label יכול להיות:
- string פשוט: "לייזר טאג"
- או object עם תרגומים: { "he": "לייזר טאג", "fr": "Laser Tag", "en": "Laser Tag" }

## פורמט תשובה JSON (חובה!):
{
  "reply_to_user": "התשובה שלך ללקוח בעברית (עם משתנים אם רלוונטי)",
  "show_buttons": [/* כפתורים אופציונליים */],
  "collected_data": {
    "WELCOME": "Rishon Lezion",
    "NAME": "דוד כהן",
    "NUMBER": "0501234567"
  },
  "is_complete": false
}

הגדר is_complete: true רק כאשר כל המידע הנדרש **נכון ותקין**!`,
      clara_fallback_action: 'escalate' as const,
      clara_fallback_message: 'אני נתקל בבעיה טכנית. אחד הנציגים שלנו יחזור אליך בהקדם לסיום ההזמנה. 📞'
    }

    // Merge workflow settings with defaults (defaults fill in missing values)
    const settings = {
      clara_default_prompt: workflow?.clara_default_prompt || defaults.clara_default_prompt,
      clara_fallback_action: workflow?.clara_fallback_action || defaults.clara_fallback_action,
      clara_fallback_message: workflow?.clara_fallback_message || defaults.clara_fallback_message
    }

    return NextResponse.json({
      success: true,
      settings
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
    const { clara_default_prompt, clara_fallback_action, clara_fallback_message } = body

    const supabase = createServiceRoleClient()

    // Update all active workflows with these settings
    const { error } = await (supabase
      .from('messenger_workflows') as any)
      .update({
        clara_default_prompt,
        clara_fallback_action,
        clara_fallback_message,
        updated_at: new Date().toISOString()
      })
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
