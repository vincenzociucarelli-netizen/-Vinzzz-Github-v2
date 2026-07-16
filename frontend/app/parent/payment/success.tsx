import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../src/services/api';

/**
 * Pagina di conferma dopo il return dallo Stripe Checkout.
 * Il webhook aggiorna la rata a paid=true; questa pagina fa un doppio-controllo
 * client-side (in caso il webhook tardi) e mostra la conferma.
 */
export default function PaymentSuccessPage() {
  const params = useLocalSearchParams<{ session_id?: string; payment_id?: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'paid' | 'pending' | 'error'>('checking');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!params.payment_id || !params.session_id) {
        setStatus('error');
        return;
      }
      try {
        const res = await api.get(`/payments/${params.payment_id}/checkout/status`, {
          params: { session_id: params.session_id },
        });
        if (cancelled) return;
        if (res.data?.paid) {
          setStatus('paid');
        } else if (attempts < 5) {
          // Il webhook potrebbe tardare — riprova ogni 1.5s per 5 volte
          setTimeout(() => setAttempts(a => a + 1), 1500);
          setStatus('pending');
        } else {
          setStatus('pending');
        }
      } catch (_e) {
        if (!cancelled) setStatus('error');
      }
    };
    check();
    return () => { cancelled = true; };
  }, [params.payment_id, params.session_id, attempts]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {status === 'checking' || (status === 'pending' && attempts < 5) ? (
          <>
            <ActivityIndicator size="large" color="#635BFF" />
            <Text style={styles.title}>Verifica pagamento in corso…</Text>
            <Text style={styles.subtitle}>Non chiudere questa pagina.</Text>
          </>
        ) : status === 'paid' ? (
          <>
            <View style={styles.iconOk}>
              <Ionicons name="checkmark-circle" size={72} color="#2E7D32" />
            </View>
            <Text style={styles.title} data-testid="payment-success-title">Pagamento effettuato!</Text>
            <Text style={styles.subtitle}>
              La tua rata è stata registrata. Riceverai a breve la ricevuta via email.
            </Text>
          </>
        ) : status === 'pending' ? (
          <>
            <Ionicons name="time" size={64} color="#F9A825" />
            <Text style={styles.title}>Pagamento in elaborazione</Text>
            <Text style={styles.subtitle}>
              Stripe sta confermando la transazione. Ricontrolla la scheda tra qualche minuto.
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="alert-circle" size={64} color="#C62828" />
            <Text style={styles.title}>Verifica non riuscita</Text>
            <Text style={styles.subtitle}>
              Controlla la sezione Pagamenti nella scheda dell&apos;atleta.
            </Text>
          </>
        )}

        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.replace('/parent')}
          data-testid="payment-success-back-btn"
        >
          <Text style={styles.btnText}>Torna alla dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 28, alignItems: 'center',
    maxWidth: 460, width: '100%', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  iconOk: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  btn: { marginTop: 8, backgroundColor: '#635BFF', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
