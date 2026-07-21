// =====================================================================
// Célula do grid — display + edição inline, dirigidos pelo registry
// =====================================================================
// Todos os tipos do Dia 1 são editáveis: text, long_text, numbers, status,
// dropdown, people, date, timeline, checkbox, link.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Building2, Plus } from "lucide-react";
import { BoardAvatar } from "@/components/boards/avatar";
import type { ColumnSettings, DropdownOption, StatusLabel } from "@/lib/boards/column-types";
import { useClients, useCreateClient } from "@/lib/boards/queries";
import type { BoardColumn, Cell as CellData, Profile } from "@/lib/boards/types";
import { cn } from "@/lib/utils";

const WIDTHS: Record<string, number> = {
  text: 200, long_text: 240, numbers: 120, status: 150, dropdown: 180,
  people: 180, client: 190, date: 130, timeline: 180, checkbox: 80, link: 190,
};
export const MIN_COL_WIDTH = 80;
/** Largura efetiva: a que o usuário arrastou, ou o padrão do tipo. */
export function colWidth(type: string, width?: number | null): number {
  return width && width >= MIN_COL_WIDTH ? width : (WIDTHS[type] ?? 180);
}

// ── popover reutilizável (fecha em clique fora / Esc) ────────────────
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

function PopoverCard({ children, width = 224 }: { children: ReactNode; width?: number }) {
  return (
    <div
      className="absolute left-0 top-full z-30 mt-1 rounded-md border border-border bg-popover p-1 shadow-lg"
      style={{ width }}
    >
      {children}
    </div>
  );
}

export function Cell({ column, cell, profiles, onSave }: {
  column: BoardColumn;
  cell: CellData | undefined;
  profiles: Profile[];
  onSave: (input: unknown) => void;
}) {
  const width = colWidth(column.type, column.width);
  const settings = (column.settings ?? {}) as ColumnSettings;

  switch (column.type) {
    case "status": return <StatusCell width={width} cell={cell} settings={settings} onSave={onSave} />;
    case "dropdown": return <DropdownCell width={width} cell={cell} settings={settings} onSave={onSave} />;
    case "people": return <PeopleCell width={width} cell={cell} profiles={profiles} onSave={onSave} />;
    case "client": return <ClientCell width={width} cell={cell} onSave={onSave} />;
    case "timeline": return <TimelineCell width={width} cell={cell} onSave={onSave} />;
    case "checkbox": return <CheckboxCell width={width} cell={cell} onSave={onSave} />;
    case "date": return <DateCell width={width} cell={cell} onSave={onSave} />;
    case "link": return <LinkCell width={width} cell={cell} onSave={onSave} />;
    default: return <TextCell width={width} type={column.type} cell={cell} onSave={onSave} />;
  }
}

