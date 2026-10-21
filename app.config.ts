import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Tally',
  slug: 'tally',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/icon.png',
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
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#6B5FE6',
    },
  },
  web: {
    favicon: './assets/favicon.png',
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
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#2A4343',
      },
    ],
  ],
  extra: {
    proxyUrl: process.env.EXPO_PUBLIC_PROXY_URL ?? '',
  },
});
