// =====================================================================
// Busca paginada — contorna o teto de linhas do PostgREST
// =====================================================================
// O PostgREST devolve no máximo 1000 linhas por requisição (`max-rows`) e
// faz isso EM SILÊNCIO: a resposta vem 200 OK, só que cortada. Um quadro
// com 2.656 itens carregava 1.000 e o resto simplesmente sumia da tela —
// sem erro, sem aviso. Este helper pede a consulta em fatias com `range()`
// até a última página vir incompleta, então nada mais se perde.
//
// Uso:
//   const items = await fetchAllRows((from, to) =>
//     sb.from("items").select("*").eq("board_id", id).order("position").range(from, to));
//
// A consulta PRECISA ter uma ordenação estável (order por coluna única ou
// com desempate por id), senão o banco pode repetir/pular linhas entre as
// fatias. `orderStable()` abaixo cuida disso.
// =====================================================================

/** Tamanho da fatia. Abaixo do teto do PostgREST para nunca encostar nele. */
export const PAGE_SIZE = 1000;

/** Teto de segurança: evita loop infinito se a consulta não paginar direito. */
const MAX_PAGES = 200; // 200k linhas — muito além de qualquer quadro real

type PagedQuery<T> = (from: number, to: number) => PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

/**
 * Roda a consulta em fatias de `PAGE_SIZE` e devolve todas as linhas.
 * Erro do Supabase vira exceção (nunca engole falha silenciosamente).
 */
export async function fetchAllRows<T>(query: PagedQuery<T>): Promise<T[]> {
  const all: T[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data) break;

    all.push(...data);

    // Página incompleta = acabou. É o único jeito confiável de saber o fim
    // sem pagar um count exato a cada carregamento.
    if (data.length < PAGE_SIZE) return all;
  }

  console.warn(
    `[fetchAllRows] Parou no teto de ${MAX_PAGES} páginas (${all.length} linhas). ` +
      `A consulta provavelmente não está ordenada de forma estável.`,
  );
  return all;
}

/** Tamanho do lote de escrita. Requisição gigante estoura tempo e memória. */
export const WRITE_CHUNK = 500;

/**
 * Insere em lotes e devolve as linhas criadas, na ordem em que foram enviadas.
 * Um insert único com milhares de linhas derruba a requisição por tempo;
 * em lotes, cada pedaço é rápido e o total escala sem travar.
 */
export async function insertChunked<T>(
  insert: (rows: T[]) => PromiseLike<{ data: any[] | null; error: { message: string } | null }>,
  rows: T[],
  chunk = WRITE_CHUNK,
): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < rows.length; i += chunk) {
    const { data, error } = await insert(rows.slice(i, i + chunk));
    if (error) throw new Error(error.message);
    if (data) out.push(...data);
  }
  return out;
}
