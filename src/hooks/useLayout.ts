import { useWindowDimensions } from 'react-native';

export const WIDE_BREAKPOINT = 900;

export function useLayout() {
  const { width, height } = useWindowDimensions();
  return { width, height, isWide: width >= WIDE_BREAKPOINT };
}
