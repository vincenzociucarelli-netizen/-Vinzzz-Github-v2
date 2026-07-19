import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '../../../../src/components/Icon';
import api from '../../../../src/services/api';

/**
 * 🆕 27/07/2026 — Admin: crea/gestisci piano ricorrente per un atleta.
 * Solo un piano attivo alla volta per atleta.
 */
export default function AdminRecurringPlanPage() {
  const { athleteId } = useLocalSearchParams<{ athleteId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [athlete, setAthlete] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);

  // Form state
  const [totalAmount, setTotalAmount] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState('3');
  const [firstAmount, setFirstAmount] = useState('');
  const [otherAmount, setOtherAmount] = useState('');
  const [frequencyType, setFrequencyType] = useState<'fixed_day' | 'days_from_previous'>('fixed_day');
  const [fixedDay, setFixedDay] = useState('10');
  const [frequencyDays, setFrequencyDays] = useState('30');
  const [description, setDescription] = useState('Iscrizione stagione');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!athleteId) return;
      try {
        const [aRes, pRes] = await Promise.all([
          api.get(`/admin/athletes/${athleteId}`).catch(() => api.get(`/athletes/${athleteId}`)),
          api.get(`/admin/recurring-plans/athlete/${athleteId}`),
        ]);
        setAthlete(aRes.data);
        setPlans(pRes.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [athleteId]);

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
    else Alert.alert(title, msg);
  };

  // Auto-riparti importi rate quando cambiano totale + numero
  useEffect(() => {
    const tot = parseFloat(totalAmount) || 0;
    const n = parseInt(installmentsCount) || 0;
    if (tot > 0 && n >= 2) {
      const equal = +(tot / n).toFixed(2);
      setFirstAmount(String(equal));
      setOtherAmount(String(equal));
    }
  }, [totalAmount, installmentsCount]);

  const handleCreate = async () => {
    const tot = parseFloat(totalAmount);
    const n = parseInt(installmentsCount);
    const first = parseFloat(firstAmount);
    const other = parseFloat(otherAmount);
    if (!tot || tot <= 0) return showAlert('Attenzione', 'Importo totale non valido');
    if (!n || n < 2 || n > 24) return showAlert('Attenzione', 'Numero rate deve essere tra 2 e 24');
    if (!first || first <= 0) return showAlert('Attenzione', 'Importo 1ª rata non valido');
    if (!other || other <= 0) return showAlert('Attenzione', 'Importo rate successive non valido');

    // Costruisci array importi: prima = first, seconde..ultima = other, tranne l'ultima che aggiusta arrotondamento
    const amounts: number[] = [first];
    for (let i = 1; i < n - 1; i++) amounts.push(other);
    const last = +(tot - amounts.reduce((s, a) => s + a, 0)).toFixed(2);
    amounts.push(last);
    if (last <= 0) return showAlert('Attenzione', 'La somma delle rate supera il totale');

    setSaving(true);
    try {
      const payload = {
        athlete_id: athleteId,
        total_amount: tot,
        installments_count: n,
        installment_amounts: amounts,
        frequency_type: frequencyType,
        fixed_day_of_month: parseInt(fixedDay) || 10,
        frequency_days: parseInt(frequencyDays) || 30,
        description: description.trim() || 'Iscrizione',
      };
      const r = await api.post('/admin/recurring-plans', payload);
      const link = `${window.location.origin}${r.data.activation_path}`;
      setGeneratedLink(link);
      // reload lista
      const pRes = await api.get(`/admin/recurring-plans/athlete/${athleteId}`);
      setPlans(pRes.data || []);
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Impossibile creare il piano');
    } finally {
      setSaving(false);
    }
  };

  const cancelPlan = async (planId: string) => {
    if (Platform.OS === 'web' && !window.confirm('Cancellare questo piano? Le rate classiche verranno sbloccate.')) return;
    try {
      await api.post(`/admin/recurring-plans/${planId}/cancel`, { reason: 'Cancellato manualmente da admin' });
      const pRes = await api.get(`/admin/recurring-plans/athlete/${athleteId}`);
      setPlans(pRes.data || []);
      showAlert('OK', 'Piano cancellato.');
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Impossibile cancellare');
    }
  };

  const chargeNow = async (planId: string) => {
    if (Platform.OS === 'web' && !window.confirm('Eseguire SUBITO il prossimo addebito? Verrà charged la carta salvata.')) return;
    try {
      const r = await api.post(`/admin/recurring-plans/${planId}/charge-now`);
      showAlert('Addebito eseguito', r.data?.message || 'OK');
      const pRes = await api.get(`/admin/recurring-plans/athlete/${athleteId}`);
      setPlans(pRes.data || []);
    } catch (e: any) {
      showAlert('Errore addebito', e?.response?.data?.detail || 'Fallito');
    }
  };

  const copyLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      showAlert('Copiato', 'Link copiato negli appunti. Inviarlo al genitore.');
    } catch {
      showAlert('Link', generatedLink);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#635BFF" />
      </View>
    );
  }

  const activePlan = plans.find(p => ['pending', 'active', 'paused'].includes(p.status));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace(`/admin/athlete/${athleteId}`))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Piano Ricorrente Automatico</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <View style={styles.athleteBox}>
          <Ionicons name="person-circle" size={40} color="#635BFF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.athleteName}>{athlete?.full_name || athlete?.first_name + ' ' + athlete?.last_name}</Text>
            <Text style={styles.athleteSub}>Piano di pagamento con addebito automatico Stripe</Text>
          </View>
        </View>

        {/* Piani esistenti */}
        {plans.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Piani esistenti</Text>
            {plans.map((p: any) => (
              <View key={p.id} style={styles.planCard}>
                <View style={styles.planHeader}>
                  <View>
                    <Text style={styles.planTitle}>{p.description}</Text>
                    <Text style={styles.planMeta}>
                      € {p.total_amount.toFixed(2)} • {p.installments_count} rate
                    </Text>
                  </View>
                  <View style={[styles.badge, {
                    backgroundColor: p.status === 'active' ? '#E8F5E9'
                      : p.status === 'pending' ? '#FFF3E0'
                      : p.status === 'completed' ? '#E3F2FD'
                      : p.status === 'cancelled' ? '#FFEBEE'
                      : '#F5F5F5',
                  }]}>
                    <Text style={[styles.badgeTxt, {
                      color: p.status === 'active' ? '#2E7D32'
                        : p.status === 'pending' ? '#EF6C00'
                        : p.status === 'completed' ? '#1565C0'
                        : p.status === 'cancelled' ? '#C62828'
                        : '#666',
                    }]}>
                      {p.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.planDetail}>
                  Progresso: <Text style={styles.bold}>{p.charges_completed}/{p.installments_count}</Text>
                </Text>
                {p.next_charge_date && (
                  <Text style={styles.planDetail}>
                    Prossimo addebito: <Text style={styles.bold}>
                      {new Date(p.next_charge_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                  </Text>
                )}
                {p.charges && p.charges.length > 0 && (
                  <View style={styles.chargesList}>
                    {p.charges.map((c: any) => (
                      <View key={c.id} style={styles.chargeRow}>
                        <Ionicons
                          name={c.status === 'succeeded' ? 'checkmark-circle' : c.status === 'failed' ? 'close-circle' : 'time'}
                          size={16}
                          color={c.status === 'succeeded' ? '#2E7D32' : c.status === 'failed' ? '#C62828' : '#F9A825'}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.chargeTxt}>
                            Rata {c.installment_number}: € {c.amount.toFixed(2)} — {c.status}
                            {c.succeeded_at && ` (${new Date(c.succeeded_at).toLocaleDateString('it-IT')})`}
                          </Text>
                          {c.status === 'failed' && c.failure_reason && (
                            <Text style={{ fontSize: 10, color: '#C62828', marginTop: 2 }}>
                              {c.failure_reason}
                            </Text>
                          )}
                        </View>
                        {c.status === 'failed' && (
                          <TouchableOpacity
                            onPress={async () => {
                              if (Platform.OS === 'web' && !window.confirm('Ritentare questo addebito ora?')) return;
                              try {
                                const r = await api.post(`/admin/recurring-plans/${p.id}/charges/${c.id}/retry`);
                                showAlert('Ritentato', r.data?.message || 'OK');
                                const pRes = await api.get(`/admin/recurring-plans/athlete/${athleteId}`);
                                setPlans(pRes.data || []);
                              } catch (e: any) {
                                showAlert('Errore', e?.response?.data?.detail || 'Retry fallito');
                              }
                            }}
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 3,
                              backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 4,
                              borderRadius: 6,
                            }}
                            data-testid={`retry-charge-${c.id}`}
                          >
                            <Ionicons name="refresh" size={12} color="#EF6C00" />
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#EF6C00' }}>Ritenta</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}
                {p.status === 'pending' && (
                  <View style={styles.linkBox}>
                    <Text style={styles.linkLabel}>🔗 Link di attivazione per il genitore:</Text>
                    <Text style={styles.linkTxt} selectable>{window.location.origin}/recurring/{p.activation_token}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        const link = `${window.location.origin}/recurring/${p.activation_token}`;
                        navigator.clipboard?.writeText(link);
                        showAlert('Copiato', 'Link copiato');
                      }}
                      style={styles.copyBtn}
                    >
                      <Ionicons name="copy" size={14} color="#635BFF" />
                      <Text style={styles.copyBtnTxt}>Copia link</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.planActions}>
                  {p.status === 'active' && (
                    <TouchableOpacity
                      onPress={() => chargeNow(p.id)}
                      style={[styles.actionBtn, { backgroundColor: '#FFF3E0' }]}
                      data-testid={`plan-charge-now-${p.id}`}
                    >
                      <Ionicons name="flash" size={14} color="#EF6C00" />
                      <Text style={[styles.actionBtnTxt, { color: '#EF6C00' }]}>Esegui subito prossimo addebito</Text>
                    </TouchableOpacity>
                  )}
                  {['pending', 'active', 'paused'].includes(p.status) && (
                    <TouchableOpacity
                      onPress={() => cancelPlan(p.id)}
                      style={[styles.actionBtn, { backgroundColor: '#FFEBEE' }]}
                      data-testid={`plan-cancel-${p.id}`}
                    >
                      <Ionicons name="close-circle" size={14} color="#C62828" />
                      <Text style={[styles.actionBtnTxt, { color: '#C62828' }]}>Cancella piano</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Form nuovo piano — solo se non c'è piano attivo/pending */}
        {!activePlan && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Crea nuovo piano</Text>
            <Text style={styles.hint}>
              Le rate classiche non pagate ereditate dalla squadra verranno sospese all&apos;attivazione del piano da parte del genitore.
            </Text>

            <Text style={styles.label}>Importo totale (€)</Text>
            <TextInput
              style={styles.input}
              value={totalAmount}
              onChangeText={setTotalAmount}
              keyboardType="decimal-pad"
              placeholder="es. 10.00"
              data-testid="plan-total-input"
            />

            <Text style={styles.label}>Numero di rate</Text>
            <TextInput
              style={styles.input}
              value={installmentsCount}
              onChangeText={setInstallmentsCount}
              keyboardType="numeric"
              data-testid="plan-installments-input"
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>1ª rata (€)</Text>
                <TextInput
                  style={styles.input}
                  value={firstAmount}
                  onChangeText={setFirstAmount}
                  keyboardType="decimal-pad"
                  data-testid="plan-first-input"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Rate successive (€)</Text>
                <TextInput
                  style={styles.input}
                  value={otherAmount}
                  onChangeText={setOtherAmount}
                  keyboardType="decimal-pad"
                  data-testid="plan-other-input"
                />
              </View>
            </View>

            <Text style={styles.label}>Frequenza</Text>
            <View style={styles.freqRow}>
              <TouchableOpacity
                style={[styles.freqBtn, frequencyType === 'fixed_day' && styles.freqBtnActive]}
                onPress={() => setFrequencyType('fixed_day')}
                data-testid="freq-fixed-btn"
              >
                <Text style={[styles.freqTxt, frequencyType === 'fixed_day' && styles.freqTxtActive]}>Il giorno X del mese</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.freqBtn, frequencyType === 'days_from_previous' && styles.freqBtnActive]}
                onPress={() => setFrequencyType('days_from_previous')}
                data-testid="freq-days-btn"
              >
                <Text style={[styles.freqTxt, frequencyType === 'days_from_previous' && styles.freqTxtActive]}>Ogni N giorni</Text>
              </TouchableOpacity>
            </View>

            {frequencyType === 'fixed_day' ? (
              <>
                <Text style={styles.label}>Giorno del mese</Text>
                <TextInput
                  style={styles.input}
                  value={fixedDay}
                  onChangeText={setFixedDay}
                  keyboardType="numeric"
                  placeholder="10"
                  data-testid="fixed-day-input"
                />
                <Text style={styles.hint}>Se il mese non ha quel giorno (es. 31 feb), addebito posticipato al giorno più vicino disponibile.</Text>
              </>
            ) : (
              <>
                <Text style={styles.label}>Giorni tra un addebito e l&apos;altro</Text>
                <TextInput
                  style={styles.input}
                  value={frequencyDays}
                  onChangeText={setFrequencyDays}
                  keyboardType="numeric"
                  placeholder="30"
                  data-testid="freq-days-input"
                />
              </>
            )}

            <Text style={styles.label}>Descrizione (visibile su scontrino)</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="es. Iscrizione stagione 2026/27"
              data-testid="plan-desc-input"
            />

            <TouchableOpacity
              style={[styles.createBtn, saving && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={saving}
              data-testid="plan-create-btn"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.createBtnTxt}>Genera link per il genitore</Text>
                </>
              )}
            </TouchableOpacity>

            {generatedLink && (
              <View style={styles.linkGenerated}>
                <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkGeneratedLabel}>Piano creato! Invia questo link al genitore:</Text>
                  <Text style={styles.linkGeneratedTxt} selectable>{generatedLink}</Text>
                  <TouchableOpacity onPress={copyLink} style={styles.copyBtnBig}>
                    <Ionicons name="copy" size={16} color="#fff" />
                    <Text style={styles.copyBtnBigTxt}>Copia link</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: '#635BFF', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: '700' },
  content: { flex: 1 },
  athleteBox: {
    flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff',
    padding: 14, borderRadius: 12, marginBottom: 12,
  },
  athleteName: { fontSize: 17, fontWeight: '700', color: '#333' },
  athleteSub: { fontSize: 12, color: '#666', marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 10 },
  hint: { fontSize: 12, color: '#666', marginBottom: 12, lineHeight: 17, fontStyle: 'italic' },
  label: { fontSize: 12, fontWeight: '600', color: '#555', marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14,
    backgroundColor: '#fafafa', color: '#000',
  },
  freqRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  freqBtn: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 10,
    alignItems: 'center', backgroundColor: '#fff',
  },
  freqBtnActive: { backgroundColor: '#635BFF', borderColor: '#635BFF' },
  freqTxt: { fontSize: 13, fontWeight: '600', color: '#666' },
  freqTxtActive: { color: '#fff' },
  createBtn: {
    marginTop: 20, backgroundColor: '#635BFF', borderRadius: 10, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  createBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  linkGenerated: {
    marginTop: 16, backgroundColor: '#E8F5E9', borderRadius: 10, padding: 14,
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
  },
  linkGeneratedLabel: { fontSize: 13, fontWeight: '700', color: '#2E7D32' },
  linkGeneratedTxt: { fontSize: 11, color: '#333', marginTop: 6, fontFamily: 'monospace' },
  copyBtnBig: {
    marginTop: 8, backgroundColor: '#2E7D32', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
  },
  copyBtnBigTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  planCard: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12, marginBottom: 10 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  planTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  planMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeTxt: { fontSize: 10, fontWeight: '800' },
  planDetail: { fontSize: 12, color: '#555', marginTop: 4 },
  bold: { fontWeight: '700' },
  chargesList: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  chargeRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 3 },
  chargeTxt: { fontSize: 11, color: '#555' },
  linkBox: {
    backgroundColor: '#F5F3FF', borderRadius: 8, padding: 10, marginTop: 8,
  },
  linkLabel: { fontSize: 11, fontWeight: '700', color: '#5B4FDF' },
  linkTxt: { fontSize: 10, color: '#333', marginTop: 4, fontFamily: 'monospace' },
  copyBtn: {
    marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
  },
  copyBtnTxt: { fontSize: 11, color: '#635BFF', fontWeight: '700' },
  planActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
  },
  actionBtnTxt: { fontSize: 11, fontWeight: '700' },
});
