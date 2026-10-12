/**
 * 🆕 GymMapButton — pulsante "MAPPA PALESTRE" (apre /palestre), pensato per stare
 * a fianco del pulsante PRIVACY nelle dashboard (metà larghezza ciascuno).
 */
import React from 'react';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function GymMapButton() {
  const router = useRouter();
  return (
    <TouchableOpacity style={styles.btn} onPress={() => router.push('/palestre' as any)} activeOpacity={0.85} testID="gym-map-button">
      <Ionicons name="map" size={22} color="#fff" />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>MAPPA PALESTRE</Text>
        <Text style={styles.sub} numberOfLines={1}>Indirizzi e navigatore</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#00897B', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, minHeight: 56,
    shadowColor: '#00897B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4,
  },
  title: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  sub: { fontSize: 11, color: '#FFFFFFDD', marginTop: 1 },
});
