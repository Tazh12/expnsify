import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, Pressable, ScrollView, Image,
  Animated, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { useTheme } from '../theme';
import { Icon, Card, Tap, CategoryChip } from '../components';
import { DatePicker } from '../components/DatePicker';
import { useCategories } from '../store/useCategories';
import { useExpenses, type Expense, type TxnSource } from '../store/useExpenses';
import { useBudget } from '../store/useBudget';
import { useBudgetGroups } from '../store/useBudgetGroups';
import { useSettings } from '../store/useSettings';
import { useRates, FRANKFURTER_CURRENCIES } from '../store/useRates';
import { useAuth } from '../store/useAuth';
import { scanImage, scanText, scanPdf, transcribeAudio, type ScannedExpense } from '../services/groq';
import { uid, fmt, currencySymbol, parseLocalDate, toLocalDateISO } from '../services/format';
import { CurrencyPickerSheet } from '../components/CurrencyPicker';
import { CompletePaymentSheet } from './CompletePaymentSheet';
import { matchLine } from '../services/budget';
import { monthKey, expenseMonthKey } from '../services/month';
import { uploadReceipt } from '../services/receipts';
import { RECEIPT_STORAGE_ENABLED, resolveReceiptUriToPersist } from '../services/receiptUri';
import { DEFAULT_CATEGORIES } from '../store/defaults';
import type { BudgetLine, SectionMeta } from '../store/budgetTypes';

const GENERAL_VARIABLE_IDS = ['groceries', 'coffee', 'dining', 'transport', 'travel', 'home', 'software', 'health'] as const;
const PICKER_SECTION_ORDER = ['bills', 'variable', 'investments'] as const;

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function spendLines(lines: BudgetLine[]): BudgetLine[] {
  return lines.filter(l => l.section !== 'income');
}

function preferUnpaid(lines: BudgetLine[]): BudgetLine[] {
  return lines.slice().sort((a, b) => {
    if (a.paid !== b.paid) return a.paid ? 1 : -1;
    return (a.sortOrder - b.sortOrder) || (a.dueDay ?? 99) - (b.dueDay ?? 99) || a.name.localeCompare(b.name);
  });
}

