# iOS Firebase Configuration

## Add this to your app.json

In the `ios` section of your `app.json`, add the `googleServicesFile` property:

```json
{
  "expo": {
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "app.rork.mrk54opr365nuifvcfrsm-9xo1ldcc",
      "googleServicesFile": "./GoogleService-Info.plist",
      "infoPlist": {
        "NSCameraUsageDescription": "Allow $(PRODUCT_NAME) to access your camera",
        "NSMicrophoneUsageDescription": "Allow $(PRODUCT_NAME) to access your microphone",
        "UIBackgroundModes": [
          "audio"
        ]
      },
      "usesIcloudStorage": true
    }
  }
}
```

## Steps to Configure

1. **Download GoogleService-Info.plist**
   - Go to Firebase Console
   - Project Settings > Your Apps > iOS
   - Download `GoogleService-Info.plist`

2. **Place the file**
   - Put `GoogleService-Info.plist` in your project root
   - Same folder as `app.json`, `package.json`, etc.

3. **Update app.json**
   - Add the line shown above to your `app.json`

4. **Register iOS app in Firebase**
   - Bundle ID: `app.rork.mrk54opr365nuifvcfrsm-9xo1ldcc`
   - Download the config file when prompted

That's it! Your iOS app will now work with Firebase.
