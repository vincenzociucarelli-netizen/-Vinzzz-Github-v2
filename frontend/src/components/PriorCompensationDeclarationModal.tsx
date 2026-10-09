/**
 * 🆕 27/07/2026 — PriorCompensationDeclarationModal
 *
 * Modal che l'utente (atleta/coach/dirigente/collaboratore) deve compilare
 * e firmare digitalmente PRIMA di poter accettare qualsiasi compenso.
 * Rispetta i requisiti Riforma Sport: dichiarazione auto-certificata + firma
 * + metadati (IP/UA/timestamp) salvati in modo permanente.
 *
 * L'utente inserisce l'importo € già percepito da altre società nell'anno
 * fiscale corrente. Il valore diventa immutabile dopo la firma (modifiche solo
 * via admin con log storico).
 *
 * Backend endpoint: POST /api/me/prior-compensation/declare
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SignaturePadInline, { SignaturePadInlineRef } from './SignaturePadInline';
import api from '../services/api';

interface Props {
  visible: boolean;
  userFullName: string;
  /** Data inizio contratto (ISO o "YYYY-MM-DD"). Se presente, è usata come data
   *  di riferimento nella dichiarazione ("ha percepito fino al giorno X") invece
   *  della data odierna. Serve a garantire che eventuali arretrati ricevuti il
   *  giorno di inizio contratto siano gestiti separatamente in quietanza. */
  contractStartDate?: string | null;
  /** 🆕 Variazione di un pregresso già firmato: precompila l'importo attuale e adatta i testi */
  isVariation?: boolean;
  currentAmount?: number | null;
  onClose: () => void;
  onDeclared: () => void; // Callback dopo firma andata a buon fine
}

const formatDateIT = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

