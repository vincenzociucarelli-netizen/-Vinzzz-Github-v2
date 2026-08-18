/**
 * sharedGet — deduplica le richieste GET identiche.
 *
 * Problema (18/08/2026): più schermate admin (Atleti, Genitori, Ricerca, Prime
 * Squadre) chiamano ognuna `api.get('/athletes')` al mount. Quando sono montate
 * insieme partono 4 richieste identiche in parallelo → saturano il limite di
 * connessioni del browser e il singolo worker su Render (visibile nella tab
 * Network come /athletes ripetuta 4 volte, tutte a ~7-9s).
 *
 * Soluzione: una piccola cache in-process con:
 *  - dedup delle richieste CONCORRENTI (una sola chiamata di rete condivisa);
 *  - TTL breve (default 2.5s) per collassare il burst di apertura pagina,
 *    con staleness trascurabile (i refresh successivi ripartono dalla rete).
 *
 * Ritorna un oggetto { data } per essere un rimpiazzo drop-in di `api.get(url)`
 * nei punti che usano solo `res.data`.
 */
import api from './api';

const DEFAULT_TTL_MS = 2500;

const _cache = new Map<string, { ts: number; data: any }>();
const _inflight = new Map<string, Promise<any>>();

export async function sharedGet(url: string, ttlMs: number = DEFAULT_TTL_MS): Promise<{ data: any }> {
  const now = Date.now();
  const cached = _cache.get(url);
  if (cached && now - cached.ts < ttlMs) {
    return { data: cached.data };
  }
  const inflight = _inflight.get(url);
  if (inflight) {
    const data = await inflight;
    return { data };
  }
  const p = (async () => {
    try {
      const res = await api.get(url);
      _cache.set(url, { ts: Date.now(), data: res.data });
      return res.data;
    } finally {
      _inflight.delete(url);
    }
  })();
  _inflight.set(url, p);
  const data = await p;
  return { data };
}

/** Invalida la cache condivisa (tutta o per una singola URL). */
export function invalidateSharedGet(url?: string): void {
  if (url) _cache.delete(url);
  else _cache.clear();
}
