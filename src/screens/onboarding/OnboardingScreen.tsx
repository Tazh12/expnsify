import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, SafeAreaView } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  Extrapolation,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { useTheme, type Theme } from '../../theme';
import { Tap } from '../../components';
import { VadriMark } from '../../components/VadriLogo';
import { useOnboarding } from '../../store/useOnboarding';
import { SignInChoices, TryFreeButton } from './SignInChoices';
import { CaptureArt, PlanArt, WelcomeArt } from './OnboardingArt';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

const SLIDES = [
  {
    key: 'welcome',
    Art: WelcomeArt,
    fill: false,
    artLabel: 'The Vadri mark.',
    title: 'Every dollar,\na plan.',
    body: 'Set up your month in minutes. No bank login, nothing to sync.',
  },
  {
    key: 'capture',
    Art: CaptureArt,
    fill: false,
    artLabel: 'A café receipt, then a spoken entry, each filling in a $4.50 coffee expense.',
    title: 'Snap it. Say it.\nLogged.',
    body: 'Scan a receipt or say “coffee 4.50”. Vadri puts it on the right line of your plan.',
  },
  {
    key: 'zero',
    Art: PlanArt,
    // The Plan tab runs to the top of the slide and is cropped by the copy below it.
    fill: true,
    artLabel: 'The Plan tab. $3,200 of income, all of it assigned. $0 left to assign.',
    title: 'Give every dollar\na job.',
    body: 'Income minus what you assign. When it reaches zero, your whole month has a plan.',
  },
] as const;

const PAGES = SLIDES.length + 1;
const LAST = PAGES - 1;
const FOOTER_HEIGHT = 115;
const ART_GAP = 20;

export function OnboardingScreen({ onEmail }: { onEmail: () => void }) {
  const C = useTheme();
  const s = styles(C);
  const seen = useOnboarding(st => st.seen);
  const markSeen = useOnboarding(st => st.markSeen);
  // Decided once on mount, so marking it seen mid-flow doesn't swap the screen out.
  const [showIntro] = useState(!seen);
  const [busy, setBusy] = useState(false);

  if (!showIntro) {
    return (
      <SafeAreaView style={s.root}>
        <StartPage onEmail={onEmail} busy={busy} setBusy={setBusy} />
      </SafeAreaView>
    );
  }
  return <IntroPager onEmail={onEmail} busy={busy} setBusy={setBusy} markSeen={markSeen} />;
}

