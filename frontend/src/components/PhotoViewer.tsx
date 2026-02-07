import React, { useState } from 'react';
import {
  View,
  Image,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  Share,
  Platform,
  Alert,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface PhotoViewerProps {
  visible: boolean;
  photo: string | null; // base64 or URI
  title?: string;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PhotoViewer({ visible, photo, title, onClose }: PhotoViewerProps) {
  const [isLandscape, setIsLandscape] = useState(false);

  const handleShare = async () => {
    if (!photo) return;

    try {
      // Prepare the image
      let imageUri = photo;
      
      // If it's base64, we need to save it temporarily
      if (photo.startsWith('data:') || !photo.startsWith('http')) {
        const base64Data = photo.replace(/^data:image\/\w+;base64,/, '');
        const filename = `${FileSystem.cacheDirectory}shared_photo_${Date.now()}.jpg`;
        await FileSystem.writeAsStringAsync(filename, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        imageUri = filename;
      }

      if (Platform.OS === 'web') {
        // Web sharing
        if (navigator.share) {
          await navigator.share({
            title: title || 'Foto',
            text: 'Condividi foto',
          });
        } else {
          Alert.alert('Info', 'Condivisione non supportata su questo browser');
        }
      } else {
        // Mobile sharing
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(imageUri, {
            mimeType: 'image/jpeg',
            dialogTitle: title || 'Condividi foto',
          });
        } else {
          Alert.alert('Errore', 'Condivisione non disponibile');
        }
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Errore', 'Impossibile condividere la foto');
    }
  };

  const toggleFullscreen = () => {
    setIsLandscape(!isLandscape);
  };

  const getImageSource = () => {
    if (!photo) return undefined;
    if (photo.startsWith('data:')) {
      return { uri: photo };
    }
    if (photo.startsWith('http')) {
      return { uri: photo };
    }
    // Assume base64 without prefix
    return { uri: `data:image/jpeg;base64,${photo}` };
  };

  if (!visible || !photo) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
      statusBarTranslucent
    >
      <StatusBar hidden={isLandscape} />
      <View style={[styles.container, isLandscape && styles.containerLandscape]}>
        {/* Header */}
        {!isLandscape && (
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title || 'Foto'}
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleShare} style={styles.headerBtn}>
                <Ionicons name="share-outline" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleFullscreen} style={styles.headerBtn}>
                <Ionicons name="expand-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Image with ScrollView for zoom */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          maximumZoomScale={5}
          minimumZoomScale={1}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          centerContent={true}
          bouncesZoom={true}
        >
          <Image
            source={getImageSource()}
            style={[
              styles.image,
              isLandscape && styles.imageLandscape
            ]}
            resizeMode="contain"
          />
        </ScrollView>

        {/* Fullscreen controls */}
        {isLandscape && (
          <View style={styles.fullscreenControls}>
            <TouchableOpacity onPress={toggleFullscreen} style={styles.fullscreenBtn}>
              <Ionicons name="contract-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.fullscreenBtn}>
              <Ionicons name="share-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.fullscreenBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Instructions */}
        {!isLandscape && (
          <View style={styles.instructions}>
            <Text style={styles.instructionText}>
              📌 Pizzica per zoomare • Tocca 🔲 per schermo intero
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  containerLandscape: {
    flexDirection: 'row',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 10,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 150,
  },
  imageLandscape: {
    width: SCREEN_HEIGHT,
    height: SCREEN_WIDTH,
  },
  fullscreenControls: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    gap: 15,
  },
  fullscreenBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 20,
  },
  instructions: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  instructionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
  },
});
