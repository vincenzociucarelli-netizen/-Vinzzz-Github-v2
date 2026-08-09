import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import api from '../services/api';
import { Ionicons } from './Icon';

interface AdminConsentViewProps {
  entityType: 'athlete' | 'user';
  entityId: string;
  entityName?: string;
  accentColor?: string;
  defaultOpen?: boolean;
}

const CONSENT_LABELS: Record<string, string> = {
  privacy_viewed: 'Presa visione Informativa Privacy',
  images_internal: 'Utilizzo immagini ad uso interno',
  images_promo: 'Utilizzo immagini a scopo promozionale',
};

const formatDate = (ts: string | null | undefined): string => {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleDateString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(ts);
  }
};

const _val = (entry: any): boolean | null => {
  if (typeof entry === 'boolean') return entry;
  if (entry && typeof entry === 'object') return entry.value ?? null;
  return null;
};

// Read-only consent panel for admins. Shows privacy signature status, image
// consents (final + per-parent for minors) and the full change history.
export const AdminConsentView: React.FC<AdminConsentViewProps> = ({
  entityType,
  entityId,
  entityName,
  accentColor = '#1976D2',
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [consents, setConsents] = useState<Record<string, any>>({});
  const [finalConsents, setFinalConsents] = useState<Record<string, any>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (entityType === 'athlete') {
        const res = await api.get(`/athletes/${entityId}/consents`);
        setConsents(res.data.consents || {});
        setFinalConsents(res.data.final_consents || {});
        setHistory(res.data.consent_history || []);
      } else {
        const res = await api.get(`/admin/consent-history/user/${entityId}`);
        setConsents(res.data.consents || {});
        setFinalConsents({});
        setHistory(res.data.consent_history || []);
      }
      setLoaded(true);
    } catch (e) {
      console.error('AdminConsentView load error', e);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    if (defaultOpen) load();
  }, [defaultOpen, load]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) load();
  };

  // Privacy signed if any privacy_viewed(_parent) === true
  const privacySigned = Object.keys(consents).some(
    (k) => (k === 'privacy_viewed' || k.startsWith('privacy_viewed__')) && _val(consents[k]) === true
  );

  const renderImageRow = (type: 'images_internal' | 'images_promo') => {
    const fc = finalConsents[type];
    // final value from backend (athlete). For users read direct key.
    let finalValue: boolean | null;
    let deniedCount = 0;
    if (entityType === 'athlete' && fc) {
      const perParent = fc.per_parent || {};
      const hasExpressed = Object.keys(perParent).length > 0;
      finalValue = hasExpressed ? !!fc.final_value : null;
      deniedCount = (fc.denied_by || []).length;
    } else {
      finalValue = _val(consents[type]);
    }
    const label = CONSENT_LABELS[type];
    const statusText = finalValue === true ? 'Dato' : finalValue === false ? 'Negato' : 'Non ancora espresso';
    const color = finalValue === true ? '#4CAF50' : finalValue === false ? '#F44336' : '#999';
    const icon = finalValue === true ? 'checkmark-circle' : finalValue === false ? 'close-circle' : 'help-circle-outline';
    return (
      <View key={type} style={s.row} data-testid={`admin-consent-row-${type}`}>
        <Ionicons name={icon as any} size={20} color={color} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.rowLabel}>{label}</Text>
          {deniedCount > 0 && (
            <Text style={s.deniedNote}>Negato da {deniedCount} genitore/i</Text>
          )}
        </View>
        <Text style={[s.rowStatus, { color }]}>{statusText}</Text>
      </View>
    );
  };

  return (
    <View style={[s.card, { borderTopColor: accentColor }]} data-testid={`admin-consent-view-${entityType}-${entityId}`}>
      <TouchableOpacity style={s.header} onPress={toggle} data-testid="admin-consent-toggle">
        <Ionicons name="shield-checkmark-outline" size={18} color={accentColor} />
        <Text style={[s.title, { color: accentColor }]}>
          Consensi Privacy {entityName ? `- ${entityName}` : ''} (sola lettura)
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#888" />
      </TouchableOpacity>

      {open && (
        <View style={{ marginTop: 8 }}>
          {loading ? (
            <ActivityIndicator size="small" color={accentColor} style={{ marginVertical: 12 }} />
          ) : (
            <>
              {/* Privacy signature status */}
              <View style={s.row}>
                <Ionicons
                  name={privacySigned ? 'checkmark-circle' : 'time-outline'}
                  size={20}
                  color={privacySigned ? '#4CAF50' : '#FB8C00'}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.rowLabel}>{CONSENT_LABELS.privacy_viewed}</Text>
                </View>
                <Text style={[s.rowStatus, { color: privacySigned ? '#4CAF50' : '#FB8C00' }]}>
                  {privacySigned ? 'Firmata' : 'In attesa'}
                </Text>
              </View>

              {renderImageRow('images_internal')}
              {renderImageRow('images_promo')}

              {!privacySigned && (
                <Text style={s.hint}>
                  La privacy non è ancora stata firmata (verrà firmata a fine periodo di prova).
                  Finché non è firmata i consensi immagine non sono espressi.
                </Text>
              )}

              {history.length > 0 && (
                <TouchableOpacity
                  style={s.historyToggle}
                  onPress={() => setShowHistory(!showHistory)}
                  data-testid="admin-consent-history-toggle"
                >
                  <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={16} color={accentColor} />
                  <Text style={[s.historyToggleText, { color: accentColor }]}>
                    {showHistory ? 'Nascondi cronologia' : `Cronologia modifiche (${history.length})`}
                  </Text>
                </TouchableOpacity>
              )}

              {showHistory && (
                <View style={s.historyBox}>
                  {[...history].reverse().map((h, i) => (
                    <View key={i} style={s.historyItem}>
                      <View style={s.historyDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.historyText}>
                          <Text style={{ fontWeight: '600' }}>{CONSENT_LABELS[h.type] || h.type}</Text>
                          {': '}
                          <Text style={{ color: '#F44336' }}>{h.old_value === null || h.old_value === undefined ? 'N/D' : h.old_value ? 'Sì' : 'No'}</Text>
                          {' → '}
                          <Text style={{ color: h.new_value ? '#4CAF50' : '#F44336' }}>{h.new_value ? 'Sì' : 'No'}</Text>
                        </Text>
                        <Text style={s.historyDate}>{formatDate(h.timestamp)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 16,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: 'bold' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowLabel: { fontSize: 14, color: '#333', fontWeight: '500' },
  deniedNote: { fontSize: 11, color: '#D32F2F', marginTop: 2 },
  rowStatus: { fontSize: 13, fontWeight: '600', marginLeft: 8 },
  hint: { fontSize: 11, color: '#999', fontStyle: 'italic', marginTop: 10, lineHeight: 16 },
  historyToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, gap: 6 },
  historyToggleText: { fontSize: 13, fontWeight: '600' },
  historyBox: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  historyItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10 },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#007AFF', marginTop: 5 },
  historyText: { fontSize: 13, color: '#333', lineHeight: 18 },
  historyDate: { fontSize: 11, color: '#999', marginTop: 2 },
});

export default AdminConsentView;
