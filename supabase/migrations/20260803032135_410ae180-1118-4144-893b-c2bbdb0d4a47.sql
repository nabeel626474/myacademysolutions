UPDATE public.app_settings
SET value = 'false'::jsonb,
    updated_at = now(),
    updated_by = NULL
WHERE key = 'site_locked';