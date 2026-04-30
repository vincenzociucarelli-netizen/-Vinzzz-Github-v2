/**
 * PrimaryAdminDeclarationModal
 *
 * Modal shown on admin dashboard if the current user is the Primary Admin
 * but has NOT yet signed their declaration.
 *
 * The primary admin must declare whether they are:
 *  (1) the society's legal representative, OR
 *  (2) a dirigente authorized by the legal representative.
 *
 * Until they sign, they cannot use the "keep disabled" option on the
 * society-wide certificate block.
 *
 * Exposes a `useSession: boolean` through localStorage fallback: we
 * don't auto-dismiss in DB — we mark the declaration as signed on submit.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import api from '../services/api';
import { Ionicons } from './Icon';

type DeclarationType = 'legal_representative' | 'authorized_delegate';

const POLL_INTERVAL_MS = 60000;

export default function PrimaryAdminDeclarationModal() {
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<DeclarationType | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accountIsSociety, setAccountIsSociety] = useState(false);

  const showMsg = (title: string, message: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
    else Alert.alert(title, message);
  };

  const checkStatus = useCallback(async () => {
    try {
      const res = await api.get('/admin/primary-admin/status');
      const d = res.data || {};
      // New logic: show popup to ANY admin while no legal representative is registered
      // (and current user hasn't signed yet). Backend computes this via `should_show_declaration_popup`.
      if (d.should_show_declaration_popup) {
        setVisible(true);
        setAccountIsSociety(Boolean(d.account_looks_like_society));
      } else {
        setVisible(false);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const id = setInterval(checkStatus, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [checkStatus]);

  const submit = async () => {
    if (!selected) {
      showMsg('Errore', "Seleziona una delle due dichiarazioni per procedere.");
      return;
    }
    if (!confirmed) {
      showMsg('Errore', "Devi confermare che la dichiarazione è veritiera.");
      return;
    }
    setLoading(true);
    try {
      await api.post('/admin/primary-admin/declare', {
        declaration_type: selected,
        confirmed: true,
      });
      setVisible(false);
      showMsg(
        '✅ Dichiarazione registrata',
        selected === 'legal_representative'
          ? "Sei registrato come Legale Rappresentante della Società."
          : "Sei registrato come Dirigente autorizzato dal Legale Rappresentante."
      );
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Impossibile salvare la dichiarazione';
      showMsg('Errore', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Ionicons name="shield-checkmark" size={24} color="#fff" />
            <Text style={styles.headerTitle}>Dichiarazione Responsabile Admin</Text>
          </View>
          <ScrollView style={{ maxHeight: 560 }}>
            <View style={styles.body}>
              <Text style={styles.lead}>
                Sei il <Text style={styles.bold}>Responsabile Admin</Text> della società e devi firmare questa dichiarazione prima di esercitare funzioni sensibili (es. mantenere disattivato il blocco certificati oltre la mezzanotte).
              </Text>

              <Text style={styles.sectionLabel}>Dichiaro di essere:</Text>

              <TouchableOpacity
                onPress={() => {
                  if (accountIsSociety) {
                    showMsg(
                      'Opzione non disponibile',
                      "Questo account risulta intestato ad una società. Il Legale Rappresentante deve essere una persona fisica (Presidente, Amministratore, ecc.). Registra il Legale Rappresentante come admin con il suo nome e cognome personali."
                    );
                    return;
                  }
                  setSelected('legal_representative');
                }}
                style={[
                  styles.option,
                  selected === 'legal_representative' && styles.optionSelected,
                  accountIsSociety && { opacity: 0.55, backgroundColor: '#F0F0F0' },
                ]}
                data-testid="decl-legal-rep"
              >
                <View style={[styles.radio, selected === 'legal_representative' && styles.radioOn]}>
                  {selected === 'legal_representative' && <View style={styles.radioDot} />}
                  {accountIsSociety && <Ionicons name="lock-closed" size={10} color="#999" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Legale Rappresentante della Società</Text>
                  <Text style={styles.optionDesc}>Sono il Presidente o il legale rappresentante pro-tempore iscritto nell'atto costitutivo / statuto.</Text>
                  {accountIsSociety && (
                    <Text style={[styles.optionDesc, { color: '#C62828', marginTop: 4, fontWeight: '700' }]}>
                      🔒 Non disponibile: questo account è intestato ad una società, non a una persona fisica.
                    </Text>
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelected('authorized_delegate')}
                style={[styles.option, selected === 'authorized_delegate' && styles.optionSelected]}
                data-testid="decl-delegate"
              >
                <View style={[styles.radio, selected === 'authorized_delegate' && styles.radioOn]}>
                  {selected === 'authorized_delegate' && <View style={styles.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Dirigente autorizzato</Text>
                  <Text style={styles.optionDesc}>Sono un dirigente della società formalmente autorizzato dal Legale Rappresentante a esercitare questo ruolo.</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setConfirmed(!confirmed)}
                style={[styles.checkbox, confirmed && styles.checkboxOn]}
                data-testid="decl-confirm"
              >
                <View style={[styles.checkSquare, confirmed && styles.checkSquareOn]}>
                  {confirmed && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={styles.checkText}>
                  Confermo sotto la mia responsabilità che le informazioni fornite sono veritiere. La dichiarazione verrà registrata nell'audit log con data, ora e IP.
                </Text>
              </TouchableOpacity>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={16} color="#1565C0" />
                <Text style={styles.infoText}>
                  Puoi delegare il ruolo di Responsabile Admin ad un altro Admin in qualsiasi momento da Impostazioni. La dichiarazione dovrà essere firmata nuovamente dal nuovo responsabile.
                </Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={submit}
                  disabled={loading || !selected || !confirmed}
                  style={[styles.btnPrimary, (loading || !selected || !confirmed) && styles.btnDisabled]}
                  data-testid="decl-submit"
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>FIRMA E CONFERMA</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    backgroundColor: '#1565C0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  body: { padding: 18 },
  lead: { fontSize: 13, color: '#333', lineHeight: 19, marginBottom: 14 },
  bold: { fontWeight: '800' },
  sectionLabel: { fontSize: 12, color: '#666', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  option: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#FAFAFA', borderWidth: 1.5, borderColor: '#E0E0E0',
    borderRadius: 10, padding: 12, marginBottom: 10,
  },
  optionSelected: { borderColor: '#1565C0', backgroundColor: '#E3F2FD' },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#999',
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  radioOn: { borderColor: '#1565C0' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1565C0' },
  optionTitle: { fontSize: 13, fontWeight: '800', color: '#1A1A1A', marginBottom: 2 },
  optionDesc: { fontSize: 12, color: '#666', lineHeight: 17 },
  checkbox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFF8E1', padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#FFE082', marginTop: 6,
  },
  checkboxOn: { backgroundColor: '#FFECB3' },
  checkSquare: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#999',
    backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkSquareOn: { backgroundColor: '#E65100', borderColor: '#E65100' },
  checkText: { flex: 1, fontSize: 12, color: '#444', lineHeight: 17 },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#E3F2FD', padding: 10, borderRadius: 8,
    marginTop: 12, marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 11, color: '#0D47A1', lineHeight: 16 },
  actions: { marginTop: 6 },
  btnPrimary: {
    backgroundColor: '#1565C0', paddingVertical: 14, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.5 },
});
