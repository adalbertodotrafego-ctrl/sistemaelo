-- Permite a um admin desligar uma seção inteira do sistema para todo mundo
-- (diferente de allowed_pages por cargo, que controla quem vê o quê; isto
-- controla se a seção existe no sistema, ponto). Gerenciado em Configurações.
alter table public.agency_settings
  add column if not exists disabled_pages text[] not null default '{}';
