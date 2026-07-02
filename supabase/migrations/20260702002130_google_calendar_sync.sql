-- Google Calendar two-way sync: per-user OAuth connections + short-lived OAuth state tokens.

CREATE TABLE public.google_oauth_states (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.google_oauth_states TO service_role;

CREATE TABLE public.google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email TEXT,
  refresh_token TEXT NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
GRANT SELECT, DELETE ON public.google_calendar_connections TO authenticated;
GRANT ALL ON public.google_calendar_connections TO service_role;
CREATE POLICY "users read own google connection" ON public.google_calendar_connections
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users delete own google connection" ON public.google_calendar_connections
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER google_calendar_connections_set_updated_at
  BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
