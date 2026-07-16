/**
 * 🆕 27/02/2026 — Gestione Coordinatori (ruolo intermedio Admin/Dirigente).
 *
 * Il Main Admin può creare Coordinatori con permessi granulari (checkbox per
 * sezione: teams, athletes, events, ecc.). Il Coordinatore vede solo le
 * sezioni permesse nella propria dashboard.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';
import SocietyBranding from '../../src/components/SocietyBranding';

interface PermissionKey { key: string; label: string; }

interface Coordinator {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  fiscal_code?: string;
  coordinator_permissions: string[];
  status?: string;
}

const showAlert = (t: string, m: string) => {
  if (Platform.OS === 'web') window.alert(`${t}\n\n${m}`);
  else Alert.alert(t, m);
};

export default function CoordinatorsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Coordinator[]>([]);
  const [permKeys, setPermKeys] = useState<PermissionKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: '', first_name: '', last_name: '', phone: '', fiscal_code: '',
    permissions: [] as string[],
  });

  const load = async () => {
    setLoading(true);
    try {
      const [listRes, keysRes] = await Promise.all([
        api.get('/admin/coordinators'),
        api.get('/admin/coordinator-permission-keys'),
      ]);
      setItems(listRes.data || []);
      setPermKeys(keysRes.data || []);
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Impossibile caricare');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const togglePerm = (k: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(k) ? f.permissions.filter(p => p !== k) : [...f.permissions, k],
    }));
  };

  const startCreate = () => {
    setEditingId(null);
    setForm({ email: '', first_name: '', last_name: '', phone: '', fiscal_code: '', permissions: [] });
    setShowCreate(true);
  };

  const startEdit = (c: Coordinator) => {
    setEditingId(c.id);
    setForm({
      email: c.email,
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      phone: c.phone || '',
      fiscal_code: c.fiscal_code || '',
      permissions: c.coordinator_permissions || [],
    });
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!form.email.trim() || !form.first_name.trim() || !form.last_name.trim()) {
      showAlert('Campi mancanti', 'Email, Nome e Cognome sono obbligatori');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        // Update profile + permissions in due chiamate distinte
        await api.patch(`/admin/coordinators/${editingId}`, {
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone || null,
          fiscal_code: form.fiscal_code || null,
        });
        await api.patch(`/admin/coordinators/${editingId}/permissions`, {
          permissions: form.permissions,
        });
      } else {
        await api.post('/admin/coordinators', form);
      }
      setShowCreate(false);
      await load();
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Impossibile salvare');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Coordinator) => {
    const confirm = Platform.OS === 'web'
      ? window.confirm(`Eliminare il coordinatore ${c.last_name} ${c.first_name}?\n\nPerderà l'accesso alla piattaforma.`)
      : true;
    if (!confirm) return;
    try {
      await api.delete(`/admin/coordinators/${c.id}`);
      await load();
    } catch (e: any) {
      showAlert('Errore', e?.response?.data?.detail || 'Impossibile eliminare');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      <View style={{ backgroundColor: '#1565C0', paddingTop: 40, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} data-testid="coord-back">
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <SocietyBranding logoSize={32} />
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 4 }}>Coordinatori</Text>
        </View>
        <TouchableOpacity onPress={startCreate} style={{ backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', gap: 4, alignItems: 'center' }} data-testid="coord-add-btn">
          <Ionicons name="add" size={18} color="#1565C0" />
          <Text style={{ color: '#1565C0', fontWeight: '700', fontSize: 13 }}>Nuovo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ backgroundColor: '#E3F2FD', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <Text style={{ fontSize: 12, color: '#0D47A1', lineHeight: 17 }}>
            <Text style={{ fontWeight: '700' }}>Coordinatore</Text>: figura intermedia tra Admin e Dirigente. Vede/modifica solo le sezioni <Text style={{ fontWeight: '700' }}>organizzative</Text> che spunti qui sotto. Non accede mai a pagamenti, compensi, IBAN, ricevute, sponsor o bilanci.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#1565C0" />
        ) : items.length === 0 ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 32, alignItems: 'center' }}>
            <Ionicons name="people-outline" size={48} color="#CCC" />
            <Text style={{ fontSize: 14, color: '#999', marginTop: 12, textAlign: 'center' }}>Nessun coordinatore. Aggiungine uno con il pulsante &quot;Nuovo&quot; in alto.</Text>
          </View>
        ) : (
          items.map(c => (
            <View key={c.id} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 }} data-testid={`coord-${c.id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E3F2FD', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={22} color="#1565C0" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#0D47A1' }}>{c.last_name} {c.first_name}</Text>
                  <Text style={{ fontSize: 12, color: '#666' }}>{c.email}</Text>
                  {c.status === 'pending_email' && (
                    <Text style={{ fontSize: 11, color: '#E65100', marginTop: 2, fontWeight: '600' }}>⏳ In attesa di attivazione email</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => startEdit(c)} style={{ padding: 8 }} data-testid={`coord-edit-${c.id}`}>
                  <Ionicons name="create-outline" size={22} color="#1565C0" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(c)} style={{ padding: 8 }} data-testid={`coord-delete-${c.id}`}>
                  <Ionicons name="trash-outline" size={22} color="#C62828" />
                </TouchableOpacity>
              </View>
              <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(c.coordinator_permissions || []).length === 0 ? (
                  <Text style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>Nessuna sezione abilitata</Text>
                ) : (
                  c.coordinator_permissions.map(p => {
                    const lbl = permKeys.find(k => k.key === p)?.label || p;
                    return (
                      <View key={p} style={{ backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                        <Text style={{ fontSize: 11, color: '#2E7D32', fontWeight: '600' }}>✓ {lbl}</Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Create/Edit modal */}
      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
          <View style={{ backgroundColor: '#1565C0', paddingTop: 40, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginLeft: 12, flex: 1 }}>{editingId ? 'Modifica Coordinatore' : 'Nuovo Coordinatore'}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Text style={styles.lbl}>Email *</Text>
            <TextInput
              style={styles.inp}
              value={form.email}
              onChangeText={t => setForm(f => ({ ...f, email: t.toLowerCase() }))}
              placeholder="coordinatore@esempio.it"
              placeholderTextColor="#AAA"
              autoCapitalize="none"
              editable={!editingId}
              data-testid="coord-email"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lbl}>Nome *</Text>
                <TextInput style={styles.inp} value={form.first_name} onChangeText={t => setForm(f => ({ ...f, first_name: t }))} placeholder="Mario" placeholderTextColor="#AAA" data-testid="coord-fname" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lbl}>Cognome *</Text>
                <TextInput style={styles.inp} value={form.last_name} onChangeText={t => setForm(f => ({ ...f, last_name: t }))} placeholder="Rossi" placeholderTextColor="#AAA" data-testid="coord-lname" />
              </View>
            </View>
            <Text style={styles.lbl}>Telefono</Text>
            <TextInput style={styles.inp} value={form.phone} onChangeText={t => setForm(f => ({ ...f, phone: t }))} placeholder="3331234567" placeholderTextColor="#AAA" keyboardType="phone-pad" />
            <Text style={styles.lbl}>Codice Fiscale</Text>
            <TextInput style={styles.inp} value={form.fiscal_code} onChangeText={t => setForm(f => ({ ...f, fiscal_code: t.toUpperCase() }))} placeholder="RSSMRA80A01H501U" placeholderTextColor="#AAA" autoCapitalize="characters" />

            <View style={{ backgroundColor: '#FFF9C4', borderRadius: 10, padding: 12, marginTop: 12, marginBottom: 8 }}>
              <Text style={{ fontSize: 13, color: '#7A5D00', fontWeight: '700' }}>Sezioni consentite</Text>
              <Text style={{ fontSize: 11, color: '#7A5D00', marginTop: 2 }}>Spunta le sezioni che questo coordinatore potrà vedere e modificare. Le sezioni amministrative (pagamenti, IBAN, compensi, sponsor) sono sempre nascoste.</Text>
            </View>
            {permKeys.map(pk => (
              <TouchableOpacity
                key={pk.key}
                onPress={() => togglePerm(pk.key)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  padding: 12, marginBottom: 6, backgroundColor: '#fff', borderRadius: 8,
                  borderWidth: 1, borderColor: form.permissions.includes(pk.key) ? '#2E7D32' : '#e0e0e0',
                }}
                data-testid={`coord-perm-${pk.key}`}
              >
                <Ionicons name={form.permissions.includes(pk.key) ? 'checkbox' : 'square-outline'} size={22} color={form.permissions.includes(pk.key) ? '#2E7D32' : '#999'} />
                <Text style={{ fontSize: 14, color: '#333', fontWeight: form.permissions.includes(pk.key) ? '700' : '400' }}>{pk.label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={{ backgroundColor: '#2E7D32', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 12, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              data-testid="coord-save-btn"
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={20} color="#fff" />}
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{saving ? 'Salvataggio...' : (editingId ? 'Salva modifiche' : 'Crea coordinatore')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = {
  lbl: { fontSize: 13, fontWeight: '600' as const, color: '#555', marginTop: 10, marginBottom: 4 },
  inp: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', fontSize: 14 },
};
