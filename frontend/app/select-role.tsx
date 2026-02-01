import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { Ionicons } from '@expo/vector-icons';

export default function SelectRoleScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const handleSelectAdmin = () => {
    router.replace('/admin');
  };

  const handleSelectDirigente = () => {
    router.replace('/dirigente');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="person-circle" size={80} color="#007AFF" />
          <Text style={styles.welcomeText}>Benvenuto, {user?.full_name}</Text>
          <Text style={styles.subtitle}>Come vuoi accedere al portale?</Text>
        </View>

        <View style={styles.optionsContainer}>
          {/* Admin Option */}
          <TouchableOpacity style={styles.optionCard} onPress={handleSelectAdmin}>
            <View style={[styles.optionIcon, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="shield-checkmark" size={40} color="#007AFF" />
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>Amministratore</Text>
              <Text style={styles.optionDescription}>
                Gestisci società, atleti, coach, dirigenti e tutte le impostazioni
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#007AFF" />
          </TouchableOpacity>

          {/* Dirigente Option */}
          <TouchableOpacity style={styles.optionCard} onPress={handleSelectDirigente}>
            <View style={[styles.optionIcon, { backgroundColor: '#F3E5F5' }]}>
              <Ionicons name="briefcase" size={40} color="#8E44AD" />
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>Dirigente</Text>
              <Text style={styles.optionDescription}>
                Visualizza squadre e atleti, gestisci il tuo profilo e i compensi personali
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#8E44AD" />
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          Puoi sempre cambiare modalità effettuando un nuovo accesso
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  optionIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionInfo: {
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  optionDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    lineHeight: 18,
  },
  footerText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginTop: 32,
  },
});
