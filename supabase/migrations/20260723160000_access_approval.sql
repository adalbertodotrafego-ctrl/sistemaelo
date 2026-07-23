-- =====================================================================
-- Aprovação de acesso — sistema privado
-- =====================================================================
-- Novo login (Google ou manual) nasce PENDENTE e só entra depois que um
-- admin aprova. Quem já usa o sistema hoje é marcado como aprovado, para
-- ninguém ser trancado do lado de fora. O primeiro usuário (que vira admin)
-- também nasce aprovado, senão o sistema começaria travado.
-- =====================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false;

-- Todos os perfis que já existem entram aprovados.
UPDATE public.profiles SET approved = true;

-- Recria o trigger de novo usuário para gravar o approved certo.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  INSERT INTO public.profiles (id, full_name, email, avatar_url, approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    user_count = 0   -- primeiro usuário (admin) já entra aprovado; os demais, pendentes
  );
  IF user_count = 0 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'member');
  END IF;
  RETURN NEW;
END; $$;

-- A pessoa pendente precisa conseguir ler o próprio perfil (já coberto pela
-- policy "profiles readable by authenticated"). Aprovar é UPDATE em profiles,
-- já permitido a admins pela policy "admins update any profile".
