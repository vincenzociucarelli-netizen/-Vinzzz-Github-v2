import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../../src/components/Icon';
import InstitutionalBanner from '../../../src/components/InstitutionalBanner';
import SocietyBranding from '../../../src/components/SocietyBranding';
import api from '../../../src/services/api';

interface StripeSettings {
  stripe_enabled: boolean;
  stripe_mode: string;
  stripe_publishable_key_masked?: string;
  stripe_secret_key_masked?: string;
  stripe_webhook_secret_masked?: string;
  has_publishable_key: boolean;
  has_secret_key: boolean;
  has_webhook_secret: boolean;
  payment_description?: string;
  currency: string;
  send_payment_emails: boolean;
}

export default function StripeSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<StripeSettings | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  
  // Form state for new keys
  const [publishableKey, setPublishableKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [sendEmails, setSendEmails] = useState(true);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [editingKeys, setEditingKeys] = useState(false);
  // 🆕 16/07/2026 — URL webhook multi-tenant per questa società
  const [webhookUrl, setWebhookUrl] = useState<string>('');

  useEffect(() => {
    checkAccessAndLoad();
  }, []);

  const checkAccessAndLoad = async () => {
    try {
      const authResponse = await api.get('/auth/me');
      if (authResponse.data?.role !== 'admin') {
        setIsAdmin(false);
        router.replace('/');
        return;
      }
      setIsAdmin(true);
      await loadSettings();
    } catch (error) {
      setIsAdmin(false);
      router.replace('/');
    }
  };

  const loadSettings = async () => {
    try {
      const response = await api.get('/settings/stripe');
      setSettings(response.data);
      setStripeEnabled(response.data.stripe_enabled || false);
      setPaymentDescription(response.data.payment_description || '');
      setSendEmails(response.data.send_payment_emails !== false);
      // 🆕 16/07/2026 — Recupera l'URL webhook da mostrare all'admin
      try {
        const w = await api.get('/settings/stripe/webhook-url');
        setWebhookUrl(w.data?.webhook_url || '');
      } catch (_e) {
        setWebhookUrl('');
      }
    } catch (error) {
      console.error('Error loading Stripe settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        stripe_enabled: stripeEnabled,
        payment_description: paymentDescription,
        send_payment_emails: sendEmails,
      };

      // Include keys se sono in modifica o se non esistono ancora (primo salvataggio)
      // 🐛 16/07/2026 — Fix: al primo salvataggio (hasKeys=false) `editingKeys` non
      // veniva attivato → le chiavi digitate non venivano inviate al backend.
      const shouldSendKeys = editingKeys || !settings?.has_publishable_key || !settings?.has_secret_key;
      if (shouldSendKeys) {
        if (publishableKey) payload.stripe_publishable_key = publishableKey;
        if (secretKey) payload.stripe_secret_key = secretKey;
      }
      // Webhook secret: inviato SEMPRE quando compilato (card dedicata sempre editabile).
      if (webhookSecret) payload.stripe_webhook_secret = webhookSecret;

      await api.patch('/settings/stripe', payload);
      
      if (Platform.OS === 'web') {
        alert('Impostazioni Stripe salvate con successo!');
      }
      
      // Reload settings to get masked keys
      await loadSettings();
      setEditingKeys(false);
      setPublishableKey('');
      setSecretKey('');
      setWebhookSecret('');
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Errore nel salvataggio';
      if (Platform.OS === 'web') {
        alert(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKeys = async () => {
    const confirm = Platform.OS === 'web' 
      ? window.confirm('Sei sicuro di voler eliminare tutte le chiavi Stripe? I pagamenti verranno disabilitati.')
      : true;
    
    if (!confirm) return;
    
    try {
      await api.delete('/settings/stripe/keys');
      if (Platform.OS === 'web') {
        alert('Chiavi Stripe eliminate con successo');
      }
      await loadSettings();
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Errore nell\'eliminazione';
      if (Platform.OS === 'web') {
        alert(msg);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6772E5" />
        <Text style={styles.loadingText}>Caricamento impostazioni Stripe...</Text>
      </View>
    );
  }

  const hasKeys = settings?.has_publishable_key && settings?.has_secret_key;
  const isTestMode = settings?.stripe_mode === 'test';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
          <SocietyBranding logoSize={32} />
          <Text style={styles.headerTitle} numberOfLines={1}>Impostazioni Pagamenti</Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/admin')} data-testid="header-home-btn" style={{ marginRight: 4 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 }}><Ionicons name="home" size={20} color="#007AFF" /></View>
        </TouchableOpacity>
      </View>

      <InstitutionalBanner detail="L'IBAN/conto della società è qui solo per riferimento. La firma sui pagamenti spetta al Legale Rappresentante." />

      <ScrollView style={styles.content}>
        {/* Stripe Logo & Info */}
        <View style={styles.stripeHeader}>
          <View style={styles.stripeLogo}>
            <Text style={styles.stripeLogoText}>stripe</Text>
          </View>
          <Text style={styles.stripeSubtitle}>
            Configura i pagamenti online per la tua società sportiva
          </Text>
        </View>

        {/* Enable/Disable Toggle */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Pagamenti Online</Text>
              <Text style={styles.toggleDescription}>
                Abilita i pagamenti con carta di credito
              </Text>
            </View>
            <Switch
              value={stripeEnabled}
              onValueChange={setStripeEnabled}
              trackColor={{ false: '#ddd', true: '#6772E5' }}
              thumbColor={stripeEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Status Badge */}
        {hasKeys && (
          <View style={[styles.statusBadge, isTestMode ? styles.statusTest : styles.statusLive]}>
            <Ionicons 
              name={isTestMode ? "flask" : "checkmark-circle"} 
              size={18} 
              color={isTestMode ? "#F0AD4E" : "#27AE60"} 
            />
            <Text style={[styles.statusText, isTestMode ? styles.statusTextTest : styles.statusTextLive]}>
              {isTestMode ? 'MODALITÀ TEST' : 'MODALITÀ LIVE'}
            </Text>
          </View>
        )}

        {/* API Keys Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Chiavi API Stripe</Text>
            {hasKeys && !editingKeys && (
              <TouchableOpacity onPress={() => setEditingKeys(true)}>
                <Ionicons name="create-outline" size={22} color="#6772E5" />
              </TouchableOpacity>
            )}
          </View>

          {!hasKeys || editingKeys ? (
            <>
              <Text style={styles.inputLabel}>Chiave Pubblica (Publishable Key)</Text>
              <TextInput
                style={styles.input}
                value={publishableKey}
                onChangeText={setPublishableKey}
                placeholder="pk_test_... o pk_live_..."
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.inputHint}>
                Inizia con pk_test_ (test) o pk_live_ (produzione)
              </Text>

              <Text style={styles.inputLabel}>Chiave Segreta (Secret Key)</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={secretKey}
                  onChangeText={setSecretKey}
                  placeholder="sk_test_... o sk_live_..."
                  placeholderTextColor="#999"
                  secureTextEntry={!showSecretKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity 
                  style={styles.eyeButton}
                  onPress={() => setShowSecretKey(!showSecretKey)}
                >
                  <Ionicons name={showSecretKey ? "eye-off" : "eye"} size={20} color="#666" />
                </TouchableOpacity>
              </View>
              <Text style={styles.inputHint}>
                Inizia con sk_test_ (test) o sk_live_ (produzione)
              </Text>

              <Text style={styles.inputLabel}>Webhook Secret (opzionale)</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={webhookSecret}
                  onChangeText={setWebhookSecret}
                  placeholder="whsec_..."
                  placeholderTextColor="#999"
                  secureTextEntry={!showWebhookSecret}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity 
                  style={styles.eyeButton}
                  onPress={() => setShowWebhookSecret(!showWebhookSecret)}
                >
                  <Ionicons name={showWebhookSecret ? "eye-off" : "eye"} size={20} color="#666" />
                </TouchableOpacity>
              </View>
              <Text style={styles.inputHint}>
                Per conferme automatiche dei pagamenti
              </Text>

              {/* 🆕 16/07/2026 — URL webhook multi-tenant da incollare in Stripe Dashboard */}
              {webhookUrl && (
                <View style={{
                  marginTop: 14, padding: 12, backgroundColor: '#EDE9FE',
                  borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#635BFF',
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#4C1D95', marginBottom: 4 }}>
                    🔗 URL WEBHOOK PER STRIPE DASHBOARD
                  </Text>
                  <Text selectable style={{ fontSize: 11, color: '#1a1a1a', fontFamily: 'monospace', backgroundColor: '#fff', padding: 8, borderRadius: 6, marginBottom: 6 }}>
                    {webhookUrl}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#4C1D95', lineHeight: 15 }}>
                    Copia questo URL in Stripe → Developers → Webhooks → Aggiungi endpoint.
                    Eventi da sottoscrivere: <Text style={{ fontWeight: '700' }}>checkout.session.completed</Text> e <Text style={{ fontWeight: '700' }}>checkout.session.expired</Text>.
                    Dopo l&apos;aggiunta, Stripe ti darà un &quot;Signing secret&quot; (whsec_...) che devi incollare qui sopra.
                  </Text>
                </View>
              )}

              {editingKeys && (
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => {
                    setEditingKeys(false);
                    setPublishableKey('');
                    setSecretKey('');
                    setWebhookSecret('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Annulla modifica</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <View style={styles.keyRow}>
                <Text style={styles.keyLabel}>Chiave Pubblica:</Text>
                <Text style={styles.keyValue}>{settings?.stripe_publishable_key_masked || '-'}</Text>
                <Ionicons name="checkmark-circle" size={18} color="#27AE60" />
              </View>
              <View style={styles.keyRow}>
                <Text style={styles.keyLabel}>Chiave Segreta:</Text>
                <Text style={styles.keyValue}>{settings?.stripe_secret_key_masked || '-'}</Text>
                <Ionicons name="checkmark-circle" size={18} color="#27AE60" />
              </View>
              {settings?.has_webhook_secret && (
                <View style={styles.keyRow}>
                  <Text style={styles.keyLabel}>Webhook Secret:</Text>
                  <Text style={styles.keyValue}>{settings?.stripe_webhook_secret_masked || '-'}</Text>
                  <Ionicons name="checkmark-circle" size={18} color="#27AE60" />
                </View>
              )}
            </>
          )}
        </View>

        {/* 🆕 16/07/2026 — Card Webhook: URL da copiare + campo whsec sempre editabili */}
        {hasKeys && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Webhook Stripe (conferma automatica pagamenti)</Text>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 12, lineHeight: 17 }}>
              Segui questi 3 passaggi per attivare le conferme automatiche:
            </Text>

            <View style={{ backgroundColor: '#EDE9FE', borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#635BFF', padding: 12, marginBottom: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#4C1D95', marginBottom: 6 }}>
                1️⃣ COPIA QUESTO URL
              </Text>
              <Text selectable style={{ fontSize: 11, color: '#1a1a1a', fontFamily: 'monospace', backgroundColor: '#fff', padding: 8, borderRadius: 6, marginBottom: 6 }} data-testid="stripe-webhook-url">
                {webhookUrl || 'Caricamento...'}
              </Text>
              <Text style={{ fontSize: 11, color: '#4C1D95', lineHeight: 15 }}>
                2️⃣ Incollalo su <Text style={{ fontWeight: '700' }}>dashboard.stripe.com/test/webhooks</Text> → &quot;Aggiungi endpoint&quot;.
                {'\n'}Eventi da sottoscrivere: <Text style={{ fontWeight: '700' }}>checkout.session.completed</Text> e <Text style={{ fontWeight: '700' }}>checkout.session.expired</Text>.
                {'\n'}3️⃣ Stripe ti darà un &quot;Signing secret&quot; che inizia con <Text style={{ fontWeight: '700' }}>whsec_...</Text> → incollalo qui sotto.
              </Text>
            </View>

            <Text style={styles.inputLabel}>Webhook Signing Secret</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={webhookSecret}
                onChangeText={setWebhookSecret}
                placeholder={settings?.has_webhook_secret ? (settings.stripe_webhook_secret_masked || 'whsec_...') : 'whsec_...'}
                placeholderTextColor="#999"
                secureTextEntry={!showWebhookSecret}
                autoCapitalize="none"
                autoCorrect={false}
                data-testid="stripe-webhook-secret-input"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowWebhookSecret(!showWebhookSecret)}
              >
                <Ionicons name={showWebhookSecret ? "eye-off" : "eye"} size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={styles.inputHint}>
              {settings?.has_webhook_secret
                ? 'Un secret è già salvato. Incolla un nuovo whsec_... solo se vuoi sostituirlo.'
                : 'Ancora nessun secret salvato. Incolla il whsec_... da Stripe qui e premi Salva Impostazioni in fondo.'}
            </Text>
          </View>
        )}

        {/* Payment Options */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Opzioni Pagamento</Text>
          
          <Text style={styles.inputLabel}>Descrizione Pagamento</Text>
          <TextInput
            style={styles.input}
            value={paymentDescription}
            onChangeText={setPaymentDescription}
            placeholder="es. Quota associativa stagione 2025/2026"
            placeholderTextColor="#999"
          />
          
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Email di conferma</Text>
              <Text style={styles.toggleDescription}>
                Invia email di conferma ai genitori
              </Text>
            </View>
            <Switch
              value={sendEmails}
              onValueChange={setSendEmails}
              trackColor={{ false: '#ddd', true: '#6772E5' }}
              thumbColor={sendEmails ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#6772E5" />
          <Text style={styles.infoText}>
            Per ottenere le chiavi API, accedi al tuo{' '}
            <Text style={styles.infoLink}>Dashboard Stripe</Text> → 
            Sviluppatori → Chiavi API
          </Text>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="save" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Salva Impostazioni</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Delete Keys Button */}
        {hasKeys && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteKeys}>
            <Ionicons name="trash-outline" size={18} color="#E74C3C" />
            <Text style={styles.deleteButtonText}>Elimina tutte le chiavi</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  header: {
    backgroundColor: '#6772E5',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  stripeHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  stripeLogo: {
    backgroundColor: '#6772E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  stripeLogoText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  stripeSubtitle: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  toggleDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  statusTest: {
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#F0AD4E',
  },
  statusLive: {
    backgroundColor: '#D4EDDA',
    borderWidth: 1,
    borderColor: '#27AE60',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusTextTest: {
    color: '#856404',
  },
  statusTextLive: {
    color: '#155724',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
  },
  inputHint: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 14,
    color: '#333',
  },
  eyeButton: {
    padding: 12,
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 8,
  },
  keyLabel: {
    fontSize: 13,
    color: '#666',
    width: 100,
  },
  keyValue: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 12,
  },
  cancelButtonText: {
    color: '#6772E5',
    fontSize: 14,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#4338CA',
    lineHeight: 20,
  },
  infoLink: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  saveButton: {
    backgroundColor: '#6772E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 10,
    gap: 10,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    marginTop: 12,
    gap: 8,
  },
  deleteButtonText: {
    color: '#E74C3C',
    fontSize: 14,
  },
});
