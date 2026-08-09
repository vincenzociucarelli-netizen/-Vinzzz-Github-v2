/**
 * 🆕 23/06/2026 — AthleteTabBar
 *
 * Tab bar condivisa per le pagine `/athlete/*` lato user.
 * Replica lo stile dell'admin athlete view: Da fare / Anagrafica / Compensi / Presenze.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import MiniSocietyLogo from '../MiniSocietyLogo';

type TabKey = 'dafare' | 'anagrafica' | 'compensi' | 'presenze';

interface TabSpec {
  key: TabKey;
  label: string;
  icon: any;
  route: string;
}

const baseTabs = (athleteType: 'compensated' | 'quota' | string | null): TabSpec[] => [
  { key: 'dafare', label: 'Da fare', icon: 'checkbox-outline', route: '/athlete' },
  { key: 'anagrafica', label: 'Anagrafica', icon: 'person', route: '/athlete/profile' },
  {
    key: 'compensi',
    label: athleteType === 'compensated' ? 'Compensi' : 'Pagamenti',
    icon: athleteType === 'compensated' ? 'trophy' : 'card',
    // 🆕 24/02/2026 — Routing condizionale: paganti → /athlete/payments, PRO → /athlete/compensation
    route: athleteType === 'compensated' ? '/athlete/compensation' : '/athlete/payments',
  },
  { key: 'presenze', label: 'Presenze', icon: 'calendar', route: '/athlete/presenze' },
];

export const AthleteTabBar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname() || '';
  const [athleteType, setAthleteType] = useState<'compensated' | 'quota' | null>(null);

  useEffect(() => {
    // 🆕 23/06/2026 — Carica athlete_type per cambiare label "Compensi" ↔ "Pagamenti"
    api.get('/auth/me')
      .then((res) => setAthleteType(res.data?.athlete_type || 'quota'))
      .catch(() => setAthleteType('quota'));
  }, []);

  const activeKey: TabKey = (() => {
    if (pathname.endsWith('/athlete/profile')) return 'anagrafica';
    if (pathname.endsWith('/athlete/compensation')) return 'compensi';
    if (pathname.endsWith('/athlete/presenze')) return 'presenze';
    return 'dafare';
  })();

  const isCompensated = athleteType === 'compensated';
  const tabs = baseTabs(athleteType);

  return (
    <View style={styles.bar} testID="athlete-tab-bar">
      <View style={{ paddingHorizontal: 4, justifyContent: 'center' }}>
        <MiniSocietyLogo size={26} />
      </View>
      {tabs.map((t) => {
        const active = activeKey === t.key;
        const isCompensTab = t.key === 'compensi' && isCompensated;
        return (
          <TouchableOpacity
            key={t.key}
            style={[
              styles.tab,
              active && styles.tabActive,
              isCompensTab && active && styles.tabGoldActive,
            ]}
            onPress={() => router.push(t.route as any)}
            testID={`athlete-tab-${t.key}`}
          >
            <Ionicons
              name={t.icon}
              size={18}
              color={active ? (isCompensTab ? '#B8860B' : '#007AFF') : '#666'}
            />
            <Text
              style={[
                styles.tabText,
                active && styles.tabTextActive,
                isCompensTab && active && styles.tabTextGold,
              ]}
            >
              {t.label}
            </Text>
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
  tabGoldActive: {
    borderBottomColor: '#B8860B',
    backgroundColor: '#FFFBEA',
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
  tabTextGold: {
    color: '#B8860B',
  },
});

export default AthleteTabBar;
