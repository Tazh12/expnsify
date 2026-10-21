import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, Pressable, ScrollView, Image,
  Animated, TextInput, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { amountStyle, useTheme } from '../theme';
import { Icon, Card, Tap, CategoryChip, BottomSheet } from '../components';
import { DatePicker } from '../components/DatePicker';
import { useCategories } from '../store/useCategories';
import { useExpenses, type Expense, type TxnSource } from '../store/useExpenses';
import { useBudget } from '../store/useBudget';
import { useBudgetGroups } from '../store/useBudgetGroups';
import { useSettings } from '../store/useSettings';
import { useRates, FRANKFURTER_CURRENCIES } from '../store/useRates';
import { useAuth } from '../store/useAuth';
import { scanImage, scanText, scanPdf, transcribeAudio, takeAiLimit, ScanRequestError, type ScannedExpense } from '../services/groq';
import { capturePurchaseLocation } from '../services/location';
import { uid, fmt, currencySymbol, parseLocalDate, toLocalDateISO } from '../services/format';
import { CurrencyPickerSheet } from '../components/CurrencyPicker';
import { CompletePaymentSheet } from './CompletePaymentSheet';
import { matchLine } from '../services/budget';
import { monthKey, expenseMonthKey, slugKey, uniqueTemplateKey, monthTitle } from '../services/month';
import { useViewMonth } from '../store/useViewMonth';
import { uploadReceipt } from '../services/receipts';
import { RECEIPT_STORAGE_ENABLED, resolveReceiptUriToPersist } from '../services/receiptUri';
import type { BudgetLine, SectionMeta } from '../store/budgetTypes';
import { sectionColor } from '../store/budgetTypes';

const PICKER_SECTION_ORDER = ['bills', 'variable', 'investments'] as const;

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function spendLines(lines: BudgetLine[]): BudgetLine[] {
  return lines.filter(l => l.section !== 'income');
}

