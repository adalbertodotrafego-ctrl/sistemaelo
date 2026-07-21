import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, EmptyState } from "@/components/ui-extras/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, LayoutGrid, MoreVertical, Star, Archive, AlertTriangle, FolderPlus, Loader2, UserCheck,
} from "lucide-react";
import { useBoardsTree, useMyItems } from "@/lib/boards/queries";
import { useArchiveBoard, useCreateBoard, useCreateWorkspace } from "@/lib/boards/admin";
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

  const [wsOpen, setWsOpen] = useState(false);
  const [wsName, setWsName] = useState("");
  const [boardOpen, setBoardOpen] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [boardWs, setBoardWs] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<any>(null);

  // A migração ainda não aplicada aparece como erro de tabela inexistente.
  const missingTables = error && /does not exist|schema cache/i.test(error.message);

  const openNewBoard = (workspaceId: string) => {
    setBoardWs(workspaceId);
    setBoardName("");
    setBoardOpen(true);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Tarefas"
        description="Quadros no estilo monday — colunas tipadas, grupos e colaboração ao vivo."
        actions={
          (tree?.length ?? 0) > 0 ? (
            <Button onClick={() => openNewBoard(tree![0].id)}>
              <Plus className="mr-2 h-4 w-4" />Novo quadro
            </Button>
          ) : undefined
        }
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

      {isLoading && <p className="text-sm text-muted-foreground">Carregando quadros…</p>}

      {error && !missingTables && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Erro ao carregar: {error.message}
        </div>
      )}

      {!isLoading && !error && (tree?.length ?? 0) === 0 && (
        <EmptyState
          icon={LayoutGrid}
          title="Nenhuma área de trabalho ainda"
          description="Crie a primeira área de trabalho para começar a organizar os quadros da equipe."
          action={
            <Button onClick={() => { setWsName(""); setWsOpen(true); }}>
              <FolderPlus className="mr-2 h-4 w-4" />Criar área de trabalho
            </Button>
          }
        />
      )}

      {(tree ?? []).map((ws) => (
        <section key={ws.id} className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 font-display text-sm font-bold text-primary">
              {ws.name[0]?.toUpperCase()}
            </span>
            <h2 className="font-display text-lg font-semibold">{ws.name}</h2>
            <Button size="sm" variant="outline" className="ml-auto h-8" onClick={() => openNewBoard(ws.id)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />Quadro
            </Button>
          </div>

          {ws.boards.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              Nenhum quadro nesta área ainda.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ws.boards.map((b: any) => (
                <div key={b.id} className="surface-card group relative p-4 transition hover:-translate-y-0.5 hover:shadow-elegant">
                  <div className="absolute right-2 top-2 flex items-center gap-0.5">
                    <button
                      onClick={() => toggleFav(b.id)}
                      className={favs.has(b.id) ? "p-1 text-amber-400" : "p-1 text-muted-foreground opacity-0 transition hover:text-amber-400 group-hover:opacity-100"}
                      title={favs.has(b.id) ? "Remover dos favoritos" : "Favoritar"}
                    >
                      <Star className={"h-3.5 w-3.5 " + (favs.has(b.id) ? "fill-current" : "")} />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setArchiveTarget(b)}>
                          <Archive className="mr-2 h-3.5 w-3.5" />Arquivar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Link to="/tasks/$boardId" params={{ boardId: b.id }} className="block">
                    <div className="flex items-center gap-2 pr-12">
                      <LayoutGrid className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate font-medium">
                        {b.kind === "private" ? "🔒 " : ""}{b.name}
                      </span>
                    </div>
                    <div className="mt-3 text-[11px] text-muted-foreground">
                      Atualizado em {new Date(b.updated_at).toLocaleDateString("pt-BR")}
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

        </TabsContent>
      </Tabs>

      {/* Nova área de trabalho */}
      <Dialog open={wsOpen} onOpenChange={setWsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova área de trabalho</DialogTitle></DialogHeader>
          <div>
            <Label>Nome</Label>
            <Input
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              placeholder="Ex: Elo Marketing"
              onKeyDown={(e) => { if (e.key === "Enter" && wsName.trim()) createWorkspace.mutate({ name: wsName.trim() }, { onSuccess: () => setWsOpen(false) }); }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWsOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createWorkspace.mutate({ name: wsName.trim() }, { onSuccess: () => setWsOpen(false) })}
              disabled={!wsName.trim() || createWorkspace.isPending}
            >
              {createWorkspace.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

/**
 * "Minhas demandas" — tudo em que você foi marcado como responsável, de
 * qualquer quadro. A demanda continua morando no quadro de origem: esta é
 * uma visão pessoal por cima, não uma cópia.
 */
function MyDemands() {
  const { user } = useCurrentUser();
  const { data: items, isLoading, error } = useMyItems(user?.id);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando suas demandas…</p>;
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Erro ao carregar: {error.message}
      </div>
    );
  }
  if (!items || items.length === 0) {
    return (
      <EmptyState
        icon={UserCheck}
        title="Nenhuma demanda para você"
        description="Quando alguém te marcar como responsável numa demanda (coluna de Pessoas), ela aparece aqui automaticamente."
      />
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
  );
}
