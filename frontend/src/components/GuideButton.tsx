/**
 * 📖 10/07/2026 (v7.15) — Bottone "Guida" universale.
 *
 * Scarica il PDF del prontuario del ruolo corrente e lo mostra tramite
 * InAppPdfModal (con opzioni SCARICA / NUOVA SCHEDA / CHIUDI già testate).
 *
 * 🐛 27/07/2026 — HOTFIX "Unmatched Route" su Chrome Android.
 * Chrome mobile non renderizza i PDF blob dentro iframe: mostra un
 * placeholder con "Apri" che, se cliccato, naviga la top-level all'URL blob
 * ma perdendo il prefisso `blob:`, quindi la SPA riceve un path tipo
 * `/<uuid>` che non matcha nessuna route → "Unmatched Route".
 * Fix: su mobile (Android/iOS) SALTIAMO il modal con iframe e triggeriamo
 * direttamente il download del file, che apre l'app PDF di sistema.
 *
 * Usage:
 *   <GuideButton role="coach" />          // icona piccola per header
 *   <GuideButton role="parent" label />   // icona + label per menu
 */
import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
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

// 🐛 27/07/2026 — Detect Chrome Android (dove blob PDF non funzionano in iframe).
// Su questi dispositivi scarichiamo direttamente il file.
const isMobileBrowser = (): boolean => {
  if (Platform.OS !== 'web') return true; // native = tratta come mobile
  try {
    // @ts-ignore navigator è globale su web
    const ua = (navigator && navigator.userAgent) || '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  } catch {
    return false;
  }
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

      // 🐛 27/07/2026 — Su mobile: scarica direttamente, NON aprire modal con iframe
      // (Chrome Android rompe il blob URL causando "Unmatched Route").
      if (Platform.OS === 'web' && isMobileBrowser()) {
        try {
          // @ts-ignore document è globale su react-native-web
          const a = document.createElement('a');
          a.href = url;
          a.download = `Guida_${ROLE_LABEL[role].replace(/\s+/g, '_')}.pdf`;
          // @ts-ignore
          document.body.appendChild(a);
          a.click();
          // @ts-ignore
          document.body.removeChild(a);
        } finally {
          // Revoca il blob URL dopo un breve delay per permettere al download di iniziare
          setTimeout(() => URL.revokeObjectURL(url), 4000);
        }
      } else {
        setPdfUrl(url);
      }
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
        testID={`guide-button-${role}`}
        // @ts-ignore - manteniamo anche data-testid per compatibilità web pura
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
