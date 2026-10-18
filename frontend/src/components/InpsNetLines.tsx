import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { computeInpsWithholding, formatEuro } from '../utils/inpsWithholding';

type Props = {
  yearlyTotalBefore: number;
  monthGross: number;
  insuredElsewhere?: boolean;
  carico?: string;
};

/**
 * 🆕 Righe NETTO compatte da inserire DENTRO l'anteprima quietanza (riquadro grigio).
 * Mostra Quota eccedente €5.000 / Contributi INPS (1/3) / Netto corrisposto.
 * Non renderizza nulla se il compenso non supera (in cumulo) la franchigia.
 */
export default function InpsNetLines({
  yearlyTotalBefore,
  monthGross,
  insuredElsewhere = false,
  carico = 'tuo',
}: Props) {
  const bd = computeInpsWithholding(yearlyTotalBefore, monthGross, insuredElsewhere);
  if (!bd.applies) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>Quota eccedente €5.000</Text>
        <Text style={styles.val}>{formatEuro(bd.excess_over_5000)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Contributi INPS (quota a carico {carico}, 1/3)</Text>
        <Text style={[styles.val, styles.deduct]}>- {formatEuro(bd.inps_worker)}</Text>
      </View>
      <View style={[styles.row, styles.rowTotal]}>
        <Text style={styles.labelBold}>Netto corrisposto</Text>
        <Text style={styles.valBold}>{formatEuro(bd.amount_net)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  rowTotal: { marginTop: 2, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 4 },
  label: { fontSize: 11, color: '#555', flex: 1, paddingRight: 8 },
  labelBold: { fontSize: 12, fontWeight: '700', color: '#333', flex: 1, paddingRight: 8 },
  val: { fontSize: 11, color: '#333', fontWeight: '600' },
  valBold: { fontSize: 13, color: '#2E7D32', fontWeight: '800' },
  deduct: { color: '#F44336' },
});
