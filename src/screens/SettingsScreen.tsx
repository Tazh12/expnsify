import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, Alert, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { useTheme, PALETTES, ACCENTS, type PaletteId, type AccentId } from '../theme';
import { Card, Icon, Tap, Toggle, PageHeader, SectionHeader, SettingsRow } from '../components';
import { useSettings } from '../store/useSettings';
import { FONTS, type FontId } from '../theme';
import { useExpenses } from '../store/useExpenses';
import { useAuth } from '../store/useAuth';
import { useRates } from '../store/useRates';
import { CurrencyPickerSheet } from '../components/CurrencyPicker';
import { requestNotificationPermission, syncNotifications, ordinalDay } from '../services/notifications';
import { useBudget } from '../store/useBudget';
import { monthKey } from '../services/month';
import { useAiUsage } from '../store/useAiUsage';
import { aiRemainingLabel } from '../flows/UpgradeModal';
import { deleteAccount } from '../services/account';
import { expensesToCsv } from '../services/export';
import { LinesGroupsScreen } from './LinesGroupsScreen';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';

function ratesAge(fetchedAt: number): string {
  const mins = Math.round((Date.now() - fetchedAt) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

interface Props {
  onClose: () => void;
}

const PALETTE_DATA: { id: PaletteId; label: string; swatches: string[] }[] = [
  { id: 'midnight', label: 'Midnight', swatches: ['#0E0E0C', '#1B1A17', '#F4EFE6'] },
  { id: 'cream',    label: 'Cream',    swatches: ['#F4EFE6', '#FAF8F2', '#1F1B16'] },
  { id: 'carbon',   label: 'Carbon',   swatches: ['#08080A', '#121215', '#EDEDF0'] },
];

const ACCENT_DATA: { id: AccentId; color: string }[] = [
  { id: 'sage',  color: '#B8D4B0' },
  { id: 'amber', color: '#E0B872' },
  { id: 'rose',  color: '#E0A0A0' },
  { id: 'blue',  color: '#9FB8D4' },
];

export function SettingsScreen({ onClose }: Props) {
  const C = useTheme();
  const settings = useSettings();
  const { expenses } = useExpenses();
  const { lines } = useBudget();
  const { user, signOut, updateDisplayName } = useAuth();

  const rates = useRates();
  const aiUsed = useAiUsage(s => s.used);
  const aiLimit = useAiUsage(s => s.limit);
  const aiLoaded = useAiUsage(s => s.loaded);
  useEffect(() => { useAiUsage.getState().refresh(); }, []);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [panel, setPanel] = useState<'main' | 'appearance' | 'lines'>('main');
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  function openEditName() {
    setNameInput(user?.displayName ?? '');
    setEditNameOpen(true);
    setTimeout(() => inputRef.current?.focus(), 120);
  }

  async function saveName() {
    if (!nameInput.trim()) return;
    setSaving(true);
    try {
      await updateDisplayName(nameInput.trim());
      setEditNameOpen(false);
    } catch {
      Alert.alert('Error', 'Could not update name. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'You';

  if (panel === 'lines') {
    return <LinesGroupsScreen onClose={() => setPanel('main')} />;
  }

  return (
    <>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <PageHeader title="Settings" tagline="your space"/>
        <Tap
          onPress={onClose}
          accessibilityLabel="Close settings"
          style={{
            marginTop: 8, width: 44, height: 44, borderRadius: 22,
            backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="x" size={16} stroke={C.muted}/>
        </Tap>
      </View>

      {/* Profile */}
      <Card style={{ marginTop: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {/* Tappable avatar */}
        <Tap onPress={openEditName} haptic style={{ position: 'relative' }}>
          <View style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: C.sage,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontFamily: C.fonts.serifItalic, fontSize: 26, color: '#0E0E0C' }}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          {/* Small edit badge */}
          <View style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 18, height: 18, borderRadius: 9,
            backgroundColor: C.bgElev,
            borderWidth: 1, borderColor: C.hair,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="edit" size={9} stroke={C.muted} sw={2}/>
          </View>
        </Tap>

        <View style={{ flex: 1 }}>
          <Tap onPress={openEditName}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 16, color: C.cream }}>{displayName}</Text>
              <Icon name="edit" size={12} stroke={C.subtle} sw={1.8}/>
            </View>
          </Tap>
          <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{user?.email ?? ''}</Text>
        </View>
        <Tap onPress={handleSignOut} style={{ padding: 6 }}>
          <Text style={{ fontSize: 12, color: C.muted }}>Sign out</Text>
        </Tap>
      </Card>

      {panel === 'main' && (
        <Card style={{ padding: 4, marginTop: 12 }}>
          <SettingsRow
            icon={<Icon name="trash" size={18} stroke={C.rose}/>}
            label="Delete account"
            onPress={() => Alert.alert(
              'Delete account',
              'This permanently deletes your expenses, budget, and sign-in. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    deleteAccount().catch(e => {
                      const msg = e instanceof Error ? e.message : 'Please try again.';
                      Alert.alert('Could not delete account', msg.includes('recent') ? 'Sign out, sign back in, and try again.' : msg);
                    });
                  },
                },
              ],
            )}
            isLast
          />
        </Card>
      )}

      {/* Name edit sheet */}
      <BottomSheet visible={editNameOpen} onClose={() => setEditNameOpen(false)}>
            <View style={{ paddingHorizontal: 22, paddingBottom: 28 }}>

              {/* Avatar preview */}
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={{
                  width: 68, height: 68, borderRadius: 34,
                  backgroundColor: C.sage,
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: 10,
                }}>
                  <Text style={{ fontFamily: C.fonts.serifItalic, fontSize: 32, color: '#0E0E0C' }}>
                    {(nameInput.trim() || displayName).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: C.muted }}>{user?.email}</Text>
              </View>

              {/* Label */}
              <Text style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.06, marginBottom: 10 }}>
                Display name
              </Text>

              {/* Input */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
                borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
                marginBottom: 16,
              }}>
                <TextInput
                  ref={inputRef}
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="Your name"
                  placeholderTextColor={C.subtle}
                  style={{ flex: 1, fontSize: 16, color: C.cream, fontFamily: C.fonts.regular }}
                  returnKeyType="done"
                  onSubmitEditing={saveName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={40}
                />
                {nameInput.length > 0 && (
                  <Tap onPress={() => setNameInput('')}>
                    <Icon name="x" size={14} stroke={C.muted}/>
                  </Tap>
                )}
              </View>

              {/* Save */}
              <Tap
                onPress={saveName}
                haptic
                disabled={!nameInput.trim() || saving}
                style={{
                  backgroundColor: nameInput.trim() ? C.sage : C.surface2,
                  borderRadius: 14, paddingVertical: 15, alignItems: 'center',
                }}
              >
                <Text style={{
                  color: nameInput.trim() ? '#0E0E0C' : C.muted,
                  fontFamily: C.fonts.semibold, fontSize: 15,
                }}>
                  {saving ? 'Saving…' : 'Save name'}
                </Text>
              </Tap>
            </View>
      </BottomSheet>

      {panel === 'appearance' && (
        <Tap onPress={() => setPanel('main')} accessibilityLabel="Back" style={{ marginTop: 12, minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: C.sage, fontSize: 15 }}>← Back</Text>
        </Tap>
      )}
      {panel === 'appearance' && (
      <Card style={{ padding: 16 }}>

        {/* ── Theme ── */}
        <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 12 }}>
          Theme
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
          {PALETTE_DATA.map(p => (
            <Tap key={p.id} onPress={() => settings.set('palette', p.id)} style={{
              width: 88, padding: 12, borderRadius: 16,
              backgroundColor: settings.palette === p.id ? `${C.sage}1e` : C.surface2,
              borderWidth: 0.5, borderColor: settings.palette === p.id ? C.sage : C.hair,
              alignItems: 'center', gap: 10,
            }}>
              <View style={{ flexDirection: 'row', borderRadius: 8, overflow: 'hidden', width: 54, height: 28 }}>
                {p.swatches.map((s, i) => <View key={i} style={{ flex: 1, backgroundColor: s }}/>)}
              </View>
              <Text style={{
                fontSize: 11, fontWeight: '500', textTransform: 'capitalize',
                color: settings.palette === p.id ? C.cream : C.muted,
              }}>
                {p.label}
              </Text>
            </Tap>
          ))}
        </View>

        {/* ── Accent ── */}
        <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 12 }}>
          Accent
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 22 }}>
          {ACCENT_DATA.map(a => {
            const on = settings.accent === a.id;
            return (
              <Tap key={a.id} onPress={() => settings.set('accent', a.id)} style={{
                width: 68, height: 68, borderRadius: 18,
                backgroundColor: a.color,
                borderWidth: on ? 3 : 1.5,
                borderColor: on ? C.cream : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {on && <Icon name="check" size={22} stroke="#0E0E0C" sw={2.6}/>}
              </Tap>
            );
          })}
        </View>

        {/* ── Font style ── */}
        <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 12 }}>
          Font style
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
          {([
            { id: 'default' as FontId, label: 'Default', previewFont: FONTS.default.regular, agFont: FONTS.default.serif },
            { id: 'sans'    as FontId, label: 'Sans',    previewFont: FONTS.sans.regular,    agFont: FONTS.sans.regular },
            { id: 'mono'    as FontId, label: 'Mono',    previewFont: FONTS.mono.regular,    agFont: FONTS.mono.regular },
            { id: 'comic'   as FontId, label: 'Comic',   previewFont: FONTS.comic.regular,   agFont: FONTS.comic.regular },
          ]).map(item => {
            const on = settings.fontId === item.id;
            return (
              <Tap
                key={item.id}
                onPress={() => settings.set('fontId', item.id)}
                style={{
                  width: 68, paddingVertical: 12, borderRadius: 18,
                  backgroundColor: on ? `${C.sage}1e` : C.surface2,
                  borderWidth: on ? 1.5 : 0.5,
                  borderColor: on ? C.sage : C.hair,
                  alignItems: 'center', gap: 8,
                }}
              >
                <Text style={{
                  fontFamily: item.agFont,
                  fontSize: 22,
                  color: on ? C.cream : C.muted,
                  lineHeight: 28,
                }}>
                  Ag
                </Text>
                <Text style={{
                  fontFamily: item.previewFont,
                  fontSize: 11,
                  color: on ? C.sage : C.muted,
                  textTransform: 'capitalize',
                }}>
                  {item.label}
                </Text>
              </Tap>
            );
          })}
        </View>

      </Card>
      )}

      {panel === 'main' && (
      <>
      <SectionHeader title="Budget"/>
      <Card style={{ padding: 4 }}>
        <SettingsRow icon={<Icon name="wallet" size={18} stroke={C.cream}/>} label="Base currency" detail={settings.preferredCurrency} onPress={() => setCurrencyPickerOpen(true)}/>
        {rates.fetchedAt && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            <Text style={{ fontSize: 11, color: C.subtle }}>
              Rates updated {ratesAge(rates.fetchedAt)}
            </Text>
          </View>
        )}
        <SettingsRow icon={<Icon name="tag" size={18} stroke={C.cream}/>} label="Lines & Groups" onPress={() => setPanel('lines')}/>
        <SettingsRow
          icon={<Icon name="bell" size={18} stroke={C.cream}/>}
          label="Notifications"
          detail={settings.notifyBudget ? `Budget on the ${ordinalDay(settings.budgetReminderDay)}` : 'Off'}
          onPress={() => setNotifyOpen(true)}
        />
        <SettingsRow
          icon={<Icon name="pin" size={18} stroke={C.cream}/>}
          label="Save purchase location"
          detail={settings.captureLocation ? 'On' : 'Off'}
          control={<Toggle on={settings.captureLocation} onChange={v => settings.set('captureLocation', v)}/>}
        />
        <SettingsRow
          icon={<Icon name="sparkles" size={18} stroke={C.sage}/>}
          label="AI actions"
          detail={aiRemainingLabel(aiUsed, aiLimit, aiLoaded)}
          isLast
        />
      </Card>

      <SectionHeader title="Appearance"/>
      <Card style={{ padding: 4 }}>
        <SettingsRow icon={<Icon name="sparkles" size={18} stroke={C.cream}/>} label="Theme, accent, and font" onPress={() => setPanel('appearance')} isLast/>
      </Card>

      <SectionHeader title="Data"/>
      <Card style={{ padding: 4 }}>
        <SettingsRow icon={<Icon name="export" size={18} stroke={C.cream}/>} label="Export all data" detail="Every month, as CSV" onPress={async () => {
          const path = FileSystem.cacheDirectory + 'expnsify-all.csv';
          await FileSystem.writeAsStringAsync(path, expensesToCsv(expenses, lines, useRates.getState().convert, settings.preferredCurrency), { encoding: FileSystem.EncodingType.UTF8 });
          await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export all data' });
        }} isLast/>
      </Card>

      <SectionHeader title="About"/>
      <Text style={{ textAlign: 'center', marginTop: 8, color: C.subtle, fontSize: 12 }}>
        <Text style={{ fontFamily: C.fonts.serifItalic }}>expnsify</Text> · v{Constants.expoConfig?.version ?? '1.0.0'}
      </Text>
      </>
      )}
    </ScrollView>
    <CurrencyPickerSheet
      visible={currencyPickerOpen}
      current={settings.preferredCurrency}
      onSelect={(code) => settings.set('preferredCurrency', code)}
      onClose={() => setCurrencyPickerOpen(false)}
    />
    <NotifySheet open={notifyOpen} onClose={() => setNotifyOpen(false)}/>
    </>
  );
}

function NotifySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const C = useTheme();
  const settings = useSettings();
  const { forMonth } = useBudget();
  const [day, setDay] = useState(String(settings.budgetReminderDay));

  React.useEffect(() => {
    if (open) setDay(String(settings.budgetReminderDay));
  }, [open, settings.budgetReminderDay]);

  const persist = async (patch: Partial<{ notifyBudget: boolean; notifyDueDates: boolean; budgetReminderDay: number }>) => {
    if (patch.notifyBudget != null) await settings.set('notifyBudget', patch.notifyBudget);
    if (patch.notifyDueDates != null) await settings.set('notifyDueDates', patch.notifyDueDates);
    if (patch.budgetReminderDay != null) await settings.set('budgetReminderDay', patch.budgetReminderDay);
    const next = { ...settings, ...patch };
    if (next.notifyBudget || next.notifyDueDates) await requestNotificationPermission();
    const now = new Date();
    const month = monthKey(now);
    const lines = forMonth(month);
    const upcoming = now.getDate() >= 25
      ? forMonth(monthKey(new Date(now.getFullYear(), now.getMonth() + 1, 1)))
      : [];
    await syncNotifications({
      notifyBudget: next.notifyBudget,
      budgetReminderDay: next.budgetReminderDay,
      notifyDueDates: next.notifyDueDates,
      lines: [...lines, ...upcoming],
    });
  };

  return (
    <BottomSheet visible={open} onClose={onClose}>
      <View style={{ paddingHorizontal: 22, paddingBottom: 28 }}>
          <Text style={{ fontFamily: C.fonts.serif, fontSize: 26, color: C.cream, marginBottom: 18 }}>Notifications</Text>

          <Card style={{ padding: 4, marginBottom: 14 }}>
            <SettingsRow
              label="Monthly budget reminder"
              control={<Toggle on={settings.notifyBudget} onChange={v => persist({ notifyBudget: v })}/>}
            />
            <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
              <Text style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Day of month</Text>
              <TextInput
                value={day}
                onChangeText={setDay}
                onBlur={() => {
                  const n = Math.min(28, Math.max(1, parseInt(day, 10) || 1));
                  setDay(String(n));
                  persist({ budgetReminderDay: n });
                }}
                keyboardType="number-pad"
                style={{
                  backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
                  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
                  color: C.cream, fontSize: 16, width: 80,
                }}
              />
            </View>
            <SettingsRow
              label="Upcoming payment pings"
              control={<Toggle on={settings.notifyDueDates} onChange={v => persist({ notifyDueDates: v })}/>}
              isLast
            />
          </Card>
          <Text style={{ fontSize: 12, color: C.muted, lineHeight: 18 }}>
            Reminders stay on this device. We’ll nudge you on the {ordinalDay(settings.budgetReminderDay)} to sit down and budget, and before unpaid due dates.
          </Text>
      </View>
    </BottomSheet>
  );
}
