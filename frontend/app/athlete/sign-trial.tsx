import React, { useState, useEffect, useRef } from 'react';
import SocietyBranding from '../../src/components/SocietyBranding';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';
import { Ionicons } from '../../src/components/Icon';
import SignaturePadInline, { SignaturePadInlineRef } from '../../src/components/SignaturePadInline';

export default function SignTrialPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [trialSignature, setTrialSignature] = useState<string | null>(null);
  const [signingTrialDoc, setSigningTrialDoc] = useState(false);
  const trialSignatureRef = useRef<SignaturePadInlineRef>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const meRes = await api.get('/auth/me');
      const me = meRes.data;
      if (me.athlete_id) {
        const athleteRes = await api.get(`/athletes/${me.athlete_id}`);
        setProfile({ ...me, ...athleteRes.data });
      } else {
        setProfile(me);
      }
    } catch (e) {
      console.log('Error loading profile:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!trialSignature) return;
    setSigningTrialDoc(true);
    try {
      const athleteId = profile?.athlete_id || profile?.id;
      const res = await api.post(`/athletes/${athleteId}/sign-trial-document`, {
        signature_base64: trialSignature,
      }, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      }
      Alert.alert('Successo', 'Dichiarazione di prova firmata con successo!');
      router.replace('/athlete');
    } catch (e: any) {
      let msg = 'Errore nella firma del documento';
      if (e.response?.data instanceof Blob) {
        try { const text = await e.response.data.text(); const json = JSON.parse(text); msg = json.detail || msg; } catch {}
      } else if (e.response?.data?.detail) { msg = e.response.data.detail; }
      Alert.alert('Errore', msg);
    } finally {
      setSigningTrialDoc(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7B1FA2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header - stile viola come il minore */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/athlete'))} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        {/* BRANDING_WRAPPED */}
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <SocietyBranding />
            <Text style={styles.headerTitle}>Firma Dichiarazione di Prova</Text>
          </View>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/athlete'))} style={{ padding: 8 }}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Info box viola */}
        <View style={{ backgroundColor: '#F3E5F5', borderRadius: 10, padding: 14, marginBottom: 20 }}>
          <Text style={{ fontSize: 13, color: '#6A1B9A', lineHeight: 20 }}>
            Firmando questo documento dichiari di voler partecipare al periodo di prova presso la societ{'a'}.
            {'\n'}La tua firma digitale verr{'a'} incorporata nel documento PDF ufficiale.
          </Text>
        </View>

        {/* Dati atleta */}
        {profile && (
          <View style={{ backgroundColor: '#F3E5F5', borderRadius: 10, padding: 14, marginBottom: 20, borderLeftWidth: 3, borderLeftColor: '#9C27B0' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#7B1FA2', marginBottom: 4 }}>
              {profile?.first_name} {profile?.last_name}
            </Text>
            <Text style={{ fontSize: 12, color: '#6A1B9A' }}>
              In attesa di inizio prova
            </Text>
          </View>
        )}

        {/* Signature Pad */}
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>Disegna la tua firma qui sotto:</Text>
        <SignaturePadInline
          ref={trialSignatureRef}
          height={180}
          penColor="#1a237e"
          backgroundColor="#fafafa"
          onSave={(sig: string) => setTrialSignature(sig)}
          onClear={() => setTrialSignature(null)}
        />

        {/* Confirm Button - viola come il minore */}
        <TouchableOpacity
          style={{
            backgroundColor: trialSignature ? '#7B1FA2' : '#ccc',
            paddingVertical: 14,
            borderRadius: 10,
            alignItems: 'center',
            marginTop: 16,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            opacity: signingTrialDoc ? 0.6 : 1,
          }}
          disabled={!trialSignature || signingTrialDoc}
          onPress={handleSign}
          data-testid="confirm-trial-sign-btn"
        >
          {signingTrialDoc ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
          )}
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
            Conferma e Firma
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#7B1FA2',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
