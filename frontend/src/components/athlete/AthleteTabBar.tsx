/**
 * 🆕 23/06/2026 — AthleteTabBar
 *
 * Tab bar condivisa per le pagine `/athlete/*` lato user.
 * Replica lo stile dell'admin athlete view: Da fare / Anagrafica / Compensi / Presenze.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type TabKey = 'dafare' | 'anagrafica' | 'compensi' | 'presenze';

const TABS: { key: TabKey; label: string; icon: any; route: string }[] = [
  { key: 'dafare', label: 'Da fare', icon: 'checkbox-outline', route: '/athlete' },
  { key: 'anagrafica', label: 'Anagrafica', icon: 'person', route: '/athlete/profile' },
  { key: 'compensi', label: 'Compensi', icon: 'cash', route: '/athlete/compensation' },
  { key: 'presenze', label: 'Presenze', icon: 'calendar', route: '/athlete/presenze' },
];

export const AthleteTabBar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname() || '';

  const activeKey: TabKey = (() => {
    if (pathname.endsWith('/athlete/profile')) return 'anagrafica';
    if (pathname.endsWith('/athlete/compensation')) return 'compensi';
    if (pathname.endsWith('/athlete/presenze')) return 'presenze';
    return 'dafare';
  })();

  return (
    <View style={styles.bar} data-testid="athlete-tab-bar">
      {TABS.map((t) => {
        const active = activeKey === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => router.push(t.route as any)}
            data-testid={`athlete-tab-${t.key}`}
          >
            <Ionicons name={t.icon} size={18} color={active ? '#007AFF' : '#666'} />
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  tabActive: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '700',
  },
});

export default AthleteTabBar;
