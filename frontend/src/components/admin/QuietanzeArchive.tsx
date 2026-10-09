/**
 * 🆕 QuietanzeArchive — Archivio di TUTTE le quietanze firmate della società
 * (coach, dirigenti, collaboratori, atleti PRO), organizzate mese per mese.
 * Per ogni mese: elenco quietanze con PDF singolo + "Scarica ZIP del mese"
 * (tutti i PDF pronti per il commercialista). Sola lettura.
 *
 * Backend: GET /api/admin/quietanze/archive?year=
 *          GET /api/admin/quietanze/archive/zip?year=&month=&role=
 *          GET /api/documents/download/{id}  (PDF singolo)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import api from '../../services/api';

const MONTH_NAMES = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const fmtEur = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n || 0);
const ROLE_LABEL: Record<string, string> = { coach: '🏐 Coach', dirigente: '🏅 Dirigente', collaboratore: '👤 Collaboratore', athlete: '🏆 Atleta Pro', altro: 'Altro' };
const ROLE_COLOR: Record<string, string> = { coach: '#2196F3', dirigente: '#8E44AD', collaboratore: '#FF9800', athlete: '#C9A227', altro: '#666' };

type Receipt = {
  id: string; document_title?: string; user_name: string; user_role: string; month: number | null; year: number | null;
  amount_gross: number; signed_at?: string | null; exceeded_5000: boolean; exceeded_15000: boolean; dual_role_combined: boolean; pdf_filename?: string | null;
};
type MonthGroup = { year: number; month: number; label: string; count: number; total: number };

const showAlert = (t: string, m: string) => { if (Platform.OS === 'web') window.alert(`${t}\n\n${m}`); else Alert.alert(t, m); };

const fmtSigned = (iso?: string | null) => {
  if (!iso) return '—';
  let s = String(iso);
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s = s + 'Z';
  return new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
};

/** Scarica/apre un blob (web: nuova scheda o download; mobile: condividi). */
const saveBlob = async (blob: Blob, filename: string, mime: string) => {
  if (Platform.OS === 'web') {
    const url = window.URL.createObjectURL(new Blob([blob], { type: mime }));
    const opened = mime === 'application/pdf' ? window.open(url, '_blank') : null;
    if (!opened) {
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  } else {
    const b64 = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const uri = FileSystem.documentDirectory + filename;
    await FileSystem.writeAsStringAsync(uri, b64, { encoding: 'base64' as any });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: filename });
    else showAlert('Errore', 'Condivisione non disponibile');
  }
};

