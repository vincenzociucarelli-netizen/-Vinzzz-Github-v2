import React, { useEffect, useState, useCallback } from 'react';
import { Stack } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { View, Platform, Alert } from 'react-native';
import GlobalReadOnlyBanner from '../src/components/GlobalReadOnlyBanner';
import CookieBanner from '../src/components/CookieBanner';

// Keep splash screen visible while loading fonts
SplashScreen.preventAutoHideAsync();

// 🆕 23/02/2026 — Web SEO: title + meta description + apple-touch-icon
// Google indicizzava "frontend" come titolo e mostrava "sito inattivo" perché la SPA
// non aveva metadati. Settiamo i tag a runtime appena il bundle JS parte.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  try {
    document.title = 'RegistraTEAM — Software gestionale società sportive';
    const ensureMeta = (name: string, content: string, attr: 'name' | 'property' = 'name') => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    ensureMeta('description', 'RegistraTEAM — Software gestionale per società sportive: tesseramenti, presenze, compensi, GDPR, Riforma Sport. Pallavolo, calcio e altre discipline.');
    ensureMeta('og:title', 'RegistraTEAM — Software gestionale società sportive', 'property');
    ensureMeta('og:description', 'Gestionale all-in-one per società sportive: tesseramenti, presenze, compensi, Riforma Sport, GDPR.', 'property');
    ensureMeta('og:type', 'website', 'property');
    ensureMeta('og:image', '/favicon.ico', 'property');
    ensureMeta('twitter:card', 'summary');
    ensureMeta('twitter:title', 'RegistraTEAM');
    ensureMeta('twitter:description', 'Gestionale all-in-one per società sportive.');
  } catch { /* SSR safe */ }
}

// 🆕 22/02/2026 — Monkey-patch globale Alert.alert per il web.
// CAUSA: react-native-web 0.21 ha `Alert.alert` come NO-OP totale → nessun feedback
// si vede mai sul web (Anna Coach firma €5k bloccata, Sarnari Andrea, Fede, ecc.).
// FIX: rimpiazziamo Alert.alert con un'implementazione basata su window.alert/confirm
// così TUTTE le ~391 chiamate Alert.alert esistenti nel codebase funzionano sul web
// senza dover toccare ogni singolo call-site.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  (Alert as any).alert = (title: string, message?: string, buttons?: Array<{ text?: string; onPress?: () => void; style?: string }>) => {
    const fullText = message ? `${title}\n\n${message}` : title;
    try {
      if (!buttons || buttons.length <= 1) {
        if (typeof window.alert === 'function') window.alert(fullText);
        if (buttons && buttons[0]?.onPress) {
          try { buttons[0].onPress(); } catch { /* no-op */ }
        }
        return;
      }
      // Più bottoni: window.confirm (OK = primario, Annulla = cancel)
      const primary = buttons.find(b => b.style !== 'cancel') || buttons[buttons.length - 1];
      const cancel = buttons.find(b => b.style === 'cancel');
      const choice = typeof window.confirm === 'function'
        ? window.confirm(`${fullText}\n\n[ OK = ${primary?.text || 'OK'} ] [ Annulla = ${cancel?.text || 'Annulla'} ]`)
        : true;
      if (choice && primary?.onPress) {
        try { primary.onPress(); } catch { /* no-op */ }
      } else if (!choice && cancel?.onPress) {
        try { cancel.onPress(); } catch { /* no-op */ }
      }
    } catch {
      // Fallback silenzioso (es. SSR senza window)
    }
  };
}

export default function RootLayout() {
  const loadAuth = useAuthStore((state) => state.loadAuth);
  const [appIsReady, setAppIsReady] = useState(false);

  // Load Ionicons font from local assets for reliable web support
  const [fontsLoaded] = useFonts({
    'Ionicons': require('../assets/fonts/Ionicons.ttf'),
  });

  useEffect(() => {
    async function prepare() {
      try {
        await loadAuth();
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady && fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady, fontsLoaded]);

  if (!appIsReady || !fontsLoaded) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <GlobalReadOnlyBanner />
      <CookieBanner />
      <Stack screenOptions={{ headerShown: false }}>        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="register-society" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="coach" />
        <Stack.Screen name="parent" />
        <Stack.Screen name="minor" />
        <Stack.Screen name="preseason" />
        <Stack.Screen name="palestre" />
        <Stack.Screen name="convocations/index" />
        <Stack.Screen name="convocations/editor" />
        <Stack.Screen name="admin/whatsapp-reminders" />
        <Stack.Screen name="admin/whatsapp-settings" />
      </Stack>
    </View>
  );
}
