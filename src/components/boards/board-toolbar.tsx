// =====================================================================
// Barra de organização do quadro — filtrar por status/pessoa e ordenar
// =====================================================================
import { Button } from "@/components/ui/button";
import { ArrowDownAZ, ArrowUpAZ, Filter, X } from "lucide-react";
import type { StatusLabel } from "@/lib/boards/column-types";
import type { BoardColumn, Profile } from "@/lib/boards/types";

export function BoardToolbar({
  columns, profiles, filterStatus, onFilterStatus, filterPerson, onFilterPerson,
  sortBy, onSortBy, sortDir, onToggleSortDir, resultCount, totalCount,
}: {
  columns: BoardColumn[];
  profiles: Profile[];
  filterStatus: string | null;
  onFilterStatus: (v: string | null) => void;
  filterPerson: string | null;
  onFilterPerson: (v: string | null) => void;
  sortBy: string | null;
  onSortBy: (v: string | null) => void;
  sortDir: "asc" | "desc";
  onToggleSortDir: () => void;
  resultCount: number;
  totalCount: number;
}) {
  const statusCols = columns.filter((c) => c.type === "status");
  const hasPeople = columns.some((c) => c.type === "people");
  const active = filterStatus || filterPerson || sortBy;

  const selectCls =
    "rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2">
      <Filter className="h-3.5 w-3.5 text-muted-foreground" />

      {statusCols.map((col) => {
        const labels = ((col.settings as { labels?: StatusLabel[] } | null)?.labels ?? []);
        const value = filterStatus?.startsWith(`${col.id}:`) ? filterStatus : "";
        return (
          <select
            key={col.id}
            value={value}
            onChange={(e) => onFilterStatus(e.target.value || null)}
            className={selectCls}
            title={`Filtrar por ${col.title}`}
          >
            <option value="">{col.title}: todos</option>
            {labels.map((l) => (
              <option key={l.index} value={`${col.id}:${l.index}`}>{l.label}</option>
            ))}
          </select>
        );
      })}

      {hasPeople && (
        <select
          value={filterPerson ?? ""}
          onChange={(e) => onFilterPerson(e.target.value || null)}
          className={selectCls}
          title="Filtrar por responsável"
        >
          <option value="">Responsável: todos</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
          ))}
        </select>
      )}

      <span className="mx-0.5 text-border">·</span>

      <select
        value={sortBy ?? ""}
        onChange={(e) => onSortBy(e.target.value || null)}
        className={selectCls}
        title="Ordenar por"
      >
        <option value="">Ordem do quadro</option>
        {columns.map((c) => (
          <option key={c.id} value={c.id}>Ordenar por {c.title}</option>
        ))}
      </select>

      {sortBy && (
        <Button
          size="sm" variant="outline" className="h-7 px-2"
          onClick={onToggleSortDir}
          title={sortDir === "asc" ? "Crescente" : "Decrescente"}
        >
          {sortDir === "asc" ? <ArrowDownAZ className="h-3.5 w-3.5" /> : <ArrowUpAZ className="h-3.5 w-3.5" />}
        </Button>
      )}

      {active && (
        <>
          <Button
            size="sm" variant="ghost" className="h-7 px-2 text-xs"
            onClick={() => { onFilterStatus(null); onFilterPerson(null); onSortBy(null); }}
          >
            <X className="mr-1 h-3 w-3" />Limpar
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {resultCount} de {totalCount}
          </span>
        </>
      )}
    </div>
  );
}
