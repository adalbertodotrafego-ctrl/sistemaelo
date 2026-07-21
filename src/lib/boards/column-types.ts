// =====================================================================
// Registry de tipos de coluna — contrato
// =====================================================================
// Cada tipo de coluna do Monday é, no fundo: um shape de valor (JSONB),
// um validador, um gerador de text_cache, um comparador de ordenação e
// um conjunto de operadores de filtro. Descrevendo tudo por trás desta
// interface, o MOTOR (grid, views, filtros) fica agnóstico: adicionar um
// tipo novo é registrar um objeto, não mexer no core.

export type FilterOperator =
  | "is_empty"
  | "is_not_empty"
  | "any_of"
  | "none_of"
  | "contains_text"
  | "not_contains_text"
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "before"
  | "after"
  | "between"
  | "is_true"
  | "is_false";

export interface ValidationResult {
  ok: boolean;
  error?: string;
}
export const VALID: ValidationResult = { ok: true };
export const invalid = (error: string): ValidationResult => ({ ok: false, error });

// Settings são o schema da coluna (guardado em columns.settings). Cada tipo
// lê apenas as chaves que conhece; o resto ignora.
export type ColumnSettings = Record<string, unknown>;

export interface StatusLabel {
  index: number;
  label: string;
  color: string;
}
export interface DropdownOption {
  id: number;
  label: string;
}
export type PersonOrTeam = { id: string; kind: "person" | "team" };

/**
 * Definição de um tipo de coluna.
 * @template V shape do VALOR guardado em column_values.value (JSONB)
 * @template S shape das SETTINGS guardadas em columns.settings (JSONB)
 */
export interface ColumnTypeDef<
  V = unknown,
  S extends ColumnSettings = ColumnSettings,
> {
  /** identificador estável, gravado em columns.type */
  type: string;
  /** rótulo humano (menu "adicionar coluna") */
  label: string;
  /** nome do ícone lucide para o header da coluna */
  icon: string;

  /** settings padrão ao criar uma coluna deste tipo */
  defaultSettings(): S;
  /** valor padrão de uma célula nova (null = vazia) */
  defaultValue(): V | null;

  /** normaliza a entrada crua do editor para o shape canônico */
  parse(input: unknown, settings: S): V | null;
  /** valida um valor já parseado contra as settings */
  validate(value: V | null, settings: S): ValidationResult;

  /** texto desnormalizado gravado em column_values.text_cache (busca/ordenação) */
  toText(value: V | null, settings: S): string;
  /** comparador para ordenação ascendente (null vai para o fim) */
  compare(a: V | null, b: V | null, settings: S): number;

  /** operadores de filtro suportados por este tipo */
  operators: FilterOperator[];
  /** avalia se um valor satisfaz (operador, operando) */
  matches(value: V | null, op: FilterOperator, operand: unknown, settings: S): boolean;
}

// Helper de ordenação: empurra vazios para o fim independe da direção.
export function nullsLast(a: unknown, b: unknown): number | null {
  const ae = a === null || a === undefined;
  const be = b === null || b === undefined;
  if (ae && be) return 0;
  if (ae) return 1;
  if (be) return -1;
  return null; // ambos preenchidos — deixa o tipo comparar
}
