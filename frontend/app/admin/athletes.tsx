import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Athlete, Team } from '../../src/types';
import { exportToExcel } from '../../src/utils/excelExport';
import { useAuthStore } from '../../src/store/authStore';

export default function AdminAthletes() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [teams, setTeams] = useState<{[key: string]: Team}>({});
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
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

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await api.get('/export/athletes');
      await exportToExcel(response.data, 'Atleti');
      showAlert('Successo', 'File Excel esportato con successo');
    } catch (error: any) {
      showAlert('Errore', error.message || 'Errore durante l\'esportazione');
    } finally {
      setExporting(false);
    }
  };

  const loadData = async () => {
    try {
      const [athletesRes, teamsRes] = await Promise.all([
        api.get('/athletes/my'),
        api.get('/teams'),
      ]);

      setAthletes(athletesRes.data);
      
      const teamsMap: {[key: string]: Team} = {};
      teamsRes.data.forEach((team: Team) => {
        teamsMap[team.id] = team;
      });
      setTeams(teamsMap);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const renderAthleteItem = ({ item }: { item: Athlete }) => (
    <TouchableOpacity 
      style={styles.athleteCard}
      onPress={() => router.push(`/admin/athlete/${item.id}`)}
    >
      <View style={styles.athleteIcon}>
        <Ionicons name="person" size={32} color="#007AFF" />
      </View>
      <View style={styles.athleteInfo}>
        <Text style={styles.athleteName}>{item.full_name}</Text>
        <Text style={styles.teamName}>
          {teams[item.team_id]?.name || 'Squadra sconosciuta'}
        </Text>
        <Text style={styles.athleteStatus}>
          {item.status === 'trial' ? 'Periodo di prova' : 'Attivo'}
          {!item.privacy_accepted && ' - Privacy non accettata'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#999" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tutti gli Atleti</Text>
        <TouchableOpacity onPress={handleExport} disabled={exporting}>
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="download-outline" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={athletes}
        renderItem={renderAthleteItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nessun atleta registrato</Text>
          </View>
        }
      />
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  list: {
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
  teamName: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 4,
  },
  athleteStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statusIcon: {
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
});
