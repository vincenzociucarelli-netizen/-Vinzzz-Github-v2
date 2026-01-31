import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { PaymentSettings } from '../../src/types';

export default function AdminPayments() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  
  const [season, setSeason] = useState('');
  const [installment1Amount, setInstallment1Amount] = useState('');
  const [installment2Amount, setInstallment2Amount] = useState('');
  const [installment2DueDate, setInstallment2DueDate] = useState('');
  const [installment3Amount, setInstallment3Amount] = useState('');
  const [installment3DueDate, setInstallment3DueDate] = useState('');
  const [bankInfo, setBankInfo] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/payment-settings');
      const data = response.data;
      setSettings(data);
      
      setSeason(data.season);
      setInstallment1Amount(data.installment_1_amount.toString());
      setInstallment2Amount(data.installment_2_amount.toString());
      setInstallment2DueDate(data.installment_2_due_date.split('T')[0]);
      setInstallment3Amount(data.installment_3_amount.toString());
      setInstallment3DueDate(data.installment_3_due_date.split('T')[0]);
      setBankInfo(data.bank_info);
      setPaypalEmail(data.paypal_email);
    } catch (error) {
      console.log('No payment settings found, creating new');
    }
  };

  const handleSave = async () => {
    if (!season || !installment1Amount || !installment2Amount || !installment2DueDate ||
        !installment3Amount || !installment3DueDate || !bankInfo || !paypalEmail) {
      Alert.alert('Errore', 'Compila tutti i campi');
      return;
    }

    setLoading(true);
    try {
      await api.post('/payment-settings', {
        season,
        installment_1_amount: parseFloat(installment1Amount),
        installment_2_amount: parseFloat(installment2Amount),
        installment_2_due_date: installment2DueDate,
        installment_3_amount: parseFloat(installment3Amount),
        installment_3_due_date: installment3DueDate,
        bank_info: bankInfo,
        paypal_email: paypalEmail,
      });

      Alert.alert('Successo', 'Impostazioni salvate con successo');
      await loadSettings();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Impostazioni Pagamenti</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.form}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Stagione Sportiva</Text>
          <TextInput
            style={styles.input}
            placeholder="Es: 2024-2025"
            value={season}
            onChangeText={setSeason}
          />

          <Text style={styles.sectionTitle}>Rata 1 (Dopo Periodo di Prova)</Text>
          <TextInput
            style={styles.input}
            placeholder="Importo (€)"
            value={installment1Amount}
            onChangeText={setInstallment1Amount}
            keyboardType="decimal-pad"
          />

          <Text style={styles.sectionTitle}>Rata 2</Text>
          <TextInput
            style={styles.input}
            placeholder="Importo (€)"
            value={installment2Amount}
            onChangeText={setInstallment2Amount}
            keyboardType="decimal-pad"
          />
          <TextInput
            style={styles.input}
            placeholder="Data scadenza (YYYY-MM-DD)"
            value={installment2DueDate}
            onChangeText={setInstallment2DueDate}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.sectionTitle}>Rata 3</Text>
          <TextInput
            style={styles.input}
            placeholder="Importo (€)"
            value={installment3Amount}
            onChangeText={setInstallment3Amount}
            keyboardType="decimal-pad"
          />
          <TextInput
            style={styles.input}
            placeholder="Data scadenza (YYYY-MM-DD)"
            value={installment3DueDate}
            onChangeText={setInstallment3DueDate}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.sectionTitle}>Dati Bonifico Bancario</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="IBAN e informazioni banca"
            value={bankInfo}
            onChangeText={setBankInfo}
            multiline
            numberOfLines={4}
          />

          <Text style={styles.sectionTitle}>Email PayPal</Text>
          <TextInput
            style={styles.input}
            placeholder="paypal@example.com"
            value={paypalEmail}
            onChangeText={setPaypalEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Salvataggio...' : 'Salva Impostazioni'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  form: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
