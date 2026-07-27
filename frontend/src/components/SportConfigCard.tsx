/**
 * 🆕 27/07/2026 — SportConfigCard
 *
 * Card per l'admin nelle impostazioni società: permette di scegliere sport,
 * federazione, regione. Da questi valori dipende la visibilità di feature
 * condizionali (es. Regole FIPAV Minorenni per pallavolo).
 *
 * Backend endpoints:
 *   GET   /api/societies/sports/available
 *   PATCH /api/societies/my/sport-config
 *   GET   /api/societies/my   (per leggere valori attuali)
 */
import React, { useEffect, useState, useCallback } from 'react';
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
import api from '../services/api';

interface SportOption {
  key: string;
  label: string;
  default_federation: string | null;
}

const showAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

export default function SportConfigCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sports, setSports] = useState<SportOption[]>([]);
  const [sport, setSport] = useState('pallavolo');
  const [federation, setFederation] = useState('FIPAV');
  const [region, setRegion] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [sportsRes, societyRes] = await Promise.all([
        api.get('/societies/sports/available'),
        api.get('/societies/my'),
      ]);
      setSports(sportsRes.data?.sports || []);
      setSport(societyRes.data?.sport || 'pallavolo');
      setFederation(societyRes.data?.federation || 'FIPAV');
      setRegion(societyRes.data?.region || '');
    } catch (_e) {
      showAlert('Errore', 'Impossibile caricare la configurazione sport.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSportChange = (newSport: string) => {
    setSport(newSport);
    setDropdownOpen(false);
    const found = sports.find(s => s.key === newSport);
    if (found?.default_federation) {
      setFederation(found.default_federation);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await api.patch('/societies/my/sport-config', {
        sport,
        federation: federation.trim() || null,
        region: region.trim() || null,
      });
      if (res.data?.success) {
        showAlert('Salvato', 'Configurazione sport aggiornata correttamente.');
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail || 'Errore durante il salvataggio.';
      showAlert('Errore', typeof detail === 'string' ? detail : 'Errore.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.card} data-testid="sport-config-loading">
        <ActivityIndicator size="small" color="#1E3A8A" />
      </View>
    );
  }

  const selectedLabel = sports.find(s => s.key === sport)?.label || sport;

  return (
    <View style={styles.card} data-testid="sport-config-card">
      <View style={styles.header}>
        <Ionicons name="trophy" size={20} color="#1E3A8A" />
        <Text style={styles.title}>Configurazione Sport</Text>
      </View>
      <Text style={styles.subtitle}>
        Sport praticato dalla società: da questo dipende la visibilità di regole federali
        specifiche (es. regole FIPAV per pallavolo).
      </Text>

      {/* Sport dropdown */}
      <Text style={styles.label}>Sport praticato *</Text>
      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => setDropdownOpen(!dropdownOpen)}
        data-testid="sport-dropdown"
      >
        <Text style={styles.dropdownText}>{selectedLabel}</Text>
        <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#374151" />
      </TouchableOpacity>
      {dropdownOpen && (
        <View style={styles.dropdownList}>
          {sports.map(s => (
            <TouchableOpacity
              key={s.key}
              style={[styles.dropdownItem, s.key === sport && styles.dropdownItemActive]}
              onPress={() => handleSportChange(s.key)}
              data-testid={`sport-option-${s.key}`}
            >
              <Text style={s.key === sport ? styles.dropdownItemActiveText : styles.dropdownItemText}>
                {s.label}
              </Text>
              {s.key === sport && <Ionicons name="checkmark" size={16} color="#059669" />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Federation input */}
      <Text style={styles.label}>Federazione</Text>
      <TextInput
        value={federation}
        onChangeText={setFederation}
        placeholder="Es. FIPAV, FIP, FIGC..."
        style={styles.input}
        editable={!saving}
        data-testid="federation-input"
      />

      {/* Region input */}
      <Text style={styles.label}>Regione (opzionale)</Text>
      <TextInput
        value={region}
        onChangeText={setRegion}
        placeholder="Es. Umbria, Toscana..."
        style={styles.input}
        editable={!saving}
        data-testid="region-input"
      />

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        data-testid="sport-config-save-btn"
      >
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons name="save" size={16} color="#fff" />
            <Text style={styles.saveBtnText}>Salva configurazione</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  subtitle: { fontSize: 12, color: '#6B7280', marginBottom: 14, lineHeight: 17 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 8 },
  dropdown: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
  },
  dropdownText: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  dropdownList: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, marginTop: 4, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  dropdownItemActive: { backgroundColor: '#EFF6FF' },
  dropdownItemText: { fontSize: 14, color: '#374151' },
  dropdownItemActiveText: { fontSize: 14, color: '#1E3A8A', fontWeight: '600' },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  saveBtn: {
    marginTop: 16, backgroundColor: '#1E3A8A', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 8,
  },
  saveBtnDisabled: { backgroundColor: '#9CA3AF' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
