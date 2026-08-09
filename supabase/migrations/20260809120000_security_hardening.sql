-- =====================================================================
-- Blindagem de segurança do Sistema Elo
-- =====================================================================
-- Esta migração fecha quatro furos reais encontrados na revisão:
--
--  1. CONVITES ABERTOS AO MUNDO. A tabela `invites` tinha SELECT liberado
--     para `anon` com USING (true). Como a chave publicável do Supabase vai
--     no JavaScript do site, QUALQUER pessoa na internet podia listar todos
--     os convites válidos e usar um para criar conta no sistema. O UPDATE
--     também estava aberto a `anon` (dava para "descarimbar" convite usado
--     ou esticar a validade). Agora o token só é verificável por RPC: dá
--     para validar um token que você já tem, nunca para descobrir os outros.
--
--  2. AUTOAPROVAÇÃO. A policy "users update own profile" deixava a pessoa
--     escrever qualquer coluna do próprio perfil — inclusive `approved`.
--     Um cadastro pendente rodava um UPDATE e se aprovava sozinho, furando
--     a fila de aprovação do admin. Agora um gatilho barra isso.
--
--  3. APROVAÇÃO NÃO VALIA NADA NO BANCO. O bloqueio do pendente era só no
--     app (redirect para /pending). Quem estava pendente continuava lendo e
--     escrevendo TUDO chamando a API direto. Agora as policies exigem
--     aprovação de verdade.
--
--  4. TUDO ERA "USING (true)". Trinta tabelas — financeiro, contratos,
--     clientes, folha — aceitavam leitura, escrita e DELETE de qualquer
--     pessoa logada. Uma conta comprometida (ou um desligamento mal
--     resolvido) apagava o histórico da agência inteira. Agora o acesso
--     exige aprovação e o DELETE do que é crítico é só de admin.
--
-- IMPORTANTE: policies do Postgres são somadas com OU. Deixar a antiga
-- `USING (true)` viva ao lado de uma nova regra restritiva não protege
-- nada. Por isso cada tabela tem TODAS as policies removidas antes de
-- receber as novas.
--
-- Para os 7 usuários aprovados de hoje nada muda no dia a dia: o que eles
-- já faziam continua funcionando.
-- =====================================================================

-- ── 1. Quem está aprovado? ───────────────────────────────────────────
-- SECURITY DEFINER porque é chamada de dentro das policies de profiles:
-- sem isso a consulta cairia na própria policy e entraria em recursão.
create or replace function public.is_approved(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.approved from public.profiles p where p.id = _user_id),
    false
  ) or public.has_role(_user_id, 'admin');
$$;
grant execute on function public.is_approved(uuid) to authenticated;

comment on function public.is_approved(uuid) is
  'Acesso liberado: perfil aprovado por um admin (admin sempre passa).';

-- ── 2. Ninguém se aprova sozinho ─────────────────────────────────────
create or replace function public.tg_profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() nulo = service_role / SQL Editor: já é acesso confiável.
  if auth.uid() is null then return new; end if;

  if new.approved is distinct from old.approved
     and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Somente administradores podem aprovar ou revogar acessos';
  end if;

  -- Trocar o dono da linha também é escalada de privilégio.
  if new.id is distinct from old.id then
    raise exception 'O identificador do perfil não pode ser alterado';
  end if;

  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.tg_profiles_guard();

-- ── 3. Convites: token vira segredo de verdade ───────────────────────
revoke select, insert, update, delete on public.invites from anon;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
             where schemaname = 'public' and tablename = 'invites'
  loop
    execute format('drop policy %I on public.invites', pol.policyname);
  end loop;
end $$;

-- Só o time aprovado enxerga a lista de convites.
create policy "invites readable by approved" on public.invites
  for select to authenticated using (public.is_approved((select auth.uid())));
create policy "invites created by approved" on public.invites
  for insert to authenticated
  with check (public.is_approved((select auth.uid())) and created_by = (select auth.uid()));
