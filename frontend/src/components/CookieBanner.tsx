/**
 * CookieBanner
 *
 * GDPR cookie banner mostrato la prima volta che l'utente visita il sito web.
 * La scelta viene salvata in localStorage (`registrateam_cookie_consent_v1`).
 *
 * Poiché RegistraTEAM usa SOLO cookie tecnici strettamente necessari
 * (autenticazione/sessione), il banner serve principalmente a informare
 * l'utente come richiesto dal Provvedimento del Garante Privacy 10/06/2021.
 *
 * Choices:
 *   - "accept_all": accetta tutti (tecnici + analitici futuri)
 *   - "reject": solo strettamente necessari
 *   - "customize": (futuro, oggi equivale ad "accept necessary")
 */
import React, { useEffect, useState } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

const STORAGE_KEY = 'registrateam_cookie_consent_v1';

export default function CookieBanner() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (!v) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const setChoice = (choice: 'accept_all' | 'reject') => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ choice, timestamp: new Date().toISOString(), version: 'v1' })
      );
    } catch {}
    setVisible(false);
  };

  if (!visible || Platform.OS !== 'web') return null;

  return (
    <View style={styles.wrap as any} data-testid="cookie-banner">
      <View style={styles.inner}>
        <View style={{ flex: 1, minWidth: 260 }}>
          <Text style={styles.title}>🍪 Cookie & Privacy</Text>
          <Text style={styles.text}>
            Utilizziamo solo <Text style={styles.bold}>cookie tecnici strettamente necessari</Text> al funzionamento dell'app (autenticazione, sessione). Non usiamo cookie di profilazione o marketing. Continuando accetti le nostre{' '}
            <Text style={styles.link} onPress={() => router.push('/privacy-policy')}>Informativa Privacy</Text>{' '}
            e i{' '}
            <Text style={styles.link} onPress={() => router.push('/terms-of-use')}>Termini di Utilizzo</Text>.
          </Text>
        </View>
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => setChoice('reject')}
            data-testid="cookie-only-necessary"
          >
            <Text style={styles.btnSecondaryText}>Solo necessari</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => setChoice('accept_all')}
            data-testid="cookie-accept-all"
          >
            <Text style={styles.btnPrimaryText}>Accetta tutti</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'fixed' as any,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    backgroundColor: '#0D47A1',
    borderTopWidth: 3,
    borderTopColor: '#64B5F6',
    paddingHorizontal: 16,
    paddingVertical: 14,
    boxShadow: '0 -4px 20px rgba(0,0,0,0.35)' as any,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    flexWrap: 'wrap',
  },
  title: { color: '#fff', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  text: { color: 'rgba(255,255,255,0.92)', fontSize: 12.5, lineHeight: 18 },
  bold: { fontWeight: '700', color: '#fff' },
  link: { color: '#FFEB3B', fontWeight: '700', textDecorationLine: 'underline' },
  btnRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#fff' },
  btnSecondaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnPrimary: { backgroundColor: '#fff' },
  btnPrimaryText: { color: '#0D47A1', fontWeight: '800', fontSize: 13 },
});
