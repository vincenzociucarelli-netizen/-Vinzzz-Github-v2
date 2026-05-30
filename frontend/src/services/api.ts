import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // CACHE BUSTING for PDF / blob downloads: append a fresh timestamp so the
    // browser never returns a cached response from another user (regression
    // happened when Lella saw VERDI VINCENZO's GDPR PDF). Applied to every GET
    // that asks for binary data or hits a /documents/* endpoint.
    try {
      const method = String(config.method || 'get').toLowerCase();
      const url = String(config.url || '');
      const isBinary = config.responseType === 'blob' || config.responseType === 'arraybuffer';
      const isDocEndpoint = /\/documents(\/|$)/.test(url) || /\/threshold(s)?(\/|$)/.test(url);
      if (method === 'get' && (isBinary || isDocEndpoint)) {
        config.params = { ...(config.params || {}), _t: Date.now() };
        config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        config.headers['Pragma'] = 'no-cache';
        config.headers['Expires'] = '0';
      }
    } catch {/* ignore */}
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Clear stored auth data only on 401 Unauthorized (expired/invalid token)
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      
      // Redirect to login (web only)
      if (typeof window !== 'undefined' && window.location) {
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    // 403 institutional_read_only: show friendly toast (web only — RN handles via component)
    if (
      error.response?.status === 403 &&
      error.response?.data?.code === 'institutional_read_only' &&
      typeof window !== 'undefined'
    ) {
      // Throttle: avoid spamming on bursts of write requests
      const now = Date.now();
      const last = (window as any).__lastInstReadOnlyToast || 0;
      if (now - last > 3500) {
        (window as any).__lastInstReadOnlyToast = now;
        try {
          window.alert(
            '🔒 Modalità SOLA LETTURA\n\nQuesto account è intestato alla Società e non può eseguire operazioni. Effettua il login con un account personale (Legale Rappresentante o Dirigente autorizzato) per modificare i dati.'
          );
        } catch {
          // ignore
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
