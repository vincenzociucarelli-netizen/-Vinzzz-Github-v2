/**
 * 🆕 27/09/2026 — Pulsante "Stampa QR atleta".
 * Genera un PDF (una pagina) con logo società, squadra, QR grande e nome atleta.
 * Visibile nella scheda atleta (coach/admin/genitore).
 */
import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Alert, Platform, StyleSheet } from 'react-native';
import { Ionicons } from './Icon';
import api from '../services/api';

interface Props {
  athleteId: string;
}

const AthleteQrButton: React.FC<Props> = ({ athleteId }) => {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.get(`/athletes/${athleteId}/qr-code-pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      if (Platform.OS === 'web') {
        // @ts-ignore
        const url = URL.createObjectURL(blob);
        // @ts-ignore
        const win = window.open(url, '_blank', 'noopener,noreferrer');
        if (!win) {
          // @ts-ignore
          const a = document.createElement('a');
          a.href = url;
          a.download = 'QR_atleta.pdf';
          // @ts-ignore
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      } else {
        Alert.alert('QR Code', 'Apri l\'app dal browser per scaricare il PDF del QR.');
      }
    } catch (e: any) {
      let msg = 'Impossibile generare il PDF del QR';
      if (e?.response?.data instanceof Blob) {
        try { const t = await e.response.data.text(); const j = JSON.parse(t); msg = j.detail || msg; } catch {}
      } else if (e?.response?.data?.detail) {
        msg = e.response.data.detail;
      }
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
