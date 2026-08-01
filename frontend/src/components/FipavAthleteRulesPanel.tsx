/**
 * 🆕 27/07/2026 — FipavAthleteRulesPanel
 *
 * Pannello per l'admin sul profilo atleta: contatori manuali per le 2 regole
 * FIPAV minorenni (Umbria/Italia):
 *   A) Max 2 campionati di categoria (U17) + camp3 presences + weekly games
 *   B) Max 10 presenze in Serie superiore (C/D/1^Div) — auto-blocco a 11ª
 *
 * Visibile solo se society.sport=pallavolo + federation=FIPAV (via feature flag
 * /api/me/feature-flags).
 *
 * Backend:
 *   GET   /api/admin/athletes/{id}/fipav-rules
 *   PATCH /api/admin/athletes/{id}/fipav-rules
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import api from '../services/api';

interface Props {
  athleteId: string;
  /**
   * 🐛 28/07/2026 — Modalità sola lettura per il ruolo COACH.
   * Se true, nasconde/disabilita tutti i controlli di modifica (contatori +/-,
   * chip selezione lega, aggiunta/rimozione campionati). L'admin resta con
   * la piena editabilità.
   */
  readOnly?: boolean;
}

interface GamePresence {
  id: string;
  date: string; // YYYY-MM-DD
  championship: string;
  level: 'upper' | 'category';
  added_by_name?: string;
}

interface WeekViolation {
  week_start: string;
  week_end: string;
  count: number;
}

interface FipavState {
  athlete_id: string;
  athlete_name: string;
  birth_year: string | null;
  gender: string | null;
  category_championships: string[];
  camp3_presences_count: number;
  weekly_games_count: number;
  upper_league_name: string;
  upper_league_presences: number;
  blocked_from_lower_league: boolean;
  killswitch_date: string;
  game_presences: GamePresence[];
  upper_league_options: string[];
  weekly_summary: { max_in_any_week: number; violation_weeks: WeekViolation[] };
}

const showAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

const UPPER_LEAGUE_OPTIONS = ['—', 'Serie C', 'Serie D', '1^ Divisione'];

