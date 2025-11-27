import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { Stack, useRouter } from 'expo-router';
import {
  Package,
  Search,
  User,
  MapPin,
  DollarSign,
  MessageSquare,
  CheckCircle,
  RotateCcw,
  AlertCircle,
  Home,
  Scan,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import type { Product } from '@/types/inventory';

export default function NevisReceivingScreen() {
  const router = useRouter();
  const { session, hasPrivilege } = useAuth();
  const {
    products,
    isLoading,
    searchQuery,
    setSearchQuery,
    revertProductFromNevis,
    updateProduct,
  } = useInventory();
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [showReceivingModal, setShowReceivingModal] = useState(false);
  const [receivingProduct, setReceivingProduct] = useState<Product | null>(null);

  const nevisProducts = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    return products.filter((p) => {
      if (p.destination !== 'Nevis') return false;
      
      if (p.status === 'transferred to Nevis') {
        return searchQuery === '' ||
          p.barcode.toLowerCase().includes(searchLower) ||
          (p.customerName && p.customerName.toLowerCase().includes(searchLower)) ||
          (p.storageLocation && p.storageLocation.toLowerCase().includes(searchLower));
      }
      
      if (p.status === 'received' && p.dateTransferred) {
        return searchQuery === '' ||
          p.barcode.toLowerCase().includes(searchLower) ||
          (p.customerName && p.customerName.toLowerCase().includes(searchLower)) ||
          (p.storageLocation && p.storageLocation.toLowerCase().includes(searchLower));
      }
      
      return false;
    });
  }, [products, searchQuery]);

  const handleRevert = (product: Product) => {
    setSelectedProduct(product);
    setShowRevertModal(true);
  };

  const handleConfirmRevert = () => {
    if (!selectedProduct) return;
    
    revertProductFromNevis(selectedProduct.id, session?.username);
    setShowRevertModal(false);
    setSelectedProduct(null);
    
    setTimeout(() => {
      Alert.alert('Success', 'Package reverted back to main portal successfully');
    }, 100);
  };

  const handleMarkReceived = (product: Product) => {
    setReceivingProduct(product);
    setShowReceivingModal(true);
  };

  const handleConfirmReceive = () => {
    if (!receivingProduct) return;
    
    if (receivingProduct.uploadStatus !== 'validated') {
      setShowReceivingModal(false);
      setReceivingProduct(null);
      setTimeout(() => {
        Alert.alert(
          'Cannot Receive',
          'This package must be validated in the main receiving portal before it can be accepted in Nevis.\n\nWorkflow: Upload → Validate → St Kitts Release → Nevis Receive',
          [{ text: 'OK' }],
          { cancelable: false }
        );
      }, 100);
      return;
    }

    if (!receivingProduct.dateTransferred) {
      setShowReceivingModal(false);
      setReceivingProduct(null);
      setTimeout(() => {
        Alert.alert(
          'Cannot Receive',
          'This package was never released from St Kitts. It must be released through the St Kitts Release Portal first.\n\nWorkflow: Upload → Validate → St Kitts Release → Nevis Receive',
          [{ text: 'OK' }],
          { cancelable: false }
        );
      }, 100);
      return;
    }
    
    if (receivingProduct.status !== 'transferred to Nevis') {
      setShowReceivingModal(false);
      setReceivingProduct(null);
      setTimeout(() => {
        Alert.alert(
          'Cannot Receive',
          'Only transferred packages can be received. This package has status: ' + receivingProduct.status + '\n\nWorkflow: Upload → Validate → St Kitts Release → Nevis Receive',
          [{ text: 'OK' }],
          { cancelable: false }
        );
      }, 100);
      return;
    }
    
    updateProduct(receivingProduct.id, {
      status: 'received',
      barcode: receivingProduct.barcode,
      storageLocation: receivingProduct.storageLocation,
      destination: receivingProduct.destination,
    });
    setShowReceivingModal(false);
    setReceivingProduct(null);
    
    setTimeout(() => {
      Alert.alert('Success', 'Package marked as received in Nevis');
    }, 100);
  };

  const renderProduct = (item: Product) => (
    <TouchableOpacity
      key={item.id}
      style={styles.productCard}
      onPress={() => router.push(`/product/${item.id}`)}
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
          {item.status === 'transferred to Nevis' ? (
            <>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: '#6366F1' },
                ]}
              >
                <CheckCircle size={14} color="#FFFFFF" style={styles.badgeIcon} />
                <Text style={styles.statusText}>Transferred</Text>
              </View>
              <TouchableOpacity
                style={styles.receiveButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleMarkReceived(item);
                }}
              >
                <CheckCircle size={16} color="#10B981" />
                <Text style={styles.receiveButtonText}>Receive</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.revertButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleRevert(item);
                }}
              >
                <RotateCcw size={16} color="#F59E0B" />
                <Text style={styles.revertButtonText}>Revert</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: '#10B981' },
              ]}
            >
              <CheckCircle size={14} color="#FFFFFF" style={styles.badgeIcon} />
              <Text style={styles.statusText}>Accepted</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.productFooter}>
        {(item.comment || item.notes) && (
          <View style={styles.commentContainer}>
            <MessageSquare size={12} color="#9CA3AF" />
            <Text style={styles.commentText} numberOfLines={1}>
              {item.comment || item.notes}
            </Text>
          </View>
        )}
        {item.dateTransferred && (
          <Text style={styles.dateText}>
            {new Date(item.dateTransferred).toLocaleDateString()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading inventory...</Text>
      </View>
    );
  }

  if (!hasPrivilege('nevisReceiving')) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Nevis Receiving',
            headerShown: true,
            headerLargeTitle: true,
            headerLeft: () => (
              <TouchableOpacity
                style={styles.headerLeft}
                onPress={() => router.replace('/portal-selection')}
              >
                <Home size={20} color="#6366F1" />
                <Text style={styles.headerBackText}>Home</Text>
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.loadingContainer}>
          <AlertCircle size={64} color="#EF4444" />
          <Text style={styles.noAccessTitle}>Access Denied</Text>
          <Text style={styles.noAccessText}>You do not have permission to access the Receiving Portal. Please contact your administrator.</Text>
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
          title: 'Nevis Receiving',
          headerShown: true,
          headerLargeTitle: true,
          headerLeft: () => (
            <TouchableOpacity
              style={styles.headerLeft}
              onPress={() => router.replace('/portal-selection')}
            >
              <Home size={20} color="#6366F1" />
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
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { flex: 1 }]}>
            <Text style={[styles.statValue, { color: '#6366F1' }]}>
              {nevisProducts.filter(p => p.status === 'transferred to Nevis').length}
            </Text>
            <Text style={styles.statLabel}>Transferred</Text>
          </View>
          <View style={[styles.statCard, { flex: 1 }]}>
            <Text style={[styles.statValue, { color: '#10B981' }]}>
              {nevisProducts.filter(p => p.status === 'received' && p.dateTransferred).length}
            </Text>
            <Text style={styles.statLabel}>Accepted</Text>
          </View>
        </View>
      </View>

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
          style={styles.scanButton}
          onPress={() => router.push('/nevis-scanner' as any)}
        >
          <Scan size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={nevisProducts}
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
              {searchQuery
                ? 'Try adjusting your search'
                : 'No packages have been transferred to Nevis yet'}
            </Text>
          </View>
        }
        renderItem={({ item }) => renderProduct(item)}
      />

      <Modal
        visible={showRevertModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRevertModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <RotateCcw size={32} color="#F59E0B" />
              <Text style={styles.modalTitle}>Revert from Nevis?</Text>
            </View>
            <Text style={styles.modalDescription}>
              This will move the package back to the main receiving portal.
            </Text>
            {selectedProduct && (
              <View style={styles.productDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Barcode</Text>
                  <Text style={styles.detailValue}>{selectedProduct.barcode}</Text>
                </View>
                {selectedProduct.customerName && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Customer</Text>
                    <Text style={styles.detailValue}>{selectedProduct.customerName}</Text>
                  </View>
                )}
              </View>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowRevertModal(false);
                  setSelectedProduct(null);
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleConfirmRevert}
              >
                <Text style={styles.modalConfirmButtonText}>Confirm Revert</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showReceivingModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReceivingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <CheckCircle size={32} color="#10B981" />
              <Text style={styles.modalTitle}>Mark as Received?</Text>
            </View>
            <Text style={styles.modalDescription}>
              This will mark the package as received in Nevis.
            </Text>
            {receivingProduct && (
              <View style={styles.productDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Barcode</Text>
                  <Text style={styles.detailValue}>{receivingProduct.barcode}</Text>
                </View>
                {receivingProduct.customerName && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Customer</Text>
                    <Text style={styles.detailValue}>{receivingProduct.customerName}</Text>
                  </View>
                )}
              </View>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowReceivingModal(false);
                  setReceivingProduct(null);
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalReceiveButton}
                onPress={handleConfirmReceive}
              >
                <Text style={styles.modalConfirmButtonText}>Confirm Receive</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    color: '#6366F1',
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
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    padding: 16,
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
  scanButton: {
    backgroundColor: '#6366F1',
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
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
    gap: 6,
    alignItems: 'flex-end',
    minWidth: 100,
  },
  statusBadge: {
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
  receiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  receiveButtonText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#065F46',
  },
  revertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  revertButtonText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
  dateText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  modalHeader: {
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#111827',
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  productDetails: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    minWidth: 90,
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#374151',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalReceiveButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
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
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
    shadowColor: '#6366F1',
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
});
