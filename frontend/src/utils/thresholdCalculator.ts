/**
 * 🆕 15/06/2026 — Calcolo soglie cumulative €5K/€15K per quietanze firmate.
 *
 * Unica sorgente di verità: la STESSA logica matematica usata dal backend
 * (`_month_breaches` in server.py) e dai lati utente atleta/coach/collaboratore/dirigente.
 *
 * Cumulo cronologico per anno fiscale:
 *  - Primo mese attivo = primo mese con compenso > 0
 *  - Pregresso applicato al primo mese attivo SOLO se è il primo anno del contratto
 *  - Esterni distribuiti per `related_receipt_month`
 *  - Per ogni mese: cumulato_fine_mese = cumulato_precedente + amount_mese (+ pregresso se primo mese attivo)
 *  - `first5k`/`first15k`: primo mese in cui cumulato_fine_mese supera la soglia
 */

export interface MonthAmount {
  /** 1-12 */
  month: number;
  /** Anno fiscale */
  year: number;
  /** Importo del mese (Coach + Atleta + esterni di quel mese) */
  amount: number;
}

export interface ThresholdsByYear {
  [year: number]: { first5k: number | null; first15k: number | null };
}

export interface CumulativeByYearMonth {
  /** Key = `${year}-${month}` → cumulato fine mese */
  [yearMonth: string]: number;
}

export interface CalculateThresholdsOptions {
  /** Lista di compensi mensili (già aggregati: coach+atleta+esterni di quel mese, solo > 0) */
  monthAmounts: MonthAmount[];
  /** Compenso pregresso all'inizio del contratto (per il primo anno) */
  priorCompensation?: number;
  /** Primo anno del contratto (anno in cui applicare il pregresso) */
  contractStartYear?: number;
}

export interface ThresholdsResult {
  thresholdsByYear: ThresholdsByYear;
  cumulativeByYearMonth: CumulativeByYearMonth;
}

/**
 * Calcola, per ogni anno, il primo mese in cui il cumulato supera €5K e €15K.
 * Ritorna anche il cumulato di fine mese per ogni `year-month` (utile per colorare).
 */
export function calculateThresholds({
  monthAmounts,
  priorCompensation = 0,
  contractStartYear,
}: CalculateThresholdsOptions): ThresholdsResult {
  const thresholdsByYear: ThresholdsByYear = {};
  const cumulativeByYearMonth: CumulativeByYearMonth = {};
  const cumByYear: Record<number, number> = {};

  // Ordina cronologicamente
  const sorted = [...monthAmounts]
    .filter(m => m.amount > 0 && m.month >= 1 && m.month <= 12)
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));

  // Traccia il "primo mese attivo" per anno per applicare il pregresso
  const firstActiveByYear: Record<number, number> = {};
  for (const r of sorted) {
    if (firstActiveByYear[r.year] === undefined) firstActiveByYear[r.year] = r.month;
  }

  for (const r of sorted) {
    if (!thresholdsByYear[r.year]) thresholdsByYear[r.year] = { first5k: null, first15k: null };
    if (cumByYear[r.year] === undefined) cumByYear[r.year] = 0;

    // Pregresso applicato SOLO al primo mese attivo del primo anno del contratto
    if (
      contractStartYear !== undefined &&
      r.year === contractStartYear &&
      r.month === firstActiveByYear[r.year] &&
      priorCompensation > 0
    ) {
      cumByYear[r.year] += priorCompensation;
    }

    cumByYear[r.year] += r.amount;
    cumulativeByYearMonth[`${r.year}-${r.month}`] = cumByYear[r.year];

    if (cumByYear[r.year] > 5000 && thresholdsByYear[r.year].first5k === null) {
      thresholdsByYear[r.year].first5k = r.month;
    }
    if (cumByYear[r.year] > 15000 && thresholdsByYear[r.year].first15k === null) {
      thresholdsByYear[r.year].first15k = r.month;
    }
  }

  return { thresholdsByYear, cumulativeByYearMonth };
}

/** Verifica se un mese è uguale o successivo al mese di superamento soglia in quell'anno. */
export function isMonthAfterThreshold(
  month: number,
  year: number,
  thresholdsByYear: ThresholdsByYear,
  type: '5k' | '15k',
): boolean {
  const t = thresholdsByYear[year];
  if (!t) return false;
  const m = type === '5k' ? t.first5k : t.first15k;
  if (m === null) return false;
  return month >= m;
}
