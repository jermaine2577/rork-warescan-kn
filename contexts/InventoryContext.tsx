import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo, useEffect } from 'react';
import type { Product, ProductInput, ProductStatus, Destination } from '@/types/inventory';
import { getDb, initializeFirebase } from '@/config/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { User } from '@/contexts/AuthContext';

const CURRENT_USER_KEY = '@current_user_id';
const USERS_STORAGE_KEY = '@inventory_users';

function getUserStorageKey(userId: string): string {
  return `@inventory_products_${userId}`;
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CURRENT_USER_KEY);
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

async function getCurrentUser(): Promise<User | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return null;
    
    const stored = await AsyncStorage.getItem(USERS_STORAGE_KEY);
    if (!stored) return null;
    
    const users: User[] = JSON.parse(stored);
    return users.find(u => u.id === userId) || null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

function getEffectiveOwnerIdForUser(user: User | null): string {
  if (!user) return 'unknown';
  
  if (user.role === 'sub-user' && user.managerId) {
    return user.managerId;
  }
  
  return user.id;
}

async function loadProducts(userId: string | null): Promise<Product[]> {
  if (!userId) {
    console.log('No user ID, returning empty products');
    return [];
  }

  try {
    const currentUser = await getCurrentUser();
    const effectiveOwnerId = getEffectiveOwnerIdForUser(currentUser);
    
    console.log(`Loading products for user ${userId}, effective owner: ${effectiveOwnerId}`);
    
    const storageKey = getUserStorageKey(effectiveOwnerId);
    let stored = await AsyncStorage.getItem(storageKey);
    
    if (!stored || stored.trim() === '') {
      console.log('No stored products found for user, starting fresh');
      await AsyncStorage.setItem(storageKey, JSON.stringify([]));
      return [];
    }
    
    stored = stored.trim();
    
    if (stored.length < 2) {
      console.warn('Invalid stored data (too short), resetting');
      await AsyncStorage.removeItem(storageKey);
      await AsyncStorage.setItem(storageKey, JSON.stringify([]));
      return [];
    }
    
    if (/^(\[?object|undefined|null|NaN)/i.test(stored)) {
      console.error('Products storage contains non-JSON:', stored.substring(0, 50), '... resetting');
      await AsyncStorage.removeItem(storageKey);
      await AsyncStorage.setItem(storageKey, JSON.stringify([]));
      return [];
    }
    
    const firstChar = stored[0];
    if (firstChar !== '[' && firstChar !== '{') {
      console.error('Invalid JSON format in storage, expected [ or { but got:', firstChar);
      console.error('First 100 chars of corrupted data:', stored.substring(0, 100));
      console.error('Fixing corrupted storage...');
      await AsyncStorage.removeItem(storageKey);
      await AsyncStorage.setItem(storageKey, JSON.stringify([]));
      return [];
    }
    
    try {
      const parsed = JSON.parse(stored);
      
      if (!Array.isArray(parsed)) {
        console.warn('Cached products is not an array, resetting');
        await AsyncStorage.removeItem(storageKey);
        await AsyncStorage.setItem(storageKey, JSON.stringify([]));
        return [];
      }
      
      const userProducts = parsed.filter((p: Product) => p.ownerId === effectiveOwnerId);
      console.log(`✓ Loaded ${userProducts.length} products from storage for effective owner ${effectiveOwnerId}`);
      return userProducts;
    } catch (parseError) {
      console.error('❌ JSON Parse error in products:', parseError);
      console.error('Error message:', parseError instanceof Error ? parseError.message : String(parseError));
      console.error('First 200 chars of corrupted data:', stored.substring(0, 200));
      console.error('Last 200 chars of corrupted data:', stored.substring(Math.max(0, stored.length - 200)));
      console.error('Fixing storage due to JSON parse error...');
      await AsyncStorage.removeItem(storageKey);
      await AsyncStorage.setItem(storageKey, JSON.stringify([]));
      return [];
    }
  } catch (error) {
    console.error('❌ Critical error loading products:', error);
    try {
      const currentUser = await getCurrentUser();
      const effectiveOwnerId = getEffectiveOwnerIdForUser(currentUser);
      const storageKey = getUserStorageKey(effectiveOwnerId);
      await AsyncStorage.removeItem(storageKey);
      await AsyncStorage.setItem(storageKey, JSON.stringify([]));
    } catch (clearError) {
      console.error('Failed to clear storage:', clearError);
    }
    return [];
  }
}

async function saveProducts(products: Product[], userId: string | null): Promise<Product[]> {
  if (!userId) {
    console.error('Cannot save products without user ID');
    throw new Error('Cannot save products without user ID. Please ensure you are logged in.');
  }
  
  const currentUser = await getCurrentUser();
  const effectiveOwnerId = getEffectiveOwnerIdForUser(currentUser);

  try {
    if (!Array.isArray(products)) {
      console.error('Invalid products data, expected array, got:', typeof products);
      return [];
    }
    
    const cleanedProducts = products.map(p => {
      const cleaned: any = {};
      for (const key in p) {
        const value = (p as any)[key];
        if (value !== undefined && value !== null) {
          if (typeof value === 'object' && value !== null) {
            try {
              JSON.stringify(value);
              cleaned[key] = value;
            } catch {
              console.warn(`Skipping non-serializable field ${key}`);
            }
          } else {
            cleaned[key] = value;
          }
        }
      }
      return cleaned as Product;
    });
    
    let serialized: string;
    try {
      serialized = JSON.stringify(cleanedProducts);
    } catch (stringifyError) {
      console.error('JSON.stringify failed:', stringifyError);
      throw new Error('Failed to serialize products: ' + (stringifyError instanceof Error ? stringifyError.message : 'unknown error'));
    }
    
    if (typeof serialized !== 'string' || serialized.length < 2) {
      console.error('Serialization produced invalid string:', serialized);
      throw new Error('Failed to serialize products');
    }
    
    if (serialized.startsWith('[object') || serialized.startsWith('object') || serialized === 'undefined' || serialized === 'null') {
      console.error('Serialization produced invalid object string instead of JSON:', serialized.substring(0, 100));
      throw new Error('Invalid serialization result');
    }
    
    const storageKey = getUserStorageKey(effectiveOwnerId);
    await AsyncStorage.setItem(storageKey, serialized);
    console.log(`✓ Saved ${cleanedProducts.length} products to storage for effective owner ${effectiveOwnerId}`);
    
    return cleanedProducts;
  } catch (error) {
    console.error('Error saving products:', error);
    if (error instanceof Error && error.message.includes('quota')) {
      console.error('Storage quota exceeded');
    }
    return products;
  }
}

function cleanProductForFirestore(product: Product): Record<string, any> {
  const cleaned: Record<string, any> = {};
  Object.keys(product).forEach(key => {
    const value = (product as any)[key];
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value;
    }
  });
  return cleaned;
}

