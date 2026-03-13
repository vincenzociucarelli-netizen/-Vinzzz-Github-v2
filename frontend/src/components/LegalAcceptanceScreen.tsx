import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from './Icon';
import api from '../services/api';

interface LegalAcceptanceScreenProps {
  onAccepted: () => void;
  userName?: string;
}

export const LegalAcceptanceScreen: React.FC<LegalAcceptanceScreenProps> = ({ onAccepted, userName }) => {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const openLink = (path: string) => {
    router.push(path as any);
  };

  const handleAccept = async () => {
    if (!accepted) {
      showAlert('Attenzione', 'Devi accettare i Termini di utilizzo e la Privacy Policy per continuare.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/accept-legal');
      onAccepted();
    } catch (error: any) {
      showAlert('Errore', error.response?.data?.detail || 'Errore nell\'accettazione');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Logo / Header */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="shield-checkmark" size={40} color="#1565C0" />
          </View>
        </View>

        <Text style={styles.title}>Benvenuto in RegistraTEAM</Text>

        <View style={styles.descriptionBox}>
          <Text style={styles.description}>
            RegistraTEAM è un'applicazione pensata per supportare associazioni sportive dilettantistiche nella gestione delle squadre e nella registrazione delle presenze agli allenamenti.
          </Text>

          <Text style={styles.description}>
            Utilizzando l'app accetti i{' '}
            <Text style={styles.link} onPress={() => openLink('/terms-of-use')}>
              Termini di utilizzo
            </Text>
            {' '}e confermi di aver preso visione della{' '}
            <Text style={styles.link} onPress={() => openLink('/privacy-policy')}>
              Informativa sulla Privacy
            </Text>.
          </Text>

          <Text style={styles.description}>
            L'app è destinata esclusivamente all'uso da parte di associazioni sportive e dei loro tesserati.
          </Text>
        </View>

        {/* Links */}
        <View style={styles.linksContainer}>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => openLink('/terms-of-use')}
            data-testid="terms-link"
          >
            <Ionicons name="document-text-outline" size={20} color="#1565C0" />
            <Text style={styles.linkButtonText}>Termini di utilizzo</Text>
            <Ionicons name="open-outline" size={16} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => openLink('/privacy-policy')}
            data-testid="privacy-link"
          >
            <Ionicons name="lock-closed-outline" size={20} color="#1565C0" />
            <Text style={styles.linkButtonText}>Informativa sulla Privacy</Text>
            <Ionicons name="open-outline" size={16} color="#999" />
          </TouchableOpacity>
        </View>

        {/* GDPR note */}
        <View style={styles.gdprNote}>
          <Ionicons name="information-circle-outline" size={16} color="#666" />
          <Text style={styles.gdprNoteText}>
            I dati degli atleti sono gestiti dall'associazione sportiva di appartenenza.
          </Text>
        </View>

        {/* Checkbox */}
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAccepted(!accepted)}
          activeOpacity={0.7}
          data-testid="legal-checkbox"
        >
          <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
            {accepted && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <Text style={styles.checkboxLabel}>
            Ho letto e accetto i Termini di utilizzo e l'Informativa sulla Privacy
          </Text>
        </TouchableOpacity>

        {/* Continue button */}
        <TouchableOpacity
          style={[styles.continueBtn, !accepted && styles.continueBtnDisabled]}
          onPress={handleAccept}
          disabled={submitting || !accepted}
          data-testid="legal-continue-btn"
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.continueBtnText}>CONTINUA</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 48,
    paddingBottom: 40,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 20,
  },
  descriptionBox: {
    marginBottom: 20,
  },
  description: {
    fontSize: 15,
    color: '#444',
    lineHeight: 23,
    marginBottom: 12,
  },
  link: {
    color: '#1565C0',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  linksContainer: {
    marginBottom: 16,
    gap: 8,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    padding: 14,
    borderRadius: 10,
    gap: 10,
  },
  linkButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1565C0',
  },
  gdprNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 24,
  },
  gdprNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    paddingVertical: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#1565C0',
    borderColor: '#1565C0',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  continueBtn: {
    backgroundColor: '#1565C0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  continueBtnDisabled: {
    backgroundColor: '#B0BEC5',
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
