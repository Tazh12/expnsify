import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { BottomSheet } from './BottomSheet';
import { useTheme } from '../theme';
import { Icon } from './';
import { Tap } from './';

interface DatePickerProps {
  visible: boolean;
  value: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
  presentation?: 'sheet' | 'popover';
  allowClear?: boolean;
  onClear?: () => void;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildGrid(viewMonth: Date): (number | null)[][] {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export function DatePicker({
  visible, value, onSelect, onClose, presentation = 'sheet', allowClear, onClear,
}: DatePickerProps) {
  const C = useTheme();
  const [viewMonth, setViewMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));

  useEffect(() => {
    if (visible) setViewMonth(new Date(value.getFullYear(), value.getMonth(), 1));
  }, [visible]);

  const today = new Date();
  const rows = buildGrid(viewMonth);
  const popover = presentation === 'popover';

  const goMonth = (delta: number) => {
    setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const pickDay = (day: number) => {
    onSelect(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
    onClose();
  };

  const jumpToday = () => {
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelect(today);
    onClose();
  };

  const calendar = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <Tap
          onPress={() => goMonth(-1)}
          accessibilityLabel="Previous month"
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="chev-l" size={16} stroke={C.muted} />
        </Tap>
        <Text style={{ fontFamily: C.fonts.serif, fontSize: 22, color: C.cream, letterSpacing: -0.3 }}>
          {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        <Tap
          onPress={() => goMonth(1)}
          accessibilityLabel="Next month"
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="chev-r" size={16} stroke={C.muted} />
        </Tap>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
        {WEEKDAYS.map((w, i) => (
          <Text
            key={i}
            style={{
              flex: 1, textAlign: 'center', fontSize: 11, color: C.muted,
              letterSpacing: 0.08, textTransform: 'uppercase', fontWeight: '500',
            }}
          >
            {w}
          </Text>
        ))}
      </View>

      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', marginBottom: 2 }}>
          {row.map((day, ci) => {
            if (day === null) return <View key={ci} style={{ flex: 1, aspectRatio: 1 }} />;
            const cellDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
            const selected = isSameDay(cellDate, value);
            const isToday = isSameDay(cellDate, today);
            return (
              <View key={ci} style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Tap
                  onPress={() => pickDay(day)}
                  accessibilityLabel={cellDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  style={{
                    width: 38, height: 38, borderRadius: 19,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: selected ? C.sage : 'transparent',
                    borderWidth: isToday && !selected ? 1 : 0,
                    borderColor: C.sage,
                  }}
                >
                  <Text style={{
                    fontSize: 15,
                    fontWeight: selected || isToday ? '600' : '400',
                    color: selected ? C.onPrimary : C.cream,
                  }}>
                    {day}
                  </Text>
                </Tap>
              </View>
            );
          })}
        </View>
      ))}

      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: allowClear ? 'space-between' : 'center',
        marginTop: 16,
      }}>
        {allowClear ? (
          <Tap onPress={() => { onClear?.(); onClose(); }} accessibilityLabel="Clear date">
            <Text style={{ fontSize: 13, color: C.muted }}>No date</Text>
          </Tap>
        ) : null}
        <Tap onPress={jumpToday} accessibilityLabel="Jump to today">
          <Text style={{ fontSize: 13, color: C.link }}>Jump to today</Text>
        </Tap>
      </View>
    </>
  );

  if (popover) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 22 }}>
          <BlurView
            intensity={40}
            tint={C.isLight ? 'light' : 'dark'}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={onClose}
          />
          <View style={{
            backgroundColor: C.bgElev,
            borderRadius: 28,
            borderWidth: 0.5,
            borderColor: C.hairStrong,
            padding: 22,
            paddingBottom: 20,
            alignSelf: 'center',
            width: '100%',
            maxWidth: 380,
            ...Platform.select({
              ios: {
                shadowColor: C.shadow,
                shadowOffset: { width: 0, height: 16 },
                shadowOpacity: C.isLight ? 0.12 : 0.4,
                shadowRadius: 28,
              },
              android: { elevation: 18 },
              default: {},
            }),
          }}>
            {calendar}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: 24, paddingBottom: 28 }}>
        {calendar}
      </View>
    </BottomSheet>
  );
}
