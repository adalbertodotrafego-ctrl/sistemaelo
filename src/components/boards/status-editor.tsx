// =====================================================================
// Editor de labels de Status — serve para qualquer coluna do tipo status
// (Status, Tipo de demanda, Prioridade…): criar, renomear, colorir, remover.
// =====================================================================
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { ColorSwatches } from "@/components/boards/color-swatches";
import { GROUP_COLORS } from "@/components/boards/colors";
import type { StatusLabel } from "@/lib/boards/column-types";
import type { BoardColumn } from "@/lib/boards/types";

export function StatusLabelsEditor({ column, open, onOpenChange, onSave }: {
  column: BoardColumn | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (columnId: string, labels: StatusLabel[], rest: Record<string, unknown>) => void;
}) {
  const settings = (column?.settings ?? {}) as Record<string, unknown>;
  const initial = (settings.labels as StatusLabel[] | undefined) ?? [];
  const [labels, setLabels] = useState<StatusLabel[]>(initial);
  const [dirtyFor, setDirtyFor] = useState<string | null>(null);

  // Recarrega quando abre em outra coluna (sem useEffect: compara a origem).
  if (open && column && dirtyFor !== column.id) {
    setDirtyFor(column.id);
    setLabels(initial);
  }

  const update = (index: number, patch: Partial<StatusLabel>) =>
    setLabels((prev) => prev.map((l) => (l.index === index ? { ...l, ...patch } : l)));

  const add = () => {
    const nextIndex = labels.length ? Math.max(...labels.map((l) => l.index)) + 1 : 0;
    const color = GROUP_COLORS[labels.length % GROUP_COLORS.length];
    setLabels((prev) => [...prev, { index: nextIndex, label: "Novo status", color }]);
  };

  const remove = (index: number) => setLabels((prev) => prev.filter((l) => l.index !== index));

  const save = () => {
    if (!column) return;
    const { labels: _drop, ...rest } = settings;
    onSave(column.id, labels.filter((l) => l.label.trim()), rest);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Status da coluna "{column?.title}"</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {labels.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum status ainda — adicione o primeiro abaixo.</p>
          )}
          {labels.map((l) => (
            <div key={l.index} className="rounded-lg border border-border/60 p-2.5">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 shrink-0 rounded" style={{ backgroundColor: l.color }} />
                <Input
                  value={l.label}
                  onChange={(e) => update(l.index, { label: e.target.value })}
                  className="h-8 flex-1"
                  placeholder="Nome do status"
                />
                <Button
                  type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(l.index)}
                  title="Remover status"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="mt-2 pl-7">
                <ColorSwatches colors={GROUP_COLORS} value={l.color} size={18} onPick={(color) => update(l.index, { color })} />
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Adicionar status
          </Button>

          <p className="text-[11px] text-muted-foreground">
            Remover um status não apaga as células que já usavam ele — elas apenas ficam sem rótulo até
            você escolher outro.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Botão + estado para abrir o editor a partir do cabeçalho da coluna. */
export function useStatusEditor() {
  const [column, setColumn] = useState<BoardColumn | null>(null);
  const [open, setOpen] = useState(false);
  const openFor = (c: BoardColumn) => { setColumn(c); setOpen(true); };
  return { column, open, setOpen, openFor };
}

export { type StatusLabel };
