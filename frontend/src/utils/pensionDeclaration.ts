/**
 * 🆕 Utility condivise per la Dichiarazione della posizione previdenziale.
 */
export const formatPensionDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  try {
    let s = String(iso);
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s = s + 'Z';
    return new Date(s).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Rome',
    });
  } catch { return String(iso); }
};

export const pensionStatusStyle = (status: string) => {
  switch (status) {
    case 'signed':
      return { label: 'FIRMATA', color: '#1B5E20', bg: '#E8F5E9', border: '#34C759', icon: 'checkmark-circle' };
    case 'to_verify':
      return { label: 'DA VERIFICARE', color: '#92400E', bg: '#FEF3C7', border: '#F59E0B', icon: 'alert-circle' };
    default:
      return { label: 'NON DICHIARATA', color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB', icon: 'remove-circle' };
  }
};

export const ROLE_LABEL_IT: Record<string, string> = {
  coach: 'Coach',
  dirigente: 'Dirigente',
  viewer: 'Dirigente',
  collaboratore: 'Collaboratore',
  atleta_pro: 'Atleta Pro',
  athlete: 'Atleta Pro',
};

/** Etichetta ruolo; per dual-role ("coach+atleta_pro") → "Coach + Atleta Pro". */
export const roleLabelIt = (role: string): string =>
  (role || '').split('+').map((r) => ROLE_LABEL_IT[r] || r).join(' + ');
