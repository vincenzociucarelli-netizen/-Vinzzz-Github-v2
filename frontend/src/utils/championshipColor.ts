// 🆕 13/09/2026 — Colore coerente e distinto per ogni campionato/squadra.
// Mappa deterministica: lo stesso nome campionato ottiene sempre lo stesso colore.
const PALETTE = [
  '#1565C0', // blu
  '#C62828', // rosso
  '#2E7D32', // verde
  '#6A1B9A', // viola
  '#EF6C00', // arancione
  '#00838F', // teal
  '#AD1457', // magenta
  '#4E342E', // marrone
  '#283593', // indaco
  '#558B2F', // verde oliva
  '#D84315', // arancio scuro
  '#00695C', // verde acqua
];

export function championshipColor(name?: string): string {
  const key = (name || '').trim().toLowerCase();
  if (!key) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) & 0x7fffffff;
  }
  return PALETTE[hash % PALETTE.length];
}
