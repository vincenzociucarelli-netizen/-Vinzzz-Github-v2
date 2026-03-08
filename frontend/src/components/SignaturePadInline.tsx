import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

// Web-only imports
let SignatureCanvasWeb: any = null;
if (Platform.OS === 'web') {
  SignatureCanvasWeb = require('react-signature-canvas').default;
}

// Native import
let SignatureCanvasNative: any = null;
if (Platform.OS !== 'web') {
  SignatureCanvasNative = require('react-native-signature-canvas').default;
}

interface SignaturePadInlineProps {
  onSave?: (signature: string) => void;
  onClear?: () => void;
  width?: number;
  height?: number;
  penColor?: string;
  backgroundColor?: string;
}

export interface SignaturePadInlineRef {
  clear: () => void;
  toDataURL: () => string | null;
}

const SignaturePadInline = forwardRef<SignaturePadInlineRef, SignaturePadInlineProps>(
  ({ onSave, onClear, width, height = 200, penColor = 'black', backgroundColor = 'white' }, ref) => {
    const webCanvasRef = useRef<any>(null);
    const nativeCanvasRef = useRef<any>(null);
    const [isEmpty, setIsEmpty] = useState(true);
    const containerRef = useRef<any>(null);
    const [containerWidth, setContainerWidth] = useState(width || 350);

    useEffect(() => {
      // Update width on resize for web
      if (Platform.OS === 'web' && containerRef.current) {
        const updateWidth = () => {
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect?.();
            if (rect && rect.width > 0) {
              setContainerWidth(rect.width - 4); // -4 for border
            }
          }
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
      }
    }, []);

    useImperativeHandle(ref, () => ({
      clear: () => {
        if (Platform.OS === 'web' && webCanvasRef.current) {
          webCanvasRef.current.clear();
        } else if (nativeCanvasRef.current) {
          nativeCanvasRef.current.clearSignature();
        }
        setIsEmpty(true);
        onClear?.();
      },
      toDataURL: () => {
        if (Platform.OS === 'web' && webCanvasRef.current) {
          if (webCanvasRef.current.isEmpty()) return null;
          return webCanvasRef.current.toDataURL('image/png');
        } else if (nativeCanvasRef.current) {
          nativeCanvasRef.current.readSignature();
          return null; // Native returns via callback
        }
        return null;
      },
    }));

    const handleWebEnd = () => {
      console.log('handleWebEnd called');
      if (webCanvasRef.current) {
        const isEmpty = webCanvasRef.current.isEmpty();
        console.log('Canvas isEmpty:', isEmpty);
        if (!isEmpty) {
          setIsEmpty(false);
          const dataUrl = webCanvasRef.current.toDataURL('image/png');
          console.log('Signature dataUrl length:', dataUrl?.length || 0);
          onSave?.(dataUrl);
        }
      }
    };

    const handleNativeEnd = () => {
      setIsEmpty(false);
      // Automatically read and save signature when user finishes drawing
      if (nativeCanvasRef.current) {
        nativeCanvasRef.current.readSignature();
      }
    };

    const handleNativeOK = (signature: string) => {
      if (signature && signature !== 'data:,') {
        onSave?.(signature);
      }
    };

    const handleClear = () => {
      if (Platform.OS === 'web' && webCanvasRef.current) {
        webCanvasRef.current.clear();
      } else if (nativeCanvasRef.current) {
        nativeCanvasRef.current.clearSignature();
      }
      setIsEmpty(true);
      onClear?.();
    };

    const webStyle = `
      .m-signature-pad { box-shadow: none; border: none; width: 100%; height: 100%; }
      .m-signature-pad--body { border: none; }
      .m-signature-pad--footer { display: none; }
      body, html { width: 100%; height: 100%; margin: 0; padding: 0; }
      canvas { width: 100% !important; height: 100% !important; }
    `;

    if (Platform.OS === 'web') {
      return (
        <View style={styles.container}>
          <View 
            ref={containerRef}
            style={[styles.canvasContainer, { height }]}
          >
            {SignatureCanvasWeb && (
              <SignatureCanvasWeb
                ref={webCanvasRef}
                onEnd={handleWebEnd}
                penColor={penColor}
                backgroundColor={backgroundColor}
                canvasProps={{
                  width: containerWidth,
                  height: height - 4,
                  style: { 
                    width: '100%', 
                    height: '100%',
                    borderRadius: 8,
                  },
                }}
              />
            )}
          </View>
          <Text style={styles.hint}>
            {isEmpty ? 'Usa il mouse o il dito per firmare' : 'Firma registrata'}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 8 }}>
            {/* Manual confirm button for mobile */}
            <TouchableOpacity 
              style={[styles.clearBtn, { backgroundColor: isEmpty ? '#ccc' : '#34C759' }]} 
              onPress={() => {
                if (webCanvasRef.current && !webCanvasRef.current.isEmpty()) {
                  setIsEmpty(false);
                  const dataUrl = webCanvasRef.current.toDataURL('image/png');
                  console.log('Manual confirm - signature length:', dataUrl?.length);
                  onSave?.(dataUrl);
                }
              }}
              disabled={isEmpty}
            >
              <Text style={[styles.clearBtnText, { color: isEmpty ? '#666' : '#fff' }]}>Conferma firma</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearBtnText}>Cancella firma</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Native implementation
    return (
      <View style={styles.container}>
        <View style={[styles.canvasContainer, { height }]}>
          {SignatureCanvasNative && (
            <SignatureCanvasNative
              ref={nativeCanvasRef}
              onEnd={handleNativeEnd}
              onOK={handleNativeOK}
              backgroundColor={backgroundColor}
              penColor={penColor}
              webStyle={webStyle}
              dotSize={2}
              minWidth={1}
              maxWidth={3}
            />
          )}
        </View>
        <Text style={styles.hint}>
          {isEmpty ? 'Usa il dito per firmare' : 'Firma registrata'}
        </Text>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearBtnText}>Cancella firma</Text>
        </TouchableOpacity>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  canvasContainer: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    borderStyle: 'dashed',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  clearBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    marginTop: 12,
  },
  clearBtnText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
  },
});

export default SignaturePadInline;
