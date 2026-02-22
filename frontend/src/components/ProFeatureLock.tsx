import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from './Icon';

interface ProFeatureLockProps {
  featureName: string;
  description?: string;
  showBackButton?: boolean;
}

export const ProFeatureLock: React.FC<ProFeatureLockProps> = ({
  featureName,
  description = 'Questa funzionalità sarà disponibile nella versione PRO.',
  showBackButton = true,
}) => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed" size={64} color="#6c757d" />
        </View>
        
        <Text style={styles.title}>Modulo PRO</Text>
        <Text style={styles.featureName}>{featureName}</Text>
        
        <Text style={styles.description}>{description}</Text>
        
        <View style={styles.badge}>
          <Ionicons name="star" size={16} color="#ffc107" />
          <Text style={styles.badgeText}>Prossimamente</Text>
        </View>

        {showBackButton && (
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color="#007AFF" />
            <Text style={styles.backButtonText}>Torna indietro</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// Componente per le voci di menu bloccate
interface ProMenuItemProps {
  icon: string;
  label: string;
  onPress?: () => void;
}

export const ProMenuItem: React.FC<ProMenuItemProps> = ({
  icon,
  label,
  onPress,
}) => {
  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity style={styles.menuItem} onPress={handlePress}>
      <View style={styles.menuIconContainer}>
        <Ionicons name={icon as any} size={24} color="#6c757d" />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <View style={styles.lockBadge}>
        <Ionicons name="lock-closed" size={14} color="#6c757d" />
        <Text style={styles.lockText}>PRO</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  featureName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginBottom: 24,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  // Menu item styles
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    color: '#6c757d',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e9ecef',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  lockText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
  },
});

export default ProFeatureLock;
