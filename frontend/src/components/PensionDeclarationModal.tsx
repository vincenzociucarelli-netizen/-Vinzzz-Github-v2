/**
 * 🆕 PensionDeclarationModal — Dichiarazione della posizione previdenziale
 *
 * Firma SEPARATA dal pregresso. Il lavoratore sceglie una delle 4 opzioni
 * (A/B/C/D), eventualmente specifica la tipologia (A/B), conferma il testo
 * dichiarativo e firma digitalmente. Ogni invio crea una NUOVA versione
 * (append-only) lato backend. L'app non fa alcun calcolo contributivo.
 *
 * Backend: GET /api/me/pension-declaration/status (testi + stato)
 *          POST /api/me/pension-declaration/declare
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SignaturePadInline, { SignaturePadInlineRef } from './SignaturePadInline';
import api from '../services/api';

export interface PensionOption {
  code: 'A' | 'B' | 'C' | 'D';
  label: string;
  short: string;
  detail_label?: string;
  detail_choices?: string[];
}

export interface PensionTexts {
  version: string;
  title: string;
  intro: string;
  options: PensionOption[];
  declaration: string;
}

interface Props {
  visible: boolean;
  userFullName: string;
  /** Se presente, è una nuova versione che aggiorna la precedente */
  previousVersionNumber?: number | null;
  onClose: () => void;
  onDeclared: () => void;
}

const showAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

