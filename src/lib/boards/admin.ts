// =====================================================================
// CRUD administrativo — workspaces, boards, grupos e colunas
// =====================================================================
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sb } from "./client";
import { getColumnType } from "./columns";

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
      const { data, error } = await sb.from("workspaces")
        .insert({ name: args.name, owner_id: auth.user.id }).select().single();
      if (error) throw new Error(error.message);
      return data;
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
      const { data, error } = await sb.from("boards").insert({
        workspace_id: args.workspaceId,
        name: args.name,
        kind: "public",
        owner_id: auth.user?.id ?? null,
        position: nextPosition(),
      }).select().single();
      if (error) throw new Error(error.message);
      return data;
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
