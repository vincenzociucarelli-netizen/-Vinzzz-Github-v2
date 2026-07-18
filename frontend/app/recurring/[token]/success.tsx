import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || '';

/**
 * 🆕 27/07/2026 — Pagina success dopo attivazione piano ricorrente.
 * Il webhook Stripe attiva il piano; qui facciamo polling.
 */
export default function RecurringSuccessPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'active' | 'completed' | 'pending' | 'error'>('checking');
  const [attempts, setAttempts] = useState(0);
  const [nextDate, setNextDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) return;
      try {
        const r = await axios.get(`${API}/api/public/recurring-plans/${token}/success-status`);
        if (cancelled) return;
        const s = r.data?.status;
        if (s === 'active' || s === 'completed') {
          setStatus(s);
          setNextDate(r.data?.next_charge_date || null);
        } else if (attempts < 8) {
          setTimeout(() => setAttempts(a => a + 1), 1500);
          setStatus('pending');
        } else {
          setStatus('pending');
        }
      } catch (_e) {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [token, attempts]);

  const isReady = status === 'active' || status === 'completed';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {status === 'checking' || (status === 'pending' && attempts < 8) ? (
          <>
            <ActivityIndicator size="large" color="#635BFF" />
            <Text style={styles.title}>Conferma in corso…</Text>
            <Text style={styles.subtitle}>Stripe sta confermando il pagamento. Non chiudere la pagina.</Text>
          </>
        ) : isReady ? (
          <>
            <View style={styles.iconOk}>
              <Ionicons name="checkmark-circle" size={72} color="#2E7D32" />
            </View>
            <Text style={styles.title}>Piano attivato! 🎉</Text>
            <Text style={styles.subtitle}>
              La 1ª rata è stata pagata con successo. La tua carta è stata memorizzata in modo sicuro.
            </Text>
            {status === 'active' && nextDate && (
              <View style={styles.nextBox}>
                <Ionicons name="calendar" size={20} color="#635BFF" />
                <Text style={styles.nextText}>
                  Prossimo addebito automatico:{'\n'}
                  <Text style={styles.nextDate}>{new Date(nextDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                </Text>
              </View>
            )}
            {status === 'completed' && (
              <View style={styles.nextBox}>
                <Ionicons name="trophy" size={20} color="#F9A825" />
                <Text style={styles.nextText}>Tutte le rate del piano sono state pagate.</Text>
              </View>
            )}
          </>
        ) : status === 'pending' ? (
          <>
            <Ionicons name="time" size={64} color="#F9A825" />
            <Text style={styles.title}>Conferma in ritardo</Text>
            <Text style={styles.subtitle}>
              Stripe potrebbe impiegare qualche minuto in più. Il tuo pagamento è stato ricevuto.
              Ricontrolla la scheda tra poco.
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="alert-circle" size={64} color="#C62828" />
            <Text style={styles.title}>Verifica non riuscita</Text>
            <Text style={styles.subtitle}>Contatta la segreteria della società.</Text>
          </>
        )}

        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            if (Platform.OS === 'web') window.close();
            else router.replace('/');
          }}
        >
          <Text style={styles.btnText}>Chiudi</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', maxWidth: 460, width: '100%', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  iconOk: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  nextBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F5F3FF',
    borderRadius: 10, padding: 14, marginTop: 10, width: '100%',
  },
  nextText: { flex: 1, fontSize: 13, color: '#5B4FDF', lineHeight: 18 },
  nextDate: { fontWeight: '700', fontSize: 15 },
  btn: { marginTop: 12, backgroundColor: '#635BFF', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  btnText: { color: '#fff', fontWeight: '700' },
});
