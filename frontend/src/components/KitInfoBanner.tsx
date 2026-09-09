import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from './Icon';

interface Props {
  // Prezzi society-wide
  priceUnder?: number | string | null;
  priceMinivolley?: number | string | null;
  // Tipo kit scelto dalla squadra: 'under' | 'minivolley' | null
  kitType?: string | null;
  kitSponsor?: string | null;
  style?: any;
}

const toNum = (v?: number | string | null): number | null => {
  if (v == null) return null;
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
  return isNaN(n as number) ? null : (n as number);
};

// Banner informativo (society-wide) mostrato accanto alla quota.
// "Kit abbigliamento € X acquistabile presso il nostro sponsor tecnico Y"
// Il prezzo dipende dal tipo kit della squadra (Under o MiniVolley).
export default function KitInfoBanner({ priceUnder, priceMinivolley, kitType, kitSponsor, style }: Props) {
  const pUnder = toNum(priceUnder);
  const pMini = toNum(priceMinivolley);
  const type = (kitType || '').toLowerCase();

  let price: number | null;
  let label = '';
  if (type === 'minivolley') {
    price = pMini;
    label = ' (MiniVolley)';
  } else if (type === 'under') {
    price = pUnder;
    label = ' (Under)';
  } else {
    // Nessun tipo scelto: mostra il prezzo Under se presente, altrimenti MiniVolley
    price = pUnder != null ? pUnder : pMini;
    label = '';
  }

  const hasPrice = price != null && price > 0;
  const sponsor = (kitSponsor || '').trim();
  if (!hasPrice && !sponsor) return null;

  return (
    <View style={[styles.card, style]} testID="kit-info-banner">
      <Ionicons name="shirt-outline" size={20} color="#1565C0" style={{ marginTop: 1 }} />
      <Text style={styles.text}>
        <Text style={styles.bold}>Kit abbigliamento</Text>
        {hasPrice ? <Text> € {Number(price).toFixed(2).replace('.', ',')}{label}</Text> : null}
        {sponsor ? (
          <Text> acquistabile presso il nostro sponsor tecnico <Text style={styles.bold}>{sponsor}</Text></Text>
        ) : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBDEFB',
    padding: 12,
    marginBottom: 16,
  },
  text: { flex: 1, fontSize: 13.5, color: '#0D47A1', lineHeight: 20 },
  bold: { fontWeight: '700' },
});
