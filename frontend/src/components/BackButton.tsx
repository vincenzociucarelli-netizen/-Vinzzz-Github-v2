import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from './Icon';

interface BackButtonProps {
  color?: string;
  backgroundColor?: string;
  onPress?: () => void;
}

export const BackButton: React.FC<BackButtonProps> = ({ 
  color = '#007AFF',
  backgroundColor = '#fff',
  onPress
}) => {
  const router = useRouter();
  
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <View style={[styles.container, { backgroundColor }]}>
        <Ionicons name="chevron-back" size={24} color={color} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default BackButton;
