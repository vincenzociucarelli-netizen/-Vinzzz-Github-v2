/**
 * 🆕 08/07/2026 — Mini logo persistente per tab bar.
 *
 * Rende SOLO l'immagine del logo società (senza nome/badge), formato circolare,
 * pensato per la barra tab in modo che il branding sia sempre visibile anche
 * quando l'header è fuori vista.
 *
 * Condivide la logica di cache HEAD con SocietyBranding (retry automatico se
 * il logo non era stato caricato al primo mount).
 */
import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';

interface Props {
  size?: number;
  style?: any;
}

let cachedLogoExists: boolean | null = null;
let inflight: Promise<void> | null = null;

export default function MiniSocietyLogo({ size = 28, style }: Props) {
  const [hasLogo, setHasLogo] = useState<boolean>(cachedLogoExists ?? false);
  const user = useAuthStore((state) => state.user);
  const societyIdQuery = user?.society_id ? `?society_id=${user.society_id}` : '';

  useEffect(() => {
    const shouldRefresh = cachedLogoExists === null || cachedLogoExists === false;
    if (!shouldRefresh) return;
    if (inflight) {
      inflight.then(() => setHasLogo(cachedLogoExists ?? false));
      return;
    }
    inflight = (async () => {
      try {
        const head = await fetch(
          `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/settings/society/logo.png${societyIdQuery}`,
          { method: 'HEAD' },
        );
        cachedLogoExists = head.ok;
      } catch {
        cachedLogoExists = false;
      } finally {
        setHasLogo(cachedLogoExists ?? false);
        inflight = null;
      }
    })();
  }, [societyIdQuery]);

  if (!hasLogo) return null;

  return (
    <View style={[styles.wrapper, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <Image
        source={{ uri: `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/settings/society/logo.png${societyIdQuery}` }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
});
