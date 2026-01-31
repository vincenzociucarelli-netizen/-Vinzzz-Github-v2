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
  Image,
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

interface PendingCount {
  dirigenti: number;
  coaches: number;
  parents: number;
}

interface SocietySettings {
  name: string;
  logo: string | null;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingCounts, setPendingCounts] = useState<PendingCount>({ dirigenti: 0, coaches: 0, parents: 0 });
  const [society, setSociety] = useState<SocietySettings>({ name: 'Società Sportiva', logo: null });
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const [statsRes, pendingRes, societyRes] = await Promise.all([
        api.get('/stats/overview'),
        api.get('/users/pending'),
        api.get('/settings/society'),
      ]);
      setStats(statsRes.data);
      setSociety(societyRes.data);
      
      // Count pending by role
      const pending = pendingRes.data;
      const dirigentiPending = pending.filter((u: any) => u.role === 'admin' || u.role === 'viewer').length;
      const coachesPending = pending.filter((u: any) => u.role === 'coach').length;
      const parentsPending = pending.filter((u: any) => u.role === 'parent').length;
      setPendingCounts({ dirigenti: dirigentiPending, coaches: coachesPending, parents: parentsPending });
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
    if (Platform.OS === 'web') {
      if (window.confirm('Sei sicuro di voler uscire?')) {
        logout();
        router.replace('/login');
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
        <View style={styles.headerLeft}>
          {society.logo && (
            <Image
              source={{ uri: `data:image/jpeg;base64,${society.logo}` }}
              style={styles.headerLogo}
              resizeMode="cover"
            />
          )}
          <Text style={styles.headerTitle}>{society.name}</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => router.push('/admin/settings')} style={styles.headerBtn}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.headerBtn}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.welcomeText}>Benvenuto, {user?.full_name}</Text>

        {/* Quick Stats */}
        {stats && (
          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatNumber}>{stats.total_athletes}</Text>
              <Text style={styles.quickStatLabel}>Atleti</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatNumber}>{stats.total_teams}</Text>
              <Text style={styles.quickStatLabel}>Squadre</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatNumber}>{stats.today_attendances}</Text>
              <Text style={styles.quickStatLabel}>Presenze Oggi</Text>
            </View>
          </View>
        )}

        {/* Section Title */}
        <Text style={styles.sectionTitle}>Gestione</Text>

        {/* 4 Main Sections */}
        <View style={styles.menuContainer}>
          {/* Dirigenti */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/dirigenti')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#E8F4FD' }]}>
              <Ionicons name="briefcase" size={28} color="#007AFF" />
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Dirigenti</Text>
              <Text style={styles.menuCardSubtitle}>Admin e Visualizzatori</Text>
            </View>
            {pendingCounts.dirigenti > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCounts.dirigenti}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          {/* Coach */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/coaches')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="fitness" size={28} color="#FF9500" />
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Coach</Text>
              <Text style={styles.menuCardSubtitle}>Gestione allenatori</Text>
            </View>
            {pendingCounts.coaches > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCounts.coaches}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          {/* Squadre */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/teams')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="people" size={28} color="#34C759" />
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Squadre</Text>
              <Text style={styles.menuCardSubtitle}>{stats?.total_teams || 0} squadre registrate</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          {/* Genitori */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/parents')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#F3E5F5' }]}>
              <Ionicons name="people-circle" size={28} color="#9C27B0" />
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Genitori</Text>
              <Text style={styles.menuCardSubtitle}>Gestione genitori/atleti</Text>
            </View>
            {pendingCounts.parents > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCounts.parents}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          {/* Atleti */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/athletes')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#F3E5F5' }]}>
              <Ionicons name="person" size={28} color="#9C27B0" />
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Atleti</Text>
              <Text style={styles.menuCardSubtitle}>{stats?.total_athletes || 0} atleti registrati</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          {/* Storico Presenze */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/attendances')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#F0EFFF' }]}>
              <Ionicons name="calendar-outline" size={28} color="#5856D6" />
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Storico Presenze</Text>
              <Text style={styles.menuCardSubtitle}>Presenze di oggi: {stats?.today_attendances || 0}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Bottom padding for Android navigation */}
        <View style={{ height: 100 }} />
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
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerBtn: {
    padding: 4,
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
  quickStats: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  quickStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  menuContainer: {
    paddingHorizontal: 16,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuCardContent: {
    flex: 1,
    marginLeft: 12,
  },
  menuCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  menuCardSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
