/**
 * 📖 10/07/2026 (v7.15) — Bottone "Guida" universale.
 *
 * Scarica il PDF del prontuario del ruolo corrente e lo mostra tramite
 * InAppPdfModal (con opzioni SCARICA / NUOVA SCHEDA / CHIUDI già testate).
 *
 * Usage:
 *   <GuideButton role="coach" />          // icona piccola per header
 *   <GuideButton role="parent" label />   // icona + label per menu
 */
import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from './Icon';
import api from '../services/api';
import { InAppPdfModal } from './InAppPdfModal';

type Role = 'admin' | 'coach' | 'dirigente' | 'collaboratore' | 'parent' | 'athlete';

interface Props {
  role: Role;
  label?: boolean;        // se true, mostra "📖 Guida" accanto all'icona
  compact?: boolean;      // se true, solo icona senza padding
  color?: string;         // colore icona (default: bianco)
}

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Amministratore',
  coach: 'Coach',
  dirigente: 'Dirigente',
  collaboratore: 'Collaboratore',
  parent: 'Genitore',
  athlete: 'Atleta',
};

export const GuideButton: React.FC<Props> = ({ role, label = false, compact = false, color = '#fff' }) => {
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const handlePress = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.get(`/guides/${role}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (e) {
      console.error('Errore download guida:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        style={[styles.btn, compact && styles.compact, label && styles.withLabel]}
        disabled={loading}
        data-testid={`guide-button-${role}`}
      >
        {loading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Ionicons name="book-outline" size={compact ? 20 : 24} color={color} />
        )}
        {label && !loading && (
          <Text style={[styles.label, { color }]}>Guida</Text>
        )}
      </TouchableOpacity>
      <InAppPdfModal
        visible={!!pdfUrl}
        url={pdfUrl}
        title={`Guida ${ROLE_LABEL[role]}`}
        onClose={() => {
          if (pdfUrl) URL.revokeObjectURL(pdfUrl);
          setPdfUrl(null);
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 6,
  },
  compact: { padding: 4 },
  withLabel: { paddingHorizontal: 10 },
  label: { fontSize: 12, fontWeight: '600' },
});

export default GuideButton;
