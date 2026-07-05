/**
 * 🆕 05/07/2026 — Utility centrale per il calcolo della stagione sportiva.
 *
 * Ogni società può configurare in "Altre impostazioni → Stagione sportiva" il
 * mese e il giorno d'inizio della stagione (default: 1 luglio).
 *
 * Questa utility calcola la data di start della stagione CORRENTE in base
 * alle impostazioni ricevute dal backend (`/api/settings/society`) e alla
 * data odierna. Usare sempre queste funzioni invece di hard-code date.
 */

export interface SocietySeasonSettings {
  season_start_month?: number | null; // 1-12
  season_start_day?: number | null;   // 1-31
}

/**
 * Restituisce il Date d'inizio della stagione corrente in base alle impostazioni.
 * Se oggi ≥ data di start di quest'anno → stagione = anno corrente → anno successivo.
 * Altrimenti → stagione = anno precedente → anno corrente.
 */
export function getCurrentSeasonStart(settings?: SocietySeasonSettings, today?: Date): Date {
  const now = today || new Date();
  const startMonth = (settings?.season_start_month || 7) - 1; // 0-indexed
  const startDay = settings?.season_start_day || 1;
  const thisYearStart = new Date(now.getFullYear(), startMonth, startDay);
  return now >= thisYearStart ? thisYearStart : new Date(now.getFullYear() - 1, startMonth, startDay);
}

/**
 * Restituisce il nome della stagione corrente (es. "2025-2026") in base alle impostazioni.
 */
export function getCurrentSeasonName(settings?: SocietySeasonSettings, today?: Date): string {
  const start = getCurrentSeasonStart(settings, today);
  const y = start.getFullYear();
  return `${y}-${y + 1}`;
}

/**
 * True se la data (ISO stringa o Date) è ANTECEDENTE all'inizio della stagione corrente.
 * Usato per marcare pagamenti/eventi come "stagione precedente".
 */
export function isBeforeCurrentSeason(dateInput: string | Date | null | undefined, settings?: SocietySeasonSettings, today?: Date): boolean {
  if (!dateInput) return false;
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return false;
    return d < getCurrentSeasonStart(settings, today);
  } catch {
    return false;
  }
}
