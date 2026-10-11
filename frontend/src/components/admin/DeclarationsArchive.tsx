/**
 * 🆕 DeclarationsArchive — Archivio di TUTTE le dichiarazioni firmate da chi
 * percepisce compensi (Atleti 18+ PRO, coach, dirigenti, collaboratori):
 * pregresso / compensi da terzi, posizione previdenziale, superamento soglie.
 * Raggruppate per persona (dual-role unito). PDF singolo, ZIP (tutto / per
 * persona) e invio email al commercialista / consulente del lavoro.
 *
 * Backend: GET  /api/admin/declarations/archive?year=
 *          GET  /api/admin/declarations/archive/zip?year=&doc_type=&person=
 *          POST /api/admin/declarations/archive/send-email
 *          GET  /api/documents/download/{id}
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, ScrollView, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import api from '../../services/api';

const fmtEur = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n || 0);
const showAlert = (t: string, m: string) => { if (Platform.OS === 'web') window.alert(`${t}\n\n${m}`); else Alert.alert(t, m); };
const fmtSigned = (iso?: string | null) => {
  if (!iso) return '—';
  let s = String(iso);
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s = s + 'Z';
  return new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
};

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

type Doc = {
  id: string; document_type: string; type_label: string; type_short: string; document_title: string;
  year: number | null; month?: number | null; amount: number | null; version_number?: number | null; pension_status?: string | null;
  signed_at?: string | null; pdf_filename?: string | null;
};
type Person = { key: string; name: string; roles: string[]; role_label: string; agreement_accepted_at?: string | null; monthly_compensation: number; docs: Doc[]; counts: Record<string, number> };
type TypeMeta = { key: string; label: string; short: string; icon: string; color: string; count: number };

export default function DeclarationsArchive() {
  const [loading, setLoading] = useState(true);
  const [persons, setPersons] = useState<Person[]>([]);
  const [types, setTypes] = useState<TypeMeta[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [docType, setDocType] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const [accountantEmail, setAccountantEmail] = useState('');
  const [sendTarget, setSendTarget] = useState<{ person?: Person } | null>(null);
  const [sendEmail, setSendEmail] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async (y: number | null) => {
    try {
      setLoading(true);
      const res = await api.get('/admin/declarations/archive', { params: y ? { year: y } : {} });
      setPersons(res.data?.persons || []);
      setTypes(res.data?.types || []);
      setYears(res.data?.years || []);
      if (res.data?.accountant_email) setAccountantEmail(res.data.accountant_email);
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Impossibile caricare l\'archivio dichiarazioni');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(year); }, [year, load]);

  const typeMeta = (k: string) => types.find((t) => t.key === k);
  const visible = persons
    .map((p) => ({ ...p, docs: docType ? p.docs.filter((d) => d.document_type === docType) : p.docs }))
    .filter((p) => p.docs.length > 0);
  const totalDocs = visible.reduce((s, p) => s + p.docs.length, 0);

  const openPdf = async (d: Doc) => {
    try {
      setBusy(d.id);
      const res = await api.get(`/documents/download/${d.id}`, { responseType: 'blob' });
      const blob: Blob = res.data;
      if (!blob || blob.size === 0) { showAlert('Documento vuoto', 'Il PDF non è disponibile.'); return; }
      await saveBlob(blob, d.pdf_filename || `dichiarazione_${d.id}.pdf`, 'application/pdf');
    } catch {
      showAlert('Errore', 'Impossibile aprire la dichiarazione.');
    } finally { setBusy(null); }
  };

  const downloadZip = async (person?: Person) => {
    const key = person ? `zip-${person.key}` : 'zip-all';
    try {
      setBusy(key);
      const params: any = {};
      if (year) params.year = year;
      if (docType) params.doc_type = docType;
      if (person) params.person = person.key;
      const res = await api.get('/admin/declarations/archive/zip', { params, responseType: 'blob', timeout: 180000 });
      const name = `dichiarazioni${year ? `_${year}` : ''}${person ? `_${person.name.replace(/\s+/g, '_')}` : ''}.zip`;
      await saveBlob(res.data, name, 'application/zip');
    } catch {
      showAlert('Errore', 'Impossibile generare lo ZIP delle dichiarazioni.');
    } finally { setBusy(null); }
  };

  const openSend = (person?: Person) => {
    setSendEmail(accountantEmail || '');
    setSendMessage('');
    setSendTarget({ person });
  };

  const doSend = async () => {
    if (!sendTarget) return;
    const email = sendEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showAlert('Email non valida', 'Inserisci l\'indirizzo email del commercialista.'); return; }
    try {
      setSending(true);
      const body: any = { to_email: email, message: sendMessage.trim() || null, save_as_default: true };
      if (year) body.year = year;
      if (docType) body.doc_type = docType;
      if (sendTarget.person) body.person = sendTarget.person.key;
      const res = await api.post('/admin/declarations/archive/send-email', body, { timeout: 180000 });
      setAccountantEmail(email);
      setSendTarget(null);
      showAlert('Email inviata', `ZIP con ${res.data?.count} dichiarazioni inviato a ${email}.`);
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      showAlert('Errore', typeof d === 'string' ? d : 'Invio email non riuscito.');
    } finally { setSending(false); }
  };

  const docMeta = (d: Doc) => {
    const parts: string[] = [];
    if (d.year) parts.push(String(d.year));
    if (d.amount !== null && d.amount !== undefined) parts.push(fmtEur(d.amount));
    if (d.version_number && d.version_number > 1) parts.push(`v.${d.version_number}`);
    if (d.pension_status === 'to_verify') parts.push('da verificare');
    parts.push(`firmata il ${fmtSigned(d.signed_at)}`);
    return parts.join(' · ');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} testID="declarations-archive">
      <View style={styles.infoBox}>
        <Ionicons name="folder-open" size={18} color="#1B5E20" />
        <Text style={styles.infoText}>
          Tutte le <Text style={{ fontWeight: '700' }}>dichiarazioni firmate</Text> da chi percepisce compensi (Atleti 18+ Pro, coach, dirigenti, collaboratori):
          compensi pregressi / da terzi, posizione previdenziale, superamento soglie. Una cartella per persona nello ZIP da consegnare al commercialista o al consulente del lavoro.
        </Text>
      </View>

      {/* Anno */}
      <View style={styles.rowWrap}>
        <TouchableOpacity style={[styles.chip, year === null && styles.chipActive]} onPress={() => setYear(null)} testID="decl-year-all">
          <Text style={[styles.chipText, year === null && styles.chipTextActive]}>Tutti gli anni</Text>
        </TouchableOpacity>
        {years.map((y) => (
          <TouchableOpacity key={y} style={[styles.chip, year === y && styles.chipActive]} onPress={() => setYear(y)} testID={`decl-year-${y}`}>
            <Text style={[styles.chipText, year === y && styles.chipTextActive]}>{y}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* Tipo */}
      <View style={styles.rowWrap}>
        <TouchableOpacity style={[styles.chip, docType === null && styles.chipActive]} onPress={() => setDocType(null)} testID="decl-type-all">
          <Text style={[styles.chipText, docType === null && styles.chipTextActive]}>Tutti i tipi</Text>
        </TouchableOpacity>
        {types.filter((t) => t.count > 0).map((t) => (
          <TouchableOpacity key={t.key} style={[styles.chip, docType === t.key && styles.chipActive]} onPress={() => setDocType(docType === t.key ? null : t.key)} testID={`decl-type-${t.key}`}>
            <Text style={[styles.chipText, docType === t.key && styles.chipTextActive]}>{t.short} ({t.count})</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2E7D32" style={{ marginTop: 30 }} />
      ) : (
        <>
          {totalDocs > 0 && (
            <View style={styles.topBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.topTitle}>{totalDocs} dichiarazioni · {visible.length} persone</Text>
                <Text style={styles.topSub}>{year ? `Anno ${year}` : 'Tutti gli anni'}{docType ? ` · ${typeMeta(docType)?.label}` : ''}</Text>
              </View>
              <TouchableOpacity style={styles.zipBtn} onPress={() => downloadZip()} disabled={!!busy} testID="decl-zip-all">
                {busy === 'zip-all' ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="download" size={16} color="#fff" />}
                <Text style={styles.zipBtnText}>ZIP</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.zipBtn, styles.mailBtn]} onPress={() => openSend()} disabled={!!busy} testID="decl-mail-all">
                <Ionicons name="mail" size={16} color="#fff" />
                <Text style={styles.zipBtnText}>Invia</Text>
              </TouchableOpacity>
            </View>
          )}

          {visible.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={56} color="#ccc" />
              <Text style={styles.emptyText}>Nessuna dichiarazione firmata per i filtri selezionati</Text>
            </View>
          )}

          {visible.map((p) => {
            const isOpen = open[p.key] !== false; // aperte di default
            return (
              <View key={p.key} style={styles.personCard} testID={`decl-person-${p.key}`}>
                <TouchableOpacity style={styles.personHead} onPress={() => setOpen((o) => ({ ...o, [p.key]: !isOpen }))} activeOpacity={0.7}>
                  <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={18} color="#1B5E20" />
                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <Text style={styles.personName}>{p.name}</Text>
                    <Text style={styles.personSub}>
                      {p.role_label || 'Percettore compenso'} · {p.docs.length} document{p.docs.length === 1 ? 'o' : 'i'}
                      {p.agreement_accepted_at ? ` · accordo accettato il ${fmtSigned(p.agreement_accepted_at).slice(0, 10)}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.zipBtnSmall} onPress={() => downloadZip(p)} disabled={!!busy} testID={`decl-zip-${p.key}`}>
                    {busy === `zip-${p.key}` ? <ActivityIndicator color="#1B5E20" size="small" /> : <Ionicons name="archive-outline" size={16} color="#1B5E20" />}
                    <Text style={styles.zipBtnSmallText}>ZIP</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.zipBtnSmall, { marginLeft: 6 }]} onPress={() => openSend(p)} disabled={!!busy} testID={`decl-mail-${p.key}`}>
                    <Ionicons name="mail-outline" size={16} color="#1B5E20" />
                  </TouchableOpacity>
                </TouchableOpacity>

                {isOpen && p.docs.map((d) => {
                  const tm = typeMeta(d.document_type);
                  const color = tm?.color || '#555';
                  return (
                    <View key={d.id} style={styles.docRow}>
                      <View style={[styles.typeBadge, { backgroundColor: color + '1A' }]}>
                        <Ionicons name={(tm?.icon as any) || 'document-text'} size={16} color={color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.docTitle}>{d.type_label}</Text>
                        <Text style={styles.docMeta}>{docMeta(d)}</Text>
                      </View>
                      <TouchableOpacity style={styles.pdfBtn} onPress={() => openPdf(d)} disabled={!!busy} testID={`decl-pdf-${d.id}`}>
                        {busy === d.id ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="document-text" size={16} color="#fff" />}
                        <Text style={styles.pdfBtnText}>PDF</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </>
      )}

      {/* Modal invio al commercialista */}
      <Modal visible={!!sendTarget} transparent animationType="fade" onRequestClose={() => !sending && setSendTarget(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal} testID="decl-send-modal">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📧 Invia al commercialista</Text>
              <TouchableOpacity onPress={() => setSendTarget(null)} disabled={sending}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={styles.modalSub}>
                {sendTarget?.person ? <Text style={{ fontWeight: '700' }}>{sendTarget.person.name}</Text> : <Text style={{ fontWeight: '700' }}>Tutti i percettori</Text>}
                {' · '}{year ? `anno ${year}` : 'tutti gli anni'}{docType ? ` · ${typeMeta(docType)?.label}` : ''}.
                {' '}Verrà allegato lo ZIP con i PDF firmati (una cartella per persona) e un riepilogo nel corpo dell&apos;email.
              </Text>
              <Text style={styles.label}>Email del commercialista / consulente del lavoro</Text>
              <TextInput
                value={sendEmail}
                onChangeText={setSendEmail}
                placeholder="es. studio@commercialista.it"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                editable={!sending}
                testID="decl-send-email"
              />
              <Text style={styles.hint}>L&apos;indirizzo viene memorizzato e riproposto per i prossimi invii.</Text>
              <Text style={styles.label}>Messaggio (facoltativo)</Text>
              <TextInput
                value={sendMessage}
                onChangeText={setSendMessage}
                placeholder="Nota per il commercialista…"
                placeholderTextColor="#9CA3AF"
                style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                multiline
                editable={!sending}
                maxLength={1000}
                testID="decl-send-message"
              />
              <TouchableOpacity style={[styles.zipBtn, styles.mailBtn, { justifyContent: 'center', marginTop: 14, marginLeft: 0 }]} onPress={doSend} disabled={sending} testID="decl-send-confirm">
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={16} color="#fff" />}
                <Text style={styles.zipBtnText}>{sending ? 'Invio in corso…' : 'Invia email con ZIP'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  infoBox: { flexDirection: 'row', gap: 8, margin: 12, marginBottom: 6, padding: 12, backgroundColor: '#E8F5E9', borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#2E7D32' },
  infoText: { flex: 1, fontSize: 12, color: '#1B5E20', lineHeight: 18 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, marginTop: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', minHeight: 40, justifyContent: 'center' },
  chipActive: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  chipText: { fontSize: 13, color: '#666', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  topBar: { flexDirection: 'row', alignItems: 'center', margin: 12, padding: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#C8E6C9' },
  topTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  topSub: { fontSize: 12, color: '#2E7D32', fontWeight: '600', marginTop: 2 },
  zipBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2E7D32', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, minHeight: 44 },
  zipBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  mailBtn: { backgroundColor: '#1D6F42', marginLeft: 8 },
  empty: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  emptyText: { color: '#999', marginTop: 10, textAlign: 'center' },
  personCard: { marginHorizontal: 12, marginTop: 10, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eee', overflow: 'hidden' },
  personHead: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F4FAF4', minHeight: 56 },
  personName: { fontSize: 15, fontWeight: '700', color: '#333' },
  personSub: { fontSize: 12, color: '#777', marginTop: 2 },
  zipBtnSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: '#2E7D32', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, minHeight: 40 },
  zipBtnSmallText: { color: '#1B5E20', fontWeight: '700', fontSize: 12 },
  docRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  typeBadge: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  docTitle: { fontSize: 13, fontWeight: '600', color: '#333' },
  docMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1565C0', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, minHeight: 40 },
  pdfBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 12 },
  modal: { width: '100%', maxWidth: 520, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2E7D32', padding: 14 },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalSub: { fontSize: 13, color: '#4B5563', lineHeight: 19, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1F2937', minHeight: 44 },
  hint: { fontSize: 11, color: '#6B7280', marginTop: 4, fontStyle: 'italic' },
});
