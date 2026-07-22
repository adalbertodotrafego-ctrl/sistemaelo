// =====================================================================
// Camada de dados das Tarefas — TanStack Query + Supabase
// =====================================================================
// Regra herdada do projeto de origem: NUNCA engolir erro do Supabase
// (o padrão `.data ?? []` escondia falhas como "lista vazia").

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifyUsers } from "@/lib/notifications";
import { sb } from "./client";
import { isDueAgain } from "./recurrence";
import type { Recurrence } from "./types";
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

      // Demandas recorrentes concluídas num período que já passou voltam a
      // ficar pendentes: limpa o carimbo e o status de conclusão. Roda aqui,
      // ao abrir o quadro, para não depender de rotina agendada no servidor.
      const reopened = await reopenDueRecurring(ok(items) as Item[], ok(columns) as BoardColumn[], cellMap);

      return {
        board: ok(board),
        groups: ok(groups),
        columns: ok(columns),
        items: reopened,
        cellMap,
      };
    },
    enabled: Boolean(boardId),
  });
}

/**
 * Reabre as demandas recorrentes cujo período de conclusão já passou:
 * apaga o `completed_at` e limpa as células de status marcadas como
 * "conclui a demanda". Devolve a lista de itens já com o estado novo, para
 * a tela não precisar de um segundo carregamento.
 */
async function reopenDueRecurring(items: Item[], columns: BoardColumn[], cellMap: CellMap): Promise<Item[]> {
  const due = items.filter((it) => isDueAgain(it.completed_at, it.recurrence));
  if (due.length === 0) return items;

  const doneCols = columns
    .filter((c) => c.type === "status")
    .map((c) => ({
      id: c.id,
      doneIdx: new Set(
        (((c.settings ?? {}) as { labels?: { index: number; done?: boolean }[] }).labels ?? [])
          .filter((l) => l.done).map((l) => l.index),
      ),
    }))
    .filter((c) => c.doneIdx.size > 0);

  const ids = due.map((it) => it.id);
  await sb.from("items").update({ completed_at: null }).in("id", ids);

  for (const it of due) {
    for (const col of doneCols) {
      const idx = (cellMap[it.id]?.[col.id]?.value as { index?: number } | null)?.index;
      if (idx != null && col.doneIdx.has(idx)) {
        await sb.from("column_values").delete().eq("item_id", it.id).eq("column_id", col.id);
        delete cellMap[it.id][col.id];
      }
    }
  }

  const dueSet = new Set(ids);
  return items.map((it) => (dueSet.has(it.id) ? { ...it, completed_at: null } : it));
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

      if (args.column.type === "status") {
        const settings = args.column.settings as
          { moveToGroup?: Record<string, string>; labels?: { index: number; done?: boolean }[] } | null;
        const idx = (value as { index?: number } | null)?.index;

        // Automação "mover por status": a coluna guarda um mapa
        // índice-do-status → grupo. Mudou o status, a demanda anda sozinha
        // para o grupo correspondente (ex.: Em andamento → Andamento).
        const targetGroup = settings?.moveToGroup && idx != null ? settings.moveToGroup[String(idx)] : undefined;
        if (targetGroup) {
          const { error: mvErr } = await sb.from("items")
            .update({ group_id: targetGroup }).eq("id", args.itemId);
          if (mvErr) throw new Error(mvErr.message);
        }

        // Status marcado como "conclui a demanda" carimba completed_at — é
        // dele que a recorrência parte para saber quando reabrir a demanda.
        const label = idx != null ? settings?.labels?.find((l) => l.index === idx) : undefined;
        const isDone = Boolean(label?.done);
        const { error: cErr } = await sb.from("items")
          .update({ completed_at: isDone ? new Date().toISOString() : null })
          .eq("id", args.itemId);
        if (cErr) throw new Error(cErr.message);
      }

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
    mutationFn: async (args: {
      groupId: string; name: string; position: number;
      recurrence?: Recurrence | null;
      /** Valores já escolhidos na criação (ex.: tipo de demanda). */
      cells?: { column: BoardColumn; input: unknown }[];
    }) => {
      const { data: auth } = await sb.auth.getUser();
      const { data, error } = await sb.from("items").insert({
        board_id: boardId,
        group_id: args.groupId,
        name: args.name,
        position: args.position,
        recurrence: args.recurrence ?? null,
        creator_id: auth.user?.id ?? null,
      }).select("id").single();
      if (error) throw new Error(error.message);

      const rows = (args.cells ?? []).map(({ column, input }) => {
        const { value, text_cache } = prepareCellWrite(column.type, input, (column.settings ?? {}) as ColumnSettings);
        return { item_id: data.id as string, column_id: column.id, value, text_cache };
      });
      if (rows.length) {
        const { error: cErr } = await sb.from("column_values").insert(rows);
        if (cErr) throw new Error(cErr.message);
      }
    },
    onError: reportWriteError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

/** Descrição, recorrência e outros campos simples da demanda. */
export function useUpdateItem(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      itemId: string;
      patch: { name?: string; description?: string | null; recurrence?: Recurrence | null; completed_at?: string | null };
    }) => {
      const { error } = await sb.from("items").update(args.patch).eq("id", args.itemId);
      if (error) throw new Error(error.message);
    },
    onError: reportWriteError,
    onSettled: () => qc.invalidateQueries({ queryKey: ["board", boardId] }),
  });
}

