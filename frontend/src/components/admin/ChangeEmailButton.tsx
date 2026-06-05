import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

interface Props {
  /** ID del record (user_id o athlete_id) */
  userId: string;
  /** Nome utente per la conferma */
  userName?: string;
  /** Email attuale (opzionale, mostrata in label) */
  currentEmail?: string;
  /** Callback dopo successo */
  onSuccess?: (newEmail: string) => void;
}

export const ChangeEmailButton: React.FC<Props> = ({ userId, userName, currentEmail, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const notify = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
    else Alert.alert(title, msg);
  };

  const handleSave = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      notify('Errore', 'Inserisci un\'email valida');
      return;
    }
    if (email === (currentEmail || '').toLowerCase()) {
      notify('Errore', 'La nuova email è uguale a quella attuale');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post(`/admin/users/${userId}/change-email`, { new_email: email });
      const msg = res.data?.verification_sent
        ? `Email aggiornata. ${userName ? userName + ' riceverà' : 'L\'utente riceverà'} un link di verifica al nuovo indirizzo ${email}.`
        : `Email aggiornata. ⚠️ Invio mail di verifica fallito: contatta direttamente l'utente per chiedergli di verificare.`;
      notify('✅ Operazione completata', msg);
      setOpen(false);
      setNewEmail('');
      if (onSuccess) onSuccess(email);
    } catch (e: any) {
      const detail = e?.response?.data?.detail || 'Errore durante il cambio email';
      notify('Errore', detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => setOpen(true)}
        data-testid="change-email-btn"
      >
        <Ionicons name="mail" size={16} color="#1E88E5" />
        <Text style={styles.btnText}>Cambia email</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.title}>📧 Cambia email</Text>
            {userName && <Text style={styles.subtitle}>Utente: {userName}</Text>}
            {currentEmail && (
              <Text style={styles.currentEmail}>
                Email attuale: <Text style={{ fontWeight: '700' }}>{currentEmail}</Text>
              </Text>
            )}

            <Text style={styles.label}>Nuova email</Text>
            <TextInput
              style={styles.input}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="nuova@email.com"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              data-testid="change-email-input"
            />

            <Text style={styles.hint}>
              ℹ️ Al nuovo indirizzo verrà inviato un link di verifica. L'utente dovrà cliccarlo per completare il cambio.
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => {
                  setOpen(false);
                  setNewEmail('');
                }}
                disabled={loading}
              >
                <Text style={styles.cancelBtnText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.confirmBtn, loading && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={loading}
                data-testid="change-email-confirm-btn"
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Conferma</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#1E88E5',
    alignSelf: 'flex-start',
  },
  btnText: { color: '#1565C0', fontWeight: '600', fontSize: 13 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#4B5563', marginTop: 4 },
  currentEmail: { fontSize: 13, color: '#4B5563', marginTop: 8 },
  label: { fontSize: 13, color: '#374151', fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#111827',
  },
  hint: { fontSize: 11, color: '#6B7280', marginTop: 8, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  actionBtn: { flex: 1, paddingVertical: 11, borderRadius: 8, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#F3F4F6' },
  cancelBtnText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  confirmBtn: { backgroundColor: '#1E88E5' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

export default ChangeEmailButton;
