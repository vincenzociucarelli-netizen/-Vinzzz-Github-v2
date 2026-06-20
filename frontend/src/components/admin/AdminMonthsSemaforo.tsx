/**
 * 🆕 22/06/2026 — AdminMonthsSemaforo
 *
 * Mostra una griglia di "mesi" colorati (semaforo) replicando esattamente la
 * logica usata nella vista user `/coach/compensation.tsx`:
 *   • VERDE = quietanza firmata
 *   • ARANCIO (#FFF8E1 / bordo #F9A825) = mese che supera la soglia €5.000
 *   • VIOLA (#F3E5F5 / bordo #8E44AD) = mese che supera la soglia €15.000
 *   • GRIGIO = mese fuori contratto / futuro
 *   • Badge >5K / >15K nei mesi proiettati sopra soglia
 *
 * Read-only: nessuna azione di firma, solo visualizzazione per l'admin.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCurrency } from '../../utils/formatCurrency';

const MONTH_NAMES = [
  '', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
];

interface ReceiptLike {
  month: number | string;
  year: number;
  amount_gross?: number;
  amount?: number;
  receipt_signed?: boolean;
  receipt_signed_date?: string;
}

interface ExternalLike {
  year: number;
  amount: number;
}

interface Props {
  /** Anno solare da mostrare (le soglie si calcolano per anno). */
  year: number;
  contractStartYear: number | null;
  contractStartMonth: number | null;
  contractEndYear: number | null;
  contractEndMonth: number | null;
  monthlyAmount: number;
  priorCompensation?: number;
  signedReceipts: ReceiptLike[];
  externalDeclarations?: ExternalLike[];
}

const matchesMonth = (recordMonth: number | string, target: number): boolean => {
  if (typeof recordMonth === 'number') return recordMonth === target;
  const longNames = [
    '', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
  ];
  return longNames.indexOf(recordMonth) === target;
};

