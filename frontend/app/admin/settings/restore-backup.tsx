/**
 * /admin/settings/restore-backup
 *
 * Pagina di RIPRISTINO BACKUP (ZIP). Operazione distruttiva riservata al
 * Legale Rappresentante. Guardie a 3 livelli:
 *   1. Solo LR (primary + declaration=legal_representative) — enforced lato backend
 *   2. Password dell'utente + OTP via email
 *   3. Backup pre-restore automatico lato server
 *
 * Flow:
 *   a) seleziona file ZIP
 *   b) sceglie modalità (wipe o merge)
 *   c) inserisce password
 *   d) clicca "Invia codice OTP" → backend manda email
 *   e) inserisce codice OTP + digita conferma "RIPRISTINA"
 *   f) submit → alert con counters
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../../src/components/Icon';
import api from '../../../src/services/api';

export default function RestoreBackupScreen() {
  const router = useRouter();
  const [isLR, setIsLR] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'wipe' | 'merge'>('merge');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const showAlert = (msg: string) => {
    if (Platform.OS === 'web') window.alert(msg);
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/admin/primary-admin/status');
        const data = res.data;
        const isLegalRep =
          Boolean(data?.is_current_user_primary) &&
          data?.current_user_declaration === 'legal_representative';
        setIsLR(isLegalRep);
      } catch {
        setIsLR(false);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const onPickFile = (e: any) => {
    const f = e?.target?.files?.[0];
    if (f) setFile(f);
  };

  const requestOtp = async () => {
    if (!file) {
      showAlert('Seleziona prima il file ZIP di backup.');
      return;
    }
    if (password.length < 6) {
      showAlert('Inserisci la tua password per procedere.');
      return;
    }
    setOtpLoading(true);
    try {
      await api.post('/admin/backup/restore/request-otp');
      setOtpSent(true);
      showAlert('📧 Codice OTP inviato alla tua email. Controlla la casella.');
    } catch (e: any) {
      showAlert(e?.response?.data?.detail || 'Impossibile inviare il codice OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const doRestore = async () => {
    if (!file) return showAlert('Seleziona prima il file ZIP');
    if (!otp || otp.length !== 6) return showAlert('Inserisci il codice OTP (6 cifre)');
    if (confirmText !== 'RIPRISTINA') {
      return showAlert('Per confermare, digita esattamente RIPRISTINA (maiuscolo) nel campo di conferma');
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('backup_zip', file);
      fd.append('password', password);
      fd.append('otp', otp);
      fd.append('mode', mode);
      const res = await api.post('/admin/backup/restore', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const d = res.data;
      showAlert(
        `✅ Restore ${d.mode} completato!\n\n` +
          `Record aggiunti: ${d.counters.inserted}\n` +
          `Record aggiornati: ${d.counters.updated}\n` +
          `Utente corrente preservato: ${d.counters.skipped_current_user}\n\n` +
          `Backup pre-restore salvato come: ${d.pre_restore_backup}`
      );
      // Reset form
      setFile(null);
      setPassword('');
      setOtp('');
      setConfirmText('');
      setOtpSent(false);
    } catch (e: any) {
      showAlert(e?.response?.data?.detail || 'Errore durante il ripristino');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#C62828" />
      </View>
    );
  }

  if (!isLR) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.replace('/admin/settings')} style={s.backBtn} data-testid="restore-back">
            <Ionicons name="chevron-back" size={24} color="#1565C0" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Ripristino Backup</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ padding: 24 }}>
          <View style={s.blockedBox}>
            <Ionicons name="lock-closed" size={40} color="#C62828" />
            <Text style={s.blockedTitle}>Accesso riservato al Legale Rappresentante</Text>
            <Text style={s.blockedText}>
              Il ripristino di un backup è un'operazione distruttiva e può essere eseguito solo dal Legale Rappresentante della Società (admin con scettro + firma "Legale Rappresentante"). Se sei il LR, assicurati di aver firmato la dichiarazione da Impostazioni → Responsabile Admin.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.replace('/admin/settings')} style={s.backBtn} data-testid="restore-back">
          <Ionicons name="chevron-back" size={24} color="#1565C0" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Ripristino Backup</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Warning principale */}
        <View style={s.warnBox}>
          <Ionicons name="warning" size={22} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={s.warnTitle}>⚠️ OPERAZIONE DISTRUTTIVA</Text>
            <Text style={s.warnText}>
              Il ripristino sovrascrive i dati attuali della Società con quelli contenuti nel file ZIP. Prima di procedere il sistema creerà automaticamente un <Text style={s.bold}>backup pre-restore</Text> salvato sul server.
            </Text>
          </View>
        </View>

        {/* Step 1: file */}
        <View style={s.card}>
          <Text style={s.stepLabel}>1. Seleziona il file di backup (.zip)</Text>
          {Platform.OS === 'web' ? (
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={onPickFile}
              style={s.fileInput as any}
              data-testid="restore-file-input"
            />
          ) : (
            <Text style={s.hint}>Upload disponibile solo da browser web.</Text>
          )}
          {file && (
            <Text style={s.fileInfo}>
              📦 {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
            </Text>
          )}
        </View>

        {/* Step 2: modalità */}
        <View style={s.card}>
          <Text style={s.stepLabel}>2. Modalità di ripristino</Text>
          <TouchableOpacity
            style={[s.modeOpt, mode === 'merge' && s.modeOptActive]}
            onPress={() => setMode('merge')}
            data-testid="mode-merge"
          >
            <Ionicons name={mode === 'merge' ? 'radio-button-on' : 'radio-button-off'} size={20} color="#1565C0" />
            <View style={{ flex: 1 }}>
              <Text style={s.modeTitle}>🔀 Merge intelligente (consigliato)</Text>
              <Text style={s.modeDesc}>I record nel ZIP sovrascrivono quelli esistenti con lo stesso ID. I record NON presenti nel ZIP restano invariati.</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeOpt, mode === 'wipe' && s.modeOptActive, { borderColor: mode === 'wipe' ? '#C62828' : '#ddd' }]}
            onPress={() => setMode('wipe')}
            data-testid="mode-wipe"
          >
            <Ionicons name={mode === 'wipe' ? 'radio-button-on' : 'radio-button-off'} size={20} color="#C62828" />
            <View style={{ flex: 1 }}>
              <Text style={[s.modeTitle, { color: '#C62828' }]}>🧨 Wipe + reimport (distruttivo)</Text>
              <Text style={s.modeDesc}>Cancella TUTTI i dati attuali e importa solo quelli del ZIP. L'utente corrente (tu) NON viene mai toccato.</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Step 3: password */}
        <View style={s.card}>
          <Text style={s.stepLabel}>3. La tua password</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password del tuo account"
            data-testid="restore-password"
            autoComplete="current-password"
          />
        </View>

        {/* Step 4: OTP */}
        <View style={s.card}>
          <Text style={s.stepLabel}>4. Codice OTP via email</Text>
          <TouchableOpacity
            style={[s.otpBtn, otpLoading && { opacity: 0.6 }]}
            onPress={requestOtp}
            disabled={otpLoading}
            data-testid="restore-send-otp"
          >
            {otpLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.otpBtnText}>{otpSent ? '↻ Re-invia codice OTP' : '📧 Invia codice OTP alla mia email'}</Text>
            )}
          </TouchableOpacity>
          {otpSent && (
            <TextInput
              style={[s.input, { marginTop: 10, letterSpacing: 6, fontSize: 20, textAlign: 'center' }]}
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="000000"
              keyboardType="numeric"
              maxLength={6}
              data-testid="restore-otp-input"
            />
          )}
        </View>

        {/* Step 5: conferma testuale */}
        {otpSent && (
          <View style={s.card}>
            <Text style={s.stepLabel}>5. Conferma finale</Text>
            <Text style={s.hint}>Per procedere, digita esattamente <Text style={s.bold}>RIPRISTINA</Text> qui sotto:</Text>
            <TextInput
              style={[s.input, { marginTop: 8 }]}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="Digita RIPRISTINA"
              autoCapitalize="characters"
              data-testid="restore-confirm-text"
            />
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[s.submitBtn, (submitting || !otpSent || confirmText !== 'RIPRISTINA' || !file) && s.submitBtnDisabled]}
          onPress={doRestore}
          disabled={submitting || !otpSent || confirmText !== 'RIPRISTINA' || !file}
          data-testid="restore-submit"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitText}>⚠️ Esegui ripristino {mode === 'wipe' ? '(WIPE)' : '(MERGE)'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 20 : 50,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  content: { flex: 1 },
  warnBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#C62828',
    padding: 14,
    borderRadius: 10,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  warnTitle: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  warnText: { color: '#fff', fontSize: 13, lineHeight: 18, marginTop: 4 },
  bold: { fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#e0e0e0' },
  stepLabel: { fontSize: 14, fontWeight: '700', color: '#1565C0', marginBottom: 10 },
  fileInput: { fontSize: 14, padding: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, width: '100%' },
  fileInfo: { marginTop: 8, fontSize: 13, color: '#2e7d32', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10, fontSize: 14, backgroundColor: '#fafafa' },
  hint: { fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic' },
  modeOpt: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginBottom: 10,
  },
  modeOptActive: { backgroundColor: '#F3F7FF', borderColor: '#1565C0' },
  modeTitle: { fontSize: 14, fontWeight: '700', color: '#1565C0' },
  modeDesc: { fontSize: 12, color: '#555', marginTop: 2, lineHeight: 16 },
  otpBtn: { backgroundColor: '#1565C0', borderRadius: 8, padding: 12, alignItems: 'center' },
  otpBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  submitBtn: { backgroundColor: '#C62828', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10 },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  blockedBox: { backgroundColor: '#fff', padding: 24, borderRadius: 12, alignItems: 'center', gap: 10 },
  blockedTitle: { fontSize: 16, fontWeight: '700', color: '#C62828', textAlign: 'center' },
  blockedText: { fontSize: 13, color: '#555', textAlign: 'center', lineHeight: 19 },
});
