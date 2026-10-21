// Locked themes unlock with Pro later via usePro().

export type PaletteId = 'forest' | 'plum' | 'saffron' | 'alpine' | 'olive';

export interface PaletteTokens {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  accent: string;
  /** Over budget. Text uses a contrast-safe ink derived from this hue. */
  alert: string;
  /** On track. */
  success: string;
  text: string;
  mutedText: string;
  border: string;
  locked: boolean;
}

export const PALETTES: Record<PaletteId, PaletteTokens> = {
  forest: {
    background: '#FBF6EA',
    surface: '#FFFCF6',
    primary: '#2A4343',
    secondary: '#416B66',
    accent: '#F1D49A',
    alert: '#D35E36',
    success: '#1E6B45',
    text: '#2A4343',
    mutedText: '#646756',
    border: '#C0C29D',
    locked: false,
  },
  plum: {
    background: '#2B2238',
    surface: '#3A3049',
    primary: '#8E7DBE',
    secondary: '#6B5F80',
    accent: '#F2B134',
    alert: '#D9534F',
    success: '#7DCEA0',
    text: '#F7F3F9',
    mutedText: '#C9BFD6',
    border: '#6B5F80',
    locked: false,
  },
  saffron: {
    background: '#EEF8FB',
    surface: '#C3E7F1',
    primary: '#519CAB',
    secondary: '#20373B',
    accent: '#FFC64F',
    alert: '#C2410C',
    success: '#1E6B4A',
    text: '#20373B',
    mutedText: '#3E5960',
    border: '#8EC4D2',
    locked: true,
  },
  alpine: {
    background: '#F5F1E8',
    surface: '#FFFCFA',
    primary: '#1F3A5F',
    secondary: '#3D5A80',
    accent: '#7FB7A4',
    alert: '#E07A5F',
    success: '#2C6B52',
    text: '#1F3A5F',
    mutedText: '#5B6475',
    border: '#A3A9B5',
    locked: true,
  },
  olive: {
    background: '#F4EFE3',
    surface: '#FFFCF7',
    primary: '#3D4A2E',
    secondary: '#8C9A7A',
    accent: '#C9A227',
    alert: '#B5523B',
    success: '#3F6A38',
    text: '#3D4A2E',
    mutedText: '#5F6652',
    border: '#D3CBBA',
    locked: true,
  },
};

export const THEME_OPTIONS: { id: PaletteId; label: string }[] = [
  { id: 'forest', label: 'Forest' },
  { id: 'plum', label: 'Plum night' },
  { id: 'saffron', label: 'Saffron' },
  { id: 'alpine', label: 'Alpine' },
  { id: 'olive', label: 'Olive grove' },
];

export function paletteSwatches(id: PaletteId): [string, string, string] {
  const p = PALETTES[id];
  return [p.background, p.primary, p.accent];
}

/** Cream and any other light theme become Forest. Midnight and Carbon become Plum night. */
export function migratePalette(saved: unknown): PaletteId {
  if (saved === 'midnight' || saved === 'carbon' || saved === 'plum') return 'plum';
  if (saved === 'forest') return 'forest';
  return 'forest';
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number {
  const hi = Math.max(luminance(fg), luminance(bg));
  const lo = Math.min(luminance(fg), luminance(bg));
  return (hi + 0.05) / (lo + 0.05);
}

export function isLightColor(hex: string): boolean {
  return luminance(hex) > 0.4;
}

export function mix(a: string, b: string, t: number): string {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((na >> shift) & 255) * (1 - t) + ((nb >> shift) & 255) * t);
  const r = ch(16);
  const g = ch(8);
  const bl = ch(0);
  return `#${[r, g, bl].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Step `color` toward `toward` until it clears WCAG AA on every background. */
export function readableOn(color: string, backgrounds: string[], toward: string): string {
  if (backgrounds.every(bg => contrastRatio(color, bg) >= 4.5)) return color;
  let best = color;
  for (let i = 1; i <= 24; i++) {
    const next = mix(color, toward, i / 24);
    best = next;
    if (backgrounds.every(bg => contrastRatio(next, bg) >= 4.5)) return next;
  }
  return best;
}

export function inkForFill(fill: string, light: string, dark: string): string {
  if (contrastRatio(light, fill) >= 4.5) return light;
  if (contrastRatio(dark, fill) >= 4.5) return dark;
  return readableOn(dark, [fill], '#000000');
}

/** Brand color that stays AA as small text on background and surface. */
export function linkFor(p: PaletteTokens): string {
  const bgs = [p.background, p.surface];
  if (bgs.every(bg => contrastRatio(p.primary, bg) >= 4.5)) return p.primary;
  if (bgs.every(bg => contrastRatio(p.accent, bg) >= 4.5)) return p.accent;
  if (bgs.every(bg => contrastRatio(p.text, bg) >= 4.5)) return p.text;
  const toward = isLightColor(p.background) ? '#000000' : '#FFFFFF';
  return readableOn(p.primary, bgs, toward);
}

export function alertInkFor(p: PaletteTokens): string {
  const toward = isLightColor(p.background) ? '#000000' : '#FFFFFF';
  return readableOn(p.alert, [p.background, p.surface], toward);
}
