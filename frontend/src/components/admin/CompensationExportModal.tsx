/**
 * 🆕 13/06/2026 — MODAL EXPORT RIEPILOGO COMPENSI ANNUALE
 *
 * Modal admin per scaricare un XLSX con il riepilogo dei compensi della società
 * su un range di date arbitrario. Le date di default sono pre-popolate dalle
 * impostazioni stagione della società (settings.season_*).
 *
 * Endpoint:
 *  - GET /api/admin/compensation-summary/default-range
 *  - GET /api/admin/compensation-summary/export-xlsx?start_date&end_date
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, ActivityIndicator,
  StyleSheet, Platform, Alert,
} from 'react-native';
import { Ionicons } from '../Icon';
import api from '../../services/api';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Maschera input data: digiti solo cifre, output gg/mm/aaaa
const formatDateMask = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const isoToDdmmyyyy = (iso?: string | null): string => {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const ddmmyyyyToIso = (val: string): string | null => {
  const m = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};

export const CompensationExportModal: React.FC<Props> = ({ visible, onClose }) => {
  const [loadingDefault, setLoadingDefault] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [seasonLabel, setSeasonLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      setLoadingDefault(true);
      setError(null);
      try {
        const res = await api.get('/admin/compensation-summary/default-range');
        const s = isoToDdmmyyyy(res.data?.start_date);
        const e = isoToDdmmyyyy(res.data?.end_date);
        setStart(s);
        setEnd(e);
        setSeasonLabel(res.data?.label || '');
      } catch (err) {
        // Range vuoto, l'admin lo deve compilare
        setStart('');
        setEnd('');
        setSeasonLabel('');
      } finally {
        setLoadingDefault(false);
      }
    })();
  }, [visible]);

  const handleDownload = async () => {
    setError(null);
    const startIso = ddmmyyyyToIso(start);
    const endIso = ddmmyyyyToIso(end);
    if (!startIso || !endIso) {
      setError('Inserisci entrambe le date nel formato gg/mm/aaaa');
      return;
    }
    if (new Date(endIso) < new Date(startIso)) {
      setError('La data di fine deve essere successiva alla data di inizio');
      return;
    }

    setDownloading(true);
    try {
      const res = await api.get('/admin/compensation-summary/export-xlsx', {
        params: { start_date: startIso, end_date: endIso },
        responseType: 'blob',
      });
      const filename = `riepilogo_compensi_${startIso.replace(/-/g, '')}_${endIso.replace(/-/g, '')}.xlsx`;

      if (Platform.OS === 'web') {
        const blob = res.data instanceof Blob
          ? res.data
          : new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        // Su mobile usiamo FileSystem + Sharing (già in dependency)
        const FileSystem = require('expo-file-system');
        const Sharing = require('expo-sharing');
        const path = FileSystem.cacheDirectory + filename;
        // Convert blob to base64
        const blob = res.data;
        const reader = new FileReader();
        await new Promise<void>((resolve, reject) => {
          reader.onload = async () => {
            try {
              const b64 = (reader.result as string).split(',')[1] || '';
              await FileSystem.writeAsStringAsync(path, b64, {
                encoding: FileSystem.EncodingType.Base64,
              });
              await Sharing.shareAsync(path, {
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                dialogTitle: 'Riepilogo Compensi',
              });
              resolve();
            } catch (e) {
              reject(e);
            }
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
      }
      onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.detail ||
        (err?.response?.status === 400 ? 'Date non valide' : 'Errore durante il download');
      setError(detail);
      if (Platform.OS !== 'web') {
        Alert.alert('Errore', detail);
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard} testID="compensation-export-modal">
          <View style={styles.header}>
            <Text style={styles.title}>📊 Esporta Riepilogo Compensi</Text>
            <TouchableOpacity onPress={onClose} testID="export-modal-close">
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Genera un file Excel con tutti i compensi del periodo, persona per persona.
            Le date sono pre-compilate con la stagione della società.
          </Text>

          {seasonLabel ? (
            <View style={styles.seasonBadge}>
              <Ionicons name="calendar" size={14} color="#1565C0" />
              <Text style={styles.seasonBadgeText}>{seasonLabel}</Text>
            </View>
          ) : null}

          {loadingDefault ? (
            <ActivityIndicator size="small" color="#1976D2" style={{ marginVertical: 14 }} />
          ) : (
            <>
              <View style={styles.fieldRow}>
                <View style={styles.field}>
                  <Text style={styles.label}>Dal</Text>
                  <TextInput
                    value={start}
                    onChangeText={(t) => setStart(formatDateMask(t))}
                    placeholder="gg/mm/aaaa"
                    style={styles.input}
                    keyboardType="numeric"
                    maxLength={10}
                    testID="export-start-date"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Al</Text>
                  <TextInput
                    value={end}
                    onChangeText={(t) => setEnd(formatDateMask(t))}
                    placeholder="gg/mm/aaaa"
                    style={styles.input}
                    keyboardType="numeric"
                    maxLength={10}
                    testID="export-end-date"
                  />
                </View>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#C62828" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={downloading}
                  testID="export-cancel-btn"
                >
                  <Text style={styles.cancelText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.downloadBtn, downloading && { opacity: 0.6 }]}
                  onPress={handleDownload}
                  disabled={downloading}
                  testID="export-download-btn"
                >
                  {downloading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="download" size={16} color="#fff" />
                      <Text style={styles.downloadText}>Scarica XLSX</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          <Text style={styles.footnote}>
            💡 Include tutti i ruoli compensati (Allenatori, Dirigenti, Collaboratori, Atleti PRO).
            Calcolo proporzionale con regola dei quartili settimanali per mesi parziali.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 22,
    width: '100%',
    maxWidth: 520,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1A237E' },
  subtitle: { fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 18 },
  seasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 6,
  },
  seasonBadgeText: { color: '#1565C0', fontSize: 12, fontWeight: '600' },
  fieldRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  field: { flex: 1 },
  label: { fontSize: 12, color: '#444', fontWeight: '600', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#BDBDBD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#FAFAFA',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  errorText: { color: '#C62828', fontSize: 13, flex: 1 },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BDBDBD',
    backgroundColor: '#fff',
  },
  cancelText: { color: '#555', fontWeight: '600' },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2E7D32',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  downloadText: { color: '#fff', fontWeight: '700' },
  footnote: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 14,
    lineHeight: 16,
  },
});

export default CompensationExportModal;
