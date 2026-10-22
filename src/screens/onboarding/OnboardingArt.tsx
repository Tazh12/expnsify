import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { Card } from '../../components';
import { VadriMark } from '../../components/VadriLogo';
import { AssignSummary } from '../../components/AssignSummary';
import { BudgetSection } from '../../components/BudgetSection';
import { AmountCard, ReviewRow } from '../../components/ReviewParts';
import { VoiceWave, useVoiceLevels } from '../../components/VoiceWave';
import { sectionColor, type BudgetLine, type BudgetSection as SectionId } from '../../store/budgetTypes';
import { Receipt } from './Receipt';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const CURRENCY = 'USD';
const noop = () => {};

export type ArtProps = { active: boolean };

// ─── Slide 1 ────────────────────────────────────────────────────────────────

/** The mark holds still while the field behind it breathes. */
export function WelcomeArt({ active }: ArtProps) {
  const C = useTheme();
  const reduced = useReducedMotion();
  const breath = useSharedValue(1);

  useEffect(() => {
    if (!active || reduced) {
      cancelAnimation(breath);
      breath.set(withTiming(1, { duration: 300, easing: EASE_OUT }));
      return;
    }
    breath.set(withRepeat(
      withSequence(
        withTiming(1.04, { duration: 2400, easing: EASE_IN_OUT }),
        withTiming(1, { duration: 2400, easing: EASE_IN_OUT }),
      ),
      -1,
    ));
    return () => cancelAnimation(breath);
  }, [active, reduced, breath]);

  const fieldStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.get() }] }));

  return (
    <View style={{ width: 260, height: 260, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{
        position: 'absolute', width: 236, height: 236, borderRadius: 118, backgroundColor: C.amber,
        opacity: 0.38,
      }, fieldStyle]} />
      <VadriMark width={112} />
    </View>
  );
}

// ─── Slide 2 ────────────────────────────────────────────────────────────────

type CaptureStep = 'framing' | 'scanned' | 'listening' | 'heard';
const STEP_MS: Record<CaptureStep, number> = { framing: 1100, scanned: 2400, listening: 1900, heard: 2400 };
const NEXT: Record<CaptureStep, CaptureStep> = { framing: 'scanned', scanned: 'listening', listening: 'heard', heard: 'framing' };

