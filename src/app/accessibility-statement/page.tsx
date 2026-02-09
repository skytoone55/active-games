import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'הצהרת נגישות | Active Games',
  description: 'הצהרת נגישות של Active Games - מחויבות לנגישות אתר לאנשים עם מוגבלות',
}

export default function AccessibilityStatement() {
  const currentDate = new Date().toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <main className="min-h-screen bg-dark py-16 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="bg-dark-100 rounded-2xl p-8 md:p-12 border border-dark-200">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4">
              הצהרת נגישות
            </h1>
            <p className="text-gray-400">
              עדכון אחרון: {currentDate}
            </p>
          </div>

          {/* Content */}
          <div className="space-y-8 text-right" dir="rtl">

            {/* Introduction */}
            <section>
              <p className="text-lg text-gray-300 leading-relaxed">
                Active Games מחויבת להנגיש את האתר והשירותים שלנו לאנשים עם מוגבלות.
                אנו עושים מאמצים מתמשכים לשפר את הנגישות של האתר שלנו כדי להבטיח
                חווית משתמש חיובית, נוחה ונגישה לכולם, ללא קשר ליכולות הפיזיות,
                הקוגניטיביות או הטכנולוגיות שלהם.
              </p>
            </section>

            {/* Standard Compliance */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-primary">●</span>
                התאמה לתקן ישראלי
              </h2>
              <p className="text-gray-300 leading-relaxed">
                האתר נבנה בהתאם ל<strong>תקן ישראלי 5568</strong> (IS 5568), המבוסס על
                הנחיות WCAG 2.1 ברמת AA. זהו התקן המחייב בישראל להנגשת אתרי אינטרנט
                ושירותים דיגיטליים.
              </p>
            </section>

            {/* Accessibility Features */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-primary">●</span>
                התאמות נגישות שבוצעו
              </h2>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span><strong>ניווט באמצעות מקלדת:</strong> כל הפונקציונליות של האתר זמינה באמצעות מקלדת בלבד</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span><strong>תמיכה בקוראי מסך:</strong> האתר תומך בטכנולוגיות עזר כגון NVDA, JAWS ו-VoiceOver</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span><strong>ניגודיות צבעים:</strong> יחס ניגודיות מינימלי של 4.5:1 בין טקסט לרקע</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span><strong>שינוי גודל טקסט:</strong> אפשרות להגדלת טקסט עד 200% ללא אובדן תוכן</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span><strong>תיאורי תמונות:</strong> כל התמונות המשמעותיות כוללות תיאור טקסטואלי (Alt Text)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span><strong>תמיכה ב-RTL:</strong> תמיכה מלאה בכיוון ימין לשמאל (עברית)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span><strong>כותרות מסודרות:</strong> מבנה הירארכי תקין של כותרות (H1-H6)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">✓</span>
                  <span><strong>פקדי נגישות:</strong> כפתור נגישות עם אפשרויות להתאמה אישית</span>
                </li>
              </ul>
            </section>

            {/* Accessibility Widget */}
            <section className="bg-dark-200 p-6 rounded-lg">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-primary">●</span>
                תפריט נגישות
              </h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                האתר כולל תפריט נגישות (הכפתור בצד שמאל של המסך) המאפשר התאמה אישית:
              </p>
              <ul className="space-y-2 text-gray-300 mr-4">
                <li>• שינוי גודל טקסט (רגיל / גדול / גדול יותר)</li>
                <li>• מצב ניגודיות גבוהה</li>
                <li>• הדגשת קישורים (קו תחתון)</li>
                <li>• ריווח בין אותיות</li>
                <li>• השהיית אנימציות</li>
              </ul>
            </section>

            {/* Known Limitations */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-primary">●</span>
                מגבלות ידועות
              </h2>
              <p className="text-gray-300 leading-relaxed">
                למרות מאמצינו להנגיש את כל חלקי האתר, ייתכן שחלקים מסוימים עדיין אינם
                נגישים באופן מלא. אנו ממשיכים לעבוד על שיפור הנגישות באופן שוטף ומקבלים
                בברכה משוב מהמשתמשים שלנו.
              </p>
            </section>

            {/* Contact */}
            <section className="bg-primary/10 border border-primary rounded-lg p-6">
              <h2 className="text-2xl font-bold text-primary mb-4 flex items-center gap-2">
                <span>●</span>
                יצירת קשר בנושאי נגישות
              </h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                אם נתקלת בבעיית נגישות באתר, או שיש לך הצעות לשיפור הנגישות,
                נשמח לשמוע ממך:
              </p>
              <div className="space-y-3 text-gray-300">
                <div className="flex items-center gap-3">
                  <span className="text-primary font-bold">📧</span>
                  <div>
                    <strong>דוא״ל:</strong>{' '}
                    <a
                      href="mailto:accessibility@activegames.co.il"
                      className="text-primary hover:underline"
                    >
                      accessibility@activegames.co.il
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-primary font-bold">📞</span>
                  <div>
                    <strong>טלפון:</strong> 050-724-7407
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-primary font-bold">💬</span>
                  <div>
                    <strong>WhatsApp:</strong> 050-724-7407
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-4">
                אנו מתחייבים לטפל בכל פנייה תוך 5 ימי עסקים ולספק פתרון או חלופה נגישה.
              </p>
            </section>

            {/* Feedback */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-primary">●</span>
                מחויבות מתמשכת
              </h2>
              <p className="text-gray-300 leading-relaxed">
                Active Games רואה בנגישות ערך מרכזי ומתחייבת להמשיך ולשפר את נגישות
                האתר באופן רציף. אנו עורכים בדיקות נגישות תקופתיות ומעדכנים את האתר
                בהתאם לסטנדרטים המתקדמים ביותר.
              </p>
            </section>

            {/* Footer Info */}
            <section className="border-t border-dark-200 pt-6 mt-8 text-sm text-gray-400">
              <div className="space-y-2">
                <p><strong>גרסת תקן:</strong> WCAG 2.1 Level AA / תקן ישראלי 5568</p>
                <p><strong>תאריך עדכון אחרון:</strong> {currentDate}</p>
                <p><strong>מנהל נגישות:</strong> Active Games</p>
              </div>
            </section>

          </div>
        </div>
      </div>
    </main>
  )
}
