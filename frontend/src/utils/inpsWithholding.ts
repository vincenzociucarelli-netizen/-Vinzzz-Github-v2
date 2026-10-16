// 🆕 Calcolo trattenuta INPS Gestione Separata — Riforma Sport (lato client).
// Rispecchia ESATTAMENTE compute_sport_inps_withholding() del backend (server.py).
// Usato SOLO per mostrare in anteprima il riepilogo lordo → trattenuta → netto
// nella schermata di firma. Il valore autorevole resta quello calcolato dal
// backend e stampato nella quietanza PDF.

export const INPS_FRANCHIGIA = 5000.0;
export const INPS_IVS_RATE_DEFAULT = 0.25; // NON iscritti ad altra previdenza
export const INPS_IVS_RATE_INSURED = 0.24; // già iscritti ad altra previdenza
export const INPS_MINOR_RATE = 0.0203; // aliquote minori (solo NON iscritti altrove)
export const INPS_IVS_REDUCTION = 0.5; // riduzione 50% base IVS (fino 31/12/2027)
export const INPS_WORKER_SHARE = 1 / 3;

export type InpsBreakdown = {
  applies: boolean;
  amount_gross: number;
  excess_over_5000: number;
  inps_total: number;
  inps_worker: number;
  inps_employer: number;
  amount_net: number;
  insured_elsewhere: boolean;
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * @param yearlyTotalBeforeGross totale LORDO già maturato nell'anno PRIMA di questo compenso
 * @param paymentGross compenso lordo pattuito di questa erogazione
 * @param insuredElsewhere lavoratore già iscritto ad altra previdenza obbligatoria
 */
export function computeInpsWithholding(
  yearlyTotalBeforeGross: number,
  paymentGross: number,
  insuredElsewhere = false
): InpsBreakdown {
  const ivsRate = insuredElsewhere ? INPS_IVS_RATE_INSURED : INPS_IVS_RATE_DEFAULT;
  const minorRate = insuredElsewhere ? 0 : INPS_MINOR_RATE;

  const before = Math.max(0, yearlyTotalBeforeGross || 0);
  const gross = Math.max(0, paymentGross || 0);
  const after = before + gross;
  let excess = Math.max(0, after - INPS_FRANCHIGIA) - Math.max(0, before - INPS_FRANCHIGIA);
  excess = r2(Math.min(Math.max(0, excess), gross));

  if (excess <= 0) {
    return {
      applies: false,
      amount_gross: r2(gross),
      excess_over_5000: 0,
      inps_total: 0,
      inps_worker: 0,
      inps_employer: 0,
      amount_net: r2(gross),
      insured_elsewhere: insuredElsewhere,
    };
  }

  const ivsBase = excess * INPS_IVS_REDUCTION;
  const ivsContribution = ivsBase * ivsRate;
  const minorContribution = excess * minorRate;
  const inpsTotal = ivsContribution + minorContribution;
  const inpsWorker = r2(inpsTotal * INPS_WORKER_SHARE);
  const inpsEmployer = r2(inpsTotal - inpsWorker);
  const amountNet = r2(gross - inpsWorker);

  return {
    applies: true,
    amount_gross: r2(gross),
    excess_over_5000: r2(excess),
    inps_total: r2(inpsTotal),
    inps_worker: inpsWorker,
    inps_employer: inpsEmployer,
    amount_net: amountNet,
    insured_elsewhere: insuredElsewhere,
  };
}

export const formatEuro = (n: number) =>
  `€ ${(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
