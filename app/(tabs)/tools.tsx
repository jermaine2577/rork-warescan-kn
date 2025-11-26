import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import * as DocumentPicker from 'expo-document-picker';

import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack, useRouter } from 'expo-router';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download, LogOut, Trash2, User, RefreshCcw, Eye, X, DollarSign, Wallet, Calendar, Filter, ChevronDown, Users, Plus, Key, Copy, Lock, Edit3, ShieldCheck, Package, MapPin, Home, Search } from 'lucide-react-native';
import { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import * as XLSX from 'xlsx';
import type { Destination, ProductInput, ProductStatus } from '@/types/inventory';
import { useMemo } from 'react';

interface ExcelRow {
  [key: string]: any;
}

export default function ToolsScreen() {
  const router = useRouter();
  const { updateDestinationsByBarcode, products, resetAllData, bulkImportProducts } = useInventory();
  const { session, logout, deleteUser, currentUser, subUsers, createSubUser, deleteSubUser, resetEmployeePassword, updateSubUserPrivileges, hasPrivilege, warehouseSettings, updateWarehouseSettings, toggleUserActive, changeOwnPassword } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    updated: number;
    notFound: number;
  } | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const resetInputRef = useRef<TextInput>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ProductInput[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [financialDestinationFilter, setFinancialDestinationFilter] = useState<Destination | 'all'>('all');
  const [financialStatusFilter, setFinancialStatusFilter] = useState<ProductStatus | 'all'>('all');
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [activitySearchQuery, setActivitySearchQuery] = useState('');
  const [showActivityFilters, setShowActivityFilters] = useState(false);
  const [activityDateStart, setActivityDateStart] = useState('');
  const [activityDateEnd, setActivityDateEnd] = useState('');
  const [activityActionFilter, setActivityActionFilter] = useState<'all' | 'received' | 'released' | 'transferred'>('all');
  const [activityUserFilter, setActivityUserFilter] = useState('all');
  const [activityStatusFilter, setActivityStatusFilter] = useState<'all' | 'received' | 'released' | 'transferred'>('all');
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [newEmployeeUsername, setNewEmployeeUsername] = useState('');
  const [newEmployeePassword, setNewEmployeePassword] = useState('');
  const [newEmployeePrivileges, setNewEmployeePrivileges] = useState({
    receiving: true,
    releasing: true,
    nevisReceiving: true,
    nevisReleasing: true,
    scanner: true,
    addProduct: true,
    uploadExcel: false,
    exportExcel: false,
    resetData: false,
  });
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showEditPrivilegesModal, setShowEditPrivilegesModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [newPasswordForEmployee, setNewPasswordForEmployee] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isUpdatingPrivileges, setIsUpdatingPrivileges] = useState(false);
  const [showWarehouseSettingsModal, setShowWarehouseSettingsModal] = useState(false);
  const [editedWarehouseSettings, setEditedWarehouseSettings] = useState(warehouseSettings);
  const [isSavingWarehouseSettings, setIsSavingWarehouseSettings] = useState(false);
  const [newStorageLocation, setNewStorageLocation] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const allUsers = useMemo(() => {
    const userSet = new Set<string>();
    products.forEach(p => {
      if (p.receivedBy) userSet.add(p.receivedBy);
      if (p.releasedBy) userSet.add(p.releasedBy);
      if (p.transferredBy) userSet.add(p.transferredBy);
    });
    return Array.from(userSet).sort();
  }, [products]);

  const financialStats = useMemo(() => {
    const parsePrice = (priceStr?: string): number => {
      if (!priceStr) return 0;
      const cleanPrice = priceStr.replace(/[^0-9.]/g, '');
      return parseFloat(cleanPrice) || 0;
    };

    const isInDateRange = (dateStr: string): boolean => {
      if (!dateRangeStart && !dateRangeEnd) return true;
      const date = new Date(dateStr);
      const start = dateRangeStart ? new Date(dateRangeStart) : null;
      const end = dateRangeEnd ? new Date(dateRangeEnd) : null;
      
      if (start && end) {
        return date >= start && date <= end;
      } else if (start) {
        return date >= start;
      } else if (end) {
        return date <= end;
      }
      return true;
    };

    const matchesUser = (p: any): boolean => {
      if (userFilter === 'all') return true;
      return p.receivedBy === userFilter || p.releasedBy === userFilter || p.transferredBy === userFilter;
    };

    const filteredProducts = products.filter(p => {
      const matchesDestination = financialDestinationFilter === 'all' || p.destination === financialDestinationFilter;
      const matchesDate = isInDateRange(p.dateAdded);
      const matchesUserFilter = matchesUser(p);
      return matchesDestination && matchesDate && matchesUserFilter;
    });

    const warehouseValue = filteredProducts
      .filter(p => {
        const matchesStatus = financialStatusFilter === 'all' || financialStatusFilter === 'received';
        return p.status === 'received' && p.price && matchesStatus;
      })
      .reduce((sum, p) => sum + parsePrice(p.price), 0);

    const collectedValue = filteredProducts
      .filter(p => {
        const matchesStatus = financialStatusFilter === 'all' || financialStatusFilter === 'released';
        return p.status === 'released' && p.price && matchesStatus;
      })
      .reduce((sum, p) => sum + parsePrice(p.price), 0);

    return {
      warehouseValue,
      collectedValue,
      totalValue: warehouseValue + collectedValue,
      packageCount: filteredProducts.length,
    };
  }, [products, financialDestinationFilter, financialStatusFilter, dateRangeStart, dateRangeEnd, userFilter]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (session?.userId) {
              try {
                await deleteUser(session.userId);
                router.replace('/login');
              } catch (error) {
                Alert.alert('Error', 'Failed to delete account');
              }
            }
          },
        },
      ]
    );
  };

  const handleCreateEmployee = async () => {
    if (!newEmployeeUsername.trim() || !newEmployeePassword.trim()) {
      Alert.alert('Error', 'Please enter username and password');
      return;
    }

    if (newEmployeePassword.length < 4) {
      Alert.alert('Error', 'Password must be at least 4 characters');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to create employees');
      return;
    }

    setIsCreatingEmployee(true);
    try {
      await createSubUser({
        username: newEmployeeUsername.trim(),
        password: newEmployeePassword,
        privileges: newEmployeePrivileges,
        managerId: currentUser.id,
      });

      setShowAddEmployeeModal(false);
      setNewEmployeeUsername('');
      setNewEmployeePassword('');
      setNewEmployeePrivileges({
        receiving: true,
        releasing: true,
        nevisReceiving: true,
        nevisReleasing: true,
        scanner: true,
        addProduct: true,
        uploadExcel: false,
        exportExcel: false,
        resetData: false,
      });

      setTimeout(() => {
        const newEmployee = subUsers[subUsers.length - 1];
        if (newEmployee) {
          Alert.alert(
            'Employee Created',
            `Employee account created successfully!\n\nUsername: ${newEmployee.username}\nUnique Key: ${newEmployee.uniqueKey || 'N/A'}\n\nThe employee needs this unique key to login along with their username and password.`,
            [{ text: 'OK' }]
          );
        }
      }, 500);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create employee');
    } finally {
      setIsCreatingEmployee(false);
    }
  };

  const handleDeleteEmployee = (employeeId: string, employeeName: string) => {
    Alert.alert(
      'Delete Employee',
      `Are you sure you want to delete ${employeeName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSubUser(employeeId);
              Alert.alert('Success', 'Employee deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete employee');
            }
          },
        },
      ]
    );
  };

  const handleResetPasswordPress = (employee: any) => {
    setSelectedEmployee(employee);
    setNewPasswordForEmployee('');
    setShowResetPasswordModal(true);
  };

  const handleConfirmResetPassword = async () => {
    if (!newPasswordForEmployee.trim() || newPasswordForEmployee.length < 4) {
      Alert.alert('Error', 'Password must be at least 4 characters');
      return;
    }

    if (!selectedEmployee) return;

    setIsResettingPassword(true);
    try {
      await resetEmployeePassword({
        userId: selectedEmployee.id,
        newPassword: newPasswordForEmployee,
      });
      setShowResetPasswordModal(false);
      setSelectedEmployee(null);
      setNewPasswordForEmployee('');
      Alert.alert('Success', 'Password reset successfully');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleEditPrivilegesPress = (employee: any) => {
    setSelectedEmployee(employee);
    setShowEditPrivilegesModal(true);
  };

  const handleConfirmUpdatePrivileges = async () => {
    if (!selectedEmployee) return;

    setIsUpdatingPrivileges(true);
    try {
      await updateSubUserPrivileges({
        userId: selectedEmployee.id,
        privileges: selectedEmployee.privileges,
      });
      setShowEditPrivilegesModal(false);
      setSelectedEmployee(null);
      Alert.alert('Success', 'Privileges updated successfully');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update privileges');
    } finally {
      setIsUpdatingPrivileges(false);
    }
  };

  const togglePrivilege = (key: string) => {
    if (!selectedEmployee) return;
    setSelectedEmployee({
      ...selectedEmployee,
      privileges: {
        ...selectedEmployee.privileges,
        [key]: !selectedEmployee.privileges[key],
      },
    });
  };

  const copyToClipboard = (text: string) => {
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(text);
      Alert.alert('Copied', 'Unique key copied to clipboard');
    } else {
      Alert.alert('Unique Key', text, [
        { text: 'OK' }
      ]);
    }
  };

  const handleToggleUserActive = async (userId: string, username: string, isCurrentlyActive: boolean) => {
    const action = isCurrentlyActive ? 'deactivate' : 'activate';
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
      `Are you sure you want to ${action} ${username}? ${isCurrentlyActive ? 'They will not be able to login.' : 'They will be able to login again.'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          onPress: async () => {
            try {
              await toggleUserActive(userId);
              Alert.alert('Success', `User ${isCurrentlyActive ? 'deactivated' : 'activated'} successfully`);
            } catch (error) {
              Alert.alert('Error', `Failed to ${action} user`);
            }
          },
        },
      ]
    );
  };

  const handleSaveWarehouseSettings = async () => {
    setIsSavingWarehouseSettings(true);
    try {
      await updateWarehouseSettings(editedWarehouseSettings);
      setShowWarehouseSettingsModal(false);
      Alert.alert('Success', 'Warehouse settings updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update warehouse settings');
    } finally {
      setIsSavingWarehouseSettings(false);
    }
  };

  const handleAddStorageLocation = () => {
    if (!newStorageLocation.trim()) {
      Alert.alert('Error', 'Please enter a storage location');
      return;
    }
    if (editedWarehouseSettings.storageLocations.includes(newStorageLocation.trim().toUpperCase())) {
      Alert.alert('Error', 'This storage location already exists');
      return;
    }
    setEditedWarehouseSettings({
      ...editedWarehouseSettings,
      storageLocations: [...editedWarehouseSettings.storageLocations, newStorageLocation.trim().toUpperCase()],
    });
    setNewStorageLocation('');
  };

  const handleRemoveStorageLocation = (location: string) => {
    setEditedWarehouseSettings({
      ...editedWarehouseSettings,
      storageLocations: editedWarehouseSettings.storageLocations.filter((l) => l !== location),
    });
  };

  const handleResetPress = () => {
    if (!hasPrivilege('resetData')) {
      Alert.alert('Access Denied', 'You do not have permission to reset data. Please contact your administrator.');
      return;
    }

    setResetCode('');
    setShowResetModal(true);
  };

  const handleResetConfirm = () => {
    if (resetCode === '4086') {
      Alert.alert(
        'Reset All Data',
        'This will permanently delete all products and reset all counts to zero. This action cannot be undone. Are you absolutely sure?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setShowResetModal(false);
              setResetCode('');
            },
          },
          {
            text: 'Reset Everything',
            style: 'destructive',
            onPress: async () => {
              try {
                await resetAllData();
                setShowResetModal(false);
                setResetCode('');
                Alert.alert(
                  'Success',
                  'All inventory data has been reset to zero.',
                  [{ text: 'OK' }]
                );
              } catch (error) {
                console.error('Error resetting data:', error);
                Alert.alert('Error', 'Failed to reset data. Please try again.');
              }
            },
          },
        ]
      );
    } else {
      Alert.alert('Invalid Code', 'The code you entered is incorrect.');
    }
  };

  const handleCloseResetModal = () => {
    setShowResetModal(false);
    setResetCode('');
  };

  const pickDocument = async () => {
    if (!hasPrivilege('uploadExcel')) {
      Alert.alert('Access Denied', 'You do not have permission to upload Excel files. Please contact your administrator.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        await processExcelFile(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick file. Please try again.');
    }
  };

  const processExcelFile = async (file: DocumentPicker.DocumentPickerAsset) => {
    setIsProcessing(true);
    setUploadResult(null);

    try {
      console.log('Processing Excel file:', file.name);
      console.log('File URI:', file.uri);
      console.log('Platform:', Platform.OS);
      
      let fileData: ArrayBuffer;

      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        fileData = await response.arrayBuffer();
      } else {
        const response = await fetch(file.uri);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        fileData = await response.arrayBuffer();
      }

      console.log('File data loaded, size:', fileData.byteLength, 'bytes');
      console.log('Parsing with XLSX...');
      
      const workbook = XLSX.read(fileData, { 
        type: 'array',
        cellDates: false,
        cellText: false,
        cellFormula: false
      });
      
      console.log('Workbook sheet names:', workbook.SheetNames);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      
      const data = XLSX.utils.sheet_to_json<ExcelRow>(firstSheet, {
        defval: '',
        blankrows: false
      });
      
      console.log('Parsed rows:', data.length);
      console.log('Sample row:', data[0]);
      console.log('Column headers found:', Object.keys(data[0] || {}));

      const productsToImport: ProductInput[] = [];
      let skippedRows = 0;

      const findColumnValue = (row: ExcelRow, possibleNames: string[]): string => {
        for (const key of Object.keys(row)) {
          const keyLower = key.toLowerCase().replace(/[\s_-]/g, '');
          for (const name of possibleNames) {
            const nameLower = name.toLowerCase().replace(/[\s_-]/g, '');
            if (keyLower === nameLower || keyLower.includes(nameLower) || nameLower.includes(keyLower)) {
              const value = row[key];
              if (value !== undefined && value !== null && value !== '') {
                return String(value).trim();
              }
            }
          }
        }
        return '';
      };

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        const barcode = findColumnValue(row, ['airwaybill', 'airwaybill#', 'awb', 'awb#', 'barcode']);
        const destinationRaw = findColumnValue(row, ['storelocation', 'location', 'destination', 'dest']);
        const customerName = findColumnValue(row, ['customername', 'customer', 'name', 'client', 'customersname']);
        const price = findColumnValue(row, ['price', 'cost', 'amount']);
        const comment = findColumnValue(row, ['comment', 'comments', 'note', 'notes', 'remarks']);
        
        console.log(`Row ${i + 2}: barcode="${barcode}", customer="${customerName}", dest="${destinationRaw}", price="${price}"`);

        if (!barcode || !destinationRaw) {
          console.log(`Row ${i + 2}: Skipping - barcode: "${barcode}", destination: "${destinationRaw}"`);
          skippedRows++;
          continue;
        }

        const destinationLower = destinationRaw.toLowerCase();
        const destination =
          destinationLower.includes('kitts') ||
          destinationLower === 'saint kitts' ||
          destinationLower === 'st kitts' ||
          destinationLower === 'st. kitts'
            ? 'Saint Kitts'
            : destinationLower.includes('nevis')
            ? 'Nevis'
            : null;

        if (!destination) {
          console.warn(`Row ${i + 2}: Invalid destination "${destinationRaw}" for barcode ${barcode}`);
          skippedRows++;
          continue;
        }

        const productToAdd: ProductInput = {
          barcode,
          destination: destination as Destination,
          status: 'received',
          storageLocation: '',
          uploadStatus: 'uploaded',
          customerName: customerName && customerName.trim() !== '' ? customerName.trim() : undefined,
          price: price && price.trim() !== '' ? price.trim() : undefined,
          comment: comment && comment.trim() !== '' ? comment.trim() : undefined,
        };
        
        console.log(`Adding product: barcode=${productToAdd.barcode}, customer=${productToAdd.customerName}`);
        productsToImport.push(productToAdd);
      }

      console.log('Processing complete:', {
        totalRows: data.length,
        skippedRows,
        toImport: productsToImport.length
      });

      if (productsToImport.length === 0) {
        Alert.alert(
          'No Valid Data',
          'No valid packages found in the Excel file. Make sure the file has "barcode" and "destination" columns.'
        );
      } else {
        setPreviewData(productsToImport);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Error processing Excel file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert(
        'Error',
        `Failed to process the file: ${errorMessage}\n\nMake sure the file has "barcode" and "destination" columns in the first row.`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = () => {
    console.log('=== STARTING IMPORT ===');
    console.log('Preview data count:', previewData.length);
    console.log('Current products count:', products.length);
    
    const result = bulkImportProducts(previewData, session?.username);
    
    console.log('Import result:', JSON.stringify(result));
    
    setShowPreview(false);
    setPreviewData([]);
    
    if (result.isDuplicateUpload) {
      Alert.alert(
        'Duplicate Upload Detected',
        `All ${result.duplicates} package${result.duplicates !== 1 ? 's' : ''} in this manifest already exist in the system.\n\nNo changes have been made to your existing data. The status of existing packages remains unchanged.\n\nThis prevents duplicate uploads from affecting your inventory.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (result.added > 0) {
      const duplicateMsg = result.duplicates > 0 
        ? `\n\n${result.duplicates} duplicate barcode${result.duplicates !== 1 ? 's were' : ' was'} skipped (already in system).` 
        : '';
      const invalidMsg = result.invalid > 0 
        ? `\n${result.invalid} invalid row${result.invalid !== 1 ? 's were' : ' was'} skipped (empty or invalid data).` 
        : '';
      
      console.log('✓ Import successful, showing alert');
      Alert.alert(
        'Import Successful',
        `Successfully imported ${result.added} new package${result.added !== 1 ? 's' : ''} with "Uploaded" status.${duplicateMsg}${invalidMsg}\n\nScan packages to mark them as "Validated".\n\nTotal packages in system: ${products.length + result.added}`,
        [{ text: 'OK' }]
      );
    } else {
      const reason = result.duplicates > 0 
        ? 'All packages are duplicates and already exist in the system.' 
        : result.invalid > 0 
        ? 'All rows contained invalid or empty data.' 
        : 'No valid packages found.';
      
      console.log('⚠️ No packages imported:', reason);
      Alert.alert(
        'No New Packages',
        `No new packages were imported.\n\n${reason}`,
        [{ text: 'OK' }]
      );
    }
  };

  const exportFinancialToExcel = async () => {
    if (!hasPrivilege('exportExcel')) {
      Alert.alert('Access Denied', 'You do not have permission to export Excel files. Please contact your administrator.');
      return;
    }

    try {
      const parsePrice = (priceStr?: string): number => {
        if (!priceStr) return 0;
        const cleanPrice = priceStr.replace(/[^0-9.]/g, '');
        return parseFloat(cleanPrice) || 0;
      };

      const isInDateRange = (dateStr: string): boolean => {
        if (!dateRangeStart && !dateRangeEnd) return true;
        const date = new Date(dateStr);
        const start = dateRangeStart ? new Date(dateRangeStart) : null;
        const end = dateRangeEnd ? new Date(dateRangeEnd) : null;
        
        if (start && end) {
          return date >= start && date <= end;
        } else if (start) {
          return date >= start;
        } else if (end) {
          return date <= end;
        }
        return true;
      };

      const matchesUser = (p: any): boolean => {
        if (userFilter === 'all') return true;
        return p.receivedBy === userFilter || p.releasedBy === userFilter || p.transferredBy === userFilter;
      };

      const filteredProducts = products.filter(p => {
        const matchesDestination = financialDestinationFilter === 'all' || p.destination === financialDestinationFilter;
        const matchesDate = isInDateRange(p.dateAdded);
        const matchesUserFilter = matchesUser(p);
        const matchesStatus = financialStatusFilter === 'all' || p.status === financialStatusFilter;
        return matchesDestination && matchesDate && matchesUserFilter && matchesStatus;
      });

      const data = filteredProducts.map((p) => ({
        Barcode: p.barcode,
        'Customer Name': p.customerName || '',
        Status: p.status,
        Destination: p.destination,
        Price: p.price || '',
        'Received By': p.receivedBy || '',
        'Released By': p.releasedBy || '',
        'Transferred By': p.transferredBy || '',
        'Date Added': new Date(p.dateAdded).toLocaleString(),
        'Date Released': p.dateReleased ? new Date(p.dateReleased).toLocaleString() : '',
        'Date Transferred': p.dateTransferred ? new Date(p.dateTransferred).toLocaleString() : '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Financial Overview');

      const fileName = `financial_overview_${new Date().toISOString().split('T')[0]}.xlsx`;

      if (Platform.OS === 'web') {
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
        const blob = new Blob(
          [Uint8Array.from(atob(wbout), (c) => c.charCodeAt(0))],
          { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        Alert.alert('Success', 'Financial overview exported successfully');
      } else {
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
        
        await FileSystem.writeAsStringAsync(fileUri, wbout, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Export Financial Overview',
            UTI: 'com.microsoft.excel.xlsx',
          });
          Alert.alert('Success', 'Financial overview exported successfully');
        } else {
          Alert.alert(
            'Export Not Supported',
            'File sharing is not available on this device. Please use the web version to export.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error exporting financial data to Excel:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert(
        'Export Error',
        `Failed to export financial data: ${errorMessage}`
      );
    }
  };

  const exportToExcel = async () => {
    if (!hasPrivilege('exportExcel')) {
      Alert.alert('Access Denied', 'You do not have permission to export Excel files. Please contact your administrator.');
      return;
    }

    try {
      const data = products.map((p) => ({
        Barcode: p.barcode,
        Status: p.status,
        'Storage Location': p.storageLocation || '',
        Destination: p.destination,
        Notes: p.notes || '',
        'Date Added': new Date(p.dateAdded).toLocaleString(),
        'Last Updated': new Date(p.dateUpdated).toLocaleString(),
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');

      const fileName = `inventory_${new Date().toISOString().split('T')[0]}.xlsx`;

      if (Platform.OS === 'web') {
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
        const blob = new Blob(
          [Uint8Array.from(atob(wbout), (c) => c.charCodeAt(0))],
          { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        Alert.alert('Success', 'Inventory exported successfully');
      } else {
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
        
        await FileSystem.writeAsStringAsync(fileUri, wbout, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Export Inventory',
            UTI: 'com.microsoft.excel.xlsx',
          });
          Alert.alert('Success', 'Inventory exported successfully');
        } else {
          Alert.alert(
            'Export Not Supported',
            'File sharing is not available on this device. Please use the web version to export your inventory.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert(
        'Export Error',
        `Failed to export inventory: ${errorMessage}\n\nTry using the web version for better export support.`
      );
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Tools',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity
              style={styles.headerLeft}
              onPress={() => router.replace('/portal-selection')}
            >
              <Home size={20} color="#6B7280" />
              <Text style={styles.headerBackText}>Home</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={24} color="#6B7280" />
            <Text style={styles.sectionTitle}>Account</Text>
          </View>
          <View style={styles.userCard}>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{session?.username}</Text>
              <Text style={styles.userLabel}>Logged in as</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={20} color="#374151" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>

          {currentUser?.role === 'manager' && (
            <View style={styles.employeeSection}>
              <View style={styles.employeeSectionHeader}>
                <View style={styles.employeeSectionHeaderLeft}>
                  <Users size={20} color="#3B82F6" />
                  <Text style={styles.employeeSectionTitle}>Employee Management</Text>
                </View>
                <TouchableOpacity
                  style={styles.addEmployeeButton}
                  onPress={() => setShowAddEmployeeModal(true)}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={styles.addEmployeeButtonText}>Add</Text>
                </TouchableOpacity>
              </View>

              {subUsers.length === 0 ? (
                <View style={styles.emptyEmployeeState}>
                  <Users size={48} color="#D1D5DB" />
                  <Text style={styles.emptyEmployeeText}>No employees yet</Text>
                  <Text style={styles.emptyEmployeeSubtext}>Create employee accounts to manage portal access</Text>
                </View>
              ) : (
                <View style={styles.employeeList}>
                  {subUsers.map((employee) => (
                    <View key={employee.id} style={styles.employeeCard}>
                      <View style={styles.employeeCardHeader}>
                        <View style={styles.employeeIcon}>
                          <User size={20} color="#FFFFFF" />
                        </View>
                        <View style={styles.employeeInfo}>
                          <Text style={styles.employeeName}>{employee.username}</Text>
                          <View style={styles.employeeKeyRow}>
                            <Key size={14} color="#6B7280" />
                            <Text style={styles.employeeKey}>{employee.uniqueKey}</Text>
                            <TouchableOpacity onPress={() => copyToClipboard(employee.uniqueKey || '')}>
                              <Copy size={14} color="#3B82F6" />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={styles.employeeActions}>
                          <TouchableOpacity
                            style={styles.employeeActionButton}
                            onPress={() => handleResetPasswordPress(employee)}
                          >
                            <Lock size={16} color="#F59E0B" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.employeeActionButton}
                            onPress={() => handleEditPrivilegesPress(employee)}
                          >
                            <Edit3 size={16} color="#3B82F6" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteEmployeeButton}
                            onPress={() => handleDeleteEmployee(employee.id, employee.username)}
                          >
                            <Trash2 size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.privilegesList}>
                        {Object.entries(employee.privileges || {}).map(([key, value]) => {
                          const isEnabled = value as boolean;
                          return isEnabled ? (
                            <View key={key} style={styles.privilegeBadge}>
                              <CheckCircle size={12} color="#10B981" />
                              <Text style={styles.privilegeText}>
                                {key === 'receiving' ? 'Receiving' :
                                 key === 'releasing' ? 'Releasing' :
                                 key === 'nevisReceiving' ? 'Nevis Receiving' :
                                 key === 'nevisReleasing' ? 'Nevis Releasing' :
                                 key === 'scanner' ? 'Scanner' :
                                 key === 'addProduct' ? 'Add Product' :
                                 key === 'uploadExcel' ? 'Upload Excel' :
                                 key === 'exportExcel' ? 'Export Excel' :
                                 key === 'resetData' ? 'Reset Data' :
                                 key.charAt(0).toUpperCase() + key.slice(1)}
                              </Text>
                            </View>
                          ) : null;
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {currentUser?.role === 'manager' && (
            <View style={styles.financialSection}>
            <View style={styles.financialSectionHeader}>
              <View style={styles.financialSectionHeaderLeft}>
                <DollarSign size={20} color="#10B981" />
                <Text style={styles.financialSectionTitle}>Financial Overview</Text>
              </View>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowFilters(!showFilters)}
              >
                <Filter size={16} color="#6B7280" />
                <Text style={styles.filterButtonText}>Filters</Text>
                <ChevronDown size={16} color="#6B7280" style={{ transform: [{ rotate: showFilters ? '180deg' : '0deg' }] }} />
              </TouchableOpacity>
            </View>
            {showFilters && (
              <View style={styles.filtersContainer}>
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>Date Range</Text>
                  <View style={styles.dateRangeContainer}>
                    <View style={styles.dateInputWrapper}>
                      <Calendar size={16} color="#6B7280" />
                      <TextInput
                        style={styles.dateInput}
                        placeholder="Start (YYYY-MM-DD)"
                        placeholderTextColor="#9CA3AF"
                        value={dateRangeStart}
                        onChangeText={setDateRangeStart}
                      />
                    </View>
                    <Text style={styles.dateSeparator}>to</Text>
                    <View style={styles.dateInputWrapper}>
                      <Calendar size={16} color="#6B7280" />
                      <TextInput
                        style={styles.dateInput}
                        placeholder="End (YYYY-MM-DD)"
                        placeholderTextColor="#9CA3AF"
                        value={dateRangeEnd}
                        onChangeText={setDateRangeEnd}
                      />
                    </View>
                  </View>
                </View>
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>Destination</Text>
                  <View style={styles.filterChips}>
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        financialDestinationFilter === 'all' && styles.filterChipActive,
                      ]}
                      onPress={() => setFinancialDestinationFilter('all')}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          financialDestinationFilter === 'all' && styles.filterChipTextActive,
                        ]}
                      >
                        All
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        financialDestinationFilter === 'Saint Kitts' && styles.filterChipActive,
                      ]}
                      onPress={() => setFinancialDestinationFilter('Saint Kitts')}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          financialDestinationFilter === 'Saint Kitts' && styles.filterChipTextActive,
                        ]}
                      >
                        Saint Kitts
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        financialDestinationFilter === 'Nevis' && styles.filterChipActive,
                      ]}
                      onPress={() => setFinancialDestinationFilter('Nevis')}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          financialDestinationFilter === 'Nevis' && styles.filterChipTextActive,
                        ]}
                      >
                        Nevis
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>Status</Text>
                  <View style={styles.filterChips}>
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        financialStatusFilter === 'all' && styles.filterChipActive,
                      ]}
                      onPress={() => setFinancialStatusFilter('all')}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          financialStatusFilter === 'all' && styles.filterChipTextActive,
                        ]}
                      >
                        All
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        financialStatusFilter === 'received' && styles.filterChipActive,
                      ]}
                      onPress={() => setFinancialStatusFilter('received')}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          financialStatusFilter === 'received' && styles.filterChipTextActive,
                        ]}
                      >
                        In Warehouse
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        financialStatusFilter === 'released' && styles.filterChipActive,
                      ]}
                      onPress={() => setFinancialStatusFilter('released')}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          financialStatusFilter === 'released' && styles.filterChipTextActive,
                        ]}
                      >
                        Released
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>User Activity</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.filterChips}>
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          userFilter === 'all' && styles.filterChipActive,
                        ]}
                        onPress={() => setUserFilter('all')}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            userFilter === 'all' && styles.filterChipTextActive,
                          ]}
                        >
                          All Users
                        </Text>
                      </TouchableOpacity>
                      {allUsers.map(user => (
                        <TouchableOpacity
                          key={user}
                          style={[
                            styles.filterChip,
                            userFilter === user && styles.filterChipActive,
                          ]}
                          onPress={() => setUserFilter(user)}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              userFilter === user && styles.filterChipTextActive,
                            ]}
                          >
                            {user}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
                {(dateRangeStart || dateRangeEnd || financialDestinationFilter !== 'all' || financialStatusFilter !== 'all' || userFilter !== 'all') && (
                  <TouchableOpacity
                    style={styles.clearFiltersButton}
                    onPress={() => {
                      setDateRangeStart('');
                      setDateRangeEnd('');
                      setFinancialDestinationFilter('all');
                      setFinancialStatusFilter('all');
                      setUserFilter('all');
                    }}
                  >
                    <X size={16} color="#6B7280" />
                    <Text style={styles.clearFiltersText}>Clear All Filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <View style={styles.financialGrid}>
              <View style={[styles.financialCard, { backgroundColor: '#ECFDF5' }]}>
                <View style={styles.financialIcon}>
                  <Wallet size={20} color="#10B981" />
                </View>
                <Text style={styles.financialLabel}>In Warehouse</Text>
                <Text style={[styles.financialValue, { color: '#10B981' }]}>
                  ${financialStats.warehouseValue.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.financialCard, { backgroundColor: '#F0FDF4' }]}>
                <View style={styles.financialIcon}>
                  <CheckCircle size={20} color="#16A34A" />
                </View>
                <Text style={styles.financialLabel}>Collected</Text>
                <Text style={[styles.financialValue, { color: '#16A34A' }]}>
                  ${financialStats.collectedValue.toFixed(2)}
                </Text>
              </View>
            </View>
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Value</Text>
              <Text style={styles.totalValue}>${financialStats.totalValue.toFixed(2)}</Text>
            </View>
            <View style={styles.financialExportRow}>
              <TouchableOpacity
                style={styles.activityLogButton}
                onPress={() => setShowActivityLog(true)}
              >
                <Users size={16} color="#FFFFFF" />
                <Text style={styles.activityLogButtonText}>Activity</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exportFinancialButton}
                onPress={exportFinancialToExcel}
              >
                <Download size={16} color="#FFFFFF" />
                <Text style={styles.exportFinancialButtonText}>Export</Text>
              </TouchableOpacity>
            </View>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FileSpreadsheet size={24} color="#3B82F6" />
            <Text style={styles.sectionTitle}>Excel Import</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Upload an Excel file to import packages. Required columns: Air Way Bill # (barcode) and Store Location (destination). Optional: Customer Name, Price, and Comment.
          </Text>

          <View style={styles.exampleCard}>
            <Text style={styles.exampleTitle}>Example Format:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={styles.exampleTable}>
                <View style={styles.exampleRow}>
                  <Text style={[styles.exampleHeader, { width: 120 }]}>Air Way Bill #</Text>
                  <Text style={[styles.exampleHeader, { width: 100 }]}>Customer Name</Text>
                  <Text style={[styles.exampleHeader, { width: 100 }]}>Store Location</Text>
                  <Text style={[styles.exampleHeader, { width: 80 }]}>Price</Text>
                  <Text style={[styles.exampleHeader, { width: 100 }]}>Comment</Text>
                </View>
                <View style={styles.exampleRow}>
                  <Text style={[styles.exampleCell, { width: 120 }]}>123456789</Text>
                  <Text style={[styles.exampleCell, { width: 100 }]}>John Doe</Text>
                  <Text style={[styles.exampleCell, { width: 100 }]}>Saint Kitts</Text>
                  <Text style={[styles.exampleCell, { width: 80 }]}>$25.00</Text>
                  <Text style={[styles.exampleCell, { width: 100 }]}>Fragile</Text>
                </View>
                <View style={styles.exampleRow}>
                  <Text style={[styles.exampleCell, { width: 120 }]}>987654321</Text>
                  <Text style={[styles.exampleCell, { width: 100 }]}>Jane Smith</Text>
                  <Text style={[styles.exampleCell, { width: 100 }]}>Nevis</Text>
                  <Text style={[styles.exampleCell, { width: 80 }]}>$15.50</Text>
                  <Text style={[styles.exampleCell, { width: 100 }]}>Express</Text>
                </View>
              </View>
            </ScrollView>
          </View>

          <TouchableOpacity
            style={[styles.uploadButton, isProcessing && styles.uploadButtonDisabled]}
            onPress={pickDocument}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Upload size={20} color="#FFFFFF" />
                <Text style={styles.uploadButtonText}>Select Excel File</Text>
              </>
            )}
          </TouchableOpacity>

          {uploadResult && (
            <View
              style={[
                styles.resultCard,
                uploadResult.success
                  ? styles.resultCardSuccess
                  : styles.resultCardError,
              ]}
            >
              <View style={styles.resultHeader}>
                {uploadResult.success ? (
                  <CheckCircle size={24} color="#10B981" />
                ) : (
                  <AlertCircle size={24} color="#EF4444" />
                )}
                <Text
                  style={[
                    styles.resultMessage,
                    uploadResult.success
                      ? styles.resultMessageSuccess
                      : styles.resultMessageError,
                  ]}
                >
                  {uploadResult.message}
                </Text>
              </View>
              <View style={styles.resultStats}>
                <View style={styles.resultStat}>
                  <Text style={styles.resultStatValue}>
                    {uploadResult.updated}
                  </Text>
                  <Text style={styles.resultStatLabel}>Updated</Text>
                </View>
                {uploadResult.notFound > 0 && (
                  <View style={styles.resultStat}>
                    <Text style={[styles.resultStatValue, { color: '#F59E0B' }]}>
                      {uploadResult.notFound}
                    </Text>
                    <Text style={styles.resultStatLabel}>Not Found</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Download size={24} color="#10B981" />
            <Text style={styles.sectionTitle}>Export Inventory</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Download your complete inventory as an Excel file for backup or external
            processing.
          </Text>

          <TouchableOpacity
            style={styles.exportButton}
            onPress={exportToExcel}
          >
            <Download size={20} color="#FFFFFF" />
            <Text style={styles.exportButtonText}>Export to Excel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Tips:</Text>
          <Text style={styles.infoText}>
            • Column names are case-insensitive and flexible
          </Text>
          <Text style={styles.infoText}>
            • Air Way Bill # can be named: "AWB", "Barcode", "Air Way Bill"
          </Text>
          <Text style={styles.infoText}>
            • Store Location can be: "Saint Kitts", "St Kitts", "Nevis"
          </Text>
          <Text style={styles.infoText}>
            • Customer Name, Price, and Comment are optional
          </Text>
          <Text style={styles.infoText}>
            • Packages are grouped by customer name in the receiving portal
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <RefreshCcw size={24} color="#DC2626" />
            <Text style={styles.sectionTitle}>Reset Inventory</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Permanently delete all products and reset all counts to zero. This action requires a secret code and cannot be undone.
          </Text>

          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleResetPress}
          >
            <RefreshCcw size={20} color="#DC2626" />
            <Text style={styles.resetButtonText}>Reset All Data</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Trash2 size={24} color="#EF4444" />
            <Text style={styles.sectionTitle}>Danger Zone</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Permanently delete your account and all associated data. This action cannot be undone.
          </Text>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
            <Trash2 size={20} color="#EF4444" />
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showResetModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseResetModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <RefreshCcw size={32} color="#DC2626" />
              <Text style={styles.modalTitle}>Enter Reset Code</Text>
            </View>
            <Text style={styles.modalDescription}>
              Please enter the secret code to reset all inventory data. This action cannot be undone.
            </Text>
            <TextInput
              ref={resetInputRef}
              style={styles.codeInput}
              value={resetCode}
              onChangeText={setResetCode}
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
                onPress={handleCloseResetModal}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  resetCode.length !== 4 && styles.modalConfirmButtonDisabled,
                ]}
                onPress={handleResetConfirm}
                disabled={resetCode.length !== 4}
              >
                <Text style={styles.modalConfirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPreview}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPreview(false)}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={styles.previewTitleContainer}>
                <Eye size={28} color="#3B82F6" />
                <Text style={styles.previewTitle}>Preview Import</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPreview(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.previewStats}>
              <View style={styles.previewStatItem}>
                <Text style={styles.previewStatValue}>{previewData.length}</Text>
                <Text style={styles.previewStatLabel}>Packages Ready</Text>
              </View>
              <View style={styles.previewStatItem}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>Uploaded</Text>
                </View>
                <Text style={styles.previewStatHint}>Will be marked as</Text>
              </View>
            </View>

            <Text style={styles.previewDescription}>
              These packages will be imported with <Text style={styles.boldText}>"Uploaded"</Text> status. After importing, scan each package to mark it as <Text style={styles.boldText}>"Validated"</Text>.
            </Text>

            <ScrollView style={styles.previewList}>
              {previewData.slice(0, 10).map((product, index) => (
                <View key={index} style={styles.previewItem}>
                  <Text style={styles.previewBarcode}>{product.barcode}</Text>
                  <View style={styles.previewDestBadge}>
                    <Text style={styles.previewDestText}>{product.destination}</Text>
                  </View>
                </View>
              ))}
              {previewData.length > 10 && (
                <View style={styles.previewMore}>
                  <Text style={styles.previewMoreText}>
                    + {previewData.length - 10} more package{previewData.length - 10 !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.previewCancelButton}
                onPress={() => {
                  setShowPreview(false);
                  setPreviewData([]);
                }}
              >
                <Text style={styles.previewCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.previewConfirmButton}
                onPress={handleConfirmImport}
              >
                <CheckCircle size={20} color="#FFFFFF" />
                <Text style={styles.previewConfirmButtonText}>Confirm Import</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAddEmployeeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddEmployeeModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.employeeModalContent}>
              <View style={styles.employeeModalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <Users size={28} color="#3B82F6" />
                  <Text style={styles.employeeModalTitle}>Add Employee</Text>
                </View>
                <TouchableOpacity onPress={() => setShowAddEmployeeModal(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.employeeModalBody}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Username</Text>
                  <TextInput
                    style={styles.input}
                    value={newEmployeeUsername}
                    onChangeText={setNewEmployeeUsername}
                    placeholder="Enter employee username"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={styles.input}
                    value={newEmployeePassword}
                    onChangeText={setNewEmployeePassword}
                    placeholder="Enter employee password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.privilegesSection}>
                  <Text style={styles.privilegesSectionTitle}>Portal Access</Text>
                  <Text style={styles.privilegesSectionSubtitle}>Select which portals this employee can access</Text>
                  <View style={styles.privilegesGrid}>
                    {Object.entries(newEmployeePrivileges).map(([key, value]) => (
                      <TouchableOpacity
                        key={key}
                        style={[styles.privilegeCheckbox, value && styles.privilegeCheckboxActive]}
                        onPress={() => setNewEmployeePrivileges(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
                      >
                        <View style={[styles.checkbox, value && styles.checkboxActive]}>
                          {value && <CheckCircle size={16} color="#FFFFFF" />}
                        </View>
                        <Text style={[styles.privilegeCheckboxText, value && styles.privilegeCheckboxTextActive]}>
                          {key === 'receiving' ? 'St. Kitts Receiving' :
                           key === 'releasing' ? 'St. Kitts Releasing' :
                           key === 'nevisReceiving' ? 'Nevis Receiving' :
                           key === 'nevisReleasing' ? 'Nevis Releasing' :
                           key === 'scanner' ? 'Scanner' :
                           key === 'addProduct' ? 'Add Product' :
                           key === 'uploadExcel' ? 'Upload Excel' :
                           key === 'exportExcel' ? 'Export Excel' :
                           key === 'resetData' ? 'Reset Data' :
                           key.charAt(0).toUpperCase() + key.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.keyInfoBox}>
                  <Key size={20} color="#3B82F6" />
                  <Text style={styles.keyInfoText}>
                    A unique key will be automatically generated for this employee. They&apos;ll need it to login.
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.employeeModalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowAddEmployeeModal(false);
                    setNewEmployeeUsername('');
                    setNewEmployeePassword('');
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmButton, isCreatingEmployee && styles.modalConfirmButtonDisabled]}
                  onPress={handleCreateEmployee}
                  disabled={isCreatingEmployee}
                >
                  {isCreatingEmployee ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Plus size={20} color="#FFFFFF" />
                      <Text style={styles.modalConfirmButtonText}>Create</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showResetPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResetPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Lock size={32} color="#F59E0B" />
              <Text style={styles.modalTitle}>Reset Password</Text>
            </View>
            <Text style={styles.modalDescription}>
              Set a new password for {selectedEmployee?.username}
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                value={newPasswordForEmployee}
                onChangeText={setNewPasswordForEmployee}
                placeholder="Enter new password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowResetPasswordModal(false);
                  setSelectedEmployee(null);
                  setNewPasswordForEmployee('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, isResettingPassword && styles.modalConfirmButtonDisabled]}
                onPress={handleConfirmResetPassword}
                disabled={isResettingPassword}
              >
                {isResettingPassword ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>Reset Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditPrivilegesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditPrivilegesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.employeeModalContent}>
            <View style={styles.employeeModalHeader}>
              <View style={styles.modalHeaderLeft}>
                <ShieldCheck size={28} color="#3B82F6" />
                <Text style={styles.employeeModalTitle}>Edit Privileges</Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditPrivilegesModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.employeeModalBody}>
              <View style={styles.privilegesSection}>
                <Text style={styles.privilegesSectionTitle}>Portal Access for {selectedEmployee?.username}</Text>
                <Text style={styles.privilegesSectionSubtitle}>Select which portals this employee can access</Text>
                <View style={styles.privilegesGrid}>
                  {selectedEmployee && Object.entries(selectedEmployee.privileges || {}).map(([key, value]) => {
                    const isEnabled = value as boolean;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.privilegeCheckbox, isEnabled && styles.privilegeCheckboxActive]}
                        onPress={() => togglePrivilege(key)}
                      >
                        <View style={[styles.checkbox, isEnabled && styles.checkboxActive]}>
                          {isEnabled && <CheckCircle size={16} color="#FFFFFF" />}
                        </View>
                        <Text style={[styles.privilegeCheckboxText, isEnabled && styles.privilegeCheckboxTextActive]}>
                        {key === 'receiving' ? 'St. Kitts Receiving' :
                         key === 'releasing' ? 'St. Kitts Releasing' :
                         key === 'nevisReceiving' ? 'Nevis Receiving' :
                         key === 'nevisReleasing' ? 'Nevis Releasing' :
                         key === 'scanner' ? 'Scanner' :
                         key === 'addProduct' ? 'Add Product' :
                         key === 'uploadExcel' ? 'Upload Excel' :
                         key === 'exportExcel' ? 'Export Excel' :
                         key === 'resetData' ? 'Reset Data' :
                         key.charAt(0).toUpperCase() + key.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View style={styles.employeeModalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowEditPrivilegesModal(false);
                  setSelectedEmployee(null);
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, isUpdatingPrivileges && styles.modalConfirmButtonDisabled]}
                onPress={handleConfirmUpdatePrivileges}
                disabled={isUpdatingPrivileges}
              >
                {isUpdatingPrivileges ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <ShieldCheck size={20} color="#FFFFFF" />
                    <Text style={styles.modalConfirmButtonText}>Update</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showActivityLog}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActivityLog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.activityLogModal}>
            <View style={styles.activityLogHeader}>
              <View style={styles.modalHeaderLeft}>
                <Users size={28} color="#3B82F6" />
                <Text style={styles.activityLogTitle}>User Activity Log</Text>
              </View>
              <TouchableOpacity onPress={() => setShowActivityLog(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.activityLogSearchContainer}>
              <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                style={styles.activityLogSearchInput}
                placeholder="Search by barcode, customer, or user..."
                value={activitySearchQuery}
                onChangeText={setActivitySearchQuery}
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={styles.activityFilterSection}>
              <TouchableOpacity
                style={[styles.activityFilterToggle, showActivityFilters && styles.activityFilterToggleActive]}
                onPress={() => setShowActivityFilters(!showActivityFilters)}
              >
                <Filter size={18} color={showActivityFilters ? '#3B82F6' : '#6B7280'} />
                <Text style={[styles.activityFilterToggleText, showActivityFilters && styles.activityFilterToggleTextActive]}>
                  Filters
                </Text>
                <ChevronDown size={16} color={showActivityFilters ? '#3B82F6' : '#6B7280'} style={{ transform: [{ rotate: showActivityFilters ? '180deg' : '0deg' }] }} />
              </TouchableOpacity>
              {(activityDateStart || activityDateEnd || activityActionFilter !== 'all' || activityUserFilter !== 'all' || activityStatusFilter !== 'all') && (
                <TouchableOpacity
                  style={styles.activityClearFiltersBtn}
                  onPress={() => {
                    setActivityDateStart('');
                    setActivityDateEnd('');
                    setActivityActionFilter('all');
                    setActivityUserFilter('all');
                    setActivityStatusFilter('all');
                  }}
                >
                  <X size={14} color="#EF4444" />
                  <Text style={styles.activityClearFiltersBtnText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            {showActivityFilters && (
              <View style={styles.activityFiltersPanel}>
                <View style={styles.activityFilterRow}>
                  <Text style={styles.activityFilterLabel}>Date Range</Text>
                  <View style={styles.activityDateRangeRow}>
                    <View style={styles.activityDateInputWrapper}>
                      <Calendar size={14} color="#6B7280" />
                      <TextInput
                        style={styles.activityDateInput}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#9CA3AF"
                        value={activityDateStart}
                        onChangeText={setActivityDateStart}
                      />
                    </View>
                    <Text style={styles.activityDateSeparator}>to</Text>
                    <View style={styles.activityDateInputWrapper}>
                      <Calendar size={14} color="#6B7280" />
                      <TextInput
                        style={styles.activityDateInput}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#9CA3AF"
                        value={activityDateEnd}
                        onChangeText={setActivityDateEnd}
                      />
                    </View>
                  </View>
                </View>
                <View style={styles.activityFilterRow}>
                  <Text style={styles.activityFilterLabel}>Action Type</Text>
                  <View style={styles.activityFilterChips}>
                    {['all', 'received', 'released', 'transferred'].map((action) => (
                      <TouchableOpacity
                        key={action}
                        style={[
                          styles.activityFilterChip,
                          activityActionFilter === action && styles.activityFilterChipActive,
                        ]}
                        onPress={() => setActivityActionFilter(action as any)}
                      >
                        <Text
                          style={[
                            styles.activityFilterChipText,
                            activityActionFilter === action && styles.activityFilterChipTextActive,
                          ]}
                        >
                          {action.charAt(0).toUpperCase() + action.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.activityFilterRow}>
                  <Text style={styles.activityFilterLabel}>User</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.activityFilterChips}>
                      <TouchableOpacity
                        style={[
                          styles.activityFilterChip,
                          activityUserFilter === 'all' && styles.activityFilterChipActive,
                        ]}
                        onPress={() => setActivityUserFilter('all')}
                      >
                        <Text
                          style={[
                            styles.activityFilterChipText,
                            activityUserFilter === 'all' && styles.activityFilterChipTextActive,
                          ]}
                        >
                          All Users
                        </Text>
                      </TouchableOpacity>
                      {allUsers.map((user) => (
                        <TouchableOpacity
                          key={user}
                          style={[
                            styles.activityFilterChip,
                            activityUserFilter === user && styles.activityFilterChipActive,
                          ]}
                          onPress={() => setActivityUserFilter(user)}
                        >
                          <Text
                            style={[
                              styles.activityFilterChipText,
                              activityUserFilter === user && styles.activityFilterChipTextActive,
                            ]}
                          >
                            {user}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
                <View style={styles.activityFilterRow}>
                  <Text style={styles.activityFilterLabel}>Status</Text>
                  <View style={styles.activityFilterChips}>
                    {['all', 'received', 'released', 'transferred'].map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.activityFilterChip,
                          activityStatusFilter === status && styles.activityFilterChipActive,
                        ]}
                        onPress={() => setActivityStatusFilter(status as any)}
                      >
                        <Text
                          style={[
                            styles.activityFilterChipText,
                            activityStatusFilter === status && styles.activityFilterChipTextActive,
                          ]}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}
            <ScrollView style={styles.activityLogContent} showsVerticalScrollIndicator={true}>
              {(() => {
                const searchLower = activitySearchQuery.toLowerCase();
                const filteredActivityProducts = products.filter(p => {
                  const hasActivity = p.receivedBy || p.releasedBy || p.transferredBy;
                  if (!hasActivity) return false;

                  const matchesSearch = activitySearchQuery === '' || 
                    p.barcode.toLowerCase().includes(searchLower) ||
                    (p.customerName && p.customerName.toLowerCase().includes(searchLower)) ||
                    (p.receivedBy && p.receivedBy.toLowerCase().includes(searchLower)) ||
                    (p.releasedBy && p.releasedBy.toLowerCase().includes(searchLower)) ||
                    (p.transferredBy && p.transferredBy.toLowerCase().includes(searchLower));
                  
                  if (!matchesSearch) return false;

                  if (activityDateStart || activityDateEnd) {
                    const productDate = new Date(p.dateUpdated);
                    const startDate = activityDateStart ? new Date(activityDateStart) : null;
                    const endDate = activityDateEnd ? new Date(activityDateEnd) : null;
                    
                    if (startDate && productDate < startDate) return false;
                    if (endDate) {
                      const endOfDay = new Date(endDate);
                      endOfDay.setHours(23, 59, 59, 999);
                      if (productDate > endOfDay) return false;
                    }
                  }

                  if (activityActionFilter !== 'all') {
                    if (activityActionFilter === 'received' && !p.receivedBy) return false;
                    if (activityActionFilter === 'released' && !p.releasedBy) return false;
                    if (activityActionFilter === 'transferred' && !p.transferredBy) return false;
                  }

                  if (activityUserFilter !== 'all') {
                    const matchesUser = 
                      p.receivedBy === activityUserFilter || 
                      p.releasedBy === activityUserFilter || 
                      p.transferredBy === activityUserFilter;
                    if (!matchesUser) return false;
                  }

                  if (activityStatusFilter !== 'all') {
                    if (p.status !== activityStatusFilter) return false;
                  }

                  return true;
                }).sort((a, b) => new Date(b.dateUpdated).getTime() - new Date(a.dateUpdated).getTime());

                console.log('Activity Log - Total products:', products.length);
                console.log('Activity Log - Filtered products:', filteredActivityProducts.length);
                console.log('Activity Log - User filter:', activityUserFilter);
                console.log('Activity Log - Action filter:', activityActionFilter);
                console.log('Activity Log - Status filter:', activityStatusFilter);

                if (filteredActivityProducts.length === 0) {
                  return (
                    <View style={styles.activityLogEmpty}>
                      <Users size={48} color="#D1D5DB" />
                      <Text style={styles.activityLogEmptyText}>No activity found</Text>
                      <Text style={styles.activityLogEmptySubtext}>
                        {activitySearchQuery ? 'Try adjusting your search or filters' : 
                         activityUserFilter !== 'all' ? `No activity for ${activityUserFilter}` : 
                         'No user activity recorded yet'}
                      </Text>
                    </View>
                  );
                }

                return filteredActivityProducts.map((product) => (
                  <View key={product.id} style={styles.activityLogItem}>
                    <View style={styles.activityLogItemHeader}>
                      <View style={styles.activityLogItemContent}>
                        <Text style={styles.activityLogBarcode}>{product.barcode}</Text>
                        {product.customerName && (
                          <Text style={styles.activityLogCustomer}>{product.customerName}</Text>
                        )}
                      </View>
                      <View style={styles.activityLogDestinationBadge}>
                        <MapPin size={12} color={product.destination === 'Saint Kitts' ? '#3B82F6' : '#8B5CF6'} />
                        <Text style={[styles.activityLogDestinationText, { color: product.destination === 'Saint Kitts' ? '#1E40AF' : '#6B21A8' }]}>
                          {product.destination}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.activityLogActions}>
                      {product.receivedBy && (
                        <View style={styles.activityLogAction}>
                          <View style={[styles.activityLogBadge, { backgroundColor: '#DBEAFE' }]}>
                            <CheckCircle size={14} color="#3B82F6" />
                            <Text style={[styles.activityLogActionText, { color: '#1E40AF' }]}>Received</Text>
                          </View>
                          <View style={styles.activityLogMeta}>
                            <User size={12} color="#6B7280" />
                            <Text style={styles.activityLogUser}>{product.receivedBy}</Text>
                            <Text style={styles.activityLogDate}>
                              {new Date(product.dateAdded).toLocaleDateString()} {new Date(product.dateAdded).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        </View>
                      )}
                      {product.releasedBy && (
                        <View style={styles.activityLogAction}>
                          <View style={[styles.activityLogBadge, { backgroundColor: '#D1FAE5' }]}>
                            <Package size={14} color="#10B981" />
                            <Text style={[styles.activityLogActionText, { color: '#047857' }]}>Released</Text>
                          </View>
                          <View style={styles.activityLogMeta}>
                            <User size={12} color="#6B7280" />
                            <Text style={styles.activityLogUser}>{product.releasedBy}</Text>
                            <Text style={styles.activityLogDate}>
                              {product.dateReleased ? new Date(product.dateReleased).toLocaleDateString() : ''} {product.dateReleased ? new Date(product.dateReleased).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </Text>
                          </View>
                        </View>
                      )}
                      {product.transferredBy && (
                        <View style={styles.activityLogAction}>
                          <View style={[styles.activityLogBadge, { backgroundColor: '#FEF3C7' }]}>
                            <MapPin size={14} color="#F59E0B" />
                            <Text style={[styles.activityLogActionText, { color: '#92400E' }]}>Transferred</Text>
                          </View>
                          <View style={styles.activityLogMeta}>
                            <User size={12} color="#6B7280" />
                            <Text style={styles.activityLogUser}>{product.transferredBy}</Text>
                            <Text style={styles.activityLogDate}>
                              {product.dateTransferred ? new Date(product.dateTransferred).toLocaleDateString() : ''} {product.dateTransferred ? new Date(product.dateTransferred).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                    {product.price && (
                      <View style={styles.activityLogPrice}>
                        <DollarSign size={14} color="#10B981" />
                        <Text style={styles.activityLogPriceText}>{product.price}</Text>
                      </View>
                    )}
                    {product.status && (
                      <View style={styles.activityLogStatusBadge}>
                        <Text style={styles.activityLogStatusText}>Status: {product.status}</Text>
                      </View>
                    )}
                  </View>
                ));
              })()}
            </ScrollView>
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
    color: '#6B7280',
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
  section: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
  },
  sectionDescription: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  exampleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  exampleTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 12,
  },
  exampleTable: {
    gap: 8,
  },
  exampleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  exampleHeader: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#111827',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  exampleCell: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  resultCard: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  resultCardSuccess: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  resultCardError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultMessage: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  resultMessageSuccess: {
    color: '#047857',
  },
  resultMessageError: {
    color: '#DC2626',
  },
  resultStats: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 8,
  },
  resultStat: {
    gap: 4,
  },
  resultStatValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  resultStatLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1E40AF',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  userInfo: {
    gap: 4,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
  },
  userLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#374151',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#EF4444',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#DC2626',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#DC2626',
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
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  modalCancelButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#374151',
    letterSpacing: 0.2,
  },
  modalConfirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  modalConfirmButtonDisabled: {
    opacity: 0.4,
  },
  modalConfirmButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  previewTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#111827',
  },
  previewStats: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 24,
    backgroundColor: '#F9FAFB',
  },
  previewStatItem: {
    gap: 4,
  },
  previewStatValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#3B82F6',
  },
  previewStatLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  previewStatHint: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  previewDescription: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  boldText: {
    fontWeight: '600' as const,
    color: '#111827',
  },
  previewList: {
    maxHeight: 300,
    paddingHorizontal: 24,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
  },
  previewBarcode: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#111827',
  },
  previewDestBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewDestText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#1E40AF',
  },
  previewMore: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  previewMoreText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  previewCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewCancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#374151',
  },
  previewConfirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
  },
  previewConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  financialGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  financialCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  financialIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  financialLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  financialValue: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  totalCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#F9FAFB',
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  financialSection: {
    marginTop: 16,
    gap: 12,
  },
  financialSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  financialSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#374151',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterRow: {
    gap: 10,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  dateSeparator: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#374151',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  employeeSection: {
    marginTop: 16,
    gap: 12,
  },
  employeeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  employeeSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
  },
  addEmployeeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    minWidth: 80,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addEmployeeButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  emptyEmployeeState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyEmployeeText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  emptyEmployeeSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  employeeList: {
    gap: 12,
  },
  employeeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  employeeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  employeeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  employeeInfo: {
    flex: 1,
    gap: 4,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
  },
  employeeKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  employeeKey: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  employeeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  employeeActionButton: {
    padding: 8,
  },
  deleteEmployeeButton: {
    padding: 8,
  },
  privilegesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  privilegeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  privilegeText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: '#047857',
  },
  employeeModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 32,
  },
  employeeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  employeeModalTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#111827',
  },
  employeeModalBody: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  privilegesSection: {
    gap: 12,
    marginTop: 8,
  },
  privilegesSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
  },
  privilegesSectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  privilegesGrid: {
    gap: 8,
  },
  privilegeCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  privilegeCheckboxActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  privilegeCheckboxText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  privilegeCheckboxTextActive: {
    color: '#111827',
    fontWeight: '600' as const,
  },
  keyInfoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 16,
  },
  keyInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 20,
  },
  employeeModalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  inputGroup: {
    gap: 8,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  activityLogButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  activityLogButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  financialExportRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  exportFinancialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  exportFinancialButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  activityLogModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    maxHeight: '85%',
    width: '90%',
    maxWidth: 600,
  },
  activityLogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  activityLogTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#111827',
  },
  activityLogSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 24,
    marginVertical: 12,
  },
  activityLogSearchInput: {
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
  activityLogContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  activityLogItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activityLogItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  activityLogDestinationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activityLogDestinationText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  activityLogStatusBadge: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  activityLogStatusText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  activityLogBarcode: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#111827',
  },
  activityLogCustomer: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  activityLogActions: {
    gap: 10,
  },
  activityLogAction: {
    gap: 6,
  },
  activityLogBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  activityLogActionText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  activityLogMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
  },
  activityLogUser: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#374151',
  },
  activityLogDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  activityLogPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  activityLogPriceText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  activityLogEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 12,
  },
  activityLogEmptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  activityLogEmptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  activityFilterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  activityFilterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activityFilterToggleActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  activityFilterToggleText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  activityFilterToggleTextActive: {
    color: '#3B82F6',
  },
  activityClearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  activityClearFiltersBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#EF4444',
  },
  activityFiltersPanel: {
    backgroundColor: '#F9FAFB',
    marginHorizontal: 24,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activityFilterRow: {
    gap: 10,
  },
  activityFilterLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#374151',
    textTransform: 'uppercase' as const,
  },
  activityDateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityDateInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  activityDateInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  activityDateSeparator: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  activityFilterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activityFilterChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  activityFilterChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  activityFilterChipTextActive: {
    color: '#FFFFFF',
  },
  searchIcon: {
    marginRight: 8,
  },
  employeeSectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  financialSectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityLogItemContent: {
    flex: 1,
  },
});
