// =====================================================================
// Kanban — colunas pelos labels da coluna Status; arrastar muda o status
// =====================================================================
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { BoardAvatar } from "@/components/boards/avatar";
import type { StatusLabel } from "@/lib/boards/column-types";
import { useProfiles, useSaveCell } from "@/lib/boards/queries";
import type { BoardColumn, CellMap, Group, Item } from "@/lib/boards/types";

const NO_STATUS = "__none";

export function KanbanView({ boardId, groups, columns, items, cellMap, onOpenItem }: {
  boardId: string;
  groups: Group[];
  columns: BoardColumn[];
  items: Item[];
  cellMap: CellMap;
  onOpenItem: (item: Item) => void;
}) {
  const statusColumns = columns.filter((c) => c.type === "status");
  const [statusColId, setStatusColId] = useState<string | null>(null);
  const statusCol = statusColumns.find((c) => c.id === statusColId) ?? statusColumns[0];
  const saveCell = useSaveCell(boardId);
  const [dragging, setDragging] = useState<Item | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const labels = useMemo(
    () => ((statusCol?.settings as { labels?: StatusLabel[] } | null)?.labels ?? []),
    [statusCol],
  );

  const byLabel = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const l of labels) map.set(String(l.index), []);
    map.set(NO_STATUS, []);
    if (!statusCol) return map;
    for (const it of items) {
      const idx = (cellMap[it.id]?.[statusCol.id]?.value as { index?: number } | null)?.index;
      const key = idx != null && map.has(String(idx)) ? String(idx) : NO_STATUS;
      map.get(key)!.push(it);
    }
    return map;
  }, [items, cellMap, statusCol, labels]);

  if (!statusCol) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-center">
        <div>
          <p className="text-lg font-medium text-foreground">Este board não tem coluna de Status</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie uma coluna do tipo Status na Tabela principal para usar o Kanban.
          </p>
        </div>
      </div>
    );
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const item = items.find((i) => i.id === e.active.id);
    const overKey = e.over?.id as string | undefined;
    if (!item || overKey == null || !statusCol) return;
    const input = overKey === NO_STATUS ? null : Number(overKey);
    saveCell.mutate({ itemId: item.id, column: statusCol, input });
  }

  return (
    <div className="h-full overflow-x-auto px-4 py-4">
      {statusColumns.length > 1 && (
        <select
          value={statusCol.id}
          onChange={(e) => setStatusColId(e.target.value)}
          className="mb-3 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
        >
          {statusColumns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={(e) => setDragging(items.find((i) => i.id === e.active.id) ?? null)}
        onDragEnd={onDragEnd}
      >
        <div className="flex h-full items-start gap-3">
          {labels.map((l) => (
            <KanbanColumn
              key={l.index} id={String(l.index)} title={l.label} color={l.color}
              items={byLabel.get(String(l.index)) ?? []} groups={groups} onOpenItem={onOpenItem}
            />
          ))}
          <KanbanColumn
            id={NO_STATUS} title="Sem status" color="#c4c4c4"
            items={byLabel.get(NO_STATUS) ?? []} groups={groups} onOpenItem={onOpenItem}
          />
        </div>
        <DragOverlay>
          {dragging && (
            <div className="w-64 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-lg">
              {dragging.name}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function KanbanColumn({ id, title, color, items, groups, onOpenItem }: {
  id: string; title: string; color: string; items: Item[]; groups: Group[]; onOpenItem: (item: Item) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="flex max-h-full w-[280px] shrink-0 flex-col rounded-lg bg-muted/40"
      style={isOver ? { outline: "2px solid var(--color-primary)", outlineOffset: -2 } : undefined}
    >
      <div className="rounded-t-lg px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: color }}>
        {title} <span className="opacity-80">/ {items.length}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {items.map((it) => (
          <KanbanCard key={it.id} item={it} groups={groups} onOpen={() => onOpenItem(it)} />
        ))}
      </div>
    </div>
  );
}

function KanbanCard({ item, groups, onOpen }: { item: Item; groups: Group[]; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  const { data: profiles } = useProfiles();
  const group = groups.find((g) => g.id === item.group_id);
  const creator = profiles?.find((p) => p.id === item.creator_id);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className="cursor-grab rounded-lg border border-border bg-card px-3 py-2 shadow-sm transition hover:shadow-md active:cursor-grabbing"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <p className="text-sm text-foreground">{item.name || "Sem nome"}</p>
      <div className="mt-2 flex items-center gap-2">
        {group && (
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: group.color }} title={group.title} />
        )}
        {creator && <BoardAvatar name={creator.full_name ?? creator.email ?? "?"} id={creator.id} size={20} />}
      </div>
    </div>
  );
}
