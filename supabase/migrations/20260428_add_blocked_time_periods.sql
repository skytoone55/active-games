-- Table pour les créneaux horaires bloqués
-- Supporte deux modes :
--   is_recurring = false → blocage ponctuel (start_datetime / end_datetime)
--   is_recurring = true  → blocage récurrent (jour(s) de semaine + plage horaire + période de validité)

CREATE TABLE IF NOT EXISTS blocked_time_periods (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id              UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  label                  TEXT NOT NULL DEFAULT '',          -- Raison visible sur le calendrier

  is_recurring           BOOLEAN NOT NULL DEFAULT FALSE,

  -- Blocage ponctuel (is_recurring = false)
  start_datetime         TIMESTAMPTZ,                       -- UTC
  end_datetime           TIMESTAMPTZ,                       -- UTC

  -- Blocage récurrent (is_recurring = true)
  recurrence_days        INTEGER[],                         -- [0..6] 0=Dimanche, 1=Lundi … 6=Samedi
  recurrence_start_time  TEXT,                              -- "HH:MM" heure locale Israël
  recurrence_end_time    TEXT,                              -- "HH:MM" heure locale Israël
  recurrence_valid_from  DATE,                              -- inclusif, null = immédiatement
  recurrence_valid_until DATE,                              -- inclusif, null = indéfiniment

  created_by             UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les requêtes par branche
CREATE INDEX IF NOT EXISTS blocked_time_periods_branch_id_idx
  ON blocked_time_periods(branch_id);

-- RLS : même politique que les autres tables admin
ALTER TABLE blocked_time_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage blocked periods"
  ON blocked_time_periods
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
