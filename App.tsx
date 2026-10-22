import React, { useEffect, useRef, useState } from 'react';
import {
  View, StatusBar, Modal, SafeAreaView, Image, AppState, Platform, useColorScheme, Dimensions,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { ComicNeue_400Regular, ComicNeue_400Regular_Italic, ComicNeue_700Bold } from '@expo-google-fonts/comic-neue';
import { ThemeContext, buildTheme } from './src/theme';
import { SPLASH_LOGO_SIZE } from './src/components/VadriLogo';
import { useSettings } from './src/store/useSettings';
import { useRates } from './src/store/useRates';
import { useCategories } from './src/store/useCategories';
import { useExpenses } from './src/store/useExpenses';
import { useBudget } from './src/store/useBudget';
import { useBudgetGroups } from './src/store/useBudgetGroups';
import { useAuth, onAuthStateChanged, firebaseAuth } from './src/store/useAuth';
import { useLayout } from './src/hooks/useLayout';
import { AppShell } from './src/components/AppShell';
import { AppHeader } from './src/components/AppHeader';
import type { TabId, AddAnchor } from './src/components/TabBar';
import { TodayScreen } from './src/screens/TodayScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { ActivityScreen } from './src/screens/ActivityScreen';
import { InsightsScreen } from './src/screens/InsightsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import AuthScreen from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/onboarding/OnboardingScreen';
import { useOnboarding } from './src/store/useOnboarding';
import { CreateAccountSheet } from './src/flows/CreateAccountSheet';
import { AddSheet, type CaptureMethod } from './src/flows/AddSheet';
import { CaptureChooser } from './src/flows/CaptureChooser';
import { CaptureIntroSheet } from './src/flows/CaptureIntroSheet';
import { UpgradeModal } from './src/flows/UpgradeModal';
import { useAiUsage } from './src/store/useAiUsage';
import { useViewMonth } from './src/store/useViewMonth';
import { useOpenRow } from './src/store/useOpenRow';
import { useNotificationSync } from './src/hooks/useNotificationSync';

SplashScreen.preventAutoHideAsync().catch(() => {});

const SPLASH_LIGHT = '#FBF6EA';
const SPLASH_DARK = '#2B2238';
const ONBOARDING_THEME = buildTheme('forest', 'vadri');

export default function App() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    ComicNeue_400Regular,
    ComicNeue_400Regular_Italic,
    ComicNeue_700Bold,
    'BodoniModa-Regular': require('./assets/vadri-brand/fonts/BodoniModa-Regular.ttf'),
    'BodoniModa-SemiBold': require('./assets/vadri-brand/fonts/BodoniModa-SemiBold.ttf'),
    'BodoniModa-SemiBoldItalic': require('./assets/vadri-brand/fonts/BodoniModa-SemiBoldItalic.ttf'),
  });
  const [fontWaitOver, setFontWaitOver] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontWaitOver(true), Platform.OS === 'web' ? 1200 : 4000);
    return () => clearTimeout(t);
  }, []);
  const fontsReady = fontsLoaded || !!fontError || fontWaitOver;

  const settings = useSettings();
  const { isWide } = useLayout();
  useNotificationSync();
  const { setUser, setInitializing, initializing, user } = useAuth();
  const onboardingLoaded = useOnboarding(s => s.loaded);
  const [emailSignIn, setEmailSignIn] = useState(false);
  useEffect(() => {
    useOnboarding.getState().load();
  }, []);
  useEffect(() => {
    if (user) setEmailSignIn(false);
  }, [user]);
  // Keep the splash until we know whether to show onboarding, so returning users never see it flash.
  const booting = !fontsReady || initializing || !onboardingLoaded;
  useEffect(() => {
    if (!booting) SplashScreen.hideAsync().catch(() => {});
  }, [booting]);
  const { subscribe: subCats, reset: resetCats } = useCategories();
  const { subscribe: subExp, reset: resetExp } = useExpenses();
  const { subscribe: subBudget, reset: resetBudget } = useBudget();
  const { subscribe: subGroups, reset: resetGroups } = useBudgetGroups();

  const unsubCats = useRef<(() => void) | null>(null);
  const unsubExp = useRef<(() => void) | null>(null);
  const unsubBudget = useRef<(() => void) | null>(null);
  const unsubGroups = useRef<(() => void) | null>(null);
  const subscribedUid = useRef<string | null>(null);

  const [tab, setTab] = useState<TabId>('today');
  const [addOpen, setAddOpen] = useState(false);
  const [addMethod, setAddMethod] = useState<CaptureMethod | undefined>(undefined);
  const [chooserAnchor, setChooserAnchor] = useState<AddAnchor | null>(null);
  const [introOpen, setIntroOpen] = useState(false);
  const introAnchor = useRef<AddAnchor | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const month = useViewMonth(s => s.month);
  const shiftMonth = useViewMonth(s => s.shiftMonth);
  const [pendingShare, setPendingShare] = useState<{ uri: string; mimeType?: string } | null>(null);

  useEffect(() => {
    (async () => {
      await settings.load();
      const { preferredCurrency } = useSettings.getState();
      await useRates.getState().loadCache();
      if (useRates.getState().isStale()) {
        useRates.getState().fetch(preferredCurrency);
      }
    })().catch(() => {});
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && useRates.getState().isStale()) {
        useRates.getState().fetch(useSettings.getState().preferredCurrency);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(
      firebaseAuth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setInitializing(false);

        // A guest can switch straight to another account, so drop the old listeners first.
        if (subscribedUid.current && subscribedUid.current !== firebaseUser?.uid) {
          unsubCats.current?.();
          unsubExp.current?.();
          unsubBudget.current?.();
          unsubGroups.current?.();
          resetCats();
          resetExp();
          resetBudget();
          resetGroups();
        }

        if (firebaseUser) {
          useAiUsage.getState().refresh();
          if (subscribedUid.current === firebaseUser.uid) return;
          subscribedUid.current = firebaseUser.uid;
          unsubCats.current = subCats(firebaseUser.uid);
          unsubExp.current = subExp(firebaseUser.uid);
          unsubBudget.current = subBudget(firebaseUser.uid);
          unsubGroups.current = subGroups(firebaseUser.uid);
        } else {
          subscribedUid.current = null;
          unsubCats.current?.();
          unsubExp.current?.();
          unsubBudget.current?.();
          unsubGroups.current?.();
          unsubCats.current = null;
          unsubExp.current = null;
          unsubBudget.current = null;
          unsubGroups.current = null;
          resetCats();
          resetExp();
          resetBudget();
          resetGroups();
        }
      },
      () => setInitializing(false),
    );
    // Don't blank the web app if IndexedDB/auth persistence never resolves.
    const t = setTimeout(() => setInitializing(false), 2500);
    return () => {
      unsub();
      clearTimeout(t);
    };
  }, []);

  useIncomingShare((file) => {
    setPendingShare(file);
    setAddOpen(true);
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onDragOver = (e: DragEvent) => { e.preventDefault(); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const uri = URL.createObjectURL(file);
      setPendingShare({ uri, mimeType: file.type || 'application/pdf' });
      setAddOpen(true);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const theme = buildTheme(settings.palette, settings.fontId);
  const isLight = theme.isLight;

  if (booting) {
    const splashDark = colorScheme === 'dark';
    return (
      <View style={{
        flex: 1,
        backgroundColor: splashDark ? SPLASH_DARK : SPLASH_LIGHT,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Image
          source={splashDark
            ? require('./assets/vadri-brand/lockup-dark.png')
            : require('./assets/vadri-brand/lockup.png')}
          style={{ width: SPLASH_LOGO_SIZE, height: SPLASH_LOGO_SIZE }}
          resizeMode="contain"
        />
      </View>
    );
  }

  if (!user) {
    if (emailSignIn) {
      return (
        <ThemeContext.Provider value={theme}>
          <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={theme.background} />
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
            <AuthScreen onBack={() => setEmailSignIn(false)} />
          </SafeAreaView>
        </ThemeContext.Provider>
      );
    }
    // Onboarding is always Forest, whatever palette was saved on this device before.
    return (
      <ThemeContext.Provider value={ONBOARDING_THEME}>
        <StatusBar barStyle="dark-content" backgroundColor={ONBOARDING_THEME.bg} />
        <OnboardingScreen onEmail={() => setEmailSignIn(true)} />
      </ThemeContext.Provider>
    );
  }

  const openAdd = (m?: CaptureMethod) => {
    setAddMethod(m);
    setAddOpen(true);
  };

  // Where the capture button leads: the camera, or a choice of method. Asked once, then remembered.
  const fallbackAnchor = (): AddAnchor => {
    const { width, height } = Dimensions.get('window');
    return { x: width / 2 - 28, y: height - 22 - 66, width: 56, height: 56 };
  };
  const continueCapture = (cameraFirst: boolean, anchor: AddAnchor | null) => {
    if (cameraFirst) openAdd('photo');
    else setChooserAnchor(anchor ?? fallbackAnchor());
  };
  const requestCapture = (anchor?: AddAnchor) => {
    // The camera can't open on web, so it always gets the full picker.
    if (Platform.OS === 'web') return openAdd();
    const { captureIntroSeen, openCameraRightAway } = useSettings.getState();
    if (!captureIntroSeen) {
      introAnchor.current = anchor ?? null;
      setIntroOpen(true);
      return;
    }
    continueCapture(openCameraRightAway, anchor ?? null);
  };

  const screen = (() => {
    switch (tab) {
      case 'today':
        return <TodayScreen onOpenPlan={() => setTab('plan')} onOpenActivity={() => setTab('activity')} />;
      case 'plan':
        return <PlanScreen />;
      case 'activity':
        return <ActivityScreen onScan={() => requestCapture()} />;
      case 'insights':
        return <InsightsScreen />;
    }
  })();

  const header = (
    <AppHeader
      month={month}
      onChangeMonth={shiftMonth}
      onOpenSettings={() => setSettingsOpen(true)}
      showBrand={!isWide}
    />
  );

  return (
    <ThemeContext.Provider value={theme}>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={theme.bg} />
      {/* Any touch outside an open swipe row closes it. */}
      <View style={{ flex: 1, backgroundColor: theme.bg }} onTouchStart={() => useOpenRow.getState().closeIfOutside()}>
        {!isWide && (
          <SafeAreaView style={{ backgroundColor: theme.bg }}>
            {header}
          </SafeAreaView>
        )}

        <AppShell
          tab={tab}
          onTab={setTab}
          onAdd={requestCapture}
          isWide={isWide}
        >
          <View style={{ flex: 1 }}>
            {isWide && header}
            {screen}
          </View>
        </AppShell>

        <CaptureChooser
          anchor={chooserAnchor}
          onClose={() => setChooserAnchor(null)}
          onPick={(m) => { setChooserAnchor(null); openAdd(m); }}
        />
        <CaptureIntroSheet
          open={introOpen}
          onClose={() => setIntroOpen(false)}
          onContinue={(cameraFirst) => {
            const { set } = useSettings.getState();
            set('openCameraRightAway', cameraFirst);
            set('captureIntroSeen', true);
            setIntroOpen(false);
            // Let the intro's modal finish closing; iOS won't present the next one over it.
            setTimeout(() => continueCapture(cameraFirst, introAnchor.current), 400);
          }}
        />
        <AddSheet
          open={addOpen}
          onClose={() => { setAddOpen(false); setAddMethod(undefined); setPendingShare(null); useAiUsage.getState().clearBlock(); }}
          pendingShare={pendingShare}
          initialMethod={addMethod}
        />
        {!addOpen && <UpgradeModal />}
        <CreateAccountSheet />

        <Modal visible={settingsOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setSettingsOpen(false)}>
          <ThemeContext.Provider value={theme}>
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
              <SettingsScreen onClose={() => setSettingsOpen(false)} />
            </SafeAreaView>
          </ThemeContext.Provider>
        </Modal>
      </View>
    </ThemeContext.Provider>
  );
}

function useIncomingShare(onShare: (file: { uri: string; mimeType?: string }) => void) {
  const onShareRef = useRef(onShare);
  onShareRef.current = onShare;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let unsub: (() => void) | undefined;
    try {
      // Optional native share extension. Present after an EAS build with the plugin.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('expo-share-intent') as {
        addChangeListener?: (cb: (ev: { files?: { path: string; mimeType?: string }[] }) => void) => { remove: () => void };
        getShareIntent?: () => { files?: { path: string; mimeType?: string }[] } | null;
      };
      const emit = (files?: { path: string; mimeType?: string }[]) => {
        const f = files?.[0];
        if (f?.path) onShareRef.current({ uri: f.path, mimeType: f.mimeType });
      };
      emit(mod.getShareIntent?.()?.files);
      const sub = mod.addChangeListener?.((ev) => emit(ev.files));
      if (sub) unsub = () => sub.remove();
    } catch {
      // Share extension not installed — in-app file pick still works.
    }
    return () => unsub?.();
  }, []);
}
