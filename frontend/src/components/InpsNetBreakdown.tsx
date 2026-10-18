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

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Superata la soglia €5.000 — dettaglio contributi INPS</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Compenso pattuito (lordo)</Text>
        <Text style={styles.val}>{formatEuro(bd.amount_gross)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Quota eccedente €5.000</Text>
        <Text style={styles.val}>{formatEuro(bd.excess_over_5000)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Imponibile previdenziale (50% dell'eccedenza)</Text>
        <Text style={styles.val}>{formatEuro(bd.ivs_base)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Contributo IVS ({Math.round(bd.ivs_rate * 100)}% dell'imponibile)</Text>
        <Text style={styles.val}>{formatEuro(bd.ivs_contribution)}</Text>
      </View>
      {bd.minor_rate > 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>Aliquote aggiuntive ({(bd.minor_rate * 100).toFixed(2)}% sull'eccedenza)</Text>
          <Text style={styles.val}>{formatEuro(bd.minor_contribution)}</Text>
        </View>
      )}
      <View style={styles.row}>
        <Text style={styles.label}>Contributo INPS totale dovuto</Text>
        <Text style={styles.val}>{formatEuro(bd.inps_total)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Trattenuta a carico {carico} (1/3 del contributo)</Text>
        <Text style={[styles.val, styles.deduct]}>- {formatEuro(bd.inps_worker)}</Text>
      </View>
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
    padding: 12,
    marginTop: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  rowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#FFCC80',
    marginTop: 4,
    paddingTop: 6,
  },
  label: { fontSize: 12, color: '#555', flex: 1, paddingRight: 8 },
  labelBold: { fontSize: 13, fontWeight: '700', color: '#333', flex: 1, paddingRight: 8 },
  val: { fontSize: 12, color: '#333', fontWeight: '600' },
  valBold: { fontSize: 14, color: '#2E7D32', fontWeight: '800' },
  deduct: { color: '#F44336' },
  note: { fontSize: 10, color: '#999', marginTop: 8, fontStyle: 'italic', lineHeight: 14 },
});