/** The real review screen filling in, first from a receipt, then from a spoken line. */
export function CaptureArt({ active }: ArtProps) {
  const C = useTheme();
  const reduced = useReducedMotion();
  const [step, setStep] = useState<CaptureStep>(reduced ? 'scanned' : 'framing');
  const { levels, push, reset } = useVoiceLevels(22);

  useEffect(() => {
    if (reduced) { setStep('scanned'); return; }
    if (!active) { setStep('framing'); return; }
    const t = setTimeout(() => setStep(s => NEXT[s]), STEP_MS[step]);
    return () => clearTimeout(t);
  }, [active, reduced, step]);

  // A spoken phrase: syllables rise and fall, then trail off. Written to a shared value, not state.
  useEffect(() => {
    if (step === 'framing') reset();
    if (step !== 'listening') return;
    let t = 0;
    const id = setInterval(() => {
      t += 1;
      const syllable = Math.abs(Math.sin(t * 0.9)) * (0.55 + 0.45 * Math.abs(Math.sin(t * 0.23)));
      const trail = t > 22 ? Math.max(0, 1 - (t - 22) / 6) : 1;
      push((0.12 + syllable * 0.85) * trail);
    }, 70);
    return () => clearInterval(id);
  }, [step, push, reset]);

  const fromVoice = step === 'listening' || step === 'heard';
  const showResult = step === 'scanned' || step === 'heard';

  const receiptStyle = useAnimatedStyle(() => ({
    opacity: withTiming(fromVoice ? 0 : 1, { duration: 280, easing: EASE_OUT }),
  }), [fromVoice]);
  const voiceStyle = useAnimatedStyle(() => ({
    opacity: withTiming(fromVoice ? 1 : 0, { duration: 280, easing: EASE_OUT }),
  }), [fromVoice]);
  const cornersStyle = useAnimatedStyle(() => ({
    opacity: withTiming(step === 'framing' || step === 'scanned' ? 1 : 0, { duration: 240 }),
    transform: [{ scale: withTiming(step === 'framing' && !reduced ? 1.06 : 1, { duration: 900, easing: EASE_OUT }) }],
  }), [step, reduced]);
  // The review stays put, waiting, and fills in when the receipt or the voice is read.
  const resultStyle = useAnimatedStyle(() => ({
    opacity: withTiming(showResult ? 1 : 0.45, { duration: showResult ? 320 : 200, easing: EASE_OUT }),
  }), [showResult]);

  return (
    <View style={{ width: '100%', maxWidth: 340, alignSelf: 'center' }}>
      <View style={{ height: 164, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }, receiptStyle]}>
          <View style={{ transform: [{ scale: 0.62 }] }}>
            <Receipt />
          </View>
          <Animated.View pointerEvents="none" style={[s.corners, cornersStyle]}>
            <Corner color={C.sage} style={{ top: 0, left: 0 }} />
            <Corner color={C.sage} style={{ top: 0, right: 0, transform: [{ rotate: '90deg' }] }} />
            <Corner color={C.sage} style={{ bottom: 0, right: 0, transform: [{ rotate: '180deg' }] }} />
            <Corner color={C.sage} style={{ bottom: 0, left: 0, transform: [{ rotate: '270deg' }] }} />
          </Animated.View>
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }, voiceStyle]}>
          <VoiceWave levels={levels} count={22} />
          <Text style={[s.transcript, { color: step === 'heard' ? C.cream : C.muted }]}>
            {step === 'heard' ? '“Coffee 4.50”' : 'Listening…'}
          </Text>
        </Animated.View>
      </View>

      <Animated.View style={[{ marginTop: 10 }, resultStyle]}>
        <AmountCard amount={showResult ? '4.50' : ''} currencyCode={CURRENCY} />
        <Card style={{ overflow: 'hidden' }}>
          <ReviewRow label="Merchant" value={showResult ? (fromVoice ? 'Coffee' : 'Corner Café') : ''} muted={!showResult} last />
        </Card>
      </Animated.View>
    </View>
  );
}

function Corner({ color, style }: { color: string; style: object }) {
  return (
    <View style={[{ position: 'absolute', width: 22, height: 22 }, style]}>
      <View style={{ position: 'absolute', top: 0, left: 0, width: 22, height: 3, borderRadius: 1.5, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: 0, left: 0, width: 3, height: 22, borderRadius: 1.5, backgroundColor: color }} />
    </View>
  );
}

// ─── Slide 3 ────────────────────────────────────────────────────────────────

const PLAN: Array<{ section: SectionId; name: string; expected: number; due?: number }> = [
  { section: 'income', name: 'Paycheck', expected: 3200 },
  { section: 'bills', name: 'Rent', expected: 1400, due: 1 },
  { section: 'bills', name: 'Internet', expected: 60, due: 12 },
  { section: 'bills', name: 'Phone', expected: 45, due: 18 },
  { section: 'variable', name: 'Groceries', expected: 450 },
  { section: 'variable', name: 'Coffee', expected: 40 },
  { section: 'variable', name: 'Dining out', expected: 180 },
  { section: 'variable', name: 'Transport', expected: 125 },
  { section: 'investments', name: 'Savings', expected: 900 },
];
const GROUPS: Array<{ id: SectionId; label: string }> = [
  { id: 'income', label: 'Income' },
  { id: 'bills', label: 'Bills' },
  { id: 'variable', label: 'Variable' },
  { id: 'investments', label: 'Investments' },
];
const ACTUALS: Record<string, number> = { 'plan-5': 4.5 };
const PLAN_SCALE = 0.78;
const CARD_MARGIN = 8;

function sampleLines(): BudgetLine[] {
  return PLAN.map((l, i) => ({
    id: `plan-${i}`,
    month: '2026-10',
    section: l.section,
    name: l.name,
    expected: l.expected,
    actualOverride: null,
    currency: CURRENCY,
    dueDay: l.due ?? null,
    automated: false,
    notifyDaysBefore: null,
    observation: null,
    recurring: true,
    repeatEvery: 'month',
    sortOrder: i,
    templateKey: l.name.toLowerCase().replace(/\s+/g, '-'),
    paid: false,
    paidAt: null,
    paidSource: null,
    color: sectionColor(l.section),
  }));
}

