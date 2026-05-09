import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface AttendanceWithAthlete {
  id: string;
  athlete_id: string;
  athlete_name: string;
  check_in_time: string;
  status: string;
  block_reason?: string;
  team_id: string;
}

export default function AdminAttendances() {
  const router = useRouter();
  const [attendances, setAttendances] = useState<AttendanceWithAthlete[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadAttendances = async () => {
    try {
      const response = await api.get('/attendance/today');
      setAttendances(response.data);
    } catch (error) {
      console.error('Error loading attendances:', error);
    }
  };

  useEffect(() => {
    loadAttendances();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAttendances();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: AttendanceWithAthlete }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.athleteInfo}>
          <Text style={styles.athleteName}>{item.athlete_name}</Text>
          <Text style={styles.time}>
            {format(new Date(item.check_in_time), 'HH:mm - dd/MM/yyyy', { locale: it })}
          </Text>
        </View>
        {item.status === 'allowed' ? (
          <View style={styles.statusAllowed}>
            <Ionicons name="checkmark-circle" size={32} color="#34C759" />
            <Text style={styles.statusTextAllowed}>Ammesso</Text>
          </View>
        ) : (
          <View style={styles.statusBlocked}>
            <Ionicons name="close-circle" size={32} color="#FF3B30" />
            <Text style={styles.statusTextBlocked}>Bloccato</Text>
          </View>
        )}
      </View>
      {item.block_reason && (
        <View style={styles.blockReasonContainer}>
          <Ionicons name="information-circle" size={16} color="#FF3B30" />
          <Text style={styles.blockReason}>{item.block_reason}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Presenze di Oggi</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={attendances}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nessuna presenza oggi</Text>
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
  card: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  athleteInfo: {
    flex: 1,
  },
  athleteName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  time: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statusAllowed: {
    alignItems: 'center',
  },
  statusBlocked: {
    alignItems: 'center',
  },
  statusTextAllowed: {
    fontSize: 12,
    color: '#34C759',
    marginTop: 4,
    fontWeight: '600',
  },
  statusTextBlocked: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
    fontWeight: '600',
  },
  blockReasonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF3F3',
    borderRadius: 8,
  },
  blockReason: {
    flex: 1,
    fontSize: 14,
    color: '#FF3B30',
    marginLeft: 8,
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
