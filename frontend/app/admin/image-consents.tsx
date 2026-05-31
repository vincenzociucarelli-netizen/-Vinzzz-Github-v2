import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';

type ConsentType = 'images_promo' | 'images_internal';

interface AthleteRow {
  athlete_id: string;
  full_name: string;
  team_id: string | null;
  team_name: string;
  is_minor: boolean;
  consent_given: boolean;
  denied_by_parents: string[];
  has_signed: boolean;
  privacy_accepted: boolean;
}

interface TeamGroup {
  team_id: string | null;
  team_name: string;
  athletes: AthleteRow[];
  count: number;
}

interface TeamOption {
  id: string;
  name: string;
}

export default function ImageConsentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [consentType, setConsentType] = useState<ConsentType>('images_promo');
  const [onlyDenied, setOnlyDenied] = useState(true);
  const [minorsOnly, setMinorsOnly] = useState(false);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [notifying, setNotifying] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    try {
      const res = await api.get('/teams');
      const tt = (res.data || []).map((t: any) => ({ id: t.id, name: t.name }));
      tt.sort((a: TeamOption, b: TeamOption) => a.name.localeCompare(b.name));
      setTeams(tt);
    } catch {
      // silent
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        consent_type: consentType,
        only_denied: onlyDenied,
        minors_only: minorsOnly,
      };
      if (teamFilter) params.team_id = teamFilter;
      const res = await api.get('/admin/athletes/image-consents', { params });
      setGroups(res.data.groups || []);
      setTotal(res.data.total || 0);
      // Expand all by default
      const exp: Record<string, boolean> = {};
      (res.data.groups || []).forEach((g: TeamGroup) => {
        exp[g.team_id || '_none_'] = true;
      });
      setExpanded(exp);
    } catch (error: any) {
      console.error('Error loading consents:', error);
    } finally {
      setLoading(false);
    }
  }, [consentType, onlyDenied, minorsOnly, teamFilter]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const exportCSV = () => {
    const lines = [
      ['Squadra', 'Atleta', 'Minorenne', 'Consenso', 'Genitori che hanno negato', 'Privacy firmata'].join(';'),
    ];
    groups.forEach((g) => {
      g.athletes.forEach((a) => {
        lines.push(
          [
            g.team_name,
            a.full_name,
            a.is_minor ? 'Sì' : 'No',
            a.consent_given ? 'SÌ' : 'NO',
            a.denied_by_parents.join(' / '),
            a.privacy_accepted ? 'Sì' : 'No',
          ].join(';'),
        );
      });
    });
    const csv = lines.join('\n');
    const typeLabel = consentType === 'images_promo' ? 'promo' : 'interno';
    const filename = `consensi-immagini-${typeLabel}-${new Date().toISOString().split('T')[0]}.csv`;
    if (Platform.OS === 'web') {
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const toggleExpand = (teamId: string | null) => {
    const k = teamId || '_none_';
    setExpanded((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const notifyTeam = async (teamId: string | null, teamName: string) => {
    if (!teamId) {
      if (Platform.OS === 'web') {
        window.alert('Impossibile inviare email per il gruppo "Senza squadra".');
      }
      return;
    }
    const msg = `Inviare email al coach di ${teamName} con la lista degli atleti senza consenso ${
      consentType === 'images_promo' ? 'promozionale' : 'uso interno'
    }? (in copia all\'email della società)`;
    const ok = Platform.OS === 'web'
      ? window.confirm(msg)
      : true;
    if (!ok) return;
    try {
      setNotifying(teamId);
      const res = await api.post('/admin/athletes/image-consents/notify-team', {
        team_id: teamId,
        consent_type: consentType,
      });
      const data = res.data;
      const sentTo = (data.sent_to || []).join(', ');
      const cc = (data.cc || []).join(', ');
      const successMsg =
        `Email inviata a ${data.sent_to.length} coach (${sentTo})` +
        (cc ? `\nIn copia: ${cc}` : '') +
        `\nAtleti senza consenso elencati: ${data.denied_count}`;
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Errore nell\'invio dell\'email';
      if (Platform.OS === 'web') {
        window.alert('❌ ' + msg);
      }
    } finally {
      setNotifying(null);
    }
  };

  const consentLabel = consentType === 'images_promo' ? 'promozionale' : 'uso interno';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          data-testid="image-consents-back-btn"
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Consensi Immagini</Text>
          <Text style={styles.headerSubtitle}>
            Stato consenso {consentLabel} per ogni atleta
          </Text>
        </View>
        <TouchableOpacity
          onPress={exportCSV}
          style={styles.exportBtn}
          data-testid="image-consents-export-btn"
        >
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text style={styles.exportBtnText}>CSV</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Filter: Tipo consenso */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Tipo consenso:</Text>
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, consentType === 'images_promo' && styles.tabBtnActive]}
              onPress={() => setConsentType('images_promo')}
              data-testid="tab-images-promo"
            >
              <Text style={[styles.tabText, consentType === 'images_promo' && styles.tabTextActive]}>
                📣 Promozionale
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, consentType === 'images_internal' && styles.tabBtnActive]}
              onPress={() => setConsentType('images_internal')}
              data-testid="tab-images-internal"
            >
              <Text style={[styles.tabText, consentType === 'images_internal' && styles.tabTextActive]}>
                🏛️ Uso interno
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter: only denied */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Mostra:</Text>
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, onlyDenied && styles.tabBtnActive]}
              onPress={() => setOnlyDenied(true)}
              data-testid="tab-only-denied"
            >
              <Text style={[styles.tabText, onlyDenied && styles.tabTextActive]}>🚫 Solo NEGATI</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, !onlyDenied && styles.tabBtnActive]}
              onPress={() => setOnlyDenied(false)}
              data-testid="tab-all-athletes"
            >
              <Text style={[styles.tabText, !onlyDenied && styles.tabTextActive]}>👥 Tutti</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter: minors only */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Età:</Text>
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, !minorsOnly && styles.tabBtnActive]}
              onPress={() => setMinorsOnly(false)}
              data-testid="tab-all-ages"
            >
              <Text style={[styles.tabText, !minorsOnly && styles.tabTextActive]}>Tutti</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, minorsOnly && styles.tabBtnActive]}
              onPress={() => setMinorsOnly(true)}
              data-testid="tab-minors-only"
            >
              <Text style={[styles.tabText, minorsOnly && styles.tabTextActive]}>Solo minorenni</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter: team */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Squadra:</Text>
          <View style={[styles.tabsRow, { flexWrap: 'wrap' }]}>
            <TouchableOpacity
              style={[styles.tabBtn, teamFilter === null && styles.tabBtnActive]}
              onPress={() => setTeamFilter(null)}
              data-testid="team-filter-all"
            >
              <Text style={[styles.tabText, teamFilter === null && styles.tabTextActive]}>
                Tutte
              </Text>
            </TouchableOpacity>
            {teams.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.tabBtn, teamFilter === t.id && styles.tabBtnActive]}
                onPress={() => setTeamFilter(t.id)}
                data-testid={`team-filter-${t.id}`}
              >
                <Text style={[styles.tabText, teamFilter === t.id && styles.tabTextActive]}>
                  {t.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Summary banner */}
        <View style={styles.summaryBanner}>
          <Ionicons
            name={onlyDenied ? 'alert-circle' : 'people'}
            size={22}
            color={onlyDenied ? '#D32F2F' : '#1976D2'}
          />
          <Text style={styles.summaryText}>
            {loading
              ? 'Caricamento...'
              : `${total} ${total === 1 ? 'atleta' : 'atleti'} ${
                  onlyDenied
                    ? `senza consenso ${consentLabel}`
                    : `(${total} totali per la vista corrente)`
                }`}
          </Text>
        </View>

        {/* Results */}
        {loading ? (
          <ActivityIndicator size="large" color="#1976D2" style={{ marginTop: 40 }} />
        ) : groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={60} color="#4CAF50" />
            <Text style={styles.emptyTitle}>Nessun atleta trovato</Text>
            <Text style={styles.emptySubtitle}>
              {onlyDenied
                ? `Ottimo! Tutti gli atleti hanno dato consenso ${consentLabel}.`
                : 'Nessun atleta corrisponde ai filtri.'}
            </Text>
          </View>
        ) : (
          groups.map((g) => {
            const k = g.team_id || '_none_';
            const isOpen = expanded[k];
            return (
              <View key={k} style={styles.teamCard}>
                <TouchableOpacity
                  onPress={() => toggleExpand(g.team_id)}
                  style={styles.teamHeader}
                  data-testid={`team-group-${k}`}
                >
                  <Ionicons
                    name={isOpen ? 'chevron-down' : 'chevron-forward'}
                    size={20}
                    color="#555"
                  />
                  <Text style={styles.teamName}>{g.team_name}</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{g.count}</Text>
                  </View>
                </TouchableOpacity>
                {isOpen && g.team_id && onlyDenied && (
                  <TouchableOpacity
                    style={[
                      styles.notifyBtn,
                      notifying === g.team_id && { opacity: 0.6 },
                    ]}
                    onPress={() => notifyTeam(g.team_id, g.team_name)}
                    disabled={notifying === g.team_id}
                    data-testid={`notify-coach-${g.team_id}`}
                  >
                    {notifying === g.team_id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="mail-outline" size={16} color="#fff" />
                    )}
                    <Text style={styles.notifyBtnText}>
                      {notifying === g.team_id
                        ? 'Invio in corso...'
                        : 'Notifica coach (p.c. società)'}
                    </Text>
                  </TouchableOpacity>
                )}
                {isOpen && (
                  <View style={styles.athleteList}>
                    {g.athletes.map((a) => (
                      <View key={a.athlete_id} style={styles.athleteRow}>
                        <View style={styles.athleteRowLeft}>
                          <Ionicons
                            name={a.consent_given ? 'checkmark-circle' : 'close-circle'}
                            size={20}
                            color={a.consent_given ? '#4CAF50' : '#D32F2F'}
                          />
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.athleteName}>
                              {a.full_name}
                              {a.is_minor && (
                                <Text style={styles.minorBadge}> · minorenne</Text>
                              )}
                            </Text>
                            {a.denied_by_parents.length > 0 && (
                              <Text style={styles.deniedByText}>
                                Negato da: {a.denied_by_parents.join(' · ')}
                              </Text>
                            )}
                            {!a.has_signed && (
                              <Text style={styles.notSignedText}>
                                Consenso non ancora compilato
                              </Text>
                            )}
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.viewBtn}
                          onPress={() =>
                            router.push(`/admin/athlete/${a.athlete_id}` as any)
                          }
                          data-testid={`view-athlete-${a.athlete_id}`}
                        >
                          <Ionicons name="eye-outline" size={18} color="#1976D2" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1976D2',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  backBtn: { marginRight: 12, padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerSubtitle: { color: '#E3F2FD', fontSize: 12, marginTop: 2 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  exportBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  body: { flex: 1, padding: 12 },
  filterRow: { marginBottom: 8 },
  filterLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
    paddingLeft: 4,
  },
  tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  tabBtnActive: { backgroundColor: '#1976D2', borderColor: '#1976D2' },
  tabText: { color: '#333', fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
    gap: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  summaryText: { flex: 1, color: '#333', fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  teamCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    backgroundColor: '#F9F9F9',
  },
  teamName: { flex: 1, fontSize: 15, fontWeight: 'bold', color: '#222' },
  countBadge: {
    backgroundColor: '#D32F2F',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
  },
  countBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  athleteList: { backgroundColor: '#fff' },
  notifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#388E3C',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 6,
  },
  notifyBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  athleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  athleteRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  athleteName: { fontSize: 14, color: '#222', fontWeight: '500' },
  minorBadge: { fontSize: 11, color: '#FF9800', fontWeight: 'normal' },
  deniedByText: { fontSize: 11, color: '#D32F2F', marginTop: 2 },
  notSignedText: { fontSize: 11, color: '#999', marginTop: 2, fontStyle: 'italic' },
  viewBtn: { padding: 6 },
});
