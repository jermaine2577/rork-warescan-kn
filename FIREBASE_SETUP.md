# Firebase Setup Guide

Your app is now configured to work with Firebase on both **Web** and **iOS**! This guide will help you complete the setup and understand how everything works.

## ✅ What's Already Done

1. **Firebase Configuration** (`config/firebase.ts`)
   - Firebase app initialization
   - Firestore database setup
   - Firebase Authentication setup
   - Platform-specific optimizations (web persistence)
   - iOS bundle ID configured

2. **App Integration**
   - Firebase initializes on app startup
   - Works with your existing AsyncStorage for local-first approach
   - Automatic sync to Firestore for all user and product data

3. **Cross-Platform Support**
   - ✅ Web: IndexedDB persistence for offline support
   - ✅ iOS: Native Firebase SDK
   - ✅ Android: Native Firebase SDK

## 🔧 Required: Update Firebase Config

You need to replace the placeholder Firebase credentials in `config/firebase.ts` with your actual Firebase project credentials:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  iosBundleId: "app.rork.mrk54opr365nuifvcfrsm-9xo1ldcc"
};
```

### How to Get Your Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing project
3. Go to Project Settings (⚙️ icon)
4. Scroll to "Your apps" section
5. Click "Add app" and select Web (</>) or iOS
6. Copy the configuration values

## 📱 iOS Setup

### Step 1: Download GoogleService-Info.plist

1. In Firebase Console, go to Project Settings
2. Under "Your apps", find your iOS app
3. Download `GoogleService-Info.plist`
4. Place it in the root of your project (same level as `app.json`)

### Step 2: Update app.json

Add the iOS plugin configuration (already added):

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "app.rork.mrk54opr365nuifvcfrsm-9xo1ldcc",
      "googleServicesFile": "./GoogleService-Info.plist"
    }
  }
}
```

### Step 3: Build iOS App

```bash
# For development
npx expo run:ios

# For production (requires EAS)
eas build --platform ios
```

## 🌐 Web Setup

Web is already configured! Just make sure:

1. In Firebase Console, enable Authentication for Web
2. Add your domain to authorized domains:
   - Go to Authentication > Settings > Authorized domains
   - Add: `localhost` (for development)
   - Add: your production domain

## 🔥 Firebase Features Enabled

### Firestore Database

Your app automatically syncs:
- User accounts
- Product inventory
- Warehouse settings

**Data Structure:**
```
users/ (collection)
  ├── {userId}/ (document)
      ├── username: string
      ├── role: string
      ├── ...other user fields
      └── products/ (subcollection)
          └── {productId}/ (document)
              ├── barcode: string
              ├── status: string
              └── ...other product fields
```

### Firebase Authentication

Ready to use but currently using local authentication. To migrate to Firebase Auth:

```typescript
import { getAuthInstance } from '@/config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

const auth = getAuthInstance();
if (auth) {
  // Sign in
  await signInWithEmailAndPassword(auth, email, password);
  
  // Sign up
  await createUserWithEmailAndPassword(auth, email, password);
}
```

## 🔒 Security Rules

Set up Firestore security rules in Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User documents
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // User's products subcollection
      match /products/{productId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## 🧪 Testing

### Test Web
```bash
npm run start-web
```

### Test iOS (requires Mac with Xcode)
```bash
npx expo run:ios
```

### Check Firebase Connection

Look for these logs in your console:
```
✓ Firebase initialized successfully for web
✓ Firestore offline persistence enabled for web
```

## 📊 Monitor Your Data

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to:
   - **Firestore Database** - See your data in real-time
   - **Authentication** - View user accounts
   - **Usage** - Monitor quotas and limits

## 🎯 Next Steps

1. **Replace config credentials** with your actual Firebase project
2. **Test on web** to verify Firestore sync works
3. **Set up security rules** to protect your data
4. **Add GoogleService-Info.plist** for iOS
5. **Build and test iOS app**

## 💡 Tips

- **Local-first approach**: Your app works offline! Data syncs when online.
- **Web persistence**: Firestore caches data in IndexedDB for offline use
- **Automatic sync**: All changes are automatically synced to Firestore
- **Error handling**: The app gracefully handles Firebase connection errors

## 🆘 Troubleshooting

### "Firebase initialization error"
- Check your credentials in `config/firebase.ts`
- Verify your Firebase project is active
- Check internet connection

### "Permission denied" errors
- Set up Firestore security rules (see above)
- Ensure user is authenticated

### iOS build issues
- Make sure `GoogleService-Info.plist` is in project root
- Verify `bundleIdentifier` matches in `app.json` and Firebase Console
- Run `npx expo prebuild --clean` and try again

### Web not persisting data
- Check browser console for IndexedDB errors
- Clear browser cache and reload
- Try a different browser

## 📚 Learn More

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Getting Started](https://firebase.google.com/docs/firestore/quickstart)
- [Expo & Firebase Guide](https://docs.expo.dev/guides/using-firebase/)
- [React Native Firebase](https://rnfirebase.io/) (alternative approach)

---

Your app is ready for Firebase! Just add your credentials and you're good to go! 🚀
