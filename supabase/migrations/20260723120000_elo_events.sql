-- =====================================================================
-- Eventos da Elo — feiras, palestras, gravações, ativações… tudo que a
-- agência vai participar. Tabela dedicada (separada de `events`, que é de
-- Reuniões/Dashboard), com campos ricos e um responsável.
-- =====================================================================
CREATE TABLE public.elo_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'evento',   -- evento, feira, palestra, gravacao, reuniao, ativacao, viagem
  location TEXT,
  link TEXT,
  responsible_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'confirmed',  -- planned, confirmed, done, canceled
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_elo_events_starts_at ON public.elo_events (starts_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.elo_events TO authenticated;
GRANT ALL ON public.elo_events TO service_role;
ALTER TABLE public.elo_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "elo_events all auth" ON public.elo_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER elo_events_set_updated_at BEFORE UPDATE ON public.elo_events FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.elo_events;
