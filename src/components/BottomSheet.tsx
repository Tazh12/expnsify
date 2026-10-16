import React from 'react';
import {
  View, Modal, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
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
      <BlurView
        intensity={40}
        tint={C.isLight ? 'light' : 'dark'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
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
            maxHeight: '88%',
          }}>
            <View style={{
              width: 36, height: 4, borderRadius: 2,
              backgroundColor: C.subtle, alignSelf: 'center', marginBottom: 8,
            }}/>
            {children}
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
}
