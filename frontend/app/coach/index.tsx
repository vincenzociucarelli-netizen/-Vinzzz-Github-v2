import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';

export default function CoachScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setScanning(false);
    
    try {
      const response = await api.post('/attendance/check', { qr_code: data });
      const attendance = response.data;
      
      if (attendance.status === 'blocked') {
        Alert.alert(
          'Accesso Negato',
          attendance.block_reason || 'Atleta non autorizzato',
          [{ text: 'OK', onPress: () => setScanning(true) }]
        );
      } else {
        Alert.alert(
          'Presenza Registrata',
          'Atleta autorizzato e presenza registrata con successo!',
          [{ text: 'OK', onPress: () => setScanning(true) }]
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Errore',
        error.response?.data?.detail || 'Errore durante la registrazione',
        [{ text: 'OK', onPress: () => setScanning(true) }]
      );
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Sei sicuro di voler uscire?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Esci',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Scanner Presenze</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.content}>
          <Ionicons name="qr-code" size={100} color="#007AFF" />
          <Text style={styles.title}>Benvenuto, {user?.full_name}</Text>
          <Text style={styles.subtitle}>Per iniziare a scansionare i QR code degli atleti, abilita la fotocamera</Text>
          
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Ionicons name="camera" size={24} color="#fff" />
            <Text style={styles.buttonText}>Abilita Fotocamera</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Scanner Presenze</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.content}>
          <Ionicons name="close-circle" size={100} color="#FF3B30" />
          <Text style={styles.title}>Permesso Negato</Text>
          <Text style={styles.subtitle}>L'app necessita dell'accesso alla fotocamera per scansionare i QR code</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scanner Presenze</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {scanning ? (
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
            <Text style={styles.scannerText}>Inquadra il QR code dell'atleta</Text>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setScanning(false)}
            >
              <Text style={styles.cancelButtonText}>Annulla</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          <Ionicons name="qr-code" size={100} color="#007AFF" />
          <Text style={styles.title}>Pronto per scansionare</Text>
          <Text style={styles.subtitle}>Tocca il pulsante per iniziare a registrare le presenze</Text>
          
          <TouchableOpacity style={styles.button} onPress={() => setScanning(true)}>
            <Ionicons name="scan" size={24} color="#fff" />
            <Text style={styles.buttonText}>Scansiona QR Code</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push('/coach/history')}
          >
            <Ionicons name="list" size={20} color="#007AFF" />
            <Text style={styles.historyButtonText}>Storico Presenze</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  historyButtonText: {
    color: '#007AFF',
    fontSize: 16,
    marginLeft: 8,
  },
  scannerContainer: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  scannerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButton: {
    position: 'absolute',
    bottom: 50,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
