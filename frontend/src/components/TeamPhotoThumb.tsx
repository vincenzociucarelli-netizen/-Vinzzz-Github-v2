import React, { useState } from 'react';
import { Image, Modal, TouchableOpacity, StyleSheet, Pressable, View } from 'react-native';
import { Ionicons } from './Icon';

interface Props {
  uri?: string | null;
  size?: number;
  radius?: number;
  fallback?: React.ReactNode;
}

/**
 * Miniatura foto squadra: piccola icona che si ingrandisce a schermo intero con un tocco.
 * Se non c'è foto, mostra `fallback`.
 */
export default function TeamPhotoThumb({ uri, size = 48, radius = 10, fallback = null }: Props) {
  const [open, setOpen] = useState(false);
  if (!uri) return <>{fallback}</>;
  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius }} />
        <View style={styles.badge}>
          <Ionicons name="expand" size={10} color="#fff" />
        </View>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Image source={{ uri }} style={styles.full} resizeMode="contain" />
          <TouchableOpacity style={styles.close} onPress={() => setOpen(false)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute', right: -2, bottom: -2,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8,
    width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  full: { width: '92%', height: '72%' },
  close: { position: 'absolute', top: 48, right: 24, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
