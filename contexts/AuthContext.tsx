import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { getDb, initializeFirebase } from '@/config/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

const STORAGE_KEY = '@inventory_users';
const SESSION_KEY = '@inventory_session';
const CURRENT_USER_KEY = '@current_user_id';
const WAREHOUSE_SETTINGS_KEY = '@warehouse_settings';

export type UserRole = 'manager' | 'sub-user';

export interface PortalPrivileges {
  receiving: boolean;
  releasing: boolean;
  nevisReceiving: boolean;
  nevisReleasing: boolean;
  scanner: boolean;
  addProduct: boolean;
  uploadExcel: boolean;
  exportExcel: boolean;
  resetData: boolean;
}

export interface User {
  id: string;
  username: string;
  password: string;
  securityQuestion: string;
  securityAnswer: string;
  securityQuestion1?: string;
  securityAnswer1?: string;
  securityQuestion2?: string;
  securityAnswer2?: string;
  createdAt: string;
  role: UserRole;
  managerId?: string;
  privileges?: PortalPrivileges;
  uniqueKey?: string;
  isActive?: boolean;
}

export interface WarehouseSettings {
  stkReceivingName: string;
  stkReleasingName: string;
  nevisReceivingName: string;
  nevisReleasingName: string;
  storageLocations: string[];
}

interface Session {
  userId: string;
  username: string;
  loginTime: string;
}

