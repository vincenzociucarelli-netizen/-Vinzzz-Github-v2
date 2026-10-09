import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';

type TabKey = 'dafare' | 'anagrafica' | 'compensi';

interface Props { active?: TabKey; }

const TABS: { key: TabKey; label: string; icon: any; route: string; color: string }[] = [
  { key: 'dafare', label: 'Da fare', icon: 'today-outline', route: '/coach', color: '#F57C00' },
  { key: 'anagrafica', label: 'Anagrafica', icon: 'person-outline', route: '/coach/profile', color: '#1565C0' },
  { key: 'compensi', label: 'Compensi', icon: 'cash-outline', route: '/coach/compensation', color: '#2E7D32' },
];

export default function CoachTabBar({ active }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const detected: TabKey =
    pathname?.includes('/coach/profile') ? 'anagrafica'
    : pathname?.includes('/coach/compensation') ? 'compensi'
    : 'dafare';
  const current = active || detected;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 12, marginBottom: 8 }}>
      {/* 🧹 Mini-logo società rimosso per dare spazio alle tab su mobile */}
      {TABS.map(t => {
        const isActive = current === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            disabled={isActive}
            onPress={() => router.push(t.route as any)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: isActive ? t.color : '#fff', gap: 6 }}
            data-testid={`coach-quick-${t.key}`}
          >
            <Ionicons name={t.icon} size={20} color={isActive ? '#fff' : t.color} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#fff' : t.color }}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
