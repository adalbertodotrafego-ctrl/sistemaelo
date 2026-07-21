// =====================================================================
// Registry de tipos de coluna — implementações do Dia 1
// =====================================================================
// Uso:
//   import { getColumnType, COLUMN_TYPES } from "@/lib/columns";
//   const def = getColumnType("status");
//   def.toText(value, column.settings)   // → text_cache
//
// Ao gravar uma célula: parse(input) → validate() → { value, text_cache }.

import {
  type ColumnSettings,
  type ColumnTypeDef,
  type DropdownOption,
  type PersonOrTeam,
  type StatusLabel,
  VALID,
  invalid,
  nullsLast,
} from "./column-types";

const asText = (v: unknown) => (v == null ? "" : String(v)).trim();
const lower = (v: unknown) => asText(v).toLowerCase();

// ── Text ─────────────────────────────────────────────────────────────
type TextValue = { text: string };
const textType: ColumnTypeDef<TextValue> = {
  type: "text",
  label: "Texto",
  icon: "Type",
  defaultSettings: () => ({}),
  defaultValue: () => null,
  parse: (input) => {
    const t = asText(input);
    return t ? { text: t } : null;
  },
  validate: () => VALID,
  toText: (v) => v?.text ?? "",
  compare: (a, b) =>
    nullsLast(a, b) ?? (a!.text.localeCompare(b!.text, "pt-BR")),
  operators: ["is_empty", "is_not_empty", "contains_text", "not_contains_text", "equals"],
  matches: (v, op, operand) => {
    const t = lower(v?.text);
    switch (op) {
      case "is_empty": return t === "";
      case "is_not_empty": return t !== "";
      case "contains_text": return t.includes(lower(operand));
      case "not_contains_text": return !t.includes(lower(operand));
      case "equals": return t === lower(operand);
      default: return false;
    }
  },
};

// ── Long Text ────────────────────────────────────────────────────────
const longTextType: ColumnTypeDef<TextValue> = {
  ...textType,
  type: "long_text",
  label: "Texto longo",
  icon: "AlignLeft",
};

// ── Numbers ──────────────────────────────────────────────────────────
type NumberValue = { number: number };
type NumberSettings = { format?: "number" | "currency" | "percent"; unit?: string };
const numbersType: ColumnTypeDef<NumberValue, NumberSettings> = {
  type: "numbers",
  label: "Número",
  icon: "Hash",
  defaultSettings: () => ({ format: "number" }),
  defaultValue: () => null,
  parse: (input) => {
    if (input === "" || input == null) return null;
    const n = typeof input === "number" ? input : Number(String(input).replace(",", "."));
    return Number.isFinite(n) ? { number: n } : null;
  },
  validate: (v) =>
    v == null || Number.isFinite(v.number) ? VALID : invalid("Número inválido"),
  toText: (v, s) => {
    if (v == null) return "";
    if (s.format === "currency")
      return v.number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    if (s.format === "percent") return `${v.number}%`;
    return String(v.number);
  },
  compare: (a, b) => nullsLast(a, b) ?? a!.number - b!.number,
  operators: ["is_empty", "is_not_empty", "equals", "not_equals", "greater_than", "less_than"],
  matches: (v, op, operand) => {
    const n = v?.number;
    const x = Number(operand);
    switch (op) {
      case "is_empty": return n == null;
      case "is_not_empty": return n != null;
      case "equals": return n === x;
      case "not_equals": return n !== x;
      case "greater_than": return n != null && n > x;
      case "less_than": return n != null && n < x;
      default: return false;
    }
  },
};

