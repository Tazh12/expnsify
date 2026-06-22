import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  Animated, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import Svg, { Path, Rect, Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { useTheme } from '../theme';
import { Icon, Card, Tap, CategoryChip, NewCategoryChip } from '../components';
import { CategoryEditor } from '../components/CategoryEditor';
import { useCategories } from '../store/useCategories';
import { useExpenses } from '../store/useExpenses';
import { scanImage, scanText, transcribeAudio, type ScannedExpense } from '../services/groq';
import { uid } from '../services/format';

type Phase = 'pick' | 'scan' | 'review';
type Method = 'photo' | 'image' | 'voice' | 'manual';

interface AddSheetProps {
  open: boolean;
  onClose: () => void;
}

export function AddSheet({ open, onClose }: AddSheetProps) {
  const [phase, setPhase] = useState<Phase>('pick');
  const [method, setMethod] = useState<Method | null>(null);
  const [scanned, setScanned] = useState<ScannedExpense | null>(null);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  const slideY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (open) {
      setPhase('pick');
      setMethod(null);
      setScanned(null);
      setReceiptUri(null);
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 2 }).start();
    } else {
      Animated.timing(slideY, { toValue: 600, duration: 280, useNativeDriver: true }).start();
    }
  }, [open]);

  const goReview = (data: ScannedExpense | null, uri?: string) => {
    setScanned(data);
    if (uri) setReceiptUri(uri);
    setPhase('review');
  };

  const startScan = async (m: Method) => {
    setMethod(m);
    setPhase('scan');

    if (m === 'photo' || m === 'image') {
      const result = m === 'photo'
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });

      if (result.canceled || !result.assets[0].base64) {
        setPhase('review');
        return;
      }
      const asset = result.assets[0];
      const savedUri = FileSystem.cacheDirectory + `receipt-${uid()}.jpg`;
      await FileSystem.copyAsync({ from: asset.uri, to: savedUri });

      const { categories } = useCategories.getState();
      const data = await scanImage(asset.base64!, categories);
      goReview(data, savedUri);

    } else if (m === 'voice') {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') { setPhase('pick'); return; }

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
  };

  if (!open) return null;

  return (
    <Modal visible={open} transparent animationType="none">
      {/* Backdrop */}
      <BlurView intensity={40} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
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
          <BlurView intensity={90} tint="dark" style={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(244,239,230,0.13)', alignSelf: 'center', marginBottom: 16 }}/>
            {phase === 'pick' && <PickPhase onPick={startScan} onClose={onClose}/>}
            {phase === 'scan' && <ScanPhase method={method}/>}
            {phase === 'review' && (
              <ReviewPhase
                scanned={scanned}
                receiptUri={receiptUri}
                onSave={onClose}
                onClose={onClose}
              />
            )}
          </BlurView>
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
  scanned, receiptUri, onSave, onClose,
}: {
  scanned: ScannedExpense | null;
  receiptUri: string | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const C = useTheme();
  const { categories, add: addCat, nextColor } = useCategories();
  const { add: addExpense } = useExpenses();

  const [merchant, setMerchant] = useState(scanned?.merchant ?? '');
  const [amount, setAmount] = useState(scanned?.amount?.toString() ?? '');
  const [date, setDate] = useState(scanned?.date ? new Date(scanned.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  const [note, setNote] = useState(scanned?.note ?? '');
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [pendingNewCat, setPendingNewCat] = useState<{ id: string; name: string; color: string; isNew: boolean } | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorInitial, setEditorInitial] = useState<{ name?: string; color?: string } | undefined>();

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
    if (pendingNewCat && selectedCatId === pendingNewCat.id) {
      await addCat({ id: pendingNewCat.id, name: pendingNewCat.name, color: pendingNewCat.color, source: 'ai' });
    }
    await addExpense({
      id: uid(),
      merchant: merchant || 'Unknown',
      category_id: selectedCatId ?? 'other',
      amount: parseFloat(amount) || 0,
      currency: scanned?.currency ?? 'USD',
      date: new Date().toISOString(),
      note: note || null,
      receipt_uri: receiptUri,
      confidence: scanned?.confidence ?? null,
    });
    onSave();
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
            I read <Text style={{ fontStyle: 'italic' }}>this</Text>
          </Text>
          <Tap onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={16} stroke={C.muted}/>
          </Tap>
        </View>
        <Text style={{ fontSize: 12, color: C.muted, marginBottom: 18 }}>
          Tap any field to fix it.
          {scanned?.confidence != null && (
            <Text style={{ color: C.sage }}>{' '}✦ confidence {Math.round(scanned.confidence * 100)}%</Text>
          )}
        </Text>

        {/* Amount */}
        <Card style={{ padding: 20, marginBottom: 12 }}>
          <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>Amount</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 4 }}>
            <Text style={{ fontSize: 16, color: C.muted, lineHeight: 52 }}>$</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              style={{ fontFamily: C.fonts.serif, fontSize: 52, lineHeight: 52, color: C.cream, flex: 1 }}
              placeholderTextColor={C.muted}
              placeholder="0.00"
            />
            <Text style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>USD</Text>
          </View>
        </Card>

        {/* Details */}
        <Card style={{ overflow: 'hidden', marginBottom: 12 }}>
          <ReviewRow label="Merchant" value={merchant} onEdit={setMerchant}/>
          <ReviewRow label="Date" value={date} onEdit={setDate}/>
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
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#0E0E0C' }}>Save expense</Text>
          </LinearGradient>
        </Tap>
      </ScrollView>

      <CategoryEditor
        visible={editorVisible}
        initial={editorInitial}
        onSave={handleEditorSave}
        onCancel={() => setEditorVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

function ReviewRow({ label, value, onEdit, muted, last }: { label: string; value: string; onEdit?: (v: string) => void; muted?: boolean; last?: boolean }) {
  const C = useTheme();
  const [editing, setEditing] = useState(false);

  return (
    <TouchableOpacity onPress={() => setEditing(true)} style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 14, paddingHorizontal: 16,
      borderBottomWidth: last ? 0 : 0.5, borderBottomColor: C.hair,
    }}>
      <Text style={{ fontSize: 13, color: C.muted }}>{label}</Text>
      {editing && onEdit ? (
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
