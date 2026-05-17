import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from './Icon';

export type TutorialStep = {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
};

type Props = {
  visible: boolean;
  steps: TutorialStep[];
  onClose: () => void;
  /** Optional testID prefix for buttons/modal */
  testIdPrefix?: string;
};

/**
 * Reusable multi-step tutorial modal. Opens when `visible` becomes true,
 * shows a paginated tour with prev/next buttons, dot indicators, and a
 * close X icon. Calls `onClose` when user dismisses or reaches end + clicks
 * "Ho capito".
 */
export function MultiStepTutorial({ visible, steps, onClose, testIdPrefix = 'tutorial' }: Props) {
  const [step, setStep] = useState(0);

  const handleClose = () => {
    setStep(0);
    onClose();
  };
  const handleNext = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else handleClose();
  };
  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (steps.length === 0) return null;
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <View style={s.card} data-testid={`${testIdPrefix}-modal`}>
          <TouchableOpacity style={s.close} onPress={handleClose} data-testid={`${testIdPrefix}-close-btn`}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <View style={s.dots}>
            {steps.map((_, i) => (
              <View key={i} style={[s.dot, i === step && s.dotActive]} />
            ))}
          </View>
          <View style={[s.iconCircle, { backgroundColor: current.iconBg }]}>
            <Ionicons name={current.icon as any} size={36} color={current.iconColor} />
          </View>
          <Text style={s.title}>{current.title}</Text>
          <Text style={s.desc}>{current.description}</Text>
          <View style={s.btnRow}>
            <TouchableOpacity
              style={[s.btn, s.btnSecondary, step === 0 && { opacity: 0.4 }]}
              onPress={handlePrev}
              disabled={step === 0}
              data-testid={`${testIdPrefix}-prev-btn`}
            >
              <Ionicons name="chevron-back" size={18} color="#007AFF" />
              <Text style={s.btnSecondaryText}>Indietro</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={handleNext} data-testid={`${testIdPrefix}-next-btn`}>
              <Text style={s.btnPrimaryText}>{isLast ? 'Ho capito' : 'Avanti'}</Text>
              {!isLast && <Ionicons name="chevron-forward" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
          <Text style={s.counter}>{step + 1} di {steps.length}</Text>
        </View>
      </View>
    </Modal>
  );
}

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
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  close: { position: 'absolute', top: 12, right: 12, padding: 4, zIndex: 2 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e0e0e0' },
  dotActive: { backgroundColor: '#007AFF', width: 24 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#000', textAlign: 'center', marginBottom: 12 },
  desc: { fontSize: 15, color: '#333', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  btnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 4,
  },
  btnPrimary: { backgroundColor: '#007AFF' },
  btnPrimaryText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  btnSecondary: { borderWidth: 1, borderColor: '#007AFF', backgroundColor: '#fff' },
  btnSecondaryText: { color: '#007AFF', fontWeight: '600', fontSize: 15 },
  counter: { marginTop: 12, fontSize: 12, color: '#999' },
});
