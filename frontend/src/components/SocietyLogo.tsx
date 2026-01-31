import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import api from '../services/api';

interface SocietyLogoProps {
  size?: number;
}

export default function SocietyLogo({ size = 40 }: SocietyLogoProps) {
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await api.get('/settings/society');
        if (response.data.logo) {
          setLogo(response.data.logo);
        }
      } catch (error) {
        // Silently fail - logo is optional
      }
    };
    loadLogo();
  }, []);

  if (!logo) {
    return null;
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={{ uri: `data:image/jpeg;base64,${logo}` }}
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
