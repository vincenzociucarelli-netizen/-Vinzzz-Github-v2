import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from './Icon';
import api from '../services/api';

interface PendingReceipt {
  role: string;
  year: number;
  month: number;
  month_name: string;
  amount: number;
}

interface Props {
  /** Rotta della schermata dove l'utente firma la quietanza (es. "/coach/compensation") */
  signRoute?: string;
}

/**
 * 🆕 Avviso "Firma la quietanza di [mese]" per la home del destinatario.
 * Appare SOLO quando l'admin ha segnato il bonifico (payment_made) e la
 * quietanza non è ancora firmata. Si nasconde da solo se non c'è nulla.
 */
export default function PendingReceiptNotice({ signRoute }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<PendingReceipt[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/me/receipts/pending-signature');
      setItems(res.data || []);
    } catch {
      setItems([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!items.length) return null;

  const go = () => { if (signRoute) router.push(signRoute as any); };

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Ionicons name="create" size={18} color="#E65100" />
        <Text style={styles.title}>Quietanze da firmare</Text>
      </View>
      <Text style={styles.sub}>È stato effettuato il bonifico. Firma al più presto {items.length === 1 ? 'la quietanza' : 'le quietanze'}:</Text>
      {items.map((r, i) => (
        <View key={`${r.year}-${r.month}-${i}`} style={styles.row}>
          <Ionicons name="document-text-outline" size={15} color="#8D6E00" />
          <Text style={styles.rowText}>{r.month_name} {r.year} — €{Number(r.amount || 0).toLocaleString('it-IT')}</Text>
        </View>
      ))}
      {!!signRoute && (
        <TouchableOpacity style={styles.btn} onPress={go}>
          <Ionicons name="pencil" size={15} color="#fff" />
          <Text style={styles.btnText}>Firma ora</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFF8E1', borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 5, borderLeftColor: '#FB8C00' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  title: { fontSize: 15, fontWeight: '800', color: '#E65100' },
  sub: { fontSize: 13, color: '#8D6E00', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  rowText: { fontSize: 13.5, color: '#5D4037', fontWeight: '600' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FB8C00', paddingVertical: 10, borderRadius: 8, marginTop: 10 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
