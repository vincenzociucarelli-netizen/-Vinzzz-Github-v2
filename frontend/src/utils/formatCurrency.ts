/**
 * Formatta un valore numerico come valuta italiana
 * @param value - Il valore numerico da formattare
 * @param showSymbol - Se mostrare il simbolo € (default: true)
 * @param decimals - Numero di decimali (default: 2, usa 0 per interi)
 * @returns Stringa formattata es: "€ 1.234,56" o "1.234,56"
 */
export function formatCurrency(
  value: number | string | null | undefined,
  showSymbol: boolean = true,
  decimals: number = 2
): string {
  // Gestisci valori nulli o undefined
  if (value === null || value === undefined || value === '') {
    return showSymbol ? '€ 0,00' : '0,00';
  }

  // Converti in numero
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  // Gestisci NaN
  if (isNaN(num)) {
    return showSymbol ? '€ 0,00' : '0,00';
  }

  // Formatta con locale italiano (punto migliaia, virgola decimali)
  const formatted = num.toLocaleString('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return showSymbol ? `€ ${formatted}` : formatted;
}

/**
 * Versione breve senza simbolo € per uso in contesti dove € è già presente
 */
export function formatAmount(value: number | string | null | undefined, decimals: number = 2): string {
  return formatCurrency(value, false, decimals);
}

/**
 * Formatta come intero (senza decimali) - utile per importi tondi
 */
export function formatCurrencyInt(value: number | string | null | undefined, showSymbol: boolean = true): string {
  return formatCurrency(value, showSymbol, 0);
}
