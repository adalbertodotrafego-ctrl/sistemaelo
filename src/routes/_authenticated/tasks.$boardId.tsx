import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { KanbanView } from "@/components/boards/kanban";
import { BoardTopbar } from "@/components/boards/topbar";
import { BoardGrid } from "@/components/boards/board-grid";
import { ItemPanel } from "@/components/boards/item-panel";
import { getColumnType } from "@/lib/boards/columns";
import { BoardToolbar } from "@/components/boards/board-toolbar";
import { useAddItem, useBoardData, useProfiles } from "@/lib/boards/queries";
import type { Item } from "@/lib/boards/types";
import { useBoardRealtime } from "@/lib/boards/realtime";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/$boardId")({
  head: () => ({ meta: [{ title: "Quadro — Elo Marketing OS" }] }),
  component: BoardPage,
});

function BoardPage() {
  const { boardId } = Route.useParams();
  const { data, isLoading, error } = useBoardData(boardId);
  const { data: profiles } = useProfiles();
  const addItem = useAddItem(boardId);
  const [tab, setTab] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterPerson, setFilterPerson] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const live = useBoardRealtime(boardId);

  // Busca (nome ou qualquer célula) + filtros de organização + ordenação.
  const filteredItems = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    let list = data.items;

    if (q) {
      list = list.filter((it) => {
        if (it.name.toLowerCase().includes(q)) return true;
        const cells = data.cellMap[it.id];
        if (!cells) return false;
        return Object.values(cells).some((c) => c.text_cache?.toLowerCase().includes(q));
      });
    }

    if (filterStatus) {
      const [colId, idx] = filterStatus.split(":");
      list = list.filter(
        (it) => String((data.cellMap[it.id]?.[colId]?.value as { index?: number } | null)?.index) === idx,
      );
    }

    if (filterPerson) {
      const peopleCols = data.columns.filter((c) => c.type === "people").map((c) => c.id);
      list = list.filter((it) =>
        peopleCols.some((cid) =>
          ((data.cellMap[it.id]?.[cid]?.value as { personsAndTeams?: { id: string }[] } | null)?.personsAndTeams ?? [])
            .some((p) => p.id === filterPerson),
        ),
      );
    }

    if (sortBy) {
      const col = data.columns.find((c) => c.id === sortBy);
      if (col) {
        const def = getColumnType(col.type);
        const settings = (col.settings ?? {}) as Record<string, unknown>;
        list = [...list].sort((a, b) => {
          const va = data.cellMap[a.id]?.[col.id]?.value ?? null;
          const vb = data.cellMap[b.id]?.[col.id]?.value ?? null;
          const r = def.compare(va, vb, settings);
          return sortDir === "asc" ? r : -r;
        });
      }
    }

    return list;
  }, [data, search, filterStatus, filterPerson, sortBy, sortDir]);

  if (isLoading) return <p className="px-2 py-10 text-sm text-muted-foreground">Carregando quadro…</p>;
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Erro ao carregar: {error.message}
      </div>
    );
  }
  if (!data) return null;

  const panelItem: Item | null = openItemId ? (data.items.find((i) => i.id === openItemId) ?? null) : null;

  function handleNewItem() {
    const firstGroup = data?.groups[0];
    if (!firstGroup) {
      toast.error('Crie um grupo primeiro (botão "+ Adicionar grupo" no fim do quadro).');
      return;
    }
    const last = data?.items.filter((i) => i.group_id === firstGroup.id).at(-1);
    addItem.mutate({ groupId: firstGroup.id, name: "Novo item", position: (last?.position ?? 0) + 1 });
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex min-w-0 flex-1 flex-col">
        <BoardTopbar
          board={data.board}
          tab={tab}
          onTabChange={setTab}
          search={search}
          onSearchChange={setSearch}
          onNewItem={handleNewItem}
          live={live}
        />
        {tab === "table" && (
          <BoardToolbar
            columns={data.columns}
            profiles={profiles ?? []}
            filterStatus={filterStatus}
            onFilterStatus={setFilterStatus}
            filterPerson={filterPerson}
            onFilterPerson={setFilterPerson}
            sortBy={sortBy}
            onSortBy={setSortBy}
            sortDir={sortDir}
            onToggleSortDir={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            resultCount={filteredItems.length}
            totalCount={data.items.length}
          />
        )}
        <div className="min-h-0 flex-1 overflow-auto">
          {tab === "table" ? (
            <BoardGrid
              boardId={data.board.id}
              groups={data.groups}
              columns={data.columns}
              items={filteredItems}
              cellMap={data.cellMap}
              profiles={profiles ?? []}
              onOpenItem={(it) => setOpenItemId(it.id)}
            />
          ) : (
            <KanbanView
              boardId={data.board.id}
              groups={data.groups}
              columns={data.columns}
              items={filteredItems}
              cellMap={data.cellMap}
              onOpenItem={(it) => setOpenItemId(it.id)}
            />
          )}
        </div>
      </div>
      {panelItem && <ItemPanel item={panelItem} boardId={boardId} onClose={() => setOpenItemId(null)} />}
    </div>
  );
}
