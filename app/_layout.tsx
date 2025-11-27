import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { InventoryProvider } from "@/contexts/InventoryContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Image } from 'expo-image';
import { initializeFirebase } from '@/config/firebase';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAuthStateRef = React.useRef(isAuthenticated);
  const isNavigatingRef = React.useRef(false);
  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    if (!isLoading && !isReady) {
      console.log('✓ Auth state loaded, app ready');
      setIsReady(true);
    }
  }, [isLoading, isReady]);

  useEffect(() => {
    if (isLoading || !isReady) {
      return;
    }

    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
      navigationTimeoutRef.current = null;
    }

    const inAuthGroup = segments[0] === 'login';
    const authStateChanged = lastAuthStateRef.current !== isAuthenticated;
    lastAuthStateRef.current = isAuthenticated;

    if (!isAuthenticated && !inAuthGroup) {
      console.log('🚪 User not authenticated, redirecting to login');
      if (!isNavigatingRef.current) {
        isNavigatingRef.current = true;
        navigationTimeoutRef.current = setTimeout(() => {
          router.replace('/login');
          isNavigatingRef.current = false;
        }, 100);
      }
    } else if (isAuthenticated && inAuthGroup && authStateChanged) {
      console.log('✅ User authenticated, redirecting to portal selection');
      if (!isNavigatingRef.current) {
        isNavigatingRef.current = true;
        navigationTimeoutRef.current = setTimeout(() => {
          router.replace('/portal-selection');
          isNavigatingRef.current = false;
        }, 100);
      }
    } else {
      isNavigatingRef.current = false;
    }

    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
    };
  }, [isAuthenticated, isLoading, isReady, segments, router]);

  if (isLoading || !isReady) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source='https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/3b45n4ikwocbfy3m0gori'
          style={styles.splashLogo}
          contentFit="contain"
        />
        <ActivityIndicator 
          size="large" 
          color="#2563EB" 
          style={styles.splashLoader}
        />
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <ProtectedRoute>
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="portal-selection" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="scanner" options={{ headerShown: false }} />
        <Stack.Screen name="add-product" options={{ headerShown: false }} />
        <Stack.Screen name="product/[id]" options={{ headerShown: false }} />
      </Stack>
    </ProtectedRoute>
  );
}

export default function RootLayout() {
  const [appReady, setAppReady] = React.useState(false);

  useEffect(() => {
    let mounted = true;
    
    const prepare = async () => {
      try {
        console.log('Initializing app...');
        
        console.log('Initializing Firebase...');
        await initializeFirebase();
        console.log('✓ Firebase initialized');
        
        await SplashScreen.hideAsync();
      } catch (error) {
        console.error('❌ Error during initialization:', error);
      } finally {
        if (mounted) {
          setAppReady(true);
        }
      }
    };
    
    const timer = setTimeout(() => {
      if (mounted && !appReady) {
        console.warn('Initialization timeout, forcing app to load');
        setAppReady(true);
        SplashScreen.hideAsync().catch(e => console.error('Failed to hide splash:', e));
      }
    }, 1000);
    
    prepare();
    
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [appReady]);

  if (!appReady) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source='https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/3b45n4ikwocbfy3m0gori'
          style={styles.splashLogo}
          contentFit="contain"
        />
        <ActivityIndicator 
          size="large" 
          color="#2563EB" 
          style={styles.splashLoader}
        />
      </View>
    );
  }

  const AppContent = () => (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <InventoryProvider>
            <RootLayoutNav />
          </InventoryProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );

  if (Platform.OS === 'web') {
    return <AppContent />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppContent />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    ...Platform.select({
      web: {
        minHeight: '100vh',
      },
    }),
  },
  splashLogo: {
    width: 220,
    height: 100,
    marginBottom: 40,
  },
  splashLoader: {
    marginTop: 20,
  },
});
