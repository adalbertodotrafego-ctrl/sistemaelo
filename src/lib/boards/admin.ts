// =====================================================================
// CRUD administrativo — workspaces, boards, grupos e colunas
// =====================================================================
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sb } from "./client";
import { getColumnType } from "./columns";
import type { StatusLabel } from "./column-types";

// Paleta de cores de grupo.
const GROUP_COLORS = ["#579bfc", "#00c875", "#fdab3d", "#e2445c", "#a25ddc", "#037f4c", "#66ccff", "#bb3354"];

function alertError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  toast.error(`Não foi possível salvar: ${msg}`);
}

// Posição crescente no tempo → novos elementos vão pro fim.
const nextPosition = () => Date.now() / 1000;

/** Cria a área de trabalho. O trigger no banco já inscreve o dono como 'owner'. */
export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { name: string }) => {
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user?.id) throw new Error("Sessão expirada — entre novamente.");
      // Sem .select(): o RETURNING é avaliado pela policy de SELECT, que exige
      // membership — e o membership só é criado pelo trigger AFTER INSERT. Pedir
      // a linha de volta aqui pode falhar mesmo com o INSERT tendo dado certo.
      const { error } = await sb.from("workspaces")
        .insert({ name: args.name, owner_id: auth.user.id });
      if (error) throw new Error(error.message);
    },
    onError: alertError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["boards-tree"] }),
  });
}

export function useCreateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { workspaceId: string; name: string }) => {
      const { data: auth } = await sb.auth.getUser();
      const { error } = await sb.from("boards").insert({
        workspace_id: args.workspaceId,
        name: args.name,
        kind: "public",
        owner_id: auth.user?.id ?? null,
        position: nextPosition(),
      });
      if (error) throw new Error(error.message);
    },
    onError: alertError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["boards-tree"] }),
  });
}

/**
 * Duplica um quadro. Por padrão copia só a ESTRUTURA (grupos + colunas, com
 * as configurações de status/cores) — as demandas ficam para trás, que é o
 * caso de uso comum: usar um quadro pronto como modelo. Com `withItems`, os
 * itens e os valores das células vêm junto.
 */
export function useDuplicateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { boardId: string; name: string; withItems: boolean }) => {
      const { data: auth } = await sb.auth.getUser();
      const [orig, groups, columns] = await Promise.all([
        sb.from("boards").select("*").eq("id", args.boardId).single(),
        sb.from("groups").select("*").eq("board_id", args.boardId).order("position"),
        sb.from("columns").select("*").eq("board_id", args.boardId).order("position"),
      ]);
      if (orig.error) throw new Error(orig.error.message);
      if (groups.error) throw new Error(groups.error.message);
      if (columns.error) throw new Error(columns.error.message);

      const { data: board, error: bErr } = await sb.from("boards").insert({
        workspace_id: orig.data.workspace_id,
        name: args.name,
        description: orig.data.description,
        kind: orig.data.kind,
        icon: orig.data.icon,
        color: orig.data.color,
        owner_id: auth.user?.id ?? null,
        position: nextPosition(),
      }).select("id").single();
      if (bErr) throw new Error(bErr.message);
      const newBoardId = board.id as string;

      // Grupos e colunas: guarda o de-para para reapontar itens e células.
      const groupMap = new Map<string, string>();
      if ((groups.data ?? []).length) {
        const { data: newGroups, error } = await sb.from("groups").insert(
          (groups.data as any[]).map((g) => ({
            board_id: newBoardId, title: g.title, color: g.color, position: g.position,
          })),
        ).select("id, position");
        if (error) throw new Error(error.message);
        const sortedOld = [...(groups.data as any[])].sort((a, b) => a.position - b.position);
        const sortedNew = [...(newGroups as any[])].sort((a, b) => a.position - b.position);
        sortedOld.forEach((g, i) => groupMap.set(g.id, sortedNew[i].id));
      }

      const columnMap = new Map<string, string>();
      if ((columns.data ?? []).length) {
        const { data: newCols, error } = await sb.from("columns").insert(
          (columns.data as any[]).map((c) => ({
            board_id: newBoardId, title: c.title, type: c.type,
            settings: c.settings, position: c.position, width: c.width,
          })),
        ).select("id, position");
        if (error) throw new Error(error.message);
        const sortedOld = [...(columns.data as any[])].sort((a, b) => a.position - b.position);
        const sortedNew = [...(newCols as any[])].sort((a, b) => a.position - b.position);
        sortedOld.forEach((c, i) => columnMap.set(c.id, sortedNew[i].id));
      }

      if (args.withItems) {
        const { data: items, error: iErr } = await sb.from("items").select("*")
          .eq("board_id", args.boardId).eq("state", "active").is("parent_item_id", null).order("position");
        if (iErr) throw new Error(iErr.message);
        if ((items ?? []).length) {
          const { data: newItems, error } = await sb.from("items").insert(
            (items as any[]).map((it) => ({
              board_id: newBoardId,
              group_id: it.group_id ? (groupMap.get(it.group_id) ?? null) : null,
              name: it.name, description: it.description, position: it.position,
              creator_id: auth.user?.id ?? null,
            })),
          ).select("id, position");
          if (error) throw new Error(error.message);
          const sortedOld = [...(items as any[])].sort((a, b) => a.position - b.position);
          const sortedNew = [...(newItems as any[])].sort((a, b) => a.position - b.position);
          const itemMap = new Map<string, string>();
          sortedOld.forEach((it, i) => itemMap.set(it.id, sortedNew[i].id));

          const { data: cells } = await sb.from("column_values")
            .select("item_id, column_id, value, text_cache, items!inner(board_id)")
            .eq("items.board_id", args.boardId);
          const rows = (cells ?? [])
            .map((cv: any) => ({
              item_id: itemMap.get(cv.item_id),
              column_id: columnMap.get(cv.column_id),
              value: cv.value,
              text_cache: cv.text_cache,
            }))
            .filter((r: any) => r.item_id && r.column_id);
          if (rows.length) {
            const { error: cErr } = await sb.from("column_values").insert(rows);
            if (cErr) throw new Error(cErr.message);
          }
        }
      }

      return newBoardId;
    },
    onSuccess: () => toast.success("Quadro duplicado!"),
    onError: alertError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["boards-tree"] }),
  });
}

