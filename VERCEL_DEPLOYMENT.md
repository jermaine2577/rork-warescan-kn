# Deploy to Vercel with Firebase

Complete guide to deploy your WareScan KN web app to Vercel with Firebase integration.

## 🚀 Overview

This app is built with:
- **Expo** (React Native for Web)
- **Firebase** (Authentication & Firestore Database)
- **Vercel** (Web hosting)

## 📋 Prerequisites

Before deploying, ensure you have:
- [Vercel Account](https://vercel.com/signup) (free tier works)
- [Firebase Project](https://console.firebase.google.com/) set up
- Git repository (GitHub, GitLab, or Bitbucket)

---

## Part 1: Firebase Setup

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or select existing project
3. Name it (e.g., "warescan-kn")
4. Disable Google Analytics (optional)
5. Click **"Create project"**

### Step 2: Enable Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in production mode"** (we'll add rules later)
4. Select a location (choose closest to your users)
5. Click **"Enable"**

### Step 3: Set Up Firestore Security Rules

1. In Firestore Database, go to **"Rules"** tab
2. Replace with these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
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

3. Click **"Publish"**

### Step 4: Enable Firebase Authentication

1. Go to **Authentication** section
2. Click **"Get started"**
3. Go to **"Sign-in method"** tab
4. Enable **Email/Password** authentication
5. Click **"Save"**

### Step 5: Get Firebase Web Credentials

1. Go to **Project Settings** (⚙️ icon)
2. Scroll to **"Your apps"** section
3. Click **"Add app"** → Select **Web** (</>)
4. Register app with a nickname (e.g., "WareScan Web")
5. Copy the `firebaseConfig` object - you'll need these values:

```javascript
{
  apiKey: "AIzaSy...",
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-app.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
}
```

### Step 6: Add Authorized Domains

1. In **Authentication** → **Settings** → **Authorized domains**
2. Add these domains:
   - `localhost` (already there)
   - Your Vercel domain (e.g., `your-app.vercel.app`)
   - Your custom domain if you have one

---

## Part 2: Update Your App Config

### Step 1: Update Firebase Config

Edit `config/firebase.ts` and replace with your actual Firebase credentials:

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

⚠️ **Important**: Never commit real API keys to public repositories. Use environment variables instead (see Part 3).

### Step 2: Create Web Build Configuration

Create a file named `vercel.json` in your project root:

```json
{
  "buildCommand": "npx expo export -p web",
  "outputDirectory": "dist",
  "devCommand": "npx expo start --web",
  "framework": "expo",
  "installCommand": "bun install"
}
```

---

## Part 3: Environment Variables (Recommended)

### Step 1: Use Environment Variables in Your Code

Update `config/firebase.ts` to use environment variables:

```typescript
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: Constants.expoConfig?.extra?.firebaseProjectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: Constants.expoConfig?.extra?.firebaseAppId || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Rest of your firebase.ts code remains the same...
```

### Step 2: Create .env File

Create a `.env` file in your project root (add to `.gitignore`):

```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

### Step 3: Update .gitignore

Make sure `.env` is in your `.gitignore`:

```
.env
.env.local
.env*.local
```

---

## Part 4: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Easiest)

1. **Push Your Code to Git**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click **"Add New..."** → **"Project"**
   - Import your Git repository
   - Select the repository containing your app

3. **Configure Build Settings**
   - **Framework Preset**: Select "Other"
   - **Build Command**: `npx expo export -p web`
   - **Output Directory**: `dist`
   - **Install Command**: `bun install` or `npm install`

4. **Add Environment Variables**
   - Click **"Environment Variables"**
   - Add each variable from your `.env` file:
     ```
     EXPO_PUBLIC_FIREBASE_API_KEY
     EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
     EXPO_PUBLIC_FIREBASE_PROJECT_ID
     EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
     EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
     EXPO_PUBLIC_FIREBASE_APP_ID
     ```
   - Make sure to select all environments (Production, Preview, Development)

5. **Deploy**
   - Click **"Deploy"**
   - Wait for build to complete (2-5 minutes)
   - Your app will be live at `https://your-app.vercel.app`

### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   # First time deployment
   vercel
   
   # Follow prompts:
   # - Set up and deploy? Y
   # - Which scope? Select your account
   # - Link to existing project? N
   # - Project name? (press enter for default)
   # - Directory? ./
   # - Override settings? N
   ```

4. **Add Environment Variables**
   ```bash
   vercel env add EXPO_PUBLIC_FIREBASE_API_KEY
   # Enter the value when prompted
   # Select: Production, Preview, Development
   
   # Repeat for all Firebase variables
   vercel env add EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
   vercel env add EXPO_PUBLIC_FIREBASE_PROJECT_ID
   vercel env add EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
   vercel env add EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   vercel env add EXPO_PUBLIC_FIREBASE_APP_ID
   ```

5. **Deploy to Production**
   ```bash
   vercel --prod
   ```

---

## Part 5: Post-Deployment Setup

### Step 1: Update Firebase Authorized Domains

1. Go to Firebase Console → **Authentication** → **Settings**
2. Under **Authorized domains**, add your Vercel URL:
   - `your-app-name.vercel.app`
3. Click **"Add domain"**

### Step 2: Test Your Deployment

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. Try logging in or creating an account
3. Check that data syncs to Firestore:
   - Go to Firebase Console → **Firestore Database**
   - You should see data appear after login

### Step 3: Custom Domain (Optional)

1. In Vercel dashboard, go to your project
2. Go to **Settings** → **Domains**
3. Click **"Add"** and enter your domain
4. Follow DNS configuration instructions
5. Add custom domain to Firebase Authorized Domains (see Step 1)

---

## 🔄 Automatic Deployments

Once connected, Vercel automatically deploys:
- **Production**: When you push to `main` branch
- **Preview**: When you push to other branches or open PRs

To deploy manually:
```bash
git add .
git commit -m "Update app"
git push origin main
```

Vercel will automatically build and deploy within 2-5 minutes.

---

## 📊 Monitor Your App

### Vercel Analytics
- View deployment logs: Vercel Dashboard → Your Project → Deployments
- Monitor errors: Check Function Logs
- Traffic analytics: Analytics tab (requires Pro plan)

### Firebase Console
- **Authentication**: View users and sign-in activity
- **Firestore**: Monitor database reads/writes
- **Usage**: Check quotas and set up billing alerts

---

## 🐛 Troubleshooting

### Build Fails on Vercel

**Error**: `Command "npx expo export -p web" exited with 1`

**Solution**:
1. Check build logs in Vercel dashboard
2. Make sure `package.json` has all dependencies
3. Try building locally first:
   ```bash
   npx expo export -p web
   ```
4. Fix any errors shown

### Firebase Not Connecting

**Error**: "Firebase initialization error"

**Solutions**:
1. Verify environment variables are set in Vercel
2. Check Firebase credentials are correct
3. Ensure Firebase project is active
4. Check browser console for specific errors

### "Permission Denied" in Firestore

**Solutions**:
1. Check Firestore security rules are set correctly
2. Ensure user is authenticated before accessing data
3. Verify user UID matches the document path

### App Loads But Shows Blank Screen

**Solutions**:
1. Check browser console for errors (F12)
2. Verify `vercel.json` output directory is `dist`
3. Clear cache and hard reload (Ctrl+Shift+R)
4. Check Vercel deployment logs

### Environment Variables Not Working

**Solutions**:
1. Redeploy after adding environment variables
2. Make sure variables start with `EXPO_PUBLIC_`
3. Check variables are set for "Production" environment
4. Try rebuilding:
   ```bash
   vercel --prod --force
   ```

---

## 🎯 Best Practices

### Security
✅ Never commit `.env` files to Git  
✅ Use Firestore security rules  
✅ Enable Firebase App Check (advanced)  
✅ Rotate API keys periodically  

### Performance
✅ Enable Firestore offline persistence (already configured)  
✅ Use indexes for complex queries  
✅ Implement pagination for large lists  
✅ Optimize images and assets  

### Monitoring
✅ Set up Firebase usage alerts  
✅ Monitor Vercel function logs  
✅ Track user authentication errors  
✅ Set up error tracking (Sentry, LogRocket)  

---

## 💰 Costs

### Firebase Free Tier (Spark Plan)
- **Firestore**: 50K reads, 20K writes, 20K deletes per day
- **Authentication**: Unlimited users
- **Storage**: 1 GB
- **Good for**: Small to medium apps (up to ~1,000 daily users)

### Vercel Free Tier (Hobby)
- **Deployments**: Unlimited
- **Bandwidth**: 100 GB/month
- **Build time**: 100 hours/month
- **Good for**: Personal projects and small apps

**When to upgrade**:
- Firebase: When you hit free tier limits
- Vercel: For custom domains, analytics, or team features

---

## 📱 Mobile App (iOS/Android)

This guide covers web deployment. For iOS/Android apps:

1. **iOS**: See `IOS_FIREBASE_CONFIG.md` for setup
2. **Android**: Download `google-services.json` from Firebase
3. **Build**: Use EAS Build or contact support

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Expo Web Documentation](https://docs.expo.dev/workflow/web/)
- [Firebase Web Setup](https://firebase.google.com/docs/web/setup)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

## 🆘 Need Help?

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review Vercel deployment logs
3. Check Firebase Console for errors
4. Contact support with:
   - Deployment URL
   - Error message
   - Screenshots of issue

---

## ✅ Deployment Checklist

Before going live, ensure:

- [ ] Firebase project created and configured
- [ ] Firestore security rules set up
- [ ] Firebase Authentication enabled
- [ ] Environment variables added to Vercel
- [ ] Code pushed to Git repository
- [ ] Vercel deployment successful
- [ ] Firebase authorized domains updated
- [ ] App tested on production URL
- [ ] Login/signup working
- [ ] Data syncing to Firestore
- [ ] Mobile-responsive design verified

---

Your app is now live! 🚀

Access it at: `https://your-app.vercel.app`
