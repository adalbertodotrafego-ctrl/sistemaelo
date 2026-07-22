// =====================================================================
// O grid do board — grupos coloridos, dnd de itens, células pelo registry
// =====================================================================
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { useEffect, useRef, useState } from "react";
import { Palette, Repeat, Sparkles } from "lucide-react";
import { NewDemandDialog } from "@/components/boards/new-demand-dialog";
import { Cell, MIN_COL_WIDTH, colWidth } from "@/components/boards/cell";
import { StatusLabelsEditor } from "@/components/boards/status-editor";
import { ColorSwatches } from "@/components/boards/color-swatches";
import { GROUP_COLORS } from "@/components/boards/colors";
import {
  useCreateColumn, useCreateGroup, useDeleteColumn, useDeleteGroup, useRenameGroup,
  useSetColumnWidth, useSetGroupColor, useSetStatusLabels,
} from "@/lib/boards/admin";
import { COLUMN_TYPE_LIST } from "@/lib/boards/columns";
import { useAddItem, useMoveItem, useRenameItem, useSaveCell, useSetItemState } from "@/lib/boards/queries";
import { RECURRENCE_LABELS, type BoardColumn, type CellMap, type Group, type Item, type Profile } from "@/lib/boards/types";
import { cn } from "@/lib/utils";

const NAME_COL_WIDTH = 340;

export function BoardGrid({ boardId, groups, columns, items, cellMap, profiles, onOpenItem }: {
  boardId: string;
  groups: Group[];
  columns: BoardColumn[];
  items: Item[];
  cellMap: CellMap;
  profiles: Profile[];
  onOpenItem: (item: Item) => void;
}) {
  const moveItem = useMoveItem(boardId);
  const createGroup = useCreateGroup(boardId);
  const setStatusLabels = useSetStatusLabels(boardId);
  const [dragging, setDragging] = useState<Item | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [statusCol, setStatusCol] = useState<BoardColumn | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const itemsByGroup = new Map<string, Item[]>();
  const orphans: Item[] = [];
  for (const it of items) {
    if (it.group_id && groups.some((g) => g.id === it.group_id)) {
      const arr = itemsByGroup.get(it.group_id) ?? [];
      arr.push(it);
      itemsByGroup.set(it.group_id, arr);
    } else {
      orphans.push(it);
    }
  }

  // Soltou em cima de uma linha → entra ANTES dela; num grupo → vai pro fim.
  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const item = items.find((i) => i.id === e.active.id);
    const overId = e.over?.id as string | undefined;
    if (!item || !overId) return;

    if (overId.startsWith("group:")) {
      const groupId = overId.slice(6);
      const list = itemsByGroup.get(groupId) ?? [];
      const last = list.filter((i) => i.id !== item.id).at(-1);
      moveItem.mutate({ itemId: item.id, groupId, position: (last?.position ?? 0) + 1 });
      return;
    }
    if (overId.startsWith("row:")) {
      const overItem = items.find((i) => i.id === overId.slice(4));
      if (!overItem || overItem.id === item.id || !overItem.group_id) return;
      const list = (itemsByGroup.get(overItem.group_id) ?? []).filter((i) => i.id !== item.id);
      const idx = list.findIndex((i) => i.id === overItem.id);
      const prev = idx > 0 ? list[idx - 1].position : overItem.position - 2;
      moveItem.mutate({ itemId: item.id, groupId: overItem.group_id, position: (prev + overItem.position) / 2 });
    }
  }

  const gridWidth = NAME_COL_WIDTH + columns.reduce((acc, c) => acc + colWidth(c.type, c.width), 0) + 44;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDragging(items.find((i) => i.id === e.active.id) ?? null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="px-4 py-4" style={{ minWidth: gridWidth + 32 }}>
        <HeaderRow
          boardId={boardId}
          columns={columns}
          onEditStatus={(c) => { setStatusCol(c); setStatusOpen(true); }}
        />

        {groups.map((g) => (
          <GroupSection
            key={g.id} boardId={boardId} group={g} columns={columns}
            items={itemsByGroup.get(g.id) ?? []} cellMap={cellMap} profiles={profiles} onOpenItem={onOpenItem}
            onEditStatus={(c) => { setStatusCol(c); setStatusOpen(true); }}
          />
        ))}

        {orphans.length > 0 && (
          <GroupSection
            boardId={boardId}
            group={{ id: "__orphans", title: "Sem grupo", color: "#c4c4c4" } as Group}
            columns={columns} items={orphans} cellMap={cellMap} profiles={profiles}
            onOpenItem={onOpenItem}
            onEditStatus={(c) => { setStatusCol(c); setStatusOpen(true); }}
            readOnlyGroup
          />
        )}

        <div className="mt-4">
          {newGroupOpen ? (
            <input
              autoFocus
              placeholder="Nome do grupo"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v) createGroup.mutate({ title: v });
                setNewGroupOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setNewGroupOpen(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setNewGroupOpen(true)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              + Adicionar grupo
            </button>
          )}
        </div>
      </div>

      <DragOverlay>
        {dragging && (
          <div className="flex h-9 w-80 items-center rounded-md border border-primary bg-card px-3 text-sm text-foreground shadow-lg">
            {dragging.name || "Sem nome"}
          </div>
        )}
      </DragOverlay>

      <StatusLabelsEditor
        column={statusCol}
        groups={groups}
        open={statusOpen}
        onOpenChange={setStatusOpen}
        onSave={(columnId, labels, rest) => setStatusLabels(columnId, labels, rest)}
      />
    </DndContext>
  );
}

