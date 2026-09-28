/**
 * 🆕 27/09/2026 — Pulsante "Stampa QR atleta".
 * Genera un PDF (una pagina) con logo società, squadra, QR grande e nome atleta.
 * Visibile nella scheda atleta (coach/admin/genitore).
 */
import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Alert, Platform, Linking, StyleSheet } from 'react-native';
import { Ionicons } from './Icon';
import api from '../services/api';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Props {
  athleteId: string;
}

const AthleteQrButton: React.FC<Props> = ({ athleteId }) => {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.get('/pdf-download-token');
      const dt = res?.data?.token;
      if (!dt) throw new Error('token');
      const url = `${BACKEND_URL}/api/athletes/${athleteId}/qr-code-pdf?token=${encodeURIComponent(dt)}`;
      if (Platform.OS === 'web') {
        // @ts-ignore
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(url);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Impossibile generare il PDF del QR';
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
      testID="print-athlete-qr-btn"
    >
      {loading ? (
        <ActivityIndicator size="small" color="#5856D6" />
      ) : (
        <Ionicons name="qr-code-outline" size={20} color="#5856D6" />
      )}
      <Text style={styles.btnText}>
        {loading ? 'Generazione PDF…' : 'Stampa QR atleta'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#EEEDFB',
    borderWidth: 1,
    borderColor: '#5856D6',
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  btnText: {
    color: '#5856D6',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default AthleteQrButton;
