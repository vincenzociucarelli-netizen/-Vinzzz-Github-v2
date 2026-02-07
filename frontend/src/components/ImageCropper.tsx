import React, { useState, useRef } from 'react';
import {
  View,
  Image,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  Alert,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

interface ImageCropperProps {
  visible: boolean;
  onClose: () => void;
  onImageSelected: (base64: string) => void;
  aspectRatio?: [number, number]; // [width, height]
  title?: string;
  circular?: boolean; // For profile photos
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CROP_SIZE = Math.min(SCREEN_WIDTH - 40, 350);

export default function ImageCropper({
  visible,
  onClose,
  onImageSelected,
  aspectRatio = [1, 1],
  title = 'Ritaglia Foto',
  circular = false,
}: ImageCropperProps) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [processing, setProcessing] = useState(false);
  
  // For pinch gesture
  const lastScale = useRef(1);
  const lastDistance = useRef(0);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);

  const getDistance = (touches: any[]) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        lastTranslateX.current = translateX;
        lastTranslateY.current = translateY;
        if (evt.nativeEvent.touches.length === 2) {
          lastDistance.current = getDistance(evt.nativeEvent.touches);
          lastScale.current = scale;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (evt.nativeEvent.touches.length === 2) {
          // Pinch zoom
          const distance = getDistance(evt.nativeEvent.touches);
          const newScale = lastScale.current * (distance / lastDistance.current);
          setScale(Math.max(0.5, Math.min(5, newScale)));
        } else {
          // Pan
          setTranslateX(lastTranslateX.current + gestureState.dx);
          setTranslateY(lastTranslateY.current + gestureState.dy);
        }
      },
      onPanResponderRelease: () => {
        lastScale.current = scale;
        lastTranslateX.current = translateX;
        lastTranslateY.current = translateY;
      },
    })
  ).current;

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permesso negato', 'È necessario il permesso per accedere alla galleria');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // We do our own cropping
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setImageSize({ width: asset.width || 800, height: asset.height || 800 });
        // Reset transforms
        setScale(1);
        setTranslateX(0);
        setTranslateY(0);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Errore', 'Impossibile selezionare l\'immagine');
    }
  };

  const takePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permesso negato', 'È necessario il permesso per usare la fotocamera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setImageSize({ width: asset.width || 800, height: asset.height || 800 });
        setScale(1);
        setTranslateX(0);
        setTranslateY(0);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Errore', 'Impossibile scattare la foto');
    }
  };

  const handleCrop = async () => {
    if (!imageUri) return;

    setProcessing(true);
    try {
      // Calculate crop region based on current scale and translation
      const displayWidth = CROP_SIZE;
      const displayHeight = CROP_SIZE * (aspectRatio[1] / aspectRatio[0]);
      
      // The visible area in image coordinates
      const imageScale = Math.min(
        displayWidth / imageSize.width,
        displayHeight / imageSize.height
      ) * scale;
      
      const scaledWidth = imageSize.width * imageScale;
      const scaledHeight = imageSize.height * imageScale;
      
      // Center offset
      const centerOffsetX = (displayWidth - scaledWidth) / 2 + translateX;
      const centerOffsetY = (displayHeight - scaledHeight) / 2 + translateY;
      
      // Crop origin in original image coordinates
      const cropX = Math.max(0, (-centerOffsetX) / imageScale);
      const cropY = Math.max(0, (-centerOffsetY) / imageScale);
      const cropWidth = Math.min(imageSize.width - cropX, displayWidth / imageScale);
      const cropHeight = Math.min(imageSize.height - cropY, displayHeight / imageScale);

      // Perform crop and resize
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: Math.round(cropX),
              originY: Math.round(cropY),
              width: Math.round(cropWidth),
              height: Math.round(cropHeight),
            },
          },
          {
            resize: {
              width: 800,
              height: Math.round(800 * (aspectRatio[1] / aspectRatio[0])),
            },
          },
        ],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (manipResult.base64) {
        onImageSelected(manipResult.base64);
        handleClose();
      }
    } catch (error) {
      console.error('Crop error:', error);
      Alert.alert('Errore', 'Impossibile ritagliare l\'immagine');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setImageUri(null);
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    onClose();
  };

  const zoomIn = () => setScale(Math.min(5, scale + 0.5));
  const zoomOut = () => setScale(Math.max(0.5, scale - 0.5));
  const resetTransform = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  };

  if (!visible) return null;

  const cropHeight = CROP_SIZE * (aspectRatio[1] / aspectRatio[0]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>

        {!imageUri ? (
          // Image selection
          <View style={styles.selectionContainer}>
            <Text style={styles.selectionTitle}>Seleziona un'immagine</Text>
            <Text style={styles.selectionSubtitle}>
              Scegli dalla galleria o scatta una foto
            </Text>
            
            <View style={styles.selectionButtons}>
              <TouchableOpacity style={styles.selectionBtn} onPress={pickImage}>
                <View style={styles.selectionBtnIcon}>
                  <Ionicons name="images" size={40} color="#007AFF" />
                </View>
                <Text style={styles.selectionBtnText}>Galleria</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.selectionBtn} onPress={takePhoto}>
                <View style={styles.selectionBtnIcon}>
                  <Ionicons name="camera" size={40} color="#34C759" />
                </View>
                <Text style={styles.selectionBtnText}>Fotocamera</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Cropping interface
          <View style={styles.cropContainer}>
            {/* Instructions */}
            <View style={styles.instructions}>
              <Text style={styles.instructionText}>
                📌 Pizzica per zoomare • Trascina per spostare
              </Text>
            </View>

            {/* Crop area */}
            <View 
              style={[
                styles.cropArea, 
                { width: CROP_SIZE, height: cropHeight },
                circular && styles.cropAreaCircular
              ]}
              {...panResponder.panHandlers}
            >
              <Image
                source={{ uri: imageUri }}
                style={{
                  width: imageSize.width,
                  height: imageSize.height,
                  transform: [
                    { translateX },
                    { translateY },
                    { scale },
                  ],
                }}
                resizeMode="contain"
              />
              
              {/* Overlay mask */}
              {circular && (
                <View style={styles.circularMask} pointerEvents="none" />
              )}
            </View>

            {/* Zoom controls */}
            <View style={styles.zoomControls}>
              <TouchableOpacity style={styles.zoomBtn} onPress={zoomOut}>
                <Ionicons name="remove" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.zoomText}>{Math.round(scale * 100)}%</Text>
              <TouchableOpacity style={styles.zoomBtn} onPress={zoomIn}>
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.resetBtn} onPress={resetTransform}>
                <Ionicons name="refresh" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Action buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.changeImageBtn}
                onPress={() => setImageUri(null)}
              >
                <Ionicons name="images-outline" size={20} color="#007AFF" />
                <Text style={styles.changeImageText}>Cambia immagine</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.cropBtn, processing && styles.cropBtnDisabled]}
                onPress={handleCrop}
                disabled={processing}
              >
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.cropBtnText}>
                  {processing ? 'Elaborazione...' : 'CONFERMA RITAGLIO'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 15,
    paddingBottom: 15,
    backgroundColor: '#000',
  },
  headerBtn: {
    padding: 5,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  selectionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  selectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  selectionSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 40,
    textAlign: 'center',
  },
  selectionButtons: {
    flexDirection: 'row',
    gap: 30,
  },
  selectionBtn: {
    alignItems: 'center',
  },
  selectionBtnIcon: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  cropContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
  },
  instructions: {
    marginBottom: 15,
  },
  instructionText: {
    color: '#888',
    fontSize: 14,
  },
  cropArea: {
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 3,
    borderColor: '#007AFF',
    borderRadius: 8,
  },
  cropAreaCircular: {
    borderRadius: 9999,
  },
  circularMask: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: '#fff',
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 15,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'center',
  },
  resetBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  actionButtons: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    gap: 15,
  },
  changeImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  changeImageText: {
    color: '#007AFF',
    fontSize: 16,
  },
  cropBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  cropBtnDisabled: {
    opacity: 0.6,
  },
  cropBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
