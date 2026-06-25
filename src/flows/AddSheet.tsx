import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  Animated, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import Svg, { Path, Rect, Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { useTheme } from '../theme';
import { Icon, Card, Tap, CategoryChip, NewCategoryChip } from '../components';
import { CategoryEditor } from '../components/CategoryEditor';
import { DatePicker } from '../components/DatePicker';
import { useCategories } from '../store/useCategories';
import { useExpenses, type Expense } from '../store/useExpenses';
import { scanImage, scanText, transcribeAudio, type ScannedExpense } from '../services/groq';
import { uid } from '../services/format';

type Phase = 'pick' | 'scan' | 'review';
type Method = 'photo' | 'image' | 'voice' | 'manual';

// Builds a local-naive ISO string (no trailing "Z") from a Date's local
// year/month/day, matching the storage convention used elsewhere in the app
// (see src/store/defaults.ts). Using `d.toISOString()` would convert local
// midnight to UTC and can roll the date backward by one day for users in
// positive UTC-offset timezones.
function toLocalDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}T00:00:00`;
}

interface AddSheetProps {
  open: boolean;
  onClose: () => void;
  editExpense?: Expense;
}

export function AddSheet({ open, onClose, editExpense }: AddSheetProps) {
  const C = useTheme();
  const [phase, setPhase] = useState<Phase>('pick');
  const [method, setMethod] = useState<Method | null>(null);
  const [scanned, setScanned] = useState<ScannedExpense | null>(null);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'done'>('idle');

  const slideY = useRef(new Animated.Value(600)).current;
  const doneScale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (open) {
      setPhase(editExpense ? 'review' : 'pick');
      setMethod(null);
      setScanned(null);
      setReceiptUri(null);
      setSaveState('idle');
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 2 }).start();
    } else {
      Animated.timing(slideY, { toValue: 600, duration: 280, useNativeDriver: true }).start();
    }
  }, [open]);

  useEffect(() => {
    if (saveState === 'done') Animated.spring(doneScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 12 }).start();
    else doneScale.setValue(0.6);
  }, [saveState]);

  const goReview = (data: ScannedExpense | null, uri?: string) => {
    setScanned(data);
    if (uri) setReceiptUri(uri);
    setPhase('review');
  };

  const startScan = async (m: Method) => {
    setMethod(m);

    try {
      if (m === 'photo' || m === 'image') {
        if (m === 'photo') {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Camera access needed', 'Please enable camera access in Settings to scan receipts.');
            return;
          }
        } else {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Photo library access needed', 'Please enable photo library access in Settings to upload receipts.');
            return;
          }
        }

        const result = m === 'photo'
          ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5, mediaTypes: 'images' })
          : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5, mediaTypes: 'images' });

        if (result.canceled || !result.assets[0]) return;

        // We have an image — show the scan animation now
        setPhase('scan');

        const asset = result.assets[0];

        // Resize to max 1024px and force JPEG — this normalises HEIC, PNG,
        // WebP and any other format the picker may return on device/simulator.
        const manipulated = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );

        const savedUri = FileSystem.cacheDirectory + `receipt-${uid()}.jpg`;
        await FileSystem.copyAsync({ from: manipulated.uri, to: savedUri });

        const base64 = manipulated.base64
          ?? await FileSystem.readAsStringAsync(savedUri, { encoding: FileSystem.EncodingType.Base64 });

        const { categories } = useCategories.getState();
        const data = await scanImage(base64, categories, 'image/jpeg');
        goReview(data, savedUri);

      } else if (m === 'voice') {
        const perm = await Audio.requestPermissionsAsync();
        if (perm.status !== 'granted') { return; }

        setPhase('scan');
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await recording.startAsync();
        await new Promise(r => setTimeout(r, 5000));
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        if (!uri) { goReview(null); return; }

        const text = await transcribeAudio(uri);
        if (!text) { goReview(null); return; }

        const { categories } = useCategories.getState();
        const data = await scanText(text, categories);
        goReview(data);

      } else {
        goReview(null);
      }
    } catch (e) {
      console.error('startScan error', e);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes('simulator') || msg.toLowerCase().includes('not available')) {
        Alert.alert('Camera unavailable', 'The camera does not work in the simulator. Test on a real iPhone.');
      } else {
        Alert.alert('Something went wrong', 'Could not process the image. Please try again.');
      }
      setPhase('pick');
    }
  };

  if (!open) return null;

  return (
    <Modal visible={open} transparent animationType="none">
      {/* Backdrop */}
      <BlurView intensity={40} tint={C.isLight ? 'light' : 'dark'} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1}/>
      </BlurView>

      {/* Sheet */}
      <Animated.View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        transform: [{ translateY: slideY }],
      }}>
        <View style={{
          borderTopLeftRadius: 32, borderTopRightRadius: 32,
          overflow: 'hidden',
        }}>
          <BlurView intensity={90} tint={C.isLight ? 'light' : 'dark'} style={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.hair, alignSelf: 'center', marginBottom: 16 }}/>
            {phase === 'pick' && <PickPhase onPick={startScan} onClose={onClose}/>}
            {phase === 'scan' && <ScanPhase method={method}/>}
            {phase === 'review' && (
              <ReviewPhase
                scanned={scanned}
                receiptUri={receiptUri}
                onSave={onClose}
                onClose={onClose}
                setSaveState={setSaveState}
                editExpense={editExpense}
              />
            )}
          </BlurView>

          {/* Save confirmation overlay */}
          {saveState !== 'idle' && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <BlurView intensity={85} tint={C.isLight ? 'light' : 'dark'} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}/>
              {saveState === 'saving' ? (
                <Text style={{ fontFamily: C.fonts.serifItalic, fontSize: 22, color: C.muted }}>Saving…</Text>
              ) : (
                <Animated.View style={{ alignItems: 'center', gap: 14, transform: [{ scale: doneScale }] }}>
                  <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.sageGlow, borderWidth: 1, borderColor: C.sage, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="check" size={32} stroke={C.sage} sw={1.8}/>
                  </View>
                  <Text style={{ fontFamily: C.fonts.serif, fontSize: 24, color: C.cream, letterSpacing: -0.3 }}>
                    Expense <Text style={{ fontStyle: 'italic' }}>{editExpense ? 'updated' : 'added'}</Text>
                  </Text>
                  <Text style={{ fontSize: 11, color: C.subtle, letterSpacing: 0.06, textTransform: 'uppercase' }}>✦ saved to tally</Text>
                </Animated.View>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

// ── Pick ──────────────────────────────────────────────────────
function PickPhase({ onPick, onClose }: { onPick: (m: Method) => void; onClose: () => void }) {
  const C = useTheme();
  const opts: { id: Method; icon: string; label: string; hint: string; color: string }[] = [
    { id: 'photo',  icon: 'cam',   label: 'Snap a receipt',    hint: 'AI reads everything in 2s',      color: C.sage },
    { id: 'image',  icon: 'image', label: 'Upload image',      hint: 'From your photo library',        color: C.plum },
    { id: 'voice',  icon: 'mic',   label: 'Say it out loud',   hint: '"Eight bucks at Blue Bottle"',   color: C.rose },
    { id: 'manual', icon: 'edit',  label: 'Enter manually',    hint: 'Old fashioned',                  color: C.muted },
  ];

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <View>
          <Text style={{ fontFamily: C.fonts.serif, fontSize: 28, color: C.cream, lineHeight: 30, letterSpacing: -0.3 }}>
            New <Text style={{ fontStyle: 'italic' }}>expense</Text>
          </Text>
          <Text style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>How did you pay?</Text>
        </View>
        <Tap onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={16} stroke={C.muted}/>
        </Tap>
      </View>

      <View style={{ gap: 8, marginTop: 8 }}>
        {opts.map(o => (
          <Tap key={o.id} onPress={() => onPick(o.id)} haptic style={{
            flexDirection: 'row', alignItems: 'center', gap: 14,
            padding: 16, borderRadius: 16,
            backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
          }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${o.color}2e`, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={o.icon} size={20} stroke={o.color} sw={1.6}/>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, color: C.cream, fontWeight: '500' }}>{o.label}</Text>
              <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{o.hint}</Text>
            </View>
            <Icon name="chev-r" size={16} stroke={C.subtle}/>
          </Tap>
        ))}
      </View>
    </View>
  );
}

