import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../src/components/Icon';
import SocietyBranding from '../../src/components/SocietyBranding';
import api from '../../src/services/api';

/**
 * 🆕 26/07/2026 — Wizard "Iscrivi un mio figlio" per Staff
 * Crea un atleta e lo collega automaticamente all'utente corrente come genitore primario.
 * L'anagrafica è completa (come quella admin) ma la creazione è self-service.
 */
export default function RegisterChildPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);

  // Anagrafica atleta
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState(''); // DD/MM/YYYY
  const [fiscalCode, setFiscalCode] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [birthProvince, setBirthProvince] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | ''>('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [teamId, setTeamId] = useState('');

  // Genitore corrente
  const [parentRole, setParentRole] = useState<'father' | 'mother'>('father');

  // Solo per minori
  const [dataPassword, setDataPassword] = useState('');
  const [dataPasswordConfirm, setDataPasswordConfirm] = useState('');
  const [secondParentEmail, setSecondParentEmail] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/teams');
        setTeams(r.data || []);
      } catch { /* noop */ }
    })();
  }, []);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
    else Alert.alert(title, message);
  };

  const formatDobInput = (v: string) => {
    const digits = v.replace(/\D/g, '');
    let out = '';
    if (digits.length > 0) out = digits.substring(0, 2);
    if (digits.length > 2) out += '/' + digits.substring(2, 4);
    if (digits.length > 4) out += '/' + digits.substring(4, 8);
    return out;
  };

  const parseDobToIso = (s: string): string | null => {
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const [_, d, mo, y] = m;
    const dt = new Date(parseInt(y), parseInt(mo) - 1, parseInt(d), 12, 0, 0);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const computeAge = (dobStr: string): number | null => {
    const iso = parseDobToIso(dobStr);
    if (!iso) return null;
    const dt = new Date(iso);
    const now = new Date();
    let age = now.getFullYear() - dt.getFullYear();
    const m = now.getMonth() - dt.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dt.getDate())) age--;
    return age;
  };

  const age = computeAge(dob);
  const isMinor = age !== null && age < 18;

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      showAlert('Attenzione', 'Inserisci nome e cognome');
      return;
    }
    const isoDob = parseDobToIso(dob);
    if (!isoDob) {
      showAlert('Attenzione', 'Data di nascita non valida (usa GG/MM/AAAA)');
      return;
    }
    if (isMinor) {
      if (!dataPassword || dataPassword.length < 4) {
        showAlert('Attenzione', 'Per gli atleti minorenni serve una password protezione dati (min. 4 caratteri)');
        return;
      }
      if (dataPassword !== dataPasswordConfirm) {
        showAlert('Attenzione', 'Le due password protezione dati non coincidono');
        return;
      }
    }

    setSaving(true);
    try {
      const payload: any = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: isoDob,
        fiscal_code: fiscalCode.trim() ? fiscalCode.trim().toUpperCase() : undefined,
        birth_place: birthPlace.trim() || undefined,
        birth_province: birthProvince.trim().toUpperCase() || undefined,
        gender: gender || undefined,
        phone: phone.trim() || undefined,
        email: email.trim().toLowerCase() || undefined,
        address: address.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        city: city.trim() || undefined,
        province: province.trim().toUpperCase() || undefined,
        team_id: teamId || undefined,
        parent_role: parentRole,
      };
      if (isMinor) {
        payload.data_password = dataPassword;
        if (secondParentEmail.trim()) payload.second_parent_email = secondParentEmail.trim().toLowerCase();
      }

      const r = await api.post('/athletes/register-my-child', payload);
      showAlert(
        'Iscrizione completata',
        `${firstName} ${lastName} è stato/a iscritto/a e collegato/a al tuo account.\n\nOra puoi gestirlo/a dalla Modalità Genitore.`,
      );
      router.replace('/parent');
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Impossibile completare l\'iscrizione');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/staff/link-or-register-child'))}>
          <View style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#EF6C00" />
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <SocietyBranding />
          <Text style={styles.headerTitle}>Iscrivi un figlio</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>

        {/* SECTION: Ruolo genitore */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Il tuo ruolo</Text>
          <Text style={styles.hint}>
            Serve per registrare correttamente il tuo codice fiscale sulla scheda dell&apos;atleta.
          </Text>
          <View style={styles.roleRow}>
            <TouchableOpacity
              style={[styles.roleBtn, parentRole === 'father' && styles.roleBtnActive]}
              onPress={() => setParentRole('father')}
              data-testid="role-father-btn"
            >
              <Ionicons name="man" size={22} color={parentRole === 'father' ? '#fff' : '#666'} />
              <Text style={[styles.roleTxt, parentRole === 'father' && styles.roleTxtActive]}>Padre</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleBtn, parentRole === 'mother' && styles.roleBtnActive]}
              onPress={() => setParentRole('mother')}
              data-testid="role-mother-btn"
            >
              <Ionicons name="woman" size={22} color={parentRole === 'mother' ? '#fff' : '#666'} />
              <Text style={[styles.roleTxt, parentRole === 'mother' && styles.roleTxtActive]}>Madre</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION: Dati atleta principali */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dati atleta</Text>
          <Text style={styles.label}>Cognome *</Text>
          <TextInput style={styles.input} value={lastName} onChangeText={t => setLastName(t.toUpperCase())} autoCapitalize="characters" data-testid="rc-lastname-input" />
          <Text style={styles.label}>Nome *</Text>
          <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} autoCapitalize="words" data-testid="rc-firstname-input" />
          <Text style={styles.label}>Data di nascita * (GG/MM/AAAA)</Text>
          <TextInput
            style={styles.input}
            value={dob}
            onChangeText={t => setDob(formatDobInput(t))}
            placeholder="GG/MM/AAAA"
            placeholderTextColor="#999"
            keyboardType="numeric"
            maxLength={10}
            data-testid="rc-dob-input"
          />
          {age !== null && (
            <Text style={{ fontSize: 12, color: isMinor ? '#EF6C00' : '#2E7D32', marginTop: 4 }}>
              {isMinor ? `Minore (${age} anni) — servirà la password protezione dati` : `Maggiorenne (${age} anni)`}
            </Text>
          )}
          <Text style={styles.label}>Codice Fiscale</Text>
          <TextInput style={styles.input} value={fiscalCode} onChangeText={t => setFiscalCode(t.toUpperCase())} autoCapitalize="characters" maxLength={16} data-testid="rc-cf-input" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 2 }}>
              <Text style={styles.label}>Luogo di nascita</Text>
              <TextInput style={styles.input} value={birthPlace} onChangeText={setBirthPlace} data-testid="rc-birthplace-input" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Prov.</Text>
              <TextInput style={styles.input} value={birthProvince} onChangeText={t => setBirthProvince(t.toUpperCase())} maxLength={2} data-testid="rc-birthprov-input" />
            </View>
          </View>
          <Text style={styles.label}>Sesso</Text>
          <View style={styles.roleRow}>
            <TouchableOpacity style={[styles.roleBtn, gender === 'M' && styles.roleBtnActive]} onPress={() => setGender('M')} data-testid="rc-gender-m">
              <Text style={[styles.roleTxt, gender === 'M' && styles.roleTxtActive]}>M</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.roleBtn, gender === 'F' && styles.roleBtnActive]} onPress={() => setGender('F')} data-testid="rc-gender-f">
              <Text style={[styles.roleTxt, gender === 'F' && styles.roleTxtActive]}>F</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION: Contatti */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contatti</Text>
          <Text style={styles.label}>Telefono</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" data-testid="rc-phone-input" />
          {!isMinor && (
            <>
              <Text style={styles.label}>Email atleta</Text>
              <TextInput style={styles.input} value={email} onChangeText={t => setEmail(t.toLowerCase())} keyboardType="email-address" autoCapitalize="none" data-testid="rc-email-input" />
            </>
          )}
        </View>

        {/* SECTION: Indirizzo */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Residenza</Text>
          <Text style={styles.label}>Indirizzo</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} data-testid="rc-address-input" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>CAP</Text>
              <TextInput style={styles.input} value={postalCode} onChangeText={setPostalCode} keyboardType="numeric" maxLength={5} data-testid="rc-cap-input" />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={styles.label}>Città</Text>
              <TextInput style={styles.input} value={city} onChangeText={setCity} data-testid="rc-city-input" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Prov.</Text>
              <TextInput style={styles.input} value={province} onChangeText={t => setProvince(t.toUpperCase())} maxLength={2} data-testid="rc-province-input" />
            </View>
          </View>
        </View>

        {/* SECTION: Squadra */}
        {teams.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Squadra (facoltativo)</Text>
            <Text style={styles.hint}>Puoi anche lasciare vuoto e assegnarla dopo con l&apos;admin.</Text>
            <View style={{ gap: 6, marginTop: 8 }}>
              {[{ id: '', name: 'Nessuna (assegnata dopo)' }, ...teams].map((t: any) => (
                <TouchableOpacity
                  key={t.id || 'none'}
                  style={[styles.teamPill, teamId === t.id && styles.teamPillActive]}
                  onPress={() => setTeamId(t.id)}
                  data-testid={`rc-team-${t.id || 'none'}`}
                >
                  <Ionicons name={teamId === t.id ? 'radio-button-on' : 'radio-button-off'} size={18} color={teamId === t.id ? '#EF6C00' : '#999'} />
                  <Text style={[styles.teamPillTxt, teamId === t.id && styles.teamPillTxtActive]}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* SECTION: Solo per minori */}
        {isMinor && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sicurezza (obbligatoria per minori)</Text>
            <Text style={styles.label}>Password protezione dati *</Text>
            <TextInput style={styles.input} value={dataPassword} onChangeText={setDataPassword} secureTextEntry data-testid="rc-datapwd-input" />
            <Text style={styles.label}>Conferma password *</Text>
            <TextInput style={styles.input} value={dataPasswordConfirm} onChangeText={setDataPasswordConfirm} secureTextEntry data-testid="rc-datapwd-confirm-input" />
            <Text style={styles.hint}>Serve per accedere/modificare i dati sensibili del minore.</Text>

            <View style={{ height: 12 }} />
            <Text style={styles.label}>Email 2° genitore (opzionale)</Text>
            <TextInput
              style={styles.input}
              value={secondParentEmail}
              onChangeText={t => setSecondParentEmail(t.toLowerCase())}
              placeholder="es. coniuge@esempio.com"
              placeholderTextColor="#999"
              autoCapitalize="none"
              keyboardType="email-address"
              data-testid="rc-second-email-input"
            />
            <Text style={styles.hint}>Se registrato in società, riceverà una richiesta di collegamento.</Text>
          </View>
        )}

        {/* SUBMIT */}
        <TouchableOpacity
          style={[styles.submitBtn, saving && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={saving}
          data-testid="rc-submit-btn"
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.submitTxt}>Iscrivi e collega al mio account</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#FFF3E0', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: {
    backgroundColor: '#fff', borderRadius: 20, padding: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#E65100' },
  content: { flex: 1 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '600', color: '#555', marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14,
    backgroundColor: '#fafafa', color: '#000',
  },
  hint: { fontSize: 11, color: '#888', marginTop: 4, lineHeight: 15 },
  roleRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  roleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 10, backgroundColor: '#fff',
  },
  roleBtnActive: { backgroundColor: '#EF6C00', borderColor: '#EF6C00' },
  roleTxt: { fontSize: 13, fontWeight: '600', color: '#666' },
  roleTxtActive: { color: '#fff' },
  teamPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#eee', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
  },
  teamPillActive: { backgroundColor: '#FFF3E0', borderColor: '#EF6C00' },
  teamPillTxt: { fontSize: 13, color: '#444' },
  teamPillTxtActive: { color: '#E65100', fontWeight: '600' },
  submitBtn: {
    marginTop: 8, backgroundColor: '#EF6C00', borderRadius: 12, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  submitTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
