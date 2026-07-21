// =====================================================================
// Camada de dados das Tarefas — TanStack Query + Supabase
// =====================================================================
// Regra herdada do projeto de origem: NUNCA engolir erro do Supabase
// (o padrão `.data ?? []` escondia falhas como "lista vazia").

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifyUsers } from "@/lib/notifications";
import { sb } from "./client";
import { prepareCellWrite } from "./columns";
import type { ColumnSettings } from "./column-types";
import type { BoardColumn, BoardData, CellMap, Item, Profile } from "./types";

export type { Board, BoardColumn, BoardData, Cell, CellMap, Group, Item, Profile } from "./types";

function ok<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  if (res.data == null) throw new Error("Resposta vazia do Supabase");
  return res.data;
}

function reportWriteError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  // Melhor um save perdido virar ruído do que o usuário achar que gravou.
  toast.error(`Não foi possível salvar: ${msg}`);
}

// ── Workspaces → pastas → boards ─────────────────────────────────────
export function useBoardsTree() {
  return useQuery({
    queryKey: ["boards-tree"],
    queryFn: async () => {
      const data = ok(
        await sb
          .from("workspaces")
          .select(
            "id, name, boards(id, name, kind, position, state, folder_id, updated_at), board_folders(id, name, parent_folder_id, position)",
          )
          .order("name")
          .order("position", { referencedTable: "boards" }),
      ) as any[];
      return data.map((ws) => ({
        id: ws.id as string,
        name: ws.name as string,
        boards: (ws.boards ?? []).filter((b: any) => b.state === "active"),
        folders: [...(ws.board_folders ?? [])].sort((a: any, b: any) =>
          String(a.name).localeCompare(String(b.name), "pt-BR"),
        ),
      }));
    },
  });
}

export type WorkspaceTree = NonNullable<ReturnType<typeof useBoardsTree>["data"]>[number];
export type TreeBoard = WorkspaceTree["boards"][number];

// ── Diretório do time (coluna People, avatares, updates) ────────────
export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () =>
      ok(await sb.from("profiles").select("id, full_name, email, avatar_url").order("full_name")) as Profile[],
    staleTime: 5 * 60_000,
  });
}

// ── Board aberto: grupos + colunas + itens + células ─────────────────
export function useBoardData(boardId: string) {
  return useQuery({
    queryKey: ["board", boardId],
    queryFn: async (): Promise<BoardData> => {
      const [board, groups, columns, items, values] = await Promise.all([
        sb.from("boards").select("*").eq("id", boardId).single(),
        sb.from("groups").select("*").eq("board_id", boardId).order("position"),
        sb.from("columns").select("*").eq("board_id", boardId).order("position"),
        sb.from("items").select("*").eq("board_id", boardId).eq("state", "active")
          .is("parent_item_id", null).order("position"),
        sb.from("column_values")
          .select("item_id, column_id, value, text_cache, items!inner(board_id)")
          .eq("items.board_id", boardId),
      ]);
      const cellMap: CellMap = {};
      for (const cv of ok(values) as any[]) {
        (cellMap[cv.item_id] ??= {})[cv.column_id] = { value: cv.value, text_cache: cv.text_cache };
      }
      return {
        board: ok(board),
        groups: ok(groups),
        columns: ok(columns),
        items: ok(items),
        cellMap,
      };
    },
    enabled: Boolean(boardId),
  });
}

