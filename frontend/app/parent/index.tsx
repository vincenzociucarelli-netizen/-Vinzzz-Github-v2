import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Athlete } from '../../src/types';

export default function ParentDashboard() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuthStore();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const loadAthletes = async () => {
    try {
      const response = await api.get('/athletes/my');
      setAthletes(response.data);
    } catch (error) {
      console.error('Error loading athletes:', error);
    }
  };

  useEffect(() => {
    loadAthletes();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAthletes();
    setRefreshing(false);
  };

  const openEditProfile = () => {
    // Split full_name into first and last name
    const nameParts = (user?.full_name || '').split(' ');
    setEditLastName(nameParts[0] || '');
    setEditFirstName(nameParts.slice(1).join(' ') || '');
    setEditProfileVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editLastName.trim() || !editFirstName.trim()) {
      Alert.alert('Errore', 'Cognome e Nome sono obbligatori');
      return;
    }
    setSavingProfile(true);
    try {
      const fullName = `${editLastName.trim()} ${editFirstName.trim()}`;
      await api.patch('/auth/me', {
        full_name: fullName,
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
      });
      await refreshUser();
      setEditProfileVisible(false);
      Alert.alert('Successo', 'Dati aggiornati correttamente');
    } catch (error) {
      Alert.alert('Errore', 'Impossibile aggiornare i dati');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sei sicuro di voler uscire?')) {
        await logout();
        window.location.href = '/login';
      }
    } else {
      Alert.alert(
        'Logout',
        'Sei sicuro di voler uscire?',
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Esci',
            onPress: async () => {
              await logout();
              router.replace('/login');
            },
          },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>I Miei Atleti</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.profileSection}>
          <Text style={styles.welcomeText}>Benvenuto, {user?.full_name}</Text>
          <TouchableOpacity onPress={openEditProfile} style={styles.editProfileBtn}>
            <Ionicons name="create-outline" size={18} color="#007AFF" />
            <Text style={styles.editProfileText}>Modifica nome</Text>
          </TouchableOpacity>
        </View>

        {athletes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={80} color="#ccc" />
            <Text style={styles.emptyText}>Nessun atleta registrato</Text>
            <Text style={styles.emptySubtext}>Inizia registrando un atleta</Text>
          </View>
        ) : (
          <View style={styles.athletesList}>
            {athletes.map((athlete) => (
              <TouchableOpacity
                key={athlete.id}
                style={[
                  styles.athleteCard,
                  athlete.status === 'pending' && styles.athleteCardPending
                ]}
                onPress={() => athlete.status !== 'pending' && router.push(`/parent/athlete/${athlete.id}`)}
                disabled={athlete.status === 'pending'}
              >
                <View style={styles.athleteIcon}>
                  <Ionicons 
                    name={athlete.status === 'pending' ? "time" : "person"} 
                    size={32} 
                    color={athlete.status === 'pending' ? "#FF9500" : "#007AFF"} 
                  />
                </View>
                <View style={styles.athleteInfo}>
                  <Text style={styles.athleteName}>{athlete.full_name}</Text>
                  <Text style={[
                    styles.athleteStatus,
                    athlete.status === 'pending' && styles.athleteStatusPending
                  ]}>
                    {athlete.status === 'pending' 
                      ? '⏳ In attesa di approvazione' 
                      : athlete.status === 'trial' 
                        ? 'Periodo di prova' 
                        : 'Attivo'}
                  </Text>
                </View>
                {athlete.status !== 'pending' && (
                  <Ionicons name="chevron-forward" size={24} color="#999" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/parent/register-athlete')}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Registra Nuovo Atleta</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal per modifica nome */}
      <Modal
        visible={editProfileVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditProfileVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifica Dati Personali</Text>
            
            <Text style={styles.inputLabel}>Cognome</Text>
            <TextInput
              style={styles.textInput}
              value={editLastName}
              onChangeText={(text) => setEditLastName(text.toUpperCase())}
              autoCapitalize="characters"
              placeholder="es: ROSSI"
              placeholderTextColor="#aaa"
            />

            <Text style={styles.inputLabel}>Nome</Text>
            <TextInput
              style={styles.textInput}
              value={editFirstName}
              onChangeText={(text) => setEditFirstName(text.toUpperCase())}
              autoCapitalize="characters"
              placeholder="es: MARIO"
              placeholderTextColor="#aaa"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditProfileVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                <Text style={styles.saveButtonText}>
                  {savingProfile ? 'Salvataggio...' : 'Salva'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
  },
  profileSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f8ff',
    borderRadius: 16,
  },
  editProfileText: {
    marginLeft: 4,
    color: '#007AFF',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#34C759',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
  },
  athletesList: {
    padding: 16,
  },
  athleteCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  athleteIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E3F2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  athleteInfo: {
    flex: 1,
    marginLeft: 16,
  },
  athleteName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  athleteStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  athleteStatusPending: {
    color: '#FF9500',
    fontWeight: '600',
  },
  athleteCardPending: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  addButton: {
    backgroundColor: '#007AFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