// ── Status (o carro-chefe: index → label + cor) ──────────────────────
type StatusValue = { index: number };
type StatusSettings = { labels: StatusLabel[] };
const DEFAULT_STATUS_LABELS: StatusLabel[] = [
  { index: 0, label: "A fazer", color: "#c4c4c4" },
  { index: 1, label: "Em andamento", color: "#fdab3d" },
  { index: 2, label: "Concluído", color: "#00c875" },
  { index: 3, label: "Travado", color: "#e2445c" },
];
const statusType: ColumnTypeDef<StatusValue, StatusSettings> = {
  type: "status",
  label: "Status",
  icon: "CircleDot",
  defaultSettings: () => ({ labels: DEFAULT_STATUS_LABELS }),
  defaultValue: () => null,
  parse: (input) => {
    if (input == null || input === "") return null;
    const idx = typeof input === "number" ? input : Number((input as StatusValue).index ?? input);
    return Number.isInteger(idx) ? { index: idx } : null;
  },
  validate: (v, s) =>
    v == null || s.labels.some((l) => l.index === v.index)
      ? VALID
      : invalid("Label de status inexistente"),
  toText: (v, s) => s.labels.find((l) => l.index === v?.index)?.label ?? "",
  compare: (a, b) => nullsLast(a, b) ?? a!.index - b!.index,
  operators: ["is_empty", "is_not_empty", "any_of", "none_of"],
  matches: (v, op, operand) => {
    const idx = v?.index;
    const set = Array.isArray(operand) ? operand.map(Number) : [Number(operand)];
    switch (op) {
      case "is_empty": return idx == null;
      case "is_not_empty": return idx != null;
      case "any_of": return idx != null && set.includes(idx);
      case "none_of": return idx == null || !set.includes(idx);
      default: return false;
    }
  },
};

// ── Dropdown (múltiplas opções) ──────────────────────────────────────
type DropdownValue = { ids: number[] };
type DropdownSettings = { options: DropdownOption[] };
const dropdownType: ColumnTypeDef<DropdownValue, DropdownSettings> = {
  type: "dropdown",
  label: "Seleção",
  icon: "List",
  defaultSettings: () => ({ options: [] }),
  defaultValue: () => null,
  parse: (input) => {
    const ids = Array.isArray(input) ? input.map(Number).filter(Number.isInteger) : [];
    return ids.length ? { ids } : null;
  },
  validate: (v, s) =>
    v == null || v.ids.every((id) => s.options.some((o) => o.id === id))
      ? VALID
      : invalid("Opção inexistente"),
  toText: (v, s) =>
    (v?.ids ?? [])
      .map((id) => s.options.find((o) => o.id === id)?.label ?? "")
      .filter(Boolean)
      .join(", "),
  compare: (a, b, s) =>
    nullsLast(a, b) ?? dropdownType.toText(a, s).localeCompare(dropdownType.toText(b, s), "pt-BR"),
  operators: ["is_empty", "is_not_empty", "any_of", "none_of"],
  matches: (v, op, operand) => {
    const ids = v?.ids ?? [];
    const set = Array.isArray(operand) ? operand.map(Number) : [Number(operand)];
    switch (op) {
      case "is_empty": return ids.length === 0;
      case "is_not_empty": return ids.length > 0;
      case "any_of": return ids.some((id) => set.includes(id));
      case "none_of": return !ids.some((id) => set.includes(id));
      default: return false;
    }
  },
};

// ── People (pessoas/times) ───────────────────────────────────────────
type PeopleValue = { personsAndTeams: PersonOrTeam[] };
const peopleType: ColumnTypeDef<PeopleValue> = {
  type: "people",
  label: "Pessoas",
  icon: "Users",
  defaultSettings: () => ({}),
  defaultValue: () => null,
  parse: (input) => {
    const arr = Array.isArray(input) ? (input as PersonOrTeam[]) : [];
    const clean = arr.filter((p) => p && typeof p.id === "string");
    return clean.length ? { personsAndTeams: clean } : null;
  },
  validate: () => VALID,
  // Nomes são resolvidos na UI via profiles; o text_cache guarda os ids
  // para estabilidade. (Enriquecer com nome é papel da camada de escrita.)
  toText: (v) => (v?.personsAndTeams ?? []).map((p) => p.id).join(","),
  compare: (a, b) =>
    nullsLast(a, b) ??
    (a!.personsAndTeams.length - b!.personsAndTeams.length),
  operators: ["is_empty", "is_not_empty", "any_of", "none_of"],
  matches: (v, op, operand) => {
    const ids = (v?.personsAndTeams ?? []).map((p) => p.id);
    const set = Array.isArray(operand) ? operand.map(String) : [String(operand)];
    switch (op) {
      case "is_empty": return ids.length === 0;
      case "is_not_empty": return ids.length > 0;
      case "any_of": return ids.some((id) => set.includes(id));
      case "none_of": return !ids.some((id) => set.includes(id));
      default: return false;
    }
  },
};

