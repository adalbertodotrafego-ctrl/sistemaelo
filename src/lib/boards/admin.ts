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
