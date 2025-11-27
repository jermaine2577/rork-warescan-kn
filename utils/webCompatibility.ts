import { Platform, Alert } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const isNative = Platform.OS !== 'web';
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

export function webSafeAlert(title: string, message: string, onPress?: () => void) {
  if (isWeb) {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed && onPress) {
      onPress();
    }
  } else {
    Alert.alert(title, message, onPress ? [{ text: 'OK', onPress }] : undefined);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  if (!isWeb) {
    console.error('downloadBlob is only available on web');
    return;
  }
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const featureSupport = {
  haptics: !isWeb,
  sharing: !isWeb,
  camera: true,
  audio: !isWeb,
  fileSystem: !isWeb,
  gestures: !isWeb,
  notifications: !isWeb,
};