export function useRenameBoard(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { name: string }) => {
      const { error } = await sb.from("boards").update({ name: args.name }).eq("id", boardId);
      if (error) throw new Error(error.message);
    },
    onError: alertError,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      qc.invalidateQueries({ queryKey: ["boards-tree"] });
    },
  });
}

/** Exclusão suave: o board some da lista mas os dados ficam no banco. */
export function useArchiveBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (boardId: string) => {
      const { error } = await sb.from("boards").update({ state: "archived" }).eq("id", boardId);
      if (error) throw new Error(error.message);
    },
    onError: alertError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["boards-tree"] }),
  });
}

/** Aparência e dados do quadro: nome, descrição, emoji e cor. */
export function useUpdateBoard(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { name?: string; description?: string | null; icon?: string | null; color?: string | null }) => {
      const { error } = await sb.from("boards").update(patch).eq("id", boardId);
      if (error) throw new Error(error.message);
    },
    onError: alertError,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      qc.invalidateQueries({ queryKey: ["boards-tree"] });
    },
  });
}

// ── Responsáveis do quadro (quem enxerga). Só admin gerencia. ────────
export function useBoardMembers(boardId: string) {
  return useQuery({
    queryKey: ["board-members", boardId],
    queryFn: async () => {
      const { data, error } = await sb.from("board_members").select("user_id").eq("board_id", boardId);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: any) => r.user_id as string);
    },
    enabled: Boolean(boardId),
  });
}

export function useToggleBoardMember(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { userId: string; add: boolean }) => {
      const { error } = args.add
        ? await sb.from("board_members").insert({ board_id: boardId, user_id: args.userId })
        : await sb.from("board_members").delete().eq("board_id", boardId).eq("user_id", args.userId);
      if (error) throw new Error(error.message);
    },
    onError: alertError,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["board-members", boardId] });
      qc.invalidateQueries({ queryKey: ["boards-tree"] });
    },
  });
}

/** Largura da coluna (arrastar a borda do cabeçalho, como planilha). */
export function useSetColumnWidth(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { columnId: string; width: number }) => {
      const { error } = await sb.from("columns").update({ width: Math.round(args.width) }).eq("id", args.columnId);
      if (error) throw new Error(error.message);
    },
    onError: alertError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

/** Settings da coluna — usado pelo editor de labels de Status/Tipo. */
export function useUpdateColumnSettings(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { columnId: string; settings: Record<string, unknown> }) => {
      const { error } = await sb.from("columns").update({ settings: args.settings }).eq("id", args.columnId);
      if (error) throw new Error(error.message);
    },
    onError: alertError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

export function useSetStatusLabels(boardId: string) {
  const update = useUpdateColumnSettings(boardId);
  return (columnId: string, labels: StatusLabel[], rest: Record<string, unknown> = {}) =>
    update.mutate({ columnId, settings: { ...rest, labels } });
}

/** Cor do grupo. */
export function useSetGroupColor(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { groupId: string; color: string }) => {
      const { error } = await sb.from("groups").update({ color: args.color }).eq("id", args.groupId);
      if (error) throw new Error(error.message);
    },
    onError: alertError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

export function useCreateGroup(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { title: string }) => {
      const color = GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)];
      const { error } = await sb.from("groups").insert({
        board_id: boardId, title: args.title, color, position: nextPosition(),
      });
      if (error) throw new Error(error.message);
    },
    onError: alertError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

export function useRenameGroup(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { groupId: string; title: string }) => {
      const { error } = await sb.from("groups").update({ title: args.title }).eq("id", args.groupId);
      if (error) throw new Error(error.message);
    },
    onError: alertError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

export function useDeleteGroup(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { groupId: string }) => {
      const { error } = await sb.from("groups").delete().eq("id", args.groupId);
      if (error) throw new Error(error.message);
    },
    onError: alertError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

export function useCreateColumn(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { title: string; type: string }) => {
      const settings = getColumnType(args.type).defaultSettings();
      const { error } = await sb.from("columns").insert({
        board_id: boardId, title: args.title, type: args.type, settings, position: nextPosition(),
      });
      if (error) throw new Error(error.message);
    },
    onError: alertError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

export function useRenameColumn(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { columnId: string; title: string }) => {
      const { error } = await sb.from("columns").update({ title: args.title }).eq("id", args.columnId);
      if (error) throw new Error(error.message);
    },
    onError: alertError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

export function useDeleteColumn(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { columnId: string }) => {
      const { error } = await sb.from("columns").delete().eq("id", args.columnId);
      if (error) throw new Error(error.message);
    },
    onError: alertError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}
