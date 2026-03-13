import { useState, useEffect } from 'react';
import api from '../services/api';

export function useLegalCheck(isAuthenticated: boolean) {
  const [legalAccepted, setLegalAccepted] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      checkLegal();
    }
  }, [isAuthenticated]);

  const checkLegal = async () => {
    try {
      const res = await api.get('/auth/me');
      setLegalAccepted(!!res.data.legal_accepted_at);
    } catch {
      setLegalAccepted(true); // Don't block on error
    } finally {
      setChecking(false);
    }
  };

  const markAccepted = () => {
    setLegalAccepted(true);
  };

  return { legalAccepted, legalChecking: checking, markLegalAccepted: markAccepted };
}
