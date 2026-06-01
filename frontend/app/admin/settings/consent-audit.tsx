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
import InstitutionalBanner from '../../../src/components/InstitutionalBanner';
import api from '../../../src/services/api';

const CONSENT_LABELS: Record<string, string> = {
  privacy_viewed: 'Presa visione Privacy',
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

  // Filters
  const [consentTypeFilter, setConsentTypeFilter] = useState<'all' | 'privacy_viewed' | 'images_internal' | 'images_promo'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'given' | 'denied' | 'missing'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [groupByTeam, setGroupByTeam] = useState<boolean>(false);
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});

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

  // Apply filters
  const filtered = entities.filter((e) => {
    // Role filter
    if (roleFilter !== 'all') {
      if (roleFilter === 'athlete') {
        if (e.entity_type !== 'athlete') return false;
      } else {
        if (e.entity_type !== 'user' || e.role !== roleFilter) return false;
      }
    }
    // Consent type + status filter
    if (consentTypeFilter !== 'all' || statusFilter !== 'all') {
      const types = consentTypeFilter === 'all'
        ? ['privacy_viewed', 'images_internal', 'images_promo']
        : [consentTypeFilter];
      // Check at least one consent type matches the status filter
      const matches = types.some((t) => {
        const c = e.consents?.[t];
        if (statusFilter === 'all') return !!c || statusFilter === 'all';
        if (statusFilter === 'given') return c && c.value === true;
        if (statusFilter === 'denied') return c && c.value === false;
        if (statusFilter === 'missing') return !c;
        return true;
      });
      if (!matches) return false;
    }
    return true;
  });

  // Group by team (only athletes have team_id)
  const groupedByTeam: Record<string, any[]> = {};
  if (groupByTeam) {
    filtered.forEach((e) => {
      const key = e.entity_type === 'athlete'
        ? (e.team_name || 'Senza squadra')
        : 'Staff (non assegnabile a squadra)';
      if (!groupedByTeam[key]) groupedByTeam[key] = [];
      groupedByTeam[key].push(e);
    });
  }
  const teamGroupKeys = Object.keys(groupedByTeam).sort();

  const renderEntityCard = (e: any, i: number) => (
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
            {e.team_name && (
              <View style={[s.roleTag, { backgroundColor: '#E8F5E9' }]}>
                <Text style={[s.roleTagText, { color: '#2E7D32' }]}>{e.team_name}</Text>
              </View>
            )}
            {e.email && (
              <Text style={s.emailText} numberOfLines={1}>{e.email}</Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </View>
      <View style={s.badgeRow}>
        {getConsentBadge(e.consents, 'privacy_viewed')}
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
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))} style={s.backBtn}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 8 }}>
            <Ionicons name="chevron-back" size={24} color="#2E7D32" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/admin')} data-testid="header-home-btn" style={{ marginLeft: 8 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="home" size={20} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Consensi Privacy</Text>
        <View style={{ width: 40 }} />
      </View>

      <InstitutionalBanner />

      {/* Filters bar */}
      <View style={s.filtersBar}>
        <Text style={s.filterLabel}>Tipo consenso:</Text>
        <View style={s.chipRow}>
          {[
            { k: 'all', l: 'Tutti' },
            { k: 'privacy_viewed', l: 'Privacy' },
            { k: 'images_internal', l: 'Interno' },
            { k: 'images_promo', l: 'Promo' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.k}
              style={[s.chip, consentTypeFilter === opt.k && s.chipActive]}
              onPress={() => setConsentTypeFilter(opt.k as any)}
              data-testid={`filter-consent-${opt.k}`}
            >
              <Text style={[s.chipText, consentTypeFilter === opt.k && s.chipTextActive]}>{opt.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.filterLabel}>Stato:</Text>
        <View style={s.chipRow}>
          {[
            { k: 'all', l: 'Tutti' },
            { k: 'given', l: '✅ Concessi' },
            { k: 'denied', l: '🚫 Negati' },
            { k: 'missing', l: '— Non espressi' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.k}
              style={[s.chip, statusFilter === opt.k && s.chipActive]}
              onPress={() => setStatusFilter(opt.k as any)}
              data-testid={`filter-status-${opt.k}`}
            >
              <Text style={[s.chipText, statusFilter === opt.k && s.chipTextActive]}>{opt.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.filterLabel}>Ruolo:</Text>
        <View style={s.chipRow}>
          {[
            { k: 'all', l: 'Tutti' },
            { k: 'athlete', l: 'Atleti' },
            { k: 'parent', l: 'Genitori' },
            { k: 'coach', l: 'Coach' },
            { k: 'viewer', l: 'Dirigenti' },
            { k: 'collaboratore', l: 'Collaboratori' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.k}
              style={[s.chip, roleFilter === opt.k && s.chipActive]}
              onPress={() => setRoleFilter(opt.k)}
              data-testid={`filter-role-${opt.k}`}
            >
              <Text style={[s.chipText, roleFilter === opt.k && s.chipTextActive]}>{opt.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[s.chip, groupByTeam && s.chipActive, { marginTop: 6, alignSelf: 'flex-start' }]}
          onPress={() => setGroupByTeam(!groupByTeam)}
          data-testid="filter-group-by-team"
        >
          <Text style={[s.chipText, groupByTeam && s.chipTextActive]}>
            {groupByTeam ? '✓ Raggruppato per squadra' : '🏐 Raggruppa per squadra'}
          </Text>
        </TouchableOpacity>
        <Text style={s.counter}>
          {filtered.length} risultat{filtered.length === 1 ? 'o' : 'i'} su {entities.length}
        </Text>
      </View>

      <ScrollView style={s.content} data-testid="consent-audit-list">
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="shield-outline" size={48} color="#ccc" />
            <Text style={s.emptyText}>Nessun risultato con i filtri selezionati</Text>
          </View>
        ) : groupByTeam ? (
          teamGroupKeys.map((teamKey) => {
            const isOpen = expandedTeams[teamKey] !== false; // open by default
            return (
              <View key={teamKey} style={{ marginBottom: 12 }}>
                <TouchableOpacity
                  style={s.teamHeader}
                  onPress={() => setExpandedTeams((p) => ({ ...p, [teamKey]: !isOpen }))}
                  data-testid={`team-group-${teamKey}`}
                >
                  <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={20} color="#fff" />
                  <Text style={s.teamHeaderText}>{teamKey}</Text>
                  <View style={s.teamCountBadge}>
                    <Text style={s.teamCountText}>{groupedByTeam[teamKey].length}</Text>
                  </View>
                </TouchableOpacity>
                {isOpen && groupedByTeam[teamKey].map((e, i) => renderEntityCard(e, i))}
              </View>
            );
          })
        ) : (
          filtered.map((e, i) => renderEntityCard(e, i))
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
                {['privacy_viewed', 'images_internal', 'images_promo'].map((type) => {
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
  filtersBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  chipActive: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  chipText: { fontSize: 12, color: '#555', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  counter: { fontSize: 11, color: '#999', marginTop: 8, fontStyle: 'italic', textAlign: 'right' },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    marginBottom: 6,
  },
  teamHeaderText: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 15 },
  teamCountBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 28,
    alignItems: 'center',
  },
  teamCountText: { color: '#2E7D32', fontWeight: '700', fontSize: 12 },
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
