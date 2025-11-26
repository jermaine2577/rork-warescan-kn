import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Stack, useRouter } from 'expo-router';
import { X, ScanLine, Keyboard } from 'lucide-react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  Animated,
  TextInput,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';

export default function NevisScannerScreen() {
  const router = useRouter();
  const { hasPrivilege } = useAuth();
  const { updateProduct, products } = useInventory();

  const hasCheckedPermission = useRef(false);

  useEffect(() => {
    if (!hasCheckedPermission.current && !hasPrivilege('nevisReceiving')) {
      hasCheckedPermission.current = true;
      Alert.alert(
        'Access Denied',
        'You do not have permission to access the scanner.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/nevis-receiving');
              }
            },
          },
        ],
        { cancelable: false }
      );
    }
  }, []);
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [facing] = useState<CameraType>('back');
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isNavigatingRef = useRef(false);
  const [scanMode, setScanMode] = useState<'camera' | 'scanner'>('scanner');
  const [hardwareScannerInput, setHardwareScannerInput] = useState('');
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');
  const hardwareScannerRef = useRef<TextInput>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playSuccessFeedback = useCallback(async () => {
    try {
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      if (Platform.OS === 'web') {
        console.log('Audio feedback skipped on web');
        return;
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
  }, []);

  const processBarcode = useCallback(async (data: string, source: 'camera' | 'scanner') => {
    if (scanned || isNavigatingRef.current) {
      console.log('Scan already in progress, ignoring...');
      return;
    }
    
    console.log(`✓ Barcode detected from ${source}:`, data);
    
    if (!data || data.trim().length === 0) {
      console.error('Empty barcode data received');
      return;
    }
    
    setScanned(true);
    isNavigatingRef.current = true;
    
    const trimmedBarcode = data.trim();
    const product = products.find(p => p.barcode === trimmedBarcode);
    
    if (!product) {
      Alert.alert(
        'Product Not Found',
        `No product found with barcode: ${trimmedBarcode}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setScanned(false);
              isNavigatingRef.current = false;
              if (scanMode === 'scanner') {
                setHardwareScannerInput('');
                setTimeout(() => hardwareScannerRef.current?.focus(), 100);
              }
            }
          }
        ]
      );
      return;
    }
    
    if (product.status !== 'transferred' || product.destination !== 'Nevis') {
      let errorTitle = 'Try a Different Barcode';
      let errorMessage = '';
      
      if (product.destination !== 'Nevis') {
        errorMessage = `This product is for ${product.destination}, not Nevis.\n\nPlease scan a package designated for Nevis.\n\nBarcode: ${trimmedBarcode}\nCustomer: ${product.customerName || 'N/A'}`;
      } else if (product.status === 'received') {
        errorMessage = `This product has already been received in Nevis.\n\nPlease scan a different package.\n\nBarcode: ${trimmedBarcode}\nCustomer: ${product.customerName || 'N/A'}`;
      } else if (product.status === 'released') {
        errorMessage = `This product has already been released.\n\nPlease scan a different package.\n\nBarcode: ${trimmedBarcode}\nCustomer: ${product.customerName || 'N/A'}`;
      } else if (product.status === 'awaiting_from_nevis') {
        errorMessage = `This product is awaiting return from Nevis.\n\nPlease scan a different package.\n\nBarcode: ${trimmedBarcode}\nCustomer: ${product.customerName || 'N/A'}`;
      } else {
        errorMessage = `This product is not ready to be received.\n\nPlease scan a different package.\n\nBarcode: ${trimmedBarcode}\nCustomer: ${product.customerName || 'N/A'}\nCurrent status: ${product.status}\nDestination: ${product.destination}`;
      }
      
      console.log('Invalid product for Nevis receiving:', trimmedBarcode, 'Status:', product.status, 'Destination:', product.destination);
      
      Alert.alert(
        errorTitle,
        errorMessage,
        [
          {
            text: 'Scan Another',
            style: 'default',
            onPress: () => {
              console.log('User dismissed error, resetting scanner state');
              setScanned(false);
              isNavigatingRef.current = false;
              if (scanMode === 'scanner') {
                setHardwareScannerInput('');
                setTimeout(() => hardwareScannerRef.current?.focus(), 100);
              }
            }
          }
        ],
        { 
          cancelable: true,
          onDismiss: () => {
            console.log('Alert dismissed, resetting scanner state');
            setScanned(false);
            isNavigatingRef.current = false;
            if (scanMode === 'scanner') {
              setHardwareScannerInput('');
              setTimeout(() => hardwareScannerRef.current?.focus(), 100);
            }
          }
        }
      );
      
      return;
    }
    await playSuccessFeedback();

    updateProduct(product.id, {
      status: 'received',
      barcode: product.barcode,
      storageLocation: product.storageLocation,
      destination: product.destination,
    });

    Alert.alert(
      '✓ Successfully Received',
      `Package ${trimmedBarcode} has been received in Nevis!\n\nCustomer: ${product.customerName || 'N/A'}\nStorage: ${product.storageLocation || 'N/A'}`,
      [
        {
          text: 'Scan Another',
          style: 'default',
          onPress: () => {
            setScanned(false);
            isNavigatingRef.current = false;
            setLastScannedBarcode(trimmedBarcode);
            if (scanMode === 'scanner') {
              setHardwareScannerInput('');
              setTimeout(() => hardwareScannerRef.current?.focus(), 100);
            }
          },
        },
        {
          text: 'Done',
          style: 'cancel',
          onPress: () => {
            router.back();
          },
        },
      ]
    );
  }, [scanned, products, updateProduct, playSuccessFeedback, router, scanMode, hardwareScannerRef]);

  const handleBarCodeScanned = useCallback(async ({ data }: { data: string }) => {
    processBarcode(data, 'camera');
  }, [processBarcode]);

  const handleHardwareScannerSubmit = useCallback(() => {
    const trimmedValue = hardwareScannerInput.trim();
    
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    
    if (trimmedValue && trimmedValue !== lastScannedBarcode) {
      console.log('Hardware scanner submit with barcode:', trimmedValue);
      processBarcode(trimmedValue, 'scanner');
      setHardwareScannerInput('');
    } else {
      console.log('Skipping duplicate or empty barcode');
    }
  }, [hardwareScannerInput, processBarcode, lastScannedBarcode]);

  const handleHardwareScannerChange = useCallback((text: string) => {
    console.log('Scanner input changed:', text);
    setHardwareScannerInput(text);
    
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    
    scanTimeoutRef.current = setTimeout(() => {
      if (text.trim().length > 0) {
        console.log('Auto-submitting after delay:', text.trim());
        const trimmedValue = text.trim();
        if (trimmedValue && trimmedValue !== lastScannedBarcode) {
          processBarcode(trimmedValue, 'scanner');
          setHardwareScannerInput('');
        }
      }
    }, 100);
  }, [lastScannedBarcode, processBarcode]);

  useEffect(() => {
    if (!scanned && scanMode === 'camera') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [scanned, scanMode, scanLineAnim, pulseAnim]);

  useEffect(() => {
    if (scanMode === 'scanner') {
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
  }, [scanMode]);

  useEffect(() => {
    if (scanMode === 'scanner' && !scanned) {
      const interval = setInterval(() => {
        if (hardwareScannerRef.current && Platform.OS !== 'web') {
          hardwareScannerRef.current.focus();
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [scanMode, scanned]);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          We need access to your camera to scan barcodes
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/nevis-receiving');
            }
          }}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: scanMode === 'camera' ? 'Camera Scanner' : 'Hardware Scanner',
          headerStyle: {
            backgroundColor: '#6366F1',
          },
          headerTintColor: '#FFFFFF',
          headerRight: () => (
            <TouchableOpacity onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/nevis-receiving');
              }
            }}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        }}
      />
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
          <ScanLine size={32} color={scanMode === 'camera' ? '#6366F1' : '#9CA3AF'} />
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
          onBarcodeScanned={handleBarCodeScanned}
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
              'aztec',
              'pdf417',
              'datamatrix',
            ],
          }}
        >
        <View style={styles.overlay}>
          <View style={styles.topOverlay}>
            <View style={styles.topSection}>
              <View style={styles.iconContainer}>
                <ScanLine size={32} color="#6366F1" strokeWidth={2.5} />
              </View>
              <Text style={styles.topTitle}>Scan Package for Nevis Receiving</Text>
              <Text style={styles.topSubtitle}>Position barcode in frame</Text>
            </View>
          </View>
          <View style={styles.middleRow}>
            <View style={styles.sideOverlay} />
            <View style={styles.scanAreaContainer}>
              <View style={styles.scanArea}>
                <Animated.View
                  style={[
                    styles.corner,
                    styles.topLeft,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.corner,
                    styles.topRight,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.corner,
                    styles.bottomLeft,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.corner,
                    styles.bottomRight,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                />
                {!scanned && (
                  <Animated.View
                    style={[
                      styles.scanLine,
                      {
                        transform: [
                          {
                            translateY: scanLineAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-150, 150],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                )}
              </View>
            </View>
            <View style={styles.sideOverlay} />
          </View>
          <View style={styles.bottomOverlay}>
            {scanned ? (
              <View style={styles.scannedContainer}>
                <View style={styles.successBadge}>
                  <Text style={styles.successText}>✓ Package Received!</Text>
                </View>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    setScanned(false);
                    isNavigatingRef.current = false;
                  }}
                >
                  <Text style={styles.retryButtonText}>Tap to Scan Again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.hintContainer}>
                <Text style={styles.hintText}>Hold steady for best results</Text>
              </View>
            )}
          </View>
        </View>
      </CameraView>
      ) : (
        <View style={styles.hardwareScannerContainer}>
          <View style={styles.hardwareScannerContent}>
            <View style={styles.scannerIconContainer}>
              <Keyboard size={64} color="#6366F1" strokeWidth={2} />
            </View>
            <Text style={styles.hardwareScannerTitle}>Nevis Receiving Scanner</Text>
            <Text style={styles.hardwareScannerSubtitle}>
              Use your scanner to receive packages in Nevis
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

            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsTitle}>Instructions:</Text>
              <Text style={styles.instructionsText}>• Ensure scanner is connected to your device</Text>
              <Text style={styles.instructionsText}>• Scan package barcode to mark as received</Text>
              <Text style={styles.instructionsText}>• Barcode will process automatically</Text>
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
                  <Text style={styles.successText}>✓ Package Received!</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6366F1',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#111827',
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  cancelButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  topOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 30,
  },
  topSection: {
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  topSubtitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  middleRow: {
    flexDirection: 'row',
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
  },
  scanAreaContainer: {
    aspectRatio: 1,
    maxWidth: 300,
    padding: 8,
  },
  scanArea: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.6)',
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  corner: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderColor: '#6366F1',
    borderWidth: 5,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 20,
  },
  topRight: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 20,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 20,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 20,
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 40,
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
  hintContainer: {
    alignItems: 'center',
  },
  hintText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#5558E3',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  modeButtonActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
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
    backgroundColor: '#6366F1',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    color: 'rgba(255, 255, 255, 0.9)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#111827',
    textAlign: 'center',
  },
  instructionsContainer: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 20,
    gap: 8,
    marginTop: 8,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
  manualSubmitButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
  },
  manualSubmitButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#6366F1',
    textAlign: 'center',
  },
  lastScannedContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  lastScannedLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.7)',
    textTransform: 'uppercase',
  },
  lastScannedText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