function IntroPager({
  onEmail, busy, setBusy, markSeen,
}: {
  onEmail: () => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  markSeen: () => void;
}) {
  const C = useTheme();
  const s = styles(C);
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [page, setPage] = useState(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.set(e.contentOffset.x);
  });

  const onPageChange = useCallback((next: number) => {
    setPage(next);
    Haptics.selectionAsync().catch(() => {});
    if (next === LAST) markSeen();
  }, [markSeen]);

  // Fires once per page crossing, not per frame.
  useAnimatedReaction(
    () => Math.round(scrollX.get() / width),
    (next, prev) => {
      if (prev !== null && next !== prev) scheduleOnRN(onPageChange, next);
    },
    [width],
  );

  const goTo = (target: number) => {
    scrollRef.current?.scrollTo({ x: target * width, animated: !reduced });
    if (reduced) onPageChange(target);
  };

  // The start page carries its own large mark, so the small one steps aside.
  const markStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.get(), [(LAST - 1) * width, LAST * width], [1, 0], Extrapolation.CLAMP),
  }));

  const footerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.get(), [(LAST - 1) * width, (LAST - 0.6) * width], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.topBar}>
          <Animated.View style={markStyle}>
            <Animated.View entering={FadeIn.duration(400).easing(EASE_OUT)}>
              <VadriMark width={22} />
            </Animated.View>
          </Animated.View>
          {page < LAST && (
            <Tap
              onPress={() => { markSeen(); goTo(LAST); }}
              accessibilityRole="button"
              accessibilityLabel="Skip introduction"
              hitSlop={12}
              style={s.skip}
            >
              <Text style={s.skipText}>Skip</Text>
            </Tap>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            style={{ flex: 1 }}
          >
            {SLIDES.map((slide, i) => (
              <Slide
                key={slide.key}
                index={i}
                active={page === i}
                width={width}
                scrollX={scrollX}
                reduced={reduced}
                slide={slide}
              />
            ))}
            <View style={{ width }}>
              <StartPage onEmail={onEmail} busy={busy} setBusy={setBusy} />
            </View>
          </Animated.ScrollView>
  
          <Animated.View style={[s.footer, footerStyle]} pointerEvents={page < LAST ? 'auto' : 'none'}>
            <View style={s.dots} accessibilityRole="progressbar" accessibilityLabel={`Page ${page + 1} of ${PAGES}`}>
              {Array.from({ length: PAGES }, (_, i) => (
                <Dot key={i} index={i} width={width} scrollX={scrollX} />
              ))}
            </View>
            <Tap
              onPress={() => goTo(Math.min(page + 1, LAST))}
              accessibilityRole="button"
              accessibilityLabel="Next"
              style={s.next}
            >
              <Text style={s.nextText}>{page === LAST - 1 ? 'Get started' : 'Next'}</Text>
            </Tap>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Slide({
  index, active, width, scrollX, reduced, slide,
}: {
  index: number;
  active: boolean;
  width: number;
  scrollX: SharedValue<number>;
  reduced: boolean;
  slide: (typeof SLIDES)[number];
}) {
  const C = useTheme();
  const s = styles(C);
  const range = [(index - 1) * width, index * width, (index + 1) * width];

  // The art moves slower than the page, so it reads as sitting behind the text.
  const artStyle = useAnimatedStyle(() => {
    const x = scrollX.get();
    return {
      opacity: interpolate(x, range, [0, 1, 0], Extrapolation.CLAMP),
      transform: reduced ? [] : [
        { translateX: interpolate(x, range, [width * 0.35, 0, -width * 0.35], Extrapolation.CLAMP) },
        { scale: interpolate(x, range, [0.94, 1, 0.94], Extrapolation.CLAMP) },
      ],
    };
  });
  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.get(), range, [0, 1, 0], Extrapolation.CLAMP),
  }));

  const { Art } = slide;
  const first = index === 0;
  // With large text the real UI can outgrow its space; scale it down to fit rather than run into the copy.
  const [room, setRoom] = useState(0);
  const [natural, setNatural] = useState(0);
  const space = room - ART_GAP;
  const fit = room > 0 && natural > space ? space / natural : 1;

  return (
    <View style={[s.slide, { width }]}>
      <Animated.View
        style={[slide.fill ? s.artFill : s.artWrap, fit < 1 && { justifyContent: 'flex-start' }, artStyle]}
        onLayout={e => setRoom(e.nativeEvent.layout.height)}
      >
        <Animated.View
          style={slide.fill ? { flex: 1 } : { alignSelf: 'stretch', alignItems: 'center' }}
          entering={first ? FadeIn.duration(500).easing(EASE_OUT) : undefined}
        >
          {/* The art reuses real, inert controls. VoiceOver reads it as one picture instead. */}
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={slide.artLabel}
            onLayout={slide.fill ? undefined : e => setNatural(e.nativeEvent.layout.height)}
            style={slide.fill
              ? { flex: 1, alignSelf: 'stretch' }
              : { alignSelf: 'stretch', alignItems: 'center', transform: [{ scale: fit }], transformOrigin: 'top center' }}
          >
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={slide.fill ? { flex: 1 } : { alignSelf: 'stretch', alignItems: 'center' }}
            >
              <Art active={active} />
            </View>
          </View>
        </Animated.View>
      </Animated.View>
      <Animated.View style={[s.copy, textStyle]}>
        <Animated.View entering={first ? FadeInDown.delay(120).duration(500).easing(EASE_OUT) : undefined}>
          <Text style={s.title} accessibilityRole="header" maxFontSizeMultiplier={1.15}>{slide.title}</Text>
          <Text style={s.body}>{slide.body}</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function Dot({ index, width, scrollX }: { index: number; width: number; scrollX: SharedValue<number> }) {
  const C = useTheme();
  const style = useAnimatedStyle(() => {
    const d = Math.abs(scrollX.get() / width - index);
    return {
      opacity: interpolate(d, [0, 1], [1, 0.25], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(d, [0, 1], [1.3, 1], Extrapolation.CLAMP) }],
    };
  });
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.sage }, style]} />;
}