export const AdminMonthsSemaforo: React.FC<Props> = ({
  year,
  contractStartYear,
  contractStartMonth,
  contractEndYear,
  contractEndMonth,
  monthlyAmount,
  priorCompensation = 0,
  signedReceipts,
  externalDeclarations = [],
}) => {
  // Compute external per-year
  const externalForYear = externalDeclarations
    .filter((e) => Number(e.year) === year)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Determine contract months for this year
  const isStartYear = contractStartYear === year;
  const isEndYear = contractEndYear === year;
  const yearStartMonth = isStartYear && contractStartMonth ? contractStartMonth : 1;
  const yearEndMonth = isEndYear && contractEndMonth ? contractEndMonth : 12;

  // Project cumulative: signed + unsigned (using monthlyAmount default), in chronological order
  const recordMap: Record<number, ReceiptLike | undefined> = {};
  for (const r of signedReceipts) {
    if (r.year !== year) continue;
    for (let m = 1; m <= 12; m++) {
      if (matchesMonth(r.month, m)) {
        recordMap[m] = r;
        break;
      }
    }
  }

  // Starting cumulative includes prior (only for start year) + external declarations this year
  let firstCross5k: number | null = null;
  let firstCross15k: number | null = null;
  const cumulPerMonth: Record<number, number> = {};

  let cumul = 0;
  if (isStartYear) cumul += (priorCompensation || 0);
  cumul += externalForYear;

  // If priors/external already exceed thresholds, mark from first contract month
  if (cumul > 5000) firstCross5k = yearStartMonth;
  if (cumul > 15000) firstCross15k = yearStartMonth;

  for (let m = 1; m <= 12; m++) {
    const rec = recordMap[m];
    const inContract = m >= yearStartMonth && m <= yearEndMonth;
    const amount = rec
      ? (rec.amount_gross || rec.amount || monthlyAmount)
      : (inContract ? monthlyAmount : 0);
    if (amount > 0) cumul += amount;
    cumulPerMonth[m] = cumul;
    if (cumul > 5000 && firstCross5k === null) firstCross5k = m;
    if (cumul > 15000 && firstCross15k === null) firstCross15k = m;
  }

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;

  const getMonthStatus = (m: number): 'signed' | 'pending' | 'future' | 'out' => {
    if (m < yearStartMonth || m > yearEndMonth) return 'out';
    const rec = recordMap[m];
    if (rec?.receipt_signed) return 'signed';
    if (year > nowYear || (year === nowYear && m > nowMonth)) return 'future';
    return 'pending';
  };

  const monthsToRender = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <View style={styles.container} data-testid={`admin-semaforo-${year}`}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>📅 Calendario quietanze {year}</Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
            <Text style={styles.legendText}>Firmato</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F9A825' }]} />
            <Text style={styles.legendText}>&gt;5K</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#8E44AD' }]} />
            <Text style={styles.legendText}>&gt;15K</Text>
          </View>
        </View>
      </View>
      <View style={styles.grid}>
        {monthsToRender.map((m) => {
          const status = getMonthStatus(m);
          const isAfter5k = firstCross5k !== null && m >= firstCross5k && status !== 'out';
          const isAfter15k = firstCross15k !== null && m >= firstCross15k && status !== 'out';
          const showBadge15k = isAfter15k;
          const showBadge5k = isAfter5k && !isAfter15k;

          const cardStyle: any[] = [styles.card];
          if (status === 'out') cardStyle.push(styles.cardOut);
          else if (status === 'future') cardStyle.push(styles.cardFuture);
          else if (status === 'signed') {
            if (isAfter15k) cardStyle.push(styles.cardSigned15k);
            else if (isAfter5k) cardStyle.push(styles.cardSigned5k);
            else cardStyle.push(styles.cardSigned);
          } else {
            // pending
            if (isAfter15k) cardStyle.push(styles.cardPending15k);
            else if (isAfter5k) cardStyle.push(styles.cardPending5k);
            else cardStyle.push(styles.cardPending);
          }

          const rec = recordMap[m];
          const monthAmount = rec
            ? (rec.amount_gross || rec.amount || monthlyAmount)
            : (status !== 'out' ? monthlyAmount : 0);

          return (
            <View key={m} style={cardStyle} data-testid={`admin-month-${year}-${m}`}>
              {(showBadge5k || showBadge15k) && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: showBadge15k ? '#8E44AD' : '#F9A825' },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {showBadge15k ? '>15K' : '>5K'}
                  </Text>
                </View>
              )}
              <Text style={styles.monthName}>{MONTH_NAMES[m]}</Text>
              {status === 'out' ? (
                <Text style={styles.outText}>—</Text>
              ) : (
                <Text style={styles.amount}>{formatCurrency(monthAmount)}</Text>
              )}
              {status === 'signed' && (
                <Text style={styles.signedTag}>✓ Firmato</Text>
              )}
              {status === 'pending' && (
                <Text style={styles.pendingTag}>In attesa</Text>
              )}
              {status === 'future' && (
                <Text style={styles.futureTag}>Futuro</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#6B7280',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  card: {
    width: '23%',
    minHeight: 60,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cardOut: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    opacity: 0.5,
  },
  cardFuture: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
    opacity: 0.7,
  },
  cardSigned: {
    backgroundColor: '#F0FFF4',
    borderColor: '#34C759',
  },
  cardSigned5k: {
    backgroundColor: '#FFF8E1',
    borderColor: '#F9A825',
  },
  cardSigned15k: {
    backgroundColor: '#F3E5F5',
    borderColor: '#8E44AD',
  },
  cardPending: {
    backgroundColor: '#fff',
    borderColor: '#1565C0',
    borderStyle: 'dashed',
  },
  cardPending5k: {
    backgroundColor: '#FFFDE7',
    borderColor: '#F9A825',
    borderStyle: 'dashed',
  },
  cardPending15k: {
    backgroundColor: '#FAF4FC',
    borderColor: '#8E44AD',
    borderStyle: 'dashed',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    zIndex: 5,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  monthName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
  },
  amount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1565C0',
    marginTop: 2,
  },
  outText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 2,
  },
  signedTag: {
    fontSize: 9,
    color: '#15803D',
    marginTop: 2,
    fontWeight: '600',
  },
  pendingTag: {
    fontSize: 9,
    color: '#1565C0',
    marginTop: 2,
    fontStyle: 'italic',
  },
  futureTag: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 2,
    fontStyle: 'italic',
  },
});

export default AdminMonthsSemaforo;
