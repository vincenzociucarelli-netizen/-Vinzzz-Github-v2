import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../../src/components/Icon';
import api from '../../../src/services/api';

const CONSENT_LABELS: Record<string, string> = {
  privacy_viewed: 'Presa visione Privacy',
  data_treatment: 'Trattamento dati',
  images_internal: 'Immagini uso interno',
  images_promo: 'Immagini promozionali',
};

const ROLE_LABELS: Record<string, string> = {
  parent: 'Genitore',
  coach: 'Allenatore',
  viewer: 'Dirigente',
  collaboratore: 'Collaboratore',
  athlete: 'Atleta adulto',
  atleta: 'Atleta',
};

const formatDate = (ts: string | null): string => {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleDateString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ts; }
};

export default function ConsentAuditPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [entities, setEntities] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);

  const fetchAll = async () => {
    try {
      const res = await api.get('/admin/all-consents');
      setEntities(res.data || []);
    } catch (e) {
      console.error('Error fetching consents:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openDetail = async (entity: any) => {
    setSelectedEntity(entity);
    setDetailLoading(true);
    try {
      const res = await api.get(`/admin/consent-history/${entity.entity_type}/${entity.entity_id}`);
      setDetailData(res.data);
    } catch (e) {
      console.error('Error fetching detail:', e);
    } finally {
      setDetailLoading(false);
    }
  };

  const getConsentBadge = (consents: any, type: string) => {
    const c = consents?.[type];
    if (!c) return null;
    return (
      <View style={[s.badge, { backgroundColor: c.value ? '#E8F5E9' : '#FFEBEE' }]} key={type}>
        <Ionicons
          name={c.value ? 'checkmark-circle' : 'close-circle'}
          size={14}
          color={c.value ? '#4CAF50' : '#F44336'}
        />
        <Text style={[s.badgeText, { color: c.value ? '#2E7D32' : '#C62828' }]}>
          {CONSENT_LABELS[type]?.split(' ').slice(-1)[0] || type}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 8 }}>
            <Ionicons name="chevron-back" size={24} color="#2E7D32" />
          </View>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Consensi Privacy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.content} data-testid="consent-audit-list">
        {entities.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="shield-outline" size={48} color="#ccc" />
            <Text style={s.emptyText}>Nessun consenso registrato</Text>
          </View>
        ) : (
          entities.map((e, i) => (
            <TouchableOpacity
              key={`${e.entity_type}-${e.entity_id}-${i}`}
              style={s.card}
              onPress={() => openDetail(e)}
              data-testid={`consent-entity-${e.entity_id}`}
            >
              <View style={s.cardTop}>
                <View style={s.cardInfo}>
                  <Text style={s.entityName}>{e.full_name || 'N/D'}</Text>
                  <View style={s.tagRow}>
                    <View style={[s.roleTag, { backgroundColor: e.entity_type === 'user' ? '#E3F2FD' : '#FFF3E0' }]}>
                      <Text style={[s.roleTagText, { color: e.entity_type === 'user' ? '#1565C0' : '#E65100' }]}>
                        {e.entity_type === 'user' ? ROLE_LABELS[e.role] || e.role : 'Atleta'}
                      </Text>
                    </View>
                    {e.email && (
                      <Text style={s.emailText} numberOfLines={1}>{e.email}</Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
              <View style={s.badgeRow}>
                {getConsentBadge(e.consents, 'privacy_viewed')}
                {getConsentBadge(e.consents, 'data_treatment')}
                {getConsentBadge(e.consents, 'images_internal')}
                {getConsentBadge(e.consents, 'images_promo')}
              </View>
              {e.history_count > 0 && (
                <Text style={s.historyCount}>
                  {e.history_count} modific{e.history_count === 1 ? 'a' : 'he'} registrat{e.history_count === 1 ? 'a' : 'e'}
                  {e.last_change ? ` - ultima: ${formatDate(e.last_change)}` : ''}
                </Text>
              )}
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={!!selectedEntity} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {detailData?.full_name || selectedEntity?.full_name || ''}
              </Text>
              <TouchableOpacity onPress={() => { setSelectedEntity(null); setDetailData(null); }}>
                <Ionicons name="close-circle" size={28} color="#999" />
              </TouchableOpacity>
            </View>

            {detailLoading ? (
              <ActivityIndicator size="large" color="#2E7D32" style={{ marginTop: 30 }} />
            ) : detailData ? (
              <ScrollView style={s.modalScroll}>
                {/* Current consents */}
                <Text style={s.sectionTitle}>Stato Attuale</Text>
                {['privacy_viewed', 'data_treatment', 'images_internal', 'images_promo'].map((type) => {
                  const c = detailData.consents?.[type];
                  return (
                    <View key={type} style={s.consentDetailRow}>
                      <Ionicons
                        name={c?.value === true ? 'checkmark-circle' : c?.value === false ? 'close-circle' : 'help-circle-outline'}
                        size={18}
                        color={c?.value === true ? '#4CAF50' : c?.value === false ? '#F44336' : '#999'}
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={s.consentDetailLabel}>{CONSENT_LABELS[type]}</Text>
                        {c ? (
                          <Text style={s.consentDetailMeta}>
                            {c.value ? 'Concesso' : 'Negato'} il {formatDate(c.timestamp)}
                            {c.ip_address ? ` | IP: ${c.ip_address}` : ''}
                          </Text>
                        ) : (
                          <Text style={s.consentDetailMeta}>Non espresso</Text>
                        )}
                      </View>
                    </View>
                  );
                })}

                {/* History */}
                {detailData.consent_history?.length > 0 && (
                  <>
                    <Text style={[s.sectionTitle, { marginTop: 20 }]}>Cronologia Modifiche</Text>
                    {[...detailData.consent_history].reverse().map((h: any, i: number) => (
                      <View key={i} style={s.historyItem}>
                        <View style={s.historyDot} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.historyLabel}>{CONSENT_LABELS[h.type] || h.type}</Text>
                          <Text style={s.historyChange}>
                            {h.old_value === null ? 'N/D' : h.old_value ? 'Si' : 'No'}
                            {' → '}
                            <Text style={{ color: h.new_value ? '#4CAF50' : '#F44336', fontWeight: '700' }}>
                              {h.new_value ? 'Si' : 'No'}
                            </Text>
                          </Text>
                          <Text style={s.historyMeta}>
                            {formatDate(h.timestamp)}{h.ip_address ? ` | IP: ${h.ip_address}` : ''}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}
                <View style={{ height: 30 }} />
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#2E7D32',
    paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  content: { flex: 1, padding: 16 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardInfo: { flex: 1 },
  entityName: { fontSize: 16, fontWeight: '700', color: '#333' },
  tagRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8, flexWrap: 'wrap' },
  roleTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  roleTagText: { fontSize: 12, fontWeight: '600' },
  emailText: { fontSize: 12, color: '#999' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 6 },
  badge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: 12, gap: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  historyCount: { fontSize: 11, color: '#999', marginTop: 8, fontStyle: 'italic' },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '85%', paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', flex: 1 },
  modalScroll: { paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: '#2E7D32',
    textTransform: 'uppercase', letterSpacing: 1, marginTop: 10, marginBottom: 12,
  },
  consentDetailRow: {
    flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  consentDetailLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  consentDetailMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  historyItem: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 10,
  },
  historyDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#2E7D32', marginTop: 5,
  },
  historyLabel: { fontSize: 13, fontWeight: '600', color: '#333' },
  historyChange: { fontSize: 13, color: '#666', marginTop: 2 },
  historyMeta: { fontSize: 11, color: '#999', marginTop: 2 },
});
