import React from 'react';
import { ScrollView, Text } from 'react-native';
import { useTheme } from '../theme';
import { PageHeader } from '../components';
import { useLayout } from '../hooks/useLayout';

export function TodayScreen() {
  const C = useTheme();
  const { isWide } = useLayout();

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        padding: isWide ? 32 : 20,
        paddingBottom: isWide ? 48 : 120,
        maxWidth: isWide ? 1100 : undefined,
        width: '100%' as const,
        alignSelf: isWide ? 'center' : undefined,
      }}
    >
      <PageHeader title="Today" tagline="what needs you right now"/>
      <Text style={{ marginTop: 18, color: C.muted, fontSize: 15, lineHeight: 22 }}>
        The plan, activity, and insights are one tap away. This page will show what’s left to spend and what needs you.
      </Text>
    </ScrollView>
  );
}
