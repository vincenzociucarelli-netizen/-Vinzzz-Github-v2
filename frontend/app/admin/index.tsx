import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';

interface Stats {
  total_teams: number;
  total_athletes: number;
  active_athletes: number;
  today_attendances: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const response = await api.get('/stats/overview');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const handleLogout = () => {
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
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard Admin</Text>
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
        <Text style={styles.welcomeText}>Benvenuto, {user?.full_name}</Text>

        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Ionicons name="people" size={32} color="#007AFF" />
              <Text style={styles.statNumber}>{stats.total_athletes}</Text>
              <Text style={styles.statLabel}>Atleti Totali</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="fitness" size={32} color="#34C759" />
              <Text style={styles.statNumber}>{stats.active_athletes}</Text>
              <Text style={styles.statLabel}>Atleti Attivi</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="basketball" size={32} color="#FF9500" />
              <Text style={styles.statNumber}>{stats.total_teams}</Text>
              <Text style={styles.statLabel}>Squadre</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle" size={32} color="#5856D6" />
              <Text style={styles.statNumber}>{stats.today_attendances}</Text>
              <Text style={styles.statLabel}>Presenze Oggi</Text>
            </View>
          </View>
        )}

        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/admin/teams')}
          >
            <Ionicons name="basketball" size={24} color="#007AFF" />
            <Text style={styles.menuText}>Gestione Squadre</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/admin/athletes')}
          >
            <Ionicons name="people" size={24} color="#007AFF" />
            <Text style={styles.menuText}>Visualizza Atleti</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/admin/payments')}
          >
            <Ionicons name="card" size={24} color="#007AFF" />
            <Text style={styles.menuText}>Impostazioni Pagamenti</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/admin/attendances')}
          >
            <Ionicons name="list" size={24} color="#007AFF" />
            <Text style={styles.menuText}>Storico Presenze</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    padding: 20,
    paddingBottom: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    margin: '1%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  menuContainer: {
    padding: 10,
    marginTop: 10,
  },
  menuItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
});
