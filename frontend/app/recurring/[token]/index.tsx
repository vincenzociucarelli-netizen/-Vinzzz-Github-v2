import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  ScrollView, Platform, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || '';

/**
 * 🆕 27/07/2026 — Landing pubblica per attivare un piano ricorrente.
 * Accessibile via link generato dall'admin. Nessuna autenticazione: solo il
 * token nel path fornisce l'accesso al piano.
 */
export default function RecurringLandingPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await axios.get(`${API}/api/public/recurring-plans/${token}`);
        setPlan(r.data);
      } catch (e: any) {
        setError(e?.response?.data?.detail || 'Link non valido o scaduto');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const activate = async () => {
    setActivating(true);
    try {
      const r = await axios.post(`${API}/api/public/recurring-plans/${token}/activate`);
      const url = r.data?.checkout_url;
      if (url && Platform.OS === 'web') {
        window.location.href = url;
      } else {
        setError('Impossibile aprire il checkout Stripe');
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Attivazione fallita');
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#635BFF" />
      </View>
    );
  }

  if (error && !plan) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle" size={64} color="#C62828" />
        <Text style={styles.errTitle}>Link non disponibile</Text>
        <Text style={styles.errMsg}>{error}</Text>
      </View>
    );
  }

  const isAlreadyActive = plan?.status && plan.status !== 'pending';
  const nextAmount = plan?.next_after_first_amount || 0;
  const restCount = (plan?.installments_count || 1) - 1;
  const freqText = plan?.frequency_type === 'fixed_day'
    ? `il ${plan?.fixed_day_of_month || 10} di ogni mese`
    : `ogni ${plan?.frequency_days || 30} giorni`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <View style={styles.card}>
        {/* Logo società */}
        <View style={styles.logoWrap}>
          {plan?.society_logo ? (
            <Image
              source={{ uri: plan.society_logo.startsWith('data:') ? plan.society_logo : `data:image/png;base64,${plan.society_logo}` }}
              style={styles.logo}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.logoFallbackTxt}>{(plan?.society_name || 'S').charAt(0)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.title}>Piano Pagamenti Automatici</Text>
        <Text style={styles.society}>{plan?.society_name}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>Atleta</Text>
        <Text style={styles.athlete} data-testid="recurring-athlete-name">{plan?.athlete_name || '—'}</Text>

        <Text style={styles.label}>Descrizione</Text>
        <Text style={styles.desc}>{plan?.description || 'Iscrizione'}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>Importo totale</Text>
        <Text style={styles.totalAmount}>€ {(plan?.total_amount || 0).toFixed(2)}</Text>

        <Text style={styles.label}>Piano</Text>
        <View style={styles.planBox}>
          <Text style={styles.planLine}>
            <Text style={styles.bold}>{plan?.installments_count}</Text> rate • {freqText}
          </Text>
          <View style={{ marginTop: 8 }}>
            {(plan?.installment_amounts || []).map((a: number, i: number) => (
              <View key={i} style={styles.rataRow}>
                <Text style={styles.rataLabel}>
                  {i === 0 ? '🔵 Oggi' : `📅 ${i === 1 ? 'Prossima' : `+${i}`}`}
                </Text>
                <Text style={styles.rataAmount}>€ {a.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#1565C0" />
          <Text style={styles.infoText}>
            Pagando la 1ª rata attivi il piano: la tua carta verrà memorizzata in modo
            sicuro e Stripe addebiterà automaticamente le rate successive alle date previste.
            Riceverai lo scontrino per ogni addebito.
          </Text>
        </View>

        {isAlreadyActive ? (
          <View style={styles.alreadyBox}>
            <Ionicons name="checkmark-circle" size={28} color="#2E7D32" />
            <Text style={styles.alreadyText}>
              Piano già {plan?.status === 'active' ? 'attivo' : plan?.status === 'completed' ? 'completato' : plan?.status}.
              {plan?.status === 'active' && ` Rate completate: ${plan?.charges_completed || 0}/${plan?.installments_count}`}
            </Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.activateBtn, activating && { opacity: 0.6 }]}
              onPress={activate}
              disabled={activating}
              data-testid="activate-recurring-btn"
            >
              {activating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="card" size={20} color="#fff" />
                  <Text style={styles.activateBtnTxt}>
                    Attiva e paga € {(plan?.first_charge_amount || 0).toFixed(2)}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.securedText}>🔒 Pagamento sicuro elaborato tramite Stripe</Text>
          </>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerTxt}>{error}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F5F7FA', gap: 12 },
  errTitle: { fontSize: 20, fontWeight: '700', color: '#333' },
  errMsg: { fontSize: 14, color: '#666', textAlign: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24, maxWidth: 500, width: '100%',
    alignSelf: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  logoWrap: { alignItems: 'center', marginBottom: 12 },
  logo: { width: 80, height: 80 },
  logoFallback: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#635BFF',
    alignItems: 'center', justifyContent: 'center',
  },
  logoFallbackTxt: { color: '#fff', fontSize: 32, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', textAlign: 'center', marginBottom: 4 },
  society: { fontSize: 13, color: '#666', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: '#EAEDF2', marginVertical: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 12 },
  athlete: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginTop: 2 },
  desc: { fontSize: 14, color: '#333', marginTop: 2 },
  totalAmount: { fontSize: 32, fontWeight: '800', color: '#635BFF', marginTop: 4 },
  planBox: { marginTop: 8 },
  planLine: { fontSize: 14, color: '#333' },
  bold: { fontWeight: '800' },
  rataRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  rataLabel: { fontSize: 13, color: '#555' },
  rataAmount: { fontSize: 14, fontWeight: '700', color: '#333' },
  infoBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#E3F2FD', borderRadius: 10, padding: 12, marginTop: 20, marginBottom: 8,
  },
  infoText: { flex: 1, fontSize: 12, color: '#1565C0', lineHeight: 17 },
  activateBtn: {
    marginTop: 16, backgroundColor: '#635BFF', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  activateBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  securedText: { fontSize: 11, color: '#999', textAlign: 'center', marginTop: 12 },
  alreadyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#E8F5E9',
    borderRadius: 10, padding: 14, marginTop: 16,
  },
  alreadyText: { flex: 1, fontSize: 14, color: '#2E7D32', fontWeight: '600' },
  errorBanner: { marginTop: 12, backgroundColor: '#FFEBEE', borderRadius: 8, padding: 12 },
  errorBannerTxt: { fontSize: 13, color: '#C62828' },
});