async function syncSingleProductToFirestore(product: Product, userId: string): Promise<void> {
  try {
    if (!userId) return;

    await initializeFirebase();
    const db = getDb();
    if (!db) return;

    const productDoc = doc(db, 'users', userId, 'products', product.id);
    const cleanedProduct = cleanProductForFirestore(product);
    await setDoc(productDoc, cleanedProduct, { merge: true });
    console.log('Product synced to Firestore:', product.id);
  } catch (error) {
    console.error('Error syncing product to Firestore:', error);
  }
}

async function syncProductsToFirestoreBatch(products: Product[], userId: string): Promise<void> {
  try {
    if (!userId) return;

    await initializeFirebase();
    const db = getDb();
    if (!db) return;

    console.log('Batch syncing', products.length, 'products to Firestore for user', userId);
    
    const BATCH_SIZE = 500;
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const batchProducts = products.slice(i, i + BATCH_SIZE);
      
      for (const product of batchProducts) {
        const productDoc = doc(db, 'users', userId, 'products', product.id);
        const cleanedProduct = cleanProductForFirestore(product);
        batch.set(productDoc, cleanedProduct, { merge: true });
      }
      
      await batch.commit();
      console.log(`Synced batch ${Math.floor(i / BATCH_SIZE) + 1}`);
    }
    
    console.log('All products synced to Firestore for user', userId);
  } catch (error) {
    console.error('Error batch syncing to Firestore:', error);
  }
}

