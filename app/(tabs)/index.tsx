import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { Stack, useRouter } from 'expo-router';
import {
  Package,
  ScanBarcode,
  Search,
  Filter,
  MapPin,
  User,
  CheckCircle,
  DollarSign,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  List,
  Users,
  AlertCircle,
  Home,
} from 'lucide-react-native';
import { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import type { ProductStatus, Destination, UploadStatus, Product } from '@/types/inventory';

export default function InventoryScreen() {
  const router = useRouter();
  const { session, hasPrivilege } = useAuth();
  const { width } = useWindowDimensions();
  const {
    products,
    stats,
    isLoading,
    searchQuery,
    setSearchQuery,
    destinationFilter,
    setDestinationFilter,
  } = useInventory();

  const [showFilters, setShowFilters] = useState(false);
  const [uploadStatusFilter, setUploadStatusFilter] = useState<UploadStatus | 'all'>('all');
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');

  const receivedProducts = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    return products.filter((p) => {
      if (p.status !== 'received' && p.status !== 'awaiting_from_nevis') return false;
      
      const matchesSearch =
        searchQuery === '' ||
        p.barcode.toLowerCase().includes(searchLower) ||
        (p.customerName && p.customerName.toLowerCase().includes(searchLower)) ||
        (p.storageLocation && p.storageLocation.toLowerCase().includes(searchLower));
      const matchesDestination =
        destinationFilter === 'all' || p.destination === destinationFilter;
      const matchesUploadStatus =
        uploadStatusFilter === 'all' || 
        (uploadStatusFilter === null ? !p.uploadStatus : p.uploadStatus === uploadStatusFilter);
      return matchesSearch && matchesDestination && matchesUploadStatus;
    });
  }, [products, searchQuery, destinationFilter, uploadStatusFilter]);

  const awaitingFromNevisCount = useMemo(() => {
    return products.filter(p => p.status === 'awaiting_from_nevis').length;
  }, [products]);

  const groupedByCustomer = useMemo(() => {
    const groups = new Map<string, Product[]>();
    
    receivedProducts.forEach(product => {
      const customerKey = product.customerName || 'No Customer Name';
      if (!groups.has(customerKey)) {
        groups.set(customerKey, []);
      }
      groups.get(customerKey)!.push(product);
    });
    
    return Array.from(groups.entries())
      .sort((a, b) => {
        if (a[0] === 'No Customer Name') return 1;
        if (b[0] === 'No Customer Name') return -1;
        return a[0].localeCompare(b[0]);
      });
  }, [receivedProducts]);

  const toggleCustomerExpand = useCallback((customerName: string) => {
    setExpandedCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerName)) {
        newSet.delete(customerName);
      } else {
        newSet.add(customerName);
      }
      return newSet;
    });
  }, []);

  const getStatusColor = useCallback((status: ProductStatus) => {
    switch (status) {
      case 'received':
        return '#3B82F6';
      case 'released':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  }, []);

  const renderProduct = useCallback((item: Product) => (
    <TouchableOpacity
      key={item.id}
      style={styles.productCard}
      onPress={() => {
        if (Platform.OS === 'web') {
          router.replace(`/product/${item.id}` as any);
        } else {
          router.push(`/product/${item.id}` as any);
        }
      }}
    >
      <View style={styles.productHeader}>
        <View style={styles.productInfo}>
          <Text style={styles.productBarcode}>{item.barcode}</Text>
          {item.customerName && (
            <View style={styles.customerRow}>
              <User size={14} color="#6B7280" />
              <Text style={styles.customerText}>{item.customerName}</Text>
            </View>
          )}
          <View style={styles.productMeta}>
            {item.storageLocation && (
              <View style={styles.metaItem}>
                <MapPin size={14} color="#6B7280" />
                <Text style={styles.metaText}>{item.storageLocation}</Text>
              </View>
            )}
            {item.price && (
              <View style={styles.metaItem}>
                <DollarSign size={14} color="#10B981" />
                <Text style={[styles.metaText, { color: '#10B981', fontWeight: '600' as const }]}>{item.price}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.badgeContainer}>
          {item.status === 'awaiting_from_nevis' ? (
            <View
              style={[
                styles.uploadStatusBadge,
                { backgroundColor: '#F59E0B' },
              ]}
            >
              <Text style={styles.statusText}>Awaiting from Nevis</Text>
            </View>
          ) : item.uploadStatus ? (
            <View
              style={[
                styles.uploadStatusBadge,
                { backgroundColor: item.uploadStatus === 'uploaded' ? '#F59E0B' : '#10B981' },
              ]}
            >
              {item.uploadStatus === 'validated' && (
                <CheckCircle size={14} color="#FFFFFF" style={styles.badgeIcon} />
              )}
              <Text style={styles.statusText}>
                {item.uploadStatus === 'uploaded' ? 'Uploaded' : 'Validated'}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(item.status) },
              ]}
            >
              <Text style={styles.statusText}>Received</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.productFooter}>
        <View style={styles.destinationTag}>
          <Text style={styles.destinationText}>{item.destination}</Text>
        </View>
        {(item.comment || item.notes) && (
          <View style={styles.commentContainer}>
            <MessageSquare size={12} color="#9CA3AF" />
            <Text style={styles.commentText} numberOfLines={1}>
              {item.comment || item.notes}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  ), [router, getStatusColor]);

  const renderCustomerGroup = useCallback(({ item }: { item: [string, Product[]] }) => {
    const [customerName, customerProducts] = item;
    const isExpanded = expandedCustomers.has(customerName);
    const packageCount = customerProducts.length;
    
    return (
      <View style={styles.customerGroup}>
        <TouchableOpacity
          style={styles.customerHeader}
          onPress={() => toggleCustomerExpand(customerName)}
        >
          <View style={styles.customerHeaderLeft}>
            {isExpanded ? (
              <ChevronDown size={20} color="#374151" />
            ) : (
              <ChevronRight size={20} color="#374151" />
            )}
            <User size={20} color="#3B82F6" />
            <View style={styles.customerHeaderInfo}>
              <Text style={styles.customerName}>{customerName}</Text>
              <Text style={styles.packageCount}>
                {packageCount} package{packageCount !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.customerProducts}>
            {customerProducts.map(product => renderProduct(product))}
          </View>
        )}
      </View>
    );
  }, [expandedCustomers, toggleCustomerExpand, renderProduct]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading inventory...</Text>
      </View>
    );
  }

  if (!hasPrivilege('receiving')) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Receiving Portal',
            headerShown: true,
            headerLargeTitle: true,
            headerLeft: () => (
              <TouchableOpacity
                style={styles.headerLeft}
                onPress={() => router.replace('/portal-selection')}
              >
                <Home size={20} color="#3B82F6" />
                <Text style={styles.headerBackText}>Home</Text>
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.loadingContainer}>
          <AlertCircle size={64} color="#EF4444" />
          <Text style={styles.noAccessTitle}>Access Denied</Text>
          <Text style={styles.noAccessText}>You don&apos;t have permission to access the Receiving Portal. Please contact your administrator.</Text>
          <TouchableOpacity
            style={styles.noAccessButton}
            onPress={() => router.replace('/portal-selection')}
          >
            <Home size={20} color="#FFFFFF" />
            <Text style={styles.noAccessButtonText}>Go to Portal Selection</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Receiving Portal',
          headerShown: true,
          headerLargeTitle: true,
          headerLeft: () => (
            <TouchableOpacity
              style={styles.headerLeft}
              onPress={() => router.replace('/portal-selection')}
            >
              <Home size={20} color="#3B82F6" />
              <Text style={styles.headerBackText}>Home</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              <User size={18} color="#6B7280" />
              <Text style={styles.headerUsername}>{session?.username}</Text>
            </View>
          ),
        }}
      />
      <View style={styles.statsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.statsScroll, width > 600 && styles.statsScrollLarge]}
        >
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
            <Text style={[styles.statValue, { color: '#3B82F6' }]}>
              {stats.received}
            </Text>
            <Text style={styles.statLabel}>Received</Text>
          </View>
          {awaitingFromNevisCount > 0 && (
            <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.statValue, { color: '#F59E0B' }]}>
                {awaitingFromNevisCount}
              </Text>
              <Text style={styles.statLabel}>Awaiting</Text>
            </View>
          )}
          <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>
              {stats.saintKitts}
            </Text>
            <Text style={styles.statLabel}>St. Kitts</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#E0E7FF' }]}>
            <Text style={[styles.statValue, { color: '#6366F1' }]}>
              {stats.nevis}
            </Text>
            <Text style={styles.statLabel}>Nevis</Text>
          </View>
        </ScrollView>
      </View>

      {awaitingFromNevisCount > 0 && (
        <View style={styles.warningBanner}>
          <AlertCircle size={20} color="#F59E0B" />
          <Text style={styles.warningText}>
            {awaitingFromNevisCount} package{awaitingFromNevisCount !== 1 ? 's' : ''} returned from Nevis. Scan to verify.
          </Text>
        </View>
      )}

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by customer, barcode, or location..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>
        <TouchableOpacity
          style={[
            styles.filterButton,
            (destinationFilter !== 'all' || uploadStatusFilter !== 'all') && styles.filterButtonActive,
          ]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={20} color={(destinationFilter !== 'all' || uploadStatusFilter !== 'all') ? '#FFFFFF' : '#374151'} />
        </TouchableOpacity>
      </View>

      <View style={styles.viewToggleContainer}>
        <TouchableOpacity
          style={[
            styles.viewToggleButton,
            viewMode === 'list' && styles.viewToggleButtonActive,
          ]}
          onPress={() => setViewMode('list')}
        >
          <List size={18} color={viewMode === 'list' ? '#FFFFFF' : '#6B7280'} />
          <Text
            style={[
              styles.viewToggleText,
              viewMode === 'list' && styles.viewToggleTextActive,
            ]}
          >
            List View
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.viewToggleButton,
            viewMode === 'grouped' && styles.viewToggleButtonActive,
          ]}
          onPress={() => setViewMode('grouped')}
        >
          <Users size={18} color={viewMode === 'grouped' ? '#FFFFFF' : '#6B7280'} />
          <Text
            style={[
              styles.viewToggleText,
              viewMode === 'grouped' && styles.viewToggleTextActive,
            ]}
          >
            Customer Groups
          </Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Upload Status</Text>
            <View style={styles.filterOptions}>
              {(['all', 'uploaded', 'validated', null] as const).map((status) => (
                <TouchableOpacity
                  key={status === null ? 'manual' : status}
                  style={[
                    styles.filterChip,
                    uploadStatusFilter === status && styles.filterChipActive,
                  ]}
                  onPress={() => setUploadStatusFilter(status as UploadStatus | 'all')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      uploadStatusFilter === status && styles.filterChipTextActive,
                    ]}
                  >
                    {status === 'all' ? 'All' : status === null ? 'Manual' : status === 'uploaded' ? 'Uploaded' : 'Validated'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Destination</Text>
            <View style={styles.filterOptions}>
              {(['all', 'Saint Kitts', 'Nevis'] as const).map((dest) => (
                <TouchableOpacity
                  key={dest}
                  style={[
                    styles.filterChip,
                    destinationFilter === dest && styles.filterChipActive,
                  ]}
                  onPress={() => setDestinationFilter(dest as Destination | 'all')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      destinationFilter === dest && styles.filterChipTextActive,
                    ]}
                  >
                    {dest === 'all' ? 'All' : dest}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {viewMode === 'list' ? (
        <FlatList
          data={receivedProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Package size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No packages found</Text>
              <Text style={styles.emptyText}>
                {searchQuery || destinationFilter !== 'all' || uploadStatusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Tap the + button to scan and receive your first package'}
              </Text>
            </View>
          }
          renderItem={({ item }) => renderProduct(item)}
        />
      ) : (
        <FlatList
          data={groupedByCustomer}
          keyExtractor={(item) => item[0]}
          contentContainerStyle={styles.listContent}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Package size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No packages found</Text>
              <Text style={styles.emptyText}>
                {searchQuery || destinationFilter !== 'all' || uploadStatusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Tap the + button to scan and receive your first package'}
              </Text>
            </View>
          }
          renderItem={renderCustomerGroup}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          if (Platform.OS === 'web') {
            router.replace('/scanner' as any);
          } else {
            router.push('/scanner' as any);
          }
        }}
      >
        <ScanBarcode size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
  },
  headerBackText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#3B82F6',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  headerUsername: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  statsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  statsScrollLarge: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  statCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#111827',
    textAlign: 'center' as const,
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center' as const,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#111827',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  filterButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  filterButtonActive: {
    backgroundColor: '#3B82F6',
  },
  filtersPanel: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  filterGroup: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#374151',
    textTransform: 'uppercase',
  },
  filterOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  filterChipActive: {
    backgroundColor: '#3B82F6',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#374151',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    gap: 12,
    ...(Platform.OS === 'web' && {
      maxWidth: 800,
      alignSelf: 'center',
      width: '100%',
    }),
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#111827',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
    gap: 6,
  },
  productBarcode: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#111827',
  },
  productMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  customerText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500' as const,
  },
  badgeContainer: {
    flexDirection: 'column',
    gap: 4,
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  uploadStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeIcon: {
    marginRight: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  destinationTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  destinationText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#374151',
  },
  notesPreview: {
    flex: 1,
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic' as const,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  commentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  commentText: {
    flex: 1,
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic' as const,
  },
  customerGroup: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  customerHeader: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  customerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customerHeaderInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#111827',
  },
  packageCount: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  customerProducts: {
    padding: 12,
    gap: 12,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  viewToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  viewToggleButtonActive: {
    backgroundColor: '#3B82F6',
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  viewToggleTextActive: {
    color: '#FFFFFF',
  },
  noAccessTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#EF4444',
    marginTop: 16,
  },
  noAccessText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 8,
  },
  noAccessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  noAccessButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: -4,
    borderRadius: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#92400E',
  },
});
