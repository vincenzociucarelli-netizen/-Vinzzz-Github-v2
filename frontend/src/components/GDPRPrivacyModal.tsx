import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import ReactSignatureCanvas from 'react-signature-canvas';
import { Ionicons } from './Icon';
import api from '../services/api';

interface SocietyInfo {
  name: string;
  ragione_sociale?: string;
  address?: string;
  city?: string;
  province?: string;
  fiscal_code?: string;
  vat_number?: string;
  email?: string;
}

interface SignerInfo {
  name: string;
  surname: string;
  fiscal_code: string;
  birth_date?: string;
  birth_place?: string;
  address?: string;
  city?: string;
  province?: string;
}

interface MinorInfo {
  id: string;
  name: string;
  surname: string;
  fiscal_code?: string;
  birth_date?: string;
  birth_place?: string;
}

interface GDPRPrivacyModalProps {
  visible: boolean;
  onClose: () => void;
  onSign: (success: boolean, documentId?: string) => void;
  documentType: 'gdpr_adult' | 'gdpr_minor';
  signerInfo: SignerInfo;
  societyInfo?: SocietyInfo;
  minorInfo?: MinorInfo; // Required for gdpr_minor
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const GDPRPrivacyModal: React.FC<GDPRPrivacyModalProps> = ({
  visible,
  onClose,
  onSign,
  documentType,
  signerInfo,
  societyInfo,
  minorInfo,
}) => {
  const signatureRef = useRef<ReactSignatureCanvas>(null);
  const [signing, setSigning] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [society, setSociety] = useState<SocietyInfo | null>(societyInfo || null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);

  // Load society info if not provided
  useEffect(() => {
    if (!societyInfo && visible) {
      loadSocietyInfo();
    }
  }, [visible, societyInfo]);

  const loadSocietyInfo = async () => {
    try {
      const response = await api.get('/settings/society');
      setSociety(response.data);
    } catch (error) {
      console.error('Error loading society info:', error);
    }
  };

  const handlePreviewPDF = async () => {
    setLoadingPreview(true);
    try {
      const payload: any = {
        document_type: documentType,
        signer_name: signerInfo.name,
        signer_surname: signerInfo.surname,
        signer_fiscal_code: signerInfo.fiscal_code,
        signer_birth_date: signerInfo.birth_date,
        signer_birth_place: signerInfo.birth_place,
        signer_address: signerInfo.address,
        signer_city: signerInfo.city,
        signer_province: signerInfo.province,
      };

      if (documentType === 'gdpr_minor' && minorInfo) {
        payload.minor_id = minorInfo.id;
        payload.minor_name = minorInfo.name;
        payload.minor_surname = minorInfo.surname;
        payload.minor_fiscal_code = minorInfo.fiscal_code;
        payload.minor_birth_date = minorInfo.birth_date;
        payload.minor_birth_place = minorInfo.birth_place;
      }

      const response = await api.post('/documents/preview-gdpr-privacy', payload);
      
      if (response.data.pdf_base64) {
        // Create blob URL for PDF viewing
        const byteCharacters = atob(response.data.pdf_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // Open in PDF viewer modal instead of new tab
        if (Platform.OS === 'web') {
          setShowPdfViewer(true);
        }
        setPreviewUrl(url);
      }
    } catch (error: any) {
      console.error('Error generating preview:', error);
      alert(error.response?.data?.detail || 'Errore nella generazione dell\'anteprima');
    } finally {
      setLoadingPreview(false);
    }
  };

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
    
    setSigning(true);
    try {
      // Get user agent
      const userAgent = Platform.OS === 'web' 
        ? navigator.userAgent 
        : `${Platform.OS} ${Platform.Version}`;

      const payload: any = {
        document_type: documentType,
        signature_base64: signature,
        user_agent: userAgent,
        signer_name: signerInfo.name,
        signer_surname: signerInfo.surname,
        signer_fiscal_code: signerInfo.fiscal_code,
        signer_birth_date: signerInfo.birth_date,
        signer_birth_place: signerInfo.birth_place,
        signer_address: signerInfo.address,
        signer_city: signerInfo.city,
        signer_province: signerInfo.province,
      };

      // Add minor info if applicable
      if (documentType === 'gdpr_minor' && minorInfo) {
        payload.minor_id = minorInfo.id;
        payload.minor_name = minorInfo.name;
        payload.minor_surname = minorInfo.surname;
        payload.minor_fiscal_code = minorInfo.fiscal_code;
        payload.minor_birth_date = minorInfo.birth_date;
        payload.minor_birth_place = minorInfo.birth_place;
      }

      const response = await api.post('/documents/sign-gdpr-privacy', payload);
      
      handleClear();
      setStep(1);
      onSign(true, response.data.document_id);
      onClose();
    } catch (error: any) {
      console.error('Error signing GDPR privacy:', error);
      alert(error.response?.data?.detail || 'Errore durante la firma. Riprova.');
      onSign(false);
    } finally {
      setSigning(false);
    }
  };

  const handleSignatureEnd = () => {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      setHasSignature(true);
    }
  };

