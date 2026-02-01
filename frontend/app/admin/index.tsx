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

interface Birthday {
  id: string;
  name: string;
  type: string;
  age: number;
  icon: string;
}

interface ExpiringCertificates {
  count_today: number;
  count_30_days: number;
  expiring_today: any[];
  expiring_soon: any[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingCounts, setPendingCounts] = useState<PendingCount>({ dirigenti: 0, coaches: 0, parents: 0 });
  const [society, setSociety] = useState<SocietySettings>({ name: 'Società Sportiva', logo: null });
  const [refreshing, setRefreshing] = useState(false);
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [expiringCerts, setExpiringCerts] = useState<ExpiringCertificates>({ count_today: 0, count_30_days: 0, expiring_today: [], expiring_soon: [] });

  const loadStats = async () => {
    try {
      const [statsRes, pendingRes, societyRes, birthdaysRes, certsRes] = await Promise.all([
        api.get('/stats/overview'),
        api.get('/users/pending'),
        api.get('/settings/society'),
        api.get('/birthdays/today'),
        api.get('/certificates/expiring'),
      ]);
      setStats(statsRes.data);
      setSociety(societyRes.data);
      setBirthdays(birthdaysRes.data);
      setExpiringCerts(certsRes.data);
      
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

  const showInfo = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
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
          {/* Switch to Dirigente button */}
          <TouchableOpacity 
            onPress={() => router.replace('/dirigente')} 
            style={[styles.headerBtn, styles.dirigenteSwitchBtn]}
          >
            <Ionicons name="briefcase" size={18} color="#8E44AD" />
          </TouchableOpacity>
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
            <TouchableOpacity 
              style={styles.quickStatItem}
              onPress={() => router.push('/admin/athletes')}
            >
              <Text style={styles.quickStatNumber}>{stats.total_athletes}</Text>
              <Text style={styles.quickStatLabel}>Atleti</Text>
            </TouchableOpacity>
            <View style={styles.quickStatDivider} />
            <TouchableOpacity 
              style={styles.quickStatItem}
              onPress={() => router.push('/admin/teams')}
            >
              <Text style={styles.quickStatNumber}>{stats.total_teams}</Text>
              <Text style={styles.quickStatLabel}>Squadre</Text>
            </TouchableOpacity>
            <View style={styles.quickStatDivider} />
            <TouchableOpacity 
              style={styles.quickStatItem}
              onPress={() => router.push('/admin/attendances')}
            >
              <Text style={styles.quickStatNumber}>{stats.today_attendances}</Text>
              <Text style={styles.quickStatLabel}>Presenze Oggi</Text>
            </TouchableOpacity>
            <View style={styles.quickStatDivider} />
            <TouchableOpacity 
              style={styles.quickStatItem}
              onPress={() => birthdays.length > 0 && showInfo(
                '🎂 Compleanni di Oggi',
                birthdays.map(b => `${b.name} (${b.age} anni) - ${b.type}`).join('\n') || 'Nessun compleanno oggi'
              )}
            >
              <View style={styles.quickStatIconRow}>
                <Ionicons name="gift" size={20} color={birthdays.length > 0 ? '#FF9500' : '#007AFF'} />
                <Text style={[styles.quickStatNumber, birthdays.length > 0 && { color: '#FF9500' }]}>
                  {birthdays.length}
                </Text>
              </View>
              <Text style={styles.quickStatLabel}>Compleanni</Text>
            </TouchableOpacity>
            <View style={styles.quickStatDivider} />
            <TouchableOpacity 
              style={styles.quickStatItem}
              onPress={() => {
                const total = expiringCerts.count_today + expiringCerts.count_30_days;
                if (total > 0) {
                  let message = '';
                  if (expiringCerts.count_today > 0) {
                    message += `⚠️ OGGI: ${expiringCerts.count_today} certificati\n`;
                    expiringCerts.expiring_today.forEach((c: any) => {
                      message += `• ${c.athlete_name}\n`;
                    });
                  }
                  if (expiringCerts.count_30_days > 0) {
                    message += `\n📋 Prossimi 30 giorni: ${expiringCerts.count_30_days}\n`;
                    expiringCerts.expiring_soon.slice(0, 5).forEach((c: any) => {
                      message += `• ${c.athlete_name} (${c.days_until_expiry}g)\n`;
                    });
                    if (expiringCerts.count_30_days > 5) {
                      message += `... e altri ${expiringCerts.count_30_days - 5}`;
                    }
                  }
                  showInfo('📋 Certificati in Scadenza', message);
                }
              }}
            >
              <View style={styles.quickStatIconRow}>
                <Ionicons 
                  name="document-text" 
                  size={20} 
                  color={expiringCerts.count_today > 0 ? '#FF3B30' : (expiringCerts.count_30_days > 0 ? '#FF9500' : '#007AFF')} 
                />
                <Text style={[
                  styles.quickStatNumber, 
                  expiringCerts.count_today > 0 && { color: '#FF3B30' },
                  expiringCerts.count_today === 0 && expiringCerts.count_30_days > 0 && { color: '#FF9500' }
                ]}>
                  {expiringCerts.count_today + expiringCerts.count_30_days}
                </Text>
              </View>
              <Text style={styles.quickStatLabel}>Cert. Scadenza</Text>
            </TouchableOpacity>
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
              <Text style={styles.menuCardTitle}>{society.name || 'Società'}</Text>
              <Text style={styles.menuCardSubtitle}>Amministratori e Dirigenti</Text>
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
          
          {/* Archivio Stagioni */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/seasons')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#FBE9E7' }]}>
              <Ionicons name="archive" size={28} color="#FF5722" />
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Archivio Stagioni</Text>
              <Text style={styles.menuCardSubtitle}>Storico atleti, coach e campionati</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          {/* Il Mio Profilo */}
          <TouchableOpacity
            style={styles.menuCard}
            onPress={() => router.push('/admin/profile')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="person-circle" size={28} color="#2196F3" />
            </View>
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardTitle}>Il Mio Profilo</Text>
              <Text style={styles.menuCardSubtitle}>Dati personali e compensi</Text>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerBtn: {
    padding: 4,
  },
  dirigenteSwitchBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 5,
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
  quickStatIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
