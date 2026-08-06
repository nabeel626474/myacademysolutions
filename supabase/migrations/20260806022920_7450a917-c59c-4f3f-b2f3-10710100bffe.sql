CREATE TABLE public.school_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_value text NOT NULL,
  roll_no text NOT NULL,
  institution text NOT NULL DEFAULT 'Unknown institution',
  student_name text,
  obtained integer,
  status text,
  grade text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_value, roll_no)
);

GRANT SELECT ON public.school_results TO authenticated;
GRANT ALL ON public.school_results TO service_role;

ALTER TABLE public.school_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read cached results"
ON public.school_results FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'staff'::app_role));

CREATE INDEX school_results_class_idx ON public.school_results (class_value);
CREATE INDEX school_results_institution_idx ON public.school_results (class_value, institution);

INSERT INTO public.app_settings (key, value)
VALUES ('scan_ranges', '{"SSC-I":"","SSC-II":""}'::jsonb)
ON CONFLICT (key) DO NOTHING;