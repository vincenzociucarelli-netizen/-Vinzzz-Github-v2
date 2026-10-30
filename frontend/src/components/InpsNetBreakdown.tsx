import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { computeInpsWithholding, formatEuro } from '../utils/inpsWithholding';

type Props = {
  /** Totale LORDO già maturato nell'anno PRIMA di questo compenso (quietanze + pregresso + esterni). */
  yearlyTotalBefore: number;
  /** Compenso lordo pattuito di questa erogazione (per il coach dual-role = somma coach + atleta). */
  monthGross: number;
  /** Lavoratore già iscritto ad altra previdenza obbligatoria. */
  insuredElsewhere?: boolean;
  /** Come viene chiamata la quota a carico (es. "tuo", "dell'atleta"). Default "tuo". */
  carico?: string;
};

/**
 * 🆕 Riepilogo "Superata la soglia €5.000 → netto".
 * Mostrato nella schermata di firma quando il compenso di questo mese supera
 * (in cumulo) la franchigia annua di €5.000. Se non supera, non renderizza nulla.
 * I valori rispecchiano il calcolo autorevole del backend stampato nella quietanza.
 */
export default function InpsNetBreakdown({
  yearlyTotalBefore,
  monthGross,
  insuredElsewhere = false,
  carico = 'tuo',
}: Props) {
  const bd = computeInpsWithholding(yearlyTotalBefore, monthGross, insuredElsewhere);
  if (!bd.applies) return null;

  const beforeTot = Math.max(0, yearlyTotalBefore || 0);
  const afterTot = beforeTot + Math.max(0, monthGross || 0);

  const rows: { label: string; value: string; deduct?: boolean }[] = [
    { label: 'Totale già maturato (prima di questo compenso)', value: formatEuro(beforeTot) },
    { label: 'Totale dopo questo compenso', value: formatEuro(afterTot) },
    { label: 'Compenso pattuito (lordo)', value: formatEuro(bd.amount_gross) },
    { label: 'Quota eccedente €5.000 (solo la parte oltre la soglia)', value: formatEuro(bd.excess_over_5000) },
    { label: "Imponibile previdenziale (50% dell'eccedenza)", value: formatEuro(bd.ivs_base) },
    { label: `Contributo IVS (${Math.round(bd.ivs_rate * 100)}% dell'imponibile)`, value: formatEuro(bd.ivs_contribution) },
  ];
  if (bd.minor_rate > 0) {
    rows.push({ label: `Aliquote aggiuntive (${(bd.minor_rate * 100).toFixed(2)}% sull'eccedenza)`, value: formatEuro(bd.minor_contribution) });
  }
  rows.push({ label: 'Contributo INPS totale dovuto', value: formatEuro(bd.inps_total) });
  rows.push({ label: `Trattenuta a carico ${carico} (1/3 del contributo)`, value: `- ${formatEuro(bd.inps_worker)}`, deduct: true });

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Superata la soglia €5.000 — dettaglio contributi INPS</Text>
      {rows.map((r, idx) => (
        <View key={r.label} style={[styles.row, { backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FDEFC2' }]}>
          <Text style={styles.label}>{r.label}</Text>
          <Text style={[styles.val, r.deduct && styles.deduct]}>{r.value}</Text>
        </View>
      ))}
      <View style={[styles.row, styles.rowTotal]}>
        <Text style={styles.labelBold}>Netto corrisposto</Text>
        <Text style={styles.valBold}>{formatEuro(bd.amount_net)}</Text>
      </View>
      <Text style={styles.note}>
        Importo effettivamente erogato. Il cumulo verso le soglie €5.000/€15.000 resta
        calcolato sul compenso lordo pattuito. I 2/3 restanti del contributo sono a carico della società.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFCC80',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginTop: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  rowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#FFCC80',
    marginTop: 4,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  label: { fontSize: 12, color: '#555', flex: 1, paddingRight: 8 },
  labelBold: { fontSize: 13, fontWeight: '700', color: '#333', flex: 1, paddingRight: 8 },
  val: { fontSize: 12, color: '#333', fontWeight: '600' },
  valBold: { fontSize: 14, color: '#2E7D32', fontWeight: '800' },
  deduct: { color: '#F44336' },
  note: { fontSize: 10, color: '#999', marginTop: 8, fontStyle: 'italic', lineHeight: 14 },
});
