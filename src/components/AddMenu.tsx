import React, { useRef, useState } from 'react';
import { View, Text, Modal, Pressable, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme';
import { Tap } from './Tap';
import { Icon } from './Icon';

const MENU_W = 244;

export function AddMenu({
  onAddBudget,
  onAddIncome,
  quiet = false,
}: {
  onAddBudget: () => void;
  onAddIncome: () => void;
  quiet?: boolean;
}) {
  const C = useTheme();
  const { width: winW } = useWindowDimensions();
  const btnRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 56, left: 16 });

  const openMenu = () => {
    btnRef.current?.measureInWindow((x, y, w, h) => {
      let left = x + w - MENU_W;
      if (left < 16) left = 16;
      if (left + MENU_W > winW - 16) left = Math.max(16, winW - 16 - MENU_W);
      setPos({ top: y + h + 8, left });
      setOpen(true);
    });
  };

  const pick = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <View ref={btnRef} collapsable={false}>
        <Tap
          onPress={openMenu}
          haptic
          accessibilityLabel="Add budget or income"
          style={quiet ? {
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 14, paddingVertical: 10, minHeight: 40, borderRadius: 20,
            borderWidth: 1, borderColor: C.hairStrong,
            backgroundColor: C.surface,
          } : {
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: C.sage,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="plus" size={quiet ? 14 : 20} stroke={quiet ? C.sage : '#0E0E0C'} sw={2.2}/>
          {quiet && (
            <Text style={{ fontSize: 13, fontWeight: '600', color: C.cream, letterSpacing: 0.02 }}>
              Add
            </Text>
          )}
        </Tap>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1 }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setOpen(false)}/>
          <View style={{
            position: 'absolute',
            top: pos.top,
            left: pos.left,
            width: MENU_W,
            backgroundColor: C.surface,
            borderRadius: 14,
            borderWidth: 0.5,
            borderColor: C.hairStrong,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: C.isLight ? 0.14 : 0.5,
            shadowRadius: 24,
            elevation: 12,
          }}>
            <MenuRow
              label="Add budget"
              hint="Rent, groceries, anything you spend"
              icon="tag"
              C={C}
              onPress={() => pick(onAddBudget)}
            />
            <View style={{ height: 0.5, backgroundColor: C.hair }}/>
            <MenuRow
              label="Add income"
              hint="Paycheck, freelance, other in"
              icon="wallet"
              C={C}
              onPress={() => pick(onAddIncome)}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

function MenuRow({
  label, hint, icon, C, onPress,
}: {
  label: string;
  hint: string;
  icon: string;
  C: ReturnType<typeof useTheme>;
  onPress: () => void;
}) {
  return (
    <Tap
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 12, paddingHorizontal: 14,
        minHeight: 52,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, color: C.cream, fontWeight: '500' }}>{label}</Text>
        <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{hint}</Text>
      </View>
      <Icon name={icon} size={18} stroke={C.muted}/>
    </Tap>
  );
}
