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
  Filter,
  X,
  Keyboard,
  Home,
} from 'lucide-react-native';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { DateData, Calendar as RNCalendar } from 'react-native-calendars';
import { BRAND_COLORS } from '@/constants/colors';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Platform,
  Dimensions,
  TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

type DateFilter = 'all' | 'today' | 'yesterday' | 'last7days' | 'last30days' | 'custom';

export default function ReleaseScreen() {
  const router = useRouter();
  const { session, hasPrivilege } = useAuth();
  const { products, releaseProduct, transferProduct, getProductByBarcode } = useInventory();
  const [permission, requestPermission] = useCameraPermissions();
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [facing] = useState<CameraType>('back');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [destinationFilter, setDestinationFilter] = useState<string | null>(null);
  const [storageFilter, setStorageFilter] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'camera' | 'scanner'>('scanner');
  const [hardwareScannerInput, setHardwareScannerInput] = useState('');
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');
  const hardwareScannerRef = useRef<TextInput>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const receivedProducts = useMemo(
    () => products.filter((p) => p.status === 'received' && p.uploadStatus === 'validated'),
    [products]
  );
  
  const releasedProducts = useMemo(() => {
    let released = products.filter((p) => p.status === 'released' || (p.status === 'transferred to Nevis' && p.destination === 'Nevis'));
    
    if (destinationFilter) {
      released = released.filter((p) => p.destination === destinationFilter);
    }
    
    if (storageFilter) {
      released = released.filter((p) => p.storageLocation === storageFilter);
    }
    
    if (dateFilter === 'all') {
      return released;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return released.filter((p) => {
      const releaseDate = new Date(p.dateReleased || p.dateUpdated);
      releaseDate.setHours(0, 0, 0, 0);
      
      switch (dateFilter) {
        case 'today':
          return releaseDate >= today;
        case 'yesterday': {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          return releaseDate >= yesterday && releaseDate < today;
        }
        case 'last7days': {
          const last7days = new Date(today);
          last7days.setDate(last7days.getDate() - 7);
          return releaseDate >= last7days;
        }
        case 'last30days': {
          const last30days = new Date(today);
          last30days.setDate(last30days.getDate() - 30);
          return releaseDate >= last30days;
        }
        case 'custom': {
          if (!startDate) return true;
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          
          if (!endDate) {
            return releaseDate >= start;
          }
          
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          return releaseDate >= start && releaseDate <= end;
        }
        default:
          return true;
      }
    });
  }, [products, dateFilter, startDate, endDate, destinationFilter, storageFilter]);

  const playSuccessFeedback = async () => {
    try {
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
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
    
    console.log('Processing barcode scan:', data);
    setScanned(true);
    setIsProcessing(true);
    
    const product = getProductByBarcode(data);
    
    if (!product) {
      setShowScanner(false);
      setTimeout(() => {
        Alert.alert(
          'Not Found',
          'Package with this barcode not found in the system.',
          [
            {
              text: 'OK',
              onPress: () => {
                setScanned(false);
                setIsProcessing(false);
              }
            }
          ],
          { cancelable: false }
        );
      }, 400);
      return;
    }

    if (product.status === 'released') {
      setShowScanner(false);
      setTimeout(() => {
        Alert.alert(
          'Already Released',
          'This package has already been released.',
          [
            {
              text: 'OK',
              onPress: () => {
                setScanned(false);
                setIsProcessing(false);
              }
            }
          ],
          { cancelable: false }
        );
      }, 400);
      return;
    }

    if (product.uploadStatus !== 'validated') {
      setShowScanner(false);
      setTimeout(() => {
        Alert.alert(
          'Not Validated',
          'This package must be validated before it can be released. Please validate it first in the receiving portal.\n\nWorkflow: Upload → Validate → Release',
          [
            {
              text: 'OK',
              onPress: () => {
                setScanned(false);
                setIsProcessing(false);
              }
            }
          ],
          { cancelable: false }
        );
      }, 400);
      return;
    }

    if (product.status !== 'received') {
      setShowScanner(false);
      setTimeout(() => {
        let message = 'This package is not in a receivable state and cannot be released.';
        if (product.status === 'released') {
          message = 'This package has already been released.';
        } else if (product.status === 'transferred to Nevis') {
          message = 'This package has already been transferred to Nevis.';
        } else if (product.status === 'awaiting_from_nevis') {
          message = 'This package is awaiting return from Nevis and cannot be released until it returns.';
        }
        Alert.alert(
          'Cannot Release',
          message,
          [
            {
              text: 'OK',
              onPress: () => {
                setScanned(false);
                setIsProcessing(false);
              }
            }
          ],
          { cancelable: false }
        );
      }, 400);
      return;
    }

    setShowScanner(false);
    setTimeout(() => {
      setSelectedProduct(product.id);
      setIsProcessing(false);
      setScanned(false);
    }, 400);
  }, [scanned, isProcessing, getProductByBarcode]);

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

    const productToAction = products.find((p) => p.id === selectedProduct);
    if (!productToAction) return;

    setSelectedProduct(null);
    setScanned(false);
    
    if (productToAction.destination === 'Nevis') {
      if (productToAction.uploadStatus !== 'validated') {
        setTimeout(() => {
          Alert.alert(
            'Cannot Transfer',
            'This package must be validated in the receiving portal before it can be transferred to Nevis.\n\nWorkflow: Upload → Validate → Transfer to Nevis',
            [{ text: 'OK' }],
            { cancelable: false }
          );
        }, 100);
        return;
      }
      if (productToAction.status !== 'received') {
        setTimeout(() => {
          Alert.alert(
            'Cannot Transfer',
            'Only received packages can be transferred to Nevis. This package has status: ' + productToAction.status,
            [{ text: 'OK' }],
            { cancelable: false }
          );
        }, 100);
        return;
      }
      transferProduct(selectedProduct, session?.username);
      await playSuccessFeedback();

      setTimeout(() => {
        Alert.alert('Success', 'Package transferred to Nevis successfully');
      }, 100);
    } else {
      if (productToAction.uploadStatus !== 'validated') {
        setTimeout(() => {
          Alert.alert(
            'Cannot Release',
            'This package must be validated before release.\n\nWorkflow: Upload → Validate → Release',
            [{ text: 'OK' }],
            { cancelable: false }
          );
        }, 100);
        return;
      }
      if (productToAction.status !== 'received') {
        setTimeout(() => {
          Alert.alert(
            'Cannot Release',
            'Only received packages can be released. This package has status: ' + productToAction.status,
            [{ text: 'OK' }],
            { cancelable: false }
          );
        }, 100);
        return;
      }
      releaseProduct(selectedProduct, session?.username);
      await playSuccessFeedback();

      setTimeout(() => {
        Alert.alert('Success', 'Package released successfully');
      }, 100);
    }
  };

  const handleCancelRelease = () => {
    setSelectedProduct(null);
    setScanned(false);
    setIsProcessing(false);
  };

  if (!hasPrivilege('releasing')) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Release Portal',
            headerShown: true,
            headerLargeTitle: true,
            headerLeft: () => (
              <TouchableOpacity
                style={styles.headerLeft}
                onPress={() => router.replace('/portal-selection')}
              >
                <Home size={20} color="#10B981" />
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
          title: 'Release Portal',
          headerShown: true,
          headerLargeTitle: true,
          headerLeft: () => (
            <TouchableOpacity
              style={styles.headerLeft}
              onPress={() => router.replace('/portal-selection')}
            >
              <Home size={20} color="#10B981" />
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
            <View style={[styles.statBox, { backgroundColor: '#EFF6FF' }]}>
              <Text style={[styles.statNumber, { color: '#3B82F6' }]}>
                {receivedProducts.length}
              </Text>
              <Text style={styles.statLabel}>In Warehouse</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#F3F4F6' }]}>
              <Text style={[styles.statNumber, { color: '#6B7280' }]}>
                {releasedProducts.length}
              </Text>
              <Text style={styles.statLabel}>Released</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <AlertCircle size={24} color="#F59E0B" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Restricted Access</Text>
            <Text style={styles.infoText}>
              This portal is used only when items are being shipped or dispatched from the
              warehouse. Scan items to mark them as released.
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.scanButton} onPress={openScanner}>
          <Camera size={24} color="#FFFFFF" />
          <Text style={styles.scanButtonText}>Scan Barcode to Release</Text>
        </TouchableOpacity>

        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, showFilters && styles.filterButtonActive]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Filter size={20} color={showFilters ? BRAND_COLORS.primary : '#6B7280'} />
            <Text style={[styles.filterButtonText, showFilters && styles.filterButtonTextActive]}>
              Filters
            </Text>
          </TouchableOpacity>
          {(dateFilter === 'custom' && startDate || destinationFilter || storageFilter) && (
            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={() => {
                setDateFilter('all');
                setStartDate(null);
                setEndDate(null);
                setDestinationFilter(null);
                setStorageFilter(null);
              }}
            >
              <X size={16} color={BRAND_COLORS.gray[600]} />
              <Text style={styles.clearFilterText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {showFilters && (
          <View style={styles.filtersPanel}>
            <Text style={styles.filterSectionTitle}>Date Range</Text>
            <View style={styles.filterOptions}>
              {[
                { value: 'all' as const, label: 'All Time' },
                { value: 'today' as const, label: 'Today' },
                { value: 'yesterday' as const, label: 'Yesterday' },
                { value: 'last7days' as const, label: 'Last 7 Days' },
                { value: 'last30days' as const, label: 'Last 30 Days' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.filterChip,
                    dateFilter === option.value && styles.filterChipActive,
                  ]}
                  onPress={() => {
                    setDateFilter(option.value);
                    setStartDate(null);
                    setEndDate(null);
                  }}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      dateFilter === option.value && styles.filterChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.customRangeButton, dateFilter === 'custom' && styles.customRangeButtonActive]}
              onPress={() => setShowCalendar(true)}
            >
              <Calendar size={16} color={dateFilter === 'custom' ? '#FFFFFF' : BRAND_COLORS.gray[600]} />
              <Text style={[styles.customRangeText, dateFilter === 'custom' && styles.customRangeTextActive]}>
                {dateFilter === 'custom' && startDate
                  ? `${new Date(startDate).toLocaleDateString()}${endDate ? ` - ${new Date(endDate).toLocaleDateString()}` : ''}`
                  : 'Custom Range'}
              </Text>
            </TouchableOpacity>
            
            <Text style={[styles.filterSectionTitle, { marginTop: 16 }]}>Destination</Text>
            <View style={styles.filterOptions}>
              {['Saint Kitts', 'Nevis'].map((dest) => (
                <TouchableOpacity
                  key={dest}
                  style={[
                    styles.filterChip,
                    destinationFilter === dest && styles.filterChipActive,
                  ]}
                  onPress={() => setDestinationFilter(destinationFilter === dest ? null : dest)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      destinationFilter === dest && styles.filterChipTextActive,
                    ]}
                  >
                    {dest}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={[styles.filterSectionTitle, { marginTop: 16 }]}>Storage Location</Text>
            <View style={styles.filterOptions}>
              {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Floor'].map((location) => (
                <TouchableOpacity
                  key={location}
                  style={[
                    styles.filterChip,
                    storageFilter === location && styles.filterChipActive,
                  ]}
                  onPress={() => setStorageFilter(storageFilter === location ? null : location)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      storageFilter === location && styles.filterChipTextActive,
                    ]}
                  >
                    {location}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {releasedProducts.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>
              Released Packages
              {dateFilter === 'custom' && startDate ? ` (${new Date(startDate).toLocaleDateString()}${endDate ? ` - ${new Date(endDate).toLocaleDateString()}` : ''})` : dateFilter !== 'all' ? ` (${dateFilter.replace(/([A-Z])/g, ' $1').trim()})` : ''}
            </Text>
            <ScrollView style={styles.recentList} nestedScrollEnabled>
              {releasedProducts.slice(0, 100).map((item) => (
                <View key={item.id} style={styles.recentItem}>
                  <CheckCircle size={20} color={item.status === 'transferred to Nevis' ? '#6366F1' : '#10B981'} />
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentBarcode}>{item.barcode}</Text>
                    <Text style={styles.recentDate}>
                      {new Date(item.dateReleased || item.dateTransferred || item.dateUpdated).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.recentDestination}>
                    <Text style={styles.recentDestinationText}>{item.destination}</Text>
                    {item.status === 'transferred to Nevis' && (
                      <View style={styles.transferredBadge}>
                        <Text style={styles.transferredBadgeText}>Transferred</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
              {releasedProducts.length > 100 && (
                <View style={styles.moreItemsNotice}>
                  <Text style={styles.moreItemsText}>
                    Showing 100 of {releasedProducts.length} released packages
                  </Text>
                </View>
              )}
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
              <Keyboard size={32} color={scanMode === 'scanner' ? '#EF4444' : '#9CA3AF'} />
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
              <Camera size={32} color={scanMode === 'camera' ? '#EF4444' : '#9CA3AF'} />
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
                    Scan barcode to release package
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
                  <Keyboard size={64} color="#EF4444" strokeWidth={2} />
                </View>
                <Text style={styles.hardwareScannerTitle}>Hardware Barcode Scanner Ready</Text>
                <Text style={styles.hardwareScannerSubtitle}>
                  Use your connected barcode scanner to scan and release items
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
              <PackageCheck size={48} color="#EF4444" />
            </View>

            <Text style={styles.confirmTitle}>
              {product?.destination === 'Nevis' ? 'Transfer to Nevis?' : 'Confirm Release?'}
            </Text>
            <Text style={styles.confirmMessage}>
              {product?.destination === 'Nevis'
                ? 'You are about to transfer this package to the Nevis warehouse.'
                : 'You are about to mark this package as released from the warehouse.'}
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
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Destination</Text>
                  <Text style={styles.detailValue}>{product.destination}</Text>
                </View>
                {product.storageLocation && (
                  <View style={styles.detailRow}>
                    <MapPin size={16} color="#6B7280" />
                    <Text style={styles.detailValue}>{product.storageLocation}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Calendar size={16} color="#6B7280" />
                  <Text style={styles.detailValue}>
                    Received: {new Date(product.dateAdded).toLocaleDateString()}
                  </Text>
                </View>
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
                style={[styles.releaseButton, product?.destination === 'Nevis' && styles.transferButton]}
                onPress={handleConfirmRelease}
              >
                <Text style={styles.releaseButtonText}>
                  {product?.destination === 'Nevis' ? 'Transfer to Nevis' : 'Confirm Release'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCalendar}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={styles.calendarOverlay}>
          <View style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select Date Range</Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <X size={24} color={BRAND_COLORS.gray[600]} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.calendarInstructions}>
              <Text style={styles.calendarInstructionText}>
                {!startDate ? 'Tap to select start date' : !endDate ? 'Tap to select end date' : 'Date range selected'}
              </Text>
              {(startDate || endDate) && (
                <TouchableOpacity
                  style={styles.resetDatesButton}
                  onPress={() => {
                    setStartDate(null);
                    setEndDate(null);
                  }}
                >
                  <Text style={styles.resetDatesText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>

            <RNCalendar
              onDayPress={(day: DateData) => {
                if (!startDate || (startDate && endDate)) {
                  setStartDate(day.dateString);
                  setEndDate(null);
                } else if (new Date(day.dateString) >= new Date(startDate)) {
                  setEndDate(day.dateString);
                } else {
                  setEndDate(startDate);
                  setStartDate(day.dateString);
                }
              }}
              markedDates={{
                ...(startDate ? { [startDate]: { selected: true, selectedColor: BRAND_COLORS.primary } } : {}),
                ...(endDate ? { [endDate]: { selected: true, selectedColor: BRAND_COLORS.primary } } : {}),
                ...(startDate && endDate
                  ? (() => {
                      const marked: { [key: string]: { selected: boolean; selectedColor: string } } = {};
                      const start = new Date(startDate);
                      const end = new Date(endDate);
                      const current = new Date(start);
                      current.setDate(current.getDate() + 1);
                      
                      while (current < end) {
                        const dateString = current.toISOString().split('T')[0];
                        marked[dateString] = { selected: true, selectedColor: BRAND_COLORS.gray[200] };
                        current.setDate(current.getDate() + 1);
                      }
                      return marked;
                    })()
                  : {}),
              }}
              theme={{
                todayTextColor: BRAND_COLORS.primary,
                selectedDayBackgroundColor: BRAND_COLORS.primary,
                arrowColor: BRAND_COLORS.primary,
              }}
              maxDate={new Date().toISOString().split('T')[0]}
            />

            <TouchableOpacity
              style={[styles.applyRangeButton, (!startDate || !endDate) && styles.applyRangeButtonDisabled]}
              onPress={() => {
                if (startDate && endDate) {
                  setDateFilter('custom');
                  setShowCalendar(false);
                }
              }}
              disabled={!startDate || !endDate}
            >
              <Text style={styles.applyRangeButtonText}>Apply Range</Text>
            </TouchableOpacity>
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
    color: '#10B981',
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
    backgroundColor: '#EF4444',
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
  moreItemsNotice: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 10,
  },
  moreItemsText: {
    fontSize: 13,
    color: BRAND_COLORS.gray[600],
    fontWeight: '500' as const,
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
  recentDestination: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  recentDestinationText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#374151',
  },
  transferredBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
  },
  transferredBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#6366F1',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonActive: {
    backgroundColor: '#EFF6FF',
    borderColor: BRAND_COLORS.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: BRAND_COLORS.primary,
  },
  clearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: BRAND_COLORS.gray[100],
    borderRadius: 8,
  },
  clearFilterText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: BRAND_COLORS.gray[600],
  },
  filtersPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#374151',
    marginBottom: 4,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: BRAND_COLORS.primary,
    borderColor: BRAND_COLORS.primary,
  },
  customRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: BRAND_COLORS.gray[100],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND_COLORS.gray[200],
    marginTop: 8,
  },
  customRangeButtonActive: {
    backgroundColor: BRAND_COLORS.primary,
    borderColor: BRAND_COLORS.primary,
  },
  customRangeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: BRAND_COLORS.gray[600],
  },
  customRangeTextActive: {
    color: '#FFFFFF',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#374151',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
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
    borderColor: '#EF4444',
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
    backgroundColor: '#FEF2F2',
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
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  releaseButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  transferButton: {
    backgroundColor: '#6366F1',
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    maxHeight: Dimensions.get('window').height * 0.8,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: BRAND_COLORS.gray[200],
  },
  calendarTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: BRAND_COLORS.gray[900],
  },
  calendarInstructions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  calendarInstructionText: {
    fontSize: 14,
    color: BRAND_COLORS.gray[600],
  },
  resetDatesButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: BRAND_COLORS.gray[100],
    borderRadius: 6,
  },
  resetDatesText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: BRAND_COLORS.gray[700],
  },
  applyRangeButton: {
    marginHorizontal: 24,
    marginTop: 16,
    paddingVertical: 16,
    backgroundColor: BRAND_COLORS.primary,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyRangeButtonDisabled: {
    opacity: 0.5,
  },
  applyRangeButtonText: {
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
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 0.3,
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#9CA3AF',
  },
  modeButtonTextActive: {
    color: '#EF4444',
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
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
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
    borderColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  manualSubmitButton: {
    backgroundColor: '#EF4444',
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
    backgroundColor: '#10B981',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
    shadowColor: '#10B981',
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
