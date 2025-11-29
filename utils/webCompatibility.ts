import { Platform, Alert as RNAlert, AlertButton } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const isNative = Platform.OS !== 'web';
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

export const Alert = {
  alert: (title: string, message?: string, buttons?: AlertButton[], options?: { cancelable?: boolean }) => {
    if (isWeb) {
      if (!buttons || buttons.length === 0) {
        window.alert(`${title}${message ? '\n\n' + message : ''}`);
        return;
      }
      
      if (buttons.length === 1) {
        window.alert(`${title}${message ? '\n\n' + message : ''}`);
        if (buttons[0].onPress) {
          buttons[0].onPress();
        }
        return;
      }
      
      const confirmed = window.confirm(`${title}${message ? '\n\n' + message : ''}`);
      
      if (confirmed) {
        const confirmButton = buttons.find(b => b.style !== 'cancel') || buttons[buttons.length - 1];
        if (confirmButton.onPress) {
          confirmButton.onPress();
        }
      } else {
        const cancelButton = buttons.find(b => b.style === 'cancel') || buttons[0];
        if (cancelButton.onPress) {
          cancelButton.onPress();
        }
      }
    } else {
      RNAlert.alert(title, message, buttons, options);
    }
  }
};

export function webSafeAlert(title: string, message: string, onPress?: () => void) {
  Alert.alert(title, message, onPress ? [{ text: 'OK', onPress }] : undefined);
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
