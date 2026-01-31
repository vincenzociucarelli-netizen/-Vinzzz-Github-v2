import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="teams" />
      <Stack.Screen name="athletes" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="attendances" />
    </Stack>
  );
}
