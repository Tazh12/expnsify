import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { Tap } from '../components/Tap';
import { Icon } from '../components/Icon';
import { Card } from '../components/Card';
import { Toggle } from '../components/Toggle';
import { DatePicker } from '../components/DatePicker';
import {
  REPEAT_OPTIONS, parseRepeatEvery, sectionColor,
  type BudgetLine, type BudgetSection, type RepeatEvery,
} from '../store/budgetTypes';
import { dueDateFor, formatDueDate, occurrenceDaysInMonth, parseMonthKey, repeatStepDays, slugKey } from '../services/month';
import { findLineByName, inferDestination } from '../services/budget';
import { GoesToPicker } from '../components/GoesToPicker';
import { useBudgetGroups } from '../store/useBudgetGroups';

function parseMoney(raw: string): number {
  const n = parseFloat(raw.replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function lineHasSchedule(line: BudgetLine | null | undefined): boolean {
  if (!line) return false;
  return line.dueDay != null
    || line.automated
    || line.actualOverride != null
    || !!line.observation
    || line.recurring;
}

export function LineEditor({
  open, section: sectionProp, month, currency, initial, existing = [], onSave, onDelete, onClose,
}: {
  open: boolean;
  section: BudgetSection;
  month: string;
  currency: string;
  initial?: BudgetLine | null;
  existing?: BudgetLine[];
  onSave: (line: Omit<BudgetLine, 'id'> & { id?: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const C = useTheme();
  const customGroups = useBudgetGroups(s => s.groups);
  const allMeta = useBudgetGroups(s => s.all);
  const addingIncome = !initial && sectionProp === 'income';
  const incomeFlow = sectionProp === 'income' || initial?.section === 'income';
  const [name, setName] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [dueDay, setDueDay] = useState<number | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [automated, setAutomated] = useState(false);
  const [recurring, setRecurring] = useState(true);
  const [repeatEvery, setRepeatEvery] = useState<RepeatEvery>('month');
  const [observation, setObservation] = useState('');
  const [section, setSection] = useState<BudgetSection>(sectionProp);
  const [sectionLocked, setSectionLocked] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setExpected(initial?.expected ? String(initial.expected) : '');
    setActual(initial?.actualOverride != null ? String(initial.actualOverride) : '');
    setDueDay(initial?.dueDay ?? null);
    setDatePickerOpen(false);
    setAutomated(initial?.automated ?? false);
    setRecurring(initial?.recurring ?? true);
    setRepeatEvery(parseRepeatEvery(initial?.repeatEvery));
    setObservation(initial?.observation ?? '');
    setSection(initial?.section ?? sectionProp);
    setSectionLocked(true);
    setScheduleOpen(lineHasSchedule(initial));
    setSaving(false);
    // Only re-hydrate when opening or switching lines — not when the store
    // pushes a new object for the same line (that was wiping the amount).
  }, [open, initial?.id, sectionProp]);

  const match = useMemo(() => {
    if (initial || !name.trim() || addingIncome) return undefined;
    const pool = existing.filter(l => l.section !== 'income');
    return findLineByName(name, pool);
  }, [initial, name, existing, addingIncome]);

  const guessed = useMemo(() => {
    if (!open || initial || addingIncome || !name.trim()) return undefined;
    const id = inferDestination(name, customGroups);
    if (!id || id === section) return undefined;
    return allMeta.find(s => s.id === id);
  }, [open, initial, addingIncome, name, customGroups, section, allMeta]);

  const dest = allMeta.find(s => s.id === section);
  const isIncome = incomeFlow || section === 'income';
  const canCopyActual = isIncome && parseMoney(expected) > 0 && parseMoney(actual) !== parseMoney(expected);
  const occurCount = recurring && dueDay != null && repeatStepDays(repeatEvery) > 0
    ? occurrenceDaysInMonth(month, dueDay, repeatEvery).length
    : 0;
  const pickerDate = dueDay != null
    ? dueDateFor(month, dueDay)
    : (() => {
        const { year, monthIndex } = parseMonthKey(month);
        const today = new Date();
        if (today.getFullYear() === year && today.getMonth() === monthIndex) return today;
        return new Date(year, monthIndex, 1);
      })();

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const target = initial ?? match;
    await onSave({
      id: target?.id,
      month,
      section: incomeFlow ? 'income' : section,
      name: name.trim(),
      expected: parseMoney(expected),
      actualOverride: isIncome && actual !== '' ? parseMoney(actual) : target?.actualOverride ?? null,
      currency: target?.currency ?? currency,
      dueDay,
      automated: isIncome ? false : automated,
      notifyDaysBefore: isIncome ? null : (automated ? (target?.notifyDaysBefore ?? 1) : null),
      observation: observation.trim() || null,
      recurring,
      repeatEvery: recurring ? repeatEvery : 'month',
      sortOrder: target?.sortOrder ?? 0,
      templateKey: target?.templateKey || slugKey(name),
      paid: target?.paid ?? false,
      paidAt: target?.paidAt ?? null,
      paidSource: target?.paidSource ?? null,
      color: target?.color ?? sectionColor(section, customGroups),
    });
    setSaving(false);
    onClose();
  };

  const handleDelete = () => {
    if (!onDelete || !initial) return;
    Alert.alert('Remove line?', `Delete “${initial.name}” from this month?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete().then(onClose) },
    ]);
  };

  const title = initial
    ? `Edit ${initial.name}`
    : addingIncome ? 'Add income' : 'Add budget';
  const cta = saving ? 'Saving…' : initial ? 'Save' : addingIncome ? 'Add income' : 'Add budget';

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={40} tint={C.isLight ? 'light' : 'dark'} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose}/>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{
            backgroundColor: C.bgElev,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            borderWidth: 0.5, borderColor: C.hairStrong,
            paddingTop: 12, maxHeight: '88%' as any,
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.subtle, alignSelf: 'center', marginBottom: 8 }}/>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <Text style={{ fontFamily: C.fonts.serif, fontSize: 26, color: C.cream }}>
                  {title}
                </Text>
                <Tap onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="x" size={16} stroke={C.muted}/>
                </Tap>
              </View>

              <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 8 }}>
                Basics
              </Text>
              <Field
                label="Name"
                value={name}
                onChange={setName}
                placeholder={addingIncome ? 'e.g. Paycheck' : 'e.g. Rent'}
                C={C}
              />
              <Field
                label="Amount"
                value={expected}
                onChange={setExpected}
                placeholder="0.00"
                keyboard="decimal-pad"
                C={C}
              />

              {!incomeFlow && (
                <>
                  <GoesToPicker
                    section={section}
                    onSelect={(id) => { setSectionLocked(true); setSection(id); }}
                  />
                  <Text style={{ fontSize: 12, color: C.muted, marginTop: -6, marginBottom: 12 }}>
                    {match
                      ? `Updates ${match.name} in ${allMeta.find(s => s.id === match.section)?.label ?? 'the plan'}.`
                      : dest
                        ? `New line under ${dest.label}.`
                        : ''}
                  </Text>
                  {guessed && (
                    <Tap
                      onPress={() => { setSectionLocked(true); setSection(guessed.id); }}
                      accessibilityLabel={`Move to ${guessed.label}`}
                      style={{ marginTop: -4, marginBottom: 14 }}
                    >
                      <Text style={{ fontSize: 13, color: C.sage }}>
                        Looks like {guessed.label}, move it?
                      </Text>
                    </Tap>
                  )}
                </>
              )}

              <Tap
                onPress={() => setScheduleOpen(o => !o)}
                accessibilityLabel={scheduleOpen ? 'Collapse schedule' : 'Expand schedule'}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, marginBottom: 8 }}
              >
                <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>
                  Schedule
                </Text>
                <Icon name={scheduleOpen ? 'chev-d' : 'chev-r'} size={14} stroke={C.muted}/>
              </Tap>

              {scheduleOpen && (
                <>
                  {isIncome && (
                    <Field
                      label="Actual"
                      value={actual}
                      onChange={setActual}
                      placeholder="when it lands"
                      keyboard="decimal-pad"
                      C={C}
                      action={canCopyActual ? {
                        label: 'Use amount',
                        onPress: () => setActual(expected),
                      } : undefined}
                    />
                  )}
                  <DueField
                    month={month}
                    dueDay={dueDay}
                    onPress={() => setDatePickerOpen(true)}
                    C={C}
                  />
                  <Field label="Note" value={observation} onChange={setObservation} placeholder="optional" C={C}/>

                  <Card style={{ padding: 4, marginTop: 4, marginBottom: 16 }}>
                    <Row
                      label="Repeat"
                      control={<Toggle on={recurring} onChange={setRecurring}/>}
                      C={C}
                      last={!recurring && isIncome}
                    />
                    {recurring && (
                      <View style={{
                        paddingHorizontal: 12, paddingTop: 4, paddingBottom: isIncome ? 12 : 14,
                        borderBottomWidth: isIncome ? 0 : 0.5, borderBottomColor: C.hair,
                      }}>
                        <FrequencySeg value={repeatEvery} onChange={setRepeatEvery} C={C}/>
                        {occurCount > 1 && (
                          <Text style={{ fontSize: 12, color: C.muted, marginTop: 10, textAlign: 'center' }}>
                            Lands {occurCount} times this month
                          </Text>
                        )}
                      </View>
                    )}
                    {!isIncome && (
                      <Row label="Auto-pay" control={<Toggle on={automated} onChange={setAutomated}/>} C={C} last/>
                    )}
                  </Card>
                </>
              )}

              <Tap onPress={handleSave} haptic disabled={saving || !name.trim()}>
                <LinearGradient
                  colors={[C.sage, C.sageDeep]}
                  start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
                  style={{ height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', opacity: name.trim() ? 1 : 0.5 }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#0E0E0C' }}>{cta}</Text>
                </LinearGradient>
              </Tap>

              {initial && onDelete && (
                <Tap onPress={handleDelete} style={{ alignItems: 'center', paddingTop: 16 }}>
                  <Text style={{ fontSize: 13, color: C.rose }}>Delete line</Text>
                </Tap>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </BlurView>

      <DatePicker
        visible={datePickerOpen}
        value={pickerDate}
        presentation="popover"
        allowClear
        onSelect={(d) => setDueDay(d.getDate())}
        onClear={() => setDueDay(null)}
        onClose={() => setDatePickerOpen(false)}
      />
    </Modal>
  );
}

function Field({
  label, value, onChange, placeholder, keyboard, C, action,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboard?: 'decimal-pad' | 'number-pad';
  C: ReturnType<typeof useTheme>;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
        borderRadius: 14, paddingLeft: 16, paddingRight: action ? 6 : 16,
      }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.subtle}
          keyboardType={keyboard}
          style={{
            flex: 1, paddingVertical: 14, paddingRight: 12,
            fontSize: 16, color: C.cream,
          }}
        />
        {action ? (
          <Tap
            onPress={action.onPress}
            haptic
            accessibilityLabel={action.label}
            style={{
              minHeight: 36, paddingHorizontal: 12, paddingVertical: 8,
              borderRadius: 10, backgroundColor: C.sageGlow,
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 12, color: C.sage, fontWeight: '600' }}>{action.label}</Text>
          </Tap>
        ) : null}
      </View>
    </View>
  );
}

function DueField({
  month, dueDay, onPress, C,
}: {
  month: string;
  dueDay: number | null;
  onPress: () => void;
  C: ReturnType<typeof useTheme>;
}) {
  const cadence = dueDay != null ? formatDueDate(month, dueDay) : 'Pick a date';
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 8 }}>
        Due date
      </Text>
      <Tap
        onPress={onPress}
        accessibilityLabel="Due date"
        accessibilityValue={{ text: cadence }}
        style={{
          minHeight: 48,
          backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
          borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontSize: 16, color: dueDay != null ? C.cream : C.subtle }}>
          {cadence}
        </Text>
        <Icon name="cal" size={18} stroke={C.muted}/>
      </Tap>
    </View>
  );
}

function FrequencySeg({
  value, onChange, C,
}: {
  value: RepeatEvery;
  onChange: (v: RepeatEvery) => void;
  C: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: C.surface2,
      borderRadius: 12,
      padding: 3,
      gap: 2,
    }}>
      {REPEAT_OPTIONS.map(opt => {
        const on = value === opt.id;
        return (
          <View key={opt.id} style={{ flex: 1 }}>
            <Tap
              onPress={() => onChange(opt.id)}
              haptic
              accessibilityLabel={opt.label}
              accessibilityState={{ selected: on }}
              style={{
                minHeight: 36, borderRadius: 10,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: on ? C.sage : 'transparent',
                paddingHorizontal: 4,
              }}
            >
              <Text style={{
                fontSize: 12, fontWeight: '600',
                color: on ? '#0E0E0C' : C.muted,
                textAlign: 'center',
              }}>
                {opt.label}
              </Text>
            </Tap>
          </View>
        );
      })}
    </View>
  );
}

function Row({ label, control, C, last }: { label: string; control: React.ReactNode; C: ReturnType<typeof useTheme>; last?: boolean }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 14, paddingHorizontal: 16,
      borderBottomWidth: last ? 0 : 0.5, borderBottomColor: C.hair,
    }}>
      <Text style={{ fontSize: 14, color: C.cream }}>{label}</Text>
      {control}
    </View>
  );
}
