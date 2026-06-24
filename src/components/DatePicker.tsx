import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './';
import { Tap } from './';

interface DatePickerProps {
  visible: boolean;
  value: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

export function DatePicker({ visible, value, onSelect, onClose }: DatePickerProps) {
  const C = useTheme();
  const [viewMonth, setViewMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));

  useEffect(() => {
    if (visible) setViewMonth(new Date(value.getFullYear(), value.getMonth(), 1));
  }, [visible]);

  const today = new Date();
  const rows = buildGrid(viewMonth);

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

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{
          backgroundColor: C.bgElev,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          borderWidth: 0.5, borderColor: C.hairStrong,
          padding: 24, paddingBottom: 40,
        }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.hairStrong, alignSelf: 'center', marginBottom: 20 }} />

          {/* Month header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Tap onPress={() => goMonth(-1)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="chev-l" size={16} stroke={C.muted} />
            </Tap>
            <Text style={{ fontFamily: C.fonts.serif, fontSize: 20, color: C.cream }}>
              {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <Tap onPress={() => goMonth(1)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="chev-r" size={16} stroke={C.muted} />
            </Tap>
          </View>

          {/* Weekday labels */}
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>
                {w}
              </Text>
            ))}
          </View>

          {/* Day grid */}
          {rows.map((row, ri) => (
            <View key={ri} style={{ flexDirection: 'row', marginBottom: 4 }}>
              {row.map((day, ci) => {
                if (day === null) return <View key={ci} style={{ flex: 1, aspectRatio: 1 }} />;
                const cellDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
                const selected = isSameDay(cellDate, value);
                const isToday = isSameDay(cellDate, today);
                return (
                  <View key={ci} style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Tap onPress={() => pickDay(day)} style={{
                      width: 36, height: 36, borderRadius: 18,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: selected ? C.sage : 'transparent',
                      borderWidth: isToday && !selected ? 1 : 0,
                      borderColor: C.hairStrong,
                    }}>
                      <Text style={{ fontSize: 14, color: selected ? '#0E0E0C' : C.cream }}>{day}</Text>
                    </Tap>
                  </View>
                );
              })}
            </View>
          ))}

          {/* Today shortcut */}
          <Tap onPress={jumpToday} style={{ marginTop: 12, alignSelf: 'center' }}>
            <Text style={{ fontSize: 13, color: C.sage }}>Jump to today</Text>
          </Tap>
        </View>
      </View>
    </Modal>
  );
}