async function maybeLocation() {
  if (!useSettings.getState().captureLocation) return null;
  try {
    return await capturePurchaseLocation();
  } catch {
    return null;
  }
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

  const doneScale = useRef(new Animated.Value(0.6)).current;

  const launchedCamera = useRef(false);

  useEffect(() => {
    if (!open) {
      launchedCamera.current = false;
      return;
    }
    setPhase(editExpense ? 'review' : 'pick');
    setMethod(null);
    setScanned(null);
    setReceiptUri(null);
    setSaveState('idle');
    setCompleteOpen(false);
    setMatchedLine(null);
    if (Platform.OS !== 'web' && !editExpense && !pendingShare?.uri && !launchedCamera.current) {
      launchedCamera.current = true;
      startScan('photo');
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
    if (takeAiLimit()) {
      setPhase('pick');
      return;
    }
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

  const offerManualEntry = () => {
    Alert.alert(
      "Scanning isn't available right now",
      'You can add it by hand.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => setPhase('pick') },
        { text: 'Type it', onPress: () => { setMethod('manual'); goReview(null); } },
      ],
    );
  };

  const finishScan = async (
    run: () => Promise<ScannedExpense | null>,
    unreadable?: { title?: string; message?: string },
  ): Promise<ScannedExpense | null> => {
    try {
      const data = await run();
      if (!data) {
        if (takeAiLimit()) setPhase('pick');
        else failScan(unreadable?.message, unreadable?.title);
        return null;
      }
      return data;
    } catch (e) {
      if (takeAiLimit()) {
        setPhase('pick');
        return null;
      }
      if (e instanceof ScanRequestError && e.kind === 'auth') {
        Alert.alert('Please sign in again.');
        setPhase('pick');
        return null;
      }
      if (e instanceof ScanRequestError) {
        offerManualEntry();
        return null;
      }
      throw e;
    }
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
      const data = await finishScan(
        () => scanPdf(base64, categories, lines),
        { message: 'Could not read that PDF. Try a screenshot of the confirmation.' },
      );
      if (!data) return;
      goReview(data, uri, src);
      return;
    }
    if (isEmail) {
      const raw = await readTextFile(uri);
      const data = await finishScan(
        () => scanText(emailToPlain(raw), categories, lines),
        { message: 'Could not read that email. Try a PDF or screenshot.' },
      );
      if (!data) return;
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
    const data = await finishScan(() => scanImage(base64, categories, 'image/jpeg', lines));
    if (!data) return;
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
        const data = await finishScan(() => scanImage(base64, categories, 'image/jpeg', lines));
        if (!data) return;
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
      if (e instanceof ScanRequestError) {
        if (e.kind === 'auth') {
          Alert.alert('Please sign in again.');
          setPhase('pick');
        } else {
          offerManualEntry();
        }
        return;
      }
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
      const text = await finishScan(async () => {
        const heard = await transcribeAudio(uri);
        if (!heard) return null;
        const { categories } = useCategories.getState();
        const lines = useBudget.getState().forMonth(monthKey(new Date()));
        return scanText(heard, categories, lines);
      }, { title: 'Could not record', message: 'Could not hear that. Please try again, or enter it manually.' });
      if (!text) return;
      const data = text;
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
      line_items: scanned.line_items ?? [],
      location: await maybeLocation(),
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
    <>
      <BottomSheet visible={open} onClose={onClose}>
        <View style={{ paddingHorizontal: 20, position: 'relative' }}>
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
          {saveState !== 'idle' && (
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgElev,
            }}>
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
      </BottomSheet>
      <CompletePaymentSheet
        open={completeOpen}
        line={matchedLine}
        scanned={scanned}
        preferredCurrency={useSettings.getState().preferredCurrency}
        onConfirm={markPaid}
        onEdit={() => setCompleteOpen(false)}
        onClose={() => { setCompleteOpen(false); onClose(); }}
      />
    </>
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ fontFamily: C.fonts.serif, fontSize: 24, color: C.cream, letterSpacing: -0.3 }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            Add an expense
          </Text>
          <Text style={{ fontSize: 13, color: C.muted, marginTop: 4 }} numberOfLines={2}>
            Scan a receipt or add it another way
          </Text>
        </View>
        <Tap onPress={onClose} accessibilityLabel="Close" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={16} stroke={C.muted}/>
          </View>
        </Tap>
      </View>

      {Platform.OS === 'web' ? (
        <Tap onPress={() => onPick('file')} haptic style={{
          marginBottom: 12, paddingVertical: 28, borderRadius: 16,
          borderWidth: 1, borderStyle: 'dashed', borderColor: C.hair,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 15, color: C.cream, textAlign: 'center' }}>Drop a receipt or PDF here, or choose a file</Text>
        </Tap>
      ) : (
        <Tap onPress={() => onPick('photo')} haptic style={{ marginBottom: 8 }}>
          <LinearGradient
            colors={[C.sage, C.sageDeep]}
            start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
            style={{ height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Icon name="cam" size={20} stroke={C.onPrimary} sw={2}/>
            <Text style={{ fontSize: 16, fontWeight: '600', color: C.onPrimary }}>Scan a receipt</Text>
          </LinearGradient>
        </Tap>
      )}
      {Platform.OS !== 'web' && (
        <Text style={{ fontSize: 12, color: C.muted, textAlign: 'center', marginBottom: 14 }}>AI reads it in seconds</Text>
      )}

      <View style={{ gap: 10 }}>
        {chunk(Platform.OS === 'web'
          ? [
              { id: 'voice' as Method, icon: 'mic', label: 'Say it', hint: 'Merchant, amount, line' },
              { id: 'manual' as Method, icon: 'edit', label: 'Type it', hint: 'Enter it by hand' },
            ]
          : [
              { id: 'image' as Method, icon: 'image', label: 'Photo library', hint: 'Pick a receipt photo' },
              { id: 'file' as Method, icon: 'doc', label: 'PDF or email', hint: 'Confirmations and invoices' },
              { id: 'voice' as Method, icon: 'mic', label: 'Say it', hint: 'Merchant, amount, line' },
              { id: 'manual' as Method, icon: 'edit', label: 'Type it', hint: 'Enter it by hand' },
            ], 2).map(row => (
          <View key={row.map(item => item.id).join('-')} style={{ flexDirection: 'row', alignItems: 'stretch', gap: 10 }}>
            {row.map(item => (
              <Tap
                key={item.id}
                onPress={() => onPick(item.id)}
                haptic
                accessibilityLabel={item.label}
                style={{
                  flex: 1, minHeight: 88, borderRadius: 16, padding: 12,
                  backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
                  justifyContent: 'center',
                }}
              >
                <Icon name={item.icon} size={18} stroke={C.sage}/>
                <Text style={{ marginTop: 8, fontSize: 14, color: C.cream, fontWeight: '600' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{item.label}</Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: C.muted }} numberOfLines={2}>{item.hint}</Text>
              </Tap>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function VoiceCoach({ onStart, onClose }: { onStart: () => void; onClose: () => void }) {
  const C = useTheme();
  return (
    <View style={{ paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Text
          style={{ flex: 1, fontFamily: C.fonts.serif, fontSize: 24, color: C.cream, letterSpacing: -0.3 }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          Say three things
        </Text>
        <Tap onPress={onClose} accessibilityLabel="Close" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={16} stroke={C.muted}/>
          </View>
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
              <Text style={{ fontSize: 13, color: C.link, fontWeight: '600' }}>{i + 1}</Text>
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
          <Icon name="mic" size={18} stroke={C.onPrimary} sw={2}/>
          <Text style={{ fontSize: 15, fontWeight: '600', color: C.onPrimary }}>Start 5-second take</Text>
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
    <View style={{ paddingVertical: 28, alignItems: 'center' }}>
      <Text style={{ fontFamily: C.fonts.serif, fontSize: 22, color: C.cream, textAlign: 'center' }}>
        {lines[step]}
      </Text>
      <Text style={{ marginTop: 18, fontSize: 11, color: C.subtle, letterSpacing: 0.06, textTransform: 'uppercase' }}>
        ✦ powered by Vadri intelligence
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [txnType, setTxnType] = useState<'expense' | 'income'>(editExpense?.type ?? 'expense');
  const viewMonth = monthKey(useViewMonth(s => s.month));

  const saveMonth = expenseMonthKey(dateISO) || monthKey(new Date());
  const monthLines = budget.forMonth(saveMonth);
  const selectedLine = monthLines.find(l => l.id === selectedLineId) ?? null;
  const overspend = !!(selectedLine && selectedLine.section !== 'income' && (() => {
    const planned = convert(selectedLine.expected, selectedLine.currency || 'USD');
    return planned > 0 && convert(parseFloat(amount) || 0, currencyCode) > planned;
  })());

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
        line_items: scanned?.line_items ?? [],
        location: await maybeLocation(),
      });
    }
    setSaveState('done');
    setTimeout(onSave, 1400);
  };

  return (
    <View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingBottom: 12 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Text
            style={{ flex: 1, fontFamily: C.fonts.serif, fontSize: 24, color: C.cream, letterSpacing: -0.3 }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {editExpense ? 'Edit this' : 'I read this'}
          </Text>
          <Tap onPress={onClose} accessibilityLabel="Close" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={16} stroke={C.muted}/>
            </View>
          </Tap>
        </View>
        <Text style={{ fontSize: 12, color: C.muted, marginBottom: 18 }}>
          {editExpense ? 'Edit any field.' : 'Tap any field to fix it.'}
          {scanned?.confidence != null ? `  ✦ ${Math.round(scanned.confidence * 100)}% sure` : ''}
        </Text>

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
              style={{ ...amountStyle('semibold'), fontSize: 52, lineHeight: 64, color: C.text, flex: 1 }}
              placeholderTextColor={C.muted}
              placeholder="0.00"
            />
            <Tap onPress={() => setCurrencyPickerOpen(true)} accessibilityLabel="Change currency" style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 8, minHeight: 44 }}>
              <Text style={{ fontSize: 13, color: C.muted }}>{currencyCode}</Text>
              <Icon name="chev-r" size={11} stroke={C.muted}/>
            </Tap>
          </View>
          {currencyCode !== preferredCurrency && !!amount && parseFloat(amount) > 0 && (
            <Text style={{ fontSize: 12, color: C.muted, marginTop: 6, ...amountStyle('regular') }}>
              ≈ {fmt(convert(parseFloat(amount) || 0, currencyCode), preferredCurrency)} converted
            </Text>
          )}
        </Card>

        <Card style={{ overflow: 'hidden', marginBottom: 12 }}>
          <ReviewRow label="Merchant" value={merchant} onEdit={setMerchant} last/>
        </Card>

        <BudgetLinePicker
          month={saveMonth}
          monthLines={monthLines}
          selectedLineId={selectedLineId}
          selectedCategoryId={selectedCategoryId}
          matchedLineId={matchedLine?.id ?? scanned?.lineId ?? null}
          suggestedName={!scanned?.lineId ? scanned?.category?.name : undefined}
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

        {(!selectedLineId || overspend) && txnType === 'expense' && (
          <View style={{
            marginTop: -8, marginBottom: 12, padding: 12, borderRadius: 14,
            backgroundColor: `${C.rose}18`, borderWidth: 0.5, borderColor: C.rose,
          }}>
            <Text style={{ fontSize: 13, color: C.rose }}>
              {!selectedLineId
                ? 'This is not on the budget. Pick a line or it stays red.'
                : 'This would go over what you budgeted for that line.'}
            </Text>
          </View>
        )}

        {saveMonth !== viewMonth && (
          <Text style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
            Saves to {monthTitle(saveMonth)} (receipt date)
          </Text>
        )}

        <Tap onPress={handleSave} haptic style={{ marginBottom: 8 }}>
          <LinearGradient
            colors={[C.sage, C.sageDeep]}
            start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
            style={{ height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Icon name="check" size={18} stroke={C.onPrimary} sw={2.2}/>
            <Text style={{ fontSize: 15, fontWeight: '600', color: C.onPrimary }}>
              {editExpense ? 'Update' : selectedLineId ? 'Save to budget' : 'Save unbudgeted'}
            </Text>
          </LinearGradient>
        </Tap>

        <Tap
          onPress={() => setMoreOpen(o => !o)}
          accessibilityLabel={moreOpen ? 'Hide more details' : 'More details'}
          style={{ minHeight: 44, justifyContent: 'center', marginBottom: 8 }}
        >
          <Text style={{ fontSize: 14, color: C.link, fontWeight: '600' }}>{moreOpen ? 'Hide details' : 'More details'}</Text>
        </Tap>

        {moreOpen && (
          <>
            <Card style={{ overflow: 'hidden', marginBottom: 12 }}>
              <ReviewRow label="Date" value={dateDisplay} onPress={() => setDatePickerVisible(true)}/>
              <ReviewRow label="Notes" value={note} onEdit={setNote} muted last/>
            </Card>
            {(scanned?.line_items?.length ?? 0) > 0 && (
              <Card style={{ padding: 14, marginBottom: 12 }}>
                <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 8 }}>
                  Line items
                </Text>
                {scanned!.line_items.map((item, i) => (
                  <View key={`${item.name}-${i}`} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text style={{ flex: 1, fontSize: 14, color: C.cream }} numberOfLines={1}>{item.name}</Text>
                    {item.amount > 0 && (
                      <Text style={{ fontSize: 13, color: C.muted, marginLeft: 8 }}>{item.amount.toFixed(2)}</Text>
                    )}
                  </View>
                ))}
              </Card>
            )}
            {receiptUri && !(method === 'file' || receiptUri.toLowerCase().includes('.pdf')) && (
              <Image
                source={{ uri: receiptUri }}
                style={{ width: '100%', height: 148, borderRadius: 12, marginBottom: 10, backgroundColor: C.surface2 }}
                resizeMode="cover"
              />
            )}
            {!RECEIPT_STORAGE_ENABLED && (
              <Text style={{ fontSize: 13, color: C.muted, lineHeight: 18, marginBottom: 12 }}>
                I can read a photo or PDF to fill the expense. The file itself won't be stored.
              </Text>
            )}
          </>
        )}
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
    </View>
  );
}

function BudgetLinePicker({
  month, monthLines, selectedLineId, selectedCategoryId, matchedLineId, suggestedName,
  onSelectUnbudgeted, onSelectCategory, onSelectLine,
}: {
  month: string;
  monthLines: BudgetLine[];
  selectedLineId: string | null;
  selectedCategoryId: string | null;
  matchedLineId: string | null;
  suggestedName?: string;
  onSelectUnbudgeted: () => void;
  onSelectCategory: (cat: { id: string; name: string }, line?: BudgetLine) => void;
  onSelectLine: (line: BudgetLine) => void;
}) {
  const C = useTheme();
  const allLines = useBudget(s => s.lines);
  const addLine = useBudget(s => s.add);
  const currency = useSettings(s => s.preferredCurrency);
  const expenses = useExpenses(s => s.expenses);
  const allMeta = useBudgetGroups(s => s.all);
  const spendGroups = useBudgetGroups(s => s.spend);
  const [moreOpen, setMoreOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newGroup, setNewGroup] = useState('variable');

  const chips = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const counts = new Map<string, number>();
    for (const expense of expenses) {
      if (expense.type === 'income') continue;
      if (parseLocalDate(expense.date) < since) continue;
      const key = expense.line_id
        ? allLines.find(l => l.id === expense.line_id)?.templateKey ?? expense.category_id
        : expense.category_id;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const spend = uniqueByTemplate(spendLines(monthLines));
    const ai = spend.find(l => l.id === matchedLineId) ?? null;
    const ranked = spend
      .filter(l => l.id !== ai?.id)
      .sort((a, b) => (counts.get(b.templateKey) ?? 0) - (counts.get(a.templateKey) ?? 0) || a.name.localeCompare(b.name))
      .slice(0, 8);
    return ai ? [ai, ...ranked] : ranked;
  }, [expenses, allLines, monthLines, matchedLineId]);

  const selectedLine = monthLines.find(l => l.id === selectedLineId) ?? null;
  const extraSelected = selectedLine && !chips.some(l => l.id === selectedLine.id) ? selectedLine : null;

  const openNew = () => {
    setNewName(suggestedName?.trim() ?? '');
    setNewAmount('');
    setNewGroup('variable');
    setNewOpen(true);
  };

  const createLine = async () => {
    const name = newName.trim();
    if (!name) return;
    const taken = new Set(monthLines.filter(l => l.section === newGroup).map(l => l.templateKey));
    const created = await addLine({
      month,
      section: newGroup,
      name,
      expected: Number.parseFloat(newAmount) || 0,
      currency,
      templateKey: uniqueTemplateKey(slugKey(name), taken),
      recurring: true,
      repeatEvery: 'month',
      dueDay: null,
      automated: false,
      notifyDaysBefore: null,
      observation: null,
      actualOverride: null,
      sortOrder: monthLines.length,
      paid: false,
      paidAt: null,
      paidSource: null,
      color: sectionColor(newGroup, spendGroups),
    });
    onSelectLine(created);
    setNewOpen(false);
  };

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
          {chips.map(line => (
            <CategoryChip
              key={line.id}
              label={line.name}
              color={line.color}
              selected={selectedLineId === line.id}
              aiSuggested={line.id === matchedLineId}
              onPress={() => onSelectLine(line)}
            />
          ))}
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
            onPress={openNew}
            haptic
            accessibilityLabel="New line"
            style={{
              height: 36, paddingHorizontal: 12, borderRadius: 18,
              backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 12, color: C.link, fontWeight: '600' }}>+ New line</Text>
          </Tap>
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

      <BottomSheet visible={moreOpen} onClose={() => setMoreOpen(false)}>
            <Text style={{ fontFamily: C.fonts.serif, fontSize: 24, color: C.cream, marginBottom: 12, paddingHorizontal: 20 }}>
              Budget line
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}>
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
      </BottomSheet>

      <BottomSheet visible={newOpen} onClose={() => setNewOpen(false)}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 28 }}>
            <Text style={{ fontFamily: C.fonts.serif, fontSize: 24, color: C.cream, marginBottom: 12 }}>New line</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Name"
              placeholderTextColor={C.muted}
              style={{ borderWidth: 0.5, borderColor: C.hair, borderRadius: 12, padding: 12, color: C.cream, marginBottom: 10 }}
            />
            <TextInput
              value={newAmount}
              onChangeText={setNewAmount}
              placeholder="Amount (optional)"
              placeholderTextColor={C.muted}
              keyboardType="decimal-pad"
              style={{ borderWidth: 0.5, borderColor: C.hair, borderRadius: 12, padding: 12, color: C.cream, marginBottom: 12 }}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {spendGroups.map(group => (
                  <Tap
                    key={group.id}
                    onPress={() => setNewGroup(group.id)}
                    style={{
                      paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderRadius: 16,
                      backgroundColor: newGroup === group.id ? C.sage : C.surface,
                    }}
                  >
                    <Text style={{ color: newGroup === group.id ? C.onPrimary : C.cream, fontSize: 13 }}>{group.label}</Text>
                  </Tap>
                ))}
              </View>
            </ScrollView>
            <Tap onPress={createLine} style={{ minHeight: 44, borderRadius: 12, backgroundColor: C.sage, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: C.onPrimary, fontWeight: '600' }}>Create line</Text>
            </Tap>
        </View>
      </BottomSheet>
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