// ── Scan ──────────────────────────────────────────────────────
function ScanPhase({ method }: { method: Method | null }) {
  const C = useTheme();
  const [step, setStep] = useState(0);
  const sweepY = useRef(new Animated.Value(0)).current;
  const dot0 = useRef(new Animated.Value(0.5)).current;
  const dot1 = useRef(new Animated.Value(0.5)).current;
  const dot2 = useRef(new Animated.Value(0.5)).current;

  const lines = ['Reading the receipt…', 'Identifying the merchant…', 'Categorizing items…', 'Almost done…'];

  useEffect(() => {
    const id = setInterval(() => setStep(s => Math.min(s + 1, lines.length - 1)), 750);
    Animated.loop(
      Animated.timing(sweepY, { toValue: 260, duration: 1600, useNativeDriver: true })
    ).start();
    [[dot0, 0], [dot1, 200], [dot2, 400]].forEach(([dot, delay]) => {
      Animated.loop(Animated.sequence([
        Animated.delay(delay as number),
        Animated.timing(dot as Animated.Value, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot as Animated.Value, { toValue: 0.5, duration: 300, useNativeDriver: true }),
      ])).start();
    });
    return () => clearInterval(id);
  }, []);

  return (
    <View style={{ paddingVertical: 20, alignItems: 'center', minHeight: 420 }}>
      {/* Receipt */}
      <View style={{ width: 200, height: 260, borderRadius: 6, backgroundColor: '#FAF8F2', overflow: 'hidden', marginBottom: 32, shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
        <View style={{ padding: 18, flex: 1 }}>
          <Text style={{ textAlign: 'center', fontWeight: '700', fontSize: 10, color: '#1F1B16', fontFamily: 'GeistMono_400Regular', marginBottom: 10 }}>BLUE BOTTLE</Text>
          <Text style={{ textAlign: 'center', fontSize: 8, color: '#7A746A', fontFamily: 'GeistMono_400Regular', marginBottom: 14 }}>2026-05-07</Text>
          {[['Oat latte', '5.75'], ['Tip', '1.00'], ['SUBTOTAL', '5.75'], ['TAX', '0.50'], ['TOTAL', '6.75']].map(([l, r], i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
              <Text style={{ fontSize: 9, color: '#1F1B16', fontFamily: 'GeistMono_400Regular' }}>{l}</Text>
              <Text style={{ fontSize: 9, color: '#1F1B16', fontFamily: 'GeistMono_400Regular' }}>{r}</Text>
            </View>
          ))}
        </View>
        {/* Scan sweep */}
        <Animated.View style={{
          position: 'absolute', left: 0, right: 0, height: 50,
          transform: [{ translateY: sweepY }],
          backgroundColor: `${C.sage}33`,
        }}/>
        {/* Corner brackets */}
        {[{t:0,l:0},{t:0,r:0},{b:0,l:0},{b:0,r:0}].map((pos, i) => (
          <View key={i} style={{ position: 'absolute', width: 16, height: 16, ...pos as any,
            borderTopWidth: pos.t === 0 ? 2 : 0, borderBottomWidth: (pos as any).b === 0 ? 2 : 0,
            borderLeftWidth: pos.l === 0 ? 2 : 0, borderRightWidth: (pos as any).r === 0 ? 2 : 0,
            borderColor: C.sage, borderRadius: 4,
          }}/>
        ))}
      </View>

      <Text style={{ fontFamily: C.fonts.serif, fontSize: 22, color: C.cream, textAlign: 'center', minHeight: 56 }}>
        {lines[step]}
      </Text>

      <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
        {[dot0, dot1, dot2].map((d, i) => (
          <Animated.View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.sage, opacity: d }}/>
        ))}
      </View>

      <Text style={{ marginTop: 18, fontSize: 11, color: C.subtle, letterSpacing: 0.06, textTransform: 'uppercase' }}>
        ✦ powered by tally intelligence
      </Text>
    </View>
  );
}

