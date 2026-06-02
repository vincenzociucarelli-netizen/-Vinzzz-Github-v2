import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from './Icon';

interface Props {
  visible: boolean;
  monthLabel: string;        // es. "Maggio 2026"
  ourAmount: number;         // importo che si firma con la nostra ASD
  // Cumulativo annuale GIÀ in DB (somma di tutte le quietanze firmate dell'anno
  // della nostra ASD + tutti gli importi esterni precedentemente dichiarati +
  // eventuale prior_compensation del primo anno di contratto). NON include
  // l'importo che si sta per firmare ora e nemmeno il nuovo importo esterno
  // che l'utente sta per dichiarare in questo step.
  alreadyCumulated?: number;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (data: { externalAmount: number; declaredNone: boolean }) => void;
}

/**
 * Modal pre-firma che chiede all'utente di auto-dichiarare gli eventuali
 * compensi sportivi percepiti da ALTRE ASD/SSD dall'ultima firma (o
 * dall'inizio dell'anno) ad oggi. Criterio: per CASSA.
 * L'importo si SOMMA al cumulativo annuale per il calcolo delle soglie 5K/15K.
 */
export default function ExternalCompensationStep({
  visible,
  monthLabel,
  ourAmount,
  alreadyCumulated = 0,
  loading,
  onCancel,
  onConfirm,
}: Props) {
  const [hasOther, setHasOther] = useState<null | boolean>(null);
  const [amountStr, setAmountStr] = useState('');
  const [touched, setTouched] = useState(false);

  const reset = () => {
    setHasOther(null);
    setAmountStr('');
    setTouched(false);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const parseAmount = () => {
    const v = parseFloat(amountStr.replace(',', '.'));
    return isNaN(v) ? 0 : Math.max(0, v);
  };

  const handleConfirm = () => {
    setTouched(true);
    if (hasOther === null) return;
    if (hasOther && parseAmount() <= 0) return;
    const data = hasOther
      ? { externalAmount: parseAmount(), declaredNone: false }
      : { externalAmount: 0, declaredNone: true };
    reset();
    onConfirm(data);
  };

  const externalAmount = parseAmount();
  // 📌 Totale cumulativo ANNUO che entrerà nel calcolo soglie 5K/15K dopo
  // questa firma: include quanto già firmato dell'anno + esterni già
  // dichiarati + quanto si firma adesso + l'eventuale nuovo esterno
  const projectedTotal = alreadyCumulated + ourAmount + (hasOther ? externalAmount : 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Ionicons name="information-circle" size={24} color="#1976D2" />
            <Text style={styles.title}>Prima di firmare</Text>
          </View>

          <Text style={styles.subtitle}>
            Stai per firmare la quietanza di <Text style={styles.bold}>{monthLabel}</Text> per
            <Text style={styles.bold}> € {ourAmount.toFixed(2)}</Text>.
          </Text>

          <View style={styles.divider} />

          <Text style={styles.question}>
            <Text style={styles.bold}>Dall'ultima firma ad oggi</Text>, hai percepito{' '}
            <Text style={styles.bold}>altri compensi sportivi dilettantistici da altre ASD/SSD</Text>?
          </Text>

          <Text style={styles.hint}>
            Importante: vale il criterio per <Text style={styles.bold}>CASSA</Text> (data di
            ricevimento), non per competenza. L'importo che dichiari si aggiungerà al cumulativo
            annuale per le soglie 5.000€ / 15.000€.
          </Text>

          <View style={styles.choiceRow}>
            <TouchableOpacity
              style={[styles.choice, hasOther === false && styles.choiceActiveNo]}
              onPress={() => setHasOther(false)}
              data-testid="ext-comp-no"
            >
              <Ionicons
                name={hasOther === false ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={hasOther === false ? '#2E7D32' : '#888'}
              />
              <Text style={styles.choiceText}>No, solo i compensi della nostra società</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.choice, hasOther === true && styles.choiceActiveYes]}
              onPress={() => setHasOther(true)}
              data-testid="ext-comp-yes"
            >
              <Ionicons
                name={hasOther === true ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={hasOther === true ? '#F9A825' : '#888'}
              />
              <Text style={styles.choiceText}>Sì, ho ricevuto altri compensi</Text>
            </TouchableOpacity>
          </View>

          {hasOther === true && (
            <View style={styles.amountWrap}>
              <Text style={styles.amountLabel}>Importo totale ricevuto da altre ASD/SSD</Text>
              <View style={styles.inputRow}>
                <Text style={styles.euro}>€</Text>
                <TextInput
                  value={amountStr}
                  onChangeText={setAmountStr}
                  placeholder="0,00"
                  keyboardType="decimal-pad"
                  style={styles.input}
                  data-testid="ext-comp-amount"
                />
              </View>
              {touched && hasOther && externalAmount <= 0 && (
                <Text style={styles.errorText}>Inserisci un importo maggiore di zero.</Text>
              )}
              <Text style={styles.preview}>
                Cumulativo annuo dopo la firma:{' '}
                <Text style={styles.bold}>€ {projectedTotal.toFixed(2)}</Text>
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={handleCancel}
              disabled={loading}
              style={styles.btnSecondary}
              data-testid="ext-comp-cancel"
            >
              <Text style={styles.btnSecondaryText}>Annulla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={loading || hasOther === null || (hasOther && externalAmount <= 0)}
              style={[
                styles.btnPrimary,
                (loading || hasOther === null || (hasOther && externalAmount <= 0)) && styles.btnDisabled,
              ]}
              data-testid="ext-comp-confirm"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>Prosegui alla firma</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 18 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 20, maxWidth: 520, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 18, fontWeight: '700', marginLeft: 8, color: '#1976D2' },
  subtitle: { fontSize: 14, color: '#333', lineHeight: 20, marginBottom: 8 },
  bold: { fontWeight: '700', color: '#000' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },
  question: { fontSize: 14, color: '#333', lineHeight: 20, marginBottom: 8 },
  hint: { fontSize: 12, color: '#666', lineHeight: 17, backgroundColor: '#FFF8E1', padding: 10, borderRadius: 8, marginBottom: 12 },
  choiceRow: { gap: 8 },
  choice: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', gap: 10 },
  choiceActiveNo: { borderColor: '#2E7D32', backgroundColor: '#E8F5E9' },
  choiceActiveYes: { borderColor: '#F9A825', backgroundColor: '#FFF8E1' },
  choiceText: { fontSize: 14, color: '#222', flex: 1 },
  amountWrap: { marginTop: 14 },
  amountLabel: { fontSize: 13, color: '#555', marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, backgroundColor: '#fafafa' },
  euro: { fontSize: 17, color: '#444', marginRight: 6 },
  input: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#000' },
  errorText: { color: '#D32F2F', fontSize: 12, marginTop: 6 },
  preview: { fontSize: 13, color: '#333', marginTop: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  btnSecondary: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#e0e0e0' },
  btnSecondaryText: { color: '#333', fontWeight: '600' },
  btnPrimary: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1976D2', minWidth: 170, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
