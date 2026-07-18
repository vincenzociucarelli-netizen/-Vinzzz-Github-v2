import React from 'react';
import { Stack } from 'expo-router';

/**
 * 🆕 27/07/2026 — Layout pubblico (no auth) per il flusso di attivazione
 * dei piani ricorrenti. Il token nell'URL fornisce l'accesso al piano.
 */
export default function RecurringLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[token]/index" />
      <Stack.Screen name="[token]/success" />
    </Stack>
  );
}