  const handleClose = () => {
    setStep(1);
    handleClear();
    onClose();
  };

  const societyName = society?.ragione_sociale || society?.name || societyInfo?.name || 'La Società Sportiva';
  const societyAddress = society?.address 
    ? `${society.address}, ${society.city || ''}${society.province ? ` (${society.province})` : ''}`
    : '';
  const societyCfPiva = society?.fiscal_code || society?.vat_number || '';
  const societyEmail = society?.email || '';

  // Generate privacy text based on document type
  const isMinor = documentType === 'gdpr_minor';
  
  const privacyTextAdult = `
INFORMATIVA PRIVACY PER COLLABORATORI
ai sensi del Regolamento UE 2016/679 (GDPR)

Gentile Collaboratore,

La presente informativa descrive le modalità di trattamento dei dati personali da parte di ${societyName}, con sede in ${societyAddress}, C.F. ${societyCfPiva}, email ${societyEmail}.

1. TITOLARE DEL TRATTAMENTO
Il Titolare del trattamento è ${societyName}, con sede in ${societyAddress} – email: ${societyEmail}.

2. FINALITÀ E BASE GIURIDICA DEL TRATTAMENTO
I dati personali saranno trattati per le seguenti finalità:
a) Gestione del rapporto associativo/collaborativo con la Società;
b) Adempimento degli obblighi di legge, fiscali e contabili;
c) Comunicazione con gli enti sportivi di riferimento (es. Federazioni, EPS, RAS);
d) Gestione delle attività sportive, organizzative e amministrative della Società.

La base giuridica del trattamento è l'esecuzione del rapporto collaborativo e l'adempimento di obblighi di legge.

3. TIPOLOGIA DI DATI TRATTATI
La Società può trattare le seguenti categorie di dati personali:
- dati anagrafici (nome, cognome, data e luogo di nascita, codice fiscale);
- dati di contatto (telefono, email, indirizzo);
- dati relativi all'attività sportiva svolta;
- eventuali dati amministrativi e fiscali connessi ai compensi sportivi dilettantistici.

4. MODALITÀ DI TRATTAMENTO
Il trattamento dei dati avviene mediante strumenti informatici e/o cartacei, con logiche organizzative strettamente correlate alle finalità indicate e nel rispetto delle misure di sicurezza previste dal GDPR. I dati sono accessibili esclusivamente a soggetti autorizzati dalla Società.

5. PERIODO DI CONSERVAZIONE
I dati personali saranno conservati per tutta la durata del rapporto collaborativo con la Società e successivamente per il periodo previsto dalle normative fiscali, amministrative e sportive applicabili.

6. DIRITTI DELL'INTERESSATO
L'interessato può esercitare i diritti previsti dagli artt. 15-22 del GDPR:
- accesso ai dati personali;
- rettifica o cancellazione degli stessi;
- limitazione del trattamento;
- opposizione al trattamento;
- portabilità dei dati.

Per esercitare tali diritti è possibile contattare il Titolare del trattamento all'indirizzo: ${societyEmail}.

7. CONSENSO E SOTTOSCRIZIONE DIGITALE
Con la sottoscrizione digitale del presente documento tramite l'App, il Collaboratore dichiara di aver letto e compreso la presente informativa e prende atto del trattamento dei dati personali per le finalità sopra indicate.
`.trim();