export default function PriorCompensationDeclarationModal({
  visible,
  userFullName,
  contractStartDate,
  isVariation = false,
  currentAmount,
  onClose,
  onDeclared,
}: Props) {
  const signatureRef = useRef<SignaturePadInlineRef>(null);
  const [amountStr, setAmountStr] = useState(
    isVariation && currentAmount != null ? String(currentAmount).replace('.', ',') : ''
  );
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Ad ogni apertura: reset campi (precompila l'importo attuale se è una variazione)
  useEffect(() => {
    if (!visible) return;
    setAmountStr(isVariation && currentAmount != null ? String(currentAmount).replace('.', ',') : '');
    setConfirmChecked(false);
    setSignatureData(null);
  }, [visible, isVariation, currentAmount]);
  const today = new Date();
  const currentFiscalYear = today.getFullYear();
  // 🆕 27/07/2026 — Vincenzo: usare data inizio contratto invece di "oggi" per la dichiarazione,
  //                 così eventuali arretrati ricevuti lo stesso giorno di inizio non sono ambigui
  //                 (li dichiara comunque nella prima quietanza mensile).
  const referenceDate = (() => {
    if (contractStartDate) {
      try {
        const d = new Date(contractStartDate);
        if (!isNaN(d.getTime())) return d;
      } catch { /* fallback */ }
    }
    return today;
  })();

  const parsedAmount = parseFloat((amountStr || '').replace(',', '.'));
  const isAmountValid = amountStr !== '' && !isNaN(parsedAmount) && parsedAmount >= 0;
  const canSubmit = isAmountValid && confirmChecked && !!signatureData && !submitting;

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
    else Alert.alert(title, msg);
  };

  const handleSignatureSave = (dataUrl: string) => {
    setSignatureData(dataUrl);
  };

  const handleClearSignature = () => {
    signatureRef.current?.clear();
    setSignatureData(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    // Ottieni firma dalla ref (web restituisce base64 immediato)
    let sig = signatureData;
    if (!sig) {
      const fromRef = signatureRef.current?.toDataURL();
      if (fromRef) sig = fromRef;
    }
    if (!sig) {
      showAlert('Firma mancante', 'Devi firmare digitalmente per procedere.');
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post('/me/prior-compensation/declare', {
        amount: parsedAmount,
        signature_base64: sig,
      });
      if (res.data?.success) {
        showAlert(isVariation ? 'Dichiarazione aggiornata' : 'Dichiarazione firmata',
          isVariation ? 'La nuova dichiarazione del pregresso è stata registrata.' : 'Grazie! Ora puoi accettare il compenso.');
        onDeclared();
      } else {
        showAlert('Errore', 'Errore durante il salvataggio della dichiarazione.');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Errore di rete durante l\'invio.';
      showAlert('Errore', typeof msg === 'string' ? msg : 'Errore durante l\'invio.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container} data-testid="prior-compensation-declaration-modal">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="document-text" size={22} color="#fff" />
              <Text style={styles.headerTitle}>{isVariation ? 'Variazione Pregresso' : 'Dichiarazione Pregresso'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={submitting} data-testid="prior-comp-modal-close">
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Intro */}
            <View style={styles.introBox}>
              <Ionicons name="information-circle" size={18} color="#0369A1" />
              <Text style={styles.introText}>
                {isVariation ? (
                  <>
                    Stai presentando una <Text style={{ fontWeight: '700' }}>nuova dichiarazione del pregresso</Text> che
                    sostituisce quella già firmata per l&apos;anno fiscale {currentFiscalYear}. La dichiarazione precedente
                    resta conservata nello storico. Indica il nuovo importo complessivo e firma di nuovo.
                  </>
                ) : (
                  <>
                    Prima di poter accettare qualunque compenso dalla società, la normativa Riforma
                    Sport richiede che tu dichiari <Text style={{ fontWeight: '700' }}>quanto hai
                    già percepito da altre ASD/SSD</Text> nell&apos;anno fiscale corrente ({currentFiscalYear}).
                    {'\n\n'}
                    In caso di variazione potrai presentare una <Text style={{ fontWeight: '700' }}>nuova dichiarazione
                    firmata</Text>: quella precedente resterà nello storico.
                  </>
                )}
              </Text>
            </View>

            {/* Testo legale */}
            <View style={styles.legalBox}>
              <Text style={styles.legalTitle}>DICHIARAZIONE</Text>
              <Text style={styles.legalText}>
                Il/La sottoscritto/a <Text style={{ fontWeight: '700' }}>{userFullName}</Text>,
                consapevole delle responsabilità penali previste dall&apos;art. 76 del D.P.R.
                445/2000 in caso di dichiarazioni mendaci,
              </Text>
              <Text style={[styles.legalText, { marginTop: 8 }]}>
                <Text style={{ fontWeight: '700' }}>DICHIARA</Text> sotto la propria responsabilità,
                ai fini del calcolo delle soglie previste dalla Riforma dello Sport (D.Lgs.
                36/2021), che al giorno <Text style={{ fontWeight: '700' }}>{formatDateIT(referenceDate)}</Text>{' '}
                ha percepito da <Text style={{ fontWeight: '700' }}>altre ASD/SSD</Text> (diverse
                da quella cui presenta questa dichiarazione), per l&apos;anno fiscale{' '}
                <Text style={{ fontWeight: '700' }}>{currentFiscalYear}</Text>, la somma di:
              </Text>

              {/* Input importo */}
              <View style={styles.amountRow}>
                <Text style={styles.amountEuro}>€</Text>
                <TextInput
                  value={amountStr}
                  onChangeText={setAmountStr}
                  placeholder="0,00"
                  keyboardType="decimal-pad"
                  style={styles.amountInput}
                  editable={!submitting}
                  data-testid="prior-comp-amount-input"
                />
              </View>
              <Text style={styles.amountHint}>
                Inserisci 0 se non hai percepito alcun compenso da altre società quest&apos;anno
              </Text>
            </View>

            {/* Checkbox conferma */}
            <TouchableOpacity
              style={styles.confirmRow}
              onPress={() => setConfirmChecked(!confirmChecked)}
              disabled={submitting}
              data-testid="prior-comp-confirm-checkbox"
            >
              <View style={[styles.checkbox, confirmChecked && styles.checkboxChecked]}>
                {confirmChecked && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={styles.confirmText}>
                Confermo la veridicità di quanto dichiarato sopra
              </Text>
            </TouchableOpacity>

            {/* Firma */}
            <Text style={styles.sigLabel}>Firma digitale</Text>
            <View style={styles.sigContainer}>
              <SignaturePadInline
                ref={signatureRef}
                onSave={handleSignatureSave}
                onClear={() => setSignatureData(null)}
                height={160}
                backgroundColor="#FFFDF7"
                penColor="#1E3A8A"
              />
            </View>
            <TouchableOpacity onPress={handleClearSignature} disabled={submitting} data-testid="prior-comp-clear-sig">
              <Text style={styles.clearSigText}>🗑 Cancella firma</Text>
            </TouchableOpacity>

            {/* Metadati info */}
            <View style={styles.metadataBox}>
              <Ionicons name="shield-checkmark" size={14} color="#6B7280" />
              <Text style={styles.metadataText}>
                Verranno registrati IP, dispositivo e timestamp per garantire l&apos;autenticità
                della firma.
              </Text>
            </View>

            {/* Bottone submit */}
            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              data-testid="prior-comp-submit-btn"
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>FIRMA E CONFERMA</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  container: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '92%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E3A8A',
    padding: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  body: { paddingHorizontal: 18, paddingTop: 14 },
  introBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#E0F2FE',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  introText: { fontSize: 13, color: '#0C4A6E', flex: 1, lineHeight: 19 },
  legalBox: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  legalTitle: {
    textAlign: 'center',
    fontSize: 12,
    letterSpacing: 2,
    color: '#374151',
    fontWeight: '700',
    marginBottom: 10,
  },
  legalText: { fontSize: 13, color: '#1F2937', lineHeight: 20 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#1E3A8A',
    borderRadius: 10,
    marginTop: 14,
    paddingHorizontal: 12,
  },
  amountEuro: { fontSize: 22, fontWeight: '700', color: '#1E3A8A', marginRight: 8 },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#1E3A8A',
    paddingVertical: 10,
  },
  amountHint: { fontSize: 11, color: '#6B7280', marginTop: 4, fontStyle: 'italic' },
  confirmRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#1E3A8A' },
  confirmText: { fontSize: 13, color: '#1F2937', flex: 1, fontWeight: '500' },
  sigLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  sigContainer: { borderWidth: 2, borderColor: '#1E3A8A', borderRadius: 10, marginBottom: 6 },
  clearSigText: { fontSize: 12, color: '#6B7280', textAlign: 'right', marginBottom: 10 },
  metadataBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  metadataText: { fontSize: 11, color: '#6B7280', flex: 1 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  submitBtnDisabled: { backgroundColor: '#9CA3AF' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
});
