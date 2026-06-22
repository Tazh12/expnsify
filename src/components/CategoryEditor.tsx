import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTheme, SWATCHES } from '../theme';
import { Tap } from './Tap';
import { Icon } from './Icon';

interface Props {
  visible: boolean;
  initial?: { name?: string; color?: string };
  onSave: (name: string, color: string) => void;
  onCancel: () => void;
}

export function CategoryEditor({ visible, initial, onSave, onCancel }: Props) {
  const C = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? SWATCHES[0]);

  React.useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setColor(initial?.color ?? SWATCHES[0]);
    }
  }, [visible]);

  const canSave = name.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onCancel}
        />
        <View style={{
          backgroundColor: C.bgElev,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          borderWidth: 0.5, borderColor: C.hairStrong,
          padding: 24, paddingBottom: 40,
        }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.hairStrong, alignSelf: 'center', marginBottom: 20 }}/>

          <Text style={{ fontFamily: C.fonts.serif, fontSize: 24, color: C.cream, marginBottom: 20 }}>
            {initial?.name ? 'Edit category' : 'New category'}
          </Text>

          <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 8 }}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Gym, Books, Subscriptions"
            placeholderTextColor={C.subtle}
            autoFocus
            style={{
              backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hairStrong,
              borderRadius: 12, padding: 14, fontSize: 15, color: C.cream,
              fontFamily: C.fonts.regular, marginBottom: 20,
            }}
          />

          <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 10 }}>Color</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {SWATCHES.map(s => (
              <TouchableOpacity key={s} onPress={() => setColor(s)} style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: s,
                borderWidth: color === s ? 3 : 0,
                borderColor: C.cream,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {color === s && <Icon name="check" size={16} stroke="#0E0E0C" sw={2.5}/>}
              </TouchableOpacity>
            ))}
          </View>

          <Tap onPress={() => canSave && onSave(name.trim(), color)} haptic style={{
            height: 52, borderRadius: 16,
            backgroundColor: canSave ? C.sage : C.surface2,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: canSave ? '#0E0E0C' : C.muted }}>
              Save category
            </Text>
          </Tap>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