  const privacyTextMinor = `
INFORMATIVA PRIVACY PER MINORI
ai sensi del Regolamento UE 2016/679 (GDPR)

Gentile Genitore/Tutore,

La presente informativa descrive le modalità di trattamento dei dati personali del minore da parte di ${societyName}, con sede in ${societyAddress}, C.F. ${societyCfPiva}, email ${societyEmail}.

1. TITOLARE DEL TRATTAMENTO
Il Titolare del trattamento è ${societyName}, con sede in ${societyAddress} – email: ${societyEmail}.

2. FINALITÀ DEL TRATTAMENTO
I dati personali del minore saranno trattati per le seguenti finalità:
a) gestione dell'iscrizione e partecipazione alle attività sportive della Società;
b) adempimento degli obblighi previsti dalle normative sportive, assicurative e amministrative;
c) comunicazione con gli enti sportivi di riferimento (Federazioni, EPS, RAS);
d) organizzazione delle attività sportive e delle comunicazioni con le famiglie.

3. TIPOLOGIA DI DATI TRATTATI
La Società può trattare le seguenti categorie di dati:
- dati anagrafici del minore (nome, cognome, data e luogo di nascita);
- dati di contatto del genitore/tutore (telefono, email, indirizzo);
- dati relativi all'attività sportiva svolta dal minore;
- eventuali dati amministrativi connessi alla gestione dell'attività sportiva.

4. MODALITÀ DI TRATTAMENTO
Il trattamento dei dati avviene mediante strumenti informatici e/o cartacei, con modalità idonee a garantire la sicurezza e la riservatezza dei dati personali. L'accesso ai dati è limitato ai soggetti autorizzati dalla Società.

5. PERIODO DI CONSERVAZIONE
I dati saranno conservati per tutta la durata del rapporto sportivo con la Società e successivamente per il periodo necessario all'adempimento degli obblighi legali, amministrativi e sportivi previsti dalla normativa vigente.

6. DIRITTI DELL'INTERESSATO
Il genitore/tutore può esercitare i diritti previsti dagli artt. 15-22 del GDPR, tra cui accesso ai dati, rettifica, cancellazione, limitazione del trattamento, opposizione e portabilità dei dati. Per l'esercizio dei diritti è possibile contattare il Titolare del trattamento all'indirizzo: ${societyEmail}.

7. DICHIARAZIONE DEL GENITORE/TUTORE
Con la sottoscrizione digitale del presente documento il sottoscritto genitore/tutore dichiara di aver letto e compreso la presente informativa e autorizza il trattamento dei dati personali del minore per le finalità sopra indicate.
`.trim();

