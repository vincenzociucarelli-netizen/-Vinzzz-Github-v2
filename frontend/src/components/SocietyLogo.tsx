import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface SocietyLogoProps {
  defaultSize?: number;
}

export default function SocietyLogo({ defaultSize = 40 }: SocietyLogoProps) {
  const [hasLogo, setHasLogo] = useState<boolean>(false);
  const [size, setSize] = useState<number>(defaultSize);
  const user = useAuthStore((state) => state.user);
  const societyIdQuery = user?.society_id ? `?society_id=${user.society_id}` : '';

  useEffect(() => {
    const loadLogo = async () => {
      try {
        // Light call (without base64) - just to know if a logo exists and its size
        const response = await api.get('/settings/society');
        if (response.data.logo_size) {
          setSize(response.data.logo_size);
        }
        // Check if society has a logo via HEAD to the dedicated endpoint
        // (response.data.logo will be null in the light response, so we probe the endpoint)
        try {
          const head = await fetch(
            `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/settings/society/logo.png${societyIdQuery}`,
            { method: 'HEAD' }
          );
          setHasLogo(head.ok);
        } catch {
          setHasLogo(false);
        }
      } catch (error) {
        // Silently fail - logo is optional
      }
    };
    loadLogo();
  }, [societyIdQuery]);

  if (!hasLogo) {
    return null;
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={{ uri: `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/settings/society/logo.png${societyIdQuery}` }}
        style={[styles.logo, { width: size, height: size, borderRadius: size / 2 }]}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  logo: {
    backgroundColor: '#fff',
  },
});