export const [InventoryProvider, useInventory] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'all'>('all');
  const [destinationFilter, setDestinationFilter] = useState<Destination | 'all'>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [effectiveOwnerId, setEffectiveOwnerId] = useState<string | null>(null);

  useEffect(() => {
    const loadUserId = async () => {
      try {
        const userId = await getCurrentUserId();
        
        if (userId) {
          const currentUser = await getCurrentUser();
          const effectiveId = getEffectiveOwnerIdForUser(currentUser);
          
          setCurrentUserId(userId);
          setEffectiveOwnerId(effectiveId);
        } else {
          setCurrentUserId(null);
          setEffectiveOwnerId(null);
        }
      } catch (error) {
        console.error('Error loading user ID:', error);
        setCurrentUserId(null);
        setEffectiveOwnerId(null);
      }
    };
    
    loadUserId();
    
    const intervalId = setInterval(() => {
      loadUserId();
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  const productsQuery = useQuery({
    queryKey: ['products', currentUserId],
    queryFn: () => loadProducts(currentUserId),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    enabled: !!currentUserId,
  });

  const products = useMemo(() => productsQuery.data || [], [productsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (products: Product[]) => saveProducts(products, currentUserId),
    onSuccess: (data) => {
      queryClient.setQueryData(['products', currentUserId], data);
    },
  });

  const { mutate: saveProductsMutate } = saveMutation;

  const getEffectiveOwnerId = useCallback((): string => {
    return effectiveOwnerId || currentUserId || 'unknown';
  }, [effectiveOwnerId, currentUserId]);

  const addProduct = useCallback((input: ProductInput, username?: string) => {
    if (!currentUserId || !effectiveOwnerId) {
      console.error('Cannot add product: User not logged in');
      throw new Error('Cannot add product: User not logged in. Please log in and try again.');
    }
    
    const ownerId = getEffectiveOwnerId();
    
    const trimmedBarcode = input.barcode.trim();
    
    if (!trimmedBarcode) {
      console.error('Empty barcode');
      return false;
    }

    const existingProduct = products.find(p => p.barcode === trimmedBarcode && p.ownerId === ownerId);
    if (existingProduct) {
      console.error('Duplicate barcode:', trimmedBarcode);
      return false;
    }

    const timestamp = Date.now();
    const newProduct: Product = {
      ...input,
      ownerId,
      barcode: trimmedBarcode,
      id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
      dateAdded: new Date(timestamp).toISOString(),
      dateUpdated: new Date(timestamp).toISOString(),
      receivedBy: username,
    };
    
    const updatedProducts = [...products, newProduct];
    
    saveProductsMutate(updatedProducts, {
      onSuccess: () => {
        console.log('✓ Product added successfully:', trimmedBarcode);
        syncSingleProductToFirestore(newProduct, ownerId);
      },
      onError: (error) => {
        console.error('Failed to save product:', error);
      }
    });
    
    return true;
  }, [products, saveProductsMutate, getEffectiveOwnerId, currentUserId, effectiveOwnerId]);

  const updateProduct = useCallback((id: string, updates: Partial<ProductInput>) => {
    const ownerId = getEffectiveOwnerId();
    const updatedProducts = products.map(p =>
      p.id === id && p.ownerId === ownerId
        ? { ...p, ...updates, dateUpdated: new Date().toISOString() }
        : p
    );
    const updatedProduct = updatedProducts.find(p => p.id === id);
    saveProductsMutate(updatedProducts, {
      onSuccess: () => {
        if (updatedProduct) {
          syncSingleProductToFirestore(updatedProduct, ownerId);
        }
      }
    });
  }, [products, saveProductsMutate, getEffectiveOwnerId]);

  const releaseProduct = useCallback((id: string, username?: string) => {
    try {
      const ownerId = getEffectiveOwnerId();
      const product = products.find(p => p.id === id && p.ownerId === ownerId);
      
      if (!product) {
        console.error('Product not found:', id);
        throw new Error('Product not found');
      }
      
      if (product.uploadStatus !== 'validated') {
        console.error('Cannot release non-validated product:', id);
        throw new Error('Product must be validated before release');
      }
      
      if (product.status !== 'received') {
        console.error('Cannot release product with status:', product.status);
        throw new Error('Only received products can be released. Current status: ' + product.status);
      }
      
      const updatedProducts = products.map(p =>
        p.id === id && p.ownerId === ownerId
          ? {
              ...p,
              status: 'released' as const,
              dateReleased: new Date().toISOString(),
              dateUpdated: new Date().toISOString(),
              releasedBy: username,
            }
          : p
      );
      const updatedProduct = updatedProducts.find(p => p.id === id);
      saveProductsMutate(updatedProducts, {
        onSuccess: () => {
          if (updatedProduct) {
            syncSingleProductToFirestore(updatedProduct, ownerId);
          }
        },
        onError: (error) => {
          console.error('Failed to release product:', error);
        }
      });
    } catch (error) {
      console.error('Critical error in releaseProduct:', error);
      throw error;
    }
  }, [products, saveProductsMutate, getEffectiveOwnerId]);

  const transferProduct = useCallback((id: string, username?: string) => {
    const ownerId = getEffectiveOwnerId();
    const product = products.find(p => p.id === id && p.ownerId === ownerId);
    
    if (!product) {
      console.error('Product not found:', id);
      throw new Error('Product not found');
    }
    
    if (product.uploadStatus !== 'validated') {
      console.error('Cannot transfer non-validated product:', id);
      throw new Error('Product must be validated before transfer');
    }
    
    if (product.status !== 'received') {
      console.error('Cannot transfer product with status:', product.status);
      throw new Error('Only received products can be transferred. Current status: ' + product.status);
    }
    
    if (product.destination !== 'Nevis') {
      console.error('Cannot transfer non-Nevis product:', product.destination);
      throw new Error('Only products destined for Nevis can be transferred');
    }
    
    const updatedProducts = products.map(p =>
      p.id === id && p.ownerId === ownerId
        ? {
            ...p,
            status: 'transferred' as const,
            dateTransferred: new Date().toISOString(),
            dateUpdated: new Date().toISOString(),
            transferredBy: username,
          }
        : p
    );
    const updatedProduct = updatedProducts.find(p => p.id === id);
    saveProductsMutate(updatedProducts, {
      onSuccess: () => {
        if (updatedProduct) {
          syncSingleProductToFirestore(updatedProduct, ownerId);
        }
      }
    });
  }, [products, saveProductsMutate, getEffectiveOwnerId]);

  const revertProductFromNevis = useCallback((id: string, username?: string) => {
    const ownerId = getEffectiveOwnerId();
    const updatedProducts = products.map(p =>
      p.id === id && p.ownerId === ownerId
        ? {
            ...p,
            status: 'awaiting_from_nevis' as const,
            dateUpdated: new Date().toISOString(),
            dateTransferred: undefined,
            transferredBy: undefined,
          }
        : p
    );
    const updatedProduct = updatedProducts.find(p => p.id === id);
    saveProductsMutate(updatedProducts, {
      onSuccess: () => {
        if (updatedProduct) {
          syncSingleProductToFirestore(updatedProduct, ownerId);
        }
      }
    });
  }, [products, saveProductsMutate, getEffectiveOwnerId]);

  const deleteProduct = useCallback(async (id: string) => {
    const ownerId = getEffectiveOwnerId();
    const updatedProducts = products.filter(p => p.id !== id || p.ownerId !== ownerId);
    
    saveProductsMutate(updatedProducts, {
      onSuccess: async () => {
        try {
          if (!ownerId) return;
          
          await initializeFirebase();
          const db = getDb();
          if (db) {
            const productDoc = doc(db, 'users', ownerId, 'products', id);
            await deleteDoc(productDoc);
            console.log('Product deleted from Firestore:', id);
          }
        } catch (error) {
          console.error('Error deleting product from Firestore:', error);
        }
      }
    });
  }, [products, saveProductsMutate, getEffectiveOwnerId]);

  const resetAllData = useCallback(async () => {
    const ownerId = getEffectiveOwnerId();
    console.log('Resetting inventory for user', ownerId);
    saveProductsMutate([], {
      onSuccess: async () => {
        try {
          if (!ownerId) return;
          
          await initializeFirebase();
          const db = getDb();
          if (db) {
            const productsCol = collection(db, 'users', ownerId, 'products');
            const snapshot = await getDocs(productsCol);
            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            console.log('All products deleted from Firestore for user', ownerId);
          }
        } catch (error) {
          console.error('Error deleting all products from Firestore:', error);
        }
      }
    });
  }, [saveProductsMutate, getEffectiveOwnerId]);

  const updateDestinationsByBarcode = useCallback((updates: { barcode: string; destination: Destination }[]) => {
    const ownerId = getEffectiveOwnerId();
    const barcodeMap = new Map(updates.map(u => [u.barcode, u.destination]));
    const updatedProducts = products.map(p =>
      barcodeMap.has(p.barcode) && p.ownerId === ownerId
        ? { ...p, destination: barcodeMap.get(p.barcode)!, dateUpdated: new Date().toISOString() }
        : p
    );
    const productsToSync = updatedProducts.filter(p => barcodeMap.has(p.barcode) && p.ownerId === ownerId);
    saveProductsMutate(updatedProducts, {
      onSuccess: () => {
        if (productsToSync.length > 0) {
          syncProductsToFirestoreBatch(productsToSync, ownerId);
        }
      }
    });
  }, [products, saveProductsMutate, getEffectiveOwnerId]);

  const getProductByBarcode = useCallback((barcode: string) => {
    const ownerId = getEffectiveOwnerId();
    const trimmedBarcode = barcode.trim();
    
    if (!trimmedBarcode) {
      return undefined;
    }
    
    return products.find(p => p.barcode === trimmedBarcode && p.ownerId === ownerId);
  }, [products, getEffectiveOwnerId]);

  const bulkImportProducts = useCallback((newProducts: ProductInput[], username?: string) => {
    if (!currentUserId || !effectiveOwnerId) {
      console.error('Cannot bulk import: User not logged in');
      throw new Error('Cannot import products: User not logged in. Please log in and try again.');
    }
    
    const ownerId = getEffectiveOwnerId();
    const timestamp = Date.now();
    const productsToAdd: Product[] = [];
    const existingBarcodes = new Set(products.filter(p => p.ownerId === ownerId).map(p => p.barcode));
    const duplicates: string[] = [];
    const invalid: string[] = [];
    
    for (const input of newProducts) {
      const trimmedBarcode = input.barcode.trim();
      
      if (!trimmedBarcode) {
        invalid.push('empty');
        continue;
      }
      
      if (existingBarcodes.has(trimmedBarcode)) {
        duplicates.push(trimmedBarcode);
        continue;
      }
      
      const newProduct: Product = {
        ...input,
        ownerId,
        barcode: trimmedBarcode,
        id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
        dateAdded: new Date(timestamp).toISOString(),
        dateUpdated: new Date(timestamp).toISOString(),
        uploadStatus: 'uploaded',
        receivedBy: username,
      };
      
      productsToAdd.push(newProduct);
      existingBarcodes.add(trimmedBarcode);
    }
    
    if (productsToAdd.length === 0) {
      console.log('No new products to import. Duplicates:', duplicates.length, 'Invalid:', invalid.length);
      return { 
        added: 0, 
        skipped: newProducts.length,
        duplicates: duplicates.length,
        invalid: invalid.length,
        isDuplicateUpload: duplicates.length > 0 && duplicates.length === newProducts.length
      };
    }
    
    const updatedProducts = [...products, ...productsToAdd];
    console.log('Importing', productsToAdd.length, 'packages for user', ownerId);
    
    saveProductsMutate(updatedProducts, {
      onSuccess: () => {
        syncProductsToFirestoreBatch(productsToAdd, ownerId);
      },
      onError: (error) => {
        console.error('Failed to bulk import products:', error);
      }
    });
    
    return { 
      added: productsToAdd.length, 
      skipped: newProducts.length - productsToAdd.length,
      duplicates: duplicates.length,
      invalid: invalid.length,
      isDuplicateUpload: false
    };
  }, [products, saveProductsMutate, getEffectiveOwnerId, currentUserId, effectiveOwnerId]);

  const markAsValidated = useCallback((barcode: string, storageLocation?: string, destination?: Destination, notes?: string) => {
    const ownerId = getEffectiveOwnerId();
    const trimmedBarcode = barcode.trim();
    const updatedProducts = products.map(p =>
      p.barcode === trimmedBarcode && p.uploadStatus === 'uploaded' && p.ownerId === ownerId
        ? { 
            ...p, 
            uploadStatus: 'validated' as const, 
            storageLocation: storageLocation || p.storageLocation,
            destination: destination || p.destination,
            notes: notes !== undefined ? notes : p.notes,
            dateUpdated: new Date().toISOString() 
          }
        : p
    );
    const updatedProduct = updatedProducts.find(p => p.barcode === trimmedBarcode && p.ownerId === ownerId);
    if (updatedProduct && updatedProduct.uploadStatus === 'validated') {
      saveProductsMutate(updatedProducts, {
        onSuccess: () => {
          syncSingleProductToFirestore(updatedProduct, ownerId);
        }
      });
      return true;
    }
    return false;
  }, [products, saveProductsMutate, getEffectiveOwnerId]);

  const verifyProductFromNevis = useCallback((barcode: string, username?: string) => {
    const ownerId = getEffectiveOwnerId();
    const trimmedBarcode = barcode.trim();
    const product = products.find(p => p.barcode === trimmedBarcode && p.ownerId === ownerId);
    
    if (!product) {
      return { success: false, error: 'not_found' };
    }
    
    if (product.status !== 'awaiting_from_nevis') {
      return { success: false, error: 'invalid_status', currentStatus: product.status };
    }
    
    const updatedProducts = products.map(p =>
      p.barcode === trimmedBarcode && p.ownerId === ownerId
        ? {
            ...p,
            status: 'received' as const,
            dateUpdated: new Date().toISOString(),
            receivedBy: username,
          }
        : p
    );
    const updatedProduct = updatedProducts.find(p => p.barcode === trimmedBarcode && p.ownerId === ownerId);
    saveProductsMutate(updatedProducts, {
      onSuccess: () => {
        if (updatedProduct) {
          syncSingleProductToFirestore(updatedProduct, ownerId);
        }
      }
    });
    return { success: true, product: updatedProduct };
  }, [products, saveProductsMutate, getEffectiveOwnerId]);

  const filteredProducts = useMemo(() => {
    if (searchQuery === '' && statusFilter === 'all' && destinationFilter === 'all') {
      return products;
    }
    return products.filter(p => {
      const matchesSearch = searchQuery === '' ||
        p.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.storageLocation && p.storageLocation.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesDestination = destinationFilter === 'all' || p.destination === destinationFilter;
      return matchesSearch && matchesStatus && matchesDestination;
    });
  }, [products, searchQuery, statusFilter, destinationFilter]);

  const stats = useMemo(() => {
    return {
      total: products.length,
      received: products.filter(p => p.status === 'received').length,
      released: products.filter(p => p.status === 'released').length,
      transferred: products.filter(p => p.status === 'transferred').length,
      saintKitts: products.filter(p => p.destination === 'Saint Kitts').length,
      nevis: products.filter(p => p.destination === 'Nevis').length,
    };
  }, [products]);

  return useMemo(() => ({
    products,
    filteredProducts,
    stats,
    isLoading: productsQuery.isLoading,
    isSaving: saveMutation.isPending,
    addProduct,
    updateProduct,
    deleteProduct,
    releaseProduct,
    transferProduct,
    revertProductFromNevis,
    verifyProductFromNevis,
    updateDestinationsByBarcode,
    getProductByBarcode,
    bulkImportProducts,
    markAsValidated,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    destinationFilter,
    setDestinationFilter,
    resetAllData,
  }), [
    products,
    filteredProducts,
    stats,
    productsQuery.isLoading,
    saveMutation.isPending,
    addProduct,
    updateProduct,
    deleteProduct,
    releaseProduct,
    transferProduct,
    revertProductFromNevis,
    verifyProductFromNevis,
    updateDestinationsByBarcode,
    getProductByBarcode,
    bulkImportProducts,
    markAsValidated,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    destinationFilter,
    setDestinationFilter,
    resetAllData,
  ]);
});
