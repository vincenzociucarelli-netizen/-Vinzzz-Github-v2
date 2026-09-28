/**
 * 🆕 27/09/2026 — Pulsante "Scarica QR Code squadra (PDF)".
 * Genera un PDF con il nome squadra come titolo, i codici QR degli atleti e
 * il nome di ciascun atleta sotto il proprio QR. Visibile in Presenze (coach + admin).
 */
import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Alert, Platform, Linking, StyleSheet } from 'react-native';
import { Ionicons } from './Icon';
import api from '../services/api';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Props {
  teamId: string;
  teamName?: string;
}

const TeamQrCodesButton: React.FC<Props> = ({ teamId }) => {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Token di download a vita breve → apriamo un URL REALE del server (niente blob:,
      // così funziona e resta apribile anche su mobile).
      const res = await api.get('/pdf-download-token');
      const dt = res?.data?.token;
      if (!dt) throw new Error('token');
      const url = `${BACKEND_URL}/api/teams/${teamId}/qr-codes-pdf?token=${encodeURIComponent(dt)}`;
      if (Platform.OS === 'web') {
        // @ts-ignore
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(url);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Impossibile generare il PDF dei QR code';
      Alert.alert('Errore', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={handlePress}
      disabled={loading}
      activeOpacity={0.8}
      testID="download-team-qr-pdf-btn"
    >
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons name="qr-code-outline" size={18} color="#fff" />
      )}
      <Text style={styles.btnText}>
        {loading ? 'Generazione PDF…' : 'Scarica QR Code squadra (PDF)'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#5856D6',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default TeamQrCodesButton;
