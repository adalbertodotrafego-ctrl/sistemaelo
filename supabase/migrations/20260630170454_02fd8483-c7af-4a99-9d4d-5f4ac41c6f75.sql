-- Job roles (cargos) with per-page permissions
CREATE TABLE public.job_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  allowed_pages text[] NOT NULL DEFAULT '{}',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_roles TO authenticated;
GRANT ALL ON public.job_roles TO service_role;

ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_roles readable by authenticated" ON public.job_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins manage job_roles - insert" ON public.job_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage job_roles - update" ON public.job_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage job_roles - delete" ON public.job_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND is_system = false);

CREATE TRIGGER job_roles_set_updated_at BEFORE UPDATE ON public.job_roles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Add job_role_id to profiles
ALTER TABLE public.profiles ADD COLUMN job_role_id uuid REFERENCES public.job_roles(id) ON DELETE SET NULL;

-- Allow admins to update any profile (for assigning cargos)
CREATE POLICY "admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default cargos
INSERT INTO public.job_roles (name, description, allowed_pages, is_system) VALUES
  ('Administrador', 'Acesso total ao sistema', ARRAY['dashboard','clients','crm','projects','tasks','calendar','meetings','team','finance','contracts','marketing','social','files','reports','goals','notifications','profile','settings'], true),
  ('Gestor de Tráfego', 'Gerencia campanhas e clientes', ARRAY['dashboard','clients','crm','projects','tasks','calendar','marketing','social','reports','goals','notifications','profile'], true),
  ('Estagiário', 'Acesso restrito a tarefas e calendário', ARRAY['dashboard','tasks','calendar','notifications','profile'], true);