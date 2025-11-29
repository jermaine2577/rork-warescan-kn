import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Save, X } from 'lucide-react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Destination } from '@/types/inventory';

export default function AddProductScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ barcode?: string }>();
  const { addProduct, isSaving, getProductByBarcode, markAsValidated, verifyProductFromNevis } = useInventory();
  const { session, hasPrivilege } = useAuth();

  useEffect(() => {
    if (!hasPrivilege('addProduct')) {
      Alert.alert(
        'Access Denied',
        'You do not have permission to add products.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            },
          },
        ],
        { cancelable: false }
      );
      return;
    }
  }, [hasPrivilege, router]);

  const [barcode, setBarcode] = useState(params.barcode || '');
  const [storageLocation, setStorageLocation] = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [destination, setDestination] = useState<Destination | ''>('');
  const [notes, setNotes] = useState('');
  const [isValidateMode, setIsValidateMode] = useState(false);
  const [existingProductId, setExistingProductId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState('');

  const storageLocations = (() => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const locations: string[] = [];
    letters.forEach(letter => {
      for (let floor = 1; floor <= 5; floor++) {
        locations.push(`${letter}-Floor ${floor}`);
      }
    });
    return locations;
  })();

  const [hasCheckedExisting, setHasCheckedExisting] = useState(false);
  const alertShownRef = useRef(false);

  useEffect(() => {
    if (params.barcode && !hasCheckedExisting && !alertShownRef.current) {
      setHasCheckedExisting(true);
      alertShownRef.current = true;
      
      const existing = getProductByBarcode(params.barcode);
      
      if (existing) {
        if (existing.status === 'awaiting_from_nevis') {
          console.log('Found package awaiting from Nevis, verifying automatically');
          const result = verifyProductFromNevis(params.barcode, session?.username);
          if (result.success) {
            Alert.alert(
              'Package Verified',
              'Package has been successfully verified and is now back in the main portal.',
              [
                {
                  text: 'Scan More',
                  onPress: () => {
                    router.replace('/scanner');
                  },
                },
                {
                  text: 'View All',
                  onPress: () => {
                    router.replace('/(tabs)');
                  },
                  style: 'cancel',
                },
              ],
              { cancelable: false }
            );
          } else {
            Alert.alert(
              'Verification Failed',
              'Unable to verify package from Nevis.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    if (router.canGoBack()) {
                      router.back();
                    } else {
                      router.replace('/(tabs)');
                    }
                  },
                },
              ],
              { cancelable: false }
            );
          }
        } else if (existing.uploadStatus === 'uploaded') {
          console.log('Found uploaded package, entering validate mode');
          setIsValidateMode(true);
          setExistingProductId(existing.id);
          setStorageLocation(existing.storageLocation || '');
          setDestination(existing.destination || '');
          setNotes(existing.notes || '');
          setCustomerName(existing.customerName || '');
          setPrice(existing.price || '');
          setComment(existing.comment || '');
        } else {
          Alert.alert(
            'Package Exists',
            'This barcode is already in the system. Do you want to view it?',
            [
              { 
                text: 'Cancel', 
                style: 'cancel', 
                onPress: () => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/(tabs)');
                  }
                }
              },
              {
                text: 'View',
                onPress: () => {
                  router.replace(`/product/${existing.id}`);
                },
              },
            ],
            { cancelable: false }
          );
        }
      } else {
        Alert.alert(
          'Barcode Not Found',
          'This barcode is not in the uploaded Excel manifest. Only packages from the Excel manifest can be scanned and validated.',
          [
            { 
              text: 'OK', 
              onPress: () => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)');
                }
              }
            },
          ],
          { cancelable: false }
        );
      }
    }
  }, [params.barcode, getProductByBarcode, router, hasCheckedExisting]);

  const handleSave = () => {
    if (!barcode.trim()) {
      Alert.alert('Error', 'Please enter or scan a barcode');
      return;
    }

    if (!storageLocation.trim()) {
      Alert.alert('Error', 'Please select a storage location. This is required to save the package.');
      return;
    }

    if (!destination) {
      Alert.alert('Error', 'Please select a destination. This is required to save the package.');
      return;
    }

    if (isValidateMode && existingProductId) {
      try {
        const success = markAsValidated(barcode.trim(), storageLocation.trim(), destination, notes.trim() || undefined);
        if (success) {
          setTimeout(() => {
            Alert.alert(
              'Package Validated',
              'Package has been validated and updated successfully.',
              [
                {
                  text: 'Validate More Packages',
                  onPress: () => {
                    router.replace('/scanner');
                  },
                },
                {
                  text: 'View Validated Packages',
                  onPress: () => {
                    router.replace('/(tabs)');
                  },
                  style: 'cancel',
                },
              ],
              { cancelable: false }
            );
          }, 100);
        } else {
          setTimeout(() => {
            Alert.alert('Error', 'Failed to validate package', [{ text: 'OK' }], { cancelable: false });
          }, 100);
        }
      } catch (error) {
        console.error('Error validating package:', error);
        setTimeout(() => {
          Alert.alert(
            'Error',
            error instanceof Error ? error.message : 'Failed to validate package. Please try logging out and logging back in.',
            [{ text: 'OK' }],
            { cancelable: false }
          );
        }, 100);
      }
      return;
    }

    const existingProduct = getProductByBarcode(barcode.trim());
    if (existingProduct) {
      setTimeout(() => {
        Alert.alert(
          'Duplicate Barcode',
          'This barcode already exists in the system. Each barcode must be unique.',
          [{ text: 'OK' }],
          { cancelable: false }
        );
      }, 100);
      return;
    }

    try {
      const success = addProduct(
        {
          barcode: barcode.trim(),
          status: 'received' as const,
          storageLocation: storageLocation.trim(),
          destination,
          notes: notes.trim() || undefined,
        },
        session?.username
      );

      if (success) {
        setTimeout(() => {
          Alert.alert(
            'Package Added',
            'Package has been successfully added to inventory.',
            [
              {
                text: 'Scan More',
                onPress: () => {
                  router.replace('/scanner');
                },
              },
              {
                text: 'View All',
                onPress: () => {
                  router.replace('/(tabs)');
                },
                style: 'cancel',
              },
            ],
            { cancelable: false }
          );
        }, 100);
      }
    } catch (error) {
      console.error('Error adding product:', error);
      setTimeout(() => {
        Alert.alert(
          'Error',
          error instanceof Error ? error.message : 'Failed to add package. Please try logging out and logging back in.',
          [{ text: 'OK' }],
          { cancelable: false }
        );
      }, 100);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: isValidateMode ? 'Validate Package' : 'Add Package',
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
        <View style={styles.section}>
          <Text style={styles.label}>Barcode *</Text>
          <TextInput
            style={styles.input}
            value={barcode}
            onChangeText={setBarcode}
            placeholder="Enter barcode number"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            editable={!params.barcode}
          />
          {isValidateMode && (
            <View style={styles.validateBadge}>
              <Text style={styles.validateBadgeText}>📦 Validating uploaded package</Text>
            </View>
          )}
          {!isValidateMode && (
            <Text style={styles.hint}>
              {params.barcode ? 'Scanned from camera' : 'Or use the scanner button'}
            </Text>
          )}
        </View>

        {isValidateMode && customerName && (
          <View style={styles.section}>
            <Text style={styles.label}>Customer Name</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{customerName}</Text>
            </View>
            <Text style={styles.hint}>From Excel manifest (read-only)</Text>
          </View>
        )}

        {isValidateMode && price && (
          <View style={styles.section}>
            <Text style={styles.label}>Price</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>${price}</Text>
            </View>
            <Text style={styles.hint}>From Excel manifest (read-only)</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Storage Location *</Text>
          <TouchableOpacity
            style={styles.locationPicker}
            onPress={() => setShowLocationPicker(!showLocationPicker)}
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
          {showLocationPicker && (
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
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Destination *</Text>
          <View style={styles.optionGroup}>
            {(['Saint Kitts', 'Nevis'] as const).map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.optionButton,
                  destination === d && styles.optionButtonActive,
                  isValidateMode && styles.optionButtonDisabled,
                ]}
                onPress={() => !isValidateMode && setDestination(d as Destination)}
                disabled={isValidateMode}
              >
                <Text
                  style={[
                    styles.optionText,
                    destination === d && styles.optionTextActive,
                  ]}
                >
                  {d === 'Saint Kitts' ? 'St. Kitts' : d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {!destination && !isValidateMode && (
            <Text style={styles.hint}>Please select a destination to continue</Text>
          )}
          {isValidateMode && (
            <Text style={styles.hint}>Destination is from Excel manifest (read-only)</Text>
          )}
        </View>

        {isValidateMode && comment && (
          <View style={styles.section}>
            <Text style={styles.label}>Comments</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{comment}</Text>
            </View>
            <Text style={styles.hint}>From Excel manifest (read-only)</Text>
          </View>
        )}

        {!isValidateMode && (
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

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>{isValidateMode ? 'Validate Package' : 'Add Package'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  section: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
  },
  hint: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
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
    ...Platform.select({
      web: {
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        userSelect: 'none',
      } as any,
    }),
  },
  optionButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  optionButtonDisabled: {
    opacity: 0.6,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#374151',
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    ...Platform.select({
      web: {
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        userSelect: 'none',
        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
      } as any,
    }),
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  locationPicker: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...Platform.select({
      web: {
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        userSelect: 'none',
      } as any,
    }),
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
    ...Platform.select({
      web: {
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        userSelect: 'none',
      } as any,
    }),
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
  validateBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    marginTop: 4,
  },
  validateBadgeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#92400E',
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
