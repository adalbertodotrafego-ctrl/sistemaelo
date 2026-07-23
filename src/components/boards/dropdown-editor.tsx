// =====================================================================
// Editor das opções de uma coluna de múltipla escolha (ex.: Tipo de demanda)
// =====================================================================
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import type { DropdownOption } from "@/lib/boards/column-types";
import type { BoardColumn } from "@/lib/boards/types";

export function DropdownOptionsEditor({ column, open, onOpenChange, onSave }: {
  column: BoardColumn | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (columnId: string, settings: Record<string, unknown>) => void;
}) {
  const settings = (column?.settings ?? {}) as Record<string, unknown>;
  const initial = (settings.options as DropdownOption[] | undefined) ?? [];
  const [options, setOptions] = useState<DropdownOption[]>(initial);
  const [dirtyFor, setDirtyFor] = useState<string | null>(null);

  // Recarrega ao abrir noutra coluna, sem useEffect.
  if (open && column && dirtyFor !== column.id) {
    setDirtyFor(column.id);
    setOptions(initial);
  }

  const update = (id: number, label: string) => setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, label } : o)));
  const remove = (id: number) => setOptions((prev) => prev.filter((o) => o.id !== id));
  const add = () => {
    const nextId = options.length ? Math.max(...options.map((o) => o.id)) + 1 : 0;
    setOptions((prev) => [...prev, { id: nextId, label: "Novo tipo" }]);
  };

  const save = () => {
    if (!column) return;
    const { options: _drop, ...rest } = settings;
    onSave(column.id, { ...rest, options: options.filter((o) => o.label.trim()) });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader><DialogTitle>Opções de "{column?.title}"</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {options.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma opção ainda — adicione abaixo.</p>}
          {options.map((o) => (
            <div key={o.id} className="flex items-center gap-2">
              <Input value={o.label} onChange={(e) => update(o.id, e.target.value)} className="h-8 flex-1" placeholder="Nome da opção" />
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(o.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Adicionar opção
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Remover uma opção não apaga as células que já a usavam — elas apenas deixam de mostrá-la.
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
