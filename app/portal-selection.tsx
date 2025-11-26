import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Package, LogOut, Inbox, Truck, User, Settings } from 'lucide-react-native';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Portal {
  id: string;
  title: string;
  description: string;
  icon: typeof Package;
  route: string;
  privilegeKey: keyof import('@/contexts/AuthContext').PortalPrivileges;
  color: string;
}

export default function PortalSelectionScreen() {
  const { currentUser, hasPrivilege, logout, warehouseSettings } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isTablet = width > 768;

  const portals: Portal[] = [
    {
      id: 'receiving',
      title: warehouseSettings.stkReceivingName,
      description: 'Receive and manage incoming packages',
      icon: Package,
      route: '/(tabs)',
      privilegeKey: 'receiving',
      color: '#3B82F6',
    },
    {
      id: 'releasing',
      title: warehouseSettings.stkReleasingName,
      description: 'Release packages to customers',
      icon: LogOut,
      route: '/(tabs)/release',
      privilegeKey: 'releasing',
      color: '#10B981',
    },
    {
      id: 'nevis-receiving',
      title: warehouseSettings.nevisReceivingName,
      description: 'Receive packages for Nevis',
      icon: Inbox,
      route: '/(tabs)/nevis-receiving',
      privilegeKey: 'nevisReceiving',
      color: '#6366F1',
    },
    {
      id: 'nevis-releasing',
      title: warehouseSettings.nevisReleasingName,
      description: 'Release packages in Nevis',
      icon: Truck,
      route: '/(tabs)/nevis-releasing',
      privilegeKey: 'nevisReleasing',
      color: '#8B5CF6',
    },
  ];

  const accessiblePortals = portals.filter((portal) =>
    hasPrivilege(portal.privilegeKey)
  );

  const handlePortalPress = (route: string) => {
    router.push(route as any);
  };

  const handleLogout = () => {
    logout();
  };

  const handleToolsPress = () => {
    router.push('/(tabs)/tools');
  };

  const columnCount = isTablet ? 3 : 2;
  const totalPadding = 24 * 2;
  const gapSize = 16;
  const totalGaps = (columnCount - 1) * gapSize;
  const tileSize = (width - totalPadding - totalGaps) / columnCount;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.username}>{currentUser?.username}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <User size={20} color="#6B7280" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Select Portal</Text>
          <Text style={styles.subtitle}>
            Choose a portal to access
          </Text>
        </View>

        {accessiblePortals.length === 0 ? (
          <View style={styles.noAccessContainer}>
            <Package size={64} color="#D1D5DB" />
            <Text style={styles.noAccessTitle}>No Portal Access</Text>
            <Text style={styles.noAccessText}>
              You don&apos;t have access to any portals yet. Please contact your administrator to request access.
            </Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.portalsGrid,
                isTablet && styles.portalsGridTablet,
              ]}
            >
              {accessiblePortals.map((portal) => {
                const IconComponent = portal.icon;
                return (
                  <TouchableOpacity
                    key={portal.id}
                    style={[
                      styles.portalTile,
                      { width: tileSize },
                    ]}
                    onPress={() => handlePortalPress(portal.route)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: portal.color + '20' },
                      ]}
                    >
                      <IconComponent size={isTablet ? 40 : 32} color={portal.color} />
                    </View>
                    <Text style={styles.portalTitle}>{portal.title}</Text>
                    <Text style={styles.portalDescription}>
                      {portal.description}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.toolsSection}>
              <TouchableOpacity
                style={styles.toolsButton}
                onPress={handleToolsPress}
                activeOpacity={0.7}
              >
                <Settings size={20} color="#6B7280" />
                <Text style={styles.toolsButtonText}>Tools & Settings</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  greeting: {
    fontSize: 14,
    color: '#6B7280',
  },
  username: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      } as any,
    }),
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  scrollContent: {
    padding: 24,
  },
  titleContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  portalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  portalsGridTablet: {
    justifyContent: 'flex-start',
  },
  portalTile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 140,
    ...Platform.select({
      web: {
        transition: 'all 0.3s ease',
        cursor: 'pointer',
      } as any,
    }),
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  portalTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 20,
  },
  portalDescription: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  noAccessContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 16,
  },
  noAccessTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#111827',
  },
  noAccessText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 24,
  },
  toolsSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  toolsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      } as any,
    }),
  },
  toolsButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#374151',
  },
});
