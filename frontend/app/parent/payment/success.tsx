import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../src/services/api';

/**
 * Pagina di conferma dopo il return dallo Stripe Checkout.
 * Il webhook aggiorna la rata a paid=true; questa pagina fa un doppio-controllo
 * client-side (in caso il webhook tardi) e mostra la conferma.
 * 🆕 26/07/2026 — Bottone "Scarica scontrino" stile Nexi appena il pagamento è confermato.
 */
export default function PaymentSuccessPage() {
  const params = useLocalSearchParams<{ session_id?: string; payment_id?: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'paid' | 'pending' | 'error'>('checking');
  const [attempts, setAttempts] = useState(0);
  const [openingReceipt, setOpeningReceipt] = useState(false);

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

  const openReceipt = async () => {
    if (!params.payment_id) return;
    setOpeningReceipt(true);
    try {
      // Recupera l'HTML dello scontrino con il token nell'header via api client
      const res = await api.get(`/payments/${params.payment_id}/receipt`, {
        responseType: 'text',
        transformResponse: [(d: any) => d],
      });
      const html = typeof res.data === 'string' ? res.data : String(res.data);
      if (Platform.OS === 'web') {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (!win) {
          // Popup bloccato — fallback: download link
          const a = document.createElement('a');
          a.href = url;
          a.download = `scontrino_${params.payment_id}.html`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Impossibile aprire lo scontrino';
      if (Platform.OS === 'web') window.alert(msg);
    } finally {
      setOpeningReceipt(false);
    }
  };

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
              La tua rata è stata registrata. Scarica lo scontrino per il tuo archivio.
            </Text>

            <TouchableOpacity
              style={[styles.receiptBtn, openingReceipt && { opacity: 0.6 }]}
              onPress={openReceipt}
              disabled={openingReceipt}
              data-testid="download-receipt-btn"
            >
              {openingReceipt ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="receipt" size={18} color="#fff" />
                  <Text style={styles.receiptBtnText}>Scarica scontrino</Text>
                </>
              )}
            </TouchableOpacity>
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
  receiptBtn: {
    marginTop: 4, backgroundColor: '#2E7D32', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  receiptBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