// ── Cabeçalho de colunas + "+" (nova coluna) ─────────────────────────
function HeaderRow({ boardId, columns, onEditStatus }: {
  boardId: string; columns: BoardColumn[]; onEditStatus: (c: BoardColumn) => void;
}) {
  const createColumn = useCreateColumn(boardId);
  const deleteColumn = useDeleteColumn(boardId);
  const setWidth = useSetColumnWidth(boardId);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="sticky top-0 z-20 flex border-b border-border bg-card text-xs font-medium text-muted-foreground">
      <div style={{ width: NAME_COL_WIDTH }} className="px-3 py-2">Item</div>
      {columns.map((c) => (
        <div
          key={c.id}
          style={{ width: colWidth(c.type, c.width) }}
          className="group/col relative shrink-0 border-l border-border/50 px-2 py-2 text-center"
          title={`${c.title} (${c.type})`}
        >
          <span className="truncate">{c.title}</span>
          <div className="absolute right-1 top-1.5 hidden items-center gap-0.5 group-hover/col:flex">
            {c.type === "status" && (
              <button
                type="button"
                onClick={() => onEditStatus(c)}
                className="rounded px-1 text-muted-foreground/60 hover:bg-accent hover:text-primary"
                title="Editar status e cores"
              >
                <Palette className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Excluir a coluna "${c.title}"? Os valores serão perdidos.`))
                  deleteColumn.mutate({ columnId: c.id });
              }}
              className="rounded px-1 text-muted-foreground/60 hover:bg-accent hover:text-destructive"
              title="Excluir coluna"
            >
              ×
            </button>
          </div>
          <ResizeHandle
            width={colWidth(c.type, c.width)}
            onCommit={(w) => setWidth.mutate({ columnId: c.id, width: w })}
          />
        </div>
      ))}
      <div className="relative w-11 shrink-0 border-l border-border/50 text-center">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="h-full w-full py-2 text-muted-foreground hover:bg-accent/40 hover:text-primary"
          title="Adicionar coluna"
        >
          +
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-md border border-border bg-popover p-1 text-left shadow-lg">
            {COLUMN_TYPE_LIST.map((t) => (
              <button
                key={t.type}
                type="button"
                onClick={() => {
                  const title = window.prompt(`Nome da coluna (${t.label}):`);
                  if (title?.trim()) createColumn.mutate({ title: title.trim(), type: t.type });
                  setMenuOpen(false);
                }}
                className="block w-full rounded-sm px-2 py-1.5 text-left text-sm font-normal text-foreground hover:bg-accent"
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Alça de redimensionar (borda direita do cabeçalho). Enquanto arrasta,
 * a largura muda só visualmente via CSS var; ao soltar, grava no banco —
 * evita uma escrita por pixel movido.
 */
function ResizeHandle({ width, onCommit }: { width: number; onCommit: (w: number) => void }) {
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startW = useRef(width);
  const cellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dragging) return;
    const parent = cellRef.current?.parentElement as HTMLElement | null;
    const onMove = (e: MouseEvent) => {
      const next = Math.max(MIN_COL_WIDTH, startW.current + (e.clientX - startX.current));
      if (parent) parent.style.width = `${next}px`;
    };
    const onUp = (e: MouseEvent) => {
      setDragging(false);
      const next = Math.max(MIN_COL_WIDTH, startW.current + (e.clientX - startX.current));
      if (next !== startW.current) onCommit(next);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging, onCommit]);

  return (
    <div
      ref={cellRef}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startX.current = e.clientX;
        startW.current = width;
        setDragging(true);
      }}
      onDoubleClick={() => onCommit(0)}
      title="Arraste para redimensionar (duplo clique volta ao padrão)"
      className={cn(
        "absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize",
        dragging ? "bg-primary/40" : "hover:bg-primary/30",
      )}
    />
  );
}

// ── Grupo ────────────────────────────────────────────────────────────
function GroupSection({ boardId, group, columns, items, cellMap, profiles, onOpenItem, onEditStatus, readOnlyGroup }: {
  boardId: string; group: Group; columns: BoardColumn[]; items: Item[]; cellMap: CellMap;
  profiles: Profile[]; onOpenItem: (item: Item) => void;
  onEditStatus: (c: BoardColumn) => void; readOnlyGroup?: boolean;
}) {
  const renameGroup = useRenameGroup(boardId);
  const deleteGroup = useDeleteGroup(boardId);
  const setGroupColor = useSetGroupColor(boardId);
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: `group:${group.id}` });

  return (
    <section className="mt-6 first:mt-3">
      <div className="group/gh flex items-center gap-2 py-1">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold"
          style={{ color: group.color }}
        >
          <span className={cn("inline-block text-[10px] transition-transform", collapsed && "-rotate-90")}>▼</span>
          {renaming ? (
            <input
              autoFocus
              defaultValue={group.title}
              className="rounded-sm bg-background px-1 text-sm font-semibold outline-none ring-2 ring-primary/40"
              style={{ color: group.color }}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== group.title) renameGroup.mutate({ groupId: group.id, title: v });
                setRenaming(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setRenaming(false);
              }}
            />
          ) : (
            <span>{group.title}</span>
          )}
        </button>
        <span className="text-sm font-normal text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "itens"}
        </span>
        {!readOnlyGroup && !renaming && (
          <span className="relative hidden gap-1 group-hover/gh:flex">
            <button
              type="button"
              onClick={() => setColorOpen((v) => !v)}
              className="rounded px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Cor
            </button>
            {colorOpen && (
              <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-md border border-border bg-popover p-2 shadow-lg">
                <ColorSwatches
                  colors={GROUP_COLORS}
                  value={group.color}
                  onPick={(color) => { setGroupColor.mutate({ groupId: group.id, color }); setColorOpen(false); }}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setRenaming(true)}
              className="rounded px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Renomear
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Excluir o grupo "${group.title}"? Os itens dele ficam em "Sem grupo".`))
                  deleteGroup.mutate({ groupId: group.id });
              }}
              className="rounded px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-destructive"
            >
              Excluir
            </button>
          </span>
        )}
      </div>

      {!collapsed && (
        <div
          ref={setNodeRef}
          className="overflow-visible rounded-md border border-border"
          style={{
            borderLeftWidth: 6,
            borderLeftColor: group.color,
            ...(isOver ? { outline: "2px dashed var(--color-primary)", outlineOffset: -2 } : {}),
          }}
        >
          {items.map((it) => (
            <ItemRow
              key={it.id} boardId={boardId} item={it} columns={columns}
              cellMap={cellMap} profiles={profiles} onOpenItem={onOpenItem}
            />
          ))}
          {!readOnlyGroup && (
            <AddItemRow
              boardId={boardId}
              groupId={group.id}
              groupTitle={group.title}
              nextPosition={(items.at(-1)?.position ?? 0) + 1}
              columns={columns}
              onEditStatus={onEditStatus}
            />
          )}
        </div>
      )}
    </section>
  );
}

