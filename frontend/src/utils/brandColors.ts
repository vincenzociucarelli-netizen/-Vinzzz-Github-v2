/**
 * 🆕 16/06/2026 — Colori del brand RegistraTEAM centralizzati.
 *
 * Unica sorgente di verità per i colori principali dell'applicazione.
 * Quando vuoi cambiare il blu primario, aggiungere un dark mode o
 * personalizzare il brand per società multi-tenant, basta toccare questo file.
 *
 * Linee guida:
 *  - PRIMARY = blu principale RegistraTEAM (banner, header dashboard, accent)
 *  - SUCCESS / WARNING / DANGER = stati semantici
 *  - INK = testi scuri su sfondo chiaro
 *  - SURFACE = sfondi cards/contenitori
 */

export const BRAND_COLORS = {
  /** Blu primario RegistraTEAM — usato per banner dashboard, header principali, link */
  primary: '#1565C0',
  primaryDark: '#0D47A1',
  primaryLight: '#E3F2FD',
  primarySoft: '#E8F4FD',

  /** Accent dorato (badge, evidenziazioni) */
  accentGold: '#FFD700',
  accentGoldDark: '#B8860B',

  /** Stati semantici */
  success: '#2E7D32',
  successSoft: '#E8F5E9',
  warning: '#F9A825',
  warningSoft: '#FFF8E1',
  danger: '#C62828',
  dangerSoft: '#FFEBEE',

  /** Testi (font color) */
  inkDark: '#1a1a2e',     // titoli, testi importanti su sfondo bianco
  inkBody: '#333333',     // corpo paragrafo
  inkMuted: '#666666',    // info secondarie
  inkSubtle: '#999999',   // placeholder, label

  /** Superfici */
  surfaceWhite: '#FFFFFF',
  surfacePage: '#F5F7FA',
  surfaceCard: '#FFFFFF',
  surfaceDivider: '#E0E0E0',
} as const;

export type BrandColorKey = keyof typeof BRAND_COLORS;