create policy "invites updated by creator or admin" on public.invites
  for update to authenticated
  using (created_by = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'))
  with check (created_by = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'));
create policy "invites deletable by creator or admin" on public.invites
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'));

-- Quem chega pelo link ainda não tem login: precisa checar o token que TEM.
-- Recebe o token e devolve só "vale ou não vale" + o recado. Não dá para
-- listar, varrer nem descobrir outros tokens.
create or replace function public.validate_invite(_token text)
returns table (valid boolean, note text)
language sql stable security definer set search_path = public as $$
  select (i.used_at is null and i.expires_at > now()) as valid, i.note
  from public.invites i
  where i.token = _token
  limit 1;
$$;
grant execute on function public.validate_invite(text) to anon, authenticated;

-- Carimba o convite depois que a conta foi criada. Roda como o novo usuário
-- (já autenticado) e só carimba convite que ainda vale.
create or replace function public.consume_invite(_token text)
returns boolean language plpgsql security definer set search_path = public as $$
declare hit int;
begin
  if auth.uid() is null then return false; end if;
  update public.invites
     set used_at = now(), used_by = auth.uid()
   where token = _token and used_at is null and expires_at > now();
  get diagnostics hit = row_count;
  return hit > 0;
end $$;
grant execute on function public.consume_invite(text) to authenticated;

-- Convite vencido não serve mais nem para validar.
create index if not exists idx_invites_open
  on public.invites (token) where used_at is null;

-- ── 4. Perfis: leitura para o time aprovado, edição só do próprio ────
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
             where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy %I on public.profiles', pol.policyname);
  end loop;
end $$;

-- A própria linha é sempre visível (o pendente precisa ver que está pendente).
create policy "profiles read own or approved" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_approved((select auth.uid())));
create policy "profiles insert own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles update by admin" on public.profiles
  for update to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));
create policy "profiles delete by admin" on public.profiles
  for delete to authenticated
  using (public.has_role((select auth.uid()), 'admin'));

-- ── 5. Tabelas operacionais: exigir aprovação ────────────────────────
-- Mesmo alcance de antes (o time aprovado trabalha à vontade), só que agora
-- cadastro pendente e conta não aprovada não passam.
do $$
declare
  t text;
  pol record;
  -- Trabalho do dia a dia: o time aprovado cria, edita e apaga.
  operacional text[] := array[
    'client_notes','client_labels','crm_leads','crm_labels','projects',
    'project_members','tasks','task_comments','task_assignees','events',
    'event_participants','meetings','campaigns','social_posts','folders',
    'files','goals','schedule_tags','week_items','teams','team_members',
    'report_folders','elo_posts','elo_events','client_reports'
  ];
  -- Memória da agência: apagar é só de admin.
  --
  -- `clients` entra aqui não pelo cadastro em si, mas pelo estrago em
  -- cascata: contracts, client_notes, client_reports e folders apontam para
  -- o cliente com ON DELETE CASCADE. Como cascade do Postgres NÃO passa pela
  -- RLS das tabelas filhas, deixar o cliente aberto anularia a proteção dos
  -- contratos — apagar um cliente levava o histórico jurídico junto.
  -- As telas de financeiro e contratos já são exclusivas de admin, então
  -- para o time nada muda; cliente encerrado continua sendo tratado pelo
  -- status, que é o fluxo correto e reversível.
  critico text[] := array[
    'clients','contracts','finance_entries','employees'
  ];
  -- Configuração e comunicados: escrita só de admin (a tela já é só de admin).
  admin_only text[] := array['agency_settings','system_news','job_roles'];
