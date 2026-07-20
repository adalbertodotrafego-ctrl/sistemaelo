-- =========================================================================
-- Planejamento Elo: calendário de conteúdo do próprio perfil da Elo Marketing
-- (posts, reels, stories, lives…). Tabela separada de social_posts (que é o
-- planejamento por cliente e alimenta a contagem em Relatórios) — assim as duas
-- coisas não se misturam.
-- =========================================================================
CREATE TABLE public.elo_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  link TEXT,
  content_type TEXT NOT NULL DEFAULT 'post',   -- post, reel, story, carousel, live, video
  platform TEXT NOT NULL DEFAULT 'instagram',  -- instagram, facebook, tiktok, youtube, linkedin
  video_type TEXT,                             -- livre: "Reels", "Tutorial", "Depoimento"…
  media_url TEXT,                              -- imagem/capa do conteúdo
  mentions UUID[] NOT NULL DEFAULT '{}',       -- membros da equipe marcados
  scheduled_at TIMESTAMPTZ,                    -- quando entra no calendário
  status TEXT NOT NULL DEFAULT 'idea',         -- idea, in_production, scheduled, published
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.elo_posts TO authenticated;
GRANT ALL ON public.elo_posts TO service_role;
ALTER TABLE public.elo_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "elo_posts all auth" ON public.elo_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER elo_posts_set_updated_at BEFORE UPDATE ON public.elo_posts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Realtime: o quadro atualiza ao vivo quando a equipe planeja junto.
ALTER PUBLICATION supabase_realtime ADD TABLE public.elo_posts;
ALTER TABLE public.elo_posts REPLICA IDENTITY FULL;
