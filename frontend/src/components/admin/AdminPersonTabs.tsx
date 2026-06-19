/**
 * 🆕 19/06/2026 — Tab Navigator riusabile per le schede Admin di Coach / Dirigente / Collaboratore / Atleta.
 *
 * Tre sezioni:
 *  - 🗓️ Impegni (prossimi 3 gg + settimana + gare)
 *  - 📋 Anagrafica (dati personali, fiscali, contatti, indirizzo, banca, account)
 *  - 💰 Compensi (contratto, quietanze, soglie €5k/€15k, spie colorate)
 *
 * Uso:
 *   const [tab, setTab] = useState<AdminPersonTab>('anagrafica');
 *   <AdminPersonTabs activeTab={tab} onChange={setTab} />
 *   <TabSection tab="anagrafica" activeTab={tab}>...sezioni anagrafica...</TabSection>
 *   <TabSection tab="compensi" activeTab={tab}>...sezioni compensi...</TabSection>
 *   <TabSection tab="impegni" activeTab={tab}>...sezioni impegni...</TabSection>
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type AdminPersonTab = 'impegni' | 'anagrafica' | 'compensi';

interface TabsProps {
  activeTab: AdminPersonTab;
  onChange: (tab: AdminPersonTab) => void;
  /** Pallini ai lati del tab Compensi (es. badge "3" per quietanze in attesa). Opzionale. */
  compensiBadge?: number;
  impegniBadge?: number;
}

const TAB_CONFIG: { key: AdminPersonTab; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'impegni', label: 'Da fare', icon: 'today-outline', color: '#F57C00' },
  { key: 'anagrafica', label: 'Anagrafica', icon: 'person-outline', color: '#1565C0' },
  { key: 'compensi', label: 'Compensi', icon: 'cash-outline', color: '#2E7D32' },
];

export const AdminPersonTabs: React.FC<TabsProps> = ({ activeTab, onChange, compensiBadge, impegniBadge }) => {
  return (
    <View style={styles.tabBar} data-testid="admin-person-tabs">
      {TAB_CONFIG.map((t) => {
        const isActive = activeTab === t.key;
        const badge = t.key === 'compensi' ? compensiBadge : t.key === 'impegni' ? impegniBadge : undefined;
        return (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, isActive && { backgroundColor: t.color, borderColor: t.color }]}
            onPress={() => onChange(t.key)}
            activeOpacity={0.85}
            data-testid={`admin-tab-${t.key}`}
            testID={`admin-tab-${t.key}`}
          >
            <Ionicons name={t.icon} size={18} color={isActive ? '#fff' : t.color} />
            <Text style={[styles.tabLabel, { color: isActive ? '#fff' : t.color }]}>{t.label}</Text>
            {badge !== undefined && badge > 0 && (
              <View style={[styles.badge, { backgroundColor: isActive ? '#fff' : t.color }]}>
                <Text style={[styles.badgeText, { color: isActive ? t.color : '#fff' }]}>{badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

interface TabSectionProps {
  tab: AdminPersonTab;
  activeTab: AdminPersonTab;
  children: React.ReactNode;
}

/** Renderizza i figli solo quando il tab corrispondente è attivo. */
export const TabSection: React.FC<TabSectionProps> = ({ tab, activeTab, children }) => {
  if (tab !== activeTab) return null;
  return <View data-testid={`admin-tab-content-${tab}`}>{children}</View>;
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

export default AdminPersonTabs;
