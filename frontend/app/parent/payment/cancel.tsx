import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PaymentCancelPage() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="close-circle" size={72} color="#C62828" />
        <Text style={styles.title} data-testid="payment-cancel-title">Pagamento annullato</Text>
        <Text style={styles.subtitle}>
          Nessun addebito è stato effettuato. Puoi riprovare quando vuoi dalla scheda dell&apos;atleta.
        </Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.replace('/parent')}
          data-testid="payment-cancel-back-btn"
        >
          <Text style={styles.btnText}>Torna alla dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 28, alignItems: 'center',
    maxWidth: 460, width: '100%', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  btn: { marginTop: 8, backgroundColor: '#635BFF', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
