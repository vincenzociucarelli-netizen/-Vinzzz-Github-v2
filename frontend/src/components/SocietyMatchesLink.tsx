import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from './Icon';

// 🆕 13/09/2026 — Link condiviso per aprire il Calendario Gare della società (sola lettura),
// presente nella dashboard di tutti gli utenti.
// 🎨 Restyle: colore pastello ben visibile + "pulsazione" per i primi secondi dopo l'apertura,
// così il banner si nota subito (prima era blu scuro, uguale all'header, e passava inosservato).
export default function SocietyMatchesLink() {
  const router = useRouter();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 4 pulsazioni (~4.8 s) poi il banner resta fermo
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
      { iterations: 4 },
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const badgeOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity style={styles.btn} onPress={() => router.push('/matches')} activeOpacity={0.85} testID="society-matches-link">
        <View style={styles.iconWrap}>
          <Ionicons name="trophy" size={22} color="#E65100" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Calendario Gare Società</Text>
          <Text style={styles.subtitle}>Vedi tutte le gare di tutte le squadre</Text>
        </View>
        <Animated.View style={[styles.badge, { opacity: badgeOpacity }]}>
          <Text style={styles.badgeText}>APRI</Text>
        </Animated.View>
        <Ionicons name="chevron-forward" size={20} color="#E65100" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF3E0', borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 2, borderColor: '#FFB74D', minHeight: 64,
    shadowColor: '#E65100', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFE0B2', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#BF360C', fontSize: 16, fontWeight: '800' },
  subtitle: { color: '#8D6E63', fontSize: 12, marginTop: 1 },
  badge: { backgroundColor: '#E65100', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
});
