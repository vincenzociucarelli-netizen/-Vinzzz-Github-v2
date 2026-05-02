import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
  Image,
  ScrollView,
} from 'react-native';
import api from '../services/api';
import { Ionicons } from './Icon';

interface ConsentManagerProps {
  entityType: 'user' | 'athlete';
  entityId?: string;
  entityName?: string;
  accentColor?: string;
}

const CONSENT_LABELS: Record<string, string> = {
  privacy_viewed: 'Presa visione Informativa Privacy',
  images_internal: 'Utilizzo immagini ad uso interno',
  images_promo: 'Utilizzo immagini a scopo promozionale',
};

const formatDate = (ts: string | null | undefined): string => {
  if (!ts) return '-';
  try {
    const d = new Date(ts);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
};

export const ConsentManager: React.FC<ConsentManagerProps> = ({
  entityType,
  entityId,
  entityName,
  accentColor = '#E91E63',
}) => {
  const [consents, setConsents] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [requestingSent, setRequestingSent] = useState(false);
  
  // Photo removal request modal state
  const [removalModalVisible, setRemovalModalVisible] = useState(false);
  const [removalNote, setRemovalNote] = useState('');
  const [removalScreenshot, setRemovalScreenshot] = useState<string | null>(null);  // data URL
  const [removalFilename, setRemovalFilename] = useState<string | null>(null);
  const [removalSubmitting, setRemovalSubmitting] = useState(false);

  const fetchConsents = async () => {
    try {
      const endpoint =
        (entityType === 'user' || entityType === 'staff')
          ? '/users/me/consents'
          : `/athletes/${entityId}/consents`;
      const res = await api.get(endpoint);
      setConsents(res.data.consents || {});
      setHistory(res.data.consent_history || []);
    } catch (e) {
      console.error('Error fetching consents:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsents();
  }, [entityId]);

  const toggleConsent = async (type: 'images_internal' | 'images_promo', newVal: boolean) => {
    setSaving(type);
    try {
      const endpoint =
        (entityType === 'user' || entityType === 'staff')
          ? '/users/me/consents'
          : `/athletes/${entityId}/consents`;
      const body: any = {};
      body[type] = newVal;
      const res = await api.patch(endpoint, body);
      setConsents(res.data.consents || {});
      // Refresh history
      const refreshRes = await api.get(
        (entityType === 'user' || entityType === 'staff')
          ? '/users/me/consents'
          : `/athletes/${entityId}/consents`
      );
      setHistory(refreshRes.data.consent_history || []);
    } catch (e) {
      console.error('Error updating consent:', e);
      if (Platform.OS === 'web') {
        window.alert('Errore nel salvataggio del consenso');
      }
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <View style={[s.card, { borderTopColor: accentColor }]}>
        <Text style={s.cardTitle}>Consensi Privacy</Text>
        <ActivityIndicator size="small" color={accentColor} />
      </View>
    );
  }

  // For parents (user), hide images_internal - covered by legitimate interest
  // For staff (coaches), show both image consents
  const consentTypes = entityType === 'user' 
    ? ['privacy_viewed', 'images_promo'] as const
    : ['privacy_viewed', 'images_internal', 'images_promo'] as const;
  const editableTypes = entityType === 'user'
    ? ['images_promo']
    : ['images_internal', 'images_promo'];
  const privacySigned = consents?.privacy_viewed?.value === true;

  const handlePhotoRemovalRequest = () => {
    // Apre il modal invece di inviare subito
    setRemovalNote('');
    setRemovalScreenshot(null);
    setRemovalFilename(null);
    setRemovalModalVisible(true);
  };
  
  // File picker (solo web) per allegare uno screenshot
  const handlePickScreenshot = () => {
    if (Platform.OS !== 'web') {
      window?.alert?.('Funzione disponibile solo via browser web.');
      return;
    }
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/gif,image/webp';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Validazione dimensione (max 1 MB)
        if (file.size > 1024 * 1024) {
          window.alert(`L'immagine è troppo grande (${(file.size/1024/1024).toFixed(2)} MB). Massimo 1 MB.`);
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = ev.target?.result as string;
          if (result) {
            setRemovalScreenshot(result);  // data URL completo
            setRemovalFilename(file.name);
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    } catch (err) {
      console.error('File picker error:', err);
      window.alert('Errore selezione file');
    }
  };
  
  const submitPhotoRemovalRequest = async () => {
    setRemovalSubmitting(true);
    try {
      const payload: any = {};
      if (removalNote.trim()) payload.note = removalNote.trim();
      if (removalScreenshot) {
        payload.screenshot_data = removalScreenshot;
        payload.screenshot_filename = removalFilename || 'screenshot.png';
      }
      await api.post('/notifications/photo-removal-request', payload);
      setRequestingSent(true);
      setRemovalModalVisible(false);
      if (Platform.OS === 'web') {
        window.alert("Richiesta inviata! L'admin riceverà la tua richiesta di rimozione immagini.");
      }
    } catch (e: any) {
      console.error('Error sending photo removal request:', e);
      const msg = e?.response?.data?.detail || "Errore nell'invio della richiesta";
      if (Platform.OS === 'web') window.alert(msg);
    } finally {
      setRemovalSubmitting(false);
    }
  };

  return (
    <View style={[s.card, { borderTopColor: accentColor }]} data-testid={`consent-card-${entityType}-${entityId || 'me'}`}>
      <Text style={s.cardTitle}>
        {entityName ? `Consensi - ${entityName}` : 'Consensi Privacy'}
      </Text>

      {consentTypes.map((type) => {
        const c = consents?.[type];
        const isEditable = editableTypes.includes(type);
        // Handle both boolean (legacy) and object {value, timestamp} formats
        const value = typeof c === 'boolean' ? c : (c?.value ?? null);

        return (
          <View key={type} style={s.consentRow} data-testid={`consent-row-${type}`}>
            <View style={s.consentLeft}>
              <View style={s.consentIcon}>
                <Ionicons
                  name={value === true ? 'checkmark-circle' : value === false ? 'close-circle' : 'help-circle-outline'}
                  size={20}
                  color={value === true ? '#4CAF50' : value === false ? '#F44336' : '#999'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.consentLabel}>{CONSENT_LABELS[type] || type}</Text>
                {c?.timestamp && (
                  <Text style={s.consentDate}>{formatDate(c.timestamp)}</Text>
                )}
                {value === null && (
                  <Text style={s.consentDate}>Non ancora espresso</Text>
                )}
              </View>
            </View>
            {isEditable ? (
              <View style={s.consentRight}>
                {!privacySigned ? (
                  <Text style={{ fontSize: 11, color: '#999' }}>-</Text>
                ) : saving === type ? (
                  <ActivityIndicator size="small" color={accentColor} />
                ) : (
                  <Switch
                    value={value === true}
                    onValueChange={(newVal) => toggleConsent(type as any, newVal)}
                    trackColor={{ false: '#ddd', true: `${accentColor}80` }}
                    thumbColor={value === true ? accentColor : '#f4f3f4'}
                    data-testid={`consent-switch-${type}`}
                  />
                )}
              </View>
            ) : (
              <View style={s.consentRight}>
                <Text style={[s.consentFixed, { color: value ? '#4CAF50' : '#999' }]}>
                  {value === true ? 'Dato' : value === false ? 'Negato' : '-'}
                </Text>
              </View>
            )}
          </View>
        );
      })}

      <Text style={s.consentHint}>
        {privacySigned 
          ? 'Solo i consensi relativi alle immagini sono modificabili. I consensi obbligatori non possono essere revocati.'
          : 'Per attivare i consensi è necessario prima firmare la privacy, a fine o ad interruzione anticipata del periodo di prova.'}
      </Text>

      {/* Photo removal request button - only for users (parents/staff) */}
      {entityType === 'user' && (
        <TouchableOpacity
          style={[s.photoRemovalBtn, requestingSent && { opacity: 0.6 }]}
          onPress={handlePhotoRemovalRequest}
          disabled={requestingSent}
          data-testid="photo-removal-request-btn"
        >
          <Ionicons name={requestingSent ? "checkmark-circle" : "trash-outline"} size={18} color={requestingSent ? "#4CAF50" : "#D32F2F"} />
          <Text style={[s.photoRemovalText, requestingSent && { color: '#4CAF50' }]}>
            {requestingSent ? 'Richiesta inviata' : 'Richiedi rimozione mie immagini'}
          </Text>
        </TouchableOpacity>
      )}

      {/* History toggle */}
      {history.length > 0 && (
        <TouchableOpacity
          style={s.historyToggle}
          onPress={() => setShowHistory(!showHistory)}
          data-testid="consent-history-toggle"
        >
          <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={18} color={accentColor} />
          <Text style={[s.historyToggleText, { color: accentColor }]}>
            {showHistory ? 'Nascondi cronologia' : `Cronologia modifiche (${history.length})`}
          </Text>
        </TouchableOpacity>
      )}

      {showHistory && history.length > 0 && (
        <View style={s.historyContainer} data-testid="consent-history-list">
          {[...history].reverse().map((h, i) => (
            <View key={i} style={s.historyItem}>
              <View style={s.historyDot} />
              <View style={{ flex: 1 }}>
                <Text style={s.historyText}>
                  <Text style={{ fontWeight: '600' }}>{CONSENT_LABELS[h.type] || h.type}</Text>
                  {': '}
                  <Text style={{ color: '#F44336' }}>{h.old_value === null ? 'N/D' : h.old_value ? 'Si' : 'No'}</Text>
                  {' → '}
                  <Text style={{ color: h.new_value ? '#4CAF50' : '#F44336' }}>{h.new_value ? 'Si' : 'No'}</Text>
                </Text>
                <Text style={s.historyDate}>{formatDate(h.timestamp)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
      
      {/* Photo Removal Request Modal */}
      <Modal visible={removalModalVisible} animationType="fade" transparent onRequestClose={() => setRemovalModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard} data-testid="photo-removal-modal">
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Richiesta rimozione immagini</Text>
              <TouchableOpacity onPress={() => setRemovalModalVisible(false)} disabled={removalSubmitting}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 480 }}>
              <Text style={s.modalIntro}>
                Aiuta l'admin a identificare velocemente l'immagine da rimuovere allegando uno screenshot
                e/o una breve descrizione (es. data del post, sezione del sito web, social network).
              </Text>
              
              <Text style={s.modalLabel}>Descrizione (opzionale)</Text>
              <TextInput
                style={s.modalTextarea}
                placeholder="Es: Foto del 12/04/2026 sul post Instagram della società in cui appaio in primo piano..."
                placeholderTextColor="#999"
                value={removalNote}
                onChangeText={setRemovalNote}
                multiline
                numberOfLines={4}
                maxLength={1000}
                data-testid="photo-removal-note-input"
              />
              <Text style={s.modalHint}>{removalNote.length}/1000 caratteri</Text>
              
              <Text style={s.modalLabel}>Screenshot (opzionale, max 1 MB)</Text>
              {removalScreenshot ? (
                <View style={s.screenshotPreviewBox}>
                  <Image source={{ uri: removalScreenshot }} style={s.screenshotPreview} resizeMode="contain" />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <Text style={s.screenshotFilename} numberOfLines={1}>📎 {removalFilename}</Text>
                    <TouchableOpacity
                      onPress={() => { setRemovalScreenshot(null); setRemovalFilename(null); }}
                      style={s.removeScreenshotBtn}
                      data-testid="remove-screenshot-btn"
                    >
                      <Ionicons name="trash-outline" size={14} color="#D32F2F" />
                      <Text style={s.removeScreenshotText}>Rimuovi</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={s.uploadBtn}
                  onPress={handlePickScreenshot}
                  data-testid="photo-removal-upload-btn"
                >
                  <Ionicons name="image-outline" size={18} color="#1976D2" />
                  <Text style={s.uploadBtnText}>Allega screenshot</Text>
                </TouchableOpacity>
              )}
              
              <View style={s.modalNote}>
                <Ionicons name="information-circle" size={14} color="#0277BD" />
                <Text style={s.modalNoteText}>
                  Puoi inviare la richiesta anche senza descrizione né screenshot.
                </Text>
              </View>
            </ScrollView>
            
            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalBtnCancel}
                onPress={() => setRemovalModalVisible(false)}
                disabled={removalSubmitting}
                data-testid="photo-removal-cancel-btn"
              >
                <Text style={s.modalBtnCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtnConfirm, removalSubmitting && { opacity: 0.6 }]}
                onPress={submitPhotoRemovalRequest}
                disabled={removalSubmitting}
                data-testid="photo-removal-submit-btn"
              >
                {removalSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text style={s.modalBtnConfirmText}>Invia richiesta</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderTopWidth: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  consentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  consentIcon: {
    width: 28,
    alignItems: 'center',
  },
  consentLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  consentDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  consentRight: {
    marginLeft: 8,
    alignItems: 'center',
    minWidth: 50,
  },
  consentFixed: {
    fontSize: 13,
    fontWeight: '600',
  },
  consentHint: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 8,
    gap: 6,
  },
  historyToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  historyContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    marginTop: 5,
  },
  historyText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  historyDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  photoRemovalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  photoRemovalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D32F2F',
  },
  // Photo removal modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    width: '100%',
    maxWidth: 520,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  modalIntro: {
    fontSize: 13,
    color: '#666',
    lineHeight: 19,
    marginBottom: 14,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 4,
  },
  modalTextarea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#333',
    minHeight: 90,
    textAlignVertical: 'top',
    backgroundColor: '#fafafa',
  },
  modalHint: {
    fontSize: 11,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 8,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBDEFB',
    borderStyle: 'dashed',
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1976D2',
  },
  screenshotPreviewBox: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#fafafa',
  },
  screenshotPreview: {
    width: '100%',
    height: 180,
    borderRadius: 6,
    backgroundColor: '#eee',
  },
  screenshotFilename: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  removeScreenshotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#FFEBEE',
  },
  removeScreenshotText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D32F2F',
  },
  modalNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#E1F5FE',
    borderRadius: 6,
  },
  modalNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#0277BD',
    lineHeight: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalBtnCancel: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  modalBtnCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  modalBtnConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#D32F2F',
  },
  modalBtnConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});
