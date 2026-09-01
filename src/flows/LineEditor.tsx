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
import { sectionColor, type BudgetLine, type BudgetSection } from '../store/budgetTypes';
import { slugKey } from '../services/month';
import { findLineByName, inferDestination } from '../services/budget';
import { GoesToPicker } from '../components/GoesToPicker';
import { useBudgetGroups } from '../store/useBudgetGroups';

function parseMoney(raw: string): number {
  const n = parseFloat(raw.replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
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
  const [name, setName] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [automated, setAutomated] = useState(false);
  const [recurring, setRecurring] = useState(true);
  const [observation, setObservation] = useState('');
  const [section, setSection] = useState<BudgetSection>(sectionProp);
  const [sectionLocked, setSectionLocked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setExpected(initial?.expected ? String(initial.expected) : '');
    setActual(initial?.actualOverride != null ? String(initial.actualOverride) : '');
    setDueDay(initial?.dueDay != null ? String(initial.dueDay) : '');
    setAutomated(initial?.automated ?? false);
    setRecurring(initial?.recurring ?? true);
    setObservation(initial?.observation ?? '');
    setSection(initial?.section ?? sectionProp);
    setSectionLocked(!!initial || sectionProp === 'income');
    setSaving(false);
    // Only re-hydrate when opening or switching lines — not when the store
    // pushes a new object for the same line (that was wiping the amount).
  }, [open, initial?.id, sectionProp]);

  const match = useMemo(() => {
    if (initial || !name.trim()) return undefined;
    const pool = addingIncome
      ? existing.filter(l => l.section === 'income')
      : existing.filter(l => l.section !== 'income');
    return findLineByName(name, pool);
  }, [initial, name, existing, addingIncome]);

  useEffect(() => {
    if (!open || initial || sectionLocked) return;
    if (addingIncome) {
      setSection('income');
      return;
    }
    setSection(match?.section ?? inferDestination(name, customGroups));
  }, [name, open, initial, sectionLocked, addingIncome, match, customGroups]);

  const dest = allMeta.find(s => s.id === section);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const day = dueDay ? Math.min(31, Math.max(1, parseInt(dueDay, 10) || 0)) : null;
    const target = initial ?? match;
    await onSave({
      id: target?.id,
      month,
      section,
      name: name.trim(),
      expected: parseMoney(expected),
      actualOverride: section === 'income' && actual !== '' ? parseMoney(actual) : target?.actualOverride ?? null,
      currency: target?.currency ?? currency,
      dueDay: day,
      automated,
      notifyDaysBefore: automated ? (target?.notifyDaysBefore ?? 1) : null,
      observation: observation.trim() || null,
      recurring,
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

              <Field
                label="Name"
                value={name}
                onChange={setName}
                placeholder={addingIncome ? 'e.g. Paycheck' : 'e.g. Rent'}
                C={C}
              />
              <Field
                label={addingIncome ? 'Expected' : 'Amount'}
                value={expected}
                onChange={setExpected}
                placeholder="0.00"
                keyboard="decimal-pad"
                C={C}
              />
              {section === 'income' && (
                <Field label="Actual" value={actual} onChange={setActual} placeholder="when it lands" keyboard="decimal-pad" C={C}/>
              )}
              <Field label="Due day" value={dueDay} onChange={setDueDay} placeholder="optional, 1–31" keyboard="number-pad" C={C}/>
              <Field label="Note" value={observation} onChange={setObservation} placeholder="optional" C={C}/>

              {!addingIncome && (
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
                </>
              )}

              <Card style={{ padding: 4, marginTop: 4, marginBottom: 16 }}>
                <Row label="Repeats next month" control={<Toggle on={recurring} onChange={setRecurring}/>} C={C}/>
                <Row label="Auto-pay" control={<Toggle on={automated} onChange={setAutomated}/>} C={C} last/>
              </Card>

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
    </Modal>
  );
}

function Field({
  label, value, onChange, placeholder, keyboard, C,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboard?: 'decimal-pad' | 'number-pad';
  C: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.subtle}
        keyboardType={keyboard}
        style={{
          backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
          borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
          fontSize: 16, color: C.cream,
        }}
      />
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
