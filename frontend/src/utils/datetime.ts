/**
 * 🆕 28/09/2026 — Utility fuso orario Europe/Rome.
 *
 * Il backend gira in UTC e salva molti timestamp come stringhe ISO "naive"
 * (senza suffisso 'Z', es. "2026-09-29T05:28:00"). Se il frontend le passa a
 * `new Date(...)` vengono interpretate come ora LOCALE del browser → l'orario
 * risulta sfasato (mostra l'ora UTC invece di quella di Roma).
 *
 * Queste funzioni:
 *  - se la stringa NON ha fuso (no 'Z', no '+hh:mm') la trattano come UTC (append 'Z');
 *  - poi formattano SEMPRE con timeZone 'Europe/Rome'.
 *
 * NB: NON usare per gli orari delle PARTITE (salvati come wall-clock UTC e mostrati
 * volutamente con timeZone:'UTC') né per le date di nascita.
 */

const ROME = 'Europe/Rome';

const toDate = (value: string | number | Date | null | undefined): Date | null => {
  if (value == null || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  let s = String(value);
  // Se manca il fuso orario (no Z e no offset +hh:mm / -hh:mm), assumiamo UTC.
  if (!/[zZ]$/.test(s) && !/[+-]\d{2}:?\d{2}$/.test(s)) {
    s = s + 'Z';
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

/** Data + ora in ora di Roma: "29/09/2026 07:28" */
export const formatRomeDateTime = (value: any, fallback = '—'): string => {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: ROME,
  });
};

/** Solo ora in ora di Roma: "07:28" */
export const formatRomeTime = (value: any, fallback = ''): string => {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleTimeString('it-IT', {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: ROME,
  });
};

/** Solo data in ora di Roma: "29/09/2026" */
export const formatRomeDate = (value: any, fallback = '—'): string => {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: ROME,
  });
};

/** Data lunga in ora di Roma: "29 settembre 2026" */
export const formatRomeDateLong = (value: any, fallback = '—'): string => {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString('it-IT', {
    day: '2-digit', month: 'long', year: 'numeric',
    timeZone: ROME,
  });
};

/** Data con giorno settimana in ora di Roma: "lunedì 29 settembre 2026" */
export const formatRomeWeekdayLong = (value: any, fallback = '—'): string => {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: ROME,
  });
};
