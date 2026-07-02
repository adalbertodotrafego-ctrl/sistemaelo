CREATE TABLE public.schedule_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#2563EB',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_tags TO authenticated;
GRANT ALL ON public.schedule_tags TO service_role;
ALTER TABLE public.schedule_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_tags all auth" ON public.schedule_tags TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER schedule_tags_set_updated_at BEFORE UPDATE ON public.schedule_tags FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.week_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  week_start date NOT NULL,
  start_time time,
  end_time time,
  tag_id uuid REFERENCES public.schedule_tags(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.week_items TO authenticated;
GRANT ALL ON public.week_items TO service_role;
ALTER TABLE public.week_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "week_items all auth" ON public.week_items TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER week_items_set_updated_at BEFORE UPDATE ON public.week_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));