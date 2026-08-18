import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyState } from "@/components/ui-extras/page";
import { TasksShell } from "@/components/boards/tasks-shell";
import { UserCheck } from "lucide-react";
import { useBoardsTree, useMyItems } from "@/lib/boards/queries";
import { useCurrentUser } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/tasks/")({
  head: () => ({ meta: [{ title: "Tarefas — Elo Marketing OS" }] }),
  component: BoardsHome,
});

function BoardsHome() {
  return (
    <TasksShell>
      <div className="min-h-0 flex-1 overflow-auto p-5">
        <MyDemands />
      </div>
    </TasksShell>
  );
}

/**
 * "Minhas demandas" — tudo em que você foi marcado como responsável, de
 * qualquer quadro. A demanda continua morando no quadro de origem: esta é
 * uma visão pessoal por cima, não uma cópia.
 */
function MyDemands() {
  const { user } = useCurrentUser();
  const { data: tree } = useBoardsTree();
  const { data: all, isLoading, error } = useMyItems(user?.id);
  const [scope, setScope] = useState<"today" | "all">("today");

  const king = tree?.[0] ?? null;
  const hasBoards = (king?.boards?.length ?? 0) > 0;

  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  // "Hoje" = tem alguma data marcada para hoje, ou um cronograma que engloba
  // hoje. Demanda sem data nenhuma também entra: é trabalho em aberto que
  // ninguém agendou, e sumir com ela esconderia serviço.
  const isToday = (it: any) => {
    const dates: string[] = it.dates ?? [];
    if (dates.length === 0) return true;
    if (dates.includes(todayKey)) return true;
    const min = dates.reduce((a, b) => (a < b ? a : b));
    const max = dates.reduce((a, b) => (a > b ? a : b));
    return min <= todayKey && todayKey <= max;
  };

  const items = scope === "today" ? (all ?? []).filter(isToday) : (all ?? []);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando suas demandas…</p>;
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Erro ao carregar: {error.message}
      </div>
    );
  }

  if (!hasBoards) {
    return (
      <EmptyState
        icon={UserCheck}
        title="Nenhum quadro ainda"
        description="Use a barra lateral para criar seu primeiro quadro, ou peça a um admin para te adicionar como responsável de um."
      />
    );
  }

  const scopeToggle = (
    <div className="mb-4 inline-flex rounded-lg border border-border/60 p-0.5">
      {([["today", "Hoje"], ["all", `Todas (${all?.length ?? 0})`]] as const).map(([v, label]) => (
        <button
          key={v}
          onClick={() => setScope(v)}
          className={
            "rounded-md px-3 py-1.5 text-xs font-medium transition " +
            (scope === v ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")
          }
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (items.length === 0) {
    return (
      <div>
        {scopeToggle}
        <EmptyState
          icon={UserCheck}
          title={scope === "today" ? "Nada para hoje" : "Nenhuma demanda para você"}
          description={
            scope === "today"
              ? "Nenhuma demanda sua está marcada para hoje. Veja em \"Todas\" o que está agendado para outros dias."
              : "Quando alguém te marcar como responsável numa demanda (coluna de Pessoas), ela aparece aqui automaticamente."
          }
        />
      </div>
    );
  }

  // Agrupa por quadro para dar contexto de onde cada demanda mora.
  const byBoard = new Map<string, { board: any; items: any[] }>();
  for (const it of items) {
    const b = it.boards;
    if (!b) continue;
    if (!byBoard.has(b.id)) byBoard.set(b.id, { board: b, items: [] });
    byBoard.get(b.id)!.items.push(it);
  }

  return (
    <div>
      {scopeToggle}
      <div className="space-y-6">
      {Array.from(byBoard.values()).map(({ board, items: list }) => (
        <section key={board.id}>
          <div className="mb-2 flex items-center gap-2">
            {board.icon && <span>{board.icon}</span>}
            <Link
              to="/tasks/$boardId"
              params={{ boardId: board.id }}
              className="font-display text-sm font-semibold hover:text-primary"
            >
              {board.name}
            </Link>
            <span className="text-xs text-muted-foreground">{list.length}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {list.map((it: any) => (
              <Link
                key={it.id}
                to="/tasks/$boardId"
                params={{ boardId: board.id }}
                className="surface-card block p-3 transition hover:border-primary/40"
                style={board.color ? { borderLeft: `3px solid ${board.color}` } : undefined}
              >
                <div className="text-sm font-medium">{it.name || "Sem nome"}</div>
                {it.description && (
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{it.description}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
      </div>
    </div>
  );
}
