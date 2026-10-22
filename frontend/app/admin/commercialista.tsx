import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Platform, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../src/components/Icon';
import api from '../../src/services/api';
import { downloadFascicoloPDF, fascicoloPdfBase64, generateFascicoloHTML, FascicoloData } from '../../src/utils/fascicoloReport';

const ROLE_LABEL: Record<string, string> = { coach: 'Coach', dirigente: 'Dirigente', collaboratore: 'Collaboratore', athlete: 'Atleta' };
const eur = (n: any) => `€${Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Commercialista() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [scope, setScope] = useState<'year' | 'season'>('year');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [society, setSociety] = useState<{ name: string; logo: string | null }>({ name: '', logo: null });
  const [busyId, setBusyId] = useState<string | null>(null);

  const [emailModal, setEmailModal] = useState(false);
  const [accEmail, setAccEmail] = useState('');
  const [emailTarget, setEmailTarget] = useState<any>(null);
  const [sending, setSending] = useState(false);

  const showAlert = (t: string, m: string) => { if (Platform.OS === 'web') window.alert(`${t}\n${m}`); else Alert.alert(t, m); };

  const load = useCallback(async () => {
    const y = parseInt(year, 10), m = parseInt(month, 10);
    if (!y || !m || m < 1 || m > 12) { showAlert('Errore', 'Mese/anno non validi'); return; }
    setLoading(true);
    try {
      const [sum, soc, saved] = await Promise.all([
        api.get(`/admin/commercialista/summary?year=${y}&month=${m}`),
        api.get('/settings/society?include_images=true'),
        AsyncStorage.getItem('accountant_email'),
      ]);
      setSummary(sum.data);
      setSociety({ name: soc.data?.name || '', logo: soc.data?.logo || null });
      if (saved && !accEmail) setAccEmail(saved);
    } catch {
      showAlert('Errore', 'Caricamento non riuscito.');
    } finally { setLoading(false); }
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildFascicolo = async (person: any): Promise<FascicoloData> => {
    const res = await api.get(`/admin/commercialista/fascicolo/${person.user_role}/${person.user_id}?year=${parseInt(year, 10)}&scope=${scope}`);
    const d = res.data;
    return {
      societyName: society.name || 'RegistraTEAM',
      societyLogo: society.logo,
      roleLabel: ROLE_LABEL[person.user_role] || person.user_role,
      anagrafica: d.anagrafica,
      receipts: d.receipts,
      totals: d.totals,
      scopeLabel: scope === 'season' ? `Stagione ${year}/${parseInt(year, 10) + 1}` : `Anno ${year}`,
      fileName: `fascicolo_${(d.anagrafica.full_name || 'persona').replace(/[^a-zA-Z0-9]+/g, '_')}`,
    };
  };

  const onDownload = async (person: any) => {
    setBusyId(person.user_id);
    try { await downloadFascicoloPDF(await buildFascicolo(person)); }
    catch { showAlert('Errore', 'Generazione fascicolo non riuscita.'); }
    finally { setBusyId(null); }
  };

  const openEmail = (person: any) => { setEmailTarget(person); setEmailModal(true); };

  const sendEmail = async () => {
    if (!accEmail || !accEmail.includes('@')) { showAlert('Email', 'Inserisci un indirizzo valido.'); return; }
    setSending(true);
    try {
      await AsyncStorage.setItem('accountant_email', accEmail.trim());
      const data = await buildFascicolo(emailTarget);
      const html = generateFascicoloHTML(data);
      const pdf = await fascicoloPdfBase64(data);
      await api.post('/admin/commercialista/send-email', {
        to_email: accEmail.trim(),
        subject: `Fascicolo compensi — ${data.anagrafica.full_name} (${data.scopeLabel})`,
        html,
        pdf_base64: pdf || '',
        pdf_filename: `${data.fileName}.pdf`,
      });
      showAlert('Inviato', `Email inviata a ${accEmail.trim()}.`);
      setEmailModal(false);
    } catch (e: any) {
      showAlert('Errore', e.response?.data?.detail || 'Invio non riuscito.');
    } finally { setSending(false); }
  };

  const renderPerson = (p: any) => (
    <View key={`${p.user_role}-${p.user_id}`} style={styles.personCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.personName}>{p.full_name}</Text>
        <Text style={styles.personMeta}>{ROLE_LABEL[p.user_role] || p.user_role} · Lordo {eur(p.amount_gross)}{p.exceeded_5000 ? ` · Da versare ${eur(p.importo_versare)}` : ''}</Text>
        {p.exceeded_5000 && <Text style={styles.f24Tag}>⚠️ Superata soglia €5.000 — F24 mensile</Text>}
      </View>
      <View style={styles.personActions}>
        <TouchableOpacity style={styles.pBtn} onPress={() => onDownload(p)} disabled={busyId === p.user_id}>
          {busyId === p.user_id ? <ActivityIndicator size="small" color="#5856D6" /> : <Ionicons name="download-outline" size={18} color="#5856D6" />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.pBtn} onPress={() => openEmail(p)}>
          <Ionicons name="mail-outline" size={18} color="#2E7D32" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const f24 = summary?.f24 || [];
  const others = (summary?.recipients || []).filter((r: any) => !r.exceeded_5000);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin/quietanze'))} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commercialista</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Periodo</Text>
          <View style={styles.rowGap}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Mese (1-12)</Text>
              <TextInput style={styles.input} value={month} onChangeText={setMonth} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Anno</Text>
              <TextInput style={styles.input} value={year} onChangeText={setYear} keyboardType="numeric" />
            </View>
          </View>
          <Text style={styles.label}>Fascicolo: periodo da includere</Text>
          <View style={styles.toggleRow}>
            {(['year', 'season'] as const).map(s => (
              <TouchableOpacity key={s} style={[styles.toggleBtn, scope === s && styles.toggleBtnOn]} onPress={() => setScope(s)}>
                <Text style={[styles.toggleText, scope === s && styles.toggleTextOn]}>{s === 'year' ? 'Anno solare (CU)' : 'Stagione (set–ago)'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.loadBtn} onPress={load}>
            <Ionicons name="search" size={18} color="#fff" />
            <Text style={styles.loadBtnText}>Mostra riepilogo del mese</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator color="#5856D6" style={{ marginTop: 20 }} />}

        {summary && !loading && (
          <>
            <View style={styles.totCard}>
              <Text style={styles.totTitle}>Riepilogo {summary.month_name} {summary.year}</Text>
              <Text style={styles.totLine}>Persone con compenso: <Text style={styles.totBold}>{summary.totals.count}</Text></Text>
              <Text style={styles.totLine}>Totale lordo del mese: <Text style={styles.totBold}>{eur(summary.totals.total_gross)}</Text></Text>
              <Text style={styles.totLine}>Da inviare per F24 (oltre €5.000): <Text style={styles.totBold}>{summary.totals.f24_count}</Text></Text>
              <Text style={styles.totLine}>Totale importi da versare: <Text style={styles.totBold}>{eur(summary.totals.total_versare)}</Text></Text>
            </View>

            <Text style={styles.sectionTitle}>🧾 F24 del mese (oltre €5.000) — {f24.length}</Text>
            {f24.length === 0 ? <Text style={styles.empty}>Nessuno supera la soglia questo mese.</Text> : f24.map(renderPerson)}

            <Text style={styles.sectionTitle}>Altri compensi del mese — {others.length}</Text>
            {others.length === 0 ? <Text style={styles.empty}>Nessun altro compenso.</Text> : others.map(renderPerson)}
          </>
        )}
      </ScrollView>

      <Modal visible={emailModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invia fascicolo al commercialista</Text>
            <Text style={styles.modalSub}>{emailTarget?.full_name}</Text>
            <Text style={styles.label}>Email commercialista</Text>
            <TextInput style={styles.input} value={accEmail} onChangeText={setAccEmail} placeholder="commercialista@studio.it" autoCapitalize="none" keyboardType="email-address" />
            <Text style={styles.noteWeb}>{Platform.OS === 'web' ? 'Su web il fascicolo è inviato nel corpo email; da app mobile come PDF allegato.' : 'Il fascicolo sarà allegato in PDF.'}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.mBtn, styles.mCancel]} onPress={() => setEmailModal(false)}><Text style={styles.mCancelTxt}>Annulla</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.mBtn, styles.mSend, sending && { opacity: 0.5 }]} onPress={sendEmail} disabled={sending}>
                {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.mSendTxt}>Invia</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { backgroundColor: '#5856D6', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 6 },
  rowGap: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 13, color: '#666', marginTop: 10, marginBottom: 4, fontWeight: '600' },
  input: { backgroundColor: '#F7F7FA', borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E6', paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111' },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: '#F0F0F5', alignItems: 'center' },
  toggleBtnOn: { backgroundColor: '#5856D6' },
  toggleText: { fontSize: 13, color: '#555', fontWeight: '600' },
  toggleTextOn: { color: '#fff' },
  loadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#5856D6', paddingVertical: 12, borderRadius: 10, marginTop: 14 },
  loadBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  totCard: { backgroundColor: '#EEF2FF', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#C7D2FE' },
  totTitle: { fontSize: 15, fontWeight: '800', color: '#1E3A8A', marginBottom: 6 },
  totLine: { fontSize: 13.5, color: '#333', marginTop: 2 },
  totBold: { fontWeight: '800', color: '#1E3A8A' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#444', marginTop: 8, marginBottom: 8 },
  empty: { color: '#999', fontStyle: 'italic', marginBottom: 8 },
  personCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  personName: { fontSize: 15, fontWeight: '700', color: '#222' },
  personMeta: { fontSize: 12.5, color: '#666', marginTop: 2 },
  f24Tag: { fontSize: 12, color: '#E65100', fontWeight: '700', marginTop: 3 },
  personActions: { flexDirection: 'row', gap: 8 },
  pBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F0F0F5', alignItems: 'center', justifyContent: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  modalSub: { fontSize: 13, color: '#666', marginTop: 2 },
  noteWeb: { fontSize: 11.5, color: '#888', marginTop: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  mBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  mCancel: { backgroundColor: '#ECECF0' }, mCancelTxt: { color: '#333', fontWeight: '700' },
  mSend: { backgroundColor: '#2E7D32' }, mSendTxt: { color: '#fff', fontWeight: '700' },
});
