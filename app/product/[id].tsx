import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Save,
  X,
  Trash2,
  Package,
  Clock,
  Calendar,
} from 'lucide-react-native';
import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { webSafeAlert } from '@/utils/webCompatibility';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ProductStatus, Destination } from '@/types/inventory';

export default function ProductDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const { products, updateProduct, deleteProduct, isSaving } = useInventory();
  const { hasPrivilege } = useAuth();

  const product = products.find((p) => p.id === params.id);

  const [barcode, setBarcode] = useState('');
  const [status, setStatus] = useState<ProductStatus>('received');
  const [storageLocation, setStorageLocation] = useState('');
  const [destination, setDestination] = useState<Destination>('Saint Kitts');
  const [notes, setNotes] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  const barcodeInputRef = useRef<TextInput>(null);
  const [isBarcodeEditable, setIsBarcodeEditable] = useState(false);
  
  const storageLocations = (() => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const locations: string[] = [];
    letters.forEach(letter => {
      for (let num = 1; num <= 5; num++) {
        locations.push(`${letter}${num}`);
      }
    });
    for (let floor = 1; floor <= 5; floor++) {
      locations.push(`Floor ${floor}`);
    }
    return locations;
  })();

  useEffect(() => {
    if (product) {
      setBarcode(product.barcode);
      setStatus(product.status);
      setStorageLocation(product.storageLocation || '');
      setDestination(product.destination);
      setNotes(product.notes || '');
      setCustomerName(product.customerName || '');
      setPrice(product.price || '');
      setComment(product.comment || '');
    }
  }, [product]);

  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Package size={64} color="#D1D5DB" />
        <Text style={styles.errorTitle}>Package Not Found</Text>
        <Text style={styles.errorText}>
          The package you&apos;re looking for doesn&apos;t exist
        </Text>
        <TouchableOpacity
          style={styles.errorButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }



  const canEditStorageLocation = hasPrivilege('editStorageLocation');
  const canEditProductDetails = hasPrivilege('editProductDetails');

  const handleStorageLocationPress = () => {
    if (!canEditStorageLocation && (product.uploadStatus === 'uploaded' || product.uploadStatus === 'validated')) {
      webSafeAlert(
        'Access Denied',
        'You do not have permission to edit storage locations for uploaded products. Please contact your administrator.'
      );
      return;
    }
    setShowLocationPicker(!showLocationPicker);
  };

  const handleDestinationPress = () => {
    if (!canEditProductDetails && (product.uploadStatus === 'uploaded' || product.uploadStatus === 'validated')) {
      webSafeAlert(
        'Access Denied', 
        'You do not have permission to edit product details for uploaded products. Please contact your administrator.'
      );
      return;
    }
    setShowDestinationPicker(!showDestinationPicker);
  };

  const handleBarcodePress = () => {
    if (!canEditProductDetails) {
      webSafeAlert(
        'Access Denied',
        'You do not have permission to edit barcodes. Please contact your administrator.'
      );
      return;
    }
    setIsBarcodeEditable(true);
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 100);
  };

  const handleSave = () => {
    try {
      if (!barcode || !barcode.trim()) {
        webSafeAlert('Error', 'Barcode cannot be empty');
        return;
      }

      const trimmedStorage = storageLocation?.trim() || '';
      if (!trimmedStorage) {
        webSafeAlert('Error', 'Storage location is required');
        return;
      }

      const needsValidation = product.uploadStatus === 'uploaded' || product.status === 'awaiting_from_nevis';
      
      const updates: any = {
        barcode: barcode.trim(),
        status: needsValidation ? 'received' as const : status,
        storageLocation: trimmedStorage,
        destination,
        notes: notes?.trim() || '',
        customerName: customerName?.trim() || '',
        price: price?.trim() || '',
        comment: comment?.trim() || '',
      };
      
      if (needsValidation) {
        updates.uploadStatus = 'validated' as const;
      }
      
      console.log('Saving product with updates:', updates);
      updateProduct(params.id, updates);

      const message = needsValidation 
        ? 'Package validated successfully! Storage location updated and ready for release.'
        : 'Package updated successfully. Changes will sync across all devices.';
      
      if (Platform.OS === 'web') {
        window.alert(`Success\n\n${message}`);
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)');
        }
      } else {
        setTimeout(() => {
          webSafeAlert('Success', message, () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          });
        }, 100);
      }
    } catch (error) {
      console.error('Error saving product:', error);
      if (Platform.OS === 'web') {
        window.alert('Error\n\nFailed to save changes. Please try again.');
      } else {
        setTimeout(() => {
          webSafeAlert('Error', 'Failed to save changes. Please try again.');
        }, 100);
      }
    }
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Delete Package\n\nAre you sure you want to delete this package? This action cannot be undone.');
      if (confirmed) {
        deleteProduct(params.id);
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)');
        }
      }
    } else {
      Alert.alert(
        'Delete Package',
        'Are you sure you want to delete this package? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              deleteProduct(params.id);
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            },
          },
        ]
      );
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Package Details',
          headerLeft: () => (
            <TouchableOpacity onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            }}>
              <X size={24} color="#111827" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <Save size={24} color="#3B82F6" />
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Calendar size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Added</Text>
              <Text style={styles.infoValue}>
                {new Date(product.dateAdded).toLocaleString()}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Clock size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Last Updated</Text>
              <Text style={styles.infoValue}>
                {new Date(product.dateUpdated).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Barcode</Text>
          <TouchableOpacity
            style={styles.barcodeContainer}
            onPress={() => {
              if (!isBarcodeEditable) {
                handleBarcodePress();
              }
            }}
            activeOpacity={isBarcodeEditable ? 1 : 0.7}
          >
            <TextInput
              ref={barcodeInputRef}
              style={styles.input}
              value={barcode}
              onChangeText={setBarcode}
              placeholder="Enter barcode number"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              editable={isBarcodeEditable}
              pointerEvents={isBarcodeEditable ? 'auto' : 'none'}
            />
          </TouchableOpacity>
          {!canEditProductDetails && (
            <Text style={styles.hint}>Editing barcode requires special permission.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.optionGroup}>
            {(['received', 'released'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.optionButton,
                  status === s && styles.optionButtonActive,
                ]}
                disabled
              >
                <Text
                  style={[
                    styles.optionText,
                    status === s && styles.optionTextActive,
                  ]}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>Status cannot be changed manually. Use Release Portal to release products.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Storage Location *</Text>
          <TouchableOpacity
            style={styles.locationPicker}
            onPress={handleStorageLocationPress}
          >
            <Text
              style={[
                styles.locationPickerText,
                !storageLocation && styles.locationPickerPlaceholder,
              ]}
            >
              {storageLocation || 'Select storage location'}
            </Text>
          </TouchableOpacity>
          {showLocationPicker && (canEditStorageLocation || !product.uploadStatus) && (
            <ScrollView
              style={styles.locationScrollView}
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.locationGrid}>
                {storageLocations.map((loc) => (
                  <TouchableOpacity
                    key={loc}
                    style={[
                      styles.locationButton,
                      storageLocation === loc && styles.locationButtonActive,
                    ]}
                    onPress={() => {
                      setStorageLocation(loc);
                      setShowLocationPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.locationButtonText,
                        storageLocation === loc && styles.locationButtonTextActive,
                      ]}
                    >
                      {loc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
          {(product.uploadStatus === 'uploaded' || product.uploadStatus === 'validated') && !canEditStorageLocation && (
            <Text style={styles.hint}>This package was uploaded from Excel. Special permission required to edit.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Destination *</Text>
          <TouchableOpacity
            style={styles.destinationPicker}
            onPress={handleDestinationPress}
          >
            <Text
              style={[
                styles.destinationPickerText,
                !destination && styles.locationPickerPlaceholder,
              ]}
            >
              {destination === 'Saint Kitts' ? 'St. Kitts' : destination === 'Nevis' ? 'Nevis' : 'Select destination'}
            </Text>
          </TouchableOpacity>
          {showDestinationPicker && (canEditProductDetails || !product.uploadStatus) && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.locationList}
            >
              <View style={styles.locationGrid}>
                {(['Saint Kitts', 'Nevis'] as const).map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.locationButton,
                      destination === d && styles.locationButtonActive,
                    ]}
                    onPress={() => {
                      setDestination(d);
                      setShowDestinationPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.locationButtonText,
                        destination === d && styles.locationButtonTextActive,
                      ]}
                    >
                      {d === 'Saint Kitts' ? 'St. Kitts' : d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
          {(product.uploadStatus === 'uploaded' || product.uploadStatus === 'validated') && !canEditProductDetails && (
            <Text style={styles.hint}>This package was uploaded from Excel. Special permission required to edit.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Customer Name</Text>
          {canEditProductDetails ? (
            <TextInput
              style={styles.input}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Enter customer name"
              placeholderTextColor="#9CA3AF"
            />
          ) : (
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{customerName || 'Not specified'}</Text>
            </View>
          )}
          {!canEditProductDetails && (product.uploadStatus === 'uploaded' || product.uploadStatus === 'validated') && (
            <Text style={styles.hint}>Special permission required to edit.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Price</Text>
          {canEditProductDetails ? (
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="Enter price"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />
          ) : (
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{price ? `${price}` : 'Not specified'}</Text>
            </View>
          )}
          {!canEditProductDetails && (product.uploadStatus === 'uploaded' || product.uploadStatus === 'validated') && (
            <Text style={styles.hint}>Special permission required to edit.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Comments</Text>
          {canEditProductDetails ? (
            <TextInput
              style={[styles.input, styles.textArea]}
              value={comment}
              onChangeText={setComment}
              placeholder="Additional comments..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          ) : (
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{comment || 'No comments'}</Text>
            </View>
          )}
          {!canEditProductDetails && (product.uploadStatus === 'uploaded' || product.uploadStatus === 'validated') && (
            <Text style={styles.hint}>Special permission required to edit.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Notes</Text>
          {canEditProductDetails || !product.uploadStatus ? (
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional information..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          ) : (
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{notes || 'No notes'}</Text>
            </View>
          )}
          {!canEditProductDetails && (product.uploadStatus === 'uploaded' || product.uploadStatus === 'validated') && (
            <Text style={styles.hint}>Special permission required to edit.</Text>
          )}
        </View>

        {(product.uploadStatus === 'uploaded' || product.status === 'received') && (
          <TouchableOpacity style={styles.validateButton} onPress={handleSave}>
            <Save size={20} color="#FFFFFF" />
            <Text style={styles.validateButtonText}>
              {product.uploadStatus === 'uploaded' ? 'Validate Package' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Trash2 size={20} color="#EF4444" />
          <Text style={styles.deleteButtonText}>Delete Package</Text>
        </TouchableOpacity>
      </ScrollView>


    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 32,
    gap: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#111827',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  barcodeContainer: {
    borderRadius: 12,
  },
  locationPicker: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  locationPickerText: {
    fontSize: 16,
    color: '#111827',
  },
  locationPickerPlaceholder: {
    color: '#9CA3AF',
  },
  locationScrollView: {
    marginTop: 8,
    maxHeight: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  locationList: {
    marginTop: 8,
  },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
  },
  locationButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  locationButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  locationButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#374151',
  },
  locationButtonTextActive: {
    color: '#FFFFFF',
  },
  destinationPicker: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  destinationPickerText: {
    fontSize: 16,
    color: '#111827',
  },
  destinationPickerPlaceholder: {
    color: '#9CA3AF',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  optionGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#374151',
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FEE2E2',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#EF4444',
  },
  validateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  validateButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  readOnlyField: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  readOnlyText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500' as const,
  },
});
