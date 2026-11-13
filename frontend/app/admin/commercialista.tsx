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
import {
  downloadTextFile, printHTMLtoPDF,
  monthlyPaymentsCSV, monthlyPaymentsHTML,
  annualSummaryCSV, annualSummaryHTML,
} from '../../src/utils/paymentsReport';

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

  // 🆕 Export pagamenti mensili + riepilogo annuale
  const [annual, setAnnual] = useState<any>(null);
  const [annualLoading, setAnnualLoading] = useState(false);

  const showAlert = (t: string, m: string) => { if (Platform.OS === 'web') window.alert(`${t}\n${m}`); else Alert.alert(t, m); };

  const safeName = (s: string) => (s || 'export').replace(/[^a-zA-Z0-9]+/g, '_');

  const exportMonthlyCSV = async () => {
    if (!summary) return;
    try {
      const csv = monthlyPaymentsCSV({
        societyName: society.name || 'RegistraTEAM', societyLogo: society.logo,
        monthName: summary.month_name, year: summary.year,
        rows: summary.recipients || [], totals: summary.totals,
      });
      await downloadTextFile(`pagamenti_${safeName(summary.month_name)}_${summary.year}.csv`, csv);
    } catch { showAlert('Errore', 'Export CSV non riuscito.'); }
  };

  const exportMonthlyPDF = async () => {
    if (!summary) return;
    try {
      const html = monthlyPaymentsHTML({
        societyName: society.name || 'RegistraTEAM', societyLogo: society.logo,
        monthName: summary.month_name, year: summary.year,
        rows: summary.recipients || [], totals: summary.totals,
      });
      await printHTMLtoPDF(html, `Pagamenti ${summary.month_name} ${summary.year}`);
    } catch { showAlert('Errore', 'Export PDF non riuscito.'); }
  };

  const loadAnnual = async () => {
    const y = parseInt(year, 10);
    if (!y) { showAlert('Errore', 'Anno non valido'); return; }
    setAnnualLoading(true);
    try {
      const res = await api.get(`/admin/commercialista/annual-summary?year=${y}`);
      setAnnual(res.data);
    } catch { showAlert('Errore', 'Caricamento riepilogo annuale non riuscito.'); }
    finally { setAnnualLoading(false); }
  };

  const exportAnnualCSV = async () => {
    if (!annual) return;
    try {
      const csv = annualSummaryCSV({
        societyName: society.name || 'RegistraTEAM', societyLogo: society.logo,
        year: annual.year, rows: annual.recipients || [], totals: annual.totals,
      });
      await downloadTextFile(`riepilogo_annuale_${annual.year}.csv`, csv);
    } catch { showAlert('Errore', 'Export CSV non riuscito.'); }
  };

  const exportAnnualPDF = async () => {
    if (!annual) return;
    try {
      const html = annualSummaryHTML({
        societyName: society.name || 'RegistraTEAM', societyLogo: society.logo,
        year: annual.year, rows: annual.recipients || [], totals: annual.totals,
      });
      await printHTMLtoPDF(html, `Riepilogo annuale ${annual.year}`);
    } catch { showAlert('Errore', 'Export PDF non riuscito.'); }
  };

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
        <Text style={styles.personNet}>💶 Da bonificare: {eur(p.amount_net)}</Text>
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
              <Text style={styles.totLine}>Totale netto da bonificare: <Text style={styles.totBold}>{eur((summary.recipients || []).reduce((s: number, r: any) => s + Number(r.amount_net || 0), 0))}</Text></Text>
              <Text style={styles.totLine}>Da inviare per F24 (oltre €5.000): <Text style={styles.totBold}>{summary.totals.f24_count}</Text></Text>
              <Text style={styles.totLine}>Totale importi da versare: <Text style={styles.totBold}>{eur(summary.totals.total_versare)}</Text></Text>
              <View style={styles.exportRow}>
                <TouchableOpacity style={[styles.exportBtn, styles.exportCsv]} onPress={exportMonthlyCSV}>
                  <Ionicons name="grid-outline" size={16} color="#fff" />
                  <Text style={styles.exportBtnText}>Scarica CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.exportBtn, styles.exportPdf]} onPress={exportMonthlyPDF}>
                  <Ionicons name="document-text-outline" size={16} color="#fff" />
                  <Text style={styles.exportBtnText}>Scarica PDF</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.sectionTitle}>🧾 F24 del mese (oltre €5.000) — {f24.length}</Text>
            {f24.length === 0 ? <Text style={styles.empty}>Nessuno supera la soglia questo mese.</Text> : f24.map(renderPerson)}

            <Text style={styles.sectionTitle}>Altri compensi del mese — {others.length}</Text>
            {others.length === 0 ? <Text style={styles.empty}>Nessun altro compenso.</Text> : others.map(renderPerson)}

            {(summary.missing || []).length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: '#C0392B' }]}>⚠️ Compensati SENZA quietanza questo mese — {summary.missing.length}</Text>
                <Text style={styles.annualHint}>Hanno un compenso mensile impostato ma non risultano nel report perché manca la quietanza di {summary.month_name}. Crea le quietanze (es. &quot;Genera quietanze del mese&quot;) per includerli.</Text>
                {summary.missing.map((m: any) => (
                  <View key={`miss-${m.user_id}`} style={styles.missRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName}>{m.full_name}</Text>
                      <Text style={styles.personMeta}>{ROLE_LABEL[m.user_role] || m.user_role} · Compenso {eur(m.monthly_compensation)}/mese</Text>
                      <Text style={styles.missReason}>{m.reason}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* 🆕 Riepilogo annuale per persona */}
        <View style={[styles.card, { marginTop: 18 }]}>
          <Text style={styles.cardTitle}>📅 Riepilogo annuale {year}</Text>
          <Text style={styles.annualHint}>Totale lordo, netto e pagato nell&apos;anno, persona per persona.</Text>
          <TouchableOpacity style={styles.annualBtn} onPress={loadAnnual} disabled={annualLoading}>
            {annualLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="stats-chart-outline" size={18} color="#fff" />}
            <Text style={styles.loadBtnText}>Mostra riepilogo annuale</Text>
          </TouchableOpacity>

          {annual && !annualLoading && (
            <>
              <View style={[styles.totCard, { marginTop: 14, marginBottom: 10 }]}>
                <Text style={styles.totTitle}>Anno {annual.year}</Text>
                <Text style={styles.totLine}>Persone con compenso: <Text style={styles.totBold}>{annual.totals.count}</Text></Text>
                <Text style={styles.totLine}>Totale lordo: <Text style={styles.totBold}>{eur(annual.totals.total_gross)}</Text></Text>
                <Text style={styles.totLine}>Totale netto: <Text style={styles.totBold}>{eur(annual.totals.total_net)}</Text></Text>
                <Text style={styles.totLine}>Totale pagato (bonifici): <Text style={styles.totBold}>{eur(annual.totals.total_paid)}</Text></Text>
                <View style={styles.exportRow}>
                  <TouchableOpacity style={[styles.exportBtn, styles.exportCsv]} onPress={exportAnnualCSV}>
                    <Ionicons name="grid-outline" size={16} color="#fff" />
                    <Text style={styles.exportBtnText}>Scarica CSV</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.exportBtn, styles.exportPdf]} onPress={exportAnnualPDF}>
                    <Ionicons name="document-text-outline" size={16} color="#fff" />
                    <Text style={styles.exportBtnText}>Scarica PDF</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {(annual.recipients || []).length === 0
                ? <Text style={styles.empty}>Nessun compenso registrato nell&apos;anno.</Text>
                : (annual.recipients || []).map((p: any) => (
                  <View key={`ann-${p.user_role}-${p.user_id}`} style={styles.personCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName}>{p.full_name}</Text>
                      <Text style={styles.personMeta}>{ROLE_LABEL[p.user_role] || p.user_role} · {p.months} {p.months === 1 ? 'mese' : 'mesi'}</Text>
                      <Text style={styles.annualAmounts}>Lordo {eur(p.total_gross)} · Netto {eur(p.total_net)} · Pagato {eur(p.total_paid)}</Text>
                      {p.exceeded_5000 && <Text style={styles.f24Tag}>⚠️ {p.exceeded_15000 ? 'Oltre €15.000' : 'Oltre €5.000'}</Text>}
                    </View>
                  </View>
                ))}
            </>
          )}
        </View>
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
  exportRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  exportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 9 },
  exportCsv: { backgroundColor: '#2E7D32' },
  exportPdf: { backgroundColor: '#C62828' },
  exportBtnText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  annualHint: { fontSize: 12.5, color: '#666', marginBottom: 10 },
  annualBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1E3A8A', paddingVertical: 12, borderRadius: 10 },
  annualAmounts: { fontSize: 12.5, color: '#333', marginTop: 3, fontWeight: '600' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#444', marginTop: 8, marginBottom: 8 },
  empty: { color: '#999', fontStyle: 'italic', marginBottom: 8 },
  personCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  personName: { fontSize: 15, fontWeight: '700', color: '#222' },
  personMeta: { fontSize: 12.5, color: '#666', marginTop: 2 },
  personNet: { fontSize: 14, color: '#1B5E20', fontWeight: '800', marginTop: 3 },
  missRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8F6', borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#C0392B' },
  missReason: { fontSize: 12, color: '#C0392B', fontWeight: '700', marginTop: 3 },
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
