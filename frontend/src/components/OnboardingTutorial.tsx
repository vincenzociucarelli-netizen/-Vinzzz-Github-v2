import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from './Icon';

const MAX_VIEWS = 3;

type TutorialStep = {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
};

type Props = {
  role: string;
  steps: TutorialStep[];
};

export function OnboardingTutorial({ role, steps }: Props) {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const STORAGE_KEY_COUNT = `${role}_tutorial_view_count`;
  const STORAGE_KEY_DISMISSED = `${role}_tutorial_dismissed`;

  useEffect(() => {
    checkShouldShow();
  }, []);

  const checkShouldShow = async () => {
    try {
      const dismissed = await AsyncStorage.getItem(STORAGE_KEY_DISMISSED);
      if (dismissed === 'true') return;
      const countStr = await AsyncStorage.getItem(STORAGE_KEY_COUNT);
      const count = countStr ? parseInt(countStr, 10) : 0;
      if (count < MAX_VIEWS) {
        await AsyncStorage.setItem(STORAGE_KEY_COUNT, String(count + 1));
        setVisible(true);
      }
    } catch (e) { console.log('OnboardingTutorial error:', e); }
  };

  const handleClose = async () => {
    if (dontShowAgain) {
      await AsyncStorage.setItem(STORAGE_KEY_DISMISSED, 'true');
    }
    setVisible(false);
    setCurrentStep(0);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
    else handleClose();
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.dots}>
            {steps.map((_, i) => (
              <View key={i} style={[s.dot, i === currentStep && s.dotActive]} />
            ))}
          </View>
          <View style={[s.iconCircle, { backgroundColor: step.iconBg }]}>  
            <Ionicons name={step.icon as any} size={36} color={step.iconColor} />
          </View>
          <Text style={s.title}>{step.title}</Text>
          <Text style={s.desc}>{step.description}</Text>
          {isLast && (
            <TouchableOpacity
              style={s.checkRow}
              onPress={() => setDontShowAgain(!dontShowAgain)}
              data-testid="dont-show-again-toggle"
            >
              <Ionicons
                name={dontShowAgain ? 'checkbox' : 'square-outline'}
                size={22}
                color={dontShowAgain ? '#007AFF' : '#999'}
              />
              <Text style={s.checkText}>Non mostrare più</Text>
            </TouchableOpacity>
          )}
          <View style={s.nav}>
            {currentStep > 0 ? (
              <TouchableOpacity onPress={handlePrev} style={s.navBtn} data-testid="tutorial-prev-btn">
                <Ionicons name="chevron-back" size={20} color="#007AFF" />
                <Text style={s.navBtnText}>Indietro</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleClose} style={s.navBtn} data-testid="tutorial-skip-btn">
                <Text style={[s.navBtnText, { color: '#999' }]}>Salta</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleNext} style={s.nextBtn} data-testid="tutorial-next-btn">
              <Text style={s.nextBtnText}>{isLast ? 'Ho capito' : 'Avanti'}</Text>
              {!isLast && <Ionicons name="chevron-forward" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Pre-configured tutorials per role
export const PARENT_STEPS: TutorialStep[] = [
  {
    icon: 'shield-checkmark',
    iconColor: '#FF9500',
    iconBg: '#FFF8E1',
    title: 'Protezione Dati',
    description: 'I dati personali del minore sono protetti da una password separata (Password Dati). Usala per accedere a informazioni sensibili come codice fiscale e indirizzo.',
  },
  {
    icon: 'document-text',
    iconColor: '#4CAF50',
    iconBg: '#E8F5E9',
    title: 'Certificato Medico',
    description: 'Puoi verificare la scadenza del certificato medico del tuo atleta. Riceverai un avviso quando sta per scadere.',
  },
  {
    icon: 'card',
    iconColor: '#2196F3',
    iconBg: '#E3F2FD',
    title: 'Pagamenti',
    description: 'Consulta lo stato dei pagamenti e le rate. Se la società lo desidera, potrà essere integrato il pagamento online con Stripe.',
  },
];

export const ATHLETE_STEPS: TutorialStep[] = [
  {
    icon: 'person-circle',
    iconColor: '#007AFF',
    iconBg: '#E3F2FD',
    title: 'Dati Personali',
    description: 'I tuoi dati personali sono modificabili dal tuo profilo. Mantienili aggiornati.',
  },
  {
    icon: 'document-text',
    iconColor: '#4CAF50',
    iconBg: '#E8F5E9',
    title: 'Certificato Medico',
    description: 'Controlla la scadenza del certificato medico. Riceverai un avviso 30 e 15 giorni prima della scadenza.',
  },
  {
    icon: 'card',
    iconColor: '#2196F3',
    iconBg: '#E3F2FD',
    title: 'Pagamenti',
    description: 'Consulta lo stato dei pagamenti e le rate. Se la società lo desidera, potrà essere integrato il pagamento online con Stripe.',
  },
];

export const COACH_STEPS: TutorialStep[] = [
  {
    icon: 'people',
    iconColor: '#E53935',
    iconBg: '#FFEBEE',
    title: 'Gestione Squadra',
    description: 'Qui trovi i tuoi atleti e puoi gestire presenze e allenamenti con la scansione del loro codice QR.',
  },
  {
    icon: 'calendar',
    iconColor: '#FF9500',
    iconBg: '#FFF8E1',
    title: 'Calendario',
    description: 'Consulta e gestisci il calendario degli allenamenti e delle gare.',
  },
  {
    icon: 'stats-chart',
    iconColor: '#4CAF50',
    iconBg: '#E8F5E9',
    title: 'Statistiche',
    description: 'Monitora le presenze e le statistiche della squadra.',
  },
];

export const COLLABORATORE_STEPS: TutorialStep[] = [
  {
    icon: 'eye',
    iconColor: '#7B1FA2',
    iconBg: '#F3E5F5',
    title: 'Panoramica',
    description: 'Hai accesso alla visualizzazione degli atleti e delle squadre della società.',
  },
  {
    icon: 'notifications',
    iconColor: '#FF9500',
    iconBg: '#FFF8E1',
    title: 'Scadenze',
    description: 'Tieni sotto controllo certificati medici e pagamenti in scadenza.',
  },
];

export const DIRIGENTE_STEPS: TutorialStep[] = [
  {
    icon: 'eye',
    iconColor: '#1565C0',
    iconBg: '#E3F2FD',
    title: 'Panoramica',
    description: 'Hai accesso alla visualizzazione degli atleti e delle squadre della società.',
  },
  {
    icon: 'notifications',
    iconColor: '#FF9500',
    iconBg: '#FFF8E1',
    title: 'Scadenze',
    description: 'Tieni sotto controllo certificati medici e pagamenti in scadenza.',
  },
];

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ddd' },
  dotActive: { backgroundColor: '#007AFF', width: 24 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 12, textAlign: 'center' },
  desc: { fontSize: 15, color: '#555', lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  checkText: { fontSize: 14, color: '#666' },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  navBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 4 },
  navBtnText: { fontSize: 15, color: '#007AFF', fontWeight: '500' },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 12, gap: 6,
  },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
