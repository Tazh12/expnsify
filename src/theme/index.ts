import React from 'react';

export type PaletteId = 'midnight' | 'cream' | 'carbon';
export type AccentId = 'sage' | 'amber' | 'rose' | 'blue';
export type FontId = 'default' | 'sans' | 'mono' | 'comic';

export const FONT_IDS: FontId[] = ['default', 'sans', 'mono', 'comic'];

export interface FontMap {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
  italic: string;
  serif: string;
  serifItalic: string;
}

export const FONTS: Record<FontId, FontMap> = {
  default: {
    regular:     'Geist_400Regular',
    medium:      'Geist_500Medium',
    semibold:    'Geist_600SemiBold',
    bold:        'Geist_700Bold',
    italic:      'Geist_400Regular',
    serif:       'InstrumentSerif_400Regular',
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

export interface Palette {
  bg: string;
  bgElev: string;
  surface: string;
  surface2: string;
  cream: string;
  muted: string;
  subtle: string;
  hair: string;
  hairStrong: string;
}

export interface Accent {
  sage: string;
  sageDeep: string;
  sageGlow: string;
}

export interface Theme extends Palette, Accent {
  id: PaletteId;
  isLight: boolean;
  amber: string;
  rose: string;
  plum: string;
  sky: string;
  fonts: FontMap;
}

export const PALETTES: Record<PaletteId, Palette> = {
  midnight: {
    bg: '#0E0E0C',
    bgElev: '#161513',
    surface: '#1B1A17',
    surface2: '#232220',
    cream: '#F4EFE6',
    muted: '#8F8A80',
    subtle: '#58544D',
    hair: 'rgba(244,239,230,0.07)',
    hairStrong: 'rgba(244,239,230,0.13)',
  },
  cream: {
    bg: '#F4EFE6',
    bgElev: '#FAF8F2',
    surface: '#FAF8F2',
    surface2: '#EFE9DD',
    cream: '#1F1B16',
    muted: '#7A746A',
    subtle: '#A8A39A',
    hair: 'rgba(31,27,22,0.08)',
    hairStrong: 'rgba(31,27,22,0.16)',
  },
  carbon: {
    bg: '#08080A',
    bgElev: '#121215',
    surface: '#121215',
    surface2: '#1A1A1F',
    cream: '#EDEDF0',
    muted: '#7A7A85',
    subtle: '#4A4A55',
    hair: 'rgba(237,237,240,0.06)',
    hairStrong: 'rgba(237,237,240,0.12)',
  },
};

export const ACCENTS: Record<AccentId, Accent> = {
  sage: {
    sage: '#B8D4B0',
    sageDeep: '#6F8E63',
    sageGlow: 'rgba(184,212,176,0.15)',
  },
  amber: {
    sage: '#E0B872',
    sageDeep: '#9C7B43',
    sageGlow: 'rgba(224,184,114,0.15)',
  },
  rose: {
    sage: '#E0A0A0',
    sageDeep: '#A06868',
    sageGlow: 'rgba(224,160,160,0.15)',
  },
  blue: {
    sage: '#9FB8D4',
    sageDeep: '#6182A6',
    sageGlow: 'rgba(159,184,212,0.15)',
  },
};

const STATIC = {
  amber: '#E0A872',
  rose: '#D9846A',
  plum: '#A47BB9',
  sky: '#7FA6C8',
};

export function buildTheme(paletteId: PaletteId, accentId: AccentId, fontId: FontId = 'default'): Theme {
  return {
    id: paletteId,
    isLight: paletteId === 'cream',
    ...PALETTES[paletteId],
    ...ACCENTS[accentId],
    ...STATIC,
    fonts: FONTS[fontId] ?? FONTS.default,
  };
}

export const ThemeContext = React.createContext<Theme>(buildTheme('midnight', 'sage', 'default'));

export function useTheme(): Theme {
  return React.useContext(ThemeContext);
}

export const SWATCHES = [
  '#B8D4B0', '#E0A872', '#D9846A', '#A47BB9', '#7FA6C8',
  '#E8C570', '#6F8E63', '#C9A0DC', '#F0B5A5', '#9FB8D4',
  '#D4B896', '#A8C4A0',
];
