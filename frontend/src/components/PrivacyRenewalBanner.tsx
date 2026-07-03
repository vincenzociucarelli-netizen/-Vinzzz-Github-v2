/**
 * 🆕 02/07/2026 — Banner + modale bloccante per rifirma privacy genitore
 * a inizio nuova stagione. Trigger: primo dei due tra
 * (allenamenti figli >= max_trainings) OR (giorni dal primo login >= max_days).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../services/api';

interface RenewalStatus {
  must_sign: boolean;
  blocking: boolean;
  season?: string;
  trainings_attended?: number;
  max_trainings?: number;
  days_elapsed?: number;
  max_days?: number;
}

export const PrivacyRenewalBanner: React.FC = () => {
  const router = useRouter();
  const [status, setStatus] = useState<RenewalStatus | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/parent/privacy-renewal-status');
      setStatus(r.data);
    } catch { /* silente */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!status?.must_sign) return null;

  const handleSign = () => {
    // Redirige al flow firma GDPR esistente (che l'utente conosce già)
    router.push('/parent/gdpr-privacy' as any);
  };

  const handleDecline = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.post('/parent/privacy-renewal-decline', { reason: declineReason || undefined });
      setShowDeclineModal(false);
      if (Platform.OS === 'web') {
        window.alert('Ritiro registrato. Il coach è stato avvisato. Hai 15 giorni per ripensarci.');
      }
      // Ricarica lo stato (must_sign = false ora)
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Operazione non riuscita';
      if (Platform.OS === 'web') window.alert(msg);
    } finally {
      setBusy(false);
    }
  };

  const trainings = status.trainings_attended || 0;
  const maxTr = status.max_trainings || 3;
  const days = status.days_elapsed || 0;
  const maxDays = status.max_days || 7;

  const bannerContent = (
    <View style={{ backgroundColor: status.blocking ? '#B71C1C' : '#EF6C00', padding: 14, borderRadius: 12, margin: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Ionicons name="alert-circle" size={22} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, flex: 1 }}>
          Rifirma la Privacy per la stagione {status.season || ''}
        </Text>
      </View>
      <Text style={{ color: '#fff', fontSize: 12, marginBottom: 10 }}>
        {status.blocking
          ? '⚠️ Il periodo di prova è concluso. Firma la privacy o rinuncia per continuare a usare l\'app.'
          : `Hai ${maxTr - trainings > 0 ? maxTr - trainings : 0} allenamenti di prova rimanenti (o ${maxDays - days > 0 ? maxDays - days : 0} giorni), poi ti chiederemo di scegliere.`
        }
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={handleSign}
          style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
          data-testid="privacy-sign-btn"
        >
          <Text style={{ color: status.blocking ? '#B71C1C' : '#EF6C00', fontWeight: '800', fontSize: 13 }}>
            ✅ Firma per {status.season}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowDeclineModal(true)}
          style={{ flex: 1, borderColor: '#fff', borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
          data-testid="privacy-decline-btn"
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>🚫 Rinuncia</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      {bannerContent}

      {/* Modale bloccante: se blocking=true e utente prova a chiuderla, ricompare */}
      {status.blocking && (
        <Modal transparent animationType="fade" visible={true}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#B71C1C', marginBottom: 8 }}>
                🛑 Accesso limitato
              </Text>
              <Text style={{ fontSize: 14, color: '#333', marginBottom: 14 }}>
                Il periodo di prova per la nuova stagione {status.season} è concluso ({trainings}/{maxTr} allenamenti · {days}/{maxDays} giorni). Per continuare a usare RegistraTEAM, firma la privacy o rinuncia formalmente.
              </Text>
              {bannerContent}
            </View>
          </View>
        </Modal>
      )}

      {/* Modale conferma rinuncia */}
      <Modal transparent animationType="slide" visible={showDeclineModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#B71C1C', marginBottom: 8 }}>
              🚫 Confermi la rinuncia?
            </Text>
            <Text style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>
              I tuoi figli minorenni verranno <Text style={{ fontWeight: '700' }}>ritirati dalla società</Text>. Il coach sarà avvisato. Hai <Text style={{ fontWeight: '700' }}>15 giorni</Text> per ripensarci contattando la segreteria.
            </Text>
            <TextInput
              value={declineReason}
              onChangeText={setDeclineReason}
              placeholder="Motivo (facoltativo)…"
              placeholderTextColor="#aaa"
              multiline
              numberOfLines={3}
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 14, textAlignVertical: 'top' }}
              data-testid="decline-reason-input"
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setShowDeclineModal(false)}
                disabled={busy}
                style={{ flex: 1, backgroundColor: '#EEEEEE', borderRadius: 8, paddingVertical: 12, alignItems: 'center' }}
                data-testid="decline-cancel-btn"
              >
                <Text style={{ color: '#333', fontWeight: '700' }}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDecline}
                disabled={busy}
                style={{ flex: 1, backgroundColor: '#C62828', borderRadius: 8, paddingVertical: 12, alignItems: 'center', opacity: busy ? 0.6 : 1 }}
                data-testid="decline-confirm-btn"
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{busy ? 'Invio…' : 'Conferma rinuncia'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default PrivacyRenewalBanner;
