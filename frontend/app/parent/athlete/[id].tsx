import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  Modal,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import api from '../../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Athlete, Certificate, Payment, PaymentSettings } from '../../../src/types';
import { format, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';

export default function AthleteDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);

  const loadData = async () => {
    try {
      const [athleteRes, paymentsRes] = await Promise.all([
        api.get(`/athletes/${id}`),
        api.get(`/payments/${id}`),
      ]);

      setAthlete(athleteRes.data);
      setPayments(paymentsRes.data);

      // Try to load certificate
      try {
        const certRes = await api.get(`/certificates/${id}`);
        setCertificate(certRes.data);
      } catch (error) {
        setCertificate(null);
      }

      // Load payment info from team instead of global settings
      try {
        const paymentInfoRes = await api.get(`/teams/${athleteRes.data.team_id}/payment-info`);
        setPaymentSettings({
          id: '',
          season: '',
          installment_1_amount: paymentInfoRes.data.installment_1_amount,
          installment_2_amount: paymentInfoRes.data.installment_2_amount,
          installment_2_due_date: paymentInfoRes.data.installment_2_due_date,
          installment_3_amount: paymentInfoRes.data.installment_3_amount,
          installment_3_due_date: paymentInfoRes.data.installment_3_due_date,
          bank_info: paymentInfoRes.data.bank_info,
          paypal_email: paymentInfoRes.data.paypal_email,
        });
      } catch (error) {
        setPaymentSettings(null);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Errore', 'Impossibile caricare i dati dell\'atleta');
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleUploadCertificate = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];

      // Ask for certificate details with proper iOS handling
      Alert.prompt(
        'Data di emissione',
        'Inserisci la data di emissione (GG/MM/AAAA)',
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Avanti',
            onPress: async (issueDate) => {
              if (!issueDate) return;

              Alert.prompt(
                'Validità',
                'Inserisci la validità in mesi',
                [
                  { text: 'Annulla', style: 'cancel' },
                  {
                    text: 'Carica',
                    onPress: async (validityMonths) => {
                      if (!validityMonths) return;
                      await uploadCertificateFile(file, issueDate, parseInt(validityMonths));
                    },
                  },
                ],
                'plain-text',
                '12'
              );
            },
          },
        ],
        'plain-text',
        new Date().toLocaleDateString('it-IT').replace(/\//g, '/')
      );
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Errore', 'Impossibile selezionare il file');
    }
  };

  const convertToISODate = (dateStr: string) => {
    // Converti da GG/MM/AAAA a YYYY-MM-DD
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const uploadCertificateFile = async (file: any, issueDate: string, validityMonths: number) => {
    setUploadingCert(true);
    try {
      // Converti data da GG/MM/AAAA a YYYY-MM-DD
      const isoDate = convertToISODate(issueDate);
      
      const formData = new FormData();
      
      // Create file object for FormData
      const fileToUpload = {
        uri: file.uri,
        name: file.name || 'certificato.pdf',
        type: file.mimeType || 'application/pdf',
      };
      
      formData.append('file', fileToUpload as any);
      formData.append('athlete_id', id as string);
      formData.append('issue_date', isoDate);
      formData.append('validity_months', validityMonths.toString());

      await api.post('/certificates', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert('Successo', 'Certificato caricato con successo');
      await loadData();
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante il caricamento del certificato');
    } finally {
      setUploadingCert(false);
    }
  };

  const handleAcceptPrivacy = async () => {
    if (!privacyConfirmed) {
      Alert.alert('Attenzione', 'Devi confermare due volte per procedere');
      setPrivacyConfirmed(true);
      return;
    }

    try {
      await api.patch(`/athletes/${id}`, {
        privacy_accepted: true,
        image_consent: true,
      });

      Alert.alert('Successo', 'Privacy accettata con successo');
      setPrivacyModalVisible(false);
      await loadData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante l\'accettazione');
    }
  };

  if (!athlete) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Caricamento...</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>
    );
  }

  const trialDaysRemaining = differenceInDays(
    new Date(athlete.trial_end_date),
    new Date()
  );

  const isCertificateExpired = certificate
    ? new Date() > new Date(certificate.expiry_date)
    : false;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{athlete.full_name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* QR Code Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>QR Code Personale</Text>
          <TouchableOpacity
            style={styles.qrButton}
            onPress={() => setQrModalVisible(true)}
          >
            <Ionicons name="qr-code" size={100} color="#007AFF" />
            <Text style={styles.qrButtonText}>Tocca per visualizzare</Text>
          </TouchableOpacity>
        </View>

        {/* Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stato</Text>
          {athlete.status === 'trial' && trialDaysRemaining > 0 && (
            <View style={styles.statusBox}>
              <Ionicons name="time" size={24} color="#FF9500" />
              <Text style={styles.statusText}>
                Periodo di prova: {trialDaysRemaining} giorni rimanenti
              </Text>
            </View>
          )}
          {athlete.status === 'trial' && trialDaysRemaining <= 0 && !athlete.privacy_accepted && (
            <View style={styles.statusBox}>
              <Ionicons name="alert-circle" size={24} color="#FF3B30" />
              <Text style={styles.statusTextDanger}>
                Periodo di prova terminato - Conferma privacy richiesta
              </Text>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setPrivacyModalVisible(true)}
              >
                <Text style={styles.actionButtonText}>Conferma Privacy</Text>
              </TouchableOpacity>
            </View>
          )}
          {athlete.privacy_accepted && (
            <View style={styles.statusBox}>
              <Ionicons name="checkmark-circle" size={24} color="#34C759" />
              <Text style={styles.statusTextSuccess}>Privacy accettata</Text>
            </View>
          )}
        </View>

        {/* Certificate Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Certificato Medico</Text>
          {certificate ? (
            <View>
              <View style={styles.certInfo}>
                <Ionicons
                  name={isCertificateExpired ? 'close-circle' : 'checkmark-circle'}
                  size={24}
                  color={isCertificateExpired ? '#FF3B30' : '#34C759'}
                />
                <View style={styles.certDetails}>
                  <Text style={styles.certLabel}>
                    Scadenza: {format(new Date(certificate.expiry_date), 'dd/MM/yyyy', { locale: it })}
                  </Text>
                  {isCertificateExpired && (
                    <Text style={styles.certExpired}>SCADUTO</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={handleUploadCertificate}
                disabled={uploadingCert}
              >
                <Text style={styles.buttonSecondaryText}>
                  {uploadingCert ? 'Caricamento...' : 'Carica Nuovo Certificato'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={styles.warningBox}>
                <Ionicons name="warning" size={24} color="#FF9500" />
                <Text style={styles.warningText}>Nessun certificato caricato</Text>
              </View>
              <TouchableOpacity
                style={styles.button}
                onPress={handleUploadCertificate}
                disabled={uploadingCert}
              >
                <Text style={styles.buttonText}>
                  {uploadingCert ? 'Caricamento...' : 'Carica Certificato'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Payments Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pagamenti</Text>
          {payments.length > 0 ? (
            payments.map((payment) => (
              <View key={payment.id} style={styles.paymentRow}>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentTitle}>Rata {payment.installment_number}</Text>
                  <Text style={styles.paymentAmount}>€ {payment.amount.toFixed(2)}</Text>
                  <Text style={styles.paymentDue}>
                    Scadenza: {format(new Date(payment.due_date), 'dd/MM/yyyy', { locale: it })}
                  </Text>
                </View>
                <Ionicons
                  name={payment.paid ? 'checkmark-circle' : 'alert-circle'}
                  size={32}
                  color={payment.paid ? '#34C759' : '#FF9500'}
                />
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>Nessun pagamento disponibile</Text>
          )}
          
          {paymentSettings && (
            <View style={styles.paymentInstructions}>
              <Text style={styles.instructionsTitle}>Modalità di pagamento:</Text>
              <Text style={styles.instructionsText}>
                <Text style={styles.bold}>Bonifico Bancario:</Text>
                {'\n'}{paymentSettings.bank_info}
              </Text>
              <Text style={styles.instructionsText}>
                <Text style={styles.bold}>PayPal:</Text>
                {'\n'}{paymentSettings.paypal_email}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* QR Code Modal */}
      <Modal
        visible={qrModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContent}>
            <Text style={styles.modalTitle}>{athlete.full_name}</Text>
            <Image
              source={{ uri: athlete.qr_code }}
              style={styles.qrImage}
              resizeMode="contain"
            />
            <Text style={styles.qrInstructions}>
              Mostra questo QR code al coach per registrare la presenza
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setQrModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Privacy Modal */}
      <Modal
        visible={privacyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.privacyModalContent}>
            <Text style={styles.modalTitle}>Conferma Privacy</Text>
            
            <ScrollView style={styles.privacyScroll}>
              <Text style={styles.privacyText}>
                Confermo di aver letto e accettato l'informativa sulla privacy
                e autorizzo il trattamento dei dati personali dell'atleta per
                le finalità legate all'attività sportiva.
              </Text>
              
              <Text style={styles.privacyText}>
                Autorizzo inoltre l'utilizzo delle immagini dell'atleta derivanti
                da allenamenti, gare e manifestazioni sportive per scopi di
                promozione dell'attività sportiva.
              </Text>
            </ScrollView>

            <View style={styles.privacyButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => {
                  setPrivacyModalVisible(false);
                  setPrivacyConfirmed(false);
                }}
              >
                <Text style={styles.buttonSecondaryText}>Annulla</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  privacyConfirmed ? styles.buttonSuccess : styles.buttonPrimary,
                ]}
                onPress={handleAcceptPrivacy}
              >
                <Text style={styles.buttonText}>
                  {privacyConfirmed ? 'Conferma Definitivamente' : 'Accetto'}
                </Text>
              </TouchableOpacity>
            </View>

            {!privacyConfirmed && (
              <Text style={styles.doubleConfirmText}>
                Dovrai confermare due volte per procedere
              </Text>
            )}
          </View>
        </View>
      </Modal>
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
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  qrButton: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  qrButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 8,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    color: '#FF9500',
    marginLeft: 12,
  },
  statusTextDanger: {
    flex: 1,
    fontSize: 14,
    color: '#FF3B30',
    marginLeft: 12,
  },
  statusTextSuccess: {
    flex: 1,
    fontSize: 14,
    color: '#34C759',
    marginLeft: 12,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  certInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  certDetails: {
    flex: 1,
    marginLeft: 12,
  },
  certLabel: {
    fontSize: 14,
    color: '#333',
  },
  certExpired: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: 'bold',
    marginTop: 4,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    marginBottom: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#FF9500',
    marginLeft: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#007AFF',
  },
  buttonSuccess: {
    backgroundColor: '#34C759',
  },
  buttonSecondary: {
    backgroundColor: '#f5f5f5',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 4,
  },
  paymentDue: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  paymentInstructions: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  bold: {
    fontWeight: 'bold',
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  qrImage: {
    width: 250,
    height: 250,
  },
  qrInstructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  closeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  privacyModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
  },
  privacyScroll: {
    maxHeight: 300,
    marginBottom: 20,
  },
  privacyText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    marginBottom: 16,
  },
  privacyButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  doubleConfirmText: {
    fontSize: 12,
    color: '#FF9500',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