export default function PensionDeclarationModal({ visible, userFullName, previousVersionNumber, onClose, onDeclared }: Props) {
  const signatureRef = useRef<SignaturePadInlineRef>(null);
  const [texts, setTexts] = useState<PensionTexts | null>(null);
  const [position, setPosition] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [detail, setDetail] = useState<string>('');
  const [detailNote, setDetailNote] = useState('');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPosition(null); setDetail(''); setDetailNote(''); setConfirmChecked(false); setSignatureData(null);
    api.get('/me/pension-declaration/status')
      .then((res) => setTexts(res.data?.texts || null))
      .catch(() => setTexts(null));
  }, [visible]);

  const selected = texts?.options.find((o) => o.code === position) || null;
  const needsDetail = position === 'A' || position === 'B';
  const canSubmit = !!position && (!needsDetail || !!detail) && confirmChecked && !!signatureData && !submitting && !!texts;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    let sig = signatureData || signatureRef.current?.toDataURL() || null;
    if (!sig) { showAlert('Firma mancante', 'Devi firmare digitalmente per procedere.'); return; }
    try {
      setSubmitting(true);
      const res = await api.post('/me/pension-declaration/declare', {
        position,
        detail: needsDetail ? detail : null,
        detail_note: detailNote.trim() || null,
        confirm: true,
        signature_base64: sig,
        text_version: texts?.version,
      });
      if (res.data?.success) {
        showAlert('Dichiarazione sottoscritta', position === 'D'
          ? 'La tua posizione è stata registrata come "Da verificare". La società sarà avvisata.'
          : 'Grazie! La dichiarazione è stata registrata e conservata.');
        onDeclared();
      } else {
        showAlert('Errore', 'Errore durante il salvataggio della dichiarazione.');
      }
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      showAlert('Errore', typeof d === 'string' ? d : (d?.message || 'Errore di rete durante l\'invio.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container} testID="pension-declaration-modal">
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="shield-checkmark" size={22} color="#fff" />
              <Text style={styles.headerTitle}>Posizione Previdenziale</Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={submitting} testID="pension-modal-close">
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          {!texts ? (
            <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator color="#1E3A8A" /></View>
          ) : (
            <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              {previousVersionNumber ? (
                <View style={styles.versionBox}>
                  <Ionicons name="git-branch" size={16} color="#92400E" />
                  <Text style={styles.versionText}>
                    Stai presentando una <Text style={{ fontWeight: '700' }}>nuova dichiarazione (v.{previousVersionNumber + 1})</Text> che
                    aggiorna la precedente. Le versioni precedenti restano conservate nello storico.
                  </Text>
                </View>
              ) : null}

              <View style={styles.legalBox}>
                <Text style={styles.legalTitle}>{texts.title.toUpperCase()}</Text>
                <Text style={styles.legalText}>
                  Il/La sottoscritto/a <Text style={{ fontWeight: '700' }}>{userFullName}</Text>
                </Text>
                <Text style={[styles.legalText, { marginTop: 8 }]}>{texts.intro}</Text>
              </View>

              <Text style={styles.sectionLabel}>Seleziona una risposta (obbligatorio)</Text>
              {texts.options.map((o) => {
                const active = position === o.code;
                return (
                  <TouchableOpacity
                    key={o.code}
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => { setPosition(o.code); setDetail(''); }}
                    disabled={submitting}
                    testID={`pension-option-${o.code}`}
                  >
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionCode}>{o.code}</Text>
                      <Text style={styles.optionText}>{o.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {selected && needsDetail && (
                <View style={styles.detailBox}>
                  <Text style={styles.sectionLabel}>{selected.detail_label} (obbligatorio)</Text>
                  <View style={styles.chips}>
                    {(selected.detail_choices || []).map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.chip, detail === c && styles.chipActive]}
                        onPress={() => setDetail(c)}
                        disabled={submitting}
                        testID={`pension-detail-${c.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <Text style={[styles.chipText, detail === c && styles.chipTextActive]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    value={detailNote}
                    onChangeText={setDetailNote}
                    placeholder="Precisazione facoltativa (es. ente/gestione, datore di lavoro...)"
                    placeholderTextColor="#9CA3AF"
                    style={styles.noteInput}
                    editable={!submitting}
                    maxLength={300}
                    testID="pension-detail-note"
                  />
                </View>
              )}

              {position === 'D' && (
                <View style={styles.verifyBox}>
                  <Ionicons name="alert-circle" size={18} color="#B45309" />
                  <Text style={styles.verifyText}>
                    La tua posizione sarà registrata come <Text style={{ fontWeight: '700' }}>«Da verificare»</Text>: la società e il consulente del lavoro la approfondiranno con te.
                  </Text>
                </View>
              )}

              <View style={styles.declBox}>
                <Text style={styles.declText}>{texts.declaration}</Text>
              </View>

              <TouchableOpacity
                style={styles.confirmRow}
                onPress={() => setConfirmChecked(!confirmChecked)}
                disabled={submitting}
                testID="pension-confirm-checkbox"
              >
                <View style={[styles.checkbox, confirmChecked && styles.checkboxChecked]}>
                  {confirmChecked && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={styles.confirmText}>Confermo quanto sopra dichiarato</Text>
              </TouchableOpacity>

              <Text style={styles.sigLabel}>Firma digitale (separata dal pregresso)</Text>
              <View style={styles.sigContainer}>
                <SignaturePadInline
                  ref={signatureRef}
                  onSave={(d: string) => setSignatureData(d)}
                  onClear={() => setSignatureData(null)}
                  height={160}
                  backgroundColor="#FFFDF7"
                  penColor="#1E3A8A"
                />
              </View>
              <TouchableOpacity onPress={() => { signatureRef.current?.clear(); setSignatureData(null); }} disabled={submitting} testID="pension-clear-sig">
                <Text style={styles.clearSigText}>🗑 Cancella firma</Text>
              </TouchableOpacity>

              <View style={styles.metadataBox}>
                <Ionicons name="shield-checkmark" size={14} color="#6B7280" />
                <Text style={styles.metadataText}>
                  Verranno registrati data/ora, IP, dispositivo, versione del testo ({texts.version}) e identificativo dell&apos;accordo.
                  RegistraTEAM conserva la dichiarazione senza effettuare calcoli contributivi.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
                testID="pension-submit-btn"
              >
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>FIRMA E CONFERMA</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 12 },
  container: {
    width: '100%', maxWidth: 640, maxHeight: '92%', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 4 }, elevation: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E3A8A', padding: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  body: { paddingHorizontal: 18, paddingTop: 14 },
  versionBox: { flexDirection: 'row', gap: 8, backgroundColor: '#FEF3C7', padding: 10, borderRadius: 10, marginBottom: 12, alignItems: 'flex-start' },
  versionText: { fontSize: 12, color: '#92400E', flex: 1, lineHeight: 18 },
  legalBox: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 14, marginBottom: 14 },
  legalTitle: { textAlign: 'center', fontSize: 12, letterSpacing: 1.5, color: '#374151', fontWeight: '700', marginBottom: 10 },
  legalText: { fontSize: 13, color: '#1F2937', lineHeight: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  option: { flexDirection: 'row', gap: 10, padding: 12, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, marginBottom: 8, alignItems: 'flex-start', backgroundColor: '#fff' },
  optionActive: { borderColor: '#1E3A8A', backgroundColor: '#EFF6FF' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioActive: { borderColor: '#1E3A8A' },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#1E3A8A' },
  optionCode: { fontSize: 12, fontWeight: '700', color: '#1E3A8A', marginBottom: 2 },
  optionText: { fontSize: 13, color: '#1F2937', lineHeight: 19 },
  detailBox: { backgroundColor: '#F0F9FF', borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 12, borderWidth: 1, borderColor: '#BAE6FD' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderColor: '#93C5FD', backgroundColor: '#fff', minHeight: 40, justifyContent: 'center' },
  chipActive: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
  chipText: { fontSize: 13, color: '#1E3A8A', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  noteInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 13, color: '#1F2937', backgroundColor: '#fff' },
  verifyBox: { flexDirection: 'row', gap: 8, backgroundColor: '#FEF3C7', padding: 12, borderRadius: 10, marginBottom: 12, alignItems: 'flex-start' },
  verifyText: { fontSize: 13, color: '#92400E', flex: 1, lineHeight: 19 },
  declBox: { backgroundColor: '#F9FAFB', borderLeftWidth: 4, borderLeftColor: '#1E3A8A', padding: 12, borderRadius: 8, marginBottom: 12, marginTop: 4 },
  declText: { fontSize: 13, color: '#1F2937', lineHeight: 20, fontStyle: 'italic' },
  confirmRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10, minHeight: 44 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: '#1E3A8A', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#1E3A8A' },
  confirmText: { fontSize: 13, color: '#1F2937', flex: 1, fontWeight: '500' },
  sigLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  sigContainer: { borderWidth: 2, borderColor: '#1E3A8A', borderRadius: 10, marginBottom: 6 },
  clearSigText: { fontSize: 12, color: '#6B7280', textAlign: 'right', marginBottom: 10 },
  metadataBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8, marginBottom: 14 },
  metadataText: { fontSize: 11, color: '#6B7280', flex: 1 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#059669', padding: 14, borderRadius: 10, gap: 8 },
  submitBtnDisabled: { backgroundColor: '#9CA3AF' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
});