// ── Review ─────────────────────────────────────────────────────
function ReviewPhase({
  scanned, receiptUri, onSave, onClose, setSaveState, editExpense,
}: {
  scanned: ScannedExpense | null;
  receiptUri: string | null;
  onSave: () => void;
  onClose: () => void;
  setSaveState: (s: 'idle' | 'saving' | 'done') => void;
  editExpense?: Expense;
}) {
  const C = useTheme();
  const { categories, add: addCat, nextColor } = useCategories();
  const { add: addExpense, update: updateExpense } = useExpenses();

  const [merchant, setMerchant] = useState(scanned?.merchant ?? editExpense?.merchant ?? '');
  const [amount, setAmount] = useState(scanned?.amount?.toString() ?? editExpense?.amount?.toString() ?? '');

  // scanned.date comes from an AI scanning service and its exact shape is
  // ambiguous: it may be a date-only string ("2026-06-24") or a full
  // datetime/instant ("2026-06-24T14:30:00Z"). Date-only strings must be
  // treated as their literal calendar day (not reparsed as a UTC instant,
  // which would roll the day backward for negative-offset users). Full
  // datetimes are real instants, so their *local* calendar day is what
  // matters, same as the manual-entry path below via toLocalDateISO.
  // Stored expense dates are local-naive ISO ("2026-06-24T00:00:00"), which
  // the same regex matches correctly for pre-fill in edit mode.
  const scannedDateInfo = (() => {
    const raw = scanned?.date ?? editExpense?.date;
    if (!raw) return null;
    const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00)?$/);
    if (dateOnlyMatch) {
      const [, y, m, day] = dateOnlyMatch;
      return {
        iso: `${y}-${m}-${day}T00:00:00`,
        display: new Date(Number(y), Number(m) - 1, Number(day))
          .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      };
    }
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return {
      iso: toLocalDateISO(d),
      display: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };
  })();

  const [dateISO, setDateISO] = useState(scannedDateInfo?.iso ?? toLocalDateISO(new Date()));
  const [dateDisplay, setDateDisplay] = useState(
    scannedDateInfo?.display ?? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  );
  const [note, setNote] = useState(scanned?.note ?? editExpense?.note ?? '');
  const [selectedCatId, setSelectedCatId] = useState<string | null>(editExpense?.category_id ?? null);
  const [pendingNewCat, setPendingNewCat] = useState<{ id: string; name: string; color: string; isNew: boolean } | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorInitial, setEditorInitial] = useState<{ name?: string; color?: string } | undefined>();
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  useEffect(() => {
    if (scanned?.category) {
      const existing = categories.find(c => c.id.toLowerCase() === scanned.category.id.toLowerCase());
      if (existing) {
        setSelectedCatId(existing.id);
        setPendingNewCat(null);
      } else {
        setSelectedCatId(scanned.category.id);
        setPendingNewCat({
          id: scanned.category.id,
          name: scanned.category.name,
          color: scanned.category.suggestedColor ?? nextColor(),
          isNew: true,
        });
      }
    }
  }, [scanned]);

  const handleSave = async () => {
    setSaveState('saving');
    if (pendingNewCat && selectedCatId === pendingNewCat.id) {
      await addCat({ id: pendingNewCat.id, name: pendingNewCat.name, color: pendingNewCat.color, source: 'ai' });
    }
    if (editExpense) {
      await updateExpense(editExpense.id, {
        merchant: merchant || 'Unknown',
        category_id: selectedCatId ?? 'other',
        amount: parseFloat(amount) || 0,
        date: dateISO,
        note: note || null,
      });
    } else {
      await addExpense({
        id: uid(),
        merchant: merchant || 'Unknown',
        category_id: selectedCatId ?? 'other',
        amount: parseFloat(amount) || 0,
        currency: scanned?.currency ?? 'USD',
        date: dateISO,
        note: note || null,
        receipt_uri: receiptUri,
        confidence: scanned?.confidence ?? null,
      });
    }
    setSaveState('done');
    setTimeout(onSave, 1400);
  };

  const openNewCatEditor = (initial?: { name?: string; color?: string }) => {
    setEditorInitial(initial);
    setEditorVisible(true);
  };

  const handleEditorSave = async (name: string, color: string) => {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || `cat${Date.now()}`;
    if (pendingNewCat && editorInitial?.name === pendingNewCat.name) {
      setPendingNewCat({ id, name, color, isNew: true });
      setSelectedCatId(id);
    } else {
      setPendingNewCat({ id, name, color, isNew: true });
      setSelectedCatId(id);
    }
    setEditorVisible(false);
  };

  const visibleCats = categories.filter(c => !c.archived);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 560 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
          <Text style={{ fontFamily: C.fonts.serif, fontSize: 28, color: C.cream, lineHeight: 30, letterSpacing: -0.3 }}>
            {editExpense ? 'Edit ' : 'I read '}<Text style={{ fontStyle: 'italic' }}>{editExpense ? 'expense' : 'this'}</Text>
          </Text>
          <Tap onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={16} stroke={C.muted}/>
          </Tap>
        </View>
        <Text style={{ fontSize: 12, color: C.muted, marginBottom: 18 }}>
          {editExpense ? 'Edit any field.' : 'Tap any field to fix it.'}
          {!editExpense && scanned?.confidence != null && (
            <Text style={{ color: C.sage }}>{' '}✦ confidence {Math.round(scanned.confidence * 100)}%</Text>
          )}
        </Text>

        {/* Amount */}
        <Card style={{ padding: 20, marginBottom: 12 }}>
          <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>Amount</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 20 }}>
            <Text style={{ fontSize: 16, color: C.muted, lineHeight: 64 }}>$</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              style={{ fontFamily: C.fonts.serif, fontSize: 52, lineHeight: 64, color: C.cream, flex: 1 }}
              placeholderTextColor={C.muted}
              placeholder="0.00"
            />
            <Text style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>USD</Text>
          </View>
        </Card>

        {/* Details */}
        <Card style={{ overflow: 'hidden', marginBottom: 12 }}>
          <ReviewRow label="Merchant" value={merchant} onEdit={setMerchant}/>
          <ReviewRow label="Date" value={dateDisplay} onPress={() => setDatePickerVisible(true)}/>
          <ReviewRow label="Notes" value={note} onEdit={setNote} muted last/>
        </Card>

        {/* Category chips */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 8 }}>
            Category
            {pendingNewCat && selectedCatId === pendingNewCat.id && (
              <Text style={{ color: C.sage, textTransform: 'none', letterSpacing: 0 }}>{' · '}✦ AI suggested</Text>
            )}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 6, paddingBottom: 4 }}>
              {/* AI-suggested new category shown first */}
              {pendingNewCat && !visibleCats.find(c => c.id === pendingNewCat.id) && (
                <View style={{ position: 'relative' }}>
                  <CategoryChip
                    label={pendingNewCat.name}
                    color={pendingNewCat.color}
                    selected={selectedCatId === pendingNewCat.id}
                    aiSuggested
                    onPress={() => {
                      if (selectedCatId === pendingNewCat.id) {
                        openNewCatEditor({ name: pendingNewCat.name, color: pendingNewCat.color });
                      } else {
                        setSelectedCatId(pendingNewCat.id);
                      }
                    }}
                  />
                </View>
              )}

              {visibleCats.map(cat => (
                <CategoryChip
                  key={cat.id}
                  label={cat.name}
                  color={cat.color}
                  selected={selectedCatId === cat.id}
                  onPress={() => setSelectedCatId(cat.id)}
                />
              ))}

              <NewCategoryChip onPress={() => openNewCatEditor()}/>
            </View>
          </ScrollView>
        </View>

        {/* Save */}
        <Tap onPress={handleSave} haptic style={{ marginBottom: 8 }}>
          <LinearGradient
            colors={[C.sage, C.sageDeep]}
            start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
            style={{ height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Icon name="check" size={18} stroke="#0E0E0C" sw={2.2}/>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#0E0E0C' }}>{editExpense ? 'Update expense' : 'Save expense'}</Text>
          </LinearGradient>
        </Tap>
      </ScrollView>

      <CategoryEditor
        visible={editorVisible}
        initial={editorInitial}
        onSave={handleEditorSave}
        onCancel={() => setEditorVisible(false)}
      />

      <DatePicker
        visible={datePickerVisible}
        value={new Date(dateISO)}
        onSelect={(d) => {
          setDateISO(toLocalDateISO(d));
          setDateDisplay(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
        }}
        onClose={() => setDatePickerVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

function ReviewRow({ label, value, onEdit, onPress, muted, last }: { label: string; value: string; onEdit?: (v: string) => void; onPress?: () => void; muted?: boolean; last?: boolean }) {
  const C = useTheme();
  const [editing, setEditing] = useState(false);

  return (
    <TouchableOpacity onPress={() => (onPress ? onPress() : setEditing(true))} style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 14, paddingHorizontal: 16,
      borderBottomWidth: last ? 0 : 0.5, borderBottomColor: C.hair,
    }}>
      <Text style={{ fontSize: 13, color: C.muted }}>{label}</Text>
      {editing && onEdit && !onPress ? (
        <TextInput
          value={value}
          onChangeText={onEdit}
          onBlur={() => setEditing(false)}
          autoFocus
          style={{ fontSize: 14, color: C.cream, textAlign: 'right', minWidth: 120 }}
        />
      ) : (
        <Text style={{ fontSize: 14, color: muted ? C.muted : C.cream }}>{value || '—'}</Text>
      )}
    </TouchableOpacity>
  );
}
