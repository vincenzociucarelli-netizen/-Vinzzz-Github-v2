import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../../src/components/Icon';
import api from '../../../src/services/api';

export default function SettingsIndex() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const response = await api.get('/auth/me');
        if (response.data?.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          // Redirect non-admin users
          router.replace('/');
        }
      } catch (error) {
        setIsAdmin(false);
        router.replace('/');
      } finally {
        setLoading(false);
      }
    };
    checkAdminAccess();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#8E44AD" />
      </View>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))} 
          style={styles.backButton}
        >
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="chevron-back" size={24} color="#007AFF" /></View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/admin')} data-testid="header-home-btn" style={{ marginLeft: 8 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="home" size={20} color="#007AFF" /></View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Impostazioni</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Card Responsabile Admin (lo "scettro" dell'app) */}
        <TouchableOpacity 
          style={[styles.card, { borderColor: '#1565C0', backgroundColor: '#E3F2FD' }]}
          onPress={() => router.push('/admin/settings/primary-admin')}
          data-testid="settings-primary-admin-btn"
        >
          <View style={[styles.iconContainer, { backgroundColor: '#1565C0' }]}>
            <Ionicons name="shield-checkmark" size={32} color="#fff" />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: '#1565C0' }]}>Responsabile Admin</Text>
            <Text style={styles.cardDescription}>
              Titolare autorizzato, dichiarazione di ruolo e delega ad altri Admin
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
              Stagione sportiva, ruoli atleti, qualifiche, palestre
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#E65100" />
        </TouchableOpacity>

        {/* Card Audit Logs */}
        <TouchableOpacity 
          style={[styles.card, { borderColor: '#5856D6', backgroundColor: '#EDE7F6' }]}
          onPress={() => router.push('/admin/settings/audit-logs')}
          data-testid="settings-audit-logs-btn"
        >
          <View style={[styles.iconContainer, { backgroundColor: '#5856D6' }]}>
            <Ionicons name="shield-checkmark" size={32} color="#fff" />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: '#5856D6' }]}>Audit Log</Text>
            <Text style={styles.cardDescription}>
              Cronologia accessi, modifiche e azioni critiche (GDPR)
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#5856D6" />
        </TouchableOpacity>

        {/* Card Consensi Privacy */}
        <TouchableOpacity 
          style={[styles.card, { borderColor: '#2E7D32', backgroundColor: '#E8F5E9' }]}
          onPress={() => router.push('/admin/settings/consent-audit')}
          data-testid="settings-consent-audit-btn"
        >
          <View style={[styles.iconContainer, { backgroundColor: '#2E7D32' }]}>
            <Ionicons name="finger-print" size={32} color="#fff" />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: '#2E7D32' }]}>Consensi Privacy</Text>
            <Text style={styles.cardDescription}>
              Audit trail dei consensi GDPR di utenti e atleti
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#2E7D32" />
        </TouchableOpacity>

        {/* Card Export Dati */}
        <TouchableOpacity 
          style={[styles.card, { borderColor: '#00BCD4', backgroundColor: '#E0F7FA' }]}
          onPress={() => router.push('/admin/settings/export-data')}
          data-testid="settings-export-data-btn"
        >
          <View style={[styles.iconContainer, { backgroundColor: '#00BCD4' }]}>
            <Ionicons name="download" size={32} color="#fff" />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: '#00BCD4' }]}>Esporta Dati</Text>
            <Text style={styles.cardDescription}>
              Scarica CSV di atleti, presenze, compensi e log
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#00BCD4" />
        </TouchableOpacity>

        {/* Card Ripristino Backup (solo LR) */}
        <TouchableOpacity
          style={[styles.card, { borderColor: '#C62828', backgroundColor: '#FFEBEE' }]}
          onPress={() => router.push('/admin/settings/restore-backup')}
          data-testid="settings-restore-backup-btn"
        >
          <View style={[styles.iconContainer, { backgroundColor: '#C62828' }]}>
            <Ionicons name="refresh-circle" size={32} color="#fff" />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: '#C62828' }]}>Ripristino Backup</Text>
            <Text style={styles.cardDescription}>
              Ripristina i dati da un file ZIP (solo Legale Rappresentante)
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#C62828" />
        </TouchableOpacity>

        {/* Card Pagamenti Stripe */}
        <TouchableOpacity 
          style={[styles.card, { borderColor: '#6772E5', backgroundColor: '#EEF2FF' }]}
          onPress={() => router.push('/admin/settings/stripe')}
          data-testid="settings-stripe-btn"
        >
          <View style={[styles.iconContainer, { backgroundColor: '#6772E5' }]}>
            <Ionicons name="card" size={32} color="#fff" />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: '#6772E5' }]}>Pagamenti Online</Text>
            <Text style={styles.cardDescription}>
              Configura Stripe per accettare pagamenti con carta
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#6772E5" />
        </TouchableOpacity>

        {/* Card Periodo di Prova */}
        <TouchableOpacity 
          style={[styles.card, { borderColor: '#FF6F00', backgroundColor: '#FFF8E1' }]}
          onPress={() => router.push('/admin/settings/trial')}
          data-testid="settings-trial-btn"
        >
          <View style={[styles.iconContainer, { backgroundColor: '#FF6F00' }]}>
            <Ionicons name="timer" size={32} color="#fff" />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: '#FF6F00' }]}>Certificato Medico e Periodo di Prova</Text>
            <Text style={styles.cardDescription}>
              Blocco certificati scaduti, giorni massimi, allenamenti e documento di prova
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#FF6F00" />
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
    padding: 12,
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
