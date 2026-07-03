/**
 * 🆕 03/07/2026 — Rileva conflitti calendario dual-role (allenamento atleta vs gara coach).
 * Analizza gli impegni già mergiati con `as_role` e mostra un banner rosso al top se
 * ci sono overlap temporali nello stesso giorno.
 */
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Item {
  date?: string;
  time_start?: string;
  time_end?: string;
  as_role?: 'atleta' | 'coach';
  team_name?: string;
  opponent?: string;
  type?: string;
}

interface Props {
  commitments: {
    today?: Item[];
    tomorrow?: Item[];
    day_after?: Item[];
    upcoming?: Item[];
  } | null;
}

const parseMin = (t?: string): number | null => {
  if (!t) return null;
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

const overlaps = (a: Item, b: Item): boolean => {
  if (a.date !== b.date) return false;
  const aS = parseMin(a.time_start);
  const aE = parseMin(a.time_end) ?? (aS !== null ? aS + 60 : null);
  const bS = parseMin(b.time_start);
  const bE = parseMin(b.time_end) ?? (bS !== null ? bS + 60 : null);
  if (aS === null || aE === null || bS === null || bE === null) return false;
  return aS < bE && bS < aE;
};

export const ConflictBanner: React.FC<Props> = ({ commitments }) => {
  const conflicts = useMemo(() => {
    if (!commitments) return [];
    const all: Item[] = [
      ...(commitments.today || []),
      ...(commitments.tomorrow || []),
      ...(commitments.day_after || []),
      ...(commitments.upcoming || []),
    ];
    const dualItems = all.filter(x => x.as_role); // solo se dual-role
    const found: { a: Item; b: Item }[] = [];
    for (let i = 0; i < dualItems.length; i++) {
      for (let j = i + 1; j < dualItems.length; j++) {
        const a = dualItems[i];
        const b = dualItems[j];
        if (a.as_role !== b.as_role && overlaps(a, b)) {
          found.push({ a, b });
        }
      }
    }
    return found;
  }, [commitments]);

  if (conflicts.length === 0) return null;

  const label = (it: Item) => {
    const role = it.as_role === 'atleta' ? 'ATL' : 'COACH';
    const desc = it.type === 'match'
      ? `${it.team_name || ''} vs ${it.opponent || '?'}`
      : `Allenamento ${it.team_name || ''}`;
    return `${role} · ${it.time_start || '?'} — ${desc}`;
  };

  return (
    <View
      style={{
        backgroundColor: '#FFF5F5',
        borderColor: '#C62828',
        borderWidth: 1.5,
        borderRadius: 10,
        margin: 16,
        padding: 12,
      }}
      data-testid="calendar-conflict-banner"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Ionicons name="warning" size={20} color="#C62828" />
        <Text style={{ color: '#C62828', fontWeight: '800', fontSize: 14 }}>
          ⚠️ Conflitto di calendario ({conflicts.length})
        </Text>
      </View>
      {conflicts.slice(0, 3).map((c, idx) => (
        <View key={idx} style={{ backgroundColor: '#fff', borderRadius: 6, padding: 8, marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: '#333', marginBottom: 2 }}>
            {c.a.date || ''} — sovrapposizione:
          </Text>
          <Text style={{ fontSize: 12, color: '#B71C1C', fontWeight: '600' }}>
            {label(c.a)}
          </Text>
          <Text style={{ fontSize: 12, color: '#B71C1C', fontWeight: '600' }}>
            {label(c.b)}
          </Text>
        </View>
      ))}
      {conflicts.length > 3 && (
        <Text style={{ fontSize: 11, color: '#C62828', marginTop: 4, fontStyle: 'italic' }}>
          + altri {conflicts.length - 3} conflitti
        </Text>
      )}
    </View>
  );
};

export default ConflictBanner;
