// =====================================================================
// Configurações do quadro — aparência (emoji + cor) e responsáveis
// =====================================================================
// Responsáveis definem QUEM ENXERGA o quadro. Por regra do banco, só o
// admin do sistema pode alterar essa lista (RLS em board_members); para os
// demais a seção aparece somente para leitura.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Lock, Users } from "lucide-react";
import { ColorSwatches } from "@/components/boards/color-swatches";
import { BOARD_EMOJIS, GROUP_COLORS } from "@/components/boards/colors";
import { BoardAvatar } from "@/components/boards/avatar";
import { useBoardMembers, useToggleBoardMember, useUpdateBoard } from "@/lib/boards/admin";
import { useProfiles } from "@/lib/boards/queries";
import type { Board } from "@/lib/boards/types";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

export function BoardSettings({ board, open, onOpenChange }: {
  board: Board; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const { isAdmin } = usePermissions();
  const updateBoard = useUpdateBoard(board.id);
  const { data: members } = useBoardMembers(board.id);
  const toggleMember = useToggleBoardMember(board.id);
  const { data: profiles } = useProfiles();
  const [search, setSearch] = useState("");

  const memberSet = new Set(members ?? []);
  const filtered = (profiles ?? []).filter((p) =>
    (p.full_name ?? p.email ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader><DialogTitle>Configurações do quadro</DialogTitle></DialogHeader>

        <div className="space-y-5">
          {/* Aparência */}
          <div>
            <Label>Ícone</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {BOARD_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => updateBoard.mutate({ icon: e })}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md border text-lg transition",
                    board.icon === e ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
                  )}
                >
                  {e}
                </button>
              ))}
              {board.icon && (
                <Button variant="ghost" size="sm" className="h-9" onClick={() => updateBoard.mutate({ icon: null })}>
                  Remover
                </Button>
              )}
            </div>
          </div>

          <div>
            <Label>Cor de destaque</Label>
            <div className="mt-1.5">
              <ColorSwatches
                colors={GROUP_COLORS}
                value={board.color}
                onPick={(color) => updateBoard.mutate({ color })}
              />
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Input
              defaultValue={board.description ?? ""}
              placeholder="Para que serve este quadro…"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (board.description ?? "")) updateBoard.mutate({ description: v || null });
              }}
            />
          </div>

          {/* Responsáveis = quem enxerga */}
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <Label className="mb-0">Responsáveis</Label>
              {!isAdmin && <Lock className="h-3 w-3 text-muted-foreground" />}
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              {isAdmin
                ? "Quem estiver marcado aqui enxerga este quadro. Quem não estiver, não vê. Administradores enxergam tudo."
                : "Somente administradores podem alterar quem enxerga o quadro."}
            </p>

            {isAdmin && (
              <Input
                className="mb-2"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar pessoa…"
              />
            )}

            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-1.5">
              {filtered.map((p) => {
                const on = memberSet.has(p.id);
                if (!isAdmin && !on) return null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => toggleMember.mutate({ userId: p.id, add: !on })}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                      isAdmin && "hover:bg-accent",
                      on && "bg-primary/10",
                      !isAdmin && "cursor-default",
                    )}
                  >
                    <BoardAvatar name={p.full_name ?? p.email ?? "?"} id={p.id} size={22} />
                    <span className="min-w-0 flex-1 truncate">{p.full_name ?? p.email}</span>
                    {on && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                );
              })}
              {memberSet.size === 0 && !isAdmin && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum responsável definido.</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
