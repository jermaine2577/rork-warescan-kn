import { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';

interface WebBarcodeScannerProps {
  onBarcodeScanned: (data: string) => void;
  isScanning: boolean;
  style?: any;
}

interface VideoConstraints extends MediaTrackConstraints {
  focusMode?: string;
}

export default function WebBarcodeScanner({
  onBarcodeScanned,
  isScanning,
  style,
}: WebBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const readerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastScannedRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const mountedRef = useRef<boolean>(true);
  const onBarcodeScannedRef = useRef(onBarcodeScanned);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);

  useEffect(() => {
    onBarcodeScannedRef.current = onBarcodeScanned;
  }, [onBarcodeScanned]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    mountedRef.current = true;
    let mounted = true;

    const initScanner = async () => {
      try {
        console.log('[WebBarcodeScanner] Initializing...');
        console.log('[WebBarcodeScanner] User agent:', navigator.userAgent);
        
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        console.log('[WebBarcodeScanner] Is mobile:', isMobile, 'Is iOS:', isIOS);

        const videoConstraints: VideoConstraints = isMobile ? {
          facingMode: { exact: 'environment' },
          width: { min: 640, ideal: 1920, max: 3840 },
          height: { min: 480, ideal: 1080, max: 2160 },
          ...(isIOS ? {} : {
            focusMode: 'continuous',
            frameRate: { ideal: 30, max: 60 },
          }),
        } : {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        };

        const constraints: MediaStreamConstraints = {
          video: videoConstraints,
          audio: false,
        };

        console.log('[WebBarcodeScanner] Requesting camera with constraints:', constraints);

        try {
          streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (firstErr) {
          console.warn('[WebBarcodeScanner] Failed with ideal constraints, trying fallback:', firstErr);
          streamRef.current = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
          });
        }
        
        if (!mounted || !streamRef.current) {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
          return;
        }

        const videoTrack = streamRef.current.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        console.log('[WebBarcodeScanner] Camera settings:', settings);
        
        const capabilities = videoTrack.getCapabilities();
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
          console.log('[WebBarcodeScanner] Device has torch support');
        }

        if (videoRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('autoplay', 'true');
          videoRef.current.setAttribute('muted', 'true');
          
          await new Promise<void>((resolve, reject) => {
            if (!videoRef.current) return reject(new Error('Video ref lost'));
            
            videoRef.current.onloadedmetadata = () => {
              if (videoRef.current) {
                videoRef.current.play()
                  .then(() => resolve())
                  .catch(reject);
              }
            };
            
            setTimeout(() => reject(new Error('Video load timeout')), 5000);
          });
          
          console.log('[WebBarcodeScanner] Video stream started');
          console.log('[WebBarcodeScanner] Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
        }

        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        readerRef.current = new BrowserMultiFormatReader();
        console.log('[WebBarcodeScanner] ZXing reader initialized');
        
        setIsInitialized(true);
        setError(null);
      } catch (err: any) {
        console.error('[WebBarcodeScanner] Initialization error:', err);
        console.error('[WebBarcodeScanner] Error name:', err?.name);
        console.error('[WebBarcodeScanner] Error message:', err?.message);
        if (mounted) {
          const errorMessage = err?.name === 'NotAllowedError' 
            ? 'Camera permission denied. Please allow camera access and reload.'
            : err?.name === 'NotFoundError'
            ? 'No camera found on your device.'
            : `Failed to access camera: ${err?.message || 'Unknown error'}`;
          setError(errorMessage);
        }
      }
    };

    initScanner();

    return () => {
      mounted = false;
      mountedRef.current = false;
      console.log('[WebBarcodeScanner] Cleaning up...');
      
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
        scanLoopRef.current = null;
      }
      
      if (readerRef.current) {
        try {
          readerRef.current.reset();
        } catch (e) {
          console.log('[WebBarcodeScanner] Error resetting reader:', e);
        }
        readerRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('[WebBarcodeScanner] Track stopped');
        });
        streamRef.current = null;
      }
      
      const video = videoRef.current;
      if (video && video.srcObject) {
        video.srcObject = null;
      }
    };
  }, []);

  const scanBarcode = useCallback(async () => {
    if (!mountedRef.current || !videoRef.current || !readerRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          try {
            const result = await readerRef.current.decodeFromCanvas(canvas);
            
            if (result && mountedRef.current) {
              const barcodeText = result.getText();
              const now = Date.now();
              
              if (
                barcodeText &&
                (barcodeText !== lastScannedRef.current || now - lastScannedTimeRef.current > 2000)
              ) {
                console.log('[WebBarcodeScanner] Barcode detected:', barcodeText);
                lastScannedRef.current = barcodeText;
                lastScannedTimeRef.current = now;
                onBarcodeScannedRef.current(barcodeText);
              }
            }
          } catch (err: any) {
            if (err?.name !== 'NotFoundException') {
              console.debug('[WebBarcodeScanner] Decode attempt:', err?.name);
            }
          }
        }
      } catch (err) {
        console.error('[WebBarcodeScanner] Scan error:', err);
      }
    }

    if (mountedRef.current) {
      scanLoopRef.current = requestAnimationFrame(scanBarcode);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized || !isScanning || !readerRef.current || !videoRef.current) {
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
        scanLoopRef.current = null;
      }
      return;
    }

    console.log('[WebBarcodeScanner] Starting continuous barcode scanning...');

    scanLoopRef.current = requestAnimationFrame(scanBarcode);

    return () => {
      console.log('[WebBarcodeScanner] Stopping barcode scanning');
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
        scanLoopRef.current = null;
      }
    };
  }, [isInitialized, isScanning, scanBarcode]);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !hasTorch) return;
    
    try {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      const newTorchState = !torchEnabled;
      await videoTrack.applyConstraints({
        advanced: [{ torch: newTorchState } as any],
      });
      setTorchEnabled(newTorchState);
      console.log('[WebBarcodeScanner] Torch toggled:', newTorchState);
    } catch (err) {
      console.error('[WebBarcodeScanner] Failed to toggle torch:', err);
    }
  }, [hasTorch, torchEnabled]);

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>Please check browser settings and reload the page.</Text>
        </View>
      ) : (
        <>
          <video
            ref={videoRef}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            playsInline
            autoPlay
            muted
          />
          <canvas
            ref={canvasRef}
            style={{
              display: 'none',
            }}
          />
        </>
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
    gap: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  errorHint: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
});
