-- Convert clara_fallback_message from TEXT to JSONB (multilingual: {fr, en, he})
-- Migrate existing text values to JSONB with the text as Hebrew default

ALTER TABLE messenger_workflows
  ALTER COLUMN clara_fallback_message TYPE JSONB
  USING CASE
    WHEN clara_fallback_message IS NOT NULL AND clara_fallback_message != ''
    THEN jsonb_build_object(
      'fr', 'Je rencontre un problème technique. Un de nos agents vous recontactera rapidement. 📞',
      'en', 'I''m experiencing a technical issue. One of our agents will get back to you shortly. 📞',
      'he', clara_fallback_message
    )
    ELSE jsonb_build_object(
      'fr', 'Je rencontre un problème technique. Un de nos agents vous recontactera rapidement. 📞',
      'en', 'I''m experiencing a technical issue. One of our agents will get back to you shortly. 📞',
      'he', 'אני נתקל בבעיה טכנית. אחד הנציגים שלנו יחזור אליך בהקדם לסיום ההזמנה. 📞'
    )
  END;
