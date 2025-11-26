import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Stack, useRouter } from 'expo-router';
import {
  PackageCheck,
  Camera,
  CheckCircle,
  AlertCircle,
  User,
  MapPin,
  Calendar,
  Keyboard,
  Home,
} from 'lucide-react-native';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Platform,
  TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

export default function NevisReleasingScreen() {
  const router = useRouter();
  const { session, hasPrivilege } = useAuth();
  const { products, releaseProduct, getProductByBarcode } = useInventory();
  const [permission, requestPermission] = useCameraPermissions();
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [facing] = useState<CameraType>('back');
  const [scanMode, setScanMode] = useState<'camera' | 'scanner'>('scanner');
  const [hardwareScannerInput, setHardwareScannerInput] = useState('');
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');
  const hardwareScannerRef = useRef<TextInput>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const acceptedProducts = useMemo(
    () => products.filter((p) => p.status === 'received' && p.destination === 'Nevis' && p.dateTransferred),
    [products]
  );
  
  const releasedFromNevisProducts = useMemo(() => {
    return products.filter((p) => p.status === 'released' && p.destination === 'Nevis');
  }, [products]);

  const playSuccessFeedback = async () => {
    try {
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      const soundUri = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
      if (!soundUri || soundUri.trim() === '') {
        console.log('Sound URI is empty, skipping audio feedback');
        return;
      }
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: soundUri },
        { shouldPlay: true, volume: 1.0 }
      );
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.log('Error playing feedback:', error);
    }
  };

  const processBarcode = useCallback((data: string) => {
    if (scanned || isProcessing) {
      console.log('Already processing scan, ignoring duplicate');
      return;
    }
    
    if (!data || typeof data !== 'string') {
      console.error('Invalid barcode data type:', typeof data);
      return;
    }
    
    console.log('Processing barcode scan:', data);
    
    const trimmedData = data.trim();
    
    if (trimmedData.startsWith('http://') || trimmedData.startsWith('https://') || trimmedData.includes('rork.app') || trimmedData.includes('exp.direct')) {
      console.log('Ignoring URL/QR code:', trimmedData);
      setScanned(true);
      setIsProcessing(true);
      setShowScanner(false);
      
      const resetState = () => {
        setScanned(false);
        setIsProcessing(false);
        if (scanMode === 'scanner') {
          setHardwareScannerInput('');
          setLastScannedBarcode('');
        }
      };
      
      setTimeout(() => {
        Alert.alert(
          'Invalid Barcode',
          'Please scan a product barcode, not a QR code or URL.',
          [
            {
              text: 'OK',
              onPress: resetState
            }
          ],
          { 
            cancelable: true,
            onDismiss: resetState
          }
        );
      }, 400);
      return;
    }
    
    setScanned(true);
    setIsProcessing(true);
    
    let product;
    try {
      product = getProductByBarcode(trimmedData);
    } catch (findError) {
      console.error('Error finding product:', findError);
      const resetState = () => {
        setScanned(false);
        setIsProcessing(false);
        if (scanMode === 'scanner') {
          setHardwareScannerInput('');
          setLastScannedBarcode('');
        }
      };
      resetState();
      Alert.alert('Error', 'Failed to search for product. Please try again.');
      return;
    }
    
    if (!product) {
      setShowScanner(false);
      
      const resetState = () => {
        setScanned(false);
        setIsProcessing(false);
        if (scanMode === 'scanner') {
          setHardwareScannerInput('');
          setLastScannedBarcode('');
        }
      };
      
      setTimeout(() => {
        Alert.alert(
          'Not Found',
          'Package with this barcode not found in the system.',
          [
            {
              text: 'OK',
              onPress: resetState
            }
          ],
          { 
            cancelable: true,
            onDismiss: resetState
          }
        );
      }, 400);
      return;
    }

    if (product.status === 'released') {
      setShowScanner(false);
      
      const resetState = () => {
        setScanned(false);
        setIsProcessing(false);
        if (scanMode === 'scanner') {
          setHardwareScannerInput('');
          setLastScannedBarcode('');
        }
      };
      
      setTimeout(() => {
        Alert.alert(
          'Already Released',
          'This package has already been released. Please scan a different package.',
          [
            {
              text: 'OK',
              onPress: resetState
            }
          ],
          { 
            cancelable: true,
            onDismiss: resetState
          }
        );
      }, 400);
      return;
    }

    if (product.status !== 'received' || product.destination !== 'Nevis' || !product.dateTransferred) {
      setShowScanner(false);
      
      const resetState = () => {
        setScanned(false);
        setIsProcessing(false);
        if (scanMode === 'scanner') {
          setHardwareScannerInput('');
          setLastScannedBarcode('');
        }
      };
      
      let errorMessage = 'This package has not been accepted in Nevis yet. Only accepted packages can be released.';
      
      if (product.destination !== 'Nevis') {
        errorMessage = 'This package is not designated for Nevis. It cannot be released from this portal.';
      } else if (!product.dateTransferred) {
        errorMessage = 'This package must go through the Nevis Receiving portal first before it can be released.';
      }
      
      setTimeout(() => {
        Alert.alert(
          'Invalid Package',
          errorMessage,
          [
            {
              text: 'OK',
              onPress: resetState
            }
          ],
          { 
            cancelable: true,
            onDismiss: resetState
          }
        );
      }, 400);
      return;
    }

    try {
      setShowScanner(false);
      setTimeout(() => {
        setSelectedProduct(product.id);
        setIsProcessing(false);
        setScanned(false);
      }, 400);
    } catch (error) {
      console.error('Error showing product confirmation:', error);
      setScanned(false);
      setIsProcessing(false);
      Alert.alert('Error', 'An error occurred. Please try again.');
    }
  }, [scanned, isProcessing, getProductByBarcode, scanMode]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    processBarcode(data);
  };

  const handleHardwareScannerSubmit = useCallback(() => {
    const trimmedValue = hardwareScannerInput.trim();
    
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    
    if (trimmedValue && trimmedValue !== lastScannedBarcode) {
      console.log('Hardware scanner submit with barcode:', trimmedValue);
      console.log('Barcode length:', trimmedValue.length);
      processBarcode(trimmedValue);
      setLastScannedBarcode(trimmedValue);
      setHardwareScannerInput('');
    } else {
      console.log('Skipping duplicate or empty barcode');
    }
  }, [hardwareScannerInput, processBarcode, lastScannedBarcode]);

  const handleHardwareScannerChange = useCallback((text: string) => {
    console.log('Scanner input changed:', text, 'Length:', text.length);
    setHardwareScannerInput(text);
    
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    
    scanTimeoutRef.current = setTimeout(() => {
      if (text.trim().length > 0) {
        console.log('Auto-submitting after delay:', text.trim());
        const trimmedValue = text.trim();
        if (trimmedValue && trimmedValue !== lastScannedBarcode) {
          processBarcode(trimmedValue);
          setLastScannedBarcode(trimmedValue);
          setHardwareScannerInput('');
        }
      }
    }, 100);
  }, [lastScannedBarcode, processBarcode]);

  useEffect(() => {
    if (scanMode === 'scanner' && showScanner) {
      console.log('Hardware scanner mode activated');
      setTimeout(() => {
        hardwareScannerRef.current?.focus();
        console.log('TextInput focused for hardware scanner');
      }, 100);
    }
    
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [scanMode, showScanner]);

  useEffect(() => {
    if (scanMode === 'scanner' && showScanner && !scanned) {
      const interval = setInterval(() => {
        if (hardwareScannerRef.current && Platform.OS !== 'web') {
          hardwareScannerRef.current.focus();
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [scanMode, showScanner, scanned]);

  const handleConfirmRelease = async () => {
    if (!selectedProduct) return;

    setSelectedProduct(null);
    setScanned(false);
    
    releaseProduct(selectedProduct, session?.username);
    await playSuccessFeedback();

    setTimeout(() => {
      Alert.alert('Success', 'Package released successfully from Nevis');
    }, 100);
  };

  const handleCancelRelease = () => {
    setSelectedProduct(null);
    setScanned(false);
    setIsProcessing(false);
  };

  if (!hasPrivilege('nevisReleasing')) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Nevis Releasing',
            headerShown: true,
            headerLargeTitle: true,
            headerLeft: () => (
              <TouchableOpacity
                style={styles.headerLeft}
                onPress={() => router.replace('/portal-selection')}
              >
                <Home size={20} color="#8B5CF6" />
                <Text style={styles.headerBackText}>Home</Text>
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.noAccessContainer}>
          <AlertCircle size={64} color="#EF4444" />
          <Text style={styles.noAccessTitle}>Access Denied</Text>
          <Text style={styles.noAccessText}>You do not have permission to access the Releasing Portal. Please contact your administrator.</Text>
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

  const openScanner = async () => {
    if (scanMode === 'camera' && !permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera access is needed to scan barcodes.');
        return;
      }
    }
    setScanned(false);
    setIsProcessing(false);
    setHardwareScannerInput('');
    setShowScanner(true);
  };

  const product = selectedProduct
    ? products.find((p) => p.id === selectedProduct)
    : null;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Nevis Releasing',
          headerShown: true,
          headerLargeTitle: true,
          headerLeft: () => (
            <TouchableOpacity
              style={styles.headerLeft}
              onPress={() => router.replace('/portal-selection')}
            >
              <Home size={20} color="#8B5CF6" />
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

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.statsSection}>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: '#EDE9FE' }]}>
              <Text style={[styles.statNumber, { color: '#6366F1' }]}>
                {acceptedProducts.length}
              </Text>
              <Text style={styles.statLabel}>Accepted & Ready</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#F3F4F6' }]}>
              <Text style={[styles.statNumber, { color: '#6B7280' }]}>
                {releasedFromNevisProducts.length}
              </Text>
              <Text style={styles.statLabel}>Released from Nevis</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <AlertCircle size={24} color="#F59E0B" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Nevis Release Portal</Text>
            <Text style={styles.infoText}>
              This portal is for releasing packages from the Nevis warehouse. 
              Only packages that have been accepted can be released here.
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.scanButton} onPress={openScanner}>
          <Camera size={24} color="#FFFFFF" />
          <Text style={styles.scanButtonText}>Scan Barcode to Release</Text>
        </TouchableOpacity>

        {releasedFromNevisProducts.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Released from Nevis</Text>
            <ScrollView style={styles.recentList} nestedScrollEnabled>
              {releasedFromNevisProducts.slice(0, 50).map((item) => (
                <View key={item.id} style={styles.recentItem}>
                  <CheckCircle size={20} color="#10B981" />
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentBarcode}>{item.barcode}</Text>
                    <Text style={styles.recentDate}>
                      {new Date(item.dateReleased || item.dateUpdated).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => {
          setShowScanner(false);
          setScanned(false);
        }}
      >
        <View style={styles.scannerContainer}>
          <View style={styles.modeSwitcher}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                scanMode === 'scanner' && styles.modeButtonActive,
              ]}
              onPress={() => {
                setScanMode('scanner');
                setScanned(false);
              }}
            >
              <Keyboard size={32} color={scanMode === 'scanner' ? '#6366F1' : '#9CA3AF'} />
              <Text style={[
                styles.modeButtonText,
                scanMode === 'scanner' && styles.modeButtonTextActive,
              ]}>Hardware Scanner</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                scanMode === 'camera' && styles.modeButtonActive,
              ]}
              onPress={() => {
                setScanMode('camera');
                setScanned(false);
              }}
            >
              <Camera size={32} color={scanMode === 'camera' ? '#6366F1' : '#9CA3AF'} />
              <Text style={[
                styles.modeButtonText,
                scanMode === 'camera' && styles.modeButtonTextActive,
              ]}>Camera</Text>
            </TouchableOpacity>
          </View>
          {scanMode === 'camera' ? (
            <CameraView
              style={styles.camera}
              facing={facing}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: [
                  'qr',
                  'ean13',
                  'ean8',
                  'code128',
                  'code39',
                  'code93',
                  'upc_a',
                  'upc_e',
                  'codabar',
                  'itf14',
                ],
              }}
            >
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerTopOverlay} />
                <View style={styles.scannerMiddleRow}>
                  <View style={styles.scannerSideOverlay} />
                  <View style={styles.scanArea}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />
                  </View>
                  <View style={styles.scannerSideOverlay} />
                </View>
                <View style={styles.scannerBottomOverlay}>
                  <Text style={styles.scannerInstruction}>
                    Scan barcode to release from Nevis
                  </Text>
                  <TouchableOpacity
                    style={styles.closeScannerButton}
                    onPress={() => {
                      setShowScanner(false);
                      setScanned(false);
                      setIsProcessing(false);
                    }}
                  >
                    <Text style={styles.closeScannerButtonText}>Close Scanner</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </CameraView>
          ) : (
            <View style={styles.hardwareScannerContainer}>
              <View style={styles.hardwareScannerContent}>
                <View style={styles.scannerIconContainer}>
                  <Keyboard size={64} color="#6366F1" strokeWidth={2} />
                </View>
                <Text style={styles.hardwareScannerTitle}>Hardware Barcode Scanner Ready</Text>
                <Text style={styles.hardwareScannerSubtitle}>
                  Use your connected barcode scanner to scan and release items from Nevis
                </Text>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Scanned Barcode:</Text>
                  <TextInput
                    ref={hardwareScannerRef}
                    style={styles.barcodeInput}
                    value={hardwareScannerInput}
                    onChangeText={handleHardwareScannerChange}
                    onSubmitEditing={handleHardwareScannerSubmit}
                    placeholder="Scanner input appears here..."
                    placeholderTextColor="#6B7280"
                    autoFocus
                    returnKeyType="done"
                    blurOnSubmit={false}
                    selectTextOnFocus
                    keyboardType="default"
                    autoCorrect={false}
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </View>

                {lastScannedBarcode && (
                  <View style={styles.lastScannedContainer}>
                    <Text style={styles.lastScannedLabel}>Last Scanned:</Text>
                    <Text style={styles.lastScannedText}>{lastScannedBarcode}</Text>
                  </View>
                )}

                {hardwareScannerInput.trim() && (
                  <TouchableOpacity
                    style={styles.manualSubmitButton}
                    onPress={handleHardwareScannerSubmit}
                  >
                    <Text style={styles.manualSubmitButtonText}>Process Barcode</Text>
                  </TouchableOpacity>
                )}

                {scanned && (
                  <View style={styles.scannedContainer}>
                    <View style={styles.successBadge}>
                      <Text style={styles.successText}>✓ Barcode Detected!</Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.closeScannerButton}
                  onPress={() => {
                    setShowScanner(false);
                    setScanned(false);
                    setIsProcessing(false);
                  }}
                >
                  <Text style={styles.closeScannerButtonText}>Close Scanner</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={!!selectedProduct && !!product}
        transparent
        animationType="fade"
        onRequestClose={handleCancelRelease}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <PackageCheck size={48} color="#6366F1" />
            </View>

            <Text style={styles.confirmTitle}>Release from Nevis?</Text>
            <Text style={styles.confirmMessage}>
              You are about to mark this package as released from the Nevis warehouse.
            </Text>

            {product && (
              <View style={styles.productDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Barcode</Text>
                  <Text style={styles.detailValue}>{product.barcode}</Text>
                </View>
                {product.customerName && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Customer</Text>
                    <Text style={styles.detailValue}>{product.customerName}</Text>
                  </View>
                )}
                {product.price && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Price</Text>
                    <Text style={[styles.detailValue, { color: '#10B981', fontWeight: '700' as const }]}>${product.price}</Text>
                  </View>
                )}
                {product.storageLocation && (
                  <View style={styles.detailRow}>
                    <MapPin size={16} color="#6B7280" />
                    <Text style={styles.detailValue}>{product.storageLocation}</Text>
                  </View>
                )}
                {product.dateTransferred && (
                  <View style={styles.detailRow}>
                    <Calendar size={16} color="#6B7280" />
                    <Text style={styles.detailValue}>
                      Transferred: {new Date(product.dateTransferred).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelRelease}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.releaseButton}
                onPress={handleConfirmRelease}
              >
                <Text style={styles.releaseButtonText}>Confirm Release</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
  },
  headerBackText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#8B5CF6',
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 20,
  },
  statsSection: {
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 36,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  infoContent: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  infoText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: '#6366F1',
    paddingVertical: 28,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  scanButtonText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  recentSection: {
    gap: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
  },
  recentList: {
    maxHeight: 400,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  recentInfo: {
    flex: 1,
    gap: 2,
  },
  recentBarcode: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#111827',
  },
  recentDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
  },
  scannerTopOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scannerMiddleRow: {
    flexDirection: 'row',
    height: 250,
  },
  scannerSideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 12,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#6366F1',
    borderWidth: 4,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12,
  },
  scannerBottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  scannerInstruction: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  closeScannerButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  closeScannerButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  confirmIcon: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#111827',
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
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
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#374151',
  },
  releaseButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  releaseButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    padding: 16,
    gap: 16,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#1F2937',
    borderWidth: 3,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modeButtonActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOpacity: 0.3,
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#9CA3AF',
  },
  modeButtonTextActive: {
    color: '#6366F1',
  },
  hardwareScannerContainer: {
    flex: 1,
    backgroundColor: '#1F2937',
    padding: 24,
  },
  hardwareScannerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  scannerIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  hardwareScannerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  hardwareScannerSubtitle: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    maxWidth: 400,
  },
  inputContainer: {
    width: '100%',
    maxWidth: 500,
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginLeft: 4,
  },
  barcodeInput: {
    backgroundColor: '#111827',
    borderWidth: 2,
    borderColor: '#6366F1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  manualSubmitButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
  },
  manualSubmitButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  lastScannedContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  lastScannedLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  lastScannedText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#3B82F6',
  },
  scannedContainer: {
    alignItems: 'center',
    gap: 20,
  },
  successBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  successText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  noAccessContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    gap: 12,
    padding: 32,
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
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
    shadowColor: '#8B5CF6',
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
