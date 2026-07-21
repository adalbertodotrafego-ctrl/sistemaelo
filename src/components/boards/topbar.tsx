import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Search, Wifi } from "lucide-react";
import { useRenameBoard } from "@/lib/boards/admin";
import type { Board } from "@/lib/boards/types";
import { cn } from "@/lib/utils";

export function BoardTopbar({ board, tab, onTabChange, search, onSearchChange, onNewItem, live }: {
  board: Board;
  tab: "table" | "kanban";
  onTabChange: (t: "table" | "kanban") => void;
  search: string;
  onSearchChange: (s: string) => void;
  onNewItem: () => void;
  live?: boolean;
}) {
  const renameBoard = useRenameBoard(board.id);
  const [editing, setEditing] = useState(false);

  return (
    <header className="shrink-0 border-b border-border bg-card px-4 pt-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link to="/tasks" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" />Todos os quadros
          </Link>
          {editing ? (
            <input
              autoFocus
              defaultValue={board.name}
              className="w-full max-w-lg rounded-md bg-background px-1 font-display text-xl font-semibold text-foreground outline-none ring-2 ring-primary/40"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== board.name) renameBoard.mutate({ name: v });
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditing(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="block max-w-lg cursor-text truncate rounded-md px-1 text-left font-display text-xl font-semibold text-foreground hover:bg-accent"
              title="Clique para renomear"
            >
              {board.name}
            </button>
          )}
          {board.description && <p className="mt-0.5 truncate px-1 text-sm text-muted-foreground">{board.description}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-1">
          {live !== undefined && (
            <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
              <Wifi className={cn("h-3.5 w-3.5", live ? "text-emerald-400" : "text-muted-foreground/50")} />
              {live ? "Ao vivo" : "Conectando…"}
            </span>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="w-44 pl-9 sm:w-52"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar"
            />
          </div>
          <Button onClick={onNewItem}><Plus className="mr-2 h-4 w-4" />Novo item</Button>
        </div>
      </div>

      <nav className="mt-3 flex gap-1">
        {([["table", "Tabela principal"], ["kanban", "Kanban"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onTabChange(key)}
            className={cn(
              "border-b-2 px-3 pb-2 text-sm transition-colors",
              tab === key
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
