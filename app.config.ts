import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Tally',
  slug: 'tally',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#6B5FE6',
  },
  ios: {
    bundleIdentifier: 'com.expensify.ExpenseTracker',
    supportsTablet: false,
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      NSCameraUsageDescription: 'Tally uses the camera to scan receipts.',
      NSPhotoLibraryUsageDescription: 'Tally reads receipts from your photo library.',
      NSMicrophoneUsageDescription: 'Tally lets you log expenses by voice.',
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
  },
  plugins: [
    [
      'expo-image-picker',
      {
        photosPermission: 'Tally reads receipts from your photo library.',
        cameraPermission: 'Tally uses the camera to scan receipts.',
        microphonePermission: false,
      },
    ],
    [
      'expo-av',
      {
        microphonePermission: 'Tally lets you log expenses by voice.',
      },
    ],
  ],
  extra: {
    proxyUrl: process.env.EXPO_PUBLIC_PROXY_URL ?? '',
  },
});