/**
 * Move a demanda para outro quadro. As colunas de destino são casadas pelo
 * par título+tipo: o que casa leva o valor junto, o que não casa é descartado
 * (guardar um valor apontando para coluna de outro quadro corromperia a
 * planilha de destino).
 */
export function useMoveItemToBoard(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { itemId: string; targetBoardId: string }) => {
      const [fromCols, toCols, toGroups] = await Promise.all([
        sb.from("columns").select("id, title, type").eq("board_id", boardId),
        sb.from("columns").select("id, title, type").eq("board_id", args.targetBoardId),
        sb.from("groups").select("id").eq("board_id", args.targetBoardId).order("position").limit(1),
      ]);
      if (fromCols.error) throw new Error(fromCols.error.message);
      if (toCols.error) throw new Error(toCols.error.message);
      if (toGroups.error) throw new Error(toGroups.error.message);

      const targetGroup = (toGroups.data ?? [])[0]?.id;
      if (!targetGroup) throw new Error("O quadro de destino não tem nenhum grupo. Crie um grupo lá primeiro.");

      const keyOf = (c: { title: string; type: string }) => `${c.title.trim().toLowerCase()}|${c.type}`;
      const targetByKey = new Map<string, string>(
        (toCols.data ?? []).map((c: any) => [keyOf(c), c.id as string] as [string, string]),
      );
      const remap = new Map<string, string>();
      for (const c of (fromCols.data ?? []) as any[]) {
        const dest = targetByKey.get(keyOf(c));
        if (dest) remap.set(c.id, dest);
      }

      const { data: cells } = await sb.from("column_values").select("column_id").eq("item_id", args.itemId);
      for (const cv of (cells ?? []) as any[]) {
        const dest = remap.get(cv.column_id);
        if (dest) {
          await sb.from("column_values").update({ column_id: dest }).eq("item_id", args.itemId).eq("column_id", cv.column_id);
        } else {
          await sb.from("column_values").delete().eq("item_id", args.itemId).eq("column_id", cv.column_id);
        }
      }

      const { error } = await sb.from("items")
        .update({ board_id: args.targetBoardId, group_id: targetGroup })
        .eq("id", args.itemId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => toast.success("Demanda movida para o outro quadro!"),
    onError: reportWriteError,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["board"] });
      qc.invalidateQueries({ queryKey: ["my-items"] });
    },
  });
}

/** Quadros que o usuário enxerga — para escolher o destino de uma demanda. */
export function useBoardOptions() {
  return useQuery({
    queryKey: ["board-options"],
    queryFn: async () =>
      ok(await sb.from("boards").select("id, name, icon").eq("state", "active").order("name")) as
        { id: string; name: string; icon: string | null }[],
    staleTime: 60_000,
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
 *
 * Cada item vem com as datas que tiver (colunas date/timeline), para a tela
 * conseguir separar o que é "de hoje".
 */
export function useMyItems(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-items", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("column_values")
        .select("item_id, value, columns!inner(type), items!inner(id, name, description, state, board_id, updated_at, boards!inner(id, name, icon, color))")
        .eq("columns.type", "people")
        .eq("items.state", "active")
        .contains("value", { personsAndTeams: [{ id: userId, kind: "person" }] });
      if (error) throw new Error(error.message);

      // Um item pode ter mais de uma coluna People — desduplica por item.
      const seen = new Map<string, any>();
      for (const row of (data ?? []) as any[]) {
        if (!seen.has(row.item_id)) seen.set(row.item_id, row.items);
      }
      const items = Array.from(seen.values());
      if (items.length === 0) return [];

      // Busca as datas desses itens para o filtro "hoje".
      const ids = items.map((i) => i.id);
      const { data: dateCells } = await sb
        .from("column_values")
        .select("item_id, value, columns!inner(type)")
        .in("columns.type", ["date", "timeline"])
        .in("item_id", ids);
      const datesByItem = new Map<string, string[]>();
      for (const cv of (dateCells ?? []) as any[]) {
        const v = cv.value as { date?: string; from?: string; to?: string } | null;
        const list = datesByItem.get(cv.item_id) ?? [];
        if (v?.date) list.push(v.date);
        if (v?.from) list.push(v.from);
        if (v?.to) list.push(v.to);
        datesByItem.set(cv.item_id, list);
      }
      return items.map((i) => ({ ...i, dates: datesByItem.get(i.id) ?? [] }));
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
