// Tipos das tabelas de boards (Tarefas).
//
// Estas tabelas entraram pela migração 20260721120000_boards_core.sql e NÃO
// estão no src/integrations/supabase/types.ts (que é gerado). Em vez de
// regenerar o arquivo inteiro, descrevemos aqui só as linhas que a página de
// Tarefas usa — e o acesso ao Supabase passa pelo alias `sb` (client.ts).

export type ItemState = "active" | "archived" | "deleted";
export type BoardKind = "public" | "private" | "shareable";
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export type Workspace = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type BoardFolder = {
  id: string;
  workspace_id: string;
  parent_folder_id: string | null;
  name: string;
  position: number;
  created_at: string;
};

export type Recurrence = "daily" | "weekly" | "biweekly" | "monthly";

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  daily: "Todo dia",
  weekly: "1x por semana",
  biweekly: "A cada 15 dias",
  monthly: "1x por mês",
};

export type Board = {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  name: string;
  description: string | null;
  kind: BoardKind;
  owner_id: string | null;
  position: number;
  state: ItemState;
  /** emoji exibido junto ao nome */
  icon: string | null;
  /** cor de destaque do quadro (hex) */
  color: string | null;
  created_at: string;
  updated_at: string;
};

export type Group = {
  id: string;
  board_id: string;
  title: string;
  color: string;
  position: number;
  created_at: string;
};

export type BoardColumn = {
  id: string;
  board_id: string;
  title: string;
  /** valida contra o registry em src/lib/boards/columns.ts */
  type: string;
  settings: Record<string, unknown> | null;
  position: number;
  /** largura em px definida ao arrastar a borda do cabeçalho */
  width: number | null;
  created_at: string;
};

export type Item = {
  id: string;
  board_id: string;
  group_id: string | null;
  parent_item_id: string | null;
  name: string;
  description: string | null;
  /** null = demanda avulsa; senão daily | weekly | biweekly | monthly */
  recurrence: Recurrence | null;
  /** quando foi concluída — base para saber se já virou o período */
  completed_at: string | null;
  position: number;
  state: ItemState;
  creator_id: string | null;
  last_edited_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BoardUpdate = {
  id: string;
  item_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

export type Cell = { value: unknown; text_cache: string | null };
/** cellMap[item_id][column_id] → célula */
export type CellMap = Record<string, Record<string, Cell>>;

export type BoardData = {
  board: Board;
  groups: Group[];
  columns: BoardColumn[];
  items: Item[];
  cellMap: CellMap;
};
