/**
 * 🆕 27/02/2026 (P1) — Import massivo Atleti + Genitori da XLSX legacy.
 *
 * Flusso:
 *   1) Admin scarica template XLSX pre-formattato
 *   2) Compila il template con dati della propria società (o copia da altro gestionale)
 *   3) Uploada il file → riceve anteprima riga per riga con status (ok/warning/error/duplicati)
 *   4) Deseleziona righe da saltare / decide azione per duplicati
 *   5) Conferma → import definitivo
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../src/services/api';
import SocietyBranding from '../../../src/components/SocietyBranding';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface PreviewRow {
  row_num: number;
  status: 'ok' | 'warning' | 'error' | 'duplicate_same_society' | 'duplicate_other_society';
  issues: string[];
  data: any;
  existing_athlete_id?: string;
  __selected?: boolean;  // client-side selection
  __action?: 'create' | 'update' | 'skip';
}

interface PreviewSummary {
  total: number;
  ok: number;
  warning: number;
  error: number;
  duplicate_same_society: number;
  duplicate_other_society: number;
}

const STATUS_COLORS: Record<string, string> = {
  ok: '#2E7D32',
  warning: '#E65100',
  error: '#C62828',
  duplicate_same_society: '#1565C0',
  duplicate_other_society: '#6A1B9A',
};
const STATUS_LABELS: Record<string, string> = {
  ok: 'OK',
  warning: 'Avviso',
  error: 'Errore',
  duplicate_same_society: 'Già presente',
  duplicate_other_society: 'Altra società',
};

const showAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

export default function ImportAthletesScreen() {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const token = (await import('@react-native-async-storage/async-storage')).default;
      const t = await token.getItem('token');
      const resp = await fetch(`${API}/api/admin/import-athletes/template.xlsx`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!resp.ok) throw new Error(`Errore ${resp.status}`);
      const blob = await resp.blob();
      if (Platform.OS === 'web') {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'template_import_atleti.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        showAlert('Non supportato', 'Scarica il template dal browser web dell\'app.');
      }
    } catch (e: any) {
      showAlert('Errore', e?.message || 'Impossibile scaricare il template');
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async () => {
    if (Platform.OS !== 'web') {
      showAlert('Non supportato', 'Usa la versione web per caricare il file.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      setUploading(true);
      setImportResult(null);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const resp = await api.post('/admin/import-athletes/preview', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const previewRows: PreviewRow[] = (resp.data.rows || []).map((r: PreviewRow) => ({
          ...r,
          __selected: r.status !== 'error',
          __action:
            r.status === 'duplicate_same_society' ? 'update'
              : r.status === 'error' ? 'skip'
              : 'create',
        }));
        setRows(previewRows);
        setSummary(resp.data.summary);
      } catch (e: any) {
        showAlert('Errore anteprima', e?.response?.data?.detail || e?.message || 'Errore');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const toggleRow = (idx: number) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, __selected: !r.__selected } : r));
  };

  const changeAction = (idx: number, action: 'create' | 'update' | 'skip') => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, __action: action } : r));
  };

  const handleCommit = async () => {
    const toImport = rows.filter(r => r.__selected && r.__action !== 'skip');
    if (toImport.length === 0) {
      showAlert('Nessuna riga', 'Seleziona almeno una riga da importare.');
      return;
    }
    const confirm = Platform.OS === 'web'
      ? window.confirm(`Importare ${toImport.length} atleti?\n\n• ${toImport.filter(r => r.__action === 'create').length} da creare\n• ${toImport.filter(r => r.__action === 'update').length} da aggiornare`)
      : true;
    if (!confirm) return;
    setCommitting(true);
    try {
      const payload = {
        rows: toImport.map(r => ({
          row_num: r.row_num,
          action: r.__action!,
          data: r.data,
          existing_athlete_id: r.existing_athlete_id,
        })),
      };
      const resp = await api.post('/admin/import-athletes/commit', payload);
      setImportResult(resp.data);
      setRows([]);
      setSummary(null);
    } catch (e: any) {
      showAlert('Errore import', e?.response?.data?.detail || e?.message || 'Errore');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      <View style={{ backgroundColor: '#1565C0', paddingTop: 40, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} data-testid="import-back-btn">
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <SocietyBranding logoSize={32} />
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 4 }}>Import Atleti (legacy)</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Step 1: Template */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Ionicons name="download-outline" size={22} color="#1565C0" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1a1a2e' }}>1. Scarica il template</Text>
          </View>
          <Text style={{ fontSize: 13, color: '#555', marginBottom: 12, lineHeight: 18 }}>
            Il template XLSX ha già le colonne pre-formattate (con esempio) e un foglio "Istruzioni" con la guida di compilazione. Se stai migrando da un altro gestionale, copia i dati dall'export del vecchio sistema nelle colonne del template.
          </Text>
          <TouchableOpacity
            onPress={handleDownloadTemplate}
            disabled={downloading}
            style={{ backgroundColor: '#1565C0', paddingVertical: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            data-testid="download-template-btn"
          >
            {downloading ? <ActivityIndicator size={16} color="#fff" /> : <Ionicons name="cloud-download-outline" size={18} color="#fff" />}
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Scarica template XLSX</Text>
          </TouchableOpacity>
        </View>

        {/* Step 2: Upload */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Ionicons name="cloud-upload-outline" size={22} color="#E65100" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1a1a2e' }}>2. Carica il file compilato</Text>
          </View>
          <TouchableOpacity
            onPress={handleUpload}
            disabled={uploading}
            style={{ backgroundColor: '#E65100', paddingVertical: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            data-testid="upload-file-btn"
          >
            {uploading ? <ActivityIndicator size={16} color="#fff" /> : <Ionicons name="folder-open-outline" size={18} color="#fff" />}
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{uploading ? 'Analisi in corso…' : 'Seleziona file XLSX'}</Text>
          </TouchableOpacity>
        </View>

        {/* Step 3: Preview */}
        {summary && (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 }} data-testid="preview-section">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="list" size={22} color="#6A1B9A" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1a1a2e' }}>3. Anteprima ({summary.total} righe)</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {(['ok','warning','error','duplicate_same_society','duplicate_other_society'] as const).map(k => (
                <View key={k} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: STATUS_COLORS[k] + '20', borderRadius: 6, borderWidth: 1, borderColor: STATUS_COLORS[k] }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: STATUS_COLORS[k] }}>{STATUS_LABELS[k]}: {(summary as any)[k]}</Text>
                </View>
              ))}
            </View>
            {rows.map((r, idx) => (
              <View
                key={r.row_num}
                style={{ borderWidth: 1, borderColor: STATUS_COLORS[r.status] + '60', borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: STATUS_COLORS[r.status] + '08' }}
                data-testid={`preview-row-${r.row_num}`}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity onPress={() => toggleRow(idx)} disabled={r.status === 'error'}>
                    <Ionicons
                      name={r.__selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={r.status === 'error' ? '#bbb' : STATUS_COLORS[r.status]}
                    />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a2e' }}>
                      Riga {r.row_num}: {r.data.cognome} {r.data.nome}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#666' }}>
                      CF: {r.data.codice_fiscale || '—'} · Nascita: {r.data.data_nascita || '—'}
                      {r.data.squadra ? ` · Squadra: ${r.data.squadra}` : ''}
                      {r.data.parent ? ` · Genitore: ${r.data.parent.first_name} ${r.data.parent.last_name}` : ''}
                    </Text>
                  </View>
                  <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: STATUS_COLORS[r.status], borderRadius: 4 }}>
                    <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>{STATUS_LABELS[r.status]}</Text>
                  </View>
                </View>
                {r.issues.length > 0 && (
                  <View style={{ marginTop: 6, paddingLeft: 30 }}>
                    {r.issues.map((iss, i) => (
                      <Text key={i} style={{ fontSize: 11, color: '#555', lineHeight: 15 }}>• {iss}</Text>
                    ))}
                  </View>
                )}
                {r.status === 'duplicate_same_society' && r.__selected && (
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, paddingLeft: 30 }}>
                    {(['update','skip'] as const).map(a => (
                      <TouchableOpacity
                        key={a}
                        onPress={() => changeAction(idx, a)}
                        style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: r.__action === a ? STATUS_COLORS[r.status] : '#f0f0f0', borderRadius: 4 }}
                      >
                        <Text style={{ fontSize: 11, color: r.__action === a ? '#fff' : '#555', fontWeight: '700' }}>
                          {a === 'update' ? 'Aggiorna' : 'Salta'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
            <TouchableOpacity
              onPress={handleCommit}
              disabled={committing}
              style={{ marginTop: 8, backgroundColor: '#2E7D32', paddingVertical: 14, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              data-testid="commit-import-btn"
            >
              {committing ? <ActivityIndicator size={18} color="#fff" /> : <Ionicons name="checkmark-done" size={20} color="#fff" />}
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{committing ? 'Import in corso…' : 'Conferma import'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Result */}
        {importResult && (
          <View style={{ backgroundColor: '#E8F5E9', borderLeftWidth: 4, borderLeftColor: '#2E7D32', borderRadius: 10, padding: 14 }} data-testid="import-result">
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#2E7D32', marginBottom: 8 }}>✅ Import completato</Text>
            <Text style={{ fontSize: 13, color: '#333', lineHeight: 20 }}>
              • Creati: <Text style={{ fontWeight: '700' }}>{importResult.created}</Text>{'\n'}
              • Aggiornati: <Text style={{ fontWeight: '700' }}>{importResult.updated}</Text>{'\n'}
              • Genitori collegati: <Text style={{ fontWeight: '700' }}>{importResult.parents_linked}</Text>{'\n'}
              • Saltati: <Text style={{ fontWeight: '700' }}>{importResult.skipped}</Text>
              {importResult.errors && importResult.errors.length > 0 ? (
                <Text>{'\n\n'}❌ Errori: {importResult.errors.length}</Text>
              ) : null}
            </Text>
            {importResult.errors && importResult.errors.length > 0 && (
              <View style={{ marginTop: 8 }}>
                {importResult.errors.slice(0, 5).map((e: any, i: number) => (
                  <Text key={i} style={{ fontSize: 12, color: '#C62828' }}>• Riga {e.row_num}: {e.error}</Text>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