// ── Date ─────────────────────────────────────────────────────────────
type DateValue = { date: string; time?: string }; // YYYY-MM-DD [HH:mm]
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const dateType: ColumnTypeDef<DateValue> = {
  type: "date",
  label: "Data",
  icon: "Calendar",
  defaultSettings: () => ({}),
  defaultValue: () => null,
  parse: (input) => {
    if (!input) return null;
    if (typeof input === "object" && "date" in (input as DateValue))
      return input as DateValue;
    const s = String(input);
    return isoDate.test(s) ? { date: s } : null;
  },
  validate: (v) =>
    v == null || isoDate.test(v.date) ? VALID : invalid("Data deve ser YYYY-MM-DD"),
  toText: (v) => (v ? `${v.date}${v.time ? " " + v.time : ""}` : ""),
  compare: (a, b) =>
    nullsLast(a, b) ?? (a!.date < b!.date ? -1 : a!.date > b!.date ? 1 : 0),
  operators: ["is_empty", "is_not_empty", "equals", "before", "after", "between"],
  matches: (v, op, operand) => {
    const d = v?.date;
    switch (op) {
      case "is_empty": return d == null;
      case "is_not_empty": return d != null;
      case "equals": return d === String(operand);
      case "before": return d != null && d < String(operand);
      case "after": return d != null && d > String(operand);
      case "between": {
        const [from, to] = Array.isArray(operand) ? operand.map(String) : ["", ""];
        return d != null && d >= from && d <= to;
      }
      default: return false;
    }
  },
};

// ── Timeline (intervalo de datas) ────────────────────────────────────
type TimelineValue = { from: string; to: string };
const timelineType: ColumnTypeDef<TimelineValue> = {
  type: "timeline",
  label: "Cronograma",
  icon: "CalendarRange",
  defaultSettings: () => ({}),
  defaultValue: () => null,
  parse: (input) => {
    const v = input as Partial<TimelineValue> | null;
    return v && isoDate.test(v.from ?? "") && isoDate.test(v.to ?? "")
      ? { from: v.from!, to: v.to! }
      : null;
  },
  validate: (v) =>
    v == null || (isoDate.test(v.from) && isoDate.test(v.to) && v.from <= v.to)
      ? VALID
      : invalid("Intervalo inválido (from ≤ to, YYYY-MM-DD)"),
  toText: (v) => (v ? `${v.from} → ${v.to}` : ""),
  compare: (a, b) => nullsLast(a, b) ?? (a!.from < b!.from ? -1 : a!.from > b!.from ? 1 : 0),
  operators: ["is_empty", "is_not_empty"],
  matches: (v, op) => {
    switch (op) {
      case "is_empty": return v == null;
      case "is_not_empty": return v != null;
      default: return false;
    }
  },
};

// ── Checkbox ─────────────────────────────────────────────────────────
type CheckboxValue = { checked: boolean };
const checkboxType: ColumnTypeDef<CheckboxValue> = {
  type: "checkbox",
  label: "Checkbox",
  icon: "CheckSquare",
  defaultSettings: () => ({}),
  defaultValue: () => ({ checked: false }),
  parse: (input) => ({ checked: Boolean((input as CheckboxValue)?.checked ?? input) }),
  validate: () => VALID,
  toText: (v) => (v?.checked ? "v" : ""),
  compare: (a, b) => Number(a?.checked ?? false) - Number(b?.checked ?? false),
  operators: ["is_true", "is_false"],
  matches: (v, op) => {
    switch (op) {
      case "is_true": return v?.checked === true;
      case "is_false": return !v?.checked;
      default: return false;
    }
  },
};

