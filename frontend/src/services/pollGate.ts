/**
 * pollGate — utilità condivise per ridurre il traffico di rete dei poller globali.
 *
 * Problema (18/08/2026): più componenti globali (montati in admin/_layout) facevano
 * polling ravvicinato e chiamavano ognuno `/admin/primary-admin/status`, saturando
 * il limite di connessioni del browser + il singolo worker su Render → pagine lente
 * (richieste in coda fino a 7s).
 *
 * Soluzioni:
 *  1) getPrimaryAdminStatusCached(): una sola chiamata a /admin/primary-admin/status
 *     ogni CACHE_TTL, condivisa fra tutti i componenti (dedup anche delle chiamate
 *     concorrenti in volo).
 *  2) isTabActive(): permette ai poller di saltare le richieste quando la scheda del
 *     browser non è in primo piano (nessun senso interrogare il server se nessuno
 *     sta guardando).
 */
import api from './api';

const CACHE_TTL_MS = 60000; // 60s: primary-admin status cambia molto di rado

let _cache: { ts: number; data: any } | null = null;
let _inflight: Promise<any> | null = null;

export async function getPrimaryAdminStatusCached(): Promise<any> {
  const now = Date.now();
  if (_cache && now - _cache.ts < CACHE_TTL_MS) {
    return _cache.data;
  }
  if (_inflight) {
    return _inflight;
  }
  _inflight = (async () => {
    try {
      const res = await api.get('/admin/primary-admin/status');
      _cache = { ts: Date.now(), data: res.data || {} };
      return _cache.data;
    } catch {
      // In caso di errore non blocchiamo i poller: restituiamo un oggetto vuoto
      // (i chiamanti trattano l'assenza del flag come "non sopprimere").
      _cache = { ts: Date.now(), data: {} };
      return _cache.data;
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

/** Invalida la cache (es. dopo che l'admin firma la dichiarazione). */
export function invalidatePrimaryAdminStatus(): void {
  _cache = null;
}

/** True se la scheda del browser è attiva/visibile (o su mobile, sempre true). */
export function isTabActive(): boolean {
  try {
    if (typeof document !== 'undefined' && typeof document.visibilityState === 'string') {
      return document.visibilityState === 'visible';
    }
  } catch {
    // ignore
  }
  return true;
}
