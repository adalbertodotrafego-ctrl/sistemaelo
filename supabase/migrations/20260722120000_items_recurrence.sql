-- =====================================================================
-- Demandas recorrentes
-- =====================================================================
-- `recurrence` guarda a frequência (daily, weekly, biweekly, monthly) e
-- `completed_at` quando a demanda foi marcada como concluída.
--
-- Como reaparece: ao marcar um status que "conclui a demanda", grava-se
-- completed_at. Quando alguém abre o quadro num período novo (outro dia,
-- outra semana…), a demanda recorrente volta a ficar pendente sozinha —
-- sem depender de rotina agendada no servidor.
-- =====================================================================
alter table public.items add column if not exists recurrence   text;
alter table public.items add column if not exists completed_at timestamptz;

-- Só as recorrentes precisam ser varridas ao abrir o quadro.
create index if not exists idx_items_recurrence
  on public.items (board_id, recurrence)
  where recurrence is not null;
