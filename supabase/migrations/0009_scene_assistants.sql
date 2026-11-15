-- ===========================================================================
-- NEXORA 0.7 "Scene Assistants"
--   * appearance_preferences.companion_form: 'scene' (the helper changes form with the scene)
--     or a pinned form: nova, cora, lumi, maple, yuki, aurora, rain, nemo, ash, orbit, grid.
-- Safe to run more than once.
-- ===========================================================================
alter table public.appearance_preferences add column if not exists companion_form text not null default 'scene';
alter table public.appearance_preferences drop constraint if exists appearance_preferences_companion_form_check;
alter table public.appearance_preferences add constraint appearance_preferences_companion_form_check
  check (companion_form in ('scene', 'nova', 'cora', 'lumi', 'maple', 'yuki', 'aurora', 'rain', 'nemo', 'ash', 'orbit', 'grid'));
