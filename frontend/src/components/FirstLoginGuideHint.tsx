/**
 * 📖 09/08/2026 — Coach-mark "una tantum" al primo accesso.
 *
 * Al primo ingresso di ogni utente evidenzia il libretto "Guida rapida" presente
 * in alto a destra nell'header (icona book-outline accanto alla porta d'uscita).
 * Si mostra una sola volta per utente (flag salvato in AsyncStorage) ed è
 * completamente saltabile.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from './Icon';
import { useAuthStore } from '../store/authStore';

interface Props {
  /** Etichetta del ruolo per personalizzare il testo (es. "Coach", "Genitore"). */
  roleLabel?: string;
  accentColor?: string;
}

export const FirstLoginGuideHint: React.FC<Props> = ({ roleLabel, accentColor = '#1976D2' }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [visible, setVisible] = useState(false);

  const storageKey = user?.id ? `guide_hint_seen_v1_${user.id}` : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!storageKey) return;
      try {
        const seen = await AsyncStorage.getItem(storageKey);
        if (!seen && !cancelled) {
          // piccolo delay per far renderizzare la dashboard sotto
          setTimeout(() => !cancelled && setVisible(true), 1200);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

  const dismiss = async () => {
    setVisible(false);
    if (storageKey) {
      try { await AsyncStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={dismiss} testID="guide-hint-backdrop">
        <View style={[styles.calloutWrap, { top: insets.top + 52 }]}>
          {/* freccia che punta verso l'icona del libretto in alto a destra */}
          <View style={styles.arrowRow}>
            <View style={{ flex: 1 }} />
            <Ionicons name="arrow-up" size={26} color="#fff" style={{ marginRight: Platform.OS === 'web' ? 44 : 40 }} />
          </View>
          <View style={styles.callout}>
            <View style={styles.calloutHeader}>
              <Ionicons name="book-outline" size={22} color={accentColor} />
              <Text style={[styles.calloutTitle, { color: accentColor }]}>Guida rapida</Text>
            </View>
            <Text style={styles.calloutText}>
              Qui in alto a destra trovi il <Text style={{ fontWeight: '700' }}>libretto</Text> con la
              guida rapida{roleLabel ? ` per ${roleLabel}` : ''}. Toccalo ogni volta che ti serve
              una mano: spiega come usare l'app passo passo.
            </Text>
            <TouchableOpacity style={[styles.okBtn, { backgroundColor: accentColor }]} onPress={dismiss} testID="guide-hint-ok">
              <Text style={styles.okBtnText}>Ho capito</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  calloutWrap: {
    position: 'absolute',
    right: 12,
    left: 12,
    alignItems: 'flex-end',
  },
  arrowRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 2,
  },
  callout: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  calloutHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  calloutTitle: { fontSize: 16, fontWeight: 'bold' },
  calloutText: { fontSize: 14, color: '#333', lineHeight: 20 },
  okBtn: {
    marginTop: 14,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  okBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default FirstLoginGuideHint;
