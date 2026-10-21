import React, { useEffect, useMemo, useState } from 'react';
import { Text, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { amountStyle, useTheme } from '../theme';
import { Card, CarryIncomeCard, Tap, PageHeader } from '../components';
import { BudgetSection } from '../components/BudgetSection';
import { UpcomingPayments } from '../components/UpcomingPayments';
import { LineEditor } from '../flows/LineEditor';
import { useBudget } from '../store/useBudget';
import { useExpenses } from '../store/useExpenses';
import { useRates } from '../store/useRates';
import { useSettings } from '../store/useSettings';
import { useBudgetGroups } from '../store/useBudgetGroups';
import { fmt } from '../services/format';
import { monthKey } from '../services/month';
import { useViewMonth } from '../store/useViewMonth';
import { incomeCarryOffers, lineActual, summarizeMonth } from '../services/budget';
import { sectionColor } from '../store/budgetTypes';
import { type BudgetLine, type BudgetSection as BudgetSectionId } from '../store/budgetTypes';
import { useLayout } from '../hooks/useLayout';
import { useSaveBudgetLine } from '../hooks/useSaveBudgetLine';

type DeclinedCarry = Record<string, string[]>;

const declinedCarryCache = new Map<string, DeclinedCarry>();

function declinedCarryKey(userId: string) {
  return `@tally:declined-income-carry:${userId}`;
}

async function readDeclinedCarry(userId: string): Promise<DeclinedCarry> {
  const cached = declinedCarryCache.get(userId);
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(declinedCarryKey(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    const saved = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as DeclinedCarry : {};
    declinedCarryCache.set(userId, saved);
    return saved;
  } catch {
    const empty: DeclinedCarry = {};
    declinedCarryCache.set(userId, empty);
    return empty;
  }
}

async function rememberDeclinedCarry(userId: string, month: string, templateKeys: string[]): Promise<DeclinedCarry> {
  const current = declinedCarryCache.get(userId) ?? await readDeclinedCarry(userId);
  const next = {
    ...current,
    [month]: [...new Set([...(current[month] ?? []), ...templateKeys])],
  };
  declinedCarryCache.set(userId, next);
  try {
    await AsyncStorage.setItem(declinedCarryKey(userId), JSON.stringify(next));
  } catch {}
  return next;
}

export function PlanScreen() {
  const C = useTheme();
  const month = useViewMonth(s => s.month);
  const { isWide } = useLayout();
  const key = monthKey(month);
  const { forMonth, ensureMonth, update, remove, loaded, dedupeRepeats, carryIncome, lines: allLines, uid } = useBudget();
  const allMeta = useBudgetGroups(s => s.all);
  const lines = forMonth(key);
  const { expenses } = useExpenses();
  const { convert } = useRates();
  const settings = useSettings();
  const { preferredCurrency } = settings;

  const [editor, setEditor] = useState<{ section: BudgetSectionId; line: BudgetLine | null } | null>(null);
  const [skipCarry, setSkipCarry] = useState<Record<string, boolean>>({});
  const [declinedCarry, setDeclinedCarry] = useState<DeclinedCarry | null>(
    () => (uid ? declinedCarryCache.get(uid) ?? null : null),
  );

  useEffect(() => {
    if (!loaded) return;
    ensureMonth(key)
      .then(() => dedupeRepeats(key))
      .catch(() => {});
  }, [key, loaded]);

  useEffect(() => {
    if (!uid) {
      setDeclinedCarry(null);
      return;
    }
    const cached = declinedCarryCache.get(uid);
    if (cached) {
      setDeclinedCarry(cached);
      return;
    }
    let active = true;
    setDeclinedCarry(null);
    readDeclinedCarry(uid).then(saved => {
      if (active) setDeclinedCarry(saved);
    });
    return () => { active = false; };
  }, [uid]);

  const monthExpenses = useMemo(
    () => expenses.filter(e => e.date.slice(0, 7) === key),
    [expenses, key],
  );

  const actuals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const line of lines) {
      map[line.id] = lineActual(line, monthExpenses, convert);
    }
    return map;
  }, [lines, monthExpenses, convert]);

  const summary = useMemo(
    () => summarizeMonth(lines, monthExpenses, convert),
    [lines, monthExpenses, convert],
  );
  const carryOffers = useMemo(() => {
    if (!declinedCarry || skipCarry[key]) return [];
    const declined = new Set(declinedCarry[key] ?? []);
    return incomeCarryOffers(allLines, key).filter(o => !declined.has(o.templateKey));
  }, [allLines, key, skipCarry, declinedCarry]);

  const left = summary.leftToBudget;
  const leftColor = left < 0 ? C.alertInk : C.success;
  const saveLine = useSaveBudgetLine();

  const togglePaid = async (line: BudgetLine) => {
    await update(line.id, {
      paid: !line.paid,
      paidAt: !line.paid ? new Date().toISOString() : null,
      paidSource: !line.paid ? 'manual' : null,
    });
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: isWide ? 32 : 20,
          paddingBottom: isWide ? 48 : 120,
          maxWidth: isWide ? 1100 : undefined,
          width: '100%' as any,
          alignSelf: isWide ? 'center' : undefined,
        }}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader title="Plan"/>
        <Card style={{ padding: 16, marginTop: 8, marginBottom: 8 }}>
          <Text style={{ fontSize: 15, color: C.text, lineHeight: 22 }}>
            Income <Text style={amountStyle()}>{fmt(summary.expectedIncome, preferredCurrency)}</Text>
            {'  −  '}
            Assigned <Text style={amountStyle()}>{fmt(summary.assigned, preferredCurrency)}</Text>
            {'  =  '}
            <Text style={{ color: leftColor, ...amountStyle('semibold') }}>
              {fmt(left, preferredCurrency)}
            </Text>
            <Text style={{ color: leftColor, fontFamily: C.fonts.semibold }}> to assign</Text>
          </Text>
        </Card>

        {lines.length === 0 && (
          <Tap
            onPress={() => {
              const common: Array<[string, string]> = [
                ['groceries', 'Groceries'],
                ['coffee', 'Coffee'],
                ['dining', 'Dining'],
                ['transport', 'Transport'],
                ['travel', 'Travel'],
                ['home', 'Home'],
                ['software', 'Software'],
                ['health', 'Health'],
              ];
              useBudget.getState().addMany(common.map(([templateKey, name], i) => ({
                month: key,
                section: 'variable',
                name,
                expected: 0,
                currency: preferredCurrency,
                templateKey,
                recurring: true,
                repeatEvery: 'month' as const,
                dueDay: null,
                automated: false,
                notifyDaysBefore: null,
                observation: null,
                actualOverride: null,
                sortOrder: i,
                paid: false,
                paidAt: null,
                paidSource: null,
                color: sectionColor('variable'),
              }))).catch(() => {});
            }}
            accessibilityLabel="Start with common lines"
            style={{ marginBottom: 8 }}
          >
            <Card style={{ padding: 16 }}>
              <Text style={{ fontSize: 15, color: C.link, fontWeight: '600' }}>Start with common lines</Text>
              <Text style={{ marginTop: 4, color: C.muted, fontSize: 13 }}>
                Groceries, coffee, dining, and a few more, at $0 until you fill them in.
              </Text>
            </Card>
          </Tap>
        )}

        <CarryIncomeCard
          month={key}
          offers={carryOffers}
          preferredCurrency={preferredCurrency}
          onAdd={() => {
            carryIncome(key, carryOffers.map(o => o.templateKey)).catch(() => {});
          }}
          onSkip={() => setSkipCarry(s => ({ ...s, [key]: true }))}
          onDecline={() => {
            if (!uid) return;
            const templateKeys = carryOffers.map(o => o.templateKey);
            rememberDeclinedCarry(uid, key, templateKeys).then(setDeclinedCarry);
          }}
        />

        <UpcomingPayments
          lines={lines}
          preferredCurrency={preferredCurrency}
          onPress={(line) => setEditor({ section: line.section, line })}
        />

        {allMeta.map(s => {
          const sectionLines = lines.filter(l => l.section === s.id);
          return (
            <BudgetSection
              key={s.id}
              section={s.id}
              label={s.label}
              hint={s.hint}
              lines={sectionLines}
              actuals={actuals}
              preferredCurrency={preferredCurrency}
              onPressLine={(line) => setEditor({ section: line.section, line })}
              onTogglePaid={togglePaid}
              wide={isWide}
              onAddLine={() => setEditor({ section: s.id as BudgetSectionId, line: null })}
            />
          );
        })}
      </ScrollView>

      <LineEditor
        open={!!editor}
        section={editor?.section ?? 'variable'}
        month={key}
        currency={preferredCurrency}
        initial={editor?.line ?? null}
        existing={lines}
        onSave={saveLine}
        onDelete={editor?.line ? () => remove(editor.line!.id) : undefined}
        onClose={() => setEditor(null)}
      />
    </>
  );
}

export { TxnRow } from '../components/TxnRow';
