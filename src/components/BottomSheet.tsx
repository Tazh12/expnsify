import React, { useEffect, useRef, useState } from 'react';
import {
  View, Modal, Pressable, ScrollView, Keyboard, Platform,
  useWindowDimensions, Dimensions, StyleSheet,
} from 'react-native';
import { useTheme } from '../theme';

export function BottomSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const C = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const sheetRef = useRef<View>(null);
  const [keyboard, setKeyboard] = useState(0);
  const [below, setBelow] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, e => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const measure = () => {
    if (keyboard > 0) return;
    sheetRef.current?.measureInWindow((_x, y, _w, h) => {
      const gap = Math.round(Dimensions.get('screen').height - (y + h));
      if (gap > 0 && gap < 80) setBelow(gap);
    });
  };

  const bottomPad = (keyboard > 0 ? 0 : below) + 16;
  const scrollMax = Math.max(160, Math.round(windowHeight * 0.9) - 36 - bottomPad - keyboard);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: C.scrimSoft }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View
          ref={sheetRef}
          onLayout={measure}
          style={{
            backgroundColor: C.bgElev,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 0.5,
            borderBottomWidth: 0,
            borderColor: C.hairStrong,
            paddingTop: 12,
            paddingBottom: bottomPad,
            marginBottom: keyboard > 0 ? keyboard : -below,
            overflow: 'hidden',
          }}
        >
          <View style={{
            width: 36, height: 4, borderRadius: 2,
            backgroundColor: C.subtle, alignSelf: 'center', marginBottom: 8,
          }}/>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            bounces={false}
            style={{ maxHeight: scrollMax, flexGrow: 0 }}
            contentContainerStyle={{ flexGrow: 0 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
