import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';

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
  const signatureRef = useRef<any>(null);
  const [signing, setSigning] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setHasSignature(false);
  };

  const handleConfirm = async () => {
    if (!hasSignature) {
      return;
    }
    
    signatureRef.current?.readSignature();
  };

  const handleSignatureEnd = () => {
    setHasSignature(true);
  };

  const handleSignatureData = async (signature: string) => {
    if (!signature || signature === 'data:,') {
      return;
    }
    
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
  };

  const webStyle = `.m-signature-pad {
    box-shadow: none;
    border: none;
    width: 100%;
    height: 100%;
  }
  .m-signature-pad--body {
    border: none;
  }
  .m-signature-pad--footer {
    display: none;
  }
  body, html {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
  }
  canvas {
    width: 100% !important;
    height: 100% !important;
  }`;

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
              {Platform.OS === 'web' ? (
                <SignatureCanvas
                  ref={signatureRef}
                  onEnd={handleSignatureEnd}
                  onOK={handleSignatureData}
                  webStyle={webStyle}
                  backgroundColor="white"
                  penColor="black"
                  dotSize={2}
                  minWidth={1}
                  maxWidth={3}
                />
              ) : (
                <SignatureCanvas
                  ref={signatureRef}
                  onEnd={handleSignatureEnd}
                  onOK={handleSignatureData}
                  backgroundColor="white"
                  penColor="black"
                  dotSize={2}
                  minWidth={1}
                  maxWidth={3}
                />
              )}
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
                <Text style={styles.confirmBtnText}>Conferma e Firma</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Legal Notice */}
          <Text style={styles.legalNotice}>
            Firmando questo documento confermi di aver letto e accettato il contenuto.
            Una copia del documento firmato verrà inviata via email.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '95%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeBtn: {
    padding: 8,
  },
  closeBtnText: {
    fontSize: 20,
    color: '#666',
  },
  documentContainer: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    maxHeight: 150,
  },
  documentText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
  },
  signerInfo: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  signerLabel: {
    fontSize: 12,
    color: '#666',
  },
  signerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginTop: 2,
  },
  dateLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  signatureSection: {
    marginBottom: 16,
  },
  signatureLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  signatureBox: {
    height: 150,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    borderStyle: 'dashed',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  signatureHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 6,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  clearBtn: {
    flex: 1,
    padding: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    alignItems: 'center',
  },
  clearBtnText: {
    fontSize: 16,
    color: '#666',
  },
  confirmBtn: {
    flex: 2,
    padding: 14,
    backgroundColor: '#34C759',
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  legalNotice: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default SignaturePad;
