import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from './Icon';

interface TrialEndModalProps {
  visible: boolean;
  onAcceptPrivacy: () => void;  // User wants to stay - proceed to privacy signature
  onDeleteData: () => void;     // User wants to leave - delete all data
  signerName: string;
  signerRole: 'athlete' | 'parent';
  trialEndDate?: string;
  deleting?: boolean;
}

export const TrialEndModal: React.FC<TrialEndModalProps> = ({
  visible,
  onAcceptPrivacy,
  onDeleteData,
  signerName,
  signerRole,
  trialEndDate,
  deleting = false,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const roleLabel = signerRole === 'athlete' ? 'Atleta' : 'Genitore';

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDeleteData();
  };

  const handleClose = () => {
    setConfirmDelete(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="time" size={32} color="#fff" />
            <Text style={styles.headerTitle}>Periodo di Prova Terminato</Text>
          </View>

          <ScrollView style={styles.content}>
            <Text style={styles.greeting}>Ciao {signerName}!</Text>
            
            <Text style={styles.message}>
              Il tuo periodo di prova {trialEndDate ? `(scaduto il ${trialEndDate})` : ''} è terminato.
            </Text>

            <Text style={styles.message}>
              Per continuare a utilizzare i servizi della società sportiva, è necessario accettare l'informativa sulla privacy.
            </Text>

            <View style={styles.divider} />

            <Text style={styles.choiceTitle}>Cosa vuoi fare?</Text>

            {/* Option 1: Accept Privacy */}
            <TouchableOpacity
              style={styles.optionCard}
              onPress={onAcceptPrivacy}
            >
              <View style={styles.optionIconContainer}>
                <Ionicons name="checkmark-circle" size={40} color="#4CAF50" />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Voglio Restare</Text>
                <Text style={styles.optionDesc}>
                  Leggi e accetta l'informativa sulla privacy per continuare come {roleLabel.toLowerCase()}.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#4CAF50" />
            </TouchableOpacity>

            {/* Option 2: Delete Data */}
            <TouchableOpacity
              style={[styles.optionCard, styles.optionCardDanger]}
              onPress={handleDelete}
              disabled={deleting}
            >
              <View style={[styles.optionIconContainer, styles.optionIconDanger]}>
                {deleting ? (
                  <ActivityIndicator size="small" color="#F44336" />
                ) : (
                  <Ionicons name="trash" size={40} color="#F44336" />
                )}
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, styles.optionTitleDanger]}>
                  {confirmDelete ? 'Conferma Cancellazione' : 'Non Voglio Continuare'}
                </Text>
                <Text style={styles.optionDesc}>
                  {confirmDelete 
                    ? 'Sei sicuro? Tutti i tuoi dati verranno eliminati permanentemente.'
                    : 'Cancella tutti i miei dati e chiudi il mio account.'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#F44336" />
            </TouchableOpacity>

            {confirmDelete && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
              >
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
            )}

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color="#1976D2" />
              <Text style={styles.infoText}>
                Se scegli di cancellare i tuoi dati, questa azione è irreversibile. 
                Tutti i dati personali, documenti e storico verranno eliminati in conformità con il GDPR.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '95%',
    maxWidth: 450,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#FF9800',
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
  },
  content: {
    padding: 20,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 16,
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  optionCardDanger: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  optionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionIconDanger: {
    backgroundColor: '#fff',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  optionTitleDanger: {
    color: '#C62828',
  },
  optionDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1976D2',
    marginLeft: 8,
    lineHeight: 18,
  },
});

export default TrialEndModal;
