# App Store Rejection Fixes

## Issues to Resolve

### ✅ Issue 1: Camera Permission Button Text (ALREADY FIXED)
**Status:** The app already uses "Continue" button text in scanner.tsx and nevis-scanner.tsx (lines 313 and 545).

### ⚠️ Issue 2: Background Audio Mode (REQUIRES app.json EDIT)
**Problem:** The app declares UIBackgroundModes "audio" but doesn't use background audio.

**Required Changes to app.json:**

1. **Remove UIBackgroundModes from iOS infoPlist:**
```json
"infoPlist": {
  "NSCameraUsageDescription": "We need access to your camera to scan product barcodes. For example, when you scan a package barcode in the warehouse, the camera will read the barcode and display the package information, allowing you to track inventory, receive shipments, and release packages to customers."
}
```

Remove these lines:
```json
"UIBackgroundModes": [
  "audio"
]
```

2. **Remove NSMicrophoneUsageDescription** (not needed as app doesn't use microphone):
```json
"NSMicrophoneUsageDescription": "Allow $(PRODUCT_NAME) to access your microphone",
```

### ⚠️ Issue 3: Camera Permission Description (REQUIRES app.json EDIT)
**Problem:** Current description is too generic and doesn't provide specific examples.

**Current (Line 20 in app.json):**
```
"NSCameraUsageDescription": "$(PRODUCT_NAME) uses your camera to scan product barcodes for warehouse inventory management. This allows you to quickly identify and track packages."
```

**Replace with:**
```
"NSCameraUsageDescription": "We need access to your camera to scan product barcodes. For example, when you scan a package barcode in the warehouse, the camera will read the barcode and display the package information, allowing you to track inventory, receive shipments, and release packages to customers."
```

### ⚠️ Issue 4: Remove Microphone Permissions (REQUIRES app.json EDIT)

**In expo-camera plugin (lines 56-62), change from:**
```json
[
  "expo-camera",
  {
    "cameraPermission": "$(PRODUCT_NAME) uses your camera to scan product barcodes for warehouse inventory management. This allows you to quickly identify and track packages.",
    "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone",
    "recordAudioAndroid": true
  }
]
```

**To:**
```json
[
  "expo-camera",
  {
    "cameraPermission": "We need access to your camera to scan product barcodes. For example, when you scan a package barcode in the warehouse, the camera will read the barcode and display the package information, allowing you to track inventory, receive shipments, and release packages to customers."
  }
]
```

**In expo-av plugin (lines 70-74), change from:**
```json
[
  "expo-av",
  {
    "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone"
  }
]
```

**To:**
```json
"expo-av"
```

**In Android permissions (lines 35-36), remove:**
```json
"RECORD_AUDIO",
```

## Complete Updated app.json

Here's the complete corrected iOS section:

```json
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "app.rork.mrk54opr365nuifvcfrsm-9xo1ldcc",
  "infoPlist": {
    "NSCameraUsageDescription": "We need access to your camera to scan product barcodes. For example, when you scan a package barcode in the warehouse, the camera will read the barcode and display the package information, allowing you to track inventory, receive shipments, and release packages to customers."
  },
  "usesIcloudStorage": true
}
```

Complete Android permissions:
```json
"permissions": [
  "CAMERA",
  "android.permission.VIBRATE",
  "READ_EXTERNAL_STORAGE",
  "WRITE_EXTERNAL_STORAGE",
  "INTERNET"
]
```

Complete plugins section:
```json
"plugins": [
  [
    "expo-router",
    {
      "origin": "https://rork.com/"
    }
  ],
  "expo-font",
  "expo-web-browser",
  [
    "expo-camera",
    {
      "cameraPermission": "We need access to your camera to scan product barcodes. For example, when you scan a package barcode in the warehouse, the camera will read the barcode and display the package information, allowing you to track inventory, receive shipments, and release packages to customers."
    }
  ],
  [
    "expo-document-picker",
    {
      "iCloudContainerEnvironment": "Production"
    }
  ],
  "expo-av"
]
```

## Summary of Changes

1. ✅ **Button text**: Already uses "Continue" (no changes needed)
2. ⚠️ **UIBackgroundModes**: Remove "audio" from infoPlist
3. ⚠️ **NSMicrophoneUsageDescription**: Remove completely
4. ⚠️ **NSCameraUsageDescription**: Update with specific example
5. ⚠️ **expo-camera plugin**: Remove microphone permission and recordAudioAndroid
6. ⚠️ **expo-av plugin**: Remove microphone permission config
7. ⚠️ **Android permissions**: Remove RECORD_AUDIO

## Next Steps

**You need to manually edit `app.json` with the changes above.**

The automated tools cannot modify app.json for security reasons. Please:
1. Open `app.json` in your editor
2. Apply all the changes marked with ⚠️ above
3. Save the file
4. Rebuild your app with EAS or Expo

After making these changes, all three App Store rejection issues will be resolved.