// ── Linha do item ────────────────────────────────────────────────────
function ItemRow({ boardId, item, columns, cellMap, profiles, onOpenItem }: {
  boardId: string; item: Item; columns: BoardColumn[]; cellMap: CellMap;
  profiles: Profile[]; onOpenItem: (item: Item) => void;
}) {
  const saveCell = useSaveCell(boardId);
  const renameItem = useRenameItem(boardId);
  const setItemState = useSetItemState(boardId);
  const { attributes, listeners, setNodeRef: dragRef } = useDraggable({ id: item.id });
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: `row:${item.id}` });

  return (
    <div
      ref={dropRef}
      className={cn(
        "group/row flex border-b border-border/50 bg-card last:border-b-0",
        isOver && "border-t-2 border-t-primary",
      )}
    >
      <div style={{ width: NAME_COL_WIDTH }} className="flex shrink-0 items-center">
        <span
          ref={dragRef}
          {...attributes}
          {...listeners}
          className="w-5 cursor-grab text-center text-muted-foreground/60 opacity-0 group-hover/row:opacity-100 active:cursor-grabbing"
          title="Arrastar"
        >
          ⋮⋮
        </span>
        <ItemName name={item.name} onRename={(name) => renameItem.mutate({ itemId: item.id, name })} />
        {item.recurrence && (
          <span className="mr-1 shrink-0 text-primary" title={`Recorrente — ${RECURRENCE_LABELS[item.recurrence]}`}>
            <Repeat className="h-3 w-3" />
          </span>
        )}
        <button
          type="button"
          onClick={() => onOpenItem(item)}
          className="mr-1 shrink-0 rounded px-1.5 text-muted-foreground/60 opacity-0 hover:bg-accent hover:text-primary group-hover/row:opacity-100"
          title="Abrir atualizações"
        >
          💬
        </button>
        <RowMenu onArchive={() => setItemState.mutate({ itemId: item.id, state: "archived" })} />
      </div>
      {columns.map((c) => (
        <Cell
          key={c.id}
          column={c}
          cell={cellMap[item.id]?.[c.id]}
          profiles={profiles}
          onSave={(input) => saveCell.mutate({ itemId: item.id, column: c, input, itemName: item.name })}
        />
      ))}
      <div className="w-11 shrink-0 border-l border-border/50" />
    </div>
  );
}

