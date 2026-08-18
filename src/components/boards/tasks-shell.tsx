import type { ReactNode } from "react";
import { BoardNav } from "@/components/boards/board-nav";

export function TasksShell({ activeBoardId, children }: { activeBoardId?: string; children: ReactNode }) {
  return (
    <div className="flex h-[calc(100vh-7rem)] min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <BoardNav activeBoardId={activeBoardId} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