export default function QuietanzeArchive() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [months, setMonths] = useState<MonthGroup[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (y: number | null) => {
    try {
      setLoading(true);
      const res = await api.get('/admin/quietanze/archive', { params: y ? { year: y } : {} });
      setReceipts(res.data?.receipts || []);
      setMonths(res.data?.months || []);
      setYears(res.data?.years || []);
      if (!y && res.data?.years?.length) setYear(res.data.years[0]);
      // Apri di default il mese più recente
      const first = (res.data?.months || [])[0];
      if (first) setOpenMonths((prev) => ({ [`${first.year}-${first.month}`]: true, ...prev }));
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Impossibile caricare l\'archivio quietanze');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(year); }, [year, load]);

  const filtered = role ? receipts.filter((r) => r.user_role === role) : receipts;
  const visibleMonths = months
    .map((m) => ({ ...m, items: filtered.filter((r) => r.year === m.year && r.month === m.month) }))
    .filter((m) => m.items.length > 0);
  const grandTotal = filtered.reduce((s, r) => s + (r.amount_gross || 0), 0);

  const openPdf = async (r: Receipt) => {
    try {
      setBusy(r.id);
      const res = await api.get(`/documents/download/${r.id}`, { responseType: 'blob' });
      const blob: Blob = res.data;
      if (!blob || blob.size === 0) { showAlert('Documento vuoto', 'Il PDF non è disponibile.'); return; }
      await saveBlob(blob, r.pdf_filename || `quietanza_${r.id}.pdf`, 'application/pdf');
    } catch {
      showAlert('Errore', 'Impossibile aprire la quietanza.');
    } finally { setBusy(null); }
  };

  const downloadZip = async (y: number, m?: number) => {
    const key = m ? `zip-${y}-${m}` : `zip-${y}`;
    try {
      setBusy(key);
      const params: any = { year: y };
      if (m) params.month = m;
      if (role) params.role = role;
      const res = await api.get('/admin/quietanze/archive/zip', { params, responseType: 'blob', timeout: 180000 });
      const name = `quietanze_${y}${m ? `_${String(m).padStart(2, '0')}` : ''}${role ? `_${role}` : ''}.zip`;
      await saveBlob(res.data, name, 'application/zip');
    } catch {
      showAlert('Errore', 'Impossibile generare lo ZIP delle quietanze.');
    } finally { setBusy(null); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} testID="quietanze-archive">
      <View style={styles.infoBox}>
        <Ionicons name="archive" size={18} color="#4A148C" />
        <Text style={styles.infoText}>
          Tutte le quietanze <Text style={{ fontWeight: '700' }}>firmate</Text> da chi percepisce un compenso, archiviate mese per mese.
          Apri il singolo PDF oppure scarica lo ZIP del mese (o dell&apos;anno) da consegnare al commercialista.
        </Text>
      </View>

      {/* Anno */}
      <View style={styles.rowWrap}>
        {years.map((y) => (
          <TouchableOpacity key={y} style={[styles.chip, year === y && styles.chipActive]} onPress={() => setYear(y)} testID={`archive-year-${y}`}>
            <Text style={[styles.chipText, year === y && styles.chipTextActive]}>{y}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* Ruolo */}
      <View style={styles.rowWrap}>
        {[null, 'coach', 'dirigente', 'collaboratore', 'athlete'].map((r) => (
          <TouchableOpacity key={String(r)} style={[styles.chip, role === r && styles.chipActive]} onPress={() => setRole(r)} testID={`archive-role-${r || 'all'}`}>
            <Text style={[styles.chipText, role === r && styles.chipTextActive]}>{r ? ROLE_LABEL[r] : 'Tutti'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#8E44AD" style={{ marginTop: 30 }} />
      ) : (
        <>
          {/* Totale anno + ZIP anno */}
          {year && filtered.length > 0 && (
            <View style={styles.yearBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.yearTitle}>Anno {year} · {filtered.length} quietanze firmate</Text>
                <Text style={styles.yearTotal}>Totale lordo {fmtEur(grandTotal)}</Text>
              </View>
              <TouchableOpacity style={styles.zipBtn} onPress={() => downloadZip(year)} disabled={!!busy} testID="archive-zip-year">
                {busy === `zip-${year}` ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="download" size={16} color="#fff" />}
                <Text style={styles.zipBtnText}>ZIP anno</Text>
              </TouchableOpacity>
            </View>
          )}

          {visibleMonths.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={56} color="#ccc" />
              <Text style={styles.emptyText}>Nessuna quietanza firmata per i filtri selezionati</Text>
            </View>
          )}

          {visibleMonths.map((m) => {
            const key = `${m.year}-${m.month}`;
            const isOpen = !!openMonths[key];
            const monthTotal = m.items.reduce((s, r) => s + (r.amount_gross || 0), 0);
            return (
              <View key={key} style={styles.monthCard} testID={`archive-month-${key}`}>
                <TouchableOpacity style={styles.monthHead} onPress={() => setOpenMonths((p) => ({ ...p, [key]: !isOpen }))}>
                  <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={18} color="#4A148C" />
                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <Text style={styles.monthTitle}>📅 {MONTH_NAMES[m.month]} {m.year}</Text>
                    <Text style={styles.monthSub}>{m.items.length} quietanze · {fmtEur(monthTotal)}</Text>
                  </View>
                  <TouchableOpacity style={styles.zipBtnSmall} onPress={() => downloadZip(m.year, m.month)} disabled={!!busy} testID={`archive-zip-${key}`}>
                    {busy === `zip-${key}` ? <ActivityIndicator color="#4A148C" size="small" /> : <Ionicons name="archive-outline" size={16} color="#4A148C" />}
                    <Text style={styles.zipBtnSmallText}>ZIP</Text>
                  </TouchableOpacity>
                </TouchableOpacity>

                {isOpen && m.items.map((r) => (
                  <View key={r.id} style={styles.receiptRow}>
                    <View style={[styles.roleBadge, { backgroundColor: (ROLE_COLOR[r.user_role] || '#666') + '20' }]}>
                      <Text style={[styles.roleBadgeText, { color: ROLE_COLOR[r.user_role] || '#666' }]}>{ROLE_LABEL[r.user_role] || r.user_role}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.receiptName}>{r.user_name}</Text>
                      <Text style={styles.receiptMeta}>
                        {fmtEur(r.amount_gross)} · firmata il {fmtSigned(r.signed_at)}
                        {r.dual_role_combined ? ' · doppio ruolo' : ''}
                        {r.exceeded_5000 ? ' · ⚠️ €5k' : ''}{r.exceeded_15000 ? ' · ⚠️ €15k' : ''}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.pdfBtn} onPress={() => openPdf(r)} disabled={!!busy} testID={`archive-pdf-${r.id}`}>
                      {busy === r.id ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="document-text" size={16} color="#fff" />}
                      <Text style={styles.pdfBtnText}>PDF</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            );
          })}
        </>
      )}

      <TouchableOpacity style={styles.reportLink} onPress={() => router.push('/admin/reports')} testID="archive-go-reports">
        <Ionicons name="bar-chart" size={18} color="#8E44AD" />
        <Text style={styles.reportLinkText}>Vai al Report Compensi (riepilogo per persona e soglie)</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  infoBox: { flexDirection: 'row', gap: 8, margin: 12, marginBottom: 6, padding: 12, backgroundColor: '#F3E5F5', borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#8E44AD' },
  infoText: { flex: 1, fontSize: 12, color: '#4A148C', lineHeight: 18 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, marginTop: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', minHeight: 40, justifyContent: 'center' },
  chipActive: { backgroundColor: '#8E44AD', borderColor: '#8E44AD' },
  chipText: { fontSize: 13, color: '#666', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  yearBar: { flexDirection: 'row', alignItems: 'center', margin: 12, padding: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E1BEE7' },
  yearTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  yearTotal: { fontSize: 13, color: '#8E44AD', fontWeight: '600', marginTop: 2 },
  zipBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#8E44AD', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, minHeight: 44 },
  zipBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  emptyText: { color: '#999', marginTop: 10, textAlign: 'center' },
  monthCard: { marginHorizontal: 12, marginTop: 10, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eee', overflow: 'hidden' },
  monthHead: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FAF5FC', minHeight: 56 },
  monthTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  monthSub: { fontSize: 12, color: '#777', marginTop: 2 },
  zipBtnSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: '#8E44AD', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, minHeight: 40 },
  zipBtnSmallText: { color: '#4A148C', fontWeight: '700', fontSize: 12 },
  receiptRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  roleBadgeText: { fontSize: 11, fontWeight: '600' },
  receiptName: { fontSize: 14, fontWeight: '600', color: '#333' },
  receiptMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1565C0', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, minHeight: 40 },
  pdfBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  reportLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, padding: 12, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#8E44AD', minHeight: 44 },
  reportLinkText: { color: '#8E44AD', fontWeight: '600', fontSize: 13 },
});
