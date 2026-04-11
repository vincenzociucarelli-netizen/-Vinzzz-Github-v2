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
  showDeleteOption?: boolean; // Show "I don't want to stay" option
  onDeleteRequest?: () => void; // Callback when user requests data deletion
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
  showDeleteOption,
  onDeleteRequest,
}) => {
  const signatureRef = useRef<ReactSignatureCanvas>(null);
  const [signing, setSigning] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [society, setSociety] = useState<SocietyInfo | null>(societyInfo || null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  
  // Consensi granulari GDPR
  const [consentPrivacyViewed, setConsentPrivacyViewed] = useState(false);
  const [consentImagesInternal, setConsentImagesInternal] = useState(false);
  const [consentImagesPromo, setConsentImagesPromo] = useState(false);

  // Reset preview when modal opens or minor changes or signer changes
  useEffect(() => {
    if (visible) {
      // Revoke old blob URL to prevent caching
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setShowPdfViewer(false);
    }
  }, [visible, minorInfo?.id, signerInfo?.name, signerInfo?.surname, documentType]);

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
      // Revoke old blob URL before generating new one
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      
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
        _nocache: Date.now(),
      };

      if (documentType === 'gdpr_minor' && minorInfo) {
        payload.minor_id = minorInfo.id;
        payload.minor_name = minorInfo.name;
        payload.minor_surname = minorInfo.surname;
        payload.minor_fiscal_code = minorInfo.fiscal_code;
        payload.minor_birth_date = minorInfo.birth_date;
        payload.minor_birth_place = minorInfo.birth_place;
      }

      // Always include current consent choices in preview
      payload.consent_data = {
        privacy_viewed: consentPrivacyViewed,
        images_internal: consentImagesInternal,
        images_promo: consentImagesPromo,
      };

      const response = await api.post('/documents/preview-gdpr-privacy', payload, {
        headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' }
      });
      
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
        
        // Verify the response belongs to the correct user
        const responseUser = response.data.signer_name || '';
        const expectedUser = signerInfo.surname || '';
        if (responseUser && expectedUser && !responseUser.toUpperCase().includes(expectedUser.toUpperCase())) {
          console.warn('Preview mismatch! Expected:', expectedUser, 'Got:', responseUser);
          alert('Errore: documento non corrispondente. Riprova.');
          URL.revokeObjectURL(url);
          return;
        }
        
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
        consent_data: {
          privacy_viewed: consentPrivacyViewed,
          images_internal: consentImagesInternal,
          images_promo: consentImagesPromo,
          document_version: '1.0-2026',
        },
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
    setConsentPrivacyViewed(false);
    setConsentDataTreatment(false);
    setConsentImagesInternal(false);
    setConsentImagesPromo(false);
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
INFORMATIVA PRIVACY PER STAFF
(ai sensi del Regolamento UE 2016/679 - GDPR)

Gentile Collaboratore / Membro dello Staff,
la presente informativa descrive le modalità di trattamento dei dati personali da parte della società sportiva:
${societyName}
Sede: ${societyAddress}
C.F.: ${societyCfPiva}
Email: ${societyEmail}

Il Titolare del trattamento dei dati personali è la società sportiva sopra indicata nella persona del proprio legale rappresentante pro tempore.

1. TITOLARE DEL TRATTAMENTO
Il Titolare del trattamento dei dati personali è ${societyName}, con sede in ${societyAddress}. Per qualsiasi richiesta relativa al trattamento dei dati è possibile contattare la Società tramite i recapiti indicati.

2. FINALITÀ E BASE GIURIDICA DEL TRATTAMENTO
I dati personali saranno trattati per le seguenti finalità: gestione dei rapporti sportivi, associativi o collaborativi con la Società; adempimenti degli obblighi di legge, fiscali e contabili; comunicazioni con enti sportivi di riferimento (Federazioni, EPS, RAS); gestione delle attività sportive, organizzative e amministrative della Società; gestione dei compensi sportivi dilettantistici, ove previsti. La base giuridica del trattamento è l'esecuzione del rapporto associativo o collaborativo e l'adempimento degli obblighi previsti dalla normativa vigente.

3. TIPOLOGIA DI DATI TRATTATI
La Società potrà trattare le seguenti categorie di dati personali: dati anagrafici (nome, cognome, data e luogo di nascita, codice fiscale); dati di contatto (telefono, email, indirizzo); dati relativi alle attività svolte per la Società; dati amministrativi e fiscali connessi alla gestione dei compensi sportivi dilettantistici.

4. MODALITÀ DI TRATTAMENTO
Il trattamento dei dati avviene mediante strumenti informatici e/o cartacei con modalità idonee a garantire la sicurezza e la riservatezza dei dati personali. La Società può utilizzare applicativi gestionali informatici per l'organizzazione delle attività sportive e amministrative. L'accesso ai dati è consentito esclusivamente ai soggetti autorizzati dalla Società.

5. PERIODO DI CONSERVAZIONE
I dati personali saranno conservati per tutta la durata del rapporto con la Società e successivamente per il periodo necessario all'adempimento degli obblighi previsti dalla normativa fiscale, amministrativa e sportiva vigente.

6. DIRITTI DELL'INTERESSATO
L'interessato può esercitare i diritti previsti dagli articoli 15–22 del GDPR, tra cui: accesso ai dati personali; rettifica o aggiornamento dei dati; cancellazione dei dati nei casi previsti dalla legge; limitazione o opposizione al trattamento; portabilità dei dati. Le richieste possono essere rivolte al Titolare del trattamento tramite i recapiti indicati dalla Società.

7. RIPRESE FOTOGRAFICHE E VIDEO
Durante eventi, gare, allenamenti e manifestazioni sportive potranno essere effettuate riprese fotografiche e video a fini documentativi e informativi. La presenza in tali contesti comporta la possibilità di essere ripresi sullo sfondo delle immagini. Tale trattamento si fonda sul legittimo interesse della Società alla documentazione delle proprie attività. Per eventuali utilizzi promozionali specifici (es. pubblicazione su sito web o social network), sarà richiesto apposito consenso. L'interessato ha in ogni momento il diritto di richiedere la rimozione di immagini in cui appare, contattando la Società ai recapiti indicati.

8. ACCETTAZIONE DIGITALE DEL DOCUMENTO
L'accettazione del presente documento avviene tramite l'applicativo gestionale utilizzato dalla Società. Il sistema registra metadati tecnici dell'accettazione (data, ora, identificativo utente, dispositivo, IP) ai fini della tracciabilità e sicurezza.

DICHIARAZIONE
Il sottoscritto dichiara di aver preso visione dell'informativa sulla privacy ai sensi del Regolamento UE 2016/679 e prende atto del trattamento dei propri dati personali.
`.trim();

  const privacyTextMinor = `
INFORMATIVA PRIVACY PER MINORI
(Regolamento UE 2016/679 - GDPR)

Gentile Genitore/Tutore,
la presente informativa descrive le modalità di trattamento dei dati personali del minore da parte della società sportiva:
${societyName}
Sede: ${societyAddress}
C.F.: ${societyCfPiva}
Email: ${societyEmail}

Il Titolare del trattamento dei dati personali è la società sportiva sopra indicata nella persona del proprio legale rappresentante pro tempore.

1. FINALITÀ DEL TRATTAMENTO
I dati personali del minore e del genitore/tutore saranno trattati per:
- gestione dell'iscrizione e partecipazione alle attività sportive;
- adempimento degli obblighi previsti dalle normative sportive e assicurative;
- comunicazioni con federazioni sportive, enti di promozione sportiva e organismi sportivi;
- gestione delle presenze ad allenamenti e attività sportive;
- comunicazioni organizzative con le famiglie;
- gestione amministrativa e fiscale delle attività sportive.

2. TIPOLOGIA DI DATI TRATTATI
La società potrà trattare le seguenti categorie di dati:

Dati del minore:
- nome e cognome
- data di nascita
- codice fiscale
- recapito telefonico (se presente)
- dati relativi alla partecipazione alle attività sportive

Dati del genitore/tutore:
- nome e cognome
- codice fiscale
- telefono
- email
- indirizzo

Il codice fiscale del genitore/tutore può essere utilizzato anche ai fini della detrazione fiscale delle spese sportive prevista dalla normativa vigente.

3. CERTIFICATO MEDICO SPORTIVO
La società acquisisce e conserva presso la propria sede la documentazione relativa al certificato medico sportivo del minore.
Ai fini della gestione organizzativa delle attività sportive può essere registrata nel sistema gestionale esclusivamente la data di emissione e la data di scadenza del certificato medico.
L'applicativo gestionale utilizzato dalla società non consente il caricamento o la conservazione di certificati medici o altri documenti sanitari.

4. MODALITÀ DI TRATTAMENTO
Il trattamento dei dati avviene mediante strumenti informatici e/o cartacei con modalità idonee a garantire la sicurezza e la riservatezza dei dati personali.
La società può utilizzare applicativi gestionali informatici per l'organizzazione delle attività sportive e amministrative. L'accesso ai dati è consentito esclusivamente ai soggetti autorizzati dalla società.

5. PERIODO DI CONSERVAZIONE
I dati saranno conservati per tutta la durata del rapporto sportivo con la società e successivamente per il periodo necessario all'adempimento degli obblighi legali, amministrativi e sportivi previsti dalla normativa vigente.

6. DIRITTI DELL'INTERESSATO
Il genitore/tutore può esercitare i diritti previsti dagli articoli 15–22 del GDPR, tra cui:
- accesso ai dati
- rettifica
- cancellazione
- limitazione del trattamento
- opposizione
- portabilità dei dati.

7. UTILIZZO DI IMMAGINI E VIDEO
Durante le attività sportive potranno essere realizzate fotografie o riprese video degli atleti per finalità documentative, informative e promozionali della società sportiva.

8. FIRMA DIGITALE DEL DOCUMENTO
La sottoscrizione del presente documento può avvenire in forma digitale tramite l'applicativo gestionale utilizzato dalla società.
Il sistema può registrare metadati tecnici della firma, tra cui data, ora e identificativo dell'utente, ai fini della tracciabilità e della sicurezza del sistema.

DICHIARAZIONE
Il sottoscritto genitore/tutore dichiara di aver letto e compreso la presente informativa e autorizza il trattamento dei dati personali del minore per le finalità indicate.
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

              {/* Checkbox consensi granulari GDPR */}
              <View style={consentStyles.consentSection}>
                <Text style={consentStyles.consentTitle}>Consensi Privacy</Text>

                {/* 1. Presa visione informativa - OBBLIGATORIA */}
                <TouchableOpacity 
                  style={consentStyles.checkboxRow}
                  onPress={() => setConsentPrivacyViewed(!consentPrivacyViewed)}
                >
                  <View style={[consentStyles.checkbox, consentPrivacyViewed && (isMinor ? consentStyles.checkboxCheckedMinor : consentStyles.checkboxChecked)]}>
                    {consentPrivacyViewed && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <View style={consentStyles.checkboxTextContainer}>
                    <Text style={consentStyles.checkboxLabel}>Presa visione informativa *</Text>
                    <Text style={consentStyles.checkboxSubtext}>Dichiaro di aver letto e compreso l'informativa (obbligatorio)</Text>
                  </View>
                </TouchableOpacity>

                <View style={consentStyles.separator} />
                <Text style={consentStyles.optionalLabel}>Consensi facoltativi - immagini/video</Text>

                {/* Immagini uso interno - SOLO per minori (per adulti coperto da legittimo interesse) */}
                {isMinor && (
                <TouchableOpacity 
                  style={consentStyles.checkboxRow}
                  onPress={() => setConsentImagesInternal(!consentImagesInternal)}
                >
                  <View style={[consentStyles.checkbox, consentImagesInternal && (isMinor ? consentStyles.checkboxCheckedMinor : consentStyles.checkboxChecked)]}>
                    {consentImagesInternal && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <View style={consentStyles.checkboxTextContainer}>
                    <Text style={consentStyles.checkboxLabel}>Utilizzo immagini per uso interno</Text>
                    <Text style={consentStyles.checkboxSubtext}>Documentazione attività, comunicazioni alle famiglie</Text>
                  </View>
                </TouchableOpacity>
                )}

                {/* Immagini uso promozionale - FACOLTATIVA per tutti */}
                <TouchableOpacity 
                  style={consentStyles.checkboxRow}
                  onPress={() => setConsentImagesPromo(!consentImagesPromo)}
                >
                  <View style={[consentStyles.checkbox, consentImagesPromo && (isMinor ? consentStyles.checkboxCheckedMinor : consentStyles.checkboxChecked)]}>
                    {consentImagesPromo && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <View style={consentStyles.checkboxTextContainer}>
                    <Text style={consentStyles.checkboxLabel}>Utilizzo immagini per finalità promozionali</Text>
                    <Text style={consentStyles.checkboxSubtext}>Sito web, social, materiale pubblicitario</Text>
                  </View>
                </TouchableOpacity>
              </View>

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
                style={[styles.nextButton, isMinor && styles.nextButtonMinor, !consentPrivacyViewed && { backgroundColor: '#ccc' }]}
                onPress={() => {
                  if (!consentPrivacyViewed) {
                    alert('Devi confermare la presa visione dell\'informativa per procedere.');
                    return;
                  }
                  setStep(2);
                }}
              >
                <Text style={styles.nextButtonText}>Ho letto e compreso - Procedi alla firma</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>

              {showDeleteOption && onDeleteRequest && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 14,
                    borderRadius: 8,
                    marginTop: 10,
                    backgroundColor: '#FFEBEE',
                    borderWidth: 1,
                    borderColor: '#EF5350',
                    gap: 8,
                  }}
                  onPress={onDeleteRequest}
                  data-testid="gdpr-delete-data-btn"
                >
                  <Ionicons name="trash-outline" size={18} color="#C62828" />
                  <Text style={{ color: '#C62828', fontSize: 13, fontWeight: '600' }}>
                    Desidero non rimanere, cancella tutti i miei dati
                  </Text>
                </TouchableOpacity>
              )}
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
              <Text style={styles.pdfViewerTitle}>Anteprima Documento — {signerInfo.surname} {signerInfo.name}</Text>
              <TouchableOpacity 
                style={styles.pdfViewerCloseBtn} 
                onPress={() => setShowPdfViewer(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              {previewUrl && Platform.OS === 'web' ? (
                <iframe 
                  src={previewUrl + '#toolbar=1'} 
                  style={{ width: '100%', height: '100%', border: 'none', minHeight: 500 } as any}
                  title={`Anteprima PDF — ${signerInfo.surname} ${signerInfo.name}`}
                />
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                  <Ionicons name="document-text-outline" size={48} color="#8E44AD" />
                  <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginTop: 16 }}>
                    Caricamento PDF...
                  </Text>
                </View>
              )}
            </View>
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

const consentStyles = StyleSheet.create({
  consentSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  consentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#8E44AD',
    borderColor: '#8E44AD',
  },
  checkboxCheckedMinor: {
    backgroundColor: '#27AE60',
    borderColor: '#27AE60',
  },
  checkboxTextContainer: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  checkboxSubtext: {
    fontSize: 10,
    color: '#888',
    marginTop: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  optionalLabel: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 6,
  },
});
