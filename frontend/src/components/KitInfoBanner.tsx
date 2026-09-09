import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from './Icon';

interface Props {
  kitPrice?: number | string | null;
  kitSponsor?: string | null;
  style?: any;
}

// Banner informativo (society-wide) mostrato accanto alla quota.
// "Kit abbigliamento € X acquistabile presso il nostro sponsor tecnico Y"
export default function KitInfoBanner({ kitPrice, kitSponsor, style }: Props) {
  const price = typeof kitPrice === 'string' ? parseFloat(kitPrice) : kitPrice;
  const hasPrice = price != null && !isNaN(price as number) && (price as number) > 0;
  const sponsor = (kitSponsor || '').trim();
  if (!hasPrice && !sponsor) return null;

  return (
    <View style={[styles.card, style]} testID="kit-info-banner">
      <Ionicons name="shirt-outline" size={20} color="#1565C0" style={{ marginTop: 1 }} />
      <Text style={styles.text}>
        <Text style={styles.bold}>Kit abbigliamento</Text>
        {hasPrice ? <Text> € {Number(price).toFixed(2).replace('.', ',')}</Text> : null}
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