function uniqueByTemplate(lines: BudgetLine[]): BudgetLine[] {
  const seen = new Set<string>();
  const out: BudgetLine[] = [];
  for (const line of preferUnpaid(lines)) {
    const key = line.templateKey || normName(line.name) || line.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

function matchGeneralLine(cat: { id: string; name: string }, lines: BudgetLine[]): BudgetLine | undefined {
  const spend = spendLines(lines);
  const n = normName(cat.name);
  const pred = (l: BudgetLine) => l.templateKey === cat.id || normName(l.name) === n;
  const vars = spend.filter(l => l.section === 'variable');
  return preferUnpaid(vars.filter(pred))[0] ?? preferUnpaid(spend.filter(pred))[0];
}

function initialSpendLineId(
  editExpense: Expense | undefined,
  matchedLine: BudgetLine | null,
  scannedLineId: string | null | undefined,
): string | null {
  const id = editExpense?.line_id ?? matchedLine?.id ?? scannedLineId ?? null;
  if (!id) return null;
  if (editExpense?.type === 'income') return id;
  const line = matchedLine?.id === id
    ? matchedLine
    : useBudget.getState().lines.find(l => l.id === id);
  if (line?.section === 'income') return null;
  return id;
}

type Phase = 'pick' | 'coach' | 'scan' | 'review';
type Method = 'photo' | 'image' | 'voice' | 'file' | 'manual';

async function uriToBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web' || uri.startsWith('blob:') || uri.startsWith('data:')) {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

async function readTextFile(uri: string): Promise<string> {
  if (Platform.OS === 'web' || uri.startsWith('blob:') || uri.startsWith('data:')) {
    const res = await fetch(uri);
    return await res.text();
  }
  return FileSystem.readAsStringAsync(uri);
}

function guessMime(uri: string, name?: string): string {
  const lower = `${name ?? ''} ${uri}`.toLowerCase();
  if (lower.includes('.pdf')) return 'application/pdf';
  if (lower.includes('.eml') || lower.includes('.msg')) return 'message/rfc822';
  if (lower.includes('.html')) return 'text/html';
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.heic')) return 'image/heic';
  if (/\.jpe?g/.test(lower)) return 'image/jpeg';
  return 'application/pdf';
}

function emailToPlain(raw: string): string {
  let body = raw.replace(/\r\n/g, '\n');
  const headerBreak = body.search(/\n\n/);
  if (headerBreak >= 0) body = body.slice(headerBreak + 2);
  body = body.replace(/=\n/g, '');
  body = body.replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  body = body.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  body = body.replace(/<[^>]+>/g, ' ');
  return body.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

interface AddSheetProps {
  open: boolean;
  onClose: () => void;
  editExpense?: Expense;
  pendingShare?: { uri: string; mimeType?: string } | null;
}

export function AddSheet({ open, onClose, editExpense, pendingShare }: AddSheetProps) {
  const C = useTheme();
  const [phase, setPhase] = useState<Phase>('pick');
  const [method, setMethod] = useState<Method | null>(null);
  const [scanned, setScanned] = useState<ScannedExpense | null>(null);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [completeOpen, setCompleteOpen] = useState(false);
  const [matchedLine, setMatchedLine] = useState<BudgetLine | null>(null);

  const slideY = useRef(new Animated.Value(600)).current;
  const doneScale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (open) {
      setPhase(editExpense ? 'review' : 'pick');
      setMethod(null);
      setScanned(null);
      setReceiptUri(null);
      setSaveState('idle');
      setCompleteOpen(false);
      setMatchedLine(null);
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 2 }).start();
    } else {
      Animated.timing(slideY, { toValue: 600, duration: 280, useNativeDriver: true }).start();
    }
  }, [open]);

  useEffect(() => {
    if (open && pendingShare?.uri) {
      ingestFile(pendingShare.uri, pendingShare.mimeType ?? 'application/pdf', 'share').catch(() => {
        failScan('Could not process that file. Please try again.');
      });
    }
  }, [open, pendingShare?.uri]);

  useEffect(() => {
    if (saveState === 'done') Animated.spring(doneScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 12 }).start();
    else doneScale.setValue(0.6);
  }, [saveState]);

  const failScan = (
    message = 'Could not read that receipt. Try again, or enter it manually.',
    title = 'Could not read that receipt',
  ) => {
    Alert.alert(title, message);
    setPhase('pick');
  };

  const goReview = (data: ScannedExpense | null, uri?: string, src: TxnSource = 'manual') => {
    setScanned(data);
    if (uri) setReceiptUri(uri);
    const monthLines = useBudget.getState().forMonth(monthKey(new Date()));
    const match = data
      ? (data.lineId ? monthLines.find(l => l.id === data.lineId) ?? null : null)
        ?? matchLine(data.merchant, data.amount, data.date, monthLines)?.line ?? null
      : null;
    setMatchedLine(match);
    if (data?.isPaymentConfirmation && match && !editExpense) {
      setCompleteOpen(true);
      setPhase('review');
      setMethod((src as Method) ?? method);
      return;
    }
    setPhase('review');
  };

  const ingestFile = async (uri: string, mimeType: string, src: TxnSource) => {
    setPhase('scan');
    const { categories } = useCategories.getState();
    const lines = useBudget.getState().forMonth(monthKey(new Date()));
    const mime = (mimeType || '').toLowerCase();
    const lower = uri.toLowerCase();
    const isPdf = mime.includes('pdf') || lower.endsWith('.pdf');
    const isEmail = mime.includes('rfc822') || mime.includes('html') || mime.startsWith('text/')
      || /\.(eml|html?|txt|msg)$/i.test(lower);
    if (isPdf) {
      const base64 = await uriToBase64(uri);
      const data = await scanPdf(base64, categories, lines);
      if (!data) { failScan('Could not read that PDF. Try a screenshot of the confirmation.'); return; }
      goReview(data, uri, src);
      return;
    }
    if (isEmail) {
      const raw = await readTextFile(uri);
      const data = await scanText(emailToPlain(raw), categories, lines);
      if (!data) { failScan('Could not read that email. Try a PDF or screenshot.'); return; }
      goReview(data, undefined, src);
      return;
    }
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    const base64 = manipulated.base64
      ?? await FileSystem.readAsStringAsync(manipulated.uri, { encoding: FileSystem.EncodingType.Base64 });
    const data = await scanImage(base64, categories, 'image/jpeg', lines);
    if (!data) { failScan(); return; }
    goReview(data, manipulated.uri, src);
  };

  const startScan = async (m: Method) => {
    if (m === 'voice') {
      setMethod(m);
      setPhase('coach');
      return;
    }
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
          ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5, mediaTypes: ['images'] })
          : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5, mediaTypes: ['images'] });

        if (result.canceled || !result.assets[0]) return;
        setPhase('scan');
        const asset = result.assets[0];
        const manipulated = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );
        const base64 = manipulated.base64
          ?? await FileSystem.readAsStringAsync(manipulated.uri, { encoding: FileSystem.EncodingType.Base64 });
        const { categories } = useCategories.getState();
        const lines = useBudget.getState().forMonth(monthKey(new Date()));
        const data = await scanImage(base64, categories, 'image/jpeg', lines);
        if (!data) { failScan(); return; }
        goReview(data, manipulated.uri, 'photo');
      } else if (m === 'file') {
        const result = await DocumentPicker.getDocumentAsync({
          type: [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/heic',
            'image/webp',
            'message/rfc822',
            'text/html',
            'text/plain',
          ],
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        await ingestFile(asset.uri, asset.mimeType ?? guessMime(asset.uri, asset.name), 'pdf');
      } else {
        goReview(null);
      }
    } catch (e) {
      console.error('startScan error', e);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes('simulator') || msg.toLowerCase().includes('not available')) {
        Alert.alert('Camera unavailable', 'The camera does not work in the simulator. Test on a real iPhone.');
      } else {
        Alert.alert('Something went wrong', 'Could not process the file. Please try again.');
      }
      setPhase('pick');
    }
  };

  const startVoice = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Microphone access needed', 'Please enable microphone access in Settings to log spending by voice.');
        setPhase('pick');
        return;
      }
      setPhase('scan');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      await new Promise(r => setTimeout(r, 5000));
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch (e) {
        console.error('audio mode reset', e);
      }
      if (!uri) { failScan('No audio was captured. Please try again.', 'Could not record'); return; }
      const text = await transcribeAudio(uri);
      if (!text) { failScan('Could not hear that. Please try again, or enter it manually.', 'Could not record'); return; }
      const { categories } = useCategories.getState();
      const lines = useBudget.getState().forMonth(monthKey(new Date()));
      const data = await scanText(text, categories, lines);
      if (!data) { failScan(); return; }
      goReview(data, undefined, 'voice');
    } catch (e) {
      console.error('voice error', e);
      const detail = e instanceof Error ? e.message.split('\n')[0] : 'Please try again.';
      failScan(detail, 'Could not record');
    }
  };

  const markPaid = async () => {
    if (!matchedLine || !scanned) return;
    setSaveState('saving');
    const { user } = useAuth.getState();
    let uri = receiptUri;
    if (uri && RECEIPT_STORAGE_ENABLED) {
      uri = await uploadReceipt(uri, user?.uid, method === 'file' ? 'application/pdf' : 'image/jpeg');
    } else {
      uri = resolveReceiptUriToPersist(uri);
    }
    await useExpenses.getState().add({
      id: uid(),
      merchant: scanned.merchant || matchedLine.name,
      category_id: matchedLine.templateKey,
      amount: scanned.amount || matchedLine.expected,
      currency: scanned.currency || matchedLine.currency,
      date: scanned.date ? toLocalDateISO(parseLocalDate(scanned.date)) : toLocalDateISO(new Date()),
      note: scanned.note,
      receipt_uri: uri,
      confidence: scanned.confidence ?? null,
      line_id: matchedLine.id,
      type: matchedLine.section === 'income' ? 'income' : 'expense',
      unbudgeted: false,
      source: method === 'file' ? 'pdf' : method === 'voice' ? 'voice' : 'photo',
    });
    await useBudget.getState().update(matchedLine.id, {
      paid: true,
      paidAt: new Date().toISOString(),
      paidSource: 'receipt',
    });
    setCompleteOpen(false);
    setSaveState('done');
    setTimeout(onClose, 1400);
  };

  if (!open) return null;

  return (
    <Modal visible={open} transparent animationType="none">
      <BlurView intensity={40} tint={C.isLight ? 'light' : 'dark'} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1}/>
      </BlurView>

      <Animated.View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        transform: [{ translateY: slideY }],
      }}>
        <View style={{ borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' }}>
          <BlurView intensity={90} tint={C.isLight ? 'light' : 'dark'} style={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.hair, alignSelf: 'center', marginBottom: 16 }}/>
            {phase === 'pick' && <PickPhase onPick={startScan} onClose={onClose} onDropFile={(uri, mime) => ingestFile(uri, mime, 'share')}/>}
            {phase === 'coach' && <VoiceCoach onStart={startVoice} onClose={() => setPhase('pick')}/>}
            {phase === 'scan' && <ScanPhase method={method}/>}
            {phase === 'review' && !completeOpen && (
              <ReviewPhase
                scanned={scanned}
                receiptUri={receiptUri}
                matchedLine={matchedLine}
                method={method}
                onSave={onClose}
                onClose={onClose}
                setSaveState={setSaveState}
                editExpense={editExpense}
              />
            )}
          </BlurView>

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
                    {completeOpen || matchedLine?.paid ? 'Marked ' : 'Logged '}
                    <Text style={{ fontStyle: 'italic' }}>{editExpense ? 'updated' : 'it'}</Text>
                  </Text>
                </Animated.View>
              )}
            </View>
          )}
        </View>
      </Animated.View>

      <CompletePaymentSheet
        open={completeOpen}
        line={matchedLine}
        scanned={scanned}
        preferredCurrency={useSettings.getState().preferredCurrency}
        onConfirm={markPaid}
        onEdit={() => setCompleteOpen(false)}
        onClose={() => { setCompleteOpen(false); onClose(); }}
      />
    </Modal>
  );
}

