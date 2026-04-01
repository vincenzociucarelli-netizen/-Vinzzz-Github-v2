import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Platform,
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

  const fetchConsents = async () => {
    try {
      const endpoint =
        entityType === 'user'
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
        entityType === 'user'
          ? '/users/me/consents'
          : `/athletes/${entityId}/consents`;
      const body: any = {};
      body[type] = newVal;
      const res = await api.patch(endpoint, body);
      setConsents(res.data.consents || {});
      // Refresh history
      const refreshRes = await api.get(
        entityType === 'user'
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

  const consentTypes = ['privacy_viewed', 'images_internal', 'images_promo'] as const;
  const editableTypes = ['images_internal', 'images_promo'];
  const privacySigned = consents?.privacy_viewed?.value === true;

  return (
    <View style={[s.card, { borderTopColor: accentColor }]} data-testid={`consent-card-${entityType}-${entityId || 'me'}`}>
      <Text style={s.cardTitle}>
        {entityName ? `Consensi - ${entityName}` : 'Consensi Privacy'}
      </Text>

      {consentTypes.map((type) => {
        const c = consents?.[type];
        const isEditable = editableTypes.includes(type);
        const value = c?.value ?? null;

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
});
