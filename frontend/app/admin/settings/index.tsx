import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../../src/components/Icon';

export default function SettingsIndex() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Impostazioni</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Card Società */}
        <TouchableOpacity 
          style={[styles.card, { borderColor: '#1565C0', backgroundColor: '#E3F2FD' }]}
          onPress={() => router.push('/admin/settings/society')}
          data-testid="settings-society-btn"
        >
          <View style={[styles.iconContainer, { backgroundColor: '#1565C0' }]}>
            <Ionicons name="business" size={32} color="#fff" />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: '#1565C0' }]}>Società</Text>
            <Text style={styles.cardDescription}>
              Dati anagrafici, fiscali, logo e timbro
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#1565C0" />
        </TouchableOpacity>

        {/* Card Altre Impostazioni */}
        <TouchableOpacity 
          style={[styles.card, { borderColor: '#E65100', backgroundColor: '#FFF3E0' }]}
          onPress={() => router.push('/admin/settings/other')}
          data-testid="settings-other-btn"
        >
          <View style={[styles.iconContainer, { backgroundColor: '#E65100' }]}>
            <Ionicons name="settings" size={32} color="#fff" />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: '#E65100' }]}>Altre Impostazioni</Text>
            <Text style={styles.cardDescription}>
              Ruoli atleti, caratteristiche, qualifiche dirigenti, palestre
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#E65100" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
