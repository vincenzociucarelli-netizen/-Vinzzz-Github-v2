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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  PanGestureHandler,
  GestureHandlerStateChangeEvent,
  State,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

interface PhotoViewerProps {
  visible: boolean;
  photo: string | null; // base64 or URI
  title?: string;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PhotoViewer({ visible, photo, title, onClose }: PhotoViewerProps) {
  const [isLandscape, setIsLandscape] = useState(false);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetTransform = () => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const onPinchGestureEvent = (event: any) => {
    scale.value = savedScale.value * event.nativeEvent.scale;
  };

  const onPinchHandlerStateChange = (event: GestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.state === State.END) {
      savedScale.value = scale.value;
      // Limit scale
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      } else if (scale.value > 5) {
        scale.value = withSpring(5);
        savedScale.value = 5;
      }
    }
  };

  const onPanGestureEvent = (event: any) => {
    translateX.value = savedTranslateX.value + event.nativeEvent.translationX;
    translateY.value = savedTranslateY.value + event.nativeEvent.translationY;
  };

  const onPanHandlerStateChange = (event: GestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.state === State.END) {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    }
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

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
    resetTransform();
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
      <GestureHandlerRootView style={[styles.container, isLandscape && styles.containerLandscape]}>
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

        {/* Image with gestures */}
        <PanGestureHandler
          onGestureEvent={onPanGestureEvent}
          onHandlerStateChange={onPanHandlerStateChange}
          minDist={10}
        >
          <Animated.View style={styles.imageWrapper}>
            <PinchGestureHandler
              onGestureEvent={onPinchGestureEvent}
              onHandlerStateChange={onPinchHandlerStateChange}
            >
              <Animated.View style={[styles.imageContainer, animatedStyle]}>
                <Image
                  source={getImageSource()}
                  style={[
                    styles.image,
                    isLandscape && styles.imageLandscape
                  ]}
                  resizeMode="contain"
                />
              </Animated.View>
            </PinchGestureHandler>
          </Animated.View>
        </PanGestureHandler>

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
              📌 Pizzica per zoomare • Trascina per spostare • Tocca 🔲 per schermo intero
            </Text>
          </View>
        )}

        {/* Double tap to reset */}
        <TouchableOpacity
          style={styles.resetButton}
          onPress={resetTransform}
        >
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </GestureHandlerRootView>
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
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
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
  resetButton: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 20,
  },
});