/** The real Plan tab, filling in line by line until nothing is left to assign. */
export function PlanArt({ active }: ArtProps) {
  const C = useTheme();
  const reduced = useReducedMotion();
  const all = useMemo(sampleLines, []);
  // Income is there from the start, so the count runs down from the whole paycheck.
  const [shown, setShown] = useState(reduced ? all.length : 1);
  const settle = useSharedValue(1);

  useEffect(() => {
    if (!active || shown >= all.length) return;
    const t = setTimeout(() => setShown(n => n + 1), shown === 1 ? 420 : 170);
    return () => clearTimeout(t);
  }, [active, shown, all.length]);

  useEffect(() => {
    if (shown < all.length || reduced) return;
    settle.set(withDelay(80, withSequence(
      withTiming(1.035, { duration: 180, easing: EASE_OUT }),
      withTiming(1, { duration: 320, easing: EASE_IN_OUT }),
    )));
  }, [shown, all.length, reduced, settle]);

  const visible = all.slice(0, shown);
  const income = visible.filter(l => l.section === 'income').reduce((s, l) => s + l.expected, 0);
  const assigned = visible.filter(l => l.section !== 'income').reduce((s, l) => s + l.expected, 0);
  const settleStyle = useAnimatedStyle(() => ({ transform: [{ scale: settle.get() }] }));

  // The summary is pinned like a sticky header; the lines scroll up under it as each one lands,
  // so the newest is always in view and the crop always sits at the card's edge.
  const [width, setWidth] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const [headerH, setHeaderH] = useState(0);
  const [cardH, setCardH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const offset = useSharedValue(0);
  useEffect(() => {
    const target = Math.max(0, headerH + 10 + contentH * PLAN_SCALE - viewportH);
    offset.set(reduced ? target : withTiming(target, { duration: 320, easing: EASE_OUT }));
  }, [headerH, contentH, viewportH, reduced, offset]);
  const scrollStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -offset.get() }] }));
  const scaled = { width: width / PLAN_SCALE, transform: [{ scale: PLAN_SCALE }], transformOrigin: 'top left' } as const;

  return (
    <View
      pointerEvents="none"
      onLayout={e => {
        setWidth(e.nativeEvent.layout.width);
        setViewportH(e.nativeEvent.layout.height);
      }}
      style={{ width: '100%', maxWidth: 380, alignSelf: 'center', flex: 1, overflow: 'hidden' }}
    >
      {width > 0 && (
        <>
          <Animated.View style={[{ paddingTop: headerH + 10 }, scrollStyle]}>
            {/* The Plan tab at a little under full size, like a screenshot, so more of the month fits. */}
            <View style={scaled} onLayout={e => setContentH(e.nativeEvent.layout.height)}>
              {GROUPS.map(g => {
                const lines = visible.filter(l => l.section === g.id);
                if (lines.length === 0) return null;
                return (
                  <Animated.View key={g.id} entering={reduced ? undefined : FadeIn.duration(220)}>
                    <BudgetSection
                      section={g.id}
                      label={g.label}
                      lines={lines}
                      actuals={ACTUALS}
                      preferredCurrency={CURRENCY}
                      onPressLine={noop}
                      onTogglePaid={noop}
                      animateRows={!reduced}
                    />
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>

          {/* An opaque band behind the card, ending exactly at its drawn bottom edge. */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, backgroundColor: C.bg }}>
            {/* The scaled card keeps its full-size layout box (8pt bottom margin included); trim it to the drawn edge. */}
            <View style={[scaled, { marginBottom: headerH - cardH }]}>
              <Animated.View
                style={settleStyle}
                onLayout={e => {
                  const h = e.nativeEvent.layout.height;
                  setCardH(h);
                  setHeaderH((h - CARD_MARGIN) * PLAN_SCALE);
                }}
              >
                <AssignSummary income={income} assigned={assigned} currency={CURRENCY} />
              </Animated.View>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  corners: { position: 'absolute', width: 150, height: 160 },
  transcript: { fontSize: 15, marginTop: 18, fontStyle: 'italic' },
});
