/**
 * GlobalOverrideStatusPopup
 *
 * Popup + banner shown to Admin when the society-wide certificate block is DISABLED.
 * - Polls `/settings/certificate-override-status` every 30s (also immediately).
 * - If `should_show_popup` is true (first admin access of the day while override is ON),
 *   shows a full-screen modal explaining the current situation with actions:
 *     - "Riattiva ora": re-enables the block immediately
 *     - "Ho capito": dismisses the popup for the day (POST /mark-seen)
 * - If block is OFF (regardless of popup state), shows a permanent yellow banner
 *   at the top of the admin dashboard with a "Riattiva ora" shortcut.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../services/api';
import { Ionicons } from './Icon';

interface OverrideStatus {
  block_expired_certificates: boolean;
  override_keep_disabled: boolean;
  override_auto_reactivate_at: string | null;
  override_deactivation_reason: string | null;
  override_deactivated_by_name: string | null;
  override_deactivated_at: string | null;
  should_show_popup: boolean;
  today: string;
}

const POLL_INTERVAL_MS = 30000;

function formatReactivate(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function GlobalOverrideStatusPopup() {
  const router = useRouter();
  const [status, setStatus] = useState<OverrideStatus | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const pollingRef = useRef<any>(null);
  // Track whether the user already dismissed locally (avoid re-open until next day)
  const dismissedTodayRef = useRef<string | null>(null);
  // Play ping only once per popup appearance
  const pingPlayedRef = useRef(false);

  const playPing = () => {
    try {
      if (Platform.OS !== 'web') return;
      const w: any = typeof window !== 'undefined' ? window : null;
      if (!w) return;
      const AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
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
      play(880, 0, 0.22);
      play(660, 0.22, 0.28);
      setTimeout(() => ctx.close().catch(() => {}), 700);
    } catch {
      // ignore
    }
  };

  const fetchStatus = useCallback(async () => {
    try {
      // Skip if primary admin still needs to sign declaration (let that modal take priority)
      try {
        const paRes = await api.get('/admin/primary-admin/status');
        if (paRes.data?.is_current_user_primary && !paRes.data?.declaration_signed) {
          setVisible(false);
          return;
        }
      } catch {}
      const res = await api.get('/settings/certificate-override-status');
      const data: OverrideStatus = res.data;
      setStatus(data);
      const alreadyDismissedLocal = dismissedTodayRef.current === data.today;
      if (data.should_show_popup && !alreadyDismissedLocal) {
        if (!popupVisible) {
          setPopupVisible(true);
          if (!pingPlayedRef.current) {
            playPing();
            pingPlayedRef.current = true;
          }
        }
      }
    } catch {
      // silent
    }
  }, [popupVisible]);

  useEffect(() => {
    fetchStatus();
    pollingRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchStatus]);

  const showMsg = (title: string, message: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
    else Alert.alert(title, message);
  };

  const markSeen = async () => {
    try {
      await api.post('/settings/certificate-override-status/mark-seen');
    } catch {
      // ignore
    }
    if (status) dismissedTodayRef.current = status.today;
    setPopupVisible(false);
    pingPlayedRef.current = false;
  };

  const reactivateNow = async () => {
    setLoading(true);
    try {
      await api.patch('/settings/society', { block_expired_certificates: true });
      showMsg('✅ Blocco riattivato', 'Il blocco certificati è ora ATTIVO. Gli atleti con certificato non valido verranno bloccati.');
      setPopupVisible(false);
      pingPlayedRef.current = false;
      await fetchStatus();
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Impossibile riattivare';
      showMsg('Errore', msg);
    } finally {
      setLoading(false);
    }
  };

  const goToSettings = () => {
    setPopupVisible(false);
    router.push('/admin/settings/society');
  };

  if (!status) return null;
  const overrideActive = status.block_expired_certificates === false;

  return (
    <>
      {/* Permanent banner (shown any time override is ON) */}
      {overrideActive && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={goToSettings}
          style={styles.banner}
          data-testid="override-active-banner"
        >
          <Ionicons name="warning" size={18} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerText} numberOfLines={2}>
              ⚠️ Blocco certificati DISATTIVATO — {status.override_keep_disabled
                ? 'a tempo indeterminato'
                : `riattivazione alle ${formatReactivate(status.override_auto_reactivate_at)}`}
            </Text>
          </View>
          <View style={styles.bannerCta}>
            <Text style={styles.bannerCtaText}>Gestisci</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* First-of-day popup */}
      <Modal visible={popupVisible} transparent animationType="fade" onRequestClose={markSeen}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Ionicons name="warning" size={26} color="#fff" />
              <Text style={styles.headerTitle}>Promemoria Sicurezza</Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.lead}>
                Il blocco automatico certificati medici è attualmente <Text style={styles.bold}>DISATTIVATO</Text>.
              </Text>

              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Stato attuale</Text>
                <Text style={styles.infoValue}>
                  {status.override_keep_disabled
                    ? '🔓 Disattivato a tempo indeterminato'
                    : `⏰ Riattivazione automatica: ${formatReactivate(status.override_auto_reactivate_at) || 'mezzanotte'}`}
                </Text>
                {status.override_deactivation_reason ? (
                  <>
                    <Text style={[styles.infoLabel, { marginTop: 8 }]}>Motivo</Text>
                    <Text style={styles.infoValue}>{status.override_deactivation_reason}</Text>
                  </>
                ) : null}
                {status.override_deactivated_by_name ? (
                  <>
                    <Text style={[styles.infoLabel, { marginTop: 8 }]}>Disattivato da</Text>
                    <Text style={styles.infoValue}>{status.override_deactivated_by_name}</Text>
                  </>
                ) : null}
              </View>

              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  Mentre il blocco è disattivato, <Text style={styles.bold}>qualsiasi atleta</Text> (anche con certificato scaduto o non autenticato) può accedere agli allenamenti senza richiesta di override.
                </Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={markSeen}
                  disabled={loading}
                  style={[styles.btnSecondary, loading && styles.btnDisabled]}
                  data-testid="override-popup-dismiss"
                >
                  <Text style={styles.btnSecondaryText}>HO CAPITO</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={reactivateNow}
                  disabled={loading}
                  style={[styles.btnPrimary, loading && styles.btnDisabled]}
                  data-testid="override-popup-reactivate"
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark" size={16} color="#fff" />
                      <Text style={styles.btnPrimaryText}>RIATTIVA ORA</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E65100',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  bannerCta: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  bannerCtaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
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
    backgroundColor: '#E65100',
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
  },
  body: {
    padding: 18,
  },
  lead: {
    fontSize: 14,
    color: '#333',
    marginBottom: 14,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '800',
  },
  infoBox: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 13,
    color: '#1A1A1A',
    marginTop: 3,
    fontWeight: '500',
  },
  warningBox: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    padding: 10,
    borderRadius: 6,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 12,
    color: '#E65100',
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#EEE',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