// ── Escritas ─────────────────────────────────────────────────────────
export function useSaveCell(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { itemId: string; column: BoardColumn; input: unknown; itemName?: string }) => {
      const { value, text_cache } = prepareCellWrite(
        args.column.type,
        args.input,
        (args.column.settings ?? {}) as ColumnSettings,
      );
      const { error } = await sb.from("column_values").upsert(
        { item_id: args.itemId, column_id: args.column.id, value, text_cache },
        { onConflict: "item_id,column_id" },
      );
      if (error) throw new Error(error.message);

      // Marcou alguém como responsável → avisa a pessoa (a demanda passa a
      // aparecer na aba "Minhas demandas" dela).
      if (args.column.type === "people") {
        const ids = ((value as { personsAndTeams?: { id: string }[] } | null)?.personsAndTeams ?? []).map((p) => p.id);
        if (ids.length > 0) {
          const { data: auth } = await sb.auth.getUser();
          await notifyUsers(ids, {
            kind: "task",
            title: "Você é responsável por uma demanda",
            body: args.itemName || "Abra o quadro para ver os detalhes.",
            link: `/tasks/${boardId}`,
            excludeUserId: auth.user?.id ?? null,
          });
        }
      }
    },
    // Otimista: a célula responde na hora (checkbox/status/data), sem esperar
    // o refetch. Se falhar, o snapshot volta + alerta.
    onMutate: async (args) => {
      const prepared = (() => {
        try {
          return prepareCellWrite(args.column.type, args.input, (args.column.settings ?? {}) as ColumnSettings);
        } catch {
          return null; // validação falha → mutationFn lança e alerta
        }
      })();
      if (!prepared) return { previous: undefined };
      await qc.cancelQueries({ queryKey: ["board", boardId] });
      const previous = qc.getQueryData<BoardData>(["board", boardId]);
      if (previous) {
        qc.setQueryData<BoardData>(["board", boardId], {
          ...previous,
          cellMap: {
            ...previous.cellMap,
            [args.itemId]: {
              ...previous.cellMap[args.itemId],
              [args.column.id]: { value: prepared.value, text_cache: prepared.text_cache },
            },
          },
        });
      }
      return { previous };
    },
    onError: (err, _args, ctx) => {
      if (ctx?.previous) qc.setQueryData(["board", boardId], ctx.previous);
      reportWriteError(err);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

export function useRenameItem(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { itemId: string; name: string }) => {
      const { error } = await sb.from("items").update({ name: args.name }).eq("id", args.itemId);
      if (error) throw new Error(error.message);
    },
    onError: reportWriteError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

/** Arquivar/restaurar/excluir (soft) um item. */
export function useSetItemState(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { itemId: string; state: "active" | "archived" | "deleted" }) => {
      const { error } = await sb.from("items").update({ state: args.state }).eq("id", args.itemId);
      if (error) throw new Error(error.message);
    },
    onError: reportWriteError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

/** Mover item de grupo e/ou posição (drag-and-drop). */
export function useMoveItem(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { itemId: string; groupId: string; position: number }) => {
      const { error } = await sb.from("items")
        .update({ group_id: args.groupId, position: args.position }).eq("id", args.itemId);
      if (error) throw new Error(error.message);
    },
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["board", boardId] });
      const previous = qc.getQueryData<BoardData>(["board", boardId]);
      if (previous) {
        qc.setQueryData<BoardData>(["board", boardId], {
          ...previous,
          items: previous.items
            .map((it: Item) => (it.id === args.itemId ? { ...it, group_id: args.groupId, position: args.position } : it))
            .sort((a: Item, b: Item) => a.position - b.position),
        });
      }
      return { previous };
    },
    onError: (err, _args, ctx) => {
      if (ctx?.previous) qc.setQueryData(["board", boardId], ctx.previous);
      reportWriteError(err);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

export function useAddItem(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { groupId: string; name: string; position: number }) => {
      const { data: auth } = await sb.auth.getUser();
      const { error } = await sb.from("items").insert({
        board_id: boardId,
        group_id: args.groupId,
        name: args.name,
        position: args.position,
        creator_id: auth.user?.id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onError: reportWriteError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

/** Descrição (e outros campos simples) da demanda. */
export function useUpdateItem(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { itemId: string; patch: { name?: string; description?: string | null } }) => {
      const { error } = await sb.from("items").update(args.patch).eq("id", args.itemId);
      if (error) throw new Error(error.message);
    },
    onError: reportWriteError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

// ── Clientes do Sistema Elo (coluna do tipo "Cliente") ───────────────
export function useClients() {
  return useQuery({
    queryKey: ["clients-min"],
    queryFn: async () =>
      ok(await sb.from("clients").select("id, name, company").order("name")) as
        { id: string; name: string; company: string | null }[],
    staleTime: 60_000,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await sb.from("clients").insert({ name, status: "active" }).select("id, name").single();
      if (error) throw new Error(error.message);
      return data as { id: string; name: string };
    },
    onError: reportWriteError,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["clients-min"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

/**
 * "Minhas demandas": itens de QUALQUER quadro onde a pessoa aparece numa
 * coluna do tipo People. Uma demanda só existe uma vez (no quadro de origem) —
 * esta é uma visão pessoal por cima, não uma cópia.
 */
export function useMyItems(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-items", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("column_values")
        .select("item_id, value, columns!inner(type), items!inner(id, name, description, state, board_id, boards!inner(id, name, icon, color))")
        .eq("columns.type", "people")
        .eq("items.state", "active")
        .contains("value", { personsAndTeams: [{ id: userId, kind: "person" }] });
      if (error) throw new Error(error.message);
      // Um item pode ter mais de uma coluna People — desduplica por item.
      const seen = new Map<string, any>();
      for (const row of (data ?? []) as any[]) {
        if (!seen.has(row.item_id)) seen.set(row.item_id, row.items);
      }
      return Array.from(seen.values());
    },
  });
}

export function useDeleteItem(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await sb.from("items").delete().eq("id", itemId);
      if (error) throw new Error(error.message);
    },
    onError: reportWriteError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}
