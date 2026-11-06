import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import { formatCurrency } from '../../src/utils/formatCurrency';

interface PaidRow {
  athlete_id: string;
  athlete_name: string;
  team_name: string;
  amount: number;
  paid_date: string | null;
}
interface Reminder {
  sent_at: string;
  role?: string | null;
  count: number;
}
interface UnpaidRow {
  athlete_id: string;
  installment_number: number;
  athlete_name: string;
  team_name: string;
  label: string;
  amount: number;
  residual: number;
  paid_so_far: number;
  due_date: string | null;
  overdue: boolean;
  phones: Record<string, string>;
  last_reminder?: Reminder | null;
}
interface Installment {
  installment_number: number;
  label: string;
  paid_count: number;
  unpaid_count: number;
  overdue_count: number;
  unpaid_residual: number;
  paid: PaidRow[];
  unpaid: UnpaidRow[];
}

const ROLE_LABEL: Record<string, string> = {
  atleta: 'Atleta',
  padre: 'Padre',
  madre: 'Madre',
};

function formatDateIt(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

// Formatta un timestamp ISO nel fuso orario italiano (gg/mm/aaaa)
function formatDateRome(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('it-IT', {
      timeZone: 'Europe/Rome',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return formatDateIt(iso.slice(0, 10));
  }
}

// Normalizza il numero in formato internazionale senza '+' per wa.me (default Italia +39)
function normalizePhone(raw: string): string {
  let digits = (raw || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  // già con prefisso internazionale +39 (39 + ~10 cifre nazionali)
  if (digits.startsWith('39') && digits.length >= 11) return digits;
  // numero nazionale italiano (cellulari: 3xx, 10 cifre)
  if (digits.startsWith('3') && digits.length >= 9 && digits.length <= 10) return '39' + digits;
  return digits;
}

export default function PaymentsRemindersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [societyName, setSocietyName] = useState('');
  const [installments, setInstallments] = useState<Installment[]>([]);
  // -1 = scheda "Scaduti" (tutte le rate scadute insieme); 1/2/3 = singola rata
  const [selectedRata, setSelectedRata] = useState(-1);
  const [view, setView] = useState<'unpaid' | 'paid'>('unpaid');

  // Modale sollecito WhatsApp
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRow, setModalRow] = useState<UnpaidRow | null>(null);
  const [selectedPhoneKey, setSelectedPhoneKey] = useState<string>('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/payments/installment-reminders');
      setSocietyName(res.data.society_name || '');
      setInstallments(res.data.installments || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = useMemo(
    () => installments.find((i) => i.installment_number === selectedRata),
    [installments, selectedRata],
  );

  // Riepilogo Scaduti: tutte le rate scadute di tutte le squadre, ordinate per scadenza
  const overdueAll = useMemo(() => {
    const rows: UnpaidRow[] = [];
    installments.forEach((inst) => inst.unpaid.forEach((r) => r.overdue && rows.push(r)));
    rows.sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999') || a.athlete_name.localeCompare(b.athlete_name));
    return rows;
  }, [installments]);

  const overdueTotal = overdueAll.length;
  const overdueResidual = useMemo(() => overdueAll.reduce((s, r) => s + r.residual, 0), [overdueAll]);

  const buildMessage = useCallback(
    (row: UnpaidRow): string => {
      const parts = [
        `Buongiorno,`,
        `le ricordiamo che per ${row.athlete_name} risulta non saldata la ${row.label} di ${formatCurrency(row.residual)}` +
          (row.due_date ? ` con scadenza ${formatDateIt(row.due_date)}` : '') +
          `.`,
        `La preghiamo di provvedere al pagamento. Grazie.`,
        societyName ? `\n${societyName}` : '',
      ];
      return parts.filter(Boolean).join('\n');
    },
    [societyName],
  );

  const openReminder = useCallback(
    (row: UnpaidRow) => {
      const keys = Object.keys(row.phones || {});
      if (keys.length === 0) {
        Alert.alert('Nessun numero', `Nessun recapito telefonico salvato per ${row.athlete_name}.`);
        return;
      }
      setModalRow(row);
      setSelectedPhoneKey(keys[0]);
      setMessage(buildMessage(row));
      setModalOpen(true);
    },
    [buildMessage],
  );

  const markReminded = useCallback((athleteId: string, installmentNumber: number, sentAt: string, role: string) => {
    setInstallments((prev) =>
      prev.map((inst) =>
        inst.installment_number !== installmentNumber
          ? inst
          : {
              ...inst,
              unpaid: inst.unpaid.map((r) =>
                r.athlete_id === athleteId
                  ? { ...r, last_reminder: { sent_at: sentAt, role, count: (r.last_reminder?.count || 0) + 1 } }
                  : r,
              ),
            },
      ),
    );
  }, []);

  const sendWhatsapp = useCallback(async () => {
    if (!modalRow || !selectedPhoneKey) return;
    const raw = modalRow.phones[selectedPhoneKey];
    const phone = normalizePhone(raw);
    if (!phone) {
      Alert.alert('Numero non valido', 'Il recapito selezionato non è valido.');
      return;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported && Platform.OS !== 'web') {
        Alert.alert('WhatsApp non disponibile', 'Impossibile aprire WhatsApp su questo dispositivo.');
        return;
      }
      await Linking.openURL(url);
      // Registra il sollecito (non bloccare l'apertura di WhatsApp se fallisce)
      try {
        const res = await api.post('/admin/payments/reminders/log', {
          athlete_id: modalRow.athlete_id,
          installment_number: modalRow.installment_number,
          role: selectedPhoneKey,
          phone: raw,
          label: modalRow.label,
        });
        markReminded(modalRow.athlete_id, modalRow.installment_number, res.data.sent_at, selectedPhoneKey);
      } catch {
        /* log best-effort */
      }
      setModalOpen(false);
    } catch {
      Alert.alert('Errore', 'Impossibile aprire WhatsApp.');
    }
  }, [modalRow, selectedPhoneKey, message, markReminded]);

  const renderUnpaidRow = (row: UnpaidRow, showChip: boolean) => {
    const reminded = !!row.last_reminder;
    const lr = row.last_reminder;
    return (
      <View key={`${row.installment_number}-${row.athlete_id}`} style={styles.row}>
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text style={styles.rowName}>{row.athlete_name}</Text>
            {row.overdue && (
              <View style={styles.overdueBadge}>
                <Text style={styles.overdueBadgeText}>SCADUTA</Text>
              </View>
            )}
            {showChip && (
              <View style={styles.rataChip}>
                <Text style={styles.rataChipText}>Rata {row.installment_number}</Text>
              </View>
            )}
          </View>
          {!!row.team_name && <Text style={styles.rowTeam}>{row.team_name}</Text>}
          <Text style={styles.rowMeta}>
            {formatCurrency(row.residual)}
            {row.paid_so_far > 0 ? ` (parziale, versato ${formatCurrency(row.paid_so_far)})` : ''}
            {row.due_date ? ` · scad. ${formatDateIt(row.due_date)}` : ''}
          </Text>
          {reminded && lr && (
            <View style={styles.remindedRow}>
              <Ionicons name="checkmark-done" size={13} color="#2E7D32" />
              <Text style={styles.remindedText}>
                Sollecitato il {formatDateRome(lr.sent_at)}
                {lr.role ? ` (${ROLE_LABEL[lr.role] || lr.role})` : ''}
                {lr.count > 1 ? ` · ${lr.count}×` : ''}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.waBtn, reminded && styles.waBtnSent]}
          onPress={() => openReminder(row)}
          testID={`wa-${row.athlete_id}-${row.installment_number}`}
        >
          <Ionicons name="logo-whatsapp" size={18} color="#fff" />
          <Text style={styles.waBtnText}>{reminded ? 'Risollecita' : 'Sollecita'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn" data-testid="back-btn">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Solleciti rate</Text>
          <Text style={styles.headerSubtitle}>Pagato / non pagato per rata · sollecito WhatsApp</Text>
        </View>
        <TouchableOpacity onPress={load} style={styles.backBtn} testID="refresh-btn">
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1565C0" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>Riprova</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Selettore: Scaduti + singole rate */}
          <View style={styles.rataTabs}>
            <TouchableOpacity
              style={[styles.rataTab, selectedRata === -1 && styles.rataTabOverdueActive]}
              onPress={() => setSelectedRata(-1)}
              testID="rata-tab-overdue"
            >
              <Text style={[styles.rataTabText, selectedRata === -1 && styles.rataTabTextActive]}>Scaduti</Text>
              {overdueTotal > 0 && (
                <View style={styles.rataTabBadge}>
                  <Text style={styles.rataTabBadgeText}>{overdueTotal}</Text>
                </View>
              )}
            </TouchableOpacity>
            {installments.map((inst) => {
              const active = inst.installment_number === selectedRata;
              return (
                <TouchableOpacity
                  key={inst.installment_number}
                  style={[styles.rataTab, active && styles.rataTabActive]}
                  onPress={() => setSelectedRata(inst.installment_number)}
                  testID={`rata-tab-${inst.installment_number}`}
                >
                  <Text style={[styles.rataTabText, active && styles.rataTabTextActive]}>
                    Rata {inst.installment_number}
                  </Text>
                  {inst.overdue_count > 0 && (
                    <View style={styles.rataTabBadge}>
                      <Text style={styles.rataTabBadgeText}>{inst.overdue_count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
            {selectedRata === -1 ? (
              /* ===== Riepilogo Scaduti (tutte le rate) ===== */
              <>
                <View style={styles.overdueHeader}>
                  <Text style={styles.overdueHeaderTitle}>
                    {overdueTotal} {overdueTotal === 1 ? 'rata scaduta' : 'rate scadute'}
                  </Text>
                  {overdueResidual > 0 && (
                    <Text style={styles.overdueHeaderSub}>Da incassare: {formatCurrency(overdueResidual)}</Text>
                  )}
                </View>
                {overdueAll.length === 0 ? (
                  <Text style={styles.emptyText}>Nessuna rata scaduta 🎉</Text>
                ) : (
                  overdueAll.map((row) => renderUnpaidRow(row, true))
                )}
              </>
            ) : !current ? (
              <Text style={styles.emptyText}>Nessuna rata configurata.</Text>
            ) : (
              <>
                {/* Riepilogo */}
                <View style={styles.summaryRow}>
                  <View style={[styles.summaryCard, { backgroundColor: '#E8F5E9' }]}>
                    <Text style={[styles.summaryNum, { color: '#2E7D32' }]}>{current.paid_count}</Text>
                    <Text style={styles.summaryLbl}>Pagato</Text>
                  </View>
                  <View style={[styles.summaryCard, { backgroundColor: '#FDECEA' }]}>
                    <Text style={[styles.summaryNum, { color: '#C0392B' }]}>{current.unpaid_count}</Text>
                    <Text style={styles.summaryLbl}>Non pagato</Text>
                  </View>
                  <View style={[styles.summaryCard, { backgroundColor: '#FFF3E0' }]}>
                    <Text style={[styles.summaryNum, { color: '#E65100' }]}>{current.overdue_count}</Text>
                    <Text style={styles.summaryLbl}>Scadute</Text>
                  </View>
                </View>
                {current.unpaid_residual > 0 && (
                  <Text style={styles.residualNote}>
                    Da incassare: {formatCurrency(current.unpaid_residual)}
                  </Text>
                )}

                {/* Toggle pagato / non pagato */}
                <View style={styles.viewToggle}>
                  <TouchableOpacity
                    style={[styles.viewBtn, view === 'unpaid' && styles.viewBtnActive]}
                    onPress={() => setView('unpaid')}
                    testID="view-unpaid"
                  >
                    <Text style={[styles.viewBtnText, view === 'unpaid' && styles.viewBtnTextActive]}>
                      Non pagato ({current.unpaid_count})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.viewBtn, view === 'paid' && styles.viewBtnActive]}
                    onPress={() => setView('paid')}
                    testID="view-paid"
                  >
                    <Text style={[styles.viewBtnText, view === 'paid' && styles.viewBtnTextActive]}>
                      Pagato ({current.paid_count})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Lista */}
                {view === 'unpaid' ? (
                  current.unpaid.length === 0 ? (
                    <Text style={styles.emptyText}>Tutti in regola con questa rata 🎉</Text>
                  ) : (
                    current.unpaid.map((row) => renderUnpaidRow(row, false))
                  )
                ) : current.paid.length === 0 ? (
                  <Text style={styles.emptyText}>Nessun pagamento registrato per questa rata.</Text>
                ) : (
                  current.paid.map((row) => (
                    <View key={row.athlete_id} style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName}>{row.athlete_name}</Text>
                        {!!row.team_name && <Text style={styles.rowTeam}>{row.team_name}</Text>}
                        <Text style={styles.rowMeta}>
                          {formatCurrency(row.amount)}
                          {row.paid_date ? ` · ${formatDateIt(row.paid_date)}` : ''}
                        </Text>
                      </View>
                      <View style={styles.paidBadge}>
                        <Ionicons name="checkmark-circle" size={18} color="#2E7D32" />
                        <Text style={styles.paidBadgeText}>Pagato</Text>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* Modale sollecito WhatsApp */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 12) + 6 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sollecito WhatsApp</Text>
              <TouchableOpacity
                onPress={() => setModalOpen(false)}
                testID="modal-close"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 6 }}
              >
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
              {modalRow && (
                <>
                  <Text style={styles.modalLabel}>Invia a</Text>
                  <View style={styles.phoneList}>
                    {Object.keys(modalRow.phones).map((k) => {
                      const active = k === selectedPhoneKey;
                      return (
                        <TouchableOpacity
                          key={k}
                          style={[styles.phoneOpt, active && styles.phoneOptActive]}
                          onPress={() => setSelectedPhoneKey(k)}
                          testID={`phone-${k}`}
                        >
                          <Ionicons
                            name={active ? 'radio-button-on' : 'radio-button-off'}
                            size={18}
                            color={active ? '#1565C0' : '#9CA3AF'}
                          />
                          <Text style={styles.phoneOptText}>
                            {ROLE_LABEL[k] || k}: {modalRow.phones[k]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.modalLabel}>Messaggio</Text>
                  <TextInput
                    style={styles.msgInput}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    testID="msg-input"
                  />
                </>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.sendBtn} onPress={sendWhatsapp} testID="send-wa-btn">
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={styles.sendBtnText}>Apri WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1565C0', paddingTop: 44, paddingBottom: 14, paddingHorizontal: 12,
  },
  backBtn: { padding: 6, marginRight: 6, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSubtitle: { color: '#BBDEFB', fontSize: 12, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errText: { color: '#C0392B', fontSize: 15, textAlign: 'center', marginBottom: 12 },
  retryBtn: { backgroundColor: '#1565C0', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  rataTabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 8, gap: 8 },
  rataTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, minHeight: 44, borderRadius: 8, backgroundColor: '#F1F3F5',
  },
  rataTabActive: { backgroundColor: '#1565C0' },
  rataTabOverdueActive: { backgroundColor: '#C0392B' },
  rataTabText: { fontSize: 14, fontWeight: '700', color: '#495057' },
  rataTabTextActive: { color: '#fff' },
  rataTabBadge: {
    marginLeft: 6, backgroundColor: '#E65100', borderRadius: 10, minWidth: 20,
    paddingHorizontal: 5, paddingVertical: 1, alignItems: 'center',
  },
  rataTabBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  summaryCard: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  summaryNum: { fontSize: 24, fontWeight: '800' },
  summaryLbl: { fontSize: 12, color: '#374151', marginTop: 2, fontWeight: '600' },
  residualNote: { fontSize: 13, color: '#C0392B', fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  viewToggle: {
    flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 10, padding: 4, marginBottom: 12,
  },
  viewBtn: { flex: 1, paddingVertical: 10, minHeight: 44, justifyContent: 'center', borderRadius: 8, alignItems: 'center' },
  viewBtnActive: { backgroundColor: '#fff' },
  viewBtnText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  viewBtnTextActive: { color: '#111827' },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  rowTeam: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  rowMeta: { fontSize: 13, color: '#374151', marginTop: 4, fontWeight: '600' },
  overdueBadge: { backgroundColor: '#FDECEA', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  overdueBadgeText: { color: '#C0392B', fontSize: 10, fontWeight: '800' },
  waBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#25D366',
    paddingHorizontal: 14, minHeight: 44, borderRadius: 8, marginLeft: 10,
  },
  waBtnText: { color: '#fff', fontWeight: '700', marginLeft: 6, fontSize: 13 },
  waBtnSent: { backgroundColor: '#1565C0' },
  rataChip: { backgroundColor: '#EEF4FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  rataChipText: { color: '#1565C0', fontSize: 10, fontWeight: '800' },
  remindedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  remindedText: { color: '#2E7D32', fontSize: 11, fontWeight: '600' },
  overdueHeader: {
    backgroundColor: '#FDECEA', borderRadius: 12, padding: 14, marginBottom: 12,
    borderLeftWidth: 4, borderLeftColor: '#C0392B',
  },
  overdueHeaderTitle: { color: '#C0392B', fontSize: 16, fontWeight: '800' },
  overdueHeaderSub: { color: '#7B241C', fontSize: 13, fontWeight: '700', marginTop: 2 },
  paidBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  paidBadgeText: { color: '#2E7D32', fontWeight: '700', marginLeft: 4, fontSize: 13 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 24 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 18, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 6 },
  phoneList: { gap: 8, marginBottom: 6 },
  phoneOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10,
    borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB',
  },
  phoneOptActive: { borderColor: '#1565C0', backgroundColor: '#EEF4FF' },
  phoneOptText: { fontSize: 14, color: '#111827', fontWeight: '600' },
  msgInput: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12,
    fontSize: 14, color: '#111827', minHeight: 120, textAlignVertical: 'top',
  },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#25D366', paddingVertical: 14, borderRadius: 12, marginTop: 14,
  },
  sendBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, marginLeft: 8 },
});
