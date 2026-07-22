// =====================================================================
// Nova demanda — nome, tipo(s) coloridos e recorrência num passo só
// =====================================================================
// Os "tipos de demanda" são as colunas do tipo status do próprio quadro
// (Status, Tipo de demanda, Prioridade…). Assim, criar tipos novos ou
// trocar cores é feito num lugar só: o editor de status da coluna.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Palette, Repeat } from "lucide-react";
import type { StatusLabel } from "@/lib/boards/column-types";
import { useAddItem } from "@/lib/boards/queries";
import { RECURRENCE_LABELS, type BoardColumn, type Recurrence } from "@/lib/boards/types";
import { cn } from "@/lib/utils";

export function NewDemandDialog({
  boardId, groupId, groupTitle, nextPosition, columns, open, onOpenChange, onEditTypes,
}: {
  boardId: string;
  groupId: string;
  groupTitle: string;
  nextPosition: number;
  columns: BoardColumn[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEditTypes: (column: BoardColumn) => void;
}) {
  const addItem = useAddItem(boardId);
  const [name, setName] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence | "">("");
  const [picked, setPicked] = useState<Record<string, number>>({});

  const statusCols = columns.filter((c) => c.type === "status");

  const reset = () => { setName(""); setRecurrence(""); setPicked({}); };

  const submit = () => {
    const clean = name.trim();
    if (!clean) return;
    const cells = Object.entries(picked).map(([columnId, index]) => ({
      column: statusCols.find((c) => c.id === columnId)!,
      input: { index },
    }));
    addItem.mutate(
      { groupId, name: clean, position: nextPosition, recurrence: recurrence || null, cells },
      { onSuccess: () => { reset(); onOpenChange(false); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova demanda em "{groupTitle}"</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>O que precisa ser feito? *</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="Ex: Gravar reel do cliente X"
            />
          </div>

          {statusCols.map((col) => {
            const labels = ((col.settings as { labels?: StatusLabel[] } | null)?.labels ?? []);
            return (
              <div key={col.id}>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="mb-0">{col.title}</Label>
                  <button
                    type="button"
                    onClick={() => onEditTypes(col)}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <Palette className="h-3 w-3" />Tipos e cores
                  </button>
                </div>
                {labels.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Nenhum tipo cadastrado — clique em "Tipos e cores" para criar.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {labels.map((l) => {
                      const on = picked[col.id] === l.index;
                      return (
                        <button
                          key={l.index}
                          type="button"
                          onClick={() =>
                            setPicked((prev) => {
                              const next = { ...prev };
                              if (on) delete next[col.id];
                              else next[col.id] = l.index;
                              return next;
                            })
                          }
                          style={on ? { backgroundColor: l.color, borderColor: l.color, color: "#fff" } : { borderColor: l.color, color: l.color }}
                          className={cn("rounded-full border px-2.5 py-1 text-xs transition", !on && "hover:bg-accent")}
                        >
                          {l.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div>
            <Label className="flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5" />Recorrência</Label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence | "")}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="">Não se repete</option>
              {(Object.keys(RECURRENCE_LABELS) as Recurrence[]).map((r) => (
                <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>
              ))}
            </select>
            {recurrence && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Ao ser concluída, volta a ficar pendente sozinha no próximo período.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!name.trim() || addItem.isPending}>Criar demanda</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
