/**
 * 🆕 02/07/2026 — Badge "Stagione X-Y" visibile in cima alle pagine.
 * Endpoint leggero /api/seasons/current-name (~150ms).
 */
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from './api';

interface Props {
  compact?: boolean;
}

let cachedSeason: string | null = null;

export const SeasonBadge: React.FC<Props> = ({ compact = false }) => {
  const [season, setSeason] = useState<string>(cachedSeason || '');

  useEffect(() => {
    if (cachedSeason) return;
    api.get('/seasons/current-name')
      .then((r) => {
        const s = r.data?.season || '';
        cachedSeason = s;
        setSeason(s);
      })
      .catch(() => {});
  }, []);

  if (!season) return null;

  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderColor: '#FF5722', borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: compact ? 6 : 8,
        paddingVertical: compact ? 2 : 3,
      }}
      data-testid="season-badge"
    >
      <Ionicons name="calendar" size={compact ? 10 : 12} color="#FF5722" />
      <Text style={{ fontSize: compact ? 10 : 11, fontWeight: '700', color: '#BF360C' }}>
        {season}
      </Text>
    </View>
  );
};

export default SeasonBadge;