// ── Link ─────────────────────────────────────────────────────────────
type LinkValue = { url: string; text?: string };
const linkType: ColumnTypeDef<LinkValue> = {
  type: "link",
  label: "Link",
  icon: "Link",
  defaultSettings: () => ({}),
  defaultValue: () => null,
  parse: (input) => {
    if (!input) return null;
    if (typeof input === "string") return { url: input };
    const v = input as LinkValue;
    return v.url ? { url: v.url, text: v.text } : null;
  },
  validate: (v) => {
    if (v == null) return VALID;
    try {
      // Só http(s): URL() aceita javascript:/data:, que executariam script
      // no clique (stored XSS) — bloquear na escrita.
      const u = new URL(v.url);
      return u.protocol === "http:" || u.protocol === "https:"
        ? VALID
        : invalid("URL deve começar com http:// ou https://");
    } catch {
      return invalid("URL inválida");
    }
  },
  toText: (v) => (v ? v.text || v.url : ""),
  compare: (a, b, s) =>
    nullsLast(a, b) ?? linkType.toText(a, s).localeCompare(linkType.toText(b, s), "pt-BR"),
  operators: ["is_empty", "is_not_empty", "contains_text"],
  matches: (v, op, operand) => {
    const t = lower(v ? v.text || v.url : "");
    switch (op) {
      case "is_empty": return t === "";
      case "is_not_empty": return t !== "";
      case "contains_text": return t.includes(lower(operand));
      default: return false;
    }
  },
};

// ── Cliente (aponta para a tabela clients do Sistema Elo) ────────────
// Guarda id + nome: o id liga ao cadastro, o nome mantém o texto legível
// (e o text_cache pesquisável) mesmo se o cliente for renomeado depois.
type ClientValue = { id: string; name: string };
const clientType: ColumnTypeDef<ClientValue> = {
  type: "client",
  label: "Cliente",
  icon: "Building2",
  defaultSettings: () => ({}),
  defaultValue: () => null,
  parse: (input) => {
    if (!input) return null;
    const v = input as Partial<ClientValue>;
    return v.id ? { id: String(v.id), name: String(v.name ?? "") } : null;
  },
  validate: () => VALID,
  toText: (v) => v?.name ?? "",
  compare: (a, b) => nullsLast(a, b) ?? a!.name.localeCompare(b!.name, "pt-BR"),
  operators: ["is_empty", "is_not_empty", "any_of", "none_of", "contains_text"],
  matches: (v, op, operand) => {
    const id = v?.id;
    const set = Array.isArray(operand) ? operand.map(String) : [String(operand)];
    switch (op) {
      case "is_empty": return id == null;
      case "is_not_empty": return id != null;
      case "any_of": return id != null && set.includes(id);
      case "none_of": return id == null || !set.includes(id);
      case "contains_text": return lower(v?.name).includes(lower(operand));
      default: return false;
    }
  },
};

// ── Registry ─────────────────────────────────────────────────────────
const DEFS: ColumnTypeDef<any, any>[] = [
  textType,
  longTextType,
  numbersType,
  statusType,
  dropdownType,
  peopleType,
  clientType,
  dateType,
  timelineType,
  checkboxType,
  linkType,
];

export const COLUMN_TYPES: Record<string, ColumnTypeDef<any, any>> = Object.fromEntries(
  DEFS.map((d) => [d.type, d]),
);

/** lista para o menu "adicionar coluna" (ordem de exibição) */
export const COLUMN_TYPE_LIST = DEFS.map(({ type, label, icon }) => ({ type, label, icon }));

export function getColumnType(type: string): ColumnTypeDef<any, any> {
  const def = COLUMN_TYPES[type];
  if (!def) throw new Error(`Tipo de coluna desconhecido: "${type}"`);
  return def;
}

/** Prepara { value, text_cache } para gravar em column_values. */
export function prepareCellWrite(
  type: string,
  rawInput: unknown,
  settings: ColumnSettings,
): { value: unknown; text_cache: string } {
  const def = getColumnType(type);
  const value = def.parse(rawInput, settings);
  const result = def.validate(value, settings);
  if (!result.ok) throw new Error(result.error ?? "Valor inválido");
  return { value, text_cache: def.toText(value, settings) };
}
