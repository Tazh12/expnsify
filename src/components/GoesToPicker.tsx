import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { useTheme } from '../theme';
import { Tap } from './Tap';
import { Icon } from './Icon';
import { BottomSheet } from './BottomSheet';
import { useBudgetGroups } from '../store/useBudgetGroups';
import type { SectionMeta } from '../store/budgetTypes';

const VISIBLE = 4;

export function GoesToPicker({
  section,
  onSelect,
}: {
  section: string;
  onSelect: (id: string) => void;
}) {
  const C = useTheme();
  const spend = useBudgetGroups(s => s.spend);
  const addGroup = useBudgetGroups(s => s.add);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const shown = useMemo(() => {
    const selected = spend.find(s => s.id === section);
    const rest = spend.filter(s => s.id !== section);
    return selected ? [selected, ...rest.slice(0, VISIBLE - 1)] : rest.slice(0, VISIBLE);
  }, [spend, section]);

  const create = async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    try {
      const id = await addGroup(draft.trim());
      onSelect(id);
      setDraft('');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 8 }}>
        Goes to
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {shown.map(s => (
          <Chip key={s.id} meta={s} on={section === s.id} C={C} onPress={() => onSelect(s.id)} />
        ))}
        <Tap
          onPress={() => setOpen(true)}
          accessibilityLabel="More groups"
          style={{
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="plus" size={16} stroke={C.sage} sw={2}/>
        </Tap>
      </View>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}>
          <Text style={{ fontFamily: C.fonts.serif, fontSize: 24, color: C.cream, marginBottom: 12 }}>Goes to</Text>
              {spend.map(s => (
                <Tap
                  key={s.id}
                  onPress={() => { onSelect(s.id); setOpen(false); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: C.hair,
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 16, color: C.cream, fontWeight: section === s.id ? '600' : '400' }}>{s.label}</Text>
                    <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{s.hint}</Text>
                  </View>
                  {section === s.id ? <Icon name="check" size={18} stroke={C.sage} sw={2} /> : null}
                </Tap>
              ))}
              <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 }}>
                New group
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="e.g. Kids"
                  placeholderTextColor={C.muted}
                  onSubmitEditing={create}
                  style={{
                    flex: 1, backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
                    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
                    fontSize: 16, color: C.cream,
                  }}
                />
                <Tap
                  onPress={create}
                  haptic
                  style={{
                    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14,
                    backgroundColor: C.sage, opacity: draft.trim() ? 1 : 0.45,
                  }}
                >
                  <Text style={{ color: C.onPrimary, fontWeight: '600', fontSize: 14 }}>{saving ? '…' : 'Add'}</Text>
                </Tap>
              </View>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

function Chip({
  meta, on, C, onPress,
}: {
  meta: SectionMeta;
  on: boolean;
  C: ReturnType<typeof useTheme>;
  onPress: () => void;
}) {
  return (
    <Tap
      onPress={onPress}
      style={{
        paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12,
        backgroundColor: on ? C.sageGlow : C.surface,
        borderWidth: 0.5, borderColor: on ? C.sage : C.hair,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: on ? '600' : '500', color: on ? C.cream : C.muted }}>
        {meta.label}
      </Text>
    </Tap>
  );
}