function RowMenu({ onArchive }: { onArchive: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative mr-1 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="rounded px-1.5 text-muted-foreground/60 opacity-0 hover:bg-accent hover:text-foreground group-hover/row:opacity-100"
        title="Mais ações"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-36 rounded-md border border-border bg-popover p-1 shadow-lg">
          <button
            type="button"
            onClick={onArchive}
            className="block w-full rounded-sm px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent"
          >
            Arquivar
          </button>
        </div>
      )}
    </div>
  );
}

function ItemName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <input
        autoFocus
        defaultValue={name}
        className="h-9 min-w-0 flex-1 border-0 bg-transparent px-2 text-sm text-foreground outline-none ring-2 ring-inset ring-primary/40"
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== name) onRename(v);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="h-9 min-w-0 flex-1 cursor-text truncate px-2 text-left text-sm leading-9 text-foreground hover:bg-accent/40"
      title={name}
    >
      {name || <span className="text-muted-foreground/60">Sem nome</span>}
    </button>
  );
}

function AddItemRow({ boardId, groupId, groupTitle, nextPosition, columns, onEditStatus }: {
  boardId: string; groupId: string; groupTitle: string; nextPosition: number;
  columns: BoardColumn[]; onEditStatus: (c: BoardColumn) => void;
}) {
  const addItem = useAddItem(boardId);
  const [value, setValue] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  function commit() {
    const name = value.trim();
    if (!name) return;
    addItem.mutate({ groupId, name, position: nextPosition });
    setValue("");
  }

  return (
    <div className="flex items-center bg-muted/30">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        onBlur={commit}
        placeholder="+ Adicionar item"
        style={{ width: NAME_COL_WIDTH }}
        className="h-9 bg-transparent px-7 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:bg-card"
      />
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="ml-1 flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        title="Criar demanda com tipo e recorrência"
      >
        <Sparkles className="h-3 w-3" />Demanda
      </button>
      <NewDemandDialog
        boardId={boardId}
        groupId={groupId}
        groupTitle={groupTitle}
        nextPosition={nextPosition}
        columns={columns}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onEditTypes={(c) => { setDialogOpen(false); onEditStatus(c); }}
      />
    </div>
  );
}
