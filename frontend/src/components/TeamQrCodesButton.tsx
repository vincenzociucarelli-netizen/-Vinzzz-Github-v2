/**
 * 🆕 27/09/2026 — Pulsante "Scarica QR Code squadra (PDF)".
 * Genera un PDF con il nome squadra come titolo, i codici QR degli atleti e
 * il nome di ciascun atleta sotto il proprio QR. Visibile in Presenze (coach + admin).
 */
import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Alert, Platform, StyleSheet } from 'react-native';
import { Ionicons } from './Icon';
import api from '../services/api';

interface Props {
  teamId: string;
  teamName?: string;
}

const TeamQrCodesButton: React.FC<Props> = ({ teamId, teamName }) => {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.get(`/teams/${teamId}/qr-codes-pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const safeName = (teamName || 'squadra').replace(/[^\w.\-]+/g, '_');
      const fileName = `QR_${safeName}.pdf`;
      if (Platform.OS === 'web') {
        // @ts-ignore
        const url = URL.createObjectURL(blob);
        // Scarica il file col nome della squadra
        // @ts-ignore
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        // @ts-ignore
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      } else {
        Alert.alert('QR Code', 'Apri l\'app dal browser per scaricare il PDF dei QR.');
      }
    } catch (e: any) {
      let msg = 'Impossibile generare il PDF dei QR code';
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
