import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, TextInput, Alert, Linking, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '../../src/components/Icon';
import api from '../../src/services/api';
import { downloadConvocationPDF } from '../../src/utils/convocationReport';

interface RosterAthlete { id: string; full_name: string; role?: string; jersey_number?: string; is_minor?: boolean; team?: string; }
interface TeamMatch {
  id: string; opponent: string; date: string; home_away: string;
  venue?: string; city?: string; meeting_time?: string; match_number?: string; address?: string;
}
interface Contact {
  athlete_id: string; athlete_name: string; is_minor: boolean;
  athlete_phone: string; mother_phone: string; father_phone: string;
}
interface Palestra {
  name: string; address: string; description?: string;
  folder?: string; google_maps_url?: string;
}

const normalizePhone = (raw: string): string => {
  let p = (raw || '').replace(/\D/g, '');
  if (!p) return '';
  if (p.startsWith('00')) p = p.substring(2);
  if (p.startsWith('39')) return p;
  p = p.replace(/^0+/, '');
  return `39${p}`;
};

const fmtMatch = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: '', time: '' };
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return { date: `${dd}/${mm}/${yy}`, time: `${hh}:${mi}` };
};

export default function ConvocationEditor() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const teamId = typeof params.team_id === 'string' ? params.team_id : '';
  const teamName = typeof params.team_name === 'string' ? params.team_name : '';
  const convId0 = typeof params.conv_id === 'string' ? params.conv_id : '';

  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<RosterAthlete[]>([]);
  const [matches, setMatches] = useState<TeamMatch[]>([]);
  const [society, setSociety] = useState<{ name: string; logo: string | null }>({ name: '', logo: null });
  const [convId, setConvId] = useState(convId0);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [opponent, setOpponent] = useState('');
  const [matchNumber, setMatchNumber] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [matchTime, setMatchTime] = useState('');
  const [homeAway, setHomeAway] = useState<'home' | 'away'>('home');
  const [venue, setVenue] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [city, setCity] = useState('');
  const [palestre, setPalestre] = useState<Palestra[]>([]);
  const [showPalestre, setShowPalestre] = useState(false);
  const [societyAthletes, setSocietyAthletes] = useState<RosterAthlete[]>([]);
  const [showSociety, setShowSociety] = useState(false);
  const [societyQuery, setSocietyQuery] = useState('');
  const [meetingPlace, setMeetingPlace] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [startTime, setStartTime] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  const [saving, setSaving] = useState(false);

  // WhatsApp send modal
  const [waVisible, setWaVisible] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [waMode, setWaMode] = useState<'parents' | 'athlete' | 'both'>('parents');
  const [waMessage, setWaMessage] = useState('');
  const [sentSet, setSentSet] = useState<Set<string>>(new Set());

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
    else Alert.alert(title, msg);
  };

  const onChangeDate = (txt: string) => {
    const d = txt.replace(/\D/g, '').slice(0, 8);
    let out = d.slice(0, 2);
    if (d.length >= 3) out += '/' + d.slice(2, 4);
    if (d.length >= 5) out += '/' + d.slice(4, 8);
    setMatchDate(out);
  };
  const onChangeTime = (setter: (v: string) => void) => (txt: string) => {
    const d = txt.replace(/\D/g, '').slice(0, 4);
    let out = d.slice(0, 2);
    if (d.length >= 3) out += ':' + d.slice(2, 4);
    setter(out);
  };

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const [rosterRes, matchesRes, socRes] = await Promise.all([
          api.get(`/convocations/team/${teamId}/roster`),
          api.get(`/matches/team/${teamId}`),
          api.get('/settings/society?include_images=true'),
        ]);
        setRoster(rosterRes.data?.athletes || []);
        setMatches(matchesRes.data || []);
        setSociety({ name: socRes.data?.name || '', logo: socRes.data?.logo || null });
        try {
          const pal = await api.get('/palestre/list');
          setPalestre(pal.data?.palestre || []);
        } catch { /* lista palestre opzionale */ }
        // carica subito gli atleti della società così i convocati "aggiunti"
        // restano visibili in elenco e finiscono nel PDF anche in modifica
        try {
          const sa = await api.get(`/convocations/team/${teamId}/society-athletes`);
          setSocietyAthletes(sa.data?.athletes || []);
        } catch { /* opzionale */ }

        if (convId0) {
          const c = await api.get(`/convocations/${convId0}`);
          const d = c.data || {};
          setOpponent(d.opponent || '');
          setMatchNumber(d.match_number || '');
          setMatchDate(d.match_date || '');
          setMatchTime(d.match_time || '');
          setHomeAway(d.home_away === 'away' ? 'away' : 'home');
          setVenue(d.venue || '');
          setVenueAddress(d.venue_address || '');
          setMapsUrl(d.maps_url || '');
          setCity(d.city || '');
          setMeetingPlace(d.meeting_place || '');
          setMeetingTime(d.meeting_time || '');
          setStartTime(d.start_time || '');
          setNotes(d.notes || '');
          setSelectedMatchId(d.match_id || null);
          setSelected(new Set((d.athlete_ids || []) as string[]));
        } else if (typeof params.match_id === 'string' && params.match_id) {
          const m = (matchesRes.data || []).find((x: TeamMatch) => x.id === params.match_id);
          if (m) applyMatch(m);
        }
      } catch {
        showAlert('Errore', 'Impossibile caricare i dati della convocazione.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const applyMatch = (m: TeamMatch) => {
    const { date, time } = fmtMatch(m.date);
    setSelectedMatchId(m.id);
    setOpponent(m.opponent || '');
    setMatchNumber(m.match_number || '');
    setMatchDate(date);
    setMatchTime(time);
    setHomeAway(m.home_away === 'away' ? 'away' : 'home');
    setVenue(m.venue || '');
    setCity(m.city || '');
    if (m.address) setVenueAddress(m.address);
    if (m.meeting_time && !meetingTime) setMeetingTime(m.meeting_time);
    setStartTime(time);
    setShowCalendar(false);
  };

  const toggle = (id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const allSelected = roster.length > 0 && selected.size === roster.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(roster.map(a => a.id)));

  const filteredPalestre = useMemo(() => {
    const q = city.trim().toLowerCase();
    if (q.length < 2) return [];
    return palestre.filter(p =>
      `${p.folder || ''} ${p.name} ${p.address} ${p.description || ''}`.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [palestre, city]);

  const selectPalestra = (p: Palestra) => {
    // Nel KML il nome è spesso "Comune - Nome impianto" (es. "Magione - Palazzetto
    // dello Sport"). Estraiamo il comune come città e il resto come impianto, senza
    // sovrascrivere con il 'folder' (che è una categoria, non il comune).
    const parts = (p.name || '').split(' - ');
    if (parts.length >= 2) {
      setCity(parts[0].trim());
      setVenue(parts.slice(1).join(' - ').trim());
    } else {
      setVenue(p.name || '');
    }
    setVenueAddress(p.address || '');
    setMapsUrl(p.google_maps_url || '');
    setShowPalestre(false);
  };

  const loadSociety = async () => {
    setShowSociety((v) => !v);
    if (societyAthletes.length === 0) {
      try {
        const res = await api.get(`/convocations/team/${teamId}/society-athletes`);
        setSocietyAthletes(res.data?.athletes || []);
      } catch { /* opzionale */ }
    }
  };

  // Rosa squadra + atleti società aggiunti (per PDF e conteggio convocati)
  const allAthletes = useMemo(() => {
    const map = new Map<string, RosterAthlete>();
    [...roster, ...societyAthletes].forEach((a) => { if (!map.has(a.id)) map.set(a.id, a); });
    return Array.from(map.values());
  }, [roster, societyAthletes]);

  const filteredSociety = useMemo(() => {
    const q = societyQuery.trim().toLowerCase();
    const base = societyAthletes;
    if (!q) return base.slice(0, 50);
    return base.filter((a) => `${a.full_name} ${a.team || ''}`.toLowerCase().includes(q)).slice(0, 50);
  }, [societyAthletes, societyQuery]);


  const buildPayload = (status?: 'draft' | 'sent') => ({
    team_id: teamId,
    match_id: selectedMatchId || null,
    match_number: matchNumber.trim(),
    opponent: opponent.trim(),
    match_date: matchDate.trim(),
    match_time: matchTime.trim(),
    home_away: homeAway,
    venue: venue.trim(),
    venue_address: venueAddress.trim(),
    maps_url: mapsUrl.trim(),
    city: city.trim(),
    meeting_place: meetingPlace.trim(),
    meeting_time: meetingTime.trim(),
    start_time: startTime.trim(),
    notes: notes.trim(),
    athlete_ids: Array.from(selected),
    ...(status ? { status } : {}),
  });

  const validate = (): boolean => {
    if (!opponent.trim()) { showAlert('Avversario mancante', 'Inserisci l\u2019avversario della gara.'); return false; }
    if (selected.size === 0) { showAlert('Nessun atleta', 'Seleziona almeno un atleta da convocare.'); return false; }
    return true;
  };

  // Salva (crea o aggiorna) e ritorna l'id
  const persist = async (status?: 'draft' | 'sent'): Promise<string | null> => {
    try {
      if (convId) {
        await api.patch(`/convocations/${convId}`, buildPayload(status));
        return convId;
      }
      const res = await api.post('/convocations', buildPayload(status));
      const id = res.data?.id;
      if (id) setConvId(id);
      return id || null;
    } catch {
      showAlert('Errore', 'Salvataggio non riuscito.');
      return null;
    }
  };

  const handleSaveDraft = async () => {
    if (!validate()) return;
    setSaving(true);
    const id = await persist('draft');
    setSaving(false);
    if (id) {
      showAlert('Salvata', 'Convocazione salvata come bozza.');
      router.back();
    }
  };

  const handlePDF = async () => {
    if (!validate()) return;
    const athletes = allAthletes.filter(a => selected.has(a.id)).map(a => ({ id: a.id, full_name: a.full_name, role: a.role, jersey_number: a.jersey_number }));
    await downloadConvocationPDF({
      societyName: society.name || 'RegistraTEAM',
      societyLogo: society.logo,
      teamName: teamName || '',
      opponent: opponent.trim(),
      matchNumber: matchNumber.trim(),
      homeAway,
      matchDate: matchDate.trim(),
      matchTime: matchTime.trim(),
      venue: venue.trim(),
      city: city.trim(),
      venueAddress: venueAddress.trim(),
      mapsUrl: mapsUrl.trim(),
      meetingPlace: meetingPlace.trim(),
      meetingTime: meetingTime.trim(),
      startTime: startTime.trim(),
      notes: notes.trim(),
      athletes,
      fileName: `convocazione_${(teamName || 'squadra').replace(/[^a-zA-Z0-9]+/g, '_')}`,
    });
  };

  const defaultMessage = useMemo(() => {
    const title = homeAway === 'home' ? `${teamName} vs ${opponent}` : `${opponent} vs ${teamName}`;
    const lines = [
      `🏐 CONVOCAZIONE ${teamName}`,
      title,
    ];
    const when = [matchDate, matchTime].filter(Boolean).join(' ');
    if (when) lines.push(`📅 ${when}`);
    if (venue || city) lines.push(`📍 ${[venue, city].filter(Boolean).join(' - ')}`);
    if (meetingPlace || meetingTime) lines.push(`⏰ Ritrovo: ${[meetingPlace, meetingTime].filter(Boolean).join(' ore ')}`);
    if (startTime) lines.push(`🕐 Inizio gara: ${startTime}`);
    if (notes) lines.push(`📝 ${notes}`);
    return lines.join('\n');
  }, [teamName, opponent, homeAway, matchDate, matchTime, venue, city, meetingPlace, meetingTime, startTime, notes]);

  const handleOpenWhatsApp = async () => {
    if (!validate()) return;
    setSaving(true);
    const id = await persist('sent');
    setSaving(false);
    if (!id) return;
    try {
      const res = await api.get(`/convocations/${id}/contacts`);
      setContacts(res.data?.athletes || []);
      setWaMessage(defaultMessage);
      setSentSet(new Set());
      setWaVisible(true);
    } catch {
      showAlert('Errore', 'Impossibile recuperare i contatti.');
    }
  };

  const recipients = useMemo(() => {
    const seen = new Set<string>();
    const list: { label: string; norm: string }[] = [];
    contacts.forEach(a => {
      const targets: { label: string; phone: string }[] = [];
      if (waMode === 'parents' || waMode === 'both') {
        if (a.mother_phone) targets.push({ label: `${a.athlete_name} · Madre`, phone: a.mother_phone });
        if (a.father_phone) targets.push({ label: `${a.athlete_name} · Padre`, phone: a.father_phone });
      }
      if (waMode === 'athlete' || waMode === 'both') {
        if (a.athlete_phone) targets.push({ label: `${a.athlete_name} · Atleta`, phone: a.athlete_phone });
      }
      targets.forEach(t => {
        const norm = normalizePhone(t.phone);
        if (norm && !seen.has(norm)) { seen.add(norm); list.push({ label: t.label, norm }); }
      });
    });
    return list;
  }, [contacts, waMode]);

  const openWa = (norm: string) => {
    const url = waMessage.trim() ? `https://wa.me/${norm}?text=${encodeURIComponent(waMessage.trim())}` : `https://wa.me/${norm}`;
    if (Platform.OS === 'web') window.open(url, '_blank'); else Linking.openURL(url);
    setSentSet(prev => { const n = new Set(prev); n.add(norm); return n; });
  };
  const copyNumbers = async () => {
    if (recipients.length === 0) { showAlert('Nessun numero', 'Nessun numero per questa selezione.'); return; }
    await Clipboard.setStringAsync(recipients.map(r => `+${r.norm}`).join(', '));
    showAlert('Numeri copiati', `${recipients.length} numeri copiati. Apri WhatsApp → Nuova lista broadcast e incolla.`);
  };
  const copyMessage = async () => {
    await Clipboard.setStringAsync(waMessage.trim());
    showAlert('Messaggio copiato', 'Incollalo nella chat/gruppo WhatsApp.');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator color="#5856D6" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/convocations'))} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{convId ? 'Modifica Convocazione' : 'Nuova Convocazione'}</Text>
          <Text style={styles.headerSub}>{teamName}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} testID="convocation-editor-screen">
        {/* Scegli gara dal calendario */}
        {matches.length > 0 && (
          <View style={styles.card}>
            <TouchableOpacity style={styles.rowBetween} onPress={() => setShowCalendar(v => !v)}>
              <Text style={styles.cardTitle}>📅 Scegli gara dal calendario</Text>
              <Ionicons name={showCalendar ? 'chevron-up' : 'chevron-down'} size={20} color="#5856D6" />
            </TouchableOpacity>
            {showCalendar && (
              <View style={{ marginTop: 8 }}>
                {matches.map(m => {
                  const { date, time } = fmtMatch(m.date);
                  const isSel = selectedMatchId === m.id;
                  return (
                    <TouchableOpacity key={m.id} style={[styles.matchRow, isSel && styles.matchRowSel]} onPress={() => applyMatch(m)}>
                      <Ionicons name={isSel ? 'radio-button-on' : 'radio-button-off'} size={20} color={isSel ? '#5856D6' : '#B0B0B0'} />
                      <Text style={styles.matchText}>
                        {date} {time} · {m.home_away === 'home' ? 'vs' : '@'} {m.opponent}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Dati gara */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dati gara</Text>
          <Text style={styles.label}>Numero gara</Text>
          <TextInput style={styles.input} value={matchNumber} onChangeText={setMatchNumber} placeholder="Es. 2713 (univoco)" keyboardType="default" />
          <Text style={styles.label}>Avversario *</Text>
          <TextInput style={styles.input} value={opponent} onChangeText={setOpponent} placeholder="Es. SAN MARIANO VOLLEY" />
          <View style={styles.rowGap}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Data</Text>
              <TextInput style={styles.input} value={matchDate} onChangeText={onChangeDate} placeholder="GG/MM/AAAA" keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Ora gara</Text>
              <TextInput style={styles.input} value={matchTime} onChangeText={onChangeTime(setMatchTime)} placeholder="HH:MM" keyboardType="number-pad" />
            </View>
          </View>
          <Text style={styles.label}>Casa / Trasferta</Text>
          <View style={styles.toggleRow}>
            {(['home', 'away'] as const).map(v => (
              <TouchableOpacity key={v} style={[styles.toggleBtn, homeAway === v && styles.toggleBtnOn]} onPress={() => setHomeAway(v)}>
                <Text style={[styles.toggleText, homeAway === v && styles.toggleTextOn]}>{v === 'home' ? 'Casa' : 'Trasferta'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Impianto</Text>
          <TextInput style={styles.input} value={venue} onChangeText={setVenue} placeholder="Palazzetto / Palestra" />
          <Text style={styles.label}>Città</Text>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={(t) => { setCity(t); setShowPalestre(true); }}
            placeholder="Scrivi la città per cercare la palestra"
            onFocus={() => setShowPalestre(true)}
          />
          {showPalestre && filteredPalestre.length > 0 && (
            <View style={styles.palBox}>
              <Text style={styles.palHint}>Palestre memorizzate per «{city.trim()}» — tocca per selezionare:</Text>
              {filteredPalestre.map((p, i) => (
                <TouchableOpacity key={`${p.name}-${i}`} style={styles.palRow} onPress={() => selectPalestra(p)}>
                  <Ionicons name="location-outline" size={18} color="#5856D6" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.palName}>{p.name}</Text>
                    {!!p.address && <Text style={styles.palAddr}>{p.address}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {!!venueAddress && (
            <View style={styles.selectedPal}>
              <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
              <Text style={styles.selectedPalText}>{venueAddress}</Text>
            </View>
          )}
          <Text style={styles.label}>Indirizzo impianto</Text>
          <TextInput style={styles.input} value={venueAddress} onChangeText={setVenueAddress} placeholder="Indirizzo (compilato se scegli una palestra)" />
          <Text style={styles.label}>Link mappa (Google Maps)</Text>
          <TextInput style={styles.input} value={mapsUrl} onChangeText={setMapsUrl} placeholder="https://maps.google.com/..." autoCapitalize="none" />
        </View>

        {/* Ritrovo */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ritrovo e note</Text>
          <Text style={styles.label}>Luogo di ritrovo</Text>
          <TextInput style={styles.input} value={meetingPlace} onChangeText={setMeetingPlace} placeholder="Es. Palestra sociale / Impianto" />
          <View style={styles.rowGap}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Ora ritrovo</Text>
              <TextInput style={styles.input} value={meetingTime} onChangeText={onChangeTime(setMeetingTime)} placeholder="HH:MM" keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Inizio gara</Text>
              <TextInput style={styles.input} value={startTime} onChangeText={onChangeTime(setStartTime)} placeholder="HH:MM" keyboardType="number-pad" />
            </View>
          </View>
          <Text style={styles.label}>Note (divisa, trasporti, ecc.)</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder="Note aggiuntive per i convocati" multiline />
        </View>

        {/* Atleti */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Atleti convocati ({selected.size} convocati)</Text>
            {roster.length > 0 && (
              <TouchableOpacity onPress={toggleAll} testID="conv-toggle-all">
                <Text style={styles.selectAll}>{allSelected ? 'Deseleziona tutti' : 'Seleziona tutti'}</Text>
              </TouchableOpacity>
            )}
          </View>
          {roster.length === 0 ? (
            <Text style={styles.emptyText}>Nessun atleta in questa squadra.</Text>
          ) : roster.map(a => {
            const isSel = selected.has(a.id);
            return (
              <TouchableOpacity key={a.id} style={[styles.athleteRow, isSel && styles.athleteRowSel]} onPress={() => toggle(a.id)}>
                <Ionicons name={isSel ? 'checkbox' : 'square-outline'} size={24} color={isSel ? '#5856D6' : '#B0B0B0'} />
                <Text style={styles.athleteName}>{a.full_name}{a.role ? ` · ${a.role}` : ''}</Text>
              </TouchableOpacity>
            );
          })}
          {/* convocati aggiunti da altre squadre della società (restano in elenco) */}
          {allAthletes.filter(a => selected.has(a.id) && !roster.some(r => r.id === a.id)).map(a => (
            <TouchableOpacity key={a.id} style={[styles.athleteRow, styles.athleteRowSel]} onPress={() => toggle(a.id)}>
              <Ionicons name="checkbox" size={24} color="#5856D6" />
              <View style={{ flex: 1 }}>
                <Text style={styles.athleteName}>{a.full_name}{a.role ? ` · ${a.role}` : ''}</Text>
                <Text style={{ fontSize: 12, color: '#999' }}>Aggiunto dalla società{a.team ? ` · ${a.team}` : ''}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* 🆕 Altri atleti della società */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.rowBetween} onPress={loadSociety}>
            <Text style={styles.cardTitle}>➕ Aggiungi altri atleti della società</Text>
            <Ionicons name={showSociety ? 'chevron-up' : 'chevron-down'} size={20} color="#5856D6" />
          </TouchableOpacity>
          {showSociety && (
            <View style={{ marginTop: 8 }}>
              <TextInput
                style={styles.input}
                value={societyQuery}
                onChangeText={setSocietyQuery}
                placeholder="Cerca per nome o squadra"
              />
              {filteredSociety.length === 0 ? (
                <Text style={styles.emptyText}>Nessun altro atleta disponibile.</Text>
              ) : filteredSociety.map(a => {
                const isSel = selected.has(a.id);
                return (
                  <TouchableOpacity key={a.id} style={[styles.athleteRow, isSel && styles.athleteRowSel]} onPress={() => toggle(a.id)}>
                    <Ionicons name={isSel ? 'checkbox' : 'square-outline'} size={24} color={isSel ? '#5856D6' : '#B0B0B0'} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.athleteName}>{a.full_name}{a.role ? ` · ${a.role}` : ''}</Text>
                      {!!a.team && <Text style={{ fontSize: 12, color: '#999' }}>{a.team}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer actions */}
      <View style={styles.footer}>
        <TouchableOpacity testID="conv-pdf-btn" style={[styles.fBtn, styles.fPdf]} onPress={handlePDF} disabled={saving}>
          <Ionicons name="document-text-outline" size={18} color="#5856D6" />
          <Text style={[styles.fBtnText, { color: '#5856D6' }]}>PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="conv-save-draft-btn" style={[styles.fBtn, styles.fDraft]} onPress={handleSaveDraft} disabled={saving}>
          <Ionicons name="save-outline" size={18} color="#333" />
          <Text style={[styles.fBtnText, { color: '#333' }]}>Salva</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="conv-send-wa-btn" style={[styles.fBtn, styles.fSend]} onPress={handleOpenWhatsApp} disabled={saving}>
          <Ionicons name="logo-whatsapp" size={18} color="#fff" />
          <Text style={[styles.fBtnText, { color: '#fff' }]}>Invia</Text>
        </TouchableOpacity>
      </View>

      {/* WhatsApp send modal */}
      <Modal visible={waVisible} transparent animationType="slide" onRequestClose={() => setWaVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Invia su WhatsApp</Text>
              <TouchableOpacity onPress={() => setWaVisible(false)}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>La convocazione è stata salvata come inviata. Tocca un contatto per aprire WhatsApp col messaggio già pronto. Allega il PDF se vuoi.</Text>

            <View style={styles.toggleRow}>
              {(['parents', 'athlete', 'both'] as const).map(m => (
                <TouchableOpacity key={m} style={[styles.toggleBtn, waMode === m && styles.toggleBtnOn]} onPress={() => setWaMode(m)}>
                  <Text style={[styles.toggleText, waMode === m && styles.toggleTextOn]}>{m === 'parents' ? 'Genitori' : m === 'athlete' ? 'Atleta' : 'Entrambi'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput style={[styles.input, { height: 120, textAlignVertical: 'top' }]} value={waMessage} onChangeText={setWaMessage} multiline />

            <View style={[styles.rowGap, { marginBottom: 8 }]}>
              <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#EEF2FF' }]} onPress={copyMessage}>
                <Text style={[styles.smallBtnText, { color: '#5856D6' }]}>Copia messaggio</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#EEF2FF' }]} onPress={copyNumbers}>
                <Text style={[styles.smallBtnText, { color: '#5856D6' }]}>Copia numeri</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#EDE7F6' }]} onPress={handlePDF}>
                <Text style={[styles.smallBtnText, { color: '#5856D6' }]}>PDF</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 280 }}>
              {recipients.length === 0 ? (
                <Text style={styles.emptyText}>Nessun numero disponibile per questa selezione.</Text>
              ) : recipients.map(r => {
                const sent = sentSet.has(r.norm);
                return (
                  <TouchableOpacity key={r.norm} style={styles.contactRow} onPress={() => openWa(r.norm)}>
                    <Text style={styles.contactLabel}>{r.label}</Text>
                    <View style={[styles.waBtn, sent && { backgroundColor: '#9CCC65' }]}>
                      <Ionicons name={sent ? 'checkmark' : 'logo-whatsapp'} size={16} color="#fff" />
                      <Text style={styles.waBtnText}>{sent ? 'Inviato' : 'Apri'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { backgroundColor: '#5856D6', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: '#E0E0FF', fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGap: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 13, color: '#666', marginTop: 10, marginBottom: 4, fontWeight: '600' },
  input: { backgroundColor: '#F7F7FA', borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E6', paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111' },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: '#F0F0F5', alignItems: 'center' },
  toggleBtnOn: { backgroundColor: '#5856D6' },
  toggleText: { fontSize: 14, color: '#555', fontWeight: '600' },
  toggleTextOn: { color: '#fff' },
  matchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  matchRowSel: { backgroundColor: '#F5F3FF', borderRadius: 8 },
  matchText: { fontSize: 14, color: '#333', flex: 1 },
  athleteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  athleteRowSel: { backgroundColor: '#F5F3FF', borderRadius: 8 },
  athleteName: { fontSize: 15, color: '#111', flex: 1 },
  selectAll: { color: '#5856D6', fontWeight: '600', fontSize: 13 },
  palBox: { backgroundColor: '#F5F3FF', borderRadius: 8, padding: 8, marginTop: 8 },
  palHint: { fontSize: 12, color: '#6A5ACD', marginBottom: 6, fontWeight: '600' },
  palRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E6E0FF' },
  palName: { fontSize: 14, color: '#222', fontWeight: '600' },
  palAddr: { fontSize: 12, color: '#777' },
  selectedPal: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#E8F5E9', borderRadius: 8, padding: 8 },
  selectedPalText: { fontSize: 13, color: '#2E7D32', flex: 1 },
  emptyText: { color: '#999', fontStyle: 'italic', marginTop: 10 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, padding: 14, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  fBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 10 },
  fPdf: { backgroundColor: '#EDE7F6' },
  fDraft: { backgroundColor: '#ECECF0' },
  fSend: { backgroundColor: '#25D366' },
  fBtnText: { fontSize: 15, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 30 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  modalHint: { fontSize: 12.5, color: '#666', marginVertical: 8 },
  smallBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  smallBtnText: { fontWeight: '700', fontSize: 13 },
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  contactLabel: { fontSize: 14, color: '#333', flex: 1 },
  waBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#25D366', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  waBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
