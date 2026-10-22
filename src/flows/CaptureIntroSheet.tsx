import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../theme';
import { BottomSheet, Tap, Toggle } from '../components';

/** Shown once, on the first tap of the capture button. */
export function CaptureIntroSheet({
  open, onClose, onContinue,
}: {
  open: boolean;
  onClose: () => void;
  onContinue: (openCameraRightAway: boolean) => void;
}) {
  const C = useTheme();
  const [on, setOn] = useState(true);

  useEffect(() => { if (open) setOn(true); }, [open]);

  return (
    <BottomSheet visible={open} onClose={onClose}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Text style={{ fontFamily: C.fonts.serif, fontSize: 26, color: C.cream, letterSpacing: -0.3 }}>
          Straight to the camera?
        </Text>
        <Text style={{ fontSize: 15, lineHeight: 22, color: C.cream, marginTop: 10 }}>
          This button opens the camera, so a receipt takes one tap. Turn it off to choose each time:
          scan a receipt, say it, type it or upload a PDF.
        </Text>

        <Pressable
          onPress={() => setOn(v => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: on }}
          accessibilityLabel="Open camera right away"
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            marginTop: 22, paddingVertical: 14, paddingHorizontal: 16,
            borderRadius: 16, backgroundColor: C.surface2,
          }}
        >
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '500', color: C.cream }}>Open camera right away</Text>
          <Toggle on={on} onChange={setOn}/>
        </Pressable>
        <Text style={{ fontSize: 13, color: C.muted, marginTop: 10, marginHorizontal: 4 }}>
          You can change this any time in Settings.
        </Text>

        <Tap
          onPress={() => onContinue(on)}
          haptic
          accessibilityRole="button"
          style={{
            marginTop: 22, height: 56, borderRadius: 16, backgroundColor: C.sage,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: C.onPrimary }}>Continue</Text>
        </Tap>
      </View>
    </BottomSheet>
  );
}
