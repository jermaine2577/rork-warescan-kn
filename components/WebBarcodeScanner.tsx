import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface WebBarcodeScannerProps {
  onBarcodeScanned: (data: string) => void;
  isScanning: boolean;
  style?: any;
}

export default function WebBarcodeScanner({
  onBarcodeScanned,
  isScanning,
  style,
}: WebBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastScannedRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    let mounted = true;
    let stream: MediaStream | null = null;

    const initScanner = async () => {
      try {
        console.log('[WebBarcodeScanner] Initializing...');
        
        const constraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          console.log('[WebBarcodeScanner] Video stream started');
        }

        readerRef.current = new BrowserMultiFormatReader();
        console.log('[WebBarcodeScanner] ZXing reader initialized');
        
        setIsInitialized(true);
        setError(null);
      } catch (err) {
        console.error('[WebBarcodeScanner] Initialization error:', err);
        if (mounted) {
          setError('Failed to access camera. Please check permissions.');
        }
      }
    };

    initScanner();

    return () => {
      mounted = false;
      console.log('[WebBarcodeScanner] Cleaning up...');
      
      const currentVideo = videoRef.current;
      
      if (readerRef.current) {
        readerRef.current = null;
      }
      
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('[WebBarcodeScanner] Track stopped');
        });
      }
      
      if (currentVideo && currentVideo.srcObject) {
        const videoStream = currentVideo.srcObject as MediaStream;
        videoStream.getTracks().forEach(track => track.stop());
        currentVideo.srcObject = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isInitialized || !isScanning || !readerRef.current || !videoRef.current) {
      return;
    }

    console.log('[WebBarcodeScanner] Starting barcode detection...');

    let isActive = true;
    let controlsRef: any = null;

    const detectBarcode = async () => {
      if (!videoRef.current || !readerRef.current || !isActive) return;

      try {
        controlsRef = await readerRef.current.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err) => {
            if (!isActive) return;
            
            if (result) {
              const barcodeText = result.getText();
              const now = Date.now();
              
              if (
                barcodeText &&
                (barcodeText !== lastScannedRef.current || now - lastScannedTimeRef.current > 2000)
              ) {
                console.log('[WebBarcodeScanner] Barcode detected:', barcodeText);
                lastScannedRef.current = barcodeText;
                lastScannedTimeRef.current = now;
                onBarcodeScanned(barcodeText);
              }
            }
            
            if (err && err.name !== 'NotFoundException') {
              console.error('[WebBarcodeScanner] Decode error:', err);
            }
          }
        );
      } catch (error) {
        console.error('[WebBarcodeScanner] Failed to start decoding:', error);
      }
    };

    detectBarcode();

    return () => {
      console.log('[WebBarcodeScanner] Stopping barcode detection');
      isActive = false;
      if (controlsRef && controlsRef.stop) {
        try {
          controlsRef.stop();
        } catch (e) {
          console.log('[WebBarcodeScanner] Error stopping controls:', e);
        }
      }
    };
  }, [isInitialized, isScanning, onBarcodeScanned]);

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          playsInline
          muted
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    padding: 20,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    textAlign: 'center',
  },
});
