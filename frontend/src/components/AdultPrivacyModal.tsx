import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import ReactSignatureCanvas from 'react-signature-canvas';
import { Ionicons } from './Icon';

interface AdultPrivacyModalProps {
  visible: boolean;
  onClose: () => void;
  onSign: (signatureBase64: string) => Promise<void>;
  signerName: string;
  signerRole: 'athlete' | 'coach' | 'dirigente';
  societyName?: string;
}

const getRoleLabel = (role: string): string => {
  switch (role) {
    case 'athlete': return 'atleta';
    case 'coach': return 'allenatore/tecnico';
    case 'dirigente': return 'dirigente';
    default: return 'collaboratore';
  }
};

export const AdultPrivacyModal: React.FC<AdultPrivacyModalProps> = ({
  visible,
  onClose,
  onSign,
  signerName,
  signerRole,
  societyName = 'PALLAVOLO PERUGIA SSD A RL',
}) => {
  const signatureRef = useRef<ReactSignatureCanvas>(null);
  const [signing, setSigning] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const handleClear = () => {
    signatureRef.current?.clear();
    setHasSignature(false);
  };

  const handleConfirm = async () => {
    if (!hasSignature || !signatureRef.current) {
      return;
    }
    
    // Check if signature canvas is empty
    if (signatureRef.current.isEmpty()) {
      alert('Per favore, firma nel riquadro prima di confermare.');
      return;
    }
    
    // Get signature with higher quality
    const signature = signatureRef.current.getTrimmedCanvas().toDataURL('image/png');
    
    // Verify the signature has actual content (not just 1x1 pixel)
    const canvas = signatureRef.current.getTrimmedCanvas();
    if (canvas.width < 10 || canvas.height < 10) {
      alert('La firma è troppo piccola. Per favore, firma in modo più visibile.');
      return;
    }
    
    if (signature) {
      setSigning(true);
      try {
        await onSign(signature);
        handleClear();
        onClose();
      } catch (error) {
        console.error('Error signing privacy:', error);
      } finally {
        setSigning(false);
      }
    }
  };

  const handleSignatureEnd = () => {
    // Verify signature is not empty before setting hasSignature
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      setHasSignature(true);
    }
  };

  const roleLabel = getRoleLabel(signerRole);

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
            <View style={styles.headerContent}>
              <Ionicons name="shield-checkmark" size={24} color="#007AFF" />
              <Text style={styles.title}>Conferma Privacy e Liberatoria</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
            {/* Welcome message */}
            <View style={styles.welcomeBox}>
              <Text style={styles.welcomeText}>
                Benvenuto/a {signerName}! {'\n\n'}
                Per completare la tua iscrizione come {roleLabel} presso {societyName}, 
                ti chiediamo gentilmente di leggere e firmare l'informativa sulla privacy.
              </Text>
            </View>

            {/* Document Title */}
            <Text style={styles.documentTitle}>INFORMATIVA PRIVACY E LIBERATORIA</Text>
            <Text style={styles.documentSubtitle}>
              (ai sensi del Reg. UE 2016/679 - GDPR e D.Lgs. 196/2003)
            </Text>

            {/* Privacy Content */}
            <View style={styles.documentContent}>
              <Text style={styles.sectionTitle}>LIBERATORIA</Text>
              <Text style={styles.documentText}>
                Il/La sottoscritto/a <Text style={styles.bold}>{signerName}</Text>, 
                in qualità di {roleLabel} della società sportiva {societyName}:
              </Text>

              <Text style={styles.sectionTitle}>DICHIARA</Text>
              <Text style={styles.documentText}>
                di essere stato/a informato/a e di aver preso visione dell'informativa ai sensi 
                degli artt. 13 e 14 del Regolamento (UE) 2016/679 sulla protezione dei dati (GDPR), 
                disponibile anche sul sito web della società, riguardo il trattamento dei propri 
                dati personali.
              </Text>

              <Text style={styles.sectionTitle}>PRESTA IL PROPRIO CONSENSO</Text>
              <View style={styles.consentItem}>
                <Ionicons name="checkbox" size={18} color="#007AFF" />
                <Text style={styles.consentText}>
                  al trattamento dei propri dati personali per le finalità strettamente connesse 
                  e necessarie all'attività sportiva dilettantistica (gestione amministrativa, 
                  comunicazioni relative all'attività sportiva);
                </Text>
              </View>

              <View style={styles.consentItem}>
                <Ionicons name="checkbox" size={18} color="#007AFF" />
                <Text style={styles.consentText}>
                  alla comunicazione dei propri dati personali alla Federazione Sportiva di 
                  appartenenza (FIPAV o altra federazione) o ad Enti di Promozione Sportiva (EPS) 
                  ai fini del tesseramento e della partecipazione alle attività federali;
                </Text>
              </View>

              <View style={styles.consentItem}>
                <Ionicons name="checkbox" size={18} color="#007AFF" />
                <Text style={styles.consentText}>
                  all'utilizzo di proprie immagini fotografiche e/o video per finalità 
                  promozionali e comunicative della società sui canali social (Facebook, 
                  Instagram, TikTok, YouTube e altri), sul sito web e su materiale promozionale 
                  cartaceo e digitale;
                </Text>
              </View>

              <View style={styles.consentItem}>
                <Ionicons name="checkbox" size={18} color="#007AFF" />
                <Text style={styles.consentText}>
                  alla comunicazione dei dati ad assicurazioni, enti sanitari e altri soggetti 
                  necessari per lo svolgimento dell'attività sportiva e la tutela della salute;
                </Text>
              </View>

              {signerRole !== 'athlete' && (
                <View style={styles.consentItem}>
                  <Ionicons name="checkbox" size={18} color="#007AFF" />
                  <Text style={styles.consentText}>
                    al trattamento dei dati relativi ai compensi sportivi dilettantistici 
                    ai fini degli adempimenti fiscali e contributivi previsti dalla normativa vigente.
                  </Text>
                </View>
              )}

              <View style={styles.noteBox}>
                <Ionicons name="information-circle" size={18} color="#856404" />
                <Text style={styles.noteText}>
                  Il consenso è revocabile in qualsiasi momento mediante comunicazione scritta 
                  alla società. Il rifiuto del consenso ai trattamenti necessari comporterà 
                  l'impossibilità di partecipare all'attività sportiva.
                </Text>
              </View>
            </View>

            {/* Signature Area */}
            <Text style={styles.signatureLabel}>
              Firma qui sotto per confermare di aver letto e accettato:
            </Text>
            
            <View style={styles.signatureContainer}>
              <ReactSignatureCanvas
                ref={signatureRef}
                canvasProps={{
                  className: 'signature-canvas',
                  style: {
                    width: '100%',
                    height: 180,
                    border: '2px solid #007AFF',
                    borderRadius: 10,
                    backgroundColor: '#fff',
                  },
                }}
                onEnd={handleSignatureEnd}
              />
            </View>

            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Ionicons name="trash-outline" size={16} color="#FF3B30" />
              <Text style={styles.clearBtnText}>Cancella Firma</Text>
            </TouchableOpacity>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Annulla</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.confirmBtn, !hasSignature && styles.confirmBtnDisabled]}
                onPress={handleConfirm}
                disabled={!hasSignature || signing}
              >
                {signing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.confirmBtnText}>Confermo e Firmo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
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
    padding: 16,
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
    borderBottomColor: '#eee',
    backgroundColor: '#f8f9fa',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  welcomeBox: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  welcomeText: {
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 22,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  documentSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  documentContent: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  documentText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 20,
    marginBottom: 12,
  },
  bold: {
    fontWeight: 'bold',
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    color: '#444',
    lineHeight: 20,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
    lineHeight: 18,
  },
  signatureLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  signatureContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 8,
    marginBottom: 16,
  },
  clearBtnText: {
    fontSize: 14,
    color: '#FF3B30',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    color: '#666',
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#ccc',
  },
  confirmBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

export default AdultPrivacyModal;
