/**
 * 🆕 13/06/2026 — Banner "Hub Doppio Ruolo"
 * Da inserire in cima alle pagine /admin/athlete/[id] e /admin/coach/[id]
 * per offrire navigazione rapida all'hub anagrafica unica.
 *
 * Compare SOLO se la persona è dual-role.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '../Icon';
import api from '../../services/api';

interface Props {
  personId: string;  // user_id o athlete_id
}

export const DualRoleHubBanner: React.FC<Props> = ({ personId }) => {
  const [isDualRole, setIsDualRole] = useState(false);
  const [hubId, setHubId] = useState<string | null>(null);

  useEffect(() => {
    if (!personId) return;
    api.get(`/admin/persons/${personId}/profile`)
      .then(res => {
        if (res.data?.is_dual_role) {
          setIsDualRole(true);
          // Prefer user_id come hub id (è la persona logica)
          setHubId(res.data.user_id || res.data.athlete_id);
        }
      })
      .catch(() => {});
  }, [personId]);

  if (!isDualRole || !hubId) return null;

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={() => router.push(`/admin/persona/${hubId}`)}
      testID="dual-role-hub-banner"
      activeOpacity={0.85}
    >
      <View style={styles.iconCircle}>
        <Ionicons name="people" size={18} color="#fff" />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>Persona con Doppio Ruolo</Text>
        <Text style={styles.subtitle}>Apri l'Hub Persona per gestire entrambi i ruoli</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#3F51B5" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8EAF6',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#9FA8DA',
  },
  iconCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#3F51B5',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  textBlock: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700', color: '#1A237E' },
  subtitle: { fontSize: 11, color: '#5C6BC0', marginTop: 2 },
});

export default DualRoleHubBanner;
