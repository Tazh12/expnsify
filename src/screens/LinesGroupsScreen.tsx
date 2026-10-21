import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, Alert, Modal,
} from 'react-native';
import { useTheme } from '../theme';
import { Card, Icon, Tap, EmptyState } from '../components';
import { useBudget } from '../store/useBudget';
import { useBudgetGroups } from '../store/useBudgetGroups';
import { useExpenses } from '../store/useExpenses';
import { useViewMonth } from '../store/useViewMonth';
import { monthKey, monthTitle } from '../services/month';
import type { BudgetLine } from '../store/budgetTypes';

export function LinesGroupsScreen({ onClose }: { onClose: () => void }) {
  const C = useTheme();
  const month = monthKey(useViewMonth(s => s.month));
  const allLines = useBudget(s => s.lines);
  const expenses = useExpenses(s => s.expenses);
  const lines = useMemo(
    () => allLines
      .filter(l => l.month === month)
      .sort((a, b) => a.sortOrder - b.sortOrder || (a.dueDay ?? 99) - (b.dueDay ?? 99) || a.name.localeCompare(b.name)),
    [allLines, month],
  );
  const renameForward = useBudget(s => s.renameForward);
  const stopFrom = useBudget(s => s.stopFrom);
  const moveSectionFrom = useBudget(s => s.moveSectionFrom);
  const groups = useBudgetGroups(s => s.all);
  const renameGroup = useBudgetGroups(s => s.rename);
  const removeGroup = useBudgetGroups(s => s.remove);
  const [renameLine, setRenameLine] = useState<BudgetLine | null>(null);
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [moving, setMoving] = useState<string | null>(null);
  const [destination, setDestination] = useState('variable');

  const saveRename = async () => {
    const name = draft.trim();
    if (!name) return;
    if (renameLine) await renameForward(renameLine.templateKey, month, name);
    if (renameGroupId) await renameGroup(renameGroupId, name);
    setRenameLine(null);
    setRenameGroupId(null);
  };

  const confirmMove = async () => {
    if (!moving) return;
    await moveSectionFrom(moving, destination, month);
    await removeGroup(moving);
    setMoving(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ fontFamily: C.fonts.serif, fontSize: 32, color: C.cream }}>Lines & Groups</Text>
        <Tap onPress={onClose} accessibilityLabel="Close" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={18} stroke={C.muted}/>
        </Tap>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 8 }}>Groups</Text>
        <Card style={{ overflow: 'hidden', marginBottom: 22 }}>
          {groups.map(group => (
            <View key={group.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 0.5, borderBottomColor: C.hair }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: group.color, marginRight: 10 }}/>
              <Text style={{ flex: 1, fontSize: 15, color: C.cream }}>{group.label}</Text>
              {!group.builtin && (
                <>
                  <Tap onPress={() => { setRenameGroupId(group.id); setDraft(group.label); }} accessibilityLabel={`Rename ${group.label}`} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
                    <Text style={{ color: C.link, fontSize: 13 }}>Rename</Text>
                  </Tap>
                  <Tap onPress={() => { setMoving(group.id); setDestination('variable'); }} accessibilityLabel={`Delete ${group.label}`} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
                    <Text style={{ color: C.rose, fontSize: 13 }}>Delete</Text>
                  </Tap>
                </>
              )}
            </View>
          ))}
        </Card>
        {groups.every(g => g.builtin) && (
          <EmptyState icon="tag" title="No custom groups" line="Create one from a line's Goes to picker when you want a section of your own."/>
        )}

        <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 8 }}>This month</Text>
        {groups.map(group => {
          const groupLines = lines.filter(l => l.section === group.id);
          if (groupLines.length === 0) return null;
          return (
            <View key={group.id} style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>{group.label}</Text>
              <Card style={{ overflow: 'hidden' }}>
                {groupLines.map(line => (
                  <View key={line.id} style={{ padding: 14, borderBottomWidth: 0.5, borderBottomColor: C.hair }}>
                    <Text style={{ fontSize: 15, color: C.cream }}>{line.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                      <Tap onPress={() => { setRenameLine(line); setDraft(line.name); }} accessibilityLabel={`Rename ${line.name}`} style={{ minHeight: 44, justifyContent: 'center' }}>
                        <Text style={{ color: C.link, fontSize: 13 }}>Rename</Text>
                      </Tap>
                      <Tap
                        onPress={() => {
                          const siblings = allLines.filter(l => l.templateKey === line.templateKey && l.month === month);
                          const ids = new Set(siblings.map(l => l.id));
                          const linked = expenses.some(e =>
                            e.date.slice(0, 7) === month && (
                              (e.line_id != null && ids.has(e.line_id))
                              || (e.line_id == null && e.category_id === line.templateKey)
                            ),
                          );
                          const blocked = siblings.some(l => l.paid) || linked;
                          const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Stop repeating', onPress: () => stopFrom(line.templateKey, month, false) },
                          ];
                          if (!blocked) {
                            buttons.push({
                              text: 'Remove from this month too',
                              style: 'destructive',
                              onPress: () => stopFrom(line.templateKey, month, true),
                            });
                          }
                          Alert.alert(
                            'Stop repeating',
                            blocked
                              ? `${line.name} stays in ${monthTitle(month)} because it has spending or is already paid. It will not be added to later months.`
                              : `${line.name} stays in ${monthTitle(month)}. It will not be added to later months. You can also remove it from this month, since nothing is logged against it.`,
                            buttons,
                          );
                        }}
                        accessibilityLabel={`Stop repeating ${line.name}`}
                        style={{ minHeight: 44, justifyContent: 'center' }}
                      >
                        <Text style={{ color: C.rose, fontSize: 13 }}>Stop repeating</Text>
                      </Tap>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!renameLine || !!renameGroupId} transparent animationType="fade" onRequestClose={() => { setRenameLine(null); setRenameGroupId(null); }}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: C.scrim }}>
          <View style={{ backgroundColor: C.bgElev, borderRadius: 20, padding: 18 }}>
            <Text style={{ fontFamily: C.fonts.serif, fontSize: 24, color: C.cream, marginBottom: 12 }}>Rename</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              autoFocus
              style={{ borderWidth: 0.5, borderColor: C.hair, borderRadius: 12, padding: 12, color: C.cream, marginBottom: 14 }}
            />
            <Tap onPress={saveRename} style={{ minHeight: 44, borderRadius: 12, backgroundColor: C.sage, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: C.onPrimary, fontWeight: '600' }}>Save</Text>
            </Tap>
          </View>
        </View>
      </Modal>

      <Modal visible={!!moving} transparent animationType="fade" onRequestClose={() => setMoving(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: C.scrim }}>
          <View style={{ backgroundColor: C.bgElev, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
            <Text style={{ fontFamily: C.fonts.serif, fontSize: 24, color: C.cream }}>Move its lines</Text>
            <Text style={{ color: C.muted, marginTop: 6, marginBottom: 12 }}>
              Lines in this month and later months move. Past months stay put.
            </Text>
            {groups.filter(g => g.id !== 'income' && g.id !== moving).map(group => (
              <Tap key={group.id} onPress={() => setDestination(group.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ color: destination === group.id ? C.link : C.text, fontSize: 15 }}>
                  {destination === group.id ? '✓ ' : ''}{group.label}
                </Text>
              </Tap>
            ))}
            <Tap onPress={confirmMove} style={{ marginTop: 12, minHeight: 44, borderRadius: 12, backgroundColor: C.sage, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: C.onPrimary, fontWeight: '600' }}>Move and delete group</Text>
            </Tap>
          </View>
        </View>
      </Modal>
    </View>
  );
}
