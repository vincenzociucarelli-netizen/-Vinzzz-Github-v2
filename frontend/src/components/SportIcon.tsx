import React, { useState, useEffect } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import api from '../services/api';

interface SportIconProps {
  size?: number;
  fallbackEmoji?: string;
  style?: any;
}

// Cache for society sport image to avoid multiple API calls
let cachedSportImage: string | null = null;
let cachePromise: Promise<string | null> | null = null;

const fetchSportImage = async (): Promise<string | null> => {
  if (cachedSportImage !== null) {
    return cachedSportImage;
  }
  
  if (cachePromise) {
    return cachePromise;
  }
  
  cachePromise = api.get('/settings/society')
    .then(response => {
      cachedSportImage = response.data?.sport_image || null;
      return cachedSportImage;
    })
    .catch(() => {
      cachedSportImage = null;
      return null;
    })
    .finally(() => {
      cachePromise = null;
    });
  
  return cachePromise;
};

// Function to clear cache (call when society settings change)
export const clearSportIconCache = () => {
  cachedSportImage = null;
  cachePromise = null;
};

export const SportIcon: React.FC<SportIconProps> = ({ 
  size = 24, 
  fallbackEmoji = '⚽',
  style 
}) => {
  const [sportImage, setSportImage] = useState<string | null>(cachedSportImage);
  const [loading, setLoading] = useState(!cachedSportImage);

  useEffect(() => {
    if (!cachedSportImage) {
      fetchSportImage().then(image => {
        setSportImage(image);
        setLoading(false);
      });
    }
  }, []);

  if (loading && !sportImage) {
    // Show fallback emoji while loading
    return (
      <Text style={[{ fontSize: size * 0.8 }, style]}>{fallbackEmoji}</Text>
    );
  }

  if (sportImage) {
    return (
      <Image 
        source={{ uri: `data:image/png;base64,${sportImage}` }}
        style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
      />
    );
  }

  // Fallback to emoji if no image
  return (
    <Text style={[{ fontSize: size * 0.8 }, style]}>{fallbackEmoji}</Text>
  );
};

export default SportIcon;