  const privacyText = isMinor ? privacyTextMinor : privacyTextAdult;

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={[styles.header, isMinor && styles.headerMinor]}>
            <Text style={styles.headerTitle}>
              {step === 1 ? '📋 Informativa Privacy GDPR' : '✍️ Firma Consenso'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isMinor 
                ? `Per il minore: ${minorInfo?.surname} ${minorInfo?.name}`
                : `${signerInfo.surname} ${signerInfo.name}`}
            </Text>
            <Text style={styles.headerStep}>
              {step === 1 ? 'Pagina 1 di 2 - Leggi l\'informativa' : 'Pagina 2 di 2 - Firma per accettare'}
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, step >= 1 && styles.stepDotActive, isMinor && styles.stepDotMinor]} />
            <View style={[styles.stepLine, isMinor && styles.stepLineMinor]} />
            <View style={[styles.stepDot, step >= 2 && styles.stepDotActive, isMinor && styles.stepDotMinor]} />
          </View>

          {/* Content */}
          {step === 1 ? (
            /* STEP 1: Read Privacy Information */
            <View style={styles.stepContent}>
              <ScrollView 
                style={styles.privacyScrollView}
                showsVerticalScrollIndicator={true}
              >
                <Text style={styles.privacyText}>{privacyText}</Text>
                
                {/* Signer/Minor data summary */}
                <View style={[styles.userDataBox, isMinor && styles.userDataBoxMinor]}>
                  <Text style={styles.userDataTitle}>
                    {isMinor ? '👶 Dati del Minore:' : '👤 I tuoi dati:'}
                  </Text>
                  {isMinor && minorInfo ? (
                    <>
                      <Text style={styles.userDataRow}>
                        <Text style={styles.userDataLabel}>Nome: </Text>
                        {minorInfo.surname} {minorInfo.name}
                      </Text>
                      {minorInfo.fiscal_code && (
                        <Text style={styles.userDataRow}>
                          <Text style={styles.userDataLabel}>Codice Fiscale: </Text>
                          {minorInfo.fiscal_code}
                        </Text>
                      )}
                      {minorInfo.birth_date && (
                        <Text style={styles.userDataRow}>
                          <Text style={styles.userDataLabel}>Data di nascita: </Text>
                          {minorInfo.birth_date}
                        </Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={styles.userDataRow}>
                        <Text style={styles.userDataLabel}>Nome: </Text>
                        {signerInfo.surname} {signerInfo.name}
                      </Text>
                      {signerInfo.fiscal_code && (
                        <Text style={styles.userDataRow}>
                          <Text style={styles.userDataLabel}>Codice Fiscale: </Text>
                          {signerInfo.fiscal_code}
                        </Text>
                      )}
                      {signerInfo.birth_date && signerInfo.birth_place && (
                        <Text style={styles.userDataRow}>
                          <Text style={styles.userDataLabel}>Nato/a: </Text>
                          a {signerInfo.birth_place} il {signerInfo.birth_date}
                        </Text>
                      )}
                    </>
                  )}
                </View>

                {isMinor && (
                  <View style={styles.parentDataBox}>
                    <Text style={styles.userDataTitle}>👨‍👩‍👧 Genitore/Tutore che firma:</Text>
                    <Text style={styles.userDataRow}>
                      <Text style={styles.userDataLabel}>Nome: </Text>
                      {signerInfo.surname} {signerInfo.name}
                    </Text>
                    {signerInfo.fiscal_code && (
                      <Text style={styles.userDataRow}>
                        <Text style={styles.userDataLabel}>Codice Fiscale: </Text>
                        {signerInfo.fiscal_code}
                      </Text>
                    )}
                  </View>
                )}
                
                <View style={{ height: 20 }} />
              </ScrollView>

              {/* Preview PDF Button */}
              <TouchableOpacity
                style={[styles.previewButton, loadingPreview && styles.previewButtonLoading]}
                onPress={handlePreviewPDF}
                disabled={loadingPreview}
              >
                {loadingPreview ? (
                  <ActivityIndicator size="small" color="#8E44AD" />
                ) : (
                  <>
                    <Ionicons name="eye-outline" size={18} color="#8E44AD" />
                    <Text style={styles.previewButtonText}>Visualizza Anteprima PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.nextButton, isMinor && styles.nextButtonMinor]}
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
                  {isMinor 
                    ? `Firmando, dichiaro di essere il genitore/tutore di ${minorInfo?.surname} ${minorInfo?.name} e autorizzo il trattamento dei suoi dati personali.`
                    : 'Firmando, dichiaro di aver letto e compreso l\'informativa privacy e acconsento al trattamento dei miei dati personali.'}
                </Text>
                
                <View style={styles.signatureBox}>
                  <ReactSignatureCanvas
                    ref={signatureRef}
                    canvasProps={{
                      width: Math.min(SCREEN_WIDTH - 80, 400),
                      height: 150,
                      style: { border: '2px solid #ddd', borderRadius: 8, backgroundColor: '#fff' }
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

                {/* GDPR Notice */}
                <View style={styles.gdprNotice}>
                  <Ionicons name="shield-checkmark" size={16} color="#27AE60" />
                  <Text style={styles.gdprNoticeText}>
                    La firma include metadati per validità legale (timestamp, IP, hash documento)
                  </Text>
                </View>
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
                    isMinor && styles.confirmButtonMinor,
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

    {/* PDF Viewer Modal */}
    {showPdfViewer && previewUrl && Platform.OS === 'web' && (
      <Modal
        visible={showPdfViewer}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPdfViewer(false)}
      >
        <View style={styles.pdfViewerOverlay}>
          <View style={styles.pdfViewerContainer}>
            <View style={styles.pdfViewerHeader}>
              <Text style={styles.pdfViewerTitle}>Anteprima Documento</Text>
              <TouchableOpacity 
                style={styles.pdfViewerCloseBtn} 
                onPress={() => setShowPdfViewer(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <iframe
              src={previewUrl}
              style={{ 
                width: '100%', 
                height: '100%', 
                border: 'none',
                flex: 1,
              } as any}
              title="PDF Preview"
            />
            <TouchableOpacity 
              style={styles.pdfViewerCloseButton}
              onPress={() => setShowPdfViewer(false)}
            >
              <Text style={styles.pdfViewerCloseButtonText}>CHIUDI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    )}
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '95%',
    maxWidth: 520,
    maxHeight: '92%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    backgroundColor: '#8E44AD',
    padding: 16,
    paddingTop: 20,
    position: 'relative',
  },
  headerMinor: {
    backgroundColor: '#27AE60',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  headerStep: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 4,
  },
  closeBtn: {
    position: 'absolute',
    right: 12,
    top: 16,
    padding: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
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
  stepDotMinor: {
    backgroundColor: '#27AE60',
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: '#ddd',
    marginHorizontal: 8,
  },
  stepLineMinor: {
    backgroundColor: '#A9DFBF',
  },
  stepContent: {
    flex: 1,
    padding: 16,
  },
  privacyScrollView: {
    flex: 1,
    maxHeight: 380,
  },
  privacyText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#333',
    textAlign: 'justify',
  },
  userDataBox: {
    backgroundColor: '#F5EEF8',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#8E44AD',
  },
  userDataBoxMinor: {
    backgroundColor: '#E8F8F5',
    borderLeftColor: '#27AE60',
  },
  parentDataBox: {
    backgroundColor: '#EBF5FB',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3498DB',
  },
  userDataTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  userDataRow: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
  },
  userDataLabel: {
    fontWeight: '600',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    backgroundColor: '#F5EEF8',
    borderWidth: 1,
    borderColor: '#8E44AD',
    gap: 8,
  },
  previewButtonLoading: {
    opacity: 0.7,
  },
  previewButtonText: {
    color: '#8E44AD',
    fontSize: 14,
    fontWeight: '500',
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
  nextButtonMinor: {
    backgroundColor: '#27AE60',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  signatureSection: {
    flex: 1,
  },
  signatureLabel: {
    fontSize: 13,
    color: '#333',
    marginBottom: 16,
    lineHeight: 20,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  signatureBox: {
    alignItems: 'center',
    marginBottom: 8,
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
    fontSize: 13,
  },
  gdprNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F8F5',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  gdprNoticeText: {
    fontSize: 11,
    color: '#27AE60',
    flex: 1,
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
    fontSize: 14,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#8E44AD',
    gap: 8,
  },
  confirmButtonMinor: {
    backgroundColor: '#27AE60',
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // PDF Viewer Modal Styles
  pdfViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfViewerContainer: {
    width: '95%',
    height: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  pdfViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#8E44AD',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pdfViewerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pdfViewerCloseBtn: {
    padding: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 20,
  },
  pdfViewerCloseButton: {
    backgroundColor: '#8E44AD',
    paddingVertical: 14,
    alignItems: 'center',
  },
  pdfViewerCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GDPRPrivacyModal;
