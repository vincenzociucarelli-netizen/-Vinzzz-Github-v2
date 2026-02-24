import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function CollaboratoreIndex() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to profile page directly (like coach and dirigente)
    router.replace('/collaboratore/profile');
  }, []);

  return null;
}

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['token', 'userId', 'userRole']);
    router.replace('/login');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9800" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Benvenuto,</Text>
          <Text style={styles.nameText}>{profile?.full_name || 'Collaboratore'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>€ {profile?.monthly_compensation || 0}</Text>
          <Text style={styles.statLabel}>Compenso Mensile</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>€ {stats?.yearly_total?.toFixed(2) || '0.00'}</Text>
          <Text style={styles.statLabel}>Totale Anno</Text>
        </View>
      </View>

      {/* Thresholds Warning */}
      {stats?.thresholds?.["5000"]?.needs_warning && (
        <View style={[styles.alertCard, { backgroundColor: '#FFF3E0' }]}>
          <Ionicons name="warning" size={24} color="#FF9800" />
          <Text style={styles.alertText}>Stai per superare la soglia di €5.000</Text>
        </View>
      )}
      {stats?.thresholds?.["15000"]?.needs_warning && (
        <View style={[styles.alertCard, { backgroundColor: '#FFEBEE' }]}>
          <Ionicons name="alert-circle" size={24} color="#F44336" />
          <Text style={styles.alertText}>Stai per superare la soglia di €15.000</Text>
        </View>
      )}

      {/* Menu Cards */}
      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push('/collaboratore/compensation')}
          data-testid="compensation-menu-card"
        >
          <View style={[styles.menuIcon, { backgroundColor: '#E3F2FD' }]}>
            <Ionicons name="cash-outline" size={28} color="#2196F3" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Compensi</Text>
            <Text style={styles.menuSubtitle}>Firma quietanze mensili</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push('/collaboratore/profile')}
          data-testid="profile-menu-card"
        >
          <View style={[styles.menuIcon, { backgroundColor: '#F3E5F5' }]}>
            <Ionicons name="person-outline" size={28} color="#9C27B0" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Profilo</Text>
            <Text style={styles.menuSubtitle}>Dati personali e documenti</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      {/* Activity Type */}
      {profile?.activity_type && (
        <View style={styles.activityCard}>
          <Text style={styles.activityLabel}>Tipo Attività</Text>
          <Text style={styles.activityValue}>{profile.activity_type}</Text>
        </View>
      )}
    </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
  },
  nameText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  logoutButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF9800',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 10,
    gap: 10,
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  menuContainer: {
    paddingHorizontal: 16,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  menuIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
    marginLeft: 14,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  activityCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  activityLabel: {
    fontSize: 12,
    color: '#666',
  },
  activityValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
});
