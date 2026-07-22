// =====================================================================
// Demandas recorrentes — quando uma demanda concluída volta a ficar pendente
// =====================================================================
import type { Recurrence } from "./types";

/**
 * Identifica o "período" de uma data conforme a frequência. Duas datas no
 * mesmo período têm a mesma chave; virou a chave, virou o período — e a
 * demanda recorrente deve reaparecer.
 */
export function periodKey(date: Date, recurrence: Recurrence): string {
  const y = date.getFullYear();
  switch (recurrence) {
    case "daily":
      return `${y}-${date.getMonth()}-${date.getDate()}`;
    case "weekly": {
      // Segunda-feira que abre a semana da data.
      const monday = startOfWeek(date);
      return `w:${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
    }
    case "biweekly": {
      // Quinzenas contadas a partir de uma segunda-feira fixa, para a
      // fronteira não mudar conforme o dia em que a pessoa concluiu.
      const monday = startOfWeek(date);
      const weeks = Math.floor((monday.getTime() - EPOCH_MONDAY) / (7 * 86400000));
      return `b:${Math.floor(weeks / 2)}`;
    }
    case "monthly":
      return `m:${y}-${date.getMonth()}`;
  }
}

const EPOCH_MONDAY = Date.UTC(2024, 0, 1); // 2024-01-01 foi uma segunda-feira

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // 0 = segunda
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * A demanda foi concluída num período que já passou? Então ela venceu e
 * precisa voltar a aparecer como pendente.
 */
export function isDueAgain(completedAt: string | null, recurrence: Recurrence | null): boolean {
  if (!recurrence || !completedAt) return false;
  return periodKey(new Date(completedAt), recurrence) !== periodKey(new Date(), recurrence);
}
