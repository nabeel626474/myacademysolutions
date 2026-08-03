CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

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

DROP POLICY "Admins manage profiles" ON public.profiles;
DROP POLICY "Admins read all profiles" ON public.profiles;
DROP POLICY "Admins read all roles" ON public.user_roles;
DROP POLICY "Admins read search logs" ON public.search_logs;

CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read search logs" ON public.search_logs FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);