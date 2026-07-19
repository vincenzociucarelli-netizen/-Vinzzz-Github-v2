/**
 * Pagina dedicata Bacheca Note Admin.
 * 🆕 19/07/2026.
 *
 * Renderizza il componente <AdminNotesBoard /> a schermo intero.
 * L'header include un pulsante "Indietro" per tornare alla dashboard.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { AdminNotesBoard } from '../../src/components/AdminNotesBoard';

export default function AdminNotesPage() {
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/admin');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false, title: 'Bacheca Note' }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} testID="admin-notes-page-back">
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Bacheca Note Admin</Text>
          <Text style={styles.headerSubtitle}>Task condivise tra amministratori</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={Platform.OS === 'web'}>
        <AdminNotesBoard />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#1a237e',
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSubtitle: { color: '#B8C0E8', fontSize: 12, marginTop: 2 },
  scroll: { paddingVertical: 8, paddingBottom: 40 },
});