begin
  foreach t in array operacional || critico || admin_only loop
    if to_regclass('public.' || t) is null then continue; end if;

    -- Defensivo: policy em tabela sem RLS ligada não protege nada.
    execute format('alter table public.%I enable row level security', t);

    for pol in select policyname from pg_policies
               where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;

    execute format($f$
      create policy "read by approved" on public.%I
        for select to authenticated
        using (public.is_approved((select auth.uid())))$f$, t);

    if t = any(admin_only) then
      execute format($f$
        create policy "write by admin" on public.%I
          for insert to authenticated
          with check (public.has_role((select auth.uid()), 'admin'))$f$, t);
      execute format($f$
        create policy "update by admin" on public.%I
          for update to authenticated
          using (public.has_role((select auth.uid()), 'admin'))
          with check (public.has_role((select auth.uid()), 'admin'))$f$, t);
      execute format($f$
        create policy "delete by admin" on public.%I
          for delete to authenticated
          using (public.has_role((select auth.uid()), 'admin'))$f$, t);
    else
      execute format($f$
        create policy "write by approved" on public.%I
          for insert to authenticated
          with check (public.is_approved((select auth.uid())))$f$, t);
      execute format($f$
        create policy "update by approved" on public.%I
          for update to authenticated
          using (public.is_approved((select auth.uid())))
          with check (public.is_approved((select auth.uid())))$f$, t);

      if t = any(critico) then
        execute format($f$
          create policy "delete by admin" on public.%I
            for delete to authenticated
            using (public.has_role((select auth.uid()), 'admin'))$f$, t);
      else
        execute format($f$
          create policy "delete by approved" on public.%I
            for delete to authenticated
            using (public.is_approved((select auth.uid())))$f$, t);
      end if;
    end if;
  end loop;
end $$;

-- ── 6. Notificações: cada um lê as suas ──────────────────────────────
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
             where schemaname = 'public' and tablename = 'notifications'
  loop
    execute format('drop policy %I on public.notifications', pol.policyname);
  end loop;
end $$;

create policy "notif read own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notif update own" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notif delete own" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));
-- Avisar colega continua liberado, mas só para quem já faz parte do time.
create policy "notif insert by approved" on public.notifications
  for insert to authenticated with check (public.is_approved((select auth.uid())));

-- ── 7. Área de trabalho e pastas: ver exige aprovação ────────────────
-- O modelo do "quadro rei" continua (a área aparece para todo o time), mas
-- agora só para quem foi aprovado. Cada QUADRO segue com can_access_board.
drop policy if exists "workspaces readable by all auth" on public.workspaces;
drop policy if exists "workspaces readable by all authenticated" on public.workspaces;
drop policy if exists "workspaces readable by members" on public.workspaces;
create policy "workspaces readable by approved" on public.workspaces
  for select to authenticated using (public.is_approved((select auth.uid())));

drop policy if exists "board_folders readable by all auth" on public.board_folders;
drop policy if exists "board_folders readable by workspace members" on public.board_folders;
create policy "board_folders readable by approved" on public.board_folders
  for select to authenticated using (public.is_approved((select auth.uid())));

-- ── 8. Acesso a quadro também passa a exigir aprovação ───────────────
create or replace function public.can_access_board(_board_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_approved(_user_id)
    and (
      public.has_role(_user_id, 'admin')
      or exists (
        select 1
        from public.boards b
        where b.id = _board_id
          and (
            b.owner_id = _user_id
            or exists (select 1 from public.board_members bm
                       where bm.board_id = b.id and bm.user_id = _user_id)
          )
      )
    );
$$;

-- board_members é consultado a cada verificação de acesso; a PK cobre
-- (board_id, user_id), mas a busca por usuário sozinho ficava sem índice.
create index if not exists idx_board_members_user on public.board_members(user_id);

-- ── 9. Estados de OAuth expiram ──────────────────────────────────────
-- Linha de state sem validade fica válida para sempre e vira porta de
-- entrada se vazar. Some depois de 15 minutos.
alter table public.google_oauth_states
  add column if not exists created_at timestamptz not null default now();
create index if not exists idx_google_oauth_states_created
  on public.google_oauth_states (created_at);

create or replace function public.purge_stale_oauth_states()
returns void language sql security definer set search_path = public as $$
  delete from public.google_oauth_states where created_at < now() - interval '15 minutes';
$$;
