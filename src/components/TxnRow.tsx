import React, { useRef } from 'react';
import {
  View, Text, TouchableOpacity, Animated, PanResponder,
} from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { useRates } from '../store/useRates';
import { useSettings } from '../store/useSettings';
import { fmt } from '../services/format';
import type { Expense } from '../store/useExpenses';

const REVEAL_W = 68;
const REVEAL_L = 120;

export function TxnRow({
  t, catMap, isLast = false, onViewDetail, onEdit, onDelete, unbudgeted, overspend,
}: {
  t: Expense;
  catMap: Record<string, { name: string; color: string }>;
  isLast?: boolean;
  onViewDetail?: (t: Expense) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  unbudgeted?: boolean;
  overspend?: boolean;
}) {
  const C = useTheme();
  const { convert } = useRates.getState();
  const { preferredCurrency } = useSettings.getState();
  const convertedAmount = convert(t.amount, t.currency ?? 'USD');
  const showOriginal = !!t.currency && t.currency !== preferredCurrency;
  const cat = catMap[t.category_id] ?? { name: t.category_id, color: C.muted };
  const initial = cat.name[0]?.toUpperCase() ?? '?';
  const warn = unbudgeted || overspend || t.unbudgeted;
  const amountColor = warn ? C.rose : t.type === 'income' ? C.sage : C.cream;

  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef<'none' | 'right' | 'left'>('none');
  const hasRight = onViewDetail != null;
  const hasLeft = onEdit != null || onDelete != null;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        (hasRight || hasLeft) && Math.abs(g.dx) > 3 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        const base = isOpen.current === 'right' ? REVEAL_W : isOpen.current === 'left' ? -REVEAL_L : 0;
        const next = Math.max(
          hasLeft ? -(REVEAL_L + 12) : 0,
          Math.min(hasRight ? (REVEAL_W + 12) : 0, base + g.dx),
        );
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const base = isOpen.current === 'right' ? REVEAL_W : isOpen.current === 'left' ? -REVEAL_L : 0;
        const end = base + g.dx;
        if (hasRight && (end > REVEAL_W * 0.45 || g.vx > 0.5)) {
          Animated.spring(translateX, { toValue: REVEAL_W, useNativeDriver: true, speed: 20, bounciness: 0 }).start();
          isOpen.current = 'right';
        } else if (hasLeft && (end < -(REVEAL_L * 0.45) || g.vx < -0.5)) {
          Animated.spring(translateX, { toValue: -REVEAL_L, useNativeDriver: true, speed: 20, bounciness: 0 }).start();
          isOpen.current = 'left';
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 0 }).start();
          isOpen.current = 'none';
        }
      },
    })
  ).current;

  function close() {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 0 }).start();
    isOpen.current = 'none';
  }

  return (
    <View style={{
      overflow: 'hidden',
      borderBottomWidth: isLast ? 0 : 0.5,
      borderBottomColor: C.hair,
    }}>
      {hasRight && (
        <View style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: REVEAL_W,
          backgroundColor: C.sageGlow,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <TouchableOpacity
            onPress={() => { close(); onViewDetail!(t); }}
            style={{
              width: 42, height: 42, borderRadius: 21,
              backgroundColor: C.sage,
              alignItems: 'center', justifyContent: 'center',
            }}
            activeOpacity={0.8}
          >
            <Icon name="eye" size={18} stroke="#0E0E0C" sw={2}/>
          </TouchableOpacity>
        </View>
      )}

      {hasLeft && (
        <View style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: REVEAL_L,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
          backgroundColor: C.bgElev,
        }}>
          {onEdit && (
            <TouchableOpacity
              onPress={() => { close(); onEdit(); }}
              style={{
                width: 48, height: 48, borderRadius: 24,
                backgroundColor: C.sageGlow, borderWidth: 0.5, borderColor: C.sage,
                alignItems: 'center', justifyContent: 'center',
              }}
              activeOpacity={0.8}
            >
              <Icon name="edit" size={17} stroke={C.sage} sw={1.8}/>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              onPress={() => { close(); onDelete(); }}
              style={{
                width: 48, height: 48, borderRadius: 24,
                backgroundColor: `${C.rose}1a`, borderWidth: 0.5, borderColor: C.rose,
                alignItems: 'center', justifyContent: 'center',
              }}
              activeOpacity={0.8}
            >
              <Icon name="trash" size={17} stroke={C.rose} sw={1.8}/>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Animated.View
        {...((hasRight || hasLeft) ? pan.panHandlers : {})}
        style={[
          { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, paddingHorizontal: 18, backgroundColor: C.bgElev },
          (hasRight || hasLeft) ? { transform: [{ translateX }] } : undefined,
        ]}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={isOpen.current !== 'none' ? close : (onViewDetail ? () => onViewDetail(t) : undefined)}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}
        >
          <View style={{
            width: 36, height: 36, borderRadius: 36 * 0.32,
            backgroundColor: `${cat.color}2e`,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontFamily: C.fonts.serifItalic, fontSize: 18, color: cat.color }}>
              {initial}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, color: C.cream, fontWeight: '500' }} numberOfLines={1}>
              {t.merchant}
            </Text>
            <Text style={{ fontSize: 12, color: warn ? C.rose : C.muted, marginTop: 2 }} numberOfLines={1}>
              {warn ? (unbudgeted || t.unbudgeted ? 'Unbudgeted' : 'Over budget') : cat.name}
              {(t.line_items?.length ?? 0) > 0 ? ` · ${t.line_items.length} item${t.line_items.length === 1 ? '' : 's'}` : ''}
              {t.location?.address ? ` · near ${t.location.address}` : ''}
              {t.note && !warn ? ` · ${t.note}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 15, color: amountColor, fontWeight: '500', fontVariant: ['tabular-nums'] }}>
              {t.type === 'income' ? '+' : ''}{fmt(convertedAmount, preferredCurrency)}
            </Text>
            {showOriginal && (
              <Text style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                {t.currency} {t.amount.toFixed(2)}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
