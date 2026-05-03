import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { Ionicons } from '../src/components/Icon';

export default function SelectRoleScreen() {
  const router = useRouter();
  const { user, isLoading, loadAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Always try to load auth on mount
      await loadAuth();
      setIsChecking(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isChecking && !isLoading) {
      // Redirect to login if not authenticated or not admin
      if (!user || user.role !== 'admin') {
        router.replace('/login');
      } else if ((user as any).is_institutional_account) {
        // Account istituzionali: niente scelta di ruolo, vanno direttamente alla
        // dashboard admin in modalità sola lettura (banner globale + middleware backend).
        router.replace('/admin');
      }
    }
  }, [user, isLoading, isChecking]);

  // Show loading while checking auth
  if (isChecking || isLoading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

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
          <Text style={styles.welcomeText}>Benvenuto, {user?.first_name || user?.full_name?.split(' ')[0]}</Text>
          {(user as any)?.is_institutional_account && (
            <View style={styles.institutionalBadge} data-testid="institutional-badge">
              <Ionicons name="business" size={14} color="#C62828" />
              <Text style={styles.institutionalBadgeText}>ACCOUNT ISTITUZIONALE</Text>
            </View>
          )}
          <Text style={styles.subtitle}>Come vuoi accedere al portale?</Text>
        </View>

        <View style={styles.optionsContainer}>
          {/* Admin Option */}
          <TouchableOpacity style={styles.optionCard} onPress={handleSelectAdmin} data-testid="select-admin">
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

          {/* Dirigente Option — nascosta per account istituzionali (società non è una persona) */}
          {!(user as any)?.is_institutional_account && (
            <TouchableOpacity style={styles.optionCard} onPress={handleSelectDirigente} data-testid="select-dirigente">
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
          )}
        </View>

        <Text style={styles.footerText}>
          {(user as any)?.is_institutional_account
            ? "Questo è l'account ufficiale della Società. Può operare come Amministratore ma non come persona fisica (Dirigente)."
            : "Puoi sempre cambiare modalità effettuando un nuovo accesso"}
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
  institutionalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#EF9A9A',
    borderRadius: 20,
  },
  institutionalBadgeText: {
    color: '#C62828',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