async function loadUsers(): Promise<User[]> {
  try {
    let stored = await AsyncStorage.getItem(STORAGE_KEY);
    
    if (!stored || stored.trim() === '') {
      console.log('No stored users found');
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    
    stored = stored.trim();
    
    if (stored.length < 2) {
      console.warn('Invalid stored users data (too short), resetting');
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    
    if (/^(\[?object|undefined|null|NaN)/i.test(stored)) {
      console.error('Storage contains non-JSON string:', stored.substring(0, 50), '... resetting');
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    
    const firstChar = stored[0];
    if (firstChar !== '[' && firstChar !== '{') {
      console.error('Invalid JSON format in users storage, expected [ or { but got:', firstChar);
      console.error('First 100 chars of corrupted data:', stored.substring(0, 100));
      console.error('Fixing corrupted user storage...');
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    
    try {
      const users = JSON.parse(stored);
      
      if (!Array.isArray(users)) {
        console.warn('Cached users is not an array, resetting');
        await AsyncStorage.removeItem(STORAGE_KEY);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        return [];
      }
      
      console.log(`✓ Loaded ${users.length} users`);
      return users;
    } catch (parseError) {
      console.error('❌ JSON Parse error in users:', parseError);
      console.error('Error message:', parseError instanceof Error ? parseError.message : String(parseError));
      console.error('First 200 chars of corrupted data:', stored.substring(0, 200));
      console.error('Last 200 chars of corrupted data:', stored.substring(Math.max(0, stored.length - 200)));
      console.error('Fixing storage due to JSON parse error...');
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
  } catch (error) {
    console.error('❌ Critical error loading users:', error);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    } catch (clearError) {
      console.error('Failed to clear storage:', clearError);
    }
    return [];
  }
}

async function saveUsers(users: User[]): Promise<User[]> {
  try {
    if (!Array.isArray(users)) {
      console.error('Invalid users data, expected array');
      throw new Error('Invalid users data format');
    }
    
    const serialized = JSON.stringify(users);
    
    if (typeof serialized !== 'string' || serialized.length < 2) {
      console.error('Serialization produced invalid string:', serialized);
      throw new Error('Failed to serialize users');
    }
    
    if (serialized.startsWith('[object') || serialized.startsWith('object')) {
      console.error('Serialization produced object string instead of JSON:', serialized.substring(0, 100));
      throw new Error('Invalid serialization result');
    }
    
    await AsyncStorage.setItem(STORAGE_KEY, serialized);
    return users;
  } catch (error) {
    console.error('Error saving users:', error);
    throw error;
  }
}

function cleanUserForFirestore(user: User): Record<string, any> {
  const cleaned: Record<string, any> = {};
  Object.keys(user).forEach(key => {
    const value = (user as any)[key];
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value;
    }
  });
  return cleaned;
}

async function syncUserToFirestore(user: User): Promise<void> {
  try {
    await initializeFirebase();
    const db = getDb();
    if (!db) return;
    const userDoc = doc(db, 'users', user.id);
    const cleanedUser = cleanUserForFirestore(user);
    await setDoc(userDoc, cleanedUser, { merge: true });
    console.log('User synced to Firestore:', user.id);
  } catch (error) {
    console.error('Error syncing user to Firestore:', error);
  }
}

async function loadWarehouseSettings(userId: string | null): Promise<WarehouseSettings> {
  try {
    if (!userId) {
      return {
        stkReceivingName: 'St. Kitts Receiving',
        stkReleasingName: 'St. Kitts Releasing',
        nevisReceivingName: 'Nevis Receiving',
        nevisReleasingName: 'Nevis Releasing',
        storageLocations: ['A', 'B', 'C', 'D', 'E', 'F'],
      };
    }

    const storageKey = `${WAREHOUSE_SETTINGS_KEY}_${userId}`;
    let stored = await AsyncStorage.getItem(storageKey);
    
    if (!stored || stored.trim() === '') {
      return {
        stkReceivingName: 'St. Kitts Receiving',
        stkReleasingName: 'St. Kitts Releasing',
        nevisReceivingName: 'Nevis Receiving',
        nevisReleasingName: 'Nevis Releasing',
        storageLocations: ['A', 'B', 'C', 'D', 'E', 'F'],
      };
    }
    
    stored = stored.trim();
    
    if (/^(\[?object|undefined|null|NaN)/i.test(stored)) {
      console.error('Warehouse settings contains non-JSON:', stored.substring(0, 50));
      await AsyncStorage.removeItem(storageKey);
      return {
        stkReceivingName: 'St. Kitts Receiving',
        stkReleasingName: 'St. Kitts Releasing',
        nevisReceivingName: 'Nevis Receiving',
        nevisReleasingName: 'Nevis Releasing',
        storageLocations: ['A', 'B', 'C', 'D', 'E', 'F'],
      };
    }
    
    const firstChar = stored[0];
    if (firstChar !== '{' && firstChar !== '[') {
      console.error('Invalid JSON format in warehouse settings, expected { or [ but got:', firstChar);
      console.error('First 100 chars of corrupted data:', stored.substring(0, 100));
      await AsyncStorage.removeItem(storageKey);
      return {
        stkReceivingName: 'St. Kitts Receiving',
        stkReleasingName: 'St. Kitts Releasing',
        nevisReceivingName: 'Nevis Receiving',
        nevisReleasingName: 'Nevis Releasing',
        storageLocations: ['A', 'B', 'C', 'D', 'E', 'F'],
      };
    }
    
    try {
      return JSON.parse(stored);
    } catch (parseError) {
      console.error('❌ JSON Parse error in warehouse settings:', parseError);
      console.error('Error message:', parseError instanceof Error ? parseError.message : String(parseError));
      console.error('First 100 chars of corrupted data:', stored.substring(0, 100));
      await AsyncStorage.removeItem(storageKey);
      return {
        stkReceivingName: 'St. Kitts Receiving',
        stkReleasingName: 'St. Kitts Releasing',
        nevisReceivingName: 'Nevis Receiving',
        nevisReleasingName: 'Nevis Releasing',
        storageLocations: ['A', 'B', 'C', 'D', 'E', 'F'],
      };
    }
  } catch (error) {
    console.error('Error loading warehouse settings:', error);
    return {
      stkReceivingName: 'St. Kitts Receiving',
      stkReleasingName: 'St. Kitts Releasing',
      nevisReceivingName: 'Nevis Receiving',
      nevisReleasingName: 'Nevis Releasing',
      storageLocations: ['A', 'B', 'C', 'D', 'E', 'F'],
    };
  }
}

async function saveWarehouseSettings(settings: WarehouseSettings, userId: string | null): Promise<WarehouseSettings> {
  try {
    if (!userId) throw new Error('No user ID');
    
    const storageKey = `${WAREHOUSE_SETTINGS_KEY}_${userId}`;
    await AsyncStorage.setItem(storageKey, JSON.stringify(settings));
    return settings;
  } catch (error) {
    console.error('Error saving warehouse settings:', error);
    throw error;
  }
}

async function loadSession(): Promise<Session | null> {
  try {
    let stored = await AsyncStorage.getItem(SESSION_KEY);
    
    if (!stored || stored.trim() === '') {
      return null;
    }
    
    stored = stored.trim();
    
    if (stored.length < 2) {
      console.warn('Invalid stored session data (too short), clearing');
      await AsyncStorage.removeItem(SESSION_KEY);
      return null;
    }
    
    if (/^(\[?object|undefined|null|NaN)/i.test(stored)) {
      console.error('Session storage contains non-JSON:', stored.substring(0, 50));
      await AsyncStorage.removeItem(SESSION_KEY);
      return null;
    }
    
    const firstChar = stored[0];
    if (firstChar !== '{') {
      console.error('Invalid JSON format in session storage, expected { but got:', firstChar);
      console.error('First 100 chars of corrupted data:', stored.substring(0, 100));
      console.error('Fixing corrupted session storage...');
      await AsyncStorage.removeItem(SESSION_KEY);
      return null;
    }
    
    try {
      const session = JSON.parse(stored);
      console.log('✓ Session loaded for user:', session?.username);
      return session;
    } catch (parseError) {
      console.error('❌ JSON Parse error in session:', parseError);
      console.error('Error message:', parseError instanceof Error ? parseError.message : String(parseError));
      console.error('First 200 chars of corrupted data:', stored.substring(0, 200));
      console.error('Last 200 chars of corrupted data:', stored.substring(Math.max(0, stored.length - 200)));
      console.error('Fixing storage due to JSON parse error...');
      await AsyncStorage.removeItem(SESSION_KEY);
      return null;
    }
  } catch (error) {
    console.error('❌ Critical error loading session:', error);
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
    } catch (clearError) {
      console.error('Failed to clear storage:', clearError);
    }
    return null;
  }
}

async function saveSession(session: Session | null): Promise<Session | null> {
  try {
    if (session) {
      const serialized = JSON.stringify(session);
      
      if (typeof serialized !== 'string' || serialized.length < 2) {
        console.error('Serialization produced invalid string:', serialized);
        throw new Error('Failed to serialize session');
      }
      
      if (serialized.startsWith('[object') || serialized.startsWith('object')) {
        console.error('Serialization produced object string instead of JSON:', serialized.substring(0, 100));
        throw new Error('Invalid serialization result');
      }
      
      await AsyncStorage.setItem(SESSION_KEY, serialized);
      await AsyncStorage.setItem(CURRENT_USER_KEY, session.userId);
    } else {
      await AsyncStorage.removeItem(SESSION_KEY);
      await AsyncStorage.removeItem(CURRENT_USER_KEY);
    }
    return session;
  } catch (error) {
    console.error('Error saving session:', error);
    throw error;
  }
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: loadUsers,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: loadSession,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    retry: 3,
    retryDelay: 1000,
  });

  const users = useMemo(() => usersQuery.data || [], [usersQuery.data]);
  const session = useMemo(() => sessionQuery.data || null, [sessionQuery.data]);

  const saveSessionMutation = useMutation({
    mutationFn: saveSession,
    onSuccess: (data) => {
      queryClient.setQueryData(['session'], data);
    },
  });

  const { mutate: mutateSession } = saveSessionMutation;

  const registerMutation = useMutation({
    mutationFn: async (data: { 
      username: string; 
      password: string; 
      securityQuestion: string; 
      securityAnswer: string;
      securityQuestion1?: string;
      securityAnswer1?: string;
      securityQuestion2?: string;
      securityAnswer2?: string;
    }) => {
      if (!data.username.trim() || !data.password.trim()) {
        throw new Error('Username and password are required');
      }
      
      if (data.securityQuestion1 && data.securityQuestion2) {
        if (!data.securityAnswer1?.trim() || !data.securityAnswer2?.trim()) {
          throw new Error('Security question answers are required');
        }
      } else if (!data.securityQuestion || !data.securityAnswer.trim()) {
        throw new Error('Security question and answer are required');
      }

      if (users.find((u) => u.username.toLowerCase() === data.username.toLowerCase())) {
        throw new Error('Username already exists');
      }

      const formattedUsername = data.username.trim().charAt(0).toUpperCase() + data.username.trim().slice(1);

      const newUser: User = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        username: formattedUsername,
        password: data.password,
        securityQuestion: data.securityQuestion1 || data.securityQuestion,
        securityAnswer: (data.securityAnswer1 || data.securityAnswer).toLowerCase().trim(),
        securityQuestion1: data.securityQuestion1,
        securityAnswer1: data.securityAnswer1?.toLowerCase().trim(),
        securityQuestion2: data.securityQuestion2,
        securityAnswer2: data.securityAnswer2?.toLowerCase().trim(),
        createdAt: new Date().toISOString(),
        role: 'manager',
        isActive: true,
      };

      const updatedUsers = [...users, newUser];
      await saveUsers(updatedUsers);
      syncUserToFirestore(newUser);
      return updatedUsers;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['users'], data);
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; uniqueKey?: string; isEmployeeLogin?: boolean }) => {
      const user = users.find(
        (u) =>
          u.username.toLowerCase() === data.username.toLowerCase() &&
          u.password === data.password
      );

      if (!user) {
        throw new Error('Invalid username or password');
      }

      if (user.isActive === false) {
        throw new Error('Your account has been deactivated. Please contact your administrator.');
      }

      if (data.isEmployeeLogin) {
        if (user.role !== 'sub-user') {
          throw new Error('Admin users cannot login through the employee portal');
        }
        if (!data.uniqueKey) {
          throw new Error('Unique key is required for employee login');
        }
        if (user.uniqueKey !== data.uniqueKey) {
          throw new Error('Invalid unique key for this employee account');
        }
      } else {
        if (user.role === 'sub-user') {
          throw new Error('Employee accounts must login through the employee portal with a unique key');
        }
      }

      const newSession: Session = {
        userId: user.id,
        username: user.username,
        loginTime: new Date().toISOString(),
      };

      await saveSession(newSession);
      return newSession;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['session'], data);
    },
  });

  const logout = useCallback(async () => {
    console.log('Logging out user...');
    try {
      await saveSession(null);
      queryClient.setQueryData(['session'], null);
      await queryClient.clear();
      console.log('✓ Logout successful');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }, [queryClient]);

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const updatedUsers = users.filter((u) => u.id !== userId);
      
      try {
        await initializeFirebase();
        const db = getDb();
        if (db) {
          const userDoc = doc(db, 'users', userId);
          await deleteDoc(userDoc);
          console.log('User deleted from Firestore');
        }
      } catch (error) {
        console.error('Error deleting user from Firestore:', error);
      }
      
      await saveUsers(updatedUsers);
      return updatedUsers;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['users'], data);
      mutateSession(null);
    },
  });
  
  const changeOwnPasswordMutation = useMutation({
    mutationFn: async (data: { userId: string; currentPassword: string; newPassword: string }) => {
      const user = users.find((u) => u.id === data.userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.password !== data.currentPassword) {
        throw new Error('Current password is incorrect');
      }
      
      if (data.newPassword.length < 4) {
        throw new Error('New password must be at least 4 characters');
      }
      
      const updatedUser = { ...user, password: data.newPassword };
      const updatedUsers = users.map((u) => (u.id === data.userId ? updatedUser : u));
      await saveUsers(updatedUsers);
      syncUserToFirestore(updatedUser);
      return updatedUsers;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['users'], data);
    },
  });

  const resetEmployeePasswordMutation = useMutation({
    mutationFn: async (data: { userId: string; newPassword: string }) => {
      const user = users.find((u) => u.id === data.userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.role !== 'sub-user') {
        throw new Error('Can only reset password for employees');
      }
      
      const updatedUser = { ...user, password: data.newPassword };
      const updatedUsers = users.map((u) => (u.id === data.userId ? updatedUser : u));
      await saveUsers(updatedUsers);
      syncUserToFirestore(updatedUser);
      return updatedUsers;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['users'], data);
    },
  });

  const isAuthenticated = useMemo(() => !!session, [session]);
  
  const isInitialLoading = useMemo(
    () => usersQuery.isLoading || sessionQuery.isLoading,
    [usersQuery.isLoading, sessionQuery.isLoading]
  );
  
  const getUserByUsername = useCallback(
    (username: string) => users.find((u) => u.username.toLowerCase() === username.toLowerCase()),
    [users]
  );

  const createSubUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; privileges: PortalPrivileges; managerId: string }) => {
      if (!data.username.trim() || !data.password.trim()) {
        throw new Error('Username and password are required');
      }

      if (users.find((u) => u.username.toLowerCase() === data.username.toLowerCase())) {
        throw new Error('Username already exists');
      }

      const formattedUsername = data.username.trim().charAt(0).toUpperCase() + data.username.trim().slice(1);

      const uniqueKey = Math.random().toString(36).substring(2, 8).toUpperCase();

      const newUser: User = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        username: formattedUsername,
        password: data.password,
        securityQuestion: '',
        securityAnswer: '',
        createdAt: new Date().toISOString(),
        role: 'sub-user',
        managerId: data.managerId,
        privileges: data.privileges,
        uniqueKey,
        isActive: true,
      };

      const updatedUsers = [...users, newUser];
      await saveUsers(updatedUsers);
      syncUserToFirestore(newUser);
      return updatedUsers;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['users'], data);
    },
  });

  const updateSubUserPrivilegesMutation = useMutation({
    mutationFn: async (data: { userId: string; privileges: PortalPrivileges }) => {
      const user = users.find((u) => u.id === data.userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.role !== 'sub-user') {
        throw new Error('Can only update privileges for sub-users');
      }
      
      const updatedUser = { ...user, privileges: data.privileges };
      const updatedUsers = users.map((u) => (u.id === data.userId ? updatedUser : u));
      await saveUsers(updatedUsers);
      syncUserToFirestore(updatedUser);
      return updatedUsers;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['users'], data);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const deleteSubUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const user = users.find((u) => u.id === userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.role !== 'sub-user') {
        throw new Error('Can only delete sub-users');
      }
      
      const updatedUsers = users.filter((u) => u.id !== userId);
      
      try {
        await initializeFirebase();
        const db = getDb();
        if (db) {
          const userDoc = doc(db, 'users', userId);
          await deleteDoc(userDoc);
          console.log('Sub-user deleted from Firestore');
        }
      } catch (error) {
        console.error('Error deleting sub-user from Firestore:', error);
      }
      
      await saveUsers(updatedUsers);
      return updatedUsers;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['users'], data);
    },
  });

  const currentUser = useMemo(
    () => users.find((u) => u.id === session?.userId),
    [users, session]
  );

  const subUsers = useMemo(
    () => currentUser?.role === 'manager' ? users.filter((u) => u.managerId === currentUser.id) : [],
    [users, currentUser]
  );

  const warehouseSettingsQuery = useQuery({
    queryKey: ['warehouseSettings', currentUser?.id],
    queryFn: () => loadWarehouseSettings(currentUser?.id || null),
    enabled: !!currentUser,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const warehouseSettings = useMemo(() => warehouseSettingsQuery.data || {
    stkReceivingName: 'St. Kitts Receiving',
    stkReleasingName: 'St. Kitts Releasing',
    nevisReceivingName: 'Nevis Receiving',
    nevisReleasingName: 'Nevis Releasing',
    storageLocations: ['A', 'B', 'C', 'D', 'E', 'F'],
  }, [warehouseSettingsQuery.data]);

  const updateWarehouseSettingsMutation = useMutation({
    mutationFn: (settings: WarehouseSettings) => saveWarehouseSettings(settings, currentUser?.id || null),
    onSuccess: (data) => {
      queryClient.setQueryData(['warehouseSettings', currentUser?.id], data);
    },
  });

  const toggleUserActiveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const user = users.find((u) => u.id === userId);
      if (!user) throw new Error('User not found');
      
      const updatedUser = { ...user, isActive: !user.isActive };
      const updatedUsers = users.map((u) => (u.id === userId ? updatedUser : u));
      await saveUsers(updatedUsers);
      syncUserToFirestore(updatedUser);
      return updatedUsers;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['users'], data);
    },
  });

  const resetAdminPasswordMutation = useMutation({
    mutationFn: async (data: { username: string; newPassword: string }) => {
      const user = users.find((u) => u.username.toLowerCase() === data.username.toLowerCase());
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.role !== 'manager') {
        throw new Error('Password reset is only available for admin accounts');
      }
      
      if (data.newPassword.length < 4) {
        throw new Error('New password must be at least 4 characters');
      }
      
      const updatedUser = { ...user, password: data.newPassword };
      const updatedUsers = users.map((u) => (u.id === user.id ? updatedUser : u));
      await saveUsers(updatedUsers);
      syncUserToFirestore(updatedUser);
      return updatedUsers;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['users'], data);
    },
  });

  const hasPrivilege = useCallback(
    (portal: keyof PortalPrivileges): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === 'manager') return true;
      if (currentUser.role === 'sub-user' && currentUser.privileges) {
        return currentUser.privileges[portal];
      }
      return false;
    },
    [currentUser]
  );

  return useMemo(
    () => ({
      users,
      session,
      currentUser,
      subUsers,
      isAuthenticated,
      isLoading: isInitialLoading,
      register: registerMutation.mutateAsync,
      login: loginMutation.mutateAsync,
      logout,
      deleteUser: deleteUserMutation.mutateAsync,
      isRegistering: registerMutation.isPending,
      isLoggingIn: loginMutation.isPending,
      changeOwnPassword: changeOwnPasswordMutation.mutateAsync,
      resetEmployeePassword: resetEmployeePasswordMutation.mutateAsync,
      getUserByUsername,
      createSubUser: createSubUserMutation.mutateAsync,
      updateSubUserPrivileges: updateSubUserPrivilegesMutation.mutateAsync,
      deleteSubUser: deleteSubUserMutation.mutateAsync,
      hasPrivilege,
      warehouseSettings,
      updateWarehouseSettings: updateWarehouseSettingsMutation.mutateAsync,
      toggleUserActive: toggleUserActiveMutation.mutateAsync,
      resetAdminPassword: resetAdminPasswordMutation.mutateAsync,
    }),
    [
      users,
      session,
      currentUser,
      subUsers,
      isAuthenticated,
      isInitialLoading,
      registerMutation.mutateAsync,
      loginMutation.mutateAsync,
      logout,
      deleteUserMutation.mutateAsync,
      registerMutation.isPending,
      loginMutation.isPending,
      changeOwnPasswordMutation.mutateAsync,
      resetEmployeePasswordMutation.mutateAsync,
      getUserByUsername,
      createSubUserMutation.mutateAsync,
      updateSubUserPrivilegesMutation.mutateAsync,
      deleteSubUserMutation.mutateAsync,
      hasPrivilege,
      warehouseSettings,
      updateWarehouseSettingsMutation.mutateAsync,
      toggleUserActiveMutation.mutateAsync,
      resetAdminPasswordMutation.mutateAsync,
    ]
  );
});
