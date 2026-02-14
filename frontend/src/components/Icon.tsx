// Cross-platform Icon component that works reliably on web and mobile
import React, { useEffect } from 'react';
import { Platform, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Load Ionicons font via CDN for web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const ioniconsCSS = `
    @font-face {
      font-family: 'Ionicons';
      src: url('https://unpkg.com/ionicons@7.1.0/dist/fonts/ionicons.woff2') format('woff2'),
           url('https://unpkg.com/ionicons@7.1.0/dist/fonts/ionicons.woff') format('woff'),
           url('https://unpkg.com/ionicons@7.1.0/dist/fonts/ionicons.ttf') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
  `;
  
  // Check if style already exists
  if (!document.getElementById('ionicons-font-face')) {
    const style = document.createElement('style');
    style.id = 'ionicons-font-face';
    style.textContent = ioniconsCSS;
    document.head.appendChild(style);
  }
}

interface IconProps {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  style?: any;
}

export const Icon: React.FC<IconProps> = ({ name, size = 24, color = '#000', style }) => {
  return <Ionicons name={name} size={size} color={color} style={style} />;
};

export default Icon;
