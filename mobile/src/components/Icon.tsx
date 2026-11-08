import React from 'react';
import { View } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { colors } from '../theme';

export type IconName =
  | 'arrow-left'
  | 'arrow-right'
  | 'arrow-up'
  | 'camera'
  | 'camera-flip'
  | 'check'
  | 'chevron-down'
  | 'chevron-up'
  | 'close'
  | 'edit'
  | 'error-circle'
  | 'eye'
  | 'find'
  | 'globe'
  | 'home'
  | 'info'
  | 'keyboard'
  | 'mic'
  | 'mic-off'
  | 'message'
  | 'pause'
  | 'play'
  | 'plus'
  | 'refresh'
  | 'repeat'
  | 'scan'
  | 'search'
  | 'settings'
  | 'speaker'
  | 'speaker-off'
  | 'stop'
  | 'swap'
  | 'trash'
  | 'volume'
  | 'warning'
  | 'zap';

/**
 * Path data for each icon.  All icons are drawn on a 24x24 viewBox
 * and use stroke-based line icons (Lucide-style) for a clean look.
 */
const PATHS: Record<IconName, string> = {
  'arrow-left': 'M19 12H5m0 0l7 7m-7-7l7-7',
  'arrow-right': 'M5 12h14m0 0l-7-7m7 7l-7 7',
  'arrow-up': 'M12 19V5m0 0l-7 7m7-7l7 7',
  camera:
    'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z',
  'camera-flip':
    'M7 2l-4 4 4 4M17 22l4-4-4-4M1 6h15a4 4 0 014 4v1M23 18H8a4 4 0 01-4-4v-1',
  check: 'M20 6L9 17l-5-5',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-up': 'M18 15l-6-6-6 6',
  close: 'M18 6L6 18M6 6l12 12',
  edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7',
  'error-circle':
    'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v4m0 4h.01',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 100-6 3 3 0 000 6z',
  find: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35',
  globe:
    'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z',
  home: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  info: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 16v-4m0-4h.01',
  keyboard:
    'M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8',
  mic: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8',
  'mic-off':
    'M1 1l22 22M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6M17 16.95A7 7 0 015 12v-2m14 0v2c0 .76-.12 1.5-.35 2.18M12 19v4m-4 0h8',
  message:
    'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  play: 'M5 3l14 9-14 9V3z',
  plus: 'M12 5v14m-7-7h14',
  refresh:
    'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  repeat: 'M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3',
  scan: 'M7 3H5a2 2 0 00-2 2v2m14-4h2a2 2 0 012 2v2M3 17v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2v-2M8 12h8',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  speaker:
    'M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07',
  'speaker-off':
    'M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6',
  stop: 'M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z',
  swap: 'M7 16l-4-4 4-4M17 8l4 4-4 4M3 12h18',
  trash:
    'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2',
  volume:
    'M11 5L6 9H2v6h4l5 4V5z',
  warning:
    'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8',
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** accessibility label — required for icon-only buttons */
  accessibilityLabel?: string;
}

/**
 * Lightweight SVG icon component.  Uses stroke-based Lucide-style paths
 * rendered via react-native-svg.  No external icon library dependency.
 */
export function Icon({
  name,
  size = 20,
  color = colors.textPrimary,
  accessibilityLabel,
}: IconProps) {
  const pathData = PATHS[name];
  if (!pathData) return null;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      style={{ width: size, height: size }}
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d={pathData} />
      </Svg>
    </View>
  );
}

