import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, LayoutGrid, MoreVertical, Star, Archive, AlertTriangle, Loader2, UserCheck, Copy, Crown, Shield,
} from "lucide-react";
import { BoardSettings } from "@/components/boards/board-settings";
import { useBoardsTree, useMyItems } from "@/lib/boards/queries";
import { useArchiveBoard, useCreateBoard, useCreateWorkspace, useDuplicateBoard } from "@/lib/boards/admin";
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

  const [boardOpen, setBoardOpen] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [boardWs, setBoardWs] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<any>(null);
  const [settingsTarget, setSettingsTarget] = useState<any>(null);
  const duplicateBoard = useDuplicateBoard();
  const [dupTarget, setDupTarget] = useState<any>(null);
  const [dupName, setDupName] = useState("");
  const [dupItems, setDupItems] = useState(false);

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

  // Quadros ordenados: favoritos primeiro, depois por atualização recente.
  const boards = [...(king?.boards ?? [])].sort((a: any, b: any) => {
    const fa = favs.has(a.id) ? 0 : 1;
    const fb = favs.has(b.id) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

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
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Crown className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg font-semibold">{king.name}</div>
              <div className="text-xs text-muted-foreground">
                {boards.length} quadro(s) · cada um visível só para seus responsáveis
              </div>
            </div>
            <Button size="sm" variant="outline" className="h-9" onClick={openNewBoard}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />Quadro
            </Button>
          </div>

          {boards.length === 0 ? (
            <EmptyState
              icon={LayoutGrid}
              title="Nenhum quadro ainda"
              description="Crie o primeiro quadro. Depois use o botão de Permissões para definir quem enxerga cada quadro."
              action={<Button onClick={openNewBoard}><Plus className="mr-2 h-4 w-4" />Criar quadro</Button>}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {boards.map((b: any) => {
                const accent = b.color || "hsl(var(--primary))";
                return (
                  <div
                    key={b.id}
                    className="surface-card group relative overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-elegant"
                    style={{ borderTop: `3px solid ${accent}` }}
                  >
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
                          <DropdownMenuItem onClick={() => setSettingsTarget(b)}>
                            <Shield className="mr-2 h-3.5 w-3.5" />Permissões e aparência
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setDupTarget(b); setDupName(`${b.name} (cópia)`); setDupItems(false); }}>
                            <Copy className="mr-2 h-3.5 w-3.5" />Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setArchiveTarget(b)}>
                            <Archive className="mr-2 h-3.5 w-3.5" />Arquivar
                          </DropdownMenuItem>
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
