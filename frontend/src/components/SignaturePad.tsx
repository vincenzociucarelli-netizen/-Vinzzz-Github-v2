import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import ReactSignatureCanvas from 'react-signature-canvas';

interface SignaturePadProps {
  visible: boolean;
  onClose: () => void;
  onSign: (signatureBase64: string) => Promise<void>;
  documentTitle: string;
  documentText: string;
  signerName: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  visible,
  onClose,
  onSign,
  documentTitle,
  documentText,
  signerName,
}) => {
  const signatureRef = useRef<ReactSignatureCanvas>(null);
  const [signing, setSigning] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const handleClear = () => {
    signatureRef.current?.clear();
    setHasSignature(false);
  };

  const handleConfirm = async () => {
    if (!hasSignature) {
      return;
    }
    
    const signature = signatureRef.current?.toDataURL('image/png');
    if (signature) {
      setSigning(true);
      try {
        await onSign(signature);
        handleClear();
        onClose();
      } catch (error) {
        console.error('Error signing:', error);
      } finally {
        setSigning(false);
      }
    }
  };

  const handleSignatureEnd = () => {
    setHasSignature(true);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{documentTitle}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Document Text */}
          <View style={styles.documentContainer}>
            <Text style={styles.documentText}>{documentText}</Text>
          </View>

          {/* Signer Info */}
          <View style={styles.signerInfo}>
            <Text style={styles.signerLabel}>Firmato da:</Text>
            <Text style={styles.signerName}>{signerName}</Text>
            <Text style={styles.dateLabel}>
              Data: {new Date().toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          {/* Signature Area */}
          <View style={styles.signatureSection}>
            <Text style={styles.signatureLabel}>Firma qui sotto:</Text>
            <View style={styles.signatureBox}>
              <ReactSignatureCanvas
                ref={signatureRef}
                onEnd={handleSignatureEnd}
                canvasProps={{
                  style: {
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'white',
                  },
                }}
                backgroundColor="white"
                penColor="black"
              />
            </View>
            {!hasSignature && (
              <Text style={styles.signatureHint}>
                Usa il mouse o il dito per firmare
              </Text>
            )}
          </View>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={handleClear}
            >
              <Text style={styles.clearBtnText}>Cancella</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (!hasSignature || signing) && styles.disabledBtn,
              ]}
              onPress={handleConfirm}
              disabled={!hasSignature || signing}
            >
              {signing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmBtnText}>Conferma Firma</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  documentContainer: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  documentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  signerInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  signerLabel: {
    fontSize: 12,
    color: '#666',
  },
  signerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  dateLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  signatureSection: {
    padding: 16,
  },
  signatureLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  signatureBox: {
    height: 150,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  signatureHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  buttons: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  clearBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#34C759',
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  disabledBtn: {
    backgroundColor: '#ccc',
  },
});

export default SignaturePad;