export default function FipavAthleteRulesPanel({ athleteId, readOnly = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<FipavState | null>(null);
  const [saving, setSaving] = useState(false);
  const [newChampionship, setNewChampionship] = useState('');
  const [postKillswitch, setPostKillswitch] = useState(false);
  // 🆕 01/08/2026 — Registro presenze datato
  const [newDate, setNewDate] = useState('');
  const [newPresenceChamp, setNewPresenceChamp] = useState('');

  const handleDateMask = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    let masked = '';
    for (let i = 0; i < digits.length; i++) {
      if (i === 2 || i === 4) masked += '/';
      masked += digits[i];
    }
    setNewDate(masked);
  };

  // gg/mm/aaaa -> YYYY-MM-DD
  const toIsoDate = (masked: string): string | null => {
    const parts = masked.split('/');
    if (parts.length !== 3 || parts[2].length !== 4) return null;
    const [d, m, y] = parts;
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const parsed = new Date(iso);
    if (isNaN(parsed.getTime())) return null;
    return iso;
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // Check feature flag
      const flagsRes = await api.get('/me/feature-flags');
      const isEnabled = !!flagsRes.data?.flags?.fipav_minor_rules;
      setEnabled(isEnabled);
      if (!isEnabled) return;
      const res = await api.get(`/admin/athletes/${athleteId}/fipav-rules`);
      setState(res.data);
      // Check killswitch
      try {
        const kd = new Date(res.data.killswitch_date);
        setPostKillswitch(new Date() >= kd);
      } catch { setPostKillswitch(false); }
    } catch (_e) {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => { load(); }, [load]);

  const patch = async (payload: Partial<FipavState>) => {
    try {
      setSaving(true);
      const res = await api.patch(`/admin/athletes/${athleteId}/fipav-rules`, payload);
      setState(res.data);
    } catch (e: any) {
      const detail = e?.response?.data?.detail || 'Salvataggio fallito';
      showAlert('Errore', typeof detail === 'string' ? detail : 'Errore');
    } finally {
      setSaving(false);
    }
  };

  const addPresence = async () => {
    if (!state) return;
    const iso = toIsoDate(newDate);
    if (!iso) {
      showAlert('Data non valida', 'Inserisci la data della gara nel formato GG/MM/AAAA.');
      return;
    }
    if (!newPresenceChamp) {
      showAlert('Campionato mancante', 'Seleziona il campionato/gara dell\u2019ingresso.');
      return;
    }
    try {
      setSaving(true);
      const res = await api.post(`/admin/athletes/${athleteId}/fipav-presences`, {
        date: iso,
        championship: newPresenceChamp,
      });
      setState(res.data);
      setNewDate('');
      setNewPresenceChamp('');
    } catch (e: any) {
      const detail = e?.response?.data?.detail || 'Aggiunta fallita';
      showAlert('Errore', typeof detail === 'string' ? detail : 'Errore');
    } finally {
      setSaving(false);
    }
  };

  const removePresence = async (entryId: string) => {
    try {
      setSaving(true);
      const res = await api.delete(`/admin/athletes/${athleteId}/fipav-presences/${entryId}`);
      setState(res.data);
    } catch (e: any) {
      const detail = e?.response?.data?.detail || 'Rimozione fallita';
      showAlert('Errore', typeof detail === 'string' ? detail : 'Errore');
    } finally {
      setSaving(false);
    }
  };

  const addCategoryChampionship = () => {
    if (!state || !newChampionship.trim()) return;
    const list = [...(state.category_championships || []), newChampionship.trim()];
    if (list.length > 2) {
      showAlert('Limite raggiunto', 'Massimo 2 campionati di categoria (norma FIPAV U17).');
      return;
    }
    patch({ category_championships: list });
    setNewChampionship('');
  };

  const removeCategoryChampionship = (idx: number) => {
    if (!state) return;
    const list = (state.category_championships || []).filter((_, i) => i !== idx);
    patch({ category_championships: list });
  };

  if (loading) {
    return <View style={styles.card}><ActivityIndicator size="small" color="#1E3A8A" /></View>;
  }

  // Feature disabilitata: componente invisibile (nessun ingombro visivo)
  if (!enabled) return null;
  if (!state) return null;

  // Determina se atleta è candidato per queste regole
  const birthYear = state.birth_year ? parseInt(state.birth_year) : null;
  const gender = (state.gender || '').toLowerCase();
  const isMale = gender.startsWith('m');
  const isFemale = gender.startsWith('f');
  // Feature B: maschi >= 2006, femmine >= 2008
  const eligibleUpperLeague = birthYear !== null && (
    (isMale && birthYear >= 2006) || (isFemale && birthYear >= 2008)
  );
  // Feature A (U17): stagione 2026/2027 → nati >= 2010
  const eligibleU17 = birthYear !== null && birthYear >= 2010;

  const upperCount = state.upper_league_presences;
  const upperBadgeColor = upperCount >= 11 ? '#DC2626' : (upperCount >= 10 ? '#EA580C' : '#059669');
  const upperBadgeLabel = upperCount >= 11 ? `⛔ ${upperCount} — Bloccato` : (upperCount >= 10 ? `⚠ ${upperCount} — Ultima possibile` : `${upperCount}`);
  const catCount = (state.category_championships || []).length;

  // 🆕 01/08/2026 — Registro datato
  const presences = state.game_presences || [];
  const upperOptions = state.upper_league_options || ['Serie C', 'Serie D', '1^ Divisione'];
  const presenceOptions = [...upperOptions, ...(state.category_championships || [])];
  const violationWeeks = state.weekly_summary?.violation_weeks || [];
  const maxWeek = state.weekly_summary?.max_in_any_week || 0;
  const weeklyColor = maxWeek > 3 ? '#DC2626' : (maxWeek === 3 ? '#EA580C' : '#059669');
  const fmtIt = (iso: string) => {
    try { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; } catch { return iso; }
  };
  const showRegistry = eligibleUpperLeague || eligibleU17;

  return (
    <View style={styles.card} data-testid="fipav-athlete-rules-panel">
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={20} color="#1E3A8A" />
        <Text style={styles.title}>Regole FIPAV — {state.athlete_name}</Text>
        {readOnly && (
          <View style={styles.readOnlyBadge}>
            <Ionicons name="eye-outline" size={11} color="#6B7280" />
            <Text style={styles.readOnlyBadgeText}>Sola lettura</Text>
          </View>
        )}
      </View>
      <Text style={styles.subtitle}>
        {readOnly
          ? 'Solo l\u2019admin può gestire il registro presenze.'
          : 'Registra ogni ingresso con la data: i conteggi di Serie superiore e gare settimanali si aggiornano da soli.'}
      </Text>

      <View style={styles.sanctionBanner}>
        <Ionicons name="alert-circle" size={14} color="#7C2D12" />
        <Text style={styles.sanctionText}>
          Sanzioni FIPAV per violazione: perdita gara (0-3), sospensione 7gg del Presidente e multa € 100. Il registro datato evita doppi conteggi.
        </Text>
      </View>

      {postKillswitch && (
        <View style={styles.killswitchBanner} data-testid="fipav-killswitch-banner">
          <Ionicons name="warning" size={16} color="#7C2D12" />
          <Text style={styles.killswitchText}>
            ⚠ Killswitch attivo (post {state.killswitch_date}): un ingresso in Serie superiore inibisce
            automaticamente il campionato inferiore, indipendentemente dal contatore.
          </Text>
        </View>
      )}

      {/* ====== FEATURE B — Presenze Serie Superiore (10 max) ====== */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Feature B — Presenze in Serie Superiore</Text>
        {!eligibleUpperLeague && birthYear === null && (
          <Text style={styles.notEligible}>
            ⚠️ Data di nascita mancante sull&apos;atleta. Aggiornala nel tab Anagrafica per attivare i contatori.
          </Text>
        )}
        {!eligibleUpperLeague && birthYear !== null && (
          <Text style={styles.notEligible}>
            Atleta non soggetto a questa regola (nato {birthYear}, richiede M≥2006 o F≥2008).
          </Text>
        )}
        {eligibleUpperLeague && (
          <>
            <Text style={styles.label}>Presenze in Serie Superiore (Serie C / D / 1ª Div)</Text>
            <View style={[styles.counterValue, { backgroundColor: upperBadgeColor, alignSelf: 'flex-start', paddingHorizontal: 18 }]} data-testid="fipav-upper-count">
              <Text style={styles.counterValueText}>{upperBadgeLabel} / 10</Text>
            </View>
            <Text style={styles.hintSmall}>
              Conteggio automatico dagli ingressi di livello &quot;Serie superiore&quot; nel registro qui sotto. Blocco automatico dall&apos;11ª presenza.
            </Text>

            {state.blocked_from_lower_league && (
              <View style={styles.blockedNotice}>
                <Ionicons name="lock-closed" size={14} color="#7F1D1D" />
                <Text style={styles.blockedText}>
                  🚫 Bloccato dal campionato inferiore — non può più esservi schierato.
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* ====== FEATURE A — Campionati Categoria U17 ====== */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Feature A — Campionati di Categoria (U17)</Text>
        {!eligibleU17 && birthYear === null && (
          <Text style={styles.notEligible}>
            ⚠️ Data di nascita mancante sull&apos;atleta. Aggiornala nel tab Anagrafica per attivare i contatori U17.
          </Text>
        )}
        {!eligibleU17 && birthYear !== null && (
          <Text style={styles.notEligible}>
            Atleta non soggetto a questa regola (nato {birthYear}, richiede U17 = nati 2010+).
          </Text>
        )}
        {eligibleU17 && (
          <>
            <Text style={styles.label}>Campionati di categoria a cui partecipa ({catCount}/2)</Text>
            {(state.category_championships || []).map((c, i) => (
              <View key={i} style={styles.champRow}>
                <Text style={styles.champText}>• {c}</Text>
                {!readOnly && (
                  <TouchableOpacity
                    onPress={() => removeCategoryChampionship(i)}
                    disabled={saving}
                    data-testid={`fipav-cat-remove-${i}`}
                  >
                    <Ionicons name="trash" size={14} color="#DC2626" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {!readOnly && catCount < 2 && (
              <View style={styles.addChampRow}>
                <TextInput
                  value={newChampionship}
                  onChangeText={setNewChampionship}
                  placeholder="Es. Under 14, Under 16..."
                  style={styles.champInput}
                  editable={!saving}
                  data-testid="fipav-cat-input"
                />
                <TouchableOpacity
                  style={styles.addChampBtn}
                  onPress={addCategoryChampionship}
                  disabled={saving || !newChampionship.trim()}
                  data-testid="fipav-cat-add"
                >
                  <Ionicons name="add" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
            {catCount >= 2 && (
              <Text style={styles.limitHit}>✋ Limite raggiunto (max 2 campionati categoria)</Text>
            )}

            <Text style={styles.label}>Gare nella settimana (max 3 — Lun→Dom)</Text>
            <View style={[styles.counterValue, { backgroundColor: weeklyColor, alignSelf: 'flex-start', paddingHorizontal: 18 }]} data-testid="fipav-weekly-max">
              <Text style={styles.counterValueText}>Max in una settimana: {maxWeek}/3</Text>
            </View>
            {violationWeeks.length > 0 && (
              <View style={styles.blockedNotice} data-testid="fipav-weekly-violation">
                <Ionicons name="warning" size={14} color="#7F1D1D" />
                <Text style={styles.blockedText}>
                  ⚠ Limite 3 gare superato in {violationWeeks.length} settiman{violationWeeks.length > 1 ? 'e' : 'a'}:{' '}
                  {violationWeeks.map(w => `${fmtIt(w.week_start)}–${fmtIt(w.week_end)} (${w.count})`).join(', ')}
                </Text>
              </View>
            )}
            <Text style={styles.hintSmall}>Camp3: {state.camp3_presences_count} presenze totali registrate.</Text>
          </>
        )}
      </View>

      {/* ====== REGISTRO PRESENZE GARA (datato) ====== */}
      {showRegistry && (
        <View style={styles.section} data-testid="fipav-registry-section">
          <Text style={styles.sectionTitle}>Registro Presenze Gara (camp3)</Text>
          <Text style={styles.hintSmall}>
            Registra ogni ingresso con data + campionato. Max 1 gara al giorno. Alimenta i conteggi Serie superiore e gare settimanali.
          </Text>

          {!readOnly && (
            <View style={styles.addPresenceBox}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniLabel}>Data gara</Text>
                  <TextInput
                    value={newDate}
                    onChangeText={handleDateMask}
                    placeholder="GG/MM/AAAA"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    maxLength={10}
                    style={styles.champInput}
                    editable={!saving}
                    data-testid="fipav-presence-date"
                  />
                </View>
                <View style={{ flex: 1.3 }}>
                  <Text style={styles.miniLabel}>Campionato / gara</Text>
                  <View style={styles.presencePicker}>
                    <Picker
                      selectedValue={newPresenceChamp}
                      onValueChange={(v) => setNewPresenceChamp(v)}
                      enabled={!saving}
                      style={{ height: 40 }}
                      data-testid="fipav-presence-champ"
                    >
                      <Picker.Item label="-- Seleziona --" value="" />
                      {presenceOptions.map((opt) => (
                        <Picker.Item key={opt} label={opt} value={opt} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.addPresenceBtn, (saving || !newDate || !newPresenceChamp) && styles.readOnlyDim]}
                onPress={addPresence}
                disabled={saving || !newDate || !newPresenceChamp}
                data-testid="fipav-presence-add"
              >
                <Ionicons name="add-circle" size={16} color="#fff" />
                <Text style={styles.addPresenceBtnText}>Aggiungi ingresso</Text>
              </TouchableOpacity>
            </View>
          )}

          {presences.length === 0 ? (
            <Text style={styles.notEligible}>Nessun ingresso registrato.</Text>
          ) : (
            presences.map((p) => (
              <View key={p.id} style={styles.presenceRow} data-testid={`fipav-presence-${p.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.presenceDate}>{fmtIt(p.date)}</Text>
                  <Text style={styles.presenceChamp}>{p.championship}</Text>
                </View>
                <View style={[styles.levelBadge, p.level === 'upper' ? styles.levelUpper : styles.levelCat]}>
                  <Text style={styles.levelBadgeText}>{p.level === 'upper' ? 'SERIE SUP.' : 'CATEGORIA'}</Text>
                </View>
                {!readOnly && (
                  <TouchableOpacity onPress={() => removePresence(p.id)} disabled={saving} data-testid={`fipav-presence-remove-${p.id}`}>
                    <Ionicons name="trash" size={16} color="#DC2626" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="small" color="#1E3A8A" />
          <Text style={{ fontSize: 12, color: '#6B7280' }}> Salvataggio...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderLeftWidth: 4,
    borderLeftColor: '#1E3A8A',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { fontSize: 15, fontWeight: '700', color: '#1E3A8A' },
  subtitle: { fontSize: 11, color: '#6B7280', marginBottom: 12, lineHeight: 15 },
  killswitchBanner: {
    flexDirection: 'row', gap: 6, backgroundColor: '#FEE2E2',
    padding: 10, borderRadius: 8, marginBottom: 12, alignItems: 'flex-start',
  },
  killswitchText: { fontSize: 11, color: '#7C2D12', flex: 1, lineHeight: 15, fontWeight: '600' },
  section: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  notEligible: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 10, marginBottom: 6 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipActive: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
  chipText: { fontSize: 12, color: '#374151' },
  chipActiveText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counterBtn: {
    backgroundColor: '#1E3A8A', width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  counterValue: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  counterValueText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  blockedNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEE2E2', padding: 8, borderRadius: 6, marginTop: 8,
  },
  blockedText: { fontSize: 11, color: '#7F1D1D', fontWeight: '600', flex: 1 },
  champRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  champText: { fontSize: 13, color: '#1F2937', fontWeight: '500' },
  addChampRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  champInput: {
    flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13,
  },
  addChampBtn: {
    backgroundColor: '#059669', width: 36, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  limitHit: { fontSize: 11, color: '#EA580C', fontStyle: 'italic', marginTop: 4 },
  readOnlyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, marginLeft: 'auto',
  },
  readOnlyBadgeText: { fontSize: 10, color: '#6B7280', fontWeight: '600' },
  readOnlyDim: { opacity: 0.75 },
  sanctionBanner: {
    flexDirection: 'row', gap: 6, backgroundColor: '#FEF3C7',
    padding: 8, borderRadius: 8, marginBottom: 10, alignItems: 'flex-start',
    borderWidth: 1, borderColor: '#FCD34D',
  },
  sanctionText: { fontSize: 10.5, color: '#7C2D12', flex: 1, lineHeight: 14 },
  hintSmall: { fontSize: 10.5, color: '#6B7280', marginTop: 6, lineHeight: 14, fontStyle: 'italic' },
  miniLabel: { fontSize: 11, fontWeight: '600', color: '#374151', marginBottom: 4 },
  addPresenceBox: {
    backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginTop: 8, marginBottom: 10,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  presencePicker: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, overflow: 'hidden',
  },
  addPresenceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#059669', paddingVertical: 10, borderRadius: 8, marginTop: 10,
  },
  addPresenceBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  presenceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  presenceDate: { fontSize: 13, fontWeight: '700', color: '#1E3A8A' },
  presenceChamp: { fontSize: 12, color: '#374151', marginTop: 1 },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  levelUpper: { backgroundColor: '#FEE2E2' },
  levelCat: { backgroundColor: '#DBEAFE' },
  levelBadgeText: { fontSize: 9, fontWeight: '800', color: '#374151' },
  savingOverlay: {
    position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4,
  },
});
