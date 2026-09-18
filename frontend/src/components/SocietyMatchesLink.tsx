import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from './Icon';

// 🆕 13/09/2026 — Link condiviso per aprire il Calendario Gare della società (sola lettura),
// presente nella dashboard di tutti gli utenti.
export default function SocietyMatchesLink() {
  const router = useRouter();
  return (
    <TouchableOpacity style={styles.btn} onPress={() => router.push('/matches')} testID="society-matches-link">
      <Ionicons name="trophy" size={20} color="#fff" />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Calendario Gare Società</Text>
        <Text style={styles.subtitle}>Vedi tutte le gare della società</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1565C0', borderRadius: 12, padding: 14, marginBottom: 12 },
  title: { color: '#fff', fontSize: 15, fontWeight: '800' },
  subtitle: { color: '#E3F2FD', fontSize: 12 },
});
