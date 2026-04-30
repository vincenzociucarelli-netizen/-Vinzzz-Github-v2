/**
 * CertificateOverridePopup
 *
 * Componente globale Admin: polla le notifiche e mostra un modale overlay in tempo reale
 * quando un Coach scansiona un atleta con certificato scaduto e richiede l'override.
 *
 * - Polling: ogni 10 secondi
 * - Mostra solo notifiche con override_status === 'pending'
 * - AUTORIZZA richiede un motivo (min 5 caratteri)
 * - Athlete-specific, single-use (consumato al primo ingresso valido)
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import api from '../services/api';
import { Ionicons } from './Icon';

interface PendingOverrideNotification {
  id: string;
  athlete_id?: string;
  athlete_name?: string;
  team_name?: string;
  message?: string;
  data?: {
    athlete_name?: string;
    team_name?: string;
    coach_name?: string;
    block_reason?: string;
  };
  override_status?: string;
  created_at?: string;
}

const POLL_INTERVAL_MS = 10000; // 10 seconds

export default function CertificateOverridePopup() {
  const [pending, setPending] = useState<PendingOverrideNotification | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  // Track dismissed notification ids (session-only) so the popup doesn't re-open after Rifiuta/Autorizza
  const dismissedIdsRef = useRef<Set<string>>(new Set());
  const pollingRef = useRef<any>(null);

  const fetchPending = useCallback(async () => {
    try {
      // Skip if any admin still needs to sign declaration (let that modal take priority)
      try {
        const paRes = await api.get('/admin/primary-admin/status');
        if (paRes.data?.should_show_declaration_popup) {
          setPending(null);
          return;
        }
      } catch {}
      const res = await api.get('/admin/notifications');
      const list: PendingOverrideNotification[] = res.data || [];
      // Find first pending expired_cert_scan notification not yet dismissed in this session
      const next = list.find(
        (n: any) =>
          n.type === 'expired_cert_scan' &&
          (!n.override_status || n.override_status === 'pending') &&
          !dismissedIdsRef.current.has(n.id)
      );
      if (next && (!pending || pending.id !== next.id)) {
        setPending(next);
        setReason('');
        playPing();
      }
    } catch {
      // silent
    }
  }, [pending]);

  // Short ping sound using Web Audio API (no external asset needed)
  const playPing = () => {
    try {
      if (Platform.OS !== 'web') return;
      const w: any = typeof window !== 'undefined' ? window : null;
      if (!w) return;
      const AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      // Two-tone ping (C6 -> E6) like a gentle notification
      const play = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur + 0.02);
      };
      play(1047, 0, 0.18);    // C6
      play(1319, 0.18, 0.22); // E6
      setTimeout(() => ctx.close().catch(() => {}), 700);
    } catch {
      // Autoplay blocked before user interaction: silently ignore
    }
  };

  useEffect(() => {
    fetchPending();
    pollingRef.current = setInterval(fetchPending, POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchPending]);

  const showMsg = (title: string, message: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
    else Alert.alert(title, message);
  };

  const handleAuthorize = async () => {
    if (!pending) return;
    const r = reason.trim();
    if (r.length < 5) {
      showMsg('Errore', 'Inserisci il motivo dell\'override (minimo 5 caratteri).');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/admin/notifications/${pending.id}/authorize-override`, { reason: r });
      const name = pending.athlete_name || pending.data?.athlete_name || 'Atleta';
      showMsg(
        '✅ Override autorizzato',
        `${name} ora può entrare all'allenamento.\nIl Coach deve ripetere la scansione del QR.\n\nL'override sarà consumato al primo ingresso valido.`
      );
      dismissedIdsRef.current.add(pending.id);
      setPending(null);
      setReason('');
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Impossibile autorizzare l\'override';
      showMsg('Errore', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async () => {
    if (!pending) return;
    const name = pending.athlete_name || pending.data?.athlete_name || 'l\'atleta';
    const confirmDeny = Platform.OS === 'web'
      ? window.confirm(`Rifiutare l'ingresso per ${name}?`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert('Rifiuta ingresso', `Rifiutare l'ingresso per ${name}?`, [
            { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Rifiuta', style: 'destructive', onPress: () => resolve(true) },
          ]);
        });
    if (!confirmDeny) return;
    setLoading(true);
    try {
      await api.post(`/admin/notifications/${pending.id}/deny-override`, { reason: '' });
      dismissedIdsRef.current.add(pending.id);
      setPending(null);
      setReason('');
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Impossibile rifiutare';
      showMsg('Errore', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLater = () => {
    if (!pending) return;
    // Dismiss only in this session: the notification remains pending in DB
    // and can be handled from /admin/notifications or at next session
    dismissedIdsRef.current.add(pending.id);
    setPending(null);
    setReason('');
  };

  if (!pending) return null;

  const athleteName = pending.athlete_name || pending.data?.athlete_name || 'Atleta';
  const coachName = pending.data?.coach_name || 'Coach';
  const teamName = pending.team_name || pending.data?.team_name || '';
  const blockReason = pending.data?.block_reason || 'Certificato medico scaduto/mancante';

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={handleLater}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Ionicons name="medkit" size={26} color="#fff" />
            <Text style={styles.headerTitle}>Richiesta override certificato</Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.leadText}>
              Un Coach chiede l'autorizzazione per un atleta con certificato non valido.
            </Text>

            <View style={styles.athleteBox}>
              <Text style={styles.athleteLabel}>Atleta</Text>
              <Text style={styles.athleteName} data-testid="override-popup-athlete-name">{athleteName}</Text>
              {teamName ? <Text style={styles.athleteMeta}>Squadra: {teamName}</Text> : null}
              <Text style={styles.athleteMeta}>Coach: {coachName}</Text>
              <Text style={styles.athleteReason}>{blockReason}</Text>
            </View>

            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ L'override sarà valido <Text style={styles.warningBold}>solo per UN ingresso</Text>, riservato esclusivamente a <Text style={styles.warningBold}>{athleteName}</Text>.
              </Text>
            </View>

            <Text style={styles.inputLabel}>Motivo dell'override (obbligatorio, min 5 caratteri)</Text>
            <TextInput
              style={styles.input}
              placeholder="es. Certificato in fase di rinnovo, gara imminente..."
              placeholderTextColor="#999"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              autoFocus
              data-testid="override-popup-reason-input"
            />

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.btnDeny, loading && styles.btnDisabled]}
                onPress={handleDeny}
                disabled={loading}
                data-testid="override-popup-deny"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={18} color="#fff" />
                    <Text style={styles.btnText}>NEGA INGRESSO</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnAuth, (reason.trim().length < 5 || loading) && styles.btnDisabled]}
                onPress={handleAuthorize}
                disabled={reason.trim().length < 5 || loading}
                data-testid="override-popup-authorize"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.btnText}>ATTIVA OVERRIDE</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.laterLink} onPress={handleLater} data-testid="override-popup-later">
              <Text style={styles.laterLinkText}>Decido più tardi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 460,
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
    backgroundColor: '#C62828',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  body: {
    padding: 18,
  },
  leadText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 12,
    lineHeight: 18,
  },
  athleteBox: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  athleteLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  athleteName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
    marginTop: 2,
  },
  athleteMeta: {
    fontSize: 13,
    color: '#555',
    marginTop: 4,
  },
  athleteReason: {
    fontSize: 12,
    color: '#C62828',
    marginTop: 6,
    fontWeight: '600',
  },
  warningBox: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    padding: 10,
    borderRadius: 6,
    marginBottom: 14,
  },
  warningText: {
    fontSize: 12,
    color: '#E65100',
    lineHeight: 17,
  },
  warningBold: {
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 12,
    color: '#444',
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D9D9D9',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#222',
    minHeight: 60,
    backgroundColor: '#FAFAFA',
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnAuth: {
    flex: 1,
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnDeny: {
    flex: 1,
    backgroundColor: '#C62828',
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  laterLink: {
    alignSelf: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  laterLinkText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
