import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Tally',
  slug: 'tally',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/vadri-brand/app-icon-1024.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/vadri-brand/lockup.png',
    resizeMode: 'contain',
    backgroundColor: '#FBF6EA',
  },
  ios: {
    bundleIdentifier: 'com.expensify.ExpenseTracker',
    supportsTablet: false,
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      NSCameraUsageDescription: 'Expnsify uses the camera to scan receipts.',
      NSPhotoLibraryUsageDescription: 'Expnsify reads receipts from your photo library.',
      NSMicrophoneUsageDescription: 'Expnsify lets you log spending by voice.',
      NSLocationWhenInUseUsageDescription: 'Expnsify can save where a purchase happened, only if you turn that on.',
    },
  },
  android: {
    package: 'com.expensify.expensetracker',
    adaptiveIcon: {
      foregroundImage: './assets/vadri-brand/adaptive-icon-foreground-1024.png',
      backgroundColor: '#FBF6EA',
    },
  },
  web: {
    favicon: './assets/vadri-brand/favicon-48.png',
    bundler: 'metro',
  },
  plugins: [
    [
      'expo-image-picker',
      {
        photosPermission: 'Expnsify reads receipts from your photo library.',
        cameraPermission: 'Expnsify uses the camera to scan receipts.',
        microphonePermission: false,
      },
    ],
    [
      'expo-av',
      {
        microphonePermission: 'Expnsify lets you log spending by voice.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Expnsify can save where a purchase happened, only if you turn that on.',
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FBF6EA',
        image: './assets/vadri-brand/lockup.png',
        resizeMode: 'contain',
        imageWidth: 248,
        dark: {
          backgroundColor: '#2B2238',
          image: './assets/vadri-brand/lockup-dark.png',
        },
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/vadri-brand/app-icon-1024.png',
        color: '#2A4343',
      },
    ],
  ],
  extra: {
    proxyUrl: process.env.EXPO_PUBLIC_PROXY_URL ?? '',
  },
});