function PickPhase({
  onPick, onClose, onDropFile,
}: {
  onPick: (m: Method) => void;
  onClose: () => void;
  onDropFile: (uri: string, mime: string) => void;
}) {
  const C = useTheme();
  const opts: { id: Method; icon: string; label: string; hint: string; color: string }[] = [
    { id: 'photo',  icon: 'cam',   label: 'Snap a receipt',     hint: 'AI reads it in seconds',           color: C.sage },
    { id: 'image',  icon: 'image', label: 'Upload image',       hint: 'From your photo library',          color: C.plum },
    { id: 'file',   icon: 'doc',   label: 'Share a PDF / email', hint: 'PDF, confirmation email, or screenshot', color: C.sky },
    { id: 'voice',  icon: 'mic',   label: 'Say it out loud',    hint: 'Merchant, amount, budget line',    color: C.rose },
    { id: 'manual', icon: 'edit',  label: 'Enter manually',     hint: 'Old fashioned',                    color: C.muted },
  ];

  const dropProps = Platform.OS === 'web' ? {
    onDragOver: (e: { preventDefault: () => void }) => e.preventDefault(),
    onDrop: (e: { preventDefault: () => void; dataTransfer?: { files?: FileList } }) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const uri = URL.createObjectURL(file);
      onDropFile(uri, file.type || 'application/pdf');
    },
  } : {};

  return (
    <View {...dropProps as object}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <View>
          <Text style={{ fontFamily: C.fonts.serif, fontSize: 28, color: C.cream, lineHeight: 30, letterSpacing: -0.3 }}>
            Log <Text style={{ fontStyle: 'italic' }}>money</Text>
          </Text>
          <Text style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
            {Platform.OS === 'web' ? 'Type, upload, or drop a receipt here' : 'How do you want to capture it?'}
          </Text>
        </View>
        <Tap onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={16} stroke={C.muted}/>
        </Tap>
      </View>

      {!RECEIPT_STORAGE_ENABLED && (
        <View style={{
          marginBottom: 12, padding: 12, borderRadius: 14,
          backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
        }}>
          <Text style={{ fontSize: 13, color: C.muted, lineHeight: 18 }}>
            I can read a photo or PDF to fill the expense. The file itself won't be stored.
          </Text>
        </View>
      )}

      <View style={{ gap: 8, marginTop: 8 }}>
        {opts.filter(o => !(Platform.OS === 'web' && o.id === 'photo')).map(o => (
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

function VoiceCoach({ onStart, onClose }: { onStart: () => void; onClose: () => void }) {
  const C = useTheme();
  return (
    <View style={{ paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <Text style={{ fontFamily: C.fonts.serif, fontSize: 28, color: C.cream, letterSpacing: -0.3 }}>
          Say three <Text style={{ fontStyle: 'italic' }}>things</Text>
        </Text>
        <Tap onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={16} stroke={C.muted}/>
        </Tap>
      </View>
      <View style={{ gap: 10, marginBottom: 22 }}>
        {[
          'The merchant — “Whole Foods”',
          'The amount — “84 dollars”',
          'The budget line — “groceries”',
        ].map((t, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{
              width: 28, height: 28, borderRadius: 10, backgroundColor: C.sageGlow,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 13, color: C.sage, fontWeight: '600' }}>{i + 1}</Text>
            </View>
            <Text style={{ fontSize: 15, color: C.cream, flex: 1 }}>{t}</Text>
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 13, color: C.muted, marginBottom: 18, lineHeight: 18 }}>
        Or: “Paid internet 80” — we’ll mark that bill complete.
      </Text>
      <Tap onPress={onStart} haptic>
        <LinearGradient
          colors={[C.sage, C.sageDeep]}
          start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
          style={{ height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Icon name="mic" size={18} stroke="#0E0E0C" sw={2}/>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#0E0E0C' }}>Start 5-second take</Text>
        </LinearGradient>
      </Tap>
    </View>
  );
}

function ScanPhase({ method }: { method: Method | null }) {
  const C = useTheme();
  const [step, setStep] = useState(0);
  const lines = method === 'voice'
    ? ['Listening…', 'Picking up the amount…', 'Matching your budget…']
    : ['Reading the receipt…', 'Matching a budget line…', 'Almost done…'];

  useEffect(() => {
    const id = setInterval(() => setStep(s => Math.min(s + 1, lines.length - 1)), 750);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={{ paddingVertical: 40, alignItems: 'center', minHeight: 280 }}>
      <Text style={{ fontFamily: C.fonts.serif, fontSize: 22, color: C.cream, textAlign: 'center' }}>
        {lines[step]}
      </Text>
      <Text style={{ marginTop: 18, fontSize: 11, color: C.subtle, letterSpacing: 0.06, textTransform: 'uppercase' }}>
        ✦ powered by tally intelligence
      </Text>
    </View>
  );
}

function ReviewPhase({
  scanned, receiptUri, matchedLine, method, onSave, onClose, setSaveState, editExpense,
}: {
  scanned: ScannedExpense | null;
  receiptUri: string | null;
  matchedLine: BudgetLine | null;
  method: Method | null;
  onSave: () => void;
  onClose: () => void;
  setSaveState: (s: 'idle' | 'saving' | 'done') => void;
  editExpense?: Expense;
}) {
  const C = useTheme();
  const { add: addExpense, update: updateExpense } = useExpenses();
  const budget = useBudget();
  const { preferredCurrency } = useSettings.getState();
  const { convert } = useRates.getState();
  const { user } = useAuth();

  const [currencyCode, setCurrencyCode] = useState(() => {
    const scannedCurrency = scanned?.currency;
    if (scannedCurrency && (FRANKFURTER_CURRENCIES as readonly string[]).includes(scannedCurrency)) {
      return scannedCurrency;
    }
    return editExpense?.currency ?? preferredCurrency;
  });
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [merchant, setMerchant] = useState(scanned?.merchant ?? editExpense?.merchant ?? '');
  const [amount, setAmount] = useState(scanned?.amount?.toString() ?? editExpense?.amount?.toString() ?? '');

  const scannedDateInfo = (() => {
    const raw = scanned?.date ?? editExpense?.date;
    if (!raw) return null;
    const d = parseLocalDate(raw);
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
  const [selectedLineId, setSelectedLineId] = useState<string | null>(
    () => initialSpendLineId(editExpense, matchedLine, scanned?.lineId)
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(() => {
    if (editExpense && !editExpense.line_id && editExpense.category_id && editExpense.category_id !== 'other') {
      return editExpense.category_id;
    }
    return null;
  });
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [txnType, setTxnType] = useState<'expense' | 'income'>(editExpense?.type ?? 'expense');

  const monthLines = budget.forMonth(expenseMonthKey(dateISO) || monthKey(new Date()));
  const selectedLine = monthLines.find(l => l.id === selectedLineId) ?? null;
  const overspend = !!(selectedLine && selectedLine.section !== 'income' && (parseFloat(amount) || 0) + 0 > selectedLine.expected);

  useEffect(() => {
    if (selectedLine?.section === 'income') setTxnType('income');
  }, [selectedLineId]);

  const handleSave = async () => {
    setSaveState('saving');
    const line = monthLines.find(l => l.id === selectedLineId) ?? null;
    const unbudgeted = !line && txnType === 'expense';
    let storedUri: string | null = null;
    if (receiptUri && !editExpense && RECEIPT_STORAGE_ENABLED) {
      storedUri = await uploadReceipt(receiptUri, user?.uid, method === 'file' ? 'application/pdf' : 'image/jpeg');
    }
    const source: TxnSource = method === 'voice' ? 'voice' : method === 'file' ? 'pdf' : method === 'photo' || method === 'image' ? 'photo' : 'manual';
    const payload = {
      merchant: merchant || 'Unknown',
      category_id: line?.templateKey ?? selectedCategoryId ?? editExpense?.category_id ?? 'other',
      amount: parseFloat(amount) || 0,
      currency: currencyCode,
      date: dateISO,
      note: note || null,
      line_id: line?.id ?? null,
      type: (line?.section === 'income' ? 'income' : txnType) as 'expense' | 'income',
      unbudgeted,
      source,
    };
    if (editExpense) {
      await updateExpense(editExpense.id, payload);
    } else {
      await addExpense({
        id: uid(),
        ...payload,
        receipt_uri: storedUri,
        confidence: scanned?.confidence ?? null,
      });
    }
    setSaveState('done');
    setTimeout(onSave, 1400);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 560 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
          <Text style={{ fontFamily: C.fonts.serif, fontSize: 28, color: C.cream, lineHeight: 30, letterSpacing: -0.3 }}>
            {editExpense ? 'Edit ' : 'I read '}<Text style={{ fontStyle: 'italic' }}>{editExpense ? 'this' : 'this'}</Text>
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

        {receiptUri && (
          <View style={{
            marginBottom: 12, padding: 10, borderRadius: 16,
            backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
          }}>
            {!(method === 'file' || receiptUri.toLowerCase().includes('.pdf')) && (
              <Image
                source={{ uri: receiptUri }}
                style={{ width: '100%', height: 148, borderRadius: 12, marginBottom: 10, backgroundColor: C.surface2 }}
                resizeMode="cover"
              />
            )}
            <Text style={{ fontSize: 13, color: C.muted, lineHeight: 18, paddingHorizontal: 4, paddingBottom: 2 }}>
              {RECEIPT_STORAGE_ENABLED
                ? 'This file will be saved with the expense.'
                : method === 'file' || receiptUri.toLowerCase().includes('.pdf')
                  ? "I used this file to fill the fields. It won't be stored."
                  : "I used this photo to fill the fields. The image won't be stored."}
            </Text>
          </View>
        )}

        {(!selectedLineId || overspend) && txnType === 'expense' && (
          <View style={{
            marginBottom: 12, padding: 12, borderRadius: 14,
            backgroundColor: `${C.rose}18`, borderWidth: 0.5, borderColor: C.rose,
          }}>
            <Text style={{ fontSize: 13, color: C.rose }}>
              {!selectedLineId
                ? 'This is not on the budget. Pick a line or it stays red.'
                : 'This would go over what you budgeted for that line.'}
            </Text>
          </View>
        )}

        <Card style={{ padding: 20, marginBottom: 12 }}>
          <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>Amount</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 20 }}>
            <Text style={{ fontSize: 16, color: C.muted, lineHeight: 64 }}>
              {currencySymbol(currencyCode)}
            </Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              style={{ fontFamily: C.fonts.serif, fontSize: 52, lineHeight: 64, color: C.cream, flex: 1 }}
              placeholderTextColor={C.muted}
              placeholder="0.00"
            />
            <Tap onPress={() => setCurrencyPickerOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 8 }}>
              <Text style={{ fontSize: 13, color: C.muted }}>{currencyCode}</Text>
              <Icon name="chev-r" size={11} stroke={C.muted}/>
            </Tap>
          </View>
          {currencyCode !== preferredCurrency && !!amount && parseFloat(amount) > 0 && (
            <Text style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
              ≈ {fmt(convert(parseFloat(amount) || 0, currencyCode), preferredCurrency)}
            </Text>
          )}
        </Card>

        <Card style={{ overflow: 'hidden', marginBottom: 12 }}>
          <ReviewRow label="Merchant" value={merchant} onEdit={setMerchant}/>
          <ReviewRow label="Date" value={dateDisplay} onPress={() => setDatePickerVisible(true)}/>
          <ReviewRow label="Notes" value={note} onEdit={setNote} muted last/>
        </Card>

        <BudgetLinePicker
          monthLines={monthLines}
          selectedLineId={selectedLineId}
          selectedCategoryId={selectedCategoryId}
          matchedLineId={matchedLine?.id ?? scanned?.lineId ?? null}
          onSelectUnbudgeted={() => {
            setSelectedLineId(null);
            setSelectedCategoryId(null);
          }}
          onSelectCategory={(cat, line) => {
            setSelectedLineId(line?.id ?? null);
            setSelectedCategoryId(cat.id);
          }}
          onSelectLine={(line) => {
            setSelectedLineId(line.id);
            setSelectedCategoryId(null);
          }}
        />

        <Tap onPress={handleSave} haptic style={{ marginBottom: 8 }}>
          <LinearGradient
            colors={[C.sage, C.sageDeep]}
            start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
            style={{ height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Icon name="check" size={18} stroke="#0E0E0C" sw={2.2}/>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#0E0E0C' }}>
              {editExpense ? 'Update' : selectedLineId ? 'Save to budget' : 'Save unbudgeted'}
            </Text>
          </LinearGradient>
        </Tap>
      </ScrollView>

      <DatePicker
        visible={datePickerVisible}
        value={parseLocalDate(dateISO)}
        onSelect={(d) => {
          setDateISO(toLocalDateISO(d));
          setDateDisplay(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
        }}
        onClose={() => setDatePickerVisible(false)}
      />

      <CurrencyPickerSheet
        visible={currencyPickerOpen}
        current={currencyCode}
        onSelect={setCurrencyCode}
        onClose={() => setCurrencyPickerOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

function BudgetLinePicker({
  monthLines, selectedLineId, selectedCategoryId, matchedLineId,
  onSelectUnbudgeted, onSelectCategory, onSelectLine,
}: {
  monthLines: BudgetLine[];
  selectedLineId: string | null;
  selectedCategoryId: string | null;
  matchedLineId: string | null;
  onSelectUnbudgeted: () => void;
  onSelectCategory: (cat: { id: string; name: string }, line?: BudgetLine) => void;
  onSelectLine: (line: BudgetLine) => void;
}) {
  const C = useTheme();
  const { categories } = useCategories();
  const allMeta = useBudgetGroups(s => s.all);
  const [moreOpen, setMoreOpen] = useState(false);

  const generalCats = useMemo(() => (
    GENERAL_VARIABLE_IDS.map(id => {
      const live = categories.find(c => c.id === id && !c.archived);
      const fallback = DEFAULT_CATEGORIES.find(c => c.id === id)!;
      return live ?? fallback;
    })
  ), [categories]);

  const selectedLine = monthLines.find(l => l.id === selectedLineId) ?? null;
  const extraSelected = selectedLine && selectedLine.section !== 'income' && !generalCats.some(cat => {
    const match = matchGeneralLine(cat, monthLines);
    return !!match && (match.id === selectedLine.id || match.templateKey === selectedLine.templateKey);
  }) ? selectedLine : null;

  const groups = useMemo(() => {
    const unique = uniqueByTemplate(spendLines(monthLines));
    const extras = allMeta
      .map(s => s.id)
      .filter(id => id !== 'income' && !(PICKER_SECTION_ORDER as readonly string[]).includes(id));
    const order = [...PICKER_SECTION_ORDER, ...extras];
    return order
      .map(id => {
        const meta = allMeta.find(s => s.id === id);
        return {
          meta,
          lines: unique.filter(l => l.section === id),
        };
      })
      .filter((g): g is { meta: SectionMeta; lines: BudgetLine[] } => !!g.meta && g.lines.length > 0);
  }, [monthLines, allMeta]);

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 8 }}>
        Budget line
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 6, paddingBottom: 4, alignItems: 'center' }}>
          <CategoryChip
            label="Unbudgeted"
            color={C.rose}
            selected={!selectedLineId && !selectedCategoryId}
            onPress={onSelectUnbudgeted}
          />
          {generalCats.map(cat => {
            const match = matchGeneralLine(cat, monthLines);
            const selected = selectedLine
              ? !!match && (match.id === selectedLine.id || match.templateKey === selectedLine.templateKey)
              : selectedCategoryId === cat.id;
            return (
              <CategoryChip
                key={cat.id}
                label={cat.name}
                color={cat.color}
                selected={selected}
                aiSuggested={!!match && match.id === matchedLineId}
                onPress={() => onSelectCategory(cat, match)}
              />
            );
          })}
          {extraSelected && (
            <CategoryChip
              label={extraSelected.name}
              color={extraSelected.color}
              selected
              aiSuggested={extraSelected.id === matchedLineId}
              onPress={() => onSelectLine(extraSelected)}
            />
          )}
          <Tap
            onPress={() => setMoreOpen(true)}
            haptic
            accessibilityLabel="More budget lines"
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: extraSelected ? `${extraSelected.color}38` : C.surface,
              borderWidth: 0.5,
              borderColor: extraSelected ? extraSelected.color : C.hair,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="plus" size={16} stroke={extraSelected ? extraSelected.color : C.sage} sw={2}/>
          </Tap>
        </View>
      </ScrollView>

      <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={() => setMoreOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setMoreOpen(false)} />
          <View style={{
            backgroundColor: C.bgElev,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            borderWidth: 0.5, borderColor: C.hairStrong,
            paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, maxHeight: '70%',
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.subtle, alignSelf: 'center', marginBottom: 14 }} />
            <Text style={{ fontFamily: C.fonts.serif, fontSize: 24, color: C.cream, marginBottom: 12 }}>
              Budget line
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {groups.length === 0 ? (
                <Text style={{ fontSize: 14, color: C.muted, paddingVertical: 16 }}>
                  Nothing on the budget this month yet.
                </Text>
              ) : groups.map(g => (
                <View key={g.meta.id} style={{ marginBottom: 8 }}>
                  <Text style={{
                    fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase',
                    marginTop: 10, marginBottom: 4,
                  }}>
                    {g.meta.label}
                  </Text>
                  {g.lines.map(line => {
                    const on = selectedLineId === line.id
                      || (!!selectedLine && selectedLine.templateKey === line.templateKey && selectedLine.section === line.section);
                    return (
                      <Tap
                        key={line.id}
                        onPress={() => { onSelectLine(line); setMoreOpen(false); }}
                        style={{
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                          paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: C.hair,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: line.color }}/>
                          <Text
                            style={{ fontSize: 16, color: C.cream, fontWeight: on ? '600' : '400', flex: 1 }}
                            numberOfLines={1}
                          >
                            {line.name}
                          </Text>
                        </View>
                        {on ? <Icon name="check" size={18} stroke={C.sage} sw={2} /> : null}
                      </Tap>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
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
