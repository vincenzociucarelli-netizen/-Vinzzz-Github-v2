/**
 * 🆕 15/06/2026 — Colori condivisi per le soglie compensi €5K/€15K (Riforma Sport).
 *
 * Unica sorgente di verità: quando cambia la palette, basta toccare questo file
 * e tutti i punti (athlete/coach/collaboratore/dirigente + admin Hub Compensi)
 * si allineano.
 */

export const THRESHOLD_COLORS = {
  /** Cumulato sotto €5.000 — nessuna soglia raggiunta */
  under5k: {
    background: '#E8F5E9',
    border: '#A5D6A7',
    text: '#2E7D32',
    accent: '#4CAF50',
  },
  /** Cumulato tra €5.001 e €15.000 — soglia INPS superata */
  between5k15k: {
    background: '#FFF8E1',
    border: '#F9A825',
    text: '#F57F17',
    accent: '#FF9800',
  },
  /** Cumulato oltre €15.000 — soglia IRPEF superata */
  over15k: {
    background: '#F3E5F5',
    border: '#CE93D8',
    text: '#6A1B9A',
    accent: '#8E44AD',
  },
} as const;

/** Stato soglia in base al cumulato. */
export type ThresholdState = 'under5k' | 'between5k15k' | 'over15k';

export function getThresholdState(cumulative: number): ThresholdState {
  if (cumulative > 15000) return 'over15k';
  if (cumulative > 5000) return 'between5k15k';
  return 'under5k';
}

/** Restituisce la palette di colori in base al cumulato. */
export function getThresholdPalette(cumulative: number) {
  return THRESHOLD_COLORS[getThresholdState(cumulative)];
}
