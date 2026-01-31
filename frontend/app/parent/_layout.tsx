import { Stack } from 'expo-router';

export default function ParentLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="register-athlete" />
      <Stack.Screen name="athlete/[id]" />
    </Stack>
  );
}
