import { useInventory } from '@/contexts/InventoryContext';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Save,
  X,
  Trash2,
  Package,
  MapPin,
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
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ProductStatus, Destination } from '@/types/inventory';

export default function ProductDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const { products, updateProduct, deleteProduct, isSaving } = useInventory();

  const product = products.find((p) => p.id === params.id);

  const [barcode, setBarcode] = useState('');
  const [status, setStatus] = useState<ProductStatus>('received');
  const [storageLocation, setStorageLocation] = useState('');
  const [destination, setDestination] = useState<Destination>('Saint Kitts');
  const [notes, setNotes] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState('');
  const [showStorageCodeModal, setShowStorageCodeModal] = useState(false);
  const [showDestinationCodeModal, setShowDestinationCodeModal] = useState(false);
  const [showBarcodeCodeModal, setShowBarcodeCodeModal] = useState(false);
  const [masterCode, setMasterCode] = useState('');
  const [originalStorageLocation, setOriginalStorageLocation] = useState('');
  const [originalDestination, setOriginalDestination] = useState<Destination>('Saint Kitts');
  const [originalBarcode, setOriginalBarcode] = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  const [isBarcodeEditable, setIsBarcodeEditable] = useState(false);
  const [isStorageUnlocked, setIsStorageUnlocked] = useState(false);
  const [isDestinationUnlocked, setIsDestinationUnlocked] = useState(false);
  const codeInputRef = useRef<TextInput>(null);
  const barcodeInputRef = useRef<TextInput>(null);
  
  const storageLocations = (() => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const locations: string[] = [];
    letters.forEach(letter => {
      for (let num = 1; num <= 5; num++) {
        locations.push(`${letter}${num}`);
      }
    });
    locations.push('Floor');
    return locations;
  })();

  useEffect(() => {
    if (product) {
      setBarcode(product.barcode);
      setOriginalBarcode(product.barcode);
      setStatus(product.status);
      setStorageLocation(product.storageLocation);
      setOriginalStorageLocation(product.storageLocation);
      setDestination(product.destination);
      setOriginalDestination(product.destination);
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



  const handleStorageCodeVerify = () => {
    if (masterCode === '4086') {
      setShowStorageCodeModal(false);
      setMasterCode('');
      setIsStorageUnlocked(true);
      setShowLocationPicker(true);
    } else {
      Alert.alert('Invalid Code', 'The master code you entered is incorrect.');
      setMasterCode('');
    }
  };

  const handleCloseStorageCodeModal = () => {
    setShowStorageCodeModal(false);
    setMasterCode('');
    setStorageLocation(originalStorageLocation);
  };

  const handleDestinationCodeVerify = () => {
    if (masterCode === '4086') {
      setShowDestinationCodeModal(false);
      setMasterCode('');
      setIsDestinationUnlocked(true);
      setShowDestinationPicker(true);
    } else {
      Alert.alert('Invalid Code', 'The master code you entered is incorrect.');
      setMasterCode('');
    }
  };

  const handleCloseDestinationCodeModal = () => {
    setShowDestinationCodeModal(false);
    setMasterCode('');
    setDestination(originalDestination);
  };

  const handleBarcodeCodeVerify = () => {
    if (masterCode === '4086') {
      setShowBarcodeCodeModal(false);
      setMasterCode('');
      setIsBarcodeEditable(true);
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    } else {
      Alert.alert('Invalid Code', 'The master code you entered is incorrect.');
      setMasterCode('');
    }
  };

  const handleCloseBarcodeCodeModal = () => {
    setShowBarcodeCodeModal(false);
    setMasterCode('');
    setBarcode(originalBarcode);
  };

  const handleSave = () => {
    if (!barcode.trim()) {
      Alert.alert('Error', 'Barcode cannot be empty');
      return;
    }

    if (!storageLocation.trim()) {
      Alert.alert('Error', 'Storage location is required');
      return;
    }

    updateProduct(params.id, {
      barcode: barcode.trim(),
      status,
      storageLocation: storageLocation.trim(),
      destination,
      notes: notes.trim() || undefined,
    });

    Alert.alert('Success', 'Package updated successfully', [
      { text: 'OK', onPress: () => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)');
        }
      }},
    ]);
  };

  const handleDelete = () => {
    Alert.prompt(
      'Master Code Required',
      'Enter the master code to delete this package:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: (code?: string) => {
            if (code === '4086') {
              deleteProduct(params.id);
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            } else {
              Alert.alert('Invalid Code', 'The master code you entered is incorrect.');
            }
          },
        },
      ],
      'secure-text'
    );
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
                setShowBarcodeCodeModal(true);
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
            onPress={() => {
              if (product.uploadStatus === 'uploaded' || product.uploadStatus === 'validated') {
                setShowStorageCodeModal(true);
              } else {
                setShowLocationPicker(!showLocationPicker);
              }
            }}
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
          {showLocationPicker && (!product.uploadStatus || isStorageUnlocked) && (
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
          {(product.uploadStatus === 'uploaded' || product.uploadStatus === 'validated') && (
            <Text style={styles.hint}>This package was uploaded from Excel. Master code required to edit.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Destination *</Text>
          <TouchableOpacity
            style={styles.destinationPicker}
            onPress={() => {
              if (product.uploadStatus === 'uploaded' || product.uploadStatus === 'validated') {
                setShowDestinationCodeModal(true);
              } else {
                setShowDestinationPicker(!showDestinationPicker);
              }
            }}
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
          {showDestinationPicker && (!product.uploadStatus || isDestinationUnlocked) && (
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
          {(product.uploadStatus === 'uploaded' || product.uploadStatus === 'validated') && (
            <Text style={styles.hint}>This package was uploaded from Excel. Master code required to edit.</Text>
          )}
        </View>

        {customerName && (
          <View style={styles.section}>
            <Text style={styles.label}>Customer Name</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{customerName}</Text>
            </View>
          </View>
        )}

        {price && (
          <View style={styles.section}>
            <Text style={styles.label}>Price</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>${price}</Text>
            </View>
          </View>
        )}

        {comment && (
          <View style={styles.section}>
            <Text style={styles.label}>Comments</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{comment}</Text>
            </View>
          </View>
        )}

        {!product.uploadStatus && (
          <View style={styles.section}>
            <Text style={styles.label}>Notes</Text>
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
          </View>
        )}

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Trash2 size={20} color="#EF4444" />
          <Text style={styles.deleteButtonText}>Delete Package</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showStorageCodeModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseStorageCodeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MapPin size={32} color="#F59E0B" />
              <Text style={styles.modalTitle}>Master Code Required</Text>
            </View>
            <Text style={styles.modalDescription}>
              This package was uploaded from Excel. Enter the master code to change the storage location.
            </Text>
            <TextInput
              ref={codeInputRef}
              style={styles.codeInput}
              value={masterCode}
              onChangeText={setMasterCode}
              placeholder="Enter code"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={handleCloseStorageCodeModal}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  masterCode.length !== 4 && styles.modalConfirmButtonDisabled,
                ]}
                onPress={handleStorageCodeVerify}
                disabled={masterCode.length !== 4}
              >
                <Text style={styles.modalConfirmButtonText}>Verify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDestinationCodeModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseDestinationCodeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MapPin size={32} color="#F59E0B" />
              <Text style={styles.modalTitle}>Master Code Required</Text>
            </View>
            <Text style={styles.modalDescription}>
              This package was uploaded from Excel. Enter the master code to change the destination.
            </Text>
            <TextInput
              style={styles.codeInput}
              value={masterCode}
              onChangeText={setMasterCode}
              placeholder="Enter code"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={handleCloseDestinationCodeModal}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  masterCode.length !== 4 && styles.modalConfirmButtonDisabled,
                ]}
                onPress={handleDestinationCodeVerify}
                disabled={masterCode.length !== 4}
              >
                <Text style={styles.modalConfirmButtonText}>Verify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBarcodeCodeModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseBarcodeCodeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Package size={32} color="#F59E0B" />
              <Text style={styles.modalTitle}>Master Code Required</Text>
            </View>
            <Text style={styles.modalDescription}>
              Barcode is locked. Enter the master code to change it.
            </Text>
            <TextInput
              style={styles.codeInput}
              value={masterCode}
              onChangeText={setMasterCode}
              placeholder="Enter code"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={handleCloseBarcodeCodeModal}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  masterCode.length !== 4 && styles.modalConfirmButtonDisabled,
                ]}
                onPress={handleBarcodeCodeVerify}
                disabled={masterCode.length !== 4}
              >
                <Text style={styles.modalConfirmButtonText}>Verify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    gap: 20,
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
  codeInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#111827',
    textAlign: 'center',
    letterSpacing: 8,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
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
  modalConfirmButtonDisabled: {
    opacity: 0.4,
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
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
