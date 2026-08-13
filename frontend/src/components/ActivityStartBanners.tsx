import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type ActivityBanner = {
  team_id: string;
  team_name: string;
  start_label: string;
  provisional?: boolean;
};

/**
 * Banner verde "Inizio allenamenti" per una o più squadre.
 * Riutilizzato in dashboard coach, atleta e genitore.
 * De-duplica per team_id in modo che, per dual-role o più figli,
 * ogni squadra compaia una sola volta.
 */
export default function ActivityStartBanners({ banners }: { banners?: ActivityBanner[] }) {
  if (!banners || banners.length === 0) return null;

  const seen = new Set<string>();
  const unique = banners.filter((b) => {
    if (!b || !b.team_id) return false;
    if (seen.has(b.team_id)) return false;
    seen.add(b.team_id);
    return true;
  });

  if (unique.length === 0) return null;

  return (
    <View testID="activity-start-banners">
      {unique.map((b) => (
        <View
          key={b.team_id}
          style={{
            backgroundColor: '#E8F5E9',
            borderRadius: 10,
            borderLeftWidth: 4,
            borderLeftColor: '#2E7D32',
            padding: 12,
            marginHorizontal: 12,
            marginBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Ionicons name="calendar" size={20} color="#2E7D32" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1B5E20' }}>
              Inizio allenamenti {b.team_name}: {b.start_label}
            </Text>
            <Text style={{ fontSize: 11, color: '#33691E', marginTop: 2 }}>
              {b.provisional ? 'Programma allenamenti provvisorio' : 'Programma allenamenti confermato'}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
