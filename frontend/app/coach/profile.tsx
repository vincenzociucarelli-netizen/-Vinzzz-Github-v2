import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';

export default function CoachProfile() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  
  // Profile data
  const [profileData, setProfileData] = useState({
    email: '',
    full_name: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    place_of_birth: '',
    fiscal_code: '',
    address: '',
    city: '',
    postal_code: '',
    province: '',
    phone: '',
    coach_license_number: '',
    monthly_compensation: 0,
    compensation_accepted: false,
  });

  const [editData, setEditData] = useState({ ...profileData });

  const loadProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      const data = response.data;
      setProfileData({
        email: data.email || '',
        full_name: data.full_name || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        date_of_birth: data.date_of_birth ? formatDate(data.date_of_birth) : '',
        place_of_birth: data.place_of_birth || '',
        fiscal_code: data.fiscal_code || '',
        address: data.address || '',
        city: data.city || '',
        postal_code: data.postal_code || '',
        province: data.province || '',
        phone: data.phone || '',
        coach_license_number: data.coach_license_number || '',
        monthly_compensation: data.monthly_compensation || 0,
        compensation_accepted: data.compensation_accepted || false,
      });
      setEditData({
        email: data.email || '',
        full_name: data.full_name || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        date_of_birth: data.date_of_birth ? formatDate(data.date_of_birth) : '',
        place_of_birth: data.place_of_birth || '',
        fiscal_code: data.fiscal_code || '',
        address: data.address || '',
        city: data.city || '',
        postal_code: data.postal_code || '',
        province: data.province || '',
        phone: data.phone || '',
        coach_license_number: data.coach_license_number || '',
        monthly_compensation: data.monthly_compensation || 0,
        compensation_accepted: data.compensation_accepted || false,
      });
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      if (onOk) onOk();
    } else {
      Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Convert date to ISO format
      let isoDate = null;
      if (editData.date_of_birth) {
        const parts = editData.date_of_birth.split('/');
        if (parts.length === 3) {
          isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      await api.patch('/auth/me', {
        first_name: editData.first_name,
        last_name: editData.last_name,
        full_name: `${editData.last_name} ${editData.first_name}`,
        date_of_birth: isoDate,
        place_of_birth: editData.place_of_birth,
        fiscal_code: editData.fiscal_code,
        address: editData.address,
        city: editData.city,
        postal_code: editData.postal_code,
        province: editData.province,
        phone: editData.phone,
        coach_license_number: editData.coach_license_number,
      });
      
      showAlert('Successo', 'Profilo aggiornato con successo');
      setEditing(false);
      await loadProfile();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sei sicuro di voler uscire?')) {
        await logout();
        window.location.href = '/login';
      }
    } else {
      Alert.alert('Logout', 'Sei sicuro di voler uscire?', [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Esci', onPress: async () => { await logout(); router.replace('/login'); } },
      ]);
    }
  };

  const renderField = (label: string, value: string, key: string, editable: boolean = true) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editing && editable ? (
        <TextInput
          style={styles.input}
          value={editData[key as keyof typeof editData]?.toString() || ''}
          onChangeText={(text) => setEditData({ ...editData, [key]: text.toUpperCase() })}
          autoCapitalize="characters"
        />
      ) : (
        <Text style={styles.fieldValue}>{value || '-'}</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Caricamento...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Il Mio Profilo</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Edit/Save Buttons */}
        <View style={styles.actionButtons}>
          {editing ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => {
                  setEditing(false);
                  setEditData({ ...profileData });
                }}
              >
                <Ionicons name="close" size={20} color="#666" />
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={handleSave}
                disabled={saving}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>
                  {saving ? 'Salvataggio...' : 'Salva'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => setEditing(true)}
            >
              <Ionicons name="pencil" size={20} color="#007AFF" />
              <Text style={styles.editButtonText}>Modifica Dati</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Account Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Account</Text>
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{profileData.email}</Text>
          </View>
        </View>

        {/* Personal Data */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Dati Anagrafici</Text>
          {renderField('Nome', profileData.first_name, 'first_name')}
          {renderField('Cognome', profileData.last_name, 'last_name')}
          {renderField('Data di Nascita', profileData.date_of_birth, 'date_of_birth')}
          {renderField('Luogo di Nascita', profileData.place_of_birth, 'place_of_birth')}
          {renderField('Indirizzo', profileData.address, 'address')}
          {renderField('Città', profileData.city, 'city')}
          {renderField('Provincia', profileData.province, 'province')}
          {renderField('CAP', profileData.postal_code, 'postal_code')}
          {renderField('Telefono', profileData.phone, 'phone')}
        </View>

        {/* Fiscal Data */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💼 Dati Fiscali</Text>
          {renderField('Codice Fiscale', profileData.fiscal_code, 'fiscal_code')}
          {renderField('N° Tesserino Allenatore', profileData.coach_license_number, 'coach_license_number')}
        </View>

        {/* Compensation Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💰 Compenso</Text>
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Compenso Mensile</Text>
            <Text style={styles.fieldValue}>
              {profileData.monthly_compensation > 0 
                ? `€ ${profileData.monthly_compensation.toFixed(2)}`
                : 'Non ancora impostato'}
            </Text>
          </View>
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Stato</Text>
            <View style={[
              styles.statusBadge,
              profileData.compensation_accepted ? styles.statusAccepted : styles.statusPending
            ]}>
              <Text style={[
                styles.statusText,
                profileData.compensation_accepted ? styles.statusTextAccepted : styles.statusTextPending
              ]}>
                {profileData.compensation_accepted ? '✓ Accettato' : '⏳ In attesa di accettazione'}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  editButton: {
    backgroundColor: '#E8F4FD',
  },
  editButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#34C759',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: 16,
    color: '#333',
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusAccepted: {
    backgroundColor: '#E8F5E9',
  },
  statusPending: {
    backgroundColor: '#FFF8E1',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusTextAccepted: {
    color: '#2E7D32',
  },
  statusTextPending: {
    color: '#F57C00',
  },
});