function StartPage({
  onEmail, busy, setBusy,
}: {
  onEmail: () => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const C = useTheme();
  const s = styles(C);
  return (
    <View style={s.start}>
      <View style={s.startHead}>
        <VadriMark width={64} />
        <Text style={[s.title, { textAlign: 'center', marginTop: 28 }]} accessibilityRole="header">
          Start your plan.
        </Text>
        <Text style={[s.body, { textAlign: 'center' }]}>
          Try Vadri now, or sign in to keep your budget on every device.
        </Text>
      </View>

      <View style={s.actions}>
        <TryFreeButton busy={busy} setBusy={setBusy} />
        <Text style={s.note}>No account needed. Sign in later for scan and voice.</Text>

        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>or</Text>
          <View style={s.dividerLine} />
        </View>

        <SignInChoices busy={busy} setBusy={setBusy} />

        <Tap onPress={onEmail} disabled={busy} accessibilityRole="link" style={s.emailLink}>
          <Text style={s.emailText}>
            Have an email account? <Text style={{ color: C.link, fontFamily: C.fonts.semibold }}>Sign in</Text>
          </Text>
        </Tap>
      </View>
    </View>
  );
}

function styles(C: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    topBar: {
      height: 52, paddingHorizontal: 24,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    skip: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
    skipText: { fontFamily: C.fonts.medium, fontSize: 15, color: C.muted },
    slide: { flex: 1, paddingHorizontal: 28, paddingBottom: FOOTER_HEIGHT },
    artWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    artFill: { flex: 1, paddingTop: 4, marginBottom: 20 },
    copy: { paddingBottom: 12, maxWidth: 420 },
    title: {
      fontFamily: C.fonts.serif, fontSize: 38, lineHeight: 44,
      color: C.cream, letterSpacing: -0.6,
    },
    body: {
      fontFamily: C.fonts.regular, fontSize: 17, lineHeight: 25,
      color: C.muted, marginTop: 14,
    },
    // Floats over the pager so the start page can use the full height.
    footer: {
      position: 'absolute', left: 0, right: 0, bottom: 0,
      paddingHorizontal: 28, paddingTop: 20, paddingBottom: 12, gap: 24,
    },
    dots: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    next: {
      height: 52, borderRadius: 14, backgroundColor: C.sage,
      alignItems: 'center', justifyContent: 'center',
    },
    nextText: { color: C.onPrimary, fontFamily: C.fonts.semibold, fontSize: 17 },
    start: { flex: 1, paddingHorizontal: 28, paddingBottom: 12, justifyContent: 'space-between' },
    startHead: { flex: 1, alignItems: 'center', justifyContent: 'center', maxWidth: 420, alignSelf: 'center' },
    actions: { width: '100%', maxWidth: 420, alignSelf: 'center' },
    note: {
      fontFamily: C.fonts.regular, fontSize: 13, lineHeight: 18,
      color: C.muted, textAlign: 'center', marginTop: 10,
    },
    divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.hairStrong },
    dividerText: { fontFamily: C.fonts.regular, fontSize: 13, color: C.muted },
    emailLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    emailText: { fontFamily: C.fonts.regular, fontSize: 14, color: C.muted },
  });
}