// ── Texto / número ───────────────────────────────────────────────────
function TextCell({ width, type, cell, onSave }: {
  width: number; type: string; cell: CellData | undefined; onSave: (input: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const display = cell?.text_cache ?? "";

  const initial = (() => {
    const v = cell?.value as Record<string, unknown> | null | undefined;
    if (type === "numbers") return v?.number != null ? String(v.number) : "";
    return (v?.text as string) ?? "";
  })();

  if (editing) {
    return (
      <input
        autoFocus
        defaultValue={initial}
        style={{ width }}
        className="h-9 shrink-0 border-0 border-l border-border/50 bg-transparent px-3 text-sm text-foreground outline-none ring-2 ring-inset ring-primary/40"
        onBlur={(e) => {
          const raw = e.target.value.trim();
          if (raw !== initial) onSave(raw === "" ? null : raw);
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
      style={{ width }}
      className={cn(
        "h-9 shrink-0 cursor-text truncate border-l border-border/50 px-3 text-sm leading-9 text-foreground hover:bg-accent/40",
        type === "numbers" ? "text-right" : "text-left",
      )}
      title={display}
    >
      {display}
    </button>
  );
}

// ── Status (célula inteira colorida, menu de labels) ─────────────────
function StatusCell({ width, cell, settings, onSave }: {
  width: number; cell: CellData | undefined; settings: ColumnSettings; onSave: (input: unknown) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const labels = (settings.labels as StatusLabel[] | undefined) ?? [];
  const index = (cell?.value as { index?: number } | null)?.index;
  const current = labels.find((l) => l.index === index);

  return (
    <div ref={ref} style={{ width }} className="relative h-9 shrink-0 border-l border-border/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-full w-full truncate px-2 text-[13px] font-medium text-white transition-[filter] hover:brightness-95"
        style={{ backgroundColor: current?.color ?? "#c4c4c4" }}
        title={current?.label ?? ""}
      >
        {current?.label ?? ""}
      </button>
      {open && (
        <PopoverCard>
          {labels.map((l) => (
            <button
              key={l.index}
              type="button"
              onClick={() => { onSave(l.index); setOpen(false); }}
              className="mb-1 block w-full truncate rounded-sm px-2 py-1.5 text-[13px] font-medium text-white transition-[filter] last:mb-0 hover:brightness-95"
              style={{ backgroundColor: l.color }}
            >
              {l.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { onSave(null); setOpen(false); }}
            className="block w-full rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
          >
            Limpar
          </button>
        </PopoverCard>
      )}
    </div>
  );
}

// ── Dropdown (múltiplas opções, chips) ───────────────────────────────
function DropdownCell({ width, cell, settings, onSave }: {
  width: number; cell: CellData | undefined; settings: ColumnSettings; onSave: (input: unknown) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const options = (settings.options as DropdownOption[] | undefined) ?? [];
  const ids = (cell?.value as { ids?: number[] } | null)?.ids ?? [];

  function toggle(id: number) {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    onSave(next.length ? next : null);
  }

  return (
    <div ref={ref} style={{ width }} className="relative h-9 shrink-0 border-l border-border/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-full w-full items-center gap-1 overflow-hidden px-2 hover:bg-accent/40"
        title={cell?.text_cache ?? ""}
      >
        {ids.length === 0 && options.length > 0 && <span className="text-muted-foreground/60">+</span>}
        {ids.map((id) => {
          const opt = options.find((o) => o.id === id);
          if (!opt) return null;
          return (
            <span key={id} className="truncate rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
              {opt.label}
            </span>
          );
        })}
        {ids.length === 0 && options.length === 0 && (
          <span className="truncate text-sm text-muted-foreground">{cell?.text_cache ?? ""}</span>
        )}
      </button>
      {open && options.length > 0 && (
        <PopoverCard>
          {options.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
              <input type="checkbox" checked={ids.includes(o.id)} onChange={() => toggle(o.id)} className="accent-primary" />
              <span className="truncate">{o.label}</span>
            </label>
          ))}
        </PopoverCard>
      )}
    </div>
  );
}

// ── People (avatares) ────────────────────────────────────────────────
function PeopleCell({ width, cell, profiles, onSave }: {
  width: number; cell: CellData | undefined; profiles: Profile[]; onSave: (input: unknown) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const [query, setQuery] = useState("");
  const persons = (cell?.value as { personsAndTeams?: { id: string; kind: string }[] } | null)?.personsAndTeams ?? [];
  const matched = persons
    .map((p) => profiles.find((pr) => pr.id === p.id))
    .filter((p): p is Profile => Boolean(p));
  const hasUnmatched = persons.length > 0 && matched.length === 0;

  function toggle(profile: Profile) {
    const exists = persons.some((p) => p.id === profile.id);
    const next = exists
      ? persons.filter((p) => p.id !== profile.id)
      : [...persons.filter((p) => profiles.some((pr) => pr.id === p.id)), { id: profile.id, kind: "person" }];
    onSave(next.length ? next : null);
  }

  const filtered = profiles.filter((p) =>
    (p.full_name ?? p.email ?? "").toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div ref={ref} style={{ width }} className="relative h-9 shrink-0 border-l border-border/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-full w-full items-center gap-1 overflow-hidden px-2 hover:bg-accent/40"
        title={cell?.text_cache ?? ""}
      >
        {matched.map((p) => (
          <span key={p.id} className="flex min-w-0 items-center gap-1">
            <BoardAvatar name={p.full_name ?? p.email ?? "?"} id={p.id} size={22} />
            {matched.length === 1 && (
              <span className="truncate text-sm text-foreground">
                {(p.full_name ?? p.email ?? "").split(" ")[0]}
              </span>
            )}
          </span>
        ))}
        {hasUnmatched && (
          <span className="truncate text-sm text-muted-foreground/70" title="Pessoa ainda não cadastrada no sistema">
            {cell?.text_cache}
          </span>
        )}
        {persons.length === 0 && <span className="text-muted-foreground/60">+</span>}
      </button>
      {open && (
        <PopoverCard width={240}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pessoa…"
            className="mb-1 w-full rounded-sm border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
          />
          <div className="max-h-56 overflow-y-auto">
            {filtered.map((p) => {
              const selected = persons.some((x) => x.id === p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                    selected && "bg-primary/10",
                  )}
                >
                  <BoardAvatar name={p.full_name ?? p.email ?? "?"} id={p.id} size={22} />
                  <span className="truncate">{p.full_name ?? p.email}</span>
                  {selected && <span className="ml-auto text-primary">✓</span>}
                </button>
              );
            })}
            {filtered.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">Ninguém encontrado</p>}
          </div>
        </PopoverCard>
      )}
    </div>
  );
}

// ── Cliente (escolhe do cadastro do Sistema Elo, ou cria na hora) ────
function ClientCell({ width, cell, onSave }: {
  width: number; cell: CellData | undefined; onSave: (input: unknown) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const [query, setQuery] = useState("");
  const { data: clients } = useClients();
  const createClient = useCreateClient();
  const current = cell?.value as { id?: string; name?: string } | null;

  const filtered = (clients ?? []).filter((c) =>
    `${c.name} ${c.company ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  const exactExists = (clients ?? []).some((c) => c.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div ref={ref} style={{ width }} className="relative h-9 shrink-0 border-l border-border/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-full w-full items-center gap-1.5 overflow-hidden px-2 hover:bg-accent/40"
        title={current?.name ?? ""}
      >
        {current?.name ? (
          <>
            <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate text-sm text-foreground">{current.name}</span>
          </>
        ) : (
          <span className="text-muted-foreground/60">+</span>
        )}
      </button>
      {open && (
        <PopoverCard width={260}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ou criar cliente…"
            className="mb-1 w-full rounded-sm border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
          />
          <div className="max-h-56 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onSave({ id: c.id, name: c.name }); setOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                  current?.id === c.id && "bg-primary/10",
                )}
              >
                <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{c.company || c.name}</span>
                {current?.id === c.id && <span className="ml-auto text-primary">✓</span>}
              </button>
            ))}
            {query.trim() && !exactExists && (
              <button
                type="button"
                onClick={() =>
                  createClient.mutate(query.trim(), {
                    onSuccess: (novo) => { onSave({ id: novo.id, name: novo.name }); setOpen(false); setQuery(""); },
                  })
                }
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-primary hover:bg-accent"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                Cadastrar "{query.trim()}"
              </button>
            )}
            {filtered.length === 0 && !query.trim() && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum cliente cadastrado</p>
            )}
          </div>
          {current?.id && (
            <button
              type="button"
              onClick={() => { onSave(null); setOpen(false); }}
              className="mt-1 block w-full rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
            >
              Limpar
            </button>
          )}
        </PopoverCard>
      )}
    </div>
  );
}

// ── Timeline (intervalo de datas) ────────────────────────────────────
function fmtShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function TimelineCell({ width, cell, onSave }: {
  width: number; cell: CellData | undefined; onSave: (input: unknown) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const v = cell?.value as { from?: string; to?: string } | null;
  const [from, setFrom] = useState(v?.from ?? "");
  const [to, setTo] = useState(v?.to ?? "");

  useEffect(() => {
    setFrom(v?.from ?? "");
    setTo(v?.to ?? "");
  }, [v?.from, v?.to]);

  function commit(f: string, t: string) {
    if (f && t) onSave({ from: f, to: t });
    if (!f && !t) onSave(null);
  }

  return (
    <div ref={ref} style={{ width }} className="relative h-9 shrink-0 border-l border-border/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-full w-full truncate px-2 text-center text-sm leading-9 text-foreground hover:bg-accent/40"
      >
        {v?.from && v?.to ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{fmtShort(v.from)} – {fmtShort(v.to)}</span>
        ) : (
          <span className="text-muted-foreground/60">+</span>
        )}
      </button>
      {open && (
        <PopoverCard width={240}>
          <div className="space-y-1 p-1">
            <label className="block text-xs text-muted-foreground">
              Início
              <input
                type="date" value={from}
                onChange={(e) => { setFrom(e.target.value); commit(e.target.value, to); }}
                className="mt-0.5 w-full rounded-sm border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Fim
              <input
                type="date" value={to}
                onChange={(e) => { setTo(e.target.value); commit(from, e.target.value); }}
                className="mt-0.5 w-full rounded-sm border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
            <button
              type="button"
              onClick={() => { setFrom(""); setTo(""); onSave(null); setOpen(false); }}
              className="w-full rounded-sm px-2 py-1 text-left text-sm text-muted-foreground hover:bg-accent"
            >
              Limpar
            </button>
          </div>
        </PopoverCard>
      )}
    </div>
  );
}

// ── Checkbox ─────────────────────────────────────────────────────────
function CheckboxCell({ width, cell, onSave }: {
  width: number; cell: CellData | undefined; onSave: (input: unknown) => void;
}) {
  const checked = Boolean((cell?.value as { checked?: boolean } | null)?.checked);
  return (
    <div style={{ width }} className="flex h-9 shrink-0 items-center justify-center border-l border-border/50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onSave({ checked: e.target.checked })}
        className="h-4 w-4 accent-primary"
      />
    </div>
  );
}

// ── Data ─────────────────────────────────────────────────────────────
function DateCell({ width, cell, onSave }: {
  width: number; cell: CellData | undefined; onSave: (input: unknown) => void;
}) {
  const date = (cell?.value as { date?: string } | null)?.date ?? "";
  return (
    <div style={{ width }} className="flex h-9 shrink-0 items-center border-l border-border/50 px-2">
      <input
        type="date"
        value={date}
        onChange={(e) => onSave(e.target.value || null)}
        className="w-full rounded-sm bg-transparent px-1 py-0.5 text-sm text-foreground hover:bg-accent/40"
      />
    </div>
  );
}

// ── Link ─────────────────────────────────────────────────────────────
function LinkCell({ width, cell, onSave }: {
  width: number; cell: CellData | undefined; onSave: (input: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const v = cell?.value as { url?: string; text?: string } | null;

  // Defesa em profundidade: só http(s) vira <a>.
  const safeHref = (() => {
    try {
      const u = new URL(v?.url ?? "");
      return u.protocol === "http:" || u.protocol === "https:" ? v?.url : undefined;
    } catch {
      return undefined;
    }
  })();

  if (editing) {
    return (
      <input
        autoFocus
        defaultValue={v?.url ?? ""}
        placeholder="https://…"
        style={{ width }}
        className="h-9 shrink-0 border-0 border-l border-border/50 bg-transparent px-3 text-sm text-foreground outline-none ring-2 ring-inset ring-primary/40"
        onBlur={(e) => {
          const raw = e.target.value.trim();
          if (raw !== (v?.url ?? "")) onSave(raw === "" ? null : raw);
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
    <div
      style={{ width }}
      className="group/link flex h-9 shrink-0 items-center gap-1 truncate border-l border-border/50 px-3 text-sm"
    >
      {safeHref ? (
        <a href={safeHref} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline" title={safeHref}>
          {v?.text || safeHref}
        </a>
      ) : v?.url ? (
        <span className="truncate text-muted-foreground" title={v.url}>{v.text || v.url}</span>
      ) : null}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="ml-auto shrink-0 text-xs text-muted-foreground/60 opacity-0 hover:text-foreground group-hover/link:opacity-100"
        title="Editar link"
      >
        ✎
      </button>
    </div>
  );
}
