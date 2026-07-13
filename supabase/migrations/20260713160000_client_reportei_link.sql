-- Liga cada cliente do sistema ao projeto correspondente no Reportei, para que
-- o construtor de relatórios saiba de onde puxar os indicadores automaticamente.
-- É um ID numérico externo (do Reportei), por isso não tem FK — só um vínculo simples.
alter table public.clients
  add column if not exists reportei_project_id integer;
