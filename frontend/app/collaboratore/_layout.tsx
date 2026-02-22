import { Stack } from 'expo-router';
import { View, Platform } from 'react-native';

export default function CollaboratoreLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#f5f5f5' },
          animation: Platform.OS === 'web' ? 'none' : 'default',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="compensation" />
      </Stack>
    </View>
  );
}
