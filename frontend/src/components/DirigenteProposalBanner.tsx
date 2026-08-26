import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import api from '../services/api';
import { Ionicons } from './Icon';

interface Proposal {
  pending: boolean;
  dirigente_user_id?: string;
  proposed_by_name?: string;
}

/**
 * 🆕 Banner "Incarico Dirigente" per il GENITORE.
 * Mostra la proposta di promozione a Dirigente inviata dall'admin e permette
 * di ACCETTARE o RIFIUTARE l'incarico. Solo dopo l'accettazione il genitore
 * potrà usare "Passa a Modalità Dirigente" (dual-role con lo stesso login).
 */
export default function DirigenteProposalBanner({ onAccepted }: { onAccepted?: () => void }) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/parent/dirigente-proposal');
      setProposal(res.data);
    } catch {
      setProposal(null);
    }
  };

  useEffect(() => { load(); }, []);

  if (!proposal?.pending) return null;

  const handleAccept = async () => {
    setBusy(true);
    try {
      const res = await api.post('/parent/dirigente-proposal/accept');
      setProposal({ pending: false });
      if (Platform.OS === 'web') window.alert(res.data?.message || 'Incarico accettato.');
      else Alert.alert('Incarico accettato', res.data?.message || 'Ora puoi passare alla Modalità Dirigente.');
      onAccepted?.();
    } catch (e: any) {
      Alert.alert('Errore', e?.response?.data?.detail || 'Operazione fallita');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Rifiutare l\'incarico di Dirigente?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert('Rifiuta incarico', 'Rifiutare l\'incarico di Dirigente?', [
            { text: 'Annulla', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Rifiuta', onPress: () => resolve(true), style: 'destructive' },
          ]);
        });
    if (!confirmed) return;
    setBusy(true);
    try {
      await api.post('/parent/dirigente-proposal/reject');
      setProposal({ pending: false });
    } catch (e: any) {
      Alert.alert('Errore', e?.response?.data?.detail || 'Operazione fallita');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      testID="dirigente-proposal-banner"
      style={{
        marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 12,
        backgroundColor: '#E0F7FA', borderLeftWidth: 4, borderLeftColor: '#00838F',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Ionicons name="briefcase" size={20} color="#00838F" />
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#00695C', marginLeft: 8 }}>
          Incarico Dirigente proposto
        </Text>
      </View>
      <Text style={{ fontSize: 13, color: '#37474F', marginBottom: 12 }}>
        {proposal.proposed_by_name || 'La società'} ti propone di ricoprire anche il ruolo di Dirigente
        (es. segnapunti) mantenendo lo stesso accesso. Accettando potrai passare tra Genitore e Dirigente
        senza un secondo account.
      </Text>
      {busy ? (
        <ActivityIndicator color="#00838F" />
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            onPress={handleAccept}
            testID="accept-dirigente-btn"
            style={{ flex: 1, backgroundColor: '#00838F', borderRadius: 10, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>Accetta incarico</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleReject}
            testID="reject-dirigente-btn"
            style={{ backgroundColor: '#fff', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#B0BEC5', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{ color: '#546E7A', fontWeight: '700' }}>Rifiuta</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
