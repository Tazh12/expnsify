import React from 'react';
import { TextStyle } from 'react-native';
import {
  PALETTES,
  alertInkFor,
  inkForFill,
  isLightColor,
  linkFor,
  migratePalette,
  mix,
  withAlpha,
  type PaletteId,
  type PaletteTokens,
} from './palettes';

export type { PaletteId, PaletteTokens };
export {
  PALETTES,
  THEME_OPTIONS,
  alertInkFor,
  contrastRatio,
  linkFor,
  migratePalette,
  paletteSwatches,
} from './palettes';

export type FontId = 'vadri' | 'default' | 'sans' | 'mono' | 'comic';

export const FONT_IDS: FontId[] = ['vadri', 'default', 'sans', 'mono', 'comic'];

export interface FontMap {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
  italic: string;
  serif: string;
  serifItalic: string;
}

const GEIST_BODY = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  italic: 'Geist_400Regular',
};

export const FONTS: Record<FontId, FontMap> = {
  // Headings and the wordmark are Bodoni. Body and small labels stay Geist so small sizes stay clear.
  vadri: {
    ...GEIST_BODY,
    serif: 'BodoniModa-SemiBold',
    serifItalic: 'BodoniModa-SemiBoldItalic',
  },
  default: {
    ...GEIST_BODY,
    serif: 'InstrumentSerif_400Regular',
    serifItalic: 'InstrumentSerif_400Regular_Italic',
  },
  sans: {
    regular:     'Geist_400Regular',
    medium:      'Geist_500Medium',
    semibold:    'Geist_600SemiBold',
    bold:        'Geist_700Bold',
    italic:      'Geist_400Regular',
    serif:       'Geist_600SemiBold',
    serifItalic: 'Geist_400Regular',
  },
  mono: {
    regular:     'GeistMono_400Regular',
    medium:      'GeistMono_500Medium',
    semibold:    'GeistMono_500Medium',
    bold:        'GeistMono_500Medium',
    italic:      'GeistMono_400Regular',
    serif:       'GeistMono_400Regular',
    serifItalic: 'GeistMono_400Regular',
  },
  comic: {
    regular:     'ComicNeue_400Regular',
    medium:      'ComicNeue_400Regular',
    semibold:    'ComicNeue_700Bold',
    bold:        'ComicNeue_700Bold',
    italic:      'ComicNeue_400Regular_Italic',
    serif:       'ComicNeue_700Bold',
    serifItalic: 'ComicNeue_400Regular_Italic',
  },
};

/** Amounts stay in Geist, the numeric face, with tabular figures in every font style. */
export function amountStyle(weight: 'regular' | 'medium' | 'semibold' | 'bold' = 'medium'): TextStyle {
  return {
    fontFamily: FONTS.default[weight],
    fontVariant: ['tabular-nums'],
  };
}

export interface Theme extends PaletteTokens {
  id: PaletteId;
  isLight: boolean;
  onPrimary: string;
  onAccent: string;
  onSuccess: string;
  /** Small text in the brand hue. Matches primary when that already clears WCAG AA. */
  link: string;
  /** Alert hue darkened or lightened until small text clears WCAG AA. */
  alertInk: string;
  surfaceMuted: string;
  primarySoft: string;
  scrim: string;
  scrimSoft: string;
  shadow: string;
  hair: string;
  hairStrong: string;
  glassTop: string;
  glassBottom: string;
  glassStroke: string;
  glassFill: string;
  fonts: FontMap;
  bg: string;
  bgElev: string;
  surface2: string;
  cream: string;
  muted: string;
  subtle: string;
  sage: string;
  sageDeep: string;
  sageGlow: string;
  rose: string;
  amber: string;
}

export function buildTheme(paletteId: unknown, fontId: FontId = 'default'): Theme {
  const id = migratePalette(paletteId);
  const palette = PALETTES[id];
  const isLight = isLightColor(palette.background);
  const alertInk = alertInkFor(palette);
  const link = linkFor(palette);
  const onPrimary = inkForFill(palette.primary, palette.background, isLight ? '#000000' : palette.background);
  const onAccent = inkForFill(palette.accent, palette.text, palette.background);
  const onSuccess = inkForFill(palette.success, palette.background, palette.text);
  const surfaceMuted = mix(palette.surface, palette.border, 0.28);
  const hair = palette.border;
  const hairStrong = mix(palette.border, palette.mutedText, 0.35);
  const primarySoft = withAlpha(palette.primary, 0.15);

  return {
    ...palette,
    id,
    isLight,
    onPrimary,
    onAccent,
    onSuccess,
    link,
    alertInk,
    surfaceMuted,
    primarySoft,
    scrim: withAlpha('#000000', 0.45),
    scrimSoft: withAlpha('#000000', 0.35),
    shadow: '#000000',
    hair,
    hairStrong,
    glassTop: withAlpha('#FFFFFF', isLight ? 0.65 : 0.1),
    glassBottom: withAlpha('#FFFFFF', isLight ? 0.22 : 0),
    glassStroke: isLight ? withAlpha('#FFFFFF', 0.7) : hairStrong,
    glassFill: withAlpha('#FFFFFF', isLight ? 0.3 : 0.06),
    fonts: FONTS[fontId] ?? FONTS.vadri,
    bg: palette.background,
    bgElev: palette.surface,
    surface2: surfaceMuted,
    cream: palette.text,
    muted: palette.mutedText,
    subtle: mix(palette.mutedText, palette.background, 0.35),
    sage: palette.primary,
    sageDeep: palette.secondary,
    sageGlow: primarySoft,
    rose: alertInk,
    amber: palette.accent,
  };
}

export const ThemeContext = React.createContext<Theme>(buildTheme('forest', 'vadri'));

export function useTheme(): Theme {
  return React.useContext(ThemeContext);
}

export const SWATCHES = [
  '#B8D4B0', '#E0A872', '#D9846A', '#A47BB9', '#7FA6C8',
  '#E8C570', '#6F8E63', '#C9A0DC', '#F0B5A5', '#9FB8D4',
  '#D4B896', '#A8C4A0',
];
