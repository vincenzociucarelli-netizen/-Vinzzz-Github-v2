/**
 * 🆕 01/07/2026 — Riconferma da Archivio (v2 - 02/07/2026)
 *
 * v2 update: rimosse le tabs, ora un'unica lista con 5 cartelle COLLASSABILI
 * organizzate per categoria (invece che per squadra), perché al rinnovo non è
 * detto che un user venga riassegnato alla stessa squadra:
 *   🧒 Atleti U18
 *   🧑 Atleti 18+
 *   🏋️ Coach
 *   💼 Dirigenti
 *   👷 Collaboratori
 *
 * L'admin espande/collassa le cartelle, seleziona con checkbox e clicca
 * "Riconferma per stagione corrente". Modello "clean slate": chi non viene
 * riconfermato NON appare nelle liste operative della nuova stagione.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import api from '../../src/services/api';

type CategoryKey = 'teams' | 'athletes_minor' | 'athletes_adult' | 'coach' | 'dirigente' | 'collaboratore';
type BackendType = 'teams' | 'athletes' | 'coach' | 'collaboratore' | 'dirigente';

interface Member {
  id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
  team_id?: string;
  team_name?: string;
  assigned_team_names?: string[];
  athlete_type?: string;
  monthly_compensation?: number;
  other_annual_compensation?: number;
  already_in_current?: boolean;
  linked_athlete_id?: string;
  qualification?: string;
  is_minor?: boolean;
  category?: string; // solo per teams
  _backendType?: BackendType; // set client-side per identificare l'origine
}

const CATEGORIES: { key: CategoryKey; icon: string; label: string; color: string }[] = [
  { key: 'teams',          icon: '🏐', label: 'Squadre',      color: '#546E7A' },
  { key: 'athletes_minor', icon: '🧒', label: 'Atleti U18',   color: '#1976D2' },
  { key: 'athletes_adult', icon: '🧑', label: 'Atleti 18+',   color: '#388E3C' },
  { key: 'coach',          icon: '🏋️', label: 'Coach',        color: '#F57C00' },
  { key: 'dirigente',      icon: '💼', label: 'Dirigenti',    color: '#7B1FA2' },
  { key: 'collaboratore',  icon: '👷', label: 'Collaboratori', color: '#00796B' },
];

export default function SeasonReconfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ season?: string }>();
  const season = String(params.season || '');

  const [members, setMembers] = useState<Member[]>([]);
  const [currentSeason, setCurrentSeason] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  // Cartelle: default TUTTE COLLASSATE (chiuse)
  const [expanded, setExpanded] = useState<Record<CategoryKey, boolean>>({
    teams: false,
    athletes_minor: false,
    athletes_adult: false,
    coach: false,
    dirigente: false,
    collaboratore: false,
  });

  useEffect(() => {
    if (season) loadAllMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  const loadAllMembers = async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      // 🆕 02/07/2026 - Fetch parallelo dei 5 tipi (teams, athletes, coach, coll, dir)
      const types: BackendType[] = ['teams', 'athletes', 'coach', 'collaboratore', 'dirigente'];
      const responses = await Promise.all(
        types.map(t => api.get(`/seasons/${encodeURIComponent(season)}/members?type=${t}`))
      );
      const all: Member[] = [];
      let cs = '';
      responses.forEach((r, idx) => {
        cs = r.data?.current_season || cs;
        const items: Member[] = r.data?.members || [];
        items.forEach(m => { m._backendType = types[idx]; });
        all.push(...items);
      });
      setMembers(all);
      setCurrentSeason(cs);
    } catch (err: any) {
      Alert.alert('Errore', err?.response?.data?.detail || 'Caricamento non riuscito');
    } finally {
      setLoading(false);
    }
  };

  const categorize = (m: Member): CategoryKey => {
    if (m._backendType === 'teams') return 'teams';
    if (m._backendType === 'athletes') return m.is_minor ? 'athletes_minor' : 'athletes_adult';
    return m._backendType as CategoryKey;
  };

  const grouped = useMemo(() => {
    const g: Record<CategoryKey, Member[]> = {
      teams: [], athletes_minor: [], athletes_adult: [], coach: [], dirigente: [], collaboratore: [],
    };
    for (const m of members) {
      g[categorize(m)].push(m);
    }
    // sort each group by full_name
    (Object.keys(g) as CategoryKey[]).forEach(k => {
      g[k].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    });
    return g;
  }, [members]);

  const selectableTotal = members.filter(m => !m.already_in_current).length;

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleCategory = (key: CategoryKey) => {
    const items = grouped[key].filter(m => !m.already_in_current);
    const allSelected = items.length > 0 && items.every(m => selectedIds.has(m.id));
    const next = new Set(selectedIds);
    if (allSelected) items.forEach(m => next.delete(m.id));
    else items.forEach(m => next.add(m.id));
    setSelectedIds(next);
  };

  const toggleExpand = (key: CategoryKey) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAllGlobal = () => {
    if (selectedIds.size >= selectableTotal) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(members.filter(m => !m.already_in_current).map(m => m.id)));
    }
  };

  const handleConfirm = async () => {
    if (selectedIds.size === 0) return;
    // Split selected ids per backend type (athletes vs users vs teams)
    const athleteIds: string[] = [];
    const userIds: string[] = [];
    const teamIds: string[] = [];
    for (const m of members) {
      if (!selectedIds.has(m.id)) continue;
      if (m._backendType === 'athletes') athleteIds.push(m.id);
      else if (m._backendType === 'teams') teamIds.push(m.id);
      else userIds.push(m.id);
    }
    const total = athleteIds.length + userIds.length + teamIds.length;
    const msg = `Confermi la riconferma di ${total} elemento/i per la stagione ${currentSeason}?`;
    const ok = Platform.OS === 'web' ? window.confirm(msg) : await new Promise<boolean>(res => {
      Alert.alert('Riconferma', msg, [
        { text: 'Annulla', style: 'cancel', onPress: () => res(false) },
        { text: 'Riconferma', onPress: () => res(true) },
      ]);
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api.post('/seasons/reconfirm-bulk', { athlete_ids: athleteIds, user_ids: userIds, team_ids: teamIds });
      const conf = (r.data?.athletes?.confirmed || 0) + (r.data?.users?.confirmed || 0) + (r.data?.teams?.confirmed || 0);
      const flagged = (r.data?.athletes?.pro_flagged || 0) + (r.data?.users?.pro_flagged || 0);
      const parentsAuto = r.data?.parents?.auto_confirmed || 0;
      const teamsConf = r.data?.teams?.confirmed || 0;
      const flaggedMsg = flagged > 0 ? `\n\n${flagged} risultano compensati: appariranno nelle liste con il badge rosso "Compenso da riconfermare".` : '';
      const parentsMsg = parentsAuto > 0 ? `\n\n👨‍👩 Riconfermati automaticamente anche ${parentsAuto} genitori di minori. Dovranno rifirmare la privacy per la nuova stagione.` : '';
      const teamsMsg = teamsConf > 0 ? `\n\n🏐 Ripristinate ${teamsConf} squadre nella stagione corrente.` : '';
      if (Platform.OS === 'web') {
        window.alert(`✅ Riconfermati ${conf} per la stagione ${currentSeason}.${teamsMsg}${flaggedMsg}${parentsMsg}`);
      } else {
        Alert.alert('Successo', `Riconfermati ${conf} per la stagione ${currentSeason}.${teamsMsg}${flaggedMsg}${parentsMsg}`);
      }
      await loadAllMembers();
    } catch (err: any) {
      Alert.alert('Errore', err?.response?.data?.detail || 'Riconferma non riuscita');
    } finally {
      setBusy(false);
    }
  };

  const allGloballySelected = selectableTotal > 0 && selectedIds.size >= selectableTotal;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin/seasons'))} data-testid="back-btn">
          <View style={styles.roundBtn}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Riconferma da {season}</Text>
          <Text style={styles.headerSub}>→ Stagione corrente {currentSeason || '…'}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Toolbar: select all + counter */}
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={selectAllGlobal} style={styles.toolbarBtn} data-testid="select-all-btn">
          <Ionicons name={allGloballySelected ? 'checkbox' : 'square-outline'} size={20} color="#1B5E20" />
          <Text style={styles.toolbarBtnText}>{allGloballySelected ? 'Deseleziona tutti' : 'Seleziona tutti'}</Text>
        </TouchableOpacity>
        <Text style={styles.counterText}>{selectedIds.size} / {selectableTotal} selezionati</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />
        ) : members.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="folder-open-outline" size={48} color="#999" />
            <Text style={styles.emptyText}>Nessun membro archiviato in questa stagione.</Text>
          </View>
        ) : (
          CATEGORIES.map(cat => {
            const items = grouped[cat.key];
            const selectable = items.filter(m => !m.already_in_current);
            const catSelectedCount = items.filter(m => selectedIds.has(m.id)).length;
            const catAllSelected = selectable.length > 0 && selectable.every(m => selectedIds.has(m.id));
            const isOpen = expanded[cat.key];
            return (
              <View key={cat.key} style={styles.folderBox}>
                {/* Folder header (always visible, click to expand/collapse) */}
                <TouchableOpacity
                  onPress={() => toggleExpand(cat.key)}
                  style={[styles.folderHeader, { borderLeftColor: cat.color }]}
                  data-testid={`folder-header-${cat.key}`}
                >
                  <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={20} color={cat.color} />
                  <Text style={styles.folderIcon}>{cat.icon}</Text>
                  <Text style={[styles.folderTitle, { color: cat.color }]}>{cat.label}</Text>
                  <View style={[styles.folderCountBadge, { backgroundColor: cat.color + '22' }]}>
                    <Text style={[styles.folderCountText, { color: cat.color }]}>
                      {catSelectedCount > 0 ? `${catSelectedCount}/` : ''}{items.length}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Folder body (only when expanded) */}
                {isOpen && (
                  <View>
                    {items.length === 0 ? (
                      <Text style={styles.folderEmpty}>Nessun elemento in questa categoria.</Text>
                    ) : (
                      <>
                        {selectable.length > 0 && (
                          <TouchableOpacity
                            onPress={() => toggleCategory(cat.key)}
                            style={styles.selectAllRow}
                            data-testid={`folder-select-all-${cat.key}`}
                          >
                            <Ionicons name={catAllSelected ? 'checkbox' : 'square-outline'} size={18} color={cat.color} />
                            <Text style={[styles.selectAllText, { color: cat.color }]}>
                              {catAllSelected ? 'Deseleziona tutti' : `Seleziona tutti (${selectable.length})`}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {items.map(m => {
                          const isChecked = selectedIds.has(m.id);
                          const isLocked = !!m.already_in_current;
                          const label = m.full_name || `${m.last_name || ''} ${m.first_name || ''}`.trim() || m.email || '—';
                          const compTag = (m.monthly_compensation || 0) > 0 || (m.other_annual_compensation || 0) > 0 ? '💰 PRO' : '';
                          const teamsInfo = m._backendType === 'athletes'
                            ? m.team_name
                            : m._backendType === 'teams'
                              ? m.category
                              : (m.assigned_team_names && m.assigned_team_names.length > 0 ? m.assigned_team_names.join(', ') : null);
                          return (
                            <TouchableOpacity
                              key={m.id}
                              onPress={() => !isLocked && toggleOne(m.id)}
                              disabled={isLocked}
                              style={[styles.memberRow, isLocked && styles.memberRowLocked]}
                              data-testid={`member-row-${m.id}`}
                            >
                              <Ionicons
                                name={isLocked ? 'checkmark-circle' : (isChecked ? 'checkbox' : 'square-outline')}
                                size={20}
                                color={isLocked ? '#9E9E9E' : cat.color}
                              />
                              <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={[styles.memberName, isLocked && styles.memberNameLocked]}>
                                  {label} {compTag ? <Text style={styles.memberCompTag}>{compTag}</Text> : null}
                                </Text>
                                {teamsInfo ? <Text style={styles.memberSub}>🏐 {teamsInfo}</Text> : null}
                                {m.qualification ? <Text style={styles.memberSub}>🏅 {m.qualification}</Text> : null}
                                {m.email ? <Text style={styles.memberSub}>{m.email}</Text> : null}
                                {isLocked && (
                                  <Text style={styles.lockedTag}>Già nella stagione {currentSeason}</Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Fixed footer with action */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleConfirm}
          disabled={busy || selectedIds.size === 0}
          style={[styles.confirmBtn, (busy || selectedIds.size === 0) && styles.confirmBtnDisabled]}
          data-testid="reconfirm-bulk-btn"
        >
          <Ionicons name="checkmark-done" size={20} color="#fff" />
          <Text style={styles.confirmBtnText}>
            {busy ? 'Riconferma in corso…' : `Riconferma ${selectedIds.size} → ${currentSeason}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  roundBtn: { backgroundColor: '#fff', borderRadius: 20, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  headerSub: { fontSize: 12, color: '#666', marginTop: 2 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  toolbarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolbarBtnText: { fontSize: 13, color: '#1B5E20', fontWeight: '600' },
  counterText: { fontSize: 13, color: '#666', fontWeight: '600' },
  content: { flex: 1 },
  emptyBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: 24 },
  emptyText: { marginTop: 12, fontSize: 14, color: '#666', textAlign: 'center' },
  folderBox: { backgroundColor: '#fff', marginHorizontal: 8, marginTop: 8, borderRadius: 10, overflow: 'hidden' },
  folderHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderLeftWidth: 4, backgroundColor: '#FAFAFA' },
  folderIcon: { fontSize: 18 },
  folderTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  folderCountBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  folderCountText: { fontSize: 12, fontWeight: '700' },
  folderEmpty: { padding: 12, fontSize: 12, fontStyle: 'italic', color: '#999', textAlign: 'center' },
  selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F9F9F9', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  selectAllText: { fontSize: 13, fontWeight: '600' },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  memberRowLocked: { backgroundColor: '#FAFAFA' },
  memberName: { fontSize: 14, color: '#222', fontWeight: '500' },
  memberNameLocked: { color: '#9E9E9E' },
  memberCompTag: { fontSize: 11, color: '#B8860B', fontWeight: '700' },
  memberSub: { fontSize: 11, color: '#666', marginTop: 2 },
  lockedTag: { fontSize: 10, color: '#2E7D32', marginTop: 4, fontStyle: 'italic' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1B5E20', paddingVertical: 14, borderRadius: 10 },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
