import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Image,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from './Icon';

interface PhotoViewerProps {
  visible: boolean;
  photo: string | null;
  title?: string;
  onClose: () => void;
}

export default function PhotoViewer({ visible, photo, title, onClose }: PhotoViewerProps) {
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  // Pinch state refs (avoid re-renders during gesture)
  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(1);
  const panStartX = useRef(0);
  const panStartY = useRef(0);
  const panStartTransX = useRef(0);
  const panStartTransY = useRef(0);
  const activeTouches = useRef(0);
  const containerRef = useRef<any>(null);

  // Listen to dimension changes (phone rotation)
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => sub?.remove();
  }, []);

  // Reset on open
  useEffect(() => {
    if (visible) {
      setScale(1);
      setTranslateX(0);
      setTranslateY(0);
    }
  }, [visible]);

  const getImageSource = () => {
    if (!photo) return undefined;
    if (photo.startsWith('data:')) return { uri: photo };
    if (photo.startsWith('http')) return { uri: photo };
    return { uri: `data:image/jpeg;base64,${photo}` };
  };

  const resetView = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  };

  const handleClose = () => {
    resetView();
    onClose();
  };

  const handleDownload = () => {
    if (Platform.OS === 'web' && photo) {
      const link = document.createElement('a');
      if (photo.startsWith('data:')) {
        link.href = photo;
      } else if (photo.startsWith('http')) {
        link.href = photo;
      } else {
        link.href = `data:image/jpeg;base64,${photo}`;
      }
      link.download = `${title || 'foto'}.jpg`;
      link.click();
    }
  };

  // ===== WEB TOUCH/GESTURE HANDLERS =====
  const getTouchDist = (touches: any) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = useCallback((e: any) => {
    const touches = e.touches || e.nativeEvent?.touches;
    if (!touches) return;
    activeTouches.current = touches.length;

    if (touches.length === 2) {
      // Pinch start
      e.preventDefault?.();
      pinchStartDist.current = getTouchDist(touches);
      pinchStartScale.current = scale;
    } else if (touches.length === 1 && scale > 1) {
      // Pan start (only when zoomed)
      panStartX.current = touches[0].clientX;
      panStartY.current = touches[0].clientY;
      panStartTransX.current = translateX;
      panStartTransY.current = translateY;
    }
  }, [scale, translateX, translateY]);

  const onTouchMove = useCallback((e: any) => {
    const touches = e.touches || e.nativeEvent?.touches;
    if (!touches) return;

    if (touches.length === 2) {
      // Pinch zoom
      e.preventDefault?.();
      const dist = getTouchDist(touches);
      if (pinchStartDist.current > 0) {
        const newScale = Math.min(Math.max(pinchStartScale.current * (dist / pinchStartDist.current), 0.5), 6);
        setScale(newScale);
        // Reset pan if zooming out to 1
        if (newScale <= 1) {
          setTranslateX(0);
          setTranslateY(0);
        }
      }
    } else if (touches.length === 1 && activeTouches.current === 1 && scale > 1) {
      // Pan (only when zoomed in)
      const dx = touches[0].clientX - panStartX.current;
      const dy = touches[0].clientY - panStartY.current;
      setTranslateX(panStartTransX.current + dx);
      setTranslateY(panStartTransY.current + dy);
    }
  }, [scale]);

  const onTouchEnd = useCallback((e: any) => {
    const touches = e.touches || e.nativeEvent?.touches;
    activeTouches.current = touches ? touches.length : 0;
    // Snap back if zoomed out too much
    if (scale < 1) {
      setScale(1);
      setTranslateX(0);
      setTranslateY(0);
    }
  }, [scale]);

  // Mouse wheel zoom for desktop
  const onWheel = Platform.OS === 'web' ? (e: any) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    const newScale = Math.min(Math.max(scale + delta, 0.5), 6);
    setScale(newScale);
    if (newScale <= 1) {
      setTranslateX(0);
      setTranslateY(0);
    }
  } : undefined;

  // Double tap to zoom/reset
  const lastTap = useRef(0);
  const onDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap
      if (scale > 1.2) {
        resetView();
      } else {
        setScale(2.5);
      }
    }
    lastTap.current = now;
  }, [scale]);

  if (!visible || !photo) return null;

  const isLandscape = dimensions.width > dimensions.height;
  const imgWidth = dimensions.width;
  const imgHeight = dimensions.height - 100; // Leave room for header

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={handleClose}
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <StatusBar hidden />
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, isLandscape && styles.headerLandscape]}>
          <TouchableOpacity onPress={handleClose} style={styles.headerBtn} data-testid="photo-viewer-close">
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title || 'Foto'}
          </Text>
          <View style={styles.headerActions}>
            {scale > 1.05 && (
              <TouchableOpacity onPress={resetView} style={styles.headerBtn} data-testid="photo-viewer-reset">
                <Text style={styles.zoomBadge}>{Math.round(scale * 100)}%</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleDownload} style={styles.headerBtn} data-testid="photo-viewer-download">
              <Ionicons name="download-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Image area with gesture handling */}
        <View
          style={styles.imageArea}
          ref={containerRef}
          {...(Platform.OS === 'web' ? {
            onTouchStart,
            onTouchMove,
            onTouchEnd,
            onWheel,
          } : {})}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={onDoubleTap}
            style={styles.imageTouchable}
          >
            <Image
              source={getImageSource()}
              style={[
                {
                  width: imgWidth,
                  height: imgHeight,
                },
                Platform.OS === 'web' ? {
                  transform: `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`,
                  transition: activeTouches.current > 0 ? 'none' : 'transform 0.2s ease',
                  touchAction: 'none',
                } as any : {
                  transform: [
                    { scale },
                    { translateX: translateX / scale },
                    { translateY: translateY / scale },
                  ],
                },
              ]}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Hint text - only when not zoomed */}
        {scale <= 1.05 && (
          <View style={styles.hintBar}>
            <Text style={styles.hintText}>
              {Platform.OS === 'web' ? 'Pizzica per zoomare · Doppio tap per ingrandire · Ruota il telefono' : 'Pizzica per zoomare · Doppio tap per ingrandire'}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 10,
  },
  headerLandscape: {
    paddingTop: 8,
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoomBadge: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  imageArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imageTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintBar: {
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  hintText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
});
