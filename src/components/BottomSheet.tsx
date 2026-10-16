import React from 'react';
import {
  View, Modal, Pressable, KeyboardAvoidingView, Platform,
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{
            backgroundColor: C.bgElev,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 0.5,
            borderColor: C.hairStrong,
            paddingTop: 12,
            paddingBottom: Platform.OS === 'ios' ? 28 : 16,
            maxHeight: '92%',
          }}>
            <View style={{
              width: 36, height: 4, borderRadius: 2,
              backgroundColor: C.subtle, alignSelf: 'center', marginBottom: 8,
            }}/>
            {children}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
