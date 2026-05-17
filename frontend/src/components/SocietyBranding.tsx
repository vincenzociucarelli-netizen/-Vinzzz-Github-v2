import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface SocietyBrandingProps {
  /** Optional white/light variant for dark headers */
  light?: boolean;
  /** Logo size in px (default 32) */
  logoSize?: number;
  /** Optional override style on the wrapper */
  style?: any;
}

/**
 * Compact society branding row (logo + society name).
 * Use this just below the page title inside coloured headers so users
 * always know which society they are operating in.
 *
 * Caches society info in module scope to avoid repeated network calls
 * across pages.
 */
let cachedName: string | null = null;
let cachedLogoExists: boolean | null = null;
let inflight: Promise<void> | null = null;

export default function SocietyBranding({ light = true, logoSize = 28, style }: SocietyBrandingProps) {
  const [name, setName] = useState<string | null>(cachedName);
  const [hasLogo, setHasLogo] = useState<boolean>(cachedLogoExists ?? false);
  const user = useAuthStore((state) => state.user);
  const societyIdQuery = user?.society_id ? `?society_id=${user.society_id}` : '';

  useEffect(() => {
    if (cachedName !== null) return;
    if (inflight) {
      inflight.then(() => {
        setName(cachedName);
        setHasLogo(cachedLogoExists ?? false);
      });
      return;
    }
    inflight = (async () => {
      try {
        const res = await api.get('/settings/society');
        cachedName = res.data?.ragione_sociale || res.data?.name || null;
        try {
          const head = await fetch(
            `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/settings/society/logo.png${societyIdQuery}`,
            { method: 'HEAD' },
          );
          cachedLogoExists = head.ok;
        } catch {
          cachedLogoExists = false;
        }
      } catch {
        cachedName = null;
        cachedLogoExists = false;
      } finally {
        setName(cachedName);
        setHasLogo(cachedLogoExists ?? false);
        inflight = null;
      }
    })();
  }, [societyIdQuery]);

  if (!name && !hasLogo) return null;

  const textColor = light ? 'rgba(255,255,255,0.92)' : '#1a1a2e';

  return (
    <View style={[styles.row, style]} data-testid="society-branding">
      {hasLogo ? (
        <Image
          source={{ uri: `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/settings/society/logo.png${societyIdQuery}` }}
          style={{ width: logoSize, height: logoSize, borderRadius: logoSize / 2, backgroundColor: '#fff' }}
          resizeMode="cover"
        />
      ) : null}
      {name ? (
        <Text
          style={[styles.name, { color: textColor, fontSize: 13 }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {name}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexShrink: 1,
  },
  name: {
    fontWeight: '600',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
});
