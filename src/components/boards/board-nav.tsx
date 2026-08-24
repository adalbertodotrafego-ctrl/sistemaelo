// =====================================================================
// Mini barra lateral de Tarefas (estilo monday) — todos os quadros e seções
// sempre visíveis; clicar entra no quadro sem perder a navegação.
// =====================================================================
import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Search, Star, Archive, AlertTriangle, Loader2, UserCheck, Copy, Crown, Shield,
  FolderPlus, FolderOpen, FolderInput, Pencil, Trash2, ArrowUp, ArrowDown, MoreVertical,
  ChevronRight, GripVertical, LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { BoardSettings } from "@/components/boards/board-settings";
import { useBoardsTree, usePrefetchBoard } from "@/lib/boards/queries";
import {
  useArchiveBoard, useCreateBoard, useCreateWorkspace, useDuplicateBoard,
  useRenameWorkspace, useCreateFolder, useRenameFolder, useDeleteFolder,
  useMoveBoardToFolder, useReorderBoard, useReorderBoards,
} from "@/lib/boards/admin";
import { useFavorites } from "@/lib/boards/workspace-state";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

export function BoardNav({ activeBoardId }: { activeBoardId?: string }) {
  const { data: tree, isLoading, error } = useBoardsTree();
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [favs, toggleFav] = useFavorites();
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const createWorkspace = useCreateWorkspace();
  const createBoard = useCreateBoard();
  const archiveBoard = useArchiveBoard();
  const renameWorkspace = useRenameWorkspace();
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const moveBoardToFolder = useMoveBoardToFolder();
  const reorderBoard = useReorderBoard();
  const reorderBoards = useReorderBoards();
  const duplicateBoard = useDuplicateBoard();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const [boardOpen, setBoardOpen] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<any>(null);
  const [settingsTarget, setSettingsTarget] = useState<any>(null);
  const [dupTarget, setDupTarget] = useState<any>(null);
  const [dupName, setDupName] = useState("");
  const [dupItems, setDupItems] = useState(false);
  const [renameOpen, setRenameOpen] = useState<null | { type: "king" | "folder"; id: string; name: string }>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<any>(null);

  const missingTables = error && /does not exist|schema cache/i.test(error.message);
  const king = tree?.[0] ?? null;
  const isIndexRoute = pathname === "/tasks" || pathname === "/tasks/";

  // Só ADMIN cria a área rei quando ainda não existe.
  useEffect(() => {
    if (isAdmin && !isLoading && !error && (tree?.length ?? 0) === 0 && !createWorkspace.isPending) {
      createWorkspace.mutate({ name: "Elo Marketing OS" });
    }
  }, [isAdmin, isLoading, error, tree, createWorkspace]);

  // Não-admin com exatamente 1 quadro: vai direto pra ele quando abre a lista.
  useEffect(() => {
    if (!isIndexRoute || isAdmin || isLoading) return;
    const boards = tree?.[0]?.boards ?? [];
    if (boards.length === 1) {
      navigate({ to: "/tasks/$boardId", params: { boardId: boards[0].id }, replace: true });
    }
  }, [isIndexRoute, isAdmin, isLoading, tree, navigate]);

  const allBoards = king?.boards ?? [];
  const folders = king?.folders ?? [];
  const byPosition = (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0);
  const term = q.trim().toLowerCase();
  const matches = (b: any) => !term || b.name.toLowerCase().includes(term);
  const boardsInFolder = (folderId: string | null) =>
    allBoards.filter((b: any) => (b.folder_id ?? null) === folderId && matches(b)).sort(byPosition);

  const sections: { id: string | null; name: string; boards: any[] }[] = [
    { id: null, name: "Sem seção", boards: boardsInFolder(null) },
    ...folders.map((f: any) => ({ id: f.id, name: f.name, boards: boardsInFolder(f.id) })),
  ];
  const favBoards = allBoards.filter((b: any) => favs.has(b.id) && matches(b)).sort((a: any, b: any) => a.name.localeCompare(b.name, "pt-BR"));

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openNewBoard = () => { setBoardName(""); setBoardOpen(true); };
  const move = (list: any[], index: number, dir: -1 | 1) => {
    const other = index + dir;
    if (other < 0 || other >= list.length) return;
    reorderBoard.mutate({
      a: { id: list[index].id, position: list[index].position ?? 0 },
      b: { id: list[other].id, position: list[other].position ?? 0 },
    });
  };
  const submitRename = () => {
    if (!renameOpen || !renameValue.trim()) return;
    if (renameOpen.type === "king") renameWorkspace.mutate({ workspaceId: renameOpen.id, name: renameValue.trim() });
    else renameFolder.mutate({ folderId: renameOpen.id, name: renameValue.trim() });
    setRenameOpen(null);
  };

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-border/60 bg-surface/40">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Crown className="h-3.5 w-3.5" />
          </span>
          <span className="truncate font-display text-sm font-semibold">{king?.name ?? "Tarefas"}</span>
          {isAdmin && king && (
            <button
              onClick={() => { setRenameOpen({ type: "king", id: king.id, name: king.name }); setRenameValue(king.name); }}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Editar nome do quadro rei"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
        {isAdmin && king && (
          <button onClick={openNewBoard} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Novo quadro">
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-2.5 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar quadro…"
            className="w-full rounded-md border border-border/60 bg-background/60 py-1.5 pl-8 pr-2 text-xs placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 pb-4">
        <Link
          to="/tasks"
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition",
            isIndexRoute ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-accent/60",
          )}
        >
          <UserCheck className="h-3.5 w-3.5 shrink-0" />Minhas demandas
        </Link>

        {isLoading && <p className="px-2 py-2 text-xs text-muted-foreground">Carregando quadros…</p>}
        {missingTables && (
          <div className="mx-1 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-[11px] text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Aplique a migração <strong>boards_core</strong> no Supabase.
          </div>
        )}

        {favBoards.length > 0 && (
          <NavSection
            id="favorites" name="Favoritos" boards={favBoards} collapsed={collapsed.has("favorites")}
            onToggleCollapse={() => toggleCollapse("favorites")} activeBoardId={activeBoardId} isAdmin={false}
            favs={favs} toggleFav={toggleFav} folders={folders} sensors={sensors}
            onDragEnd={() => {}} onSettings={setSettingsTarget} onDuplicate={(b) => { setDupTarget(b); setDupName(`${b.name} (cópia)`); setDupItems(false); }}
            onArchive={setArchiveTarget} onMoveToFolder={() => {}} move={() => {}}
          />
        )}

        {king && sections.map((sec) => {
          if (sec.id === null && sec.boards.length === 0) return null;
          if (term && sec.boards.length === 0) return null;
          return (
            <div key={sec.id ?? "none"}>
              <div className="group flex items-center gap-1 px-1">
                <button
                  onClick={() => toggleCollapse(sec.id ?? "none")}
                  className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className={cn("h-3 w-3 shrink-0 transition-transform", !collapsed.has(sec.id ?? "none") && "rotate-90")} />
                  {sec.id ? <FolderOpen className="h-3 w-3 shrink-0" /> : <LayoutGrid className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{sec.name}</span>
                  <span className="shrink-0 text-[10px] normal-case text-muted-foreground/70">{sec.boards.length}</span>
                </button>
                {sec.id && isAdmin && (
                  <div className="hidden items-center gap-0.5 group-hover:flex">
                    <button onClick={() => { setRenameOpen({ type: "folder", id: sec.id!, name: sec.name }); setRenameValue(sec.name); }} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Renomear seção">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={() => setDeleteFolderTarget(sec)} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-destructive" title="Excluir seção">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              {!collapsed.has(sec.id ?? "none") && (
                sec.boards.length === 0 ? (
                  <p className="px-3 py-1.5 text-[11px] text-muted-foreground">Vazia</p>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e: DragEndEvent) => {
                      if (!isAdmin || !e.over || e.active.id === e.over.id) return;
                      const ids = sec.boards.map((b: any) => b.id);
                      const from = ids.indexOf(String(e.active.id));
                      const to = ids.indexOf(String(e.over.id));
                      if (from < 0 || to < 0) return;
                      reorderBoards.mutate(arrayMove(ids, from, to));
                    }}
                  >
                    <SortableContext items={sec.boards.map((b: any) => b.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-0.5">
                        {sec.boards.map((b: any, i: number) => (
                          <BoardRow
                            key={b.id}
                            b={b}
                            active={b.id === activeBoardId}
                            canDrag={isAdmin}
                            isAdmin={isAdmin}
                            fav={favs.has(b.id)}
                            onToggleFav={() => toggleFav(b.id)}
                            onSettings={() => setSettingsTarget(b)}
                            onDuplicate={() => { setDupTarget(b); setDupName(`${b.name} (cópia)`); setDupItems(false); }}
                            onArchive={() => setArchiveTarget(b)}
                            folders={folders}
                            onMoveToFolder={(folderId) => moveBoardToFolder.mutate({ boardId: b.id, folderId })}
                            canUp={i > 0}
                            canDown={i < sec.boards.length - 1}
                            onUp={() => move(sec.boards, i, -1)}
                            onDown={() => move(sec.boards, i, 1)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )
              )}
            </div>
          );
        })}

        {king && isAdmin && (
          <button
            onClick={() => { setSectionName(""); setNewSectionOpen(true); }}
            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          >
            <FolderPlus className="h-3.5 w-3.5" />Nova seção
          </button>
        )}
      </div>

      {settingsTarget && (
        <BoardSettings board={settingsTarget as any} open={!!settingsTarget} onOpenChange={(v) => { if (!v) setSettingsTarget(null); }} />
      )}

      <Dialog open={!!renameOpen} onOpenChange={(v) => !v && setRenameOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{renameOpen?.type === "king" ? "Editar quadro rei" : "Renomear seção"}</DialogTitle></DialogHeader>
          <div>
            <Label>Nome</Label>
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitRename(); }} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(null)}>Cancelar</Button>
            <Button onClick={submitRename} disabled={!renameValue.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newSectionOpen} onOpenChange={setNewSectionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova seção</DialogTitle></DialogHeader>
          <div>
            <Label>Nome da seção</Label>
            <Input
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              placeholder="Ex: Quadros dos Funcionários, Quadros da Elo…"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && sectionName.trim() && king) createFolder.mutate({ workspaceId: king.id, name: sectionName.trim() }, { onSuccess: () => setNewSectionOpen(false) }); }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewSectionOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => king && createFolder.mutate({ workspaceId: king.id, name: sectionName.trim() }, { onSuccess: () => setNewSectionOpen(false) })}
              disabled={!sectionName.trim() || createFolder.isPending}
            >
              {createFolder.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar seção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFolderTarget} onOpenChange={(v) => !v && setDeleteFolderTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a seção "{deleteFolderTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              A seção é removida, mas os quadros dentro dela são mantidos — voltam para "Sem seção".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteFolder.mutate(deleteFolderTarget.id); setDeleteFolderTarget(null); }}>Excluir seção</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={boardOpen} onOpenChange={setBoardOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo quadro</DialogTitle></DialogHeader>
          <div>
            <Label>Nome do quadro</Label>
            <Input
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              placeholder="Ex: Demandas, Campanhas, Produção…"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && boardName.trim() && king)
                  createBoard.mutate({ workspaceId: king.id, name: boardName.trim() }, { onSuccess: () => setBoardOpen(false) });
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBoardOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => king && createBoard.mutate({ workspaceId: king.id, name: boardName.trim() }, { onSuccess: () => setBoardOpen(false) })}
              disabled={!boardName.trim() || createBoard.isPending}
            >
              {createBoard.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dupTarget} onOpenChange={(v) => !v && setDupTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Duplicar quadro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do novo quadro</Label>
              <Input value={dupName} onChange={(e) => setDupName(e.target.value)} />
            </div>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 p-2.5">
              <Checkbox checked={dupItems} onCheckedChange={(v) => setDupItems(Boolean(v))} className="mt-0.5" />
              <span className="text-xs">
                <span className="font-medium">Copiar também as demandas</span>
                <span className="mt-0.5 block text-muted-foreground">
                  Desmarcado, vem só a estrutura: grupos, colunas, status e cores.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDupTarget(null)}>Cancelar</Button>
            <Button
              disabled={!dupName.trim() || duplicateBoard.isPending}
              onClick={() =>
                duplicateBoard.mutate(
                  { boardId: dupTarget.id, name: dupName.trim(), withItems: dupItems },
                  { onSuccess: () => setDupTarget(null) },
                )
              }
            >
              {duplicateBoard.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Duplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archiveTarget} onOpenChange={(v) => !v && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar o quadro?</AlertDialogTitle>
            <AlertDialogDescription>
              "{archiveTarget?.name}" sai da lista, mas os dados continuam no banco e podem ser restaurados depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const wasActive = activeBoardId === archiveTarget.id;
                archiveBoard.mutate(archiveTarget.id, { onSuccess: () => { setArchiveTarget(null); if (wasActive) navigate({ to: "/tasks" }); } });
              }}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NavSection({ boards, collapsed, onToggleCollapse, activeBoardId, isAdmin, favs, toggleFav, folders, onSettings, onDuplicate, onArchive }: {
  id: string; name: string; boards: any[]; collapsed: boolean; onToggleCollapse: () => void; activeBoardId?: string;
  isAdmin: boolean; favs: Set<string>; toggleFav: (id: string) => void; folders: any[]; sensors: any; onDragEnd: () => void;
  onSettings: (b: any) => void; onDuplicate: (b: any) => void; onArchive: (b: any) => void; onMoveToFolder: () => void; move: () => void;
}) {
  return (
    <div>
      <button
        onClick={onToggleCollapse}
        className="flex w-full items-center gap-1 rounded px-1 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className={cn("h-3 w-3 shrink-0 transition-transform", !collapsed && "rotate-90")} />
        <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
        <span className="truncate">Favoritos</span>
        <span className="shrink-0 text-[10px] normal-case text-muted-foreground/70">{boards.length}</span>
      </button>
      {!collapsed && (
        <div className="space-y-0.5">
          {boards.map((b: any) => (
            <BoardRow
              key={b.id}
              b={b}
              active={b.id === activeBoardId}
              canDrag={false}
              isAdmin={isAdmin}
              fav={favs.has(b.id)}
              onToggleFav={() => toggleFav(b.id)}
              onSettings={() => onSettings(b)}
              onDuplicate={() => onDuplicate(b)}
              onArchive={() => onArchive(b)}
              folders={folders}
              onMoveToFolder={() => {}}
              canUp={false}
              canDown={false}
              onUp={() => {}}
              onDown={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BoardRow({ b, active, canDrag, isAdmin, fav, onToggleFav, onSettings, onDuplicate, onArchive, folders, onMoveToFolder, canUp, canDown, onUp, onDown }: {
  b: any; active: boolean; canDrag: boolean; isAdmin: boolean; fav: boolean; onToggleFav: () => void; onSettings: () => void; onDuplicate: () => void; onArchive: () => void;
  folders: any[]; onMoveToFolder: (folderId: string | null) => void;
  canUp: boolean; canDown: boolean; onUp: () => void; onDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: b.id, disabled: !canDrag });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined };
  const prefetchBoard = usePrefetchBoard();
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1 rounded-lg px-1.5 py-1.5 text-sm transition",
        isDragging ? "opacity-60 bg-accent" : active ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-accent/60",
      )}
    >
      {canDrag && (
        <button {...attributes} {...listeners} onClick={(e) => e.preventDefault()} className="hidden shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 active:cursor-grabbing sm:block" title="Arrastar">
          <GripVertical className="h-3 w-3" />
        </button>
      )}
      <Link
        to="/tasks/$boardId"
        params={{ boardId: b.id }}
        onMouseEnter={() => prefetchBoard(b.id)}
        className="flex min-w-0 flex-1 items-center gap-1.5"
        style={b.color ? { borderLeft: `2px solid ${b.color}`, paddingLeft: 6 } : undefined}
      >
        <span className="shrink-0 text-sm">{b.icon || "📋"}</span>
        <span className="truncate">{b.name}</span>
      </Link>
      <button
        onClick={onToggleFav}
        className={cn("shrink-0 p-0.5", fav ? "text-amber-400" : "text-muted-foreground opacity-0 hover:text-amber-400 group-hover:opacity-100")}
        title={fav ? "Remover dos favoritos" : "Favoritar"}
      >
        <Star className={cn("h-3 w-3", fav && "fill-current")} />
      </button>
      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100">
              <MoreVertical className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onSettings}><Shield className="mr-2 h-3.5 w-3.5" />Permissões e aparência</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><FolderInput className="mr-2 h-3.5 w-3.5" />Mover para seção</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => onMoveToFolder(null)}><LayoutGrid className="mr-2 h-3.5 w-3.5" />Sem seção</DropdownMenuItem>
                {folders.map((f: any) => (
                  <DropdownMenuItem key={f.id} onClick={() => onMoveToFolder(f.id)}><FolderOpen className="mr-2 h-3.5 w-3.5" />{f.name}</DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {(canUp || canDown) && (
              <>
                <DropdownMenuItem disabled={!canUp} onClick={onUp}><ArrowUp className="mr-2 h-3.5 w-3.5" />Mover para cima</DropdownMenuItem>
                <DropdownMenuItem disabled={!canDown} onClick={onDown}><ArrowDown className="mr-2 h-3.5 w-3.5" />Mover para baixo</DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={onDuplicate}><Copy className="mr-2 h-3.5 w-3.5" />Duplicar</DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}><Archive className="mr-2 h-3.5 w-3.5" />Arquivar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
