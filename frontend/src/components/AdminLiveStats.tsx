/**
 * 🆕 03/07/2026 — Widget dashboard admin: utenti online + privacy pending + ritiri reversibili.
 * Refresh automatico ogni 30s.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../services/api';

interface Stats {
  online_users: number;
  privacy_pending_count: number;
  withdrawn_reversible_count: number;
}

export const AdminLiveStats: React.FC = () => {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = () => {
      api.get('/admin/dashboard-live-stats')
        .then(r => setStats(r.data))
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  if (!stats) return null;

  const Item = ({ icon, color, count, label, testId, onPress, dotColor }: any) => (
    <TouchableOpacity
      onPress={onPress}
      style={{ flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 6, alignItems: 'center', borderWidth: 1, borderColor: '#EEE' }}
      data-testid={testId}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        {dotColor && (
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />
        )}
        <Ionicons name={icon} size={13} color={color} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: '800', color, marginTop: 1 }}>{count}</Text>
      <Text style={{ fontSize: 9, color: '#666', textAlign: 'center', marginTop: 1 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 10 }}>
      <Item
        icon="pulse"
        color="#2E7D32"
        dotColor="#2E7D32"
        count={stats.online_users}
        label={stats.online_users === 1 ? 'Utente online' : 'Utenti online'}
        testId="live-stat-online"
      />
      <Item
        icon="shield-checkmark"
        color={stats.privacy_pending_count > 0 ? '#C62828' : '#666'}
        count={stats.privacy_pending_count}
        label="Privacy da firmare"
        testId="live-stat-privacy"
        onPress={() => router.push('/admin/parents' as any)}
      />
      <Item
        icon="undo"
        color={stats.withdrawn_reversible_count > 0 ? '#EF6C00' : '#666'}
        count={stats.withdrawn_reversible_count}
        label="Ritiri reversibili"
        testId="live-stat-withdrawn"
        onPress={() => router.push('/admin/athletes?filter=withdrawn' as any)}
      />
    </View>
  );
};

export default AdminLiveStats;
