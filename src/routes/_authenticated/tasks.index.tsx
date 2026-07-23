import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, LayoutGrid, MoreVertical, Star, Archive, AlertTriangle, Loader2, UserCheck, Copy, Crown, Shield,
  FolderPlus, FolderOpen, FolderInput, Pencil, Trash2, ArrowUp, ArrowDown,
} from "lucide-react";
import { BoardSettings } from "@/components/boards/board-settings";
import { useBoardsTree, useMyItems } from "@/lib/boards/queries";
import {
  useArchiveBoard, useCreateBoard, useCreateWorkspace, useDuplicateBoard,
  useRenameWorkspace, useCreateFolder, useRenameFolder, useDeleteFolder,
  useMoveBoardToFolder, useReorderBoard,
} from "@/lib/boards/admin";
import { useFavorites } from "@/lib/boards/workspace-state";
import { useCurrentUser } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/tasks/")({
  head: () => ({ meta: [{ title: "Tarefas — Elo Marketing OS" }] }),
  component: BoardsHome,
});

function BoardsHome() {
  const { data: tree, isLoading, error } = useBoardsTree();
  const [favs, toggleFav] = useFavorites();
  const createWorkspace = useCreateWorkspace();
  const createBoard = useCreateBoard();
  const archiveBoard = useArchiveBoard();
  const renameWorkspace = useRenameWorkspace();
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const moveBoardToFolder = useMoveBoardToFolder();
  const reorderBoard = useReorderBoard();

  const [boardOpen, setBoardOpen] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [boardWs, setBoardWs] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<any>(null);
  const [settingsTarget, setSettingsTarget] = useState<any>(null);
  const duplicateBoard = useDuplicateBoard();
  const [dupTarget, setDupTarget] = useState<any>(null);
  const [dupName, setDupName] = useState("");
  const [dupItems, setDupItems] = useState(false);
  // Seções e edição do quadro rei
  const [renameOpen, setRenameOpen] = useState<null | { type: "king" | "folder"; id: string; name: string }>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<any>(null);

  // A migração ainda não aplicada aparece como erro de tabela inexistente.
  const missingTables = error && /does not exist|schema cache/i.test(error.message);

  // Modelo "quadro rei": há UMA área de trabalho (o Elo Marketing OS), que todo
  // mundo vê; os quadros dentro dela é que são liberados por responsável. Se não
  // existir nenhuma ainda, cria automaticamente — sem pedir pro usuário.
  const king = tree?.[0] ?? null;
  useEffect(() => {
    if (!isLoading && !error && (tree?.length ?? 0) === 0 && !createWorkspace.isPending) {
      createWorkspace.mutate({ name: "Elo Marketing OS" });
    }
  }, [isLoading, error, tree, createWorkspace]);

  const openNewBoard = () => {
    if (!king) return;
    setBoardWs(king.id);
    setBoardName("");
    setBoardOpen(true);
  };

  const allBoards = king?.boards ?? [];
  const folders = king?.folders ?? [];
  const byPosition = (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0);
  const boardsInFolder = (folderId: string | null) =>
    allBoards.filter((b: any) => (b.folder_id ?? null) === folderId).sort(byPosition);

  // Cada "seção" na tela: primeiro os quadros sem seção, depois as pastas.
  const sections: { id: string | null; name: string; boards: any[] }[] = [
    { id: null, name: "Sem seção", boards: boardsInFolder(null) },
    ...folders.map((f: any) => ({ id: f.id, name: f.name, boards: boardsInFolder(f.id) })),
  ];

  const submitRename = () => {
    if (!renameOpen || !renameValue.trim()) return;
    if (renameOpen.type === "king") renameWorkspace.mutate({ workspaceId: renameOpen.id, name: renameValue.trim() });
    else renameFolder.mutate({ folderId: renameOpen.id, name: renameValue.trim() });
    setRenameOpen(null);
  };
  const move = (list: any[], index: number, dir: -1 | 1) => {
    const other = index + dir;
    if (other < 0 || other >= list.length) return;
    reorderBoard.mutate({
      a: { id: list[index].id, position: list[index].position ?? 0 },
      b: { id: list[other].id, position: list[other].position ?? 0 },
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Tarefas"
        description="Quadros no estilo monday — colunas tipadas, grupos e colaboração ao vivo."
        actions={king ? (
          <Button onClick={openNewBoard}><Plus className="mr-2 h-4 w-4" />Novo quadro</Button>
        ) : undefined}
      />

      {missingTables && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            As tabelas de Tarefas ainda não foram criadas no banco. Aplique a migração
            <strong> 20260721120000_boards_core.sql</strong> no Supabase para começar a usar os quadros.
          </div>
        </div>
      )}

      <Tabs defaultValue="boards">
        <TabsList className="mb-5">
          <TabsTrigger value="boards">Quadros</TabsTrigger>
          <TabsTrigger value="mine">
            <UserCheck className="mr-1.5 h-3.5 w-3.5" />Minhas demandas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-0"><MyDemands /></TabsContent>
        <TabsContent value="boards" className="mt-0">

      {(isLoading || (!error && (tree?.length ?? 0) === 0)) && (
        <p className="text-sm text-muted-foreground">Carregando quadros…</p>
      )}

      {error && !missingTables && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Erro ao carregar: {error.message}
        </div>
      )}

      {king && (
        <section>
          {/* Cabeçalho do quadro rei */}
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Crown className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-semibold">{king.name}</span>
                <button
                  onClick={() => { setRenameOpen({ type: "king", id: king.id, name: king.name }); setRenameValue(king.name); }}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Editar nome do quadro rei"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="text-xs text-muted-foreground">
                {allBoards.length} quadro(s) · cada um visível só para seus responsáveis
              </div>
            </div>
            <Button size="sm" variant="outline" className="h-9" onClick={() => { setSectionName(""); setNewSectionOpen(true); }}>
              <FolderPlus className="mr-1.5 h-3.5 w-3.5" />Nova seção
            </Button>
          </div>

          {allBoards.length === 0 ? (
            <EmptyState
              icon={LayoutGrid}
              title="Nenhum quadro ainda"
              description="Crie o primeiro quadro. Depois use o botão de Permissões para definir quem enxerga cada quadro, e organize em seções."
              action={<Button onClick={openNewBoard}><Plus className="mr-2 h-4 w-4" />Criar quadro</Button>}
            />
          ) : (
            <div className="space-y-6">
              {sections.map((sec) => {
                if (sec.id === null && sec.boards.length === 0) return null; // não mostra "Sem seção" vazia
                return (
                  <div key={sec.id ?? "none"}>
                    <div className="mb-2 flex items-center gap-2">
                      {sec.id ? <FolderOpen className="h-4 w-4 text-muted-foreground" /> : <LayoutGrid className="h-4 w-4 text-muted-foreground" />}
                      <h3 className="font-display text-sm font-semibold">{sec.name}</h3>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{sec.boards.length}</span>
                      {sec.id && (
                        <div className="ml-1 flex items-center gap-0.5">
                          <button onClick={() => { setRenameOpen({ type: "folder", id: sec.id!, name: sec.name }); setRenameValue(sec.name); }} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Renomear seção">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={() => setDeleteFolderTarget(sec)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive" title="Excluir seção">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    {sec.boards.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border/50 p-4 text-center text-xs text-muted-foreground">
                        Seção vazia — mova quadros para cá pelo menu de cada quadro.
                      </p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {sec.boards.map((b: any, i: number) => (
                          <BoardCard
                            key={b.id}
                            b={b}
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

        </TabsContent>
      </Tabs>

      {settingsTarget && (
        <BoardSettings
          board={settingsTarget as any}
          open={!!settingsTarget}
          onOpenChange={(v) => { if (!v) setSettingsTarget(null); }}
        />
      )}

      {/* Renomear (quadro rei ou seção) */}
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

      {/* Nova seção */}
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

      {/* Novo quadro */}
      <Dialog open={boardOpen} onOpenChange={setBoardOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo quadro</DialogTitle></DialogHeader>
          <div>
            <Label>Nome do quadro</Label>
            <Input
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              placeholder="Ex: Demandas, Campanhas, Produção…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && boardName.trim() && boardWs)
                  createBoard.mutate({ workspaceId: boardWs, name: boardName.trim() }, { onSuccess: () => setBoardOpen(false) });
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBoardOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => boardWs && createBoard.mutate({ workspaceId: boardWs, name: boardName.trim() }, { onSuccess: () => setBoardOpen(false) })}
              disabled={!boardName.trim() || createBoard.isPending}
            >
              {createBoard.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicar quadro */}
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
                  Desmarcado, vem só a estrutura: grupos, colunas, status e cores — o quadro nasce vazio,
                  pronto para usar como modelo.
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
              onClick={() => archiveBoard.mutate(archiveTarget.id, { onSuccess: () => setArchiveTarget(null) })}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BoardCard({ b, fav, onToggleFav, onSettings, onDuplicate, onArchive, folders, onMoveToFolder, canUp, canDown, onUp, onDown }: {
  b: any; fav: boolean; onToggleFav: () => void; onSettings: () => void; onDuplicate: () => void; onArchive: () => void;
  folders: any[]; onMoveToFolder: (folderId: string | null) => void;
  canUp: boolean; canDown: boolean; onUp: () => void; onDown: () => void;
}) {
  const accent = b.color || "hsl(var(--primary))";
  return (
    <div className="surface-card group relative overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-elegant" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="absolute right-2 top-2 flex items-center gap-0.5">
        <button
          onClick={onToggleFav}
          className={fav ? "p-1 text-amber-400" : "p-1 text-muted-foreground opacity-0 transition hover:text-amber-400 group-hover:opacity-100"}
          title={fav ? "Remover dos favoritos" : "Favoritar"}
        >
          <Star className={"h-3.5 w-3.5 " + (fav ? "fill-current" : "")} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100">
              <MoreVertical className="h-3.5 w-3.5" />
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
            <DropdownMenuItem disabled={!canUp} onClick={onUp}><ArrowUp className="mr-2 h-3.5 w-3.5" />Mover para cima</DropdownMenuItem>
            <DropdownMenuItem disabled={!canDown} onClick={onDown}><ArrowDown className="mr-2 h-3.5 w-3.5" />Mover para baixo</DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}><Copy className="mr-2 h-3.5 w-3.5" />Duplicar</DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}><Archive className="mr-2 h-3.5 w-3.5" />Arquivar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Link to="/tasks/$boardId" params={{ boardId: b.id }} className="block">
        <div className="flex items-center gap-2 pr-12">
          <span className="text-lg">{b.icon || "📋"}</span>
          <span className="truncate font-medium">{b.name}</span>
        </div>
        {b.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{b.description}</p>}
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Shield className="h-3 w-3" />
          Restrito aos responsáveis
          <span className="ml-auto">{new Date(b.updated_at).toLocaleDateString("pt-BR")}</span>
        </div>
      </Link>
    </div>
  );
}

/**
 * "Minhas demandas" — tudo em que você foi marcado como responsável, de
 * qualquer quadro. A demanda continua morando no quadro de origem: esta é
 * uma visão pessoal por cima, não uma cópia.
 */
function MyDemands() {
  const { user } = useCurrentUser();
  const { data: all, isLoading, error } = useMyItems(user?.id);
  const [scope, setScope] = useState<"today" | "all">("today");

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
