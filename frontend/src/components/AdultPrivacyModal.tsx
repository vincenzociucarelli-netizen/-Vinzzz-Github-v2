import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import ReactSignatureCanvas from 'react-signature-canvas';
import { Ionicons } from './Icon';

interface AdultPrivacyModalProps {
  visible: boolean;
  onClose: () => void;
  onSign: (signatureBase64: string) => Promise<void>;
  signerName: string;
  signerRole: 'athlete' | 'coach' | 'dirigente' | 'collaboratore';
  societyName?: string;
  fiscalCode?: string;
  birthDate?: string;
  birthPlace?: string;
  address?: string;
  city?: string;
  province?: string;
}

const getRoleLabel = (role: string): string => {
  switch (role) {
    case 'athlete': return 'Atleta';
    case 'coach': return 'Allenatore/Coach';
    case 'dirigente': return 'Dirigente';
    case 'collaboratore': return 'Collaboratore';
    default: return 'Collaboratore';
  }
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const AdultPrivacyModal: React.FC<AdultPrivacyModalProps> = ({
  visible,
  onClose,
  onSign,
  signerName,
  signerRole,
  societyName = 'PALLAVOLO PERUGIA SSD A RL',
  fiscalCode = '',
  birthDate = '',
  birthPlace = '',
  address = '',
  city = '',
  province = '',
}) => {
  const signatureRef = useRef<ReactSignatureCanvas>(null);
  const [signing, setSigning] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Read privacy, Step 2: Sign

  const handleClear = () => {
    signatureRef.current?.clear();
    setHasSignature(false);
  };

  const handleConfirm = async () => {
    if (!hasSignature || !signatureRef.current) {
      return;
    }
    
    if (signatureRef.current.isEmpty()) {
      alert('Per favore, firma nel riquadro prima di confermare.');
      return;
    }
    
    const signature = signatureRef.current.getTrimmedCanvas().toDataURL('image/png');
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
        setStep(1); // Reset for next time
        onClose();
      } catch (error) {
        console.error('Error signing privacy:', error);
      } finally {
        setSigning(false);
      }
    }
  };

  const handleSignatureEnd = () => {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      setHasSignature(true);
    }
  };

  const handleClose = () => {
    setStep(1); // Reset step when closing
    handleClear();
    onClose();
  };

  const roleLabel = getRoleLabel(signerRole);

  // Privacy text that will appear in the PDF
  const privacyFullText = `
INFORMATIVA SULLA PRIVACY AI SENSI DEL REGOLAMENTO UE 2016/679 (GDPR)

Gentile ${roleLabel},

La presente informativa descrive le modalità di trattamento dei dati personali da parte di ${societyName} (di seguito "Società").

1. TITOLARE DEL TRATTAMENTO
Il Titolare del trattamento è ${societyName}.

2. FINALITÀ E BASE GIURIDICA DEL TRATTAMENTO
I Suoi dati personali saranno trattati per le seguenti finalità:
a) Gestione del rapporto associativo/collaborativo con la Società;
b) Adempimento degli obblighi di legge, fiscali e contabili;
c) Comunicazione con gli enti sportivi di riferimento (FIPAV, RAS, ecc.);
d) Gestione delle attività sportive e organizzative della Società;
e) Eventuale pubblicazione di foto/video su canali social e sito web della Società.

3. TIPOLOGIA DI DATI TRATTATI
- Dati anagrafici (nome, cognome, data e luogo di nascita, codice fiscale);
- Dati di contatto (indirizzo, telefono, email);
- Dati relativi all'attività sportiva;
- Eventuali dati relativi ai compensi sportivi dilettantistici.

4. MODALITÀ DI TRATTAMENTO
I dati sono trattati con strumenti elettronici e/o cartacei, con logiche organizzative correlate alle finalità sopra indicate e comunque in modo da garantire la sicurezza e la riservatezza dei dati.

5. PERIODO DI CONSERVAZIONE
I dati saranno conservati per il tempo necessario all'adempimento delle finalità sopra indicate e comunque non oltre i termini previsti dalla legge.

6. DIRITTI DELL'INTERESSATO
Lei ha il diritto di:
- Accedere ai Suoi dati personali;
- Ottenere la rettifica o la cancellazione degli stessi;
- Ottenere la limitazione del trattamento;
- Opporsi al trattamento;
- Richiedere la portabilità dei dati.

Per esercitare i Suoi diritti, può contattare il Titolare del trattamento.

7. CONSENSO
Con la sottoscrizione del presente documento, Lei dichiara di aver letto e compreso l'informativa sulla privacy e acconsente al trattamento dei Suoi dati personali per le finalità sopra indicate.
`.trim();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {step === 1 ? '📋 Informativa Privacy' : '✍️ Firma Consenso'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {step === 1 ? 'Pagina 1 di 2 - Leggi l\'informativa' : 'Pagina 2 di 2 - Firma per accettare'}
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
          </View>

          {/* Content */}
          {step === 1 ? (
            /* STEP 1: Read Privacy Information */
            <View style={styles.stepContent}>
              <ScrollView 
                style={styles.privacyScrollView}
                showsVerticalScrollIndicator={true}
              >
                <Text style={styles.privacyText}>{privacyFullText}</Text>
                
                {/* User data summary */}
                <View style={styles.userDataBox}>
                  <Text style={styles.userDataTitle}>I tuoi dati:</Text>
                  <Text style={styles.userDataRow}>
                    <Text style={styles.userDataLabel}>{roleLabel}: </Text>
                    {signerName}
                  </Text>
                  {fiscalCode && (
                    <Text style={styles.userDataRow}>
                      <Text style={styles.userDataLabel}>Codice Fiscale: </Text>
                      {fiscalCode}
                    </Text>
                  )}
                  {birthDate && birthPlace && (
                    <Text style={styles.userDataRow}>
                      <Text style={styles.userDataLabel}>Nato/a: </Text>
                      a {birthPlace} il {birthDate}
                    </Text>
                  )}
                  {(address || city) && (
                    <Text style={styles.userDataRow}>
                      <Text style={styles.userDataLabel}>Residente: </Text>
                      {address}{address && city ? ', ' : ''}{city}{province ? ` (${province})` : ''}
                    </Text>
                  )}
                </View>
                
                <View style={{ height: 20 }} />
              </ScrollView>

              <TouchableOpacity
                style={styles.nextButton}
                onPress={() => setStep(2)}
              >
                <Text style={styles.nextButtonText}>Ho letto e compreso → Procedi alla firma</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            /* STEP 2: Sign */
            <View style={styles.stepContent}>
              <View style={styles.signatureSection}>
                <Text style={styles.signatureLabel}>
                  Firmando, dichiaro di aver letto e compreso l'informativa privacy e acconsento al trattamento dei miei dati personali.
                </Text>
                
                <View style={styles.signatureBox}>
                  <ReactSignatureCanvas
                    ref={signatureRef}
                    canvasProps={{
                      width: Math.min(SCREEN_WIDTH - 80, 400),
                      height: 150,
                      style: { border: '1px solid #ddd', borderRadius: 8, backgroundColor: '#fff' }
                    }}
                    onEnd={handleSignatureEnd}
                    penColor="black"
                    minWidth={1}
                    maxWidth={3}
                  />
                </View>

                <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                  <Ionicons name="trash-outline" size={16} color="#F44336" />
                  <Text style={styles.clearBtnText}>Cancella Firma</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setStep(1)}
                >
                  <Ionicons name="arrow-back" size={20} color="#666" />
                  <Text style={styles.backButtonText}>Indietro</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    (!hasSignature || signing) && styles.confirmButtonDisabled
                  ]}
                  onPress={handleConfirm}
                  disabled={!hasSignature || signing}
                >
                  {signing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.confirmButtonText}>Conferma e Salva</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '95%',
    maxWidth: 500,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#8E44AD',
    padding: 16,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 4,
  },
  closeBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#f8f8f8',
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ddd',
  },
  stepDotActive: {
    backgroundColor: '#8E44AD',
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: '#ddd',
    marginHorizontal: 8,
  },
  stepContent: {
    flex: 1,
    padding: 16,
  },
  privacyScrollView: {
    flex: 1,
    maxHeight: 350,
  },
  privacyText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#333',
    textAlign: 'justify',
  },
  userDataBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  userDataTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  userDataRow: {
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
  },
  userDataLabel: {
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: '#8E44AD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  signatureSection: {
    flex: 1,
  },
  signatureLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 16,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  signatureBox: {
    alignItems: 'center',
    marginBottom: 12,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  clearBtnText: {
    color: '#F44336',
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  backButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    gap: 6,
  },
  backButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    gap: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AdultPrivacyModal;
