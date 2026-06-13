/**
 * 🆕 13/06/2026 — Banner Switcher Doppio Ruolo (v2)
 *
 * Sostituisce il vecchio DualRoleHubBanner. Mostra in cima alle schede
 * Atleta/Coach un BANNER UNICO che combina:
 *  - Header anagrafica essenziale (nome + CF)
 *  - 3 tab: [Atleta] [Coach] [Hub Anagrafica]
 *
 * Il tab corrente è evidenziato in pieno colore, gli altri sono cliccabili.
 * Cliccando un tab si naviga alla relativa scheda (no anagrafica duplicata).
 *
 * Compare SOLO se la persona è dual-role.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '../Icon';
import api from '../../services/api';

interface Props {
  /** ID del record corrente (athlete_id o user_id) */
  personId: string;
  /** Ruolo della scheda dove è montato il banner */
  currentRole: 'atleta' | 'coach';
}

interface ProfileResponse {
  user_id: string | null;
  athlete_id: string | null;
  is_dual_role: boolean;
  has_athlete_role: boolean;
  has_coach_role: boolean;
  coach_role_name: string | null;
  profile: {
    first_name: string;
    last_name: string;
    fiscal_code: string;
  };
}

export const DualRoleHubBanner: React.FC<Props> = ({ personId, currentRole }) => {
  const [data, setData] = useState<ProfileResponse | null>(null);

  useEffect(() => {
    if (!personId) return;
    api.get(`/admin/persons/${personId}/profile`)
      .then(res => {
        if (res.data?.is_dual_role) setData(res.data);
      })
      .catch(() => {});
  }, [personId]);

  if (!data || !data.is_dual_role) return null;

  const goAtleta = () => {
    if (currentRole === 'atleta') return;
    if (data.athlete_id) router.replace(`/admin/athlete/${data.athlete_id}`);
  };
  const goCoach = () => {
    if (currentRole === 'coach') return;
    if (data.user_id) router.replace(`/admin/coach/${data.user_id}`);
  };
  const goHub = () => {
    const hubId = data.user_id || data.athlete_id;
    if (hubId) router.push(`/admin/persona/${hubId}`);
  };

  const fullName = `${data.profile.last_name} ${data.profile.first_name}`.trim();
  const coachLabel = data.coach_role_name === 'dirigente' ? 'Dirigente'
                   : data.coach_role_name === 'collaboratore' ? 'Collaboratore'
                   : 'Allenatore';

  return (
    <View style={styles.container} testID="dual-role-switcher">
      {/* Riga 1: nome + CF (anagrafica essenziale unica) */}
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="people" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.titleLabel}>Persona con Doppio Ruolo</Text>
          {fullName ? <Text style={styles.nameLabel}>{fullName.toUpperCase()}</Text> : null}
          {data.profile.fiscal_code ? (
            <Text style={styles.cfLabel}>{data.profile.fiscal_code}</Text>
          ) : null}
        </View>
      </View>

      {/* Riga 2: 3 tab — Atleta / Coach / Hub Anagrafica */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          onPress={goAtleta}
          style={[styles.tab, currentRole === 'atleta' ? styles.tabActiveAtleta : styles.tabInactive]}
          testID="switcher-tab-atleta"
        >
          <Text style={{ fontSize: 16 }}>🏃</Text>
          <Text style={[styles.tabLabel, currentRole === 'atleta' && styles.tabLabelActive]}>Atleta</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goCoach}
          style={[styles.tab, currentRole === 'coach' ? styles.tabActiveCoach : styles.tabInactive]}
          testID="switcher-tab-coach"
        >
          <Text style={{ fontSize: 16 }}>🥎</Text>
          <Text style={[styles.tabLabel, currentRole === 'coach' && styles.tabLabelActive]}>{coachLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goHub}
          style={[styles.tab, styles.tabInactive]}
          testID="switcher-tab-hub"
        >
          <Text style={{ fontSize: 16 }}>📇</Text>
          <Text style={styles.tabLabel}>Anagrafica</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E8EAF6',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#9FA8DA',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#3F51B5',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  titleLabel: { fontSize: 11, fontWeight: '600', color: '#5C6BC0', textTransform: 'uppercase', letterSpacing: 0.5 },
  nameLabel: { fontSize: 15, fontWeight: '800', color: '#1A237E', marginTop: 2 },
  cfLabel: { fontSize: 11, color: '#666', fontFamily: 'monospace', marginTop: 1 },

  tabsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 8,
    gap: 6,
  },
  tabInactive: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#C5CAE9',
  },
  tabActiveAtleta: {
    backgroundColor: '#F57C00',
    borderWidth: 1,
    borderColor: '#E65100',
  },
  tabActiveCoach: {
    backgroundColor: '#1976D2',
    borderWidth: 1,
    borderColor: '#0D47A1',
  },
  tabLabel: { fontSize: 12, fontWeight: '700', color: '#3F51B5' },
  tabLabelActive: { color: '#fff' },
});

export default DualRoleHubBanner;
