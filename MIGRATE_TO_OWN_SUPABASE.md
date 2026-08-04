# Deploy on Vercel with your own Supabase account

## Step 1: Run this SQL in your new Supabase project

1. Open your Supabase project dashboard.
2. Go to **SQL Editor** → **New query**.
3. Paste the entire script below and click **Run**.

```sql
-- Private schema for security-definer helper functions
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Private has_role helper (used by RLS policies)
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- App settings table
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Search logs table
CREATE TABLE public.search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  class_value text NOT NULL,
  roll_no text NOT NULL,
  status text NOT NULL,
  student_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX search_logs_created_at_idx ON public.search_logs (created_at DESC);
GRANT ALL ON public.search_logs TO service_role;
GRANT SELECT ON public.search_logs TO authenticated;
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins manage profiles" ON public.profiles
  FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public settings are readable" ON public.app_settings
  FOR SELECT TO anon, authenticated USING (key IN ('site_locked', 'class_options'));

CREATE POLICY "Admins read search logs" ON public.search_logs
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));

-- Trigger: auto-create profile and first admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('site_locked', 'false'::jsonb),
  ('class_options', '[]'::jsonb);
```

## Step 2: Get your new Supabase keys

In your Supabase project:

1. Go to **Project Settings → API**.
2. Copy:
   - **Project URL** (e.g. `https://xxxxxxxxxxxxxxxxxxxx.supabase.co`)
   - **anon / public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`)

## Step 3: Add environment variables in Vercel

1. Open your Vercel project → **Settings → Environment Variables**.
2. Add these variables (use the values from Step 2):

| Name | Value |
|------|-------|
| `SUPABASE_URL` | your new Supabase Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | your new Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | your new Supabase service_role key |
| `VITE_SUPABASE_URL` | same as `SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | same as `SUPABASE_PUBLISHABLE_KEY` |

3. Make sure they are applied to **Production** (and Preview if you want).

## Step 4: Redeploy

1. In Vercel, go to **Deployments**.
2. Click the latest deployment → **Redeploy** (use existing Build Cache = No).

After redeploy:
- Public result search + PDF + Excel will work.
- Admin login will work at `/auth`.
- First user who signs up automatically becomes `admin`.

## Note

Do **not** share the `SUPABASE_SERVICE_ROLE_KEY`. It bypasses all row-level security and should only live in Vercel/server environments, never in the browser.
