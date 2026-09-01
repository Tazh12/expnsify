import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

interface IconProps {
  name: string;
  size?: number;
  stroke?: string;
  fill?: string;
  sw?: number;
}

export function Icon({ name, size = 20, stroke = 'currentColor', fill = 'none', sw = 1.6 }: IconProps) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill, stroke, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (name) {
    case 'home':
      return <Svg {...props}><Path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2v-9z"/></Svg>;
    case 'list':
      return <Svg {...props}><Path d="M8 6h13M8 12h13M8 18h13"/><Circle cx="4" cy="6" r="0.8" fill={stroke}/><Circle cx="4" cy="12" r="0.8" fill={stroke}/><Circle cx="4" cy="18" r="0.8" fill={stroke}/></Svg>;
    case 'chart':
      return <Svg {...props}><Path d="M3 3v18h18"/><Path d="M7 14l3-3 3 3 5-6"/></Svg>;
    case 'gear':
      return <Svg {...props}><Circle cx="12" cy="12" r="3"/><Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Svg>;
    case 'plus':
      return <Svg {...props}><Path d="M12 5v14M5 12h14"/></Svg>;
    case 'x':
      return <Svg {...props}><Path d="M18 6L6 18M6 6l12 12"/></Svg>;
    case 'check':
      return <Svg {...props}><Path d="M20 6L9 17l-5-5"/></Svg>;
    case 'chev-l':
      return <Svg {...props}><Path d="M15 18l-6-6 6-6"/></Svg>;
    case 'chev-r':
      return <Svg {...props}><Path d="M9 18l6-6-6-6"/></Svg>;
    case 'chev-d':
      return <Svg {...props}><Path d="M6 9l6 6 6-6"/></Svg>;
    case 'cam':
      return <Svg {...props}><Path d="M14.5 4l1.5 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l1.5-2z"/><Circle cx="12" cy="13" r="4"/></Svg>;
    case 'image':
      return <Svg {...props}><Rect x="3" y="3" width="18" height="18" rx="2"/><Circle cx="8.5" cy="8.5" r="1.5"/><Path d="M21 15l-5-5L5 21"/></Svg>;
    case 'doc':
      return <Svg {...props}><Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><Path d="M14 2v6h6M9 13h6M9 17h6"/></Svg>;
    case 'mic':
      return <Svg {...props}><Rect x="9" y="2" width="6" height="13" rx="3"/><Path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></Svg>;
    case 'sparkles':
      return <Svg {...props}><Path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5zM19 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM5 14l.7 1.5L7 16l-1.3.5L5 18l-.7-1.5L3 16l1.3-.5L5 14z"/></Svg>;
    case 'search':
      return <Svg {...props}><Circle cx="11" cy="11" r="7"/><Path d="M21 21l-4.3-4.3"/></Svg>;
    case 'filter':
      return <Svg {...props}><Path d="M3 6h18M6 12h12M10 18h4"/></Svg>;
    case 'wallet':
      return <Svg {...props}><Path d="M3 7a2 2 0 0 1 2-2h13v4H5a2 2 0 0 1-2-2zM3 7v10a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><Circle cx="17" cy="13" r="1" fill={stroke}/></Svg>;
    case 'tag':
      return <Svg {...props}><Path d="M20 12l-8 8-9-9V3h8z"/><Circle cx="7.5" cy="7.5" r="1.2" fill={stroke}/></Svg>;
    case 'bell':
      return <Svg {...props}><Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9zM10 21a2 2 0 0 0 4 0"/></Svg>;
    case 'export':
      return <Svg {...props}><Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></Svg>;
    case 'trash':
      return <Svg {...props}><Path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></Svg>;
    case 'edit':
      return <Svg {...props}><Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><Path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></Svg>;
    case 'arr-r':
      return <Svg {...props}><Path d="M5 12h14M13 6l6 6-6 6"/></Svg>;
    case 'eye':
      return <Svg {...props}><Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><Circle cx="12" cy="12" r="3"/></Svg>;
    case 'receipt':
      return <Svg {...props}><Path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><Path d="M9 8h6M9 12h6M9 16h4"/></Svg>;
    case 'cal':
      return <Svg {...props}><Rect x="3" y="5" width="18" height="16" rx="2"/><Path d="M8 3v4M16 3v4M3 10h18"/></Svg>;
    default:
      return null;
  }
}
