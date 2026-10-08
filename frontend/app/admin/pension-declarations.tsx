/**
 * 🆕 Admin — Dichiarazioni Previdenziali (per il consulente del lavoro)
 *
 * Riepilogo di tutti i collaboratori (coach/dirigenti/collaboratori/atleti PRO)
 * con: pregresso dichiarato (importo + firma), posizione previdenziale
 * dichiarata (ultima versione), stato (FIRMATA / DA VERIFICARE / NON DICHIARATA),
 * storico versioni ed export Excel (foglio Riepilogo + foglio Storico).
 * Sola consultazione: l'admin non può modificare né firmare.
 *
 * Backend: GET /api/admin/pension-declarations/summary
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import api from '../../src/services/api';
import AdminPensionDeclarationPanel from '../../src/components/AdminPensionDeclarationPanel';
import { formatPensionDateTime, pensionStatusStyle, ROLE_LABEL_IT } from '../../src/utils/pensionDeclaration';

type Row = {
  user_id: string;
  full_name: string;
  email?: string;
  role: string;
  monthly_compensation: number;
  compensation_accepted: boolean;
  contract_start_date?: string | null;
  prior_compensation_amount: number;
  prior_compensation_signed: boolean;
  prior_compensation_signed_at?: string | null;
  prior_compensation_signed_year?: number | null;
  pension_status: 'signed' | 'to_verify' | 'not_declared';
  pension_status_label: string;
  pension_latest: any | null;
  pension_history: any[];
  pension_versions: number;
};

type Filter = 'all' | 'signed' | 'to_verify' | 'not_declared';

const fmtEur = (n: number) => `€ ${Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminPensionDeclarationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/pension-declarations/summary');
      setRows(res.data?.rows || []);
    } catch (e: any) {
      Alert.alert('Errore', e?.response?.data?.detail || 'Impossibile caricare le dichiarazioni');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = rows.filter((r) => {
    if (filter !== 'all' && r.pension_status !== filter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (r.full_name || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q);
    }
    return true;
  });

  const counts = rows.reduce((acc, r) => { acc[r.pension_status] = (acc[r.pension_status] || 0) + 1; return acc; }, {} as Record<string, number>);

  // ─────────────── Export Excel (ExcelJS, stesso pattern del Calendario Gare) ───────────────
  const exportExcel = async () => {
    if (exporting) return;
    if (!visible.length) { Alert.alert('Nessun dato', 'Non ci sono righe da esportare.'); return; }
    setExporting(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const BORDER = { style: 'thin' as const, color: { argb: 'FFD9D9D9' } };
      const HEADER = 'FF4C1D95';
      const FILL_SIGNED = 'FFE8F5E9', FILL_VERIFY = 'FFFEF3C7', FILL_NONE = 'FFF3F4F6';

      const styleHeader = (ws: any, cols: [string, number][]) => {
        ws.columns = cols.map(([, w]) => ({ width: w }));
        const hr = ws.getRow(1);
        cols.forEach(([h], i) => {
          const c = hr.getCell(i + 1);
          c.value = h;
          c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER } };
          c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          c.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
        });
        hr.height = 30;
        ws.views = [{ state: 'frozen', ySplit: 1 }];
        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
      };
      const addRow = (ws: any, idx: number, values: any[], fill: string) => {
        const row = ws.getRow(idx);
        values.forEach((v, ci) => {
          const c = row.getCell(ci + 1);
          c.value = v;
          c.font = { name: 'Calibri', size: 10 };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
          c.alignment = { vertical: 'top', wrapText: true };
          c.border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
        });
      };
      const fillFor = (s: string) => s === 'signed' ? FILL_SIGNED : s === 'to_verify' ? FILL_VERIFY : FILL_NONE;
      const statusText = (s: string) => s === 'signed' ? 'FIRMATA' : s === 'to_verify' ? 'DA VERIFICARE' : 'NON DICHIARATA';

      // Foglio 1 — Riepilogo (ultima dichiarazione per collaboratore)
      const SUMMARY: [string, number][] = [
        ['Cognome Nome', 26], ['Email', 28], ['Ruolo', 14], ['Compenso mensile (€)', 14], ['Accordo accettato', 12], ['Inizio contratto', 14],
        ['Pregresso dichiarato (€)', 16], ['Pregresso firmato', 12], ['Data firma pregresso', 18],
        ['Stato dich. previdenziale', 18], ['Opzione', 9], ['Posizione previdenziale dichiarata', 48], ['Tipologia copertura / pensione', 24], ['Precisazione', 28],
        ['Data/ora sottoscrizione', 18], ['Versione n.', 10], ['Versione testo', 10], ['ID dichiarazione', 38], ['ID accordo', 40], ['N. versioni', 10],
      ];
      const ws1 = wb.addWorksheet('Riepilogo');
      styleHeader(ws1, SUMMARY);
      visible.forEach((r, i) => {
        const l = r.pension_latest;
        addRow(ws1, i + 2, [
          r.full_name, r.email || '', ROLE_LABEL_IT[r.role] || r.role, Number(r.monthly_compensation || 0), r.compensation_accepted ? 'SI' : 'NO',
          r.contract_start_date ? String(r.contract_start_date).slice(0, 10) : '',
          Number(r.prior_compensation_amount || 0), r.prior_compensation_signed ? 'SI' : 'NO', r.prior_compensation_signed_at ? formatPensionDateTime(r.prior_compensation_signed_at) : '',
          statusText(r.pension_status), l?.position || '', l?.position_label || '', l?.detail || '', l?.detail_note || '',
          l ? formatPensionDateTime(l.signed_at) : '', l?.version_number || '', l?.text_version || '', l?.id || '', l?.agreement_id || '', r.pension_versions,
        ], fillFor(r.pension_status));
      });

      // Foglio 2 — Storico completo (tutte le versioni)
      const HIST: [string, number][] = [
        ['Cognome Nome', 26], ['Email', 28], ['Ruolo', 14], ['Versione n.', 10], ['Stato', 16], ['Opzione', 9], ['Posizione previdenziale dichiarata', 48],
        ['Tipologia', 24], ['Precisazione', 28], ['Data/ora sottoscrizione', 18], ['Sottoscritta da', 22], ['Versione testo', 10], ['ID dichiarazione', 38], ['Sostituisce (ID precedente)', 38], ['ID accordo', 40], ['IP', 16],
      ];
      const ws2 = wb.addWorksheet('Storico');
      styleHeader(ws2, HIST);
      let ri = 2;
      visible.forEach((r) => {
        r.pension_history.forEach((h) => {
          addRow(ws2, ri++, [
            r.full_name, r.email || '', ROLE_LABEL_IT[r.role] || r.role, h.version_number, statusText(h.status), h.position, h.position_label,
            h.detail || '', h.detail_note || '', formatPensionDateTime(h.signed_at), h.signed_by_name || '', h.text_version, h.id, h.previous_declaration_id || '', h.agreement_id || '', h.ip || '',
          ], fillFor(h.status));
        });
      });

      // Foglio 3 — Legenda
      const ws3 = wb.addWorksheet('Legenda');
      ws3.columns = [{ width: 18 }, { width: 100 }];
      const legend = [
        ['FIRMATA', 'Dichiarazione sottoscritta digitalmente dal lavoratore (opzioni A, B o C).'],
        ['DA VERIFICARE', 'Il lavoratore ha dichiarato di non conoscere con certezza la propria posizione (opzione D) e richiede una verifica.'],
        ['NON DICHIARATA', 'Nessuna dichiarazione previdenziale ancora sottoscritta.'],
        ['A', 'Iscritto/assicurato presso altra forma di previdenza obbligatoria, oltre al lavoro sportivo.'],
        ['B', 'Titolare di pensione diretta.'],
        ['C', 'Non assicurato presso altre forme di previdenza obbligatoria e non titolare di pensione diretta.'],
        ['D', 'Posizione non dichiarabile con certezza — richiesta verifica.'],
        ['Nota', 'RegistraTEAM raccoglie e conserva le dichiarazioni: nessun calcolo contributivo o applicazione di aliquote. La valutazione è a cura del consulente del lavoro.'],
      ];
      legend.forEach((l, i) => { const row = ws3.getRow(i + 1); row.getCell(1).value = l[0]; row.getCell(1).font = { bold: true }; row.getCell(2).value = l[1]; row.getCell(2).alignment = { wrapText: true }; });

      const d = new Date();
      const fname = `dichiarazioni_previdenziali_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.xlsx`;
      const buffer = await wb.xlsx.writeBuffer();
      if (Platform.OS === 'web') {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fname;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } else {
        const bytes = new Uint8Array(buffer as ArrayBuffer);
        const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let b64 = '';
        for (let i = 0; i < bytes.length; i += 3) {
          const b1 = bytes[i], b2 = bytes[i + 1], b3 = bytes[i + 2];
          b64 += B64[b1 >> 2];
          b64 += B64[((b1 & 3) << 4) | ((b2 ?? 0) >> 4)];
          b64 += i + 1 < bytes.length ? B64[((b2 & 15) << 2) | ((b3 ?? 0) >> 6)] : '=';
          b64 += i + 2 < bytes.length ? B64[b3 & 63] : '=';
        }
        const fileUri = FileSystem.documentDirectory + fname;
        await FileSystem.writeAsStringAsync(fileUri, b64, { encoding: 'base64' as any });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Esporta Dichiarazioni Previdenziali' });
        } else {
          Alert.alert('Errore', 'Condivisione non disponibile');
        }
      }
    } catch (e) {
      Alert.alert('Errore', 'Impossibile esportare il file Excel');
    } finally {
      setExporting(false);
    }
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: `Tutti (${rows.length})` },
    { key: 'signed', label: `Firmate (${counts.signed || 0})` },
    { key: 'to_verify', label: `Da verificare (${counts.to_verify || 0})` },
    { key: 'not_declared', label: `Non dichiarate (${counts.not_declared || 0})` },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} testID="pension-back-btn">
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🛡️ Dichiarazioni Previdenziali</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={exportExcel} disabled={exporting || loading} testID="pension-export-excel-btn">
          {exporting ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="download" size={18} color="#fff" />}
          <Text style={styles.exportBtnText}>Excel</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={18} color="#4C1D95" />
          <Text style={styles.infoText}>
            Riepilogo per il consulente del lavoro: pregresso dichiarato e posizione previdenziale sottoscritta da ogni collaboratore.
            Sola consultazione: le dichiarazioni sono firmate esclusivamente dal lavoratore e lo storico non è modificabile.
          </Text>
        </View>

        <View style={styles.filtersCard}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Cerca per nome o email…"
            placeholderTextColor="#9CA3AF"
            style={styles.search}
            testID="pension-search"
          />
          <View style={styles.chips}>
            {FILTERS.map((f) => (
              <TouchableOpacity key={f.key} style={[styles.chip, filter === f.key && styles.chipActive]} onPress={() => setFilter(f.key)} testID={`pension-filter-${f.key}`}>
                <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color="#4C1D95" style={{ marginTop: 30 }} />
        ) : visible.length === 0 ? (
          <Text style={styles.empty}>Nessun collaboratore per i filtri selezionati.</Text>
        ) : visible.map((r) => {
          const st = pensionStatusStyle(r.pension_status);
          const isOpen = expanded === r.user_id;
          return (
            <View key={r.user_id} style={styles.rowCard} testID={`pension-row-${r.user_id}`}>
              <TouchableOpacity style={styles.rowHead} onPress={() => setExpanded(isOpen ? null : r.user_id)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{r.full_name}</Text>
                  <Text style={styles.sub}>{ROLE_LABEL_IT[r.role] || r.role}{r.email ? ` · ${r.email}` : ''}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: st.bg, borderColor: st.border }]}>
                  <Ionicons name={st.icon as any} size={14} color={st.color} />
                  <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                </View>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" style={{ marginLeft: 6 }} />
              </TouchableOpacity>

              <View style={styles.kv}>
                <Text style={styles.k}>Pregresso dichiarato</Text>
                <Text style={styles.v}>{fmtEur(r.prior_compensation_amount)} {r.prior_compensation_signed ? '✓ firmato' : '— non firmato'}</Text>
              </View>
              {r.pension_latest && (
                <View style={styles.kv}>
                  <Text style={styles.k}>Posizione</Text>
                  <Text style={styles.v}>{r.pension_latest.position}. {r.pension_latest.position_short}{r.pension_latest.detail ? ` (${r.pension_latest.detail})` : ''} · v.{r.pension_latest.version_number} · {formatPensionDateTime(r.pension_latest.signed_at)}</Text>
                </View>
              )}

              {isOpen && (
                <View style={{ marginTop: 10 }}>
                  <AdminPensionDeclarationPanel userId={r.user_id} />
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { padding: 4, width: 32, minHeight: 44, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#1F2937', textAlign: 'center' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1D6F42', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, minHeight: 40 },
  exportBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  infoBox: { flexDirection: 'row', gap: 8, margin: 12, marginBottom: 0, padding: 12, backgroundColor: '#F5F3FF', borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#6D28D9' },
  infoText: { flex: 1, fontSize: 12, color: '#4C1D95', lineHeight: 18 },
  filtersCard: { margin: 12, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  search: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1F2937', marginBottom: 10, minHeight: 44 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderColor: '#C4B5FD', backgroundColor: '#fff', minHeight: 40, justifyContent: 'center' },
  chipActive: { backgroundColor: '#4C1D95', borderColor: '#4C1D95' },
  chipText: { fontSize: 13, color: '#4C1D95', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 30, fontStyle: 'italic' },
  rowCard: { marginHorizontal: 12, marginBottom: 10, padding: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  rowHead: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  name: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  kv: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  k: { fontSize: 12, color: '#6B7280', width: 130 },
  v: { fontSize: 12, color: '#1F2937', flex: 1, fontWeight: '500' },
});
