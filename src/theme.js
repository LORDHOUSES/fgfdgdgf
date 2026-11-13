import { Platform } from 'react-native';

// Palette lifted from the LS music mark: cyan → blue → violet → magenta on near-black.
export const C = {
  bg: '#04050C',
  bg2: '#0A0C1A',
  text: '#F3F4FB',
  dim: 'rgba(243,244,251,0.62)',
  faint: 'rgba(243,244,251,0.36)',
  glass: 'rgba(255,255,255,0.07)',
  glassStrong: 'rgba(255,255,255,0.12)',
  stroke: 'rgba(255,255,255,0.16)',
  strokeSoft: 'rgba(255,255,255,0.08)',
  cyan: '#45D4F8',
  blue: '#4E7DFF',
  violet: '#8C46FF',
  magenta: '#E441FF',
  danger: '#FF5C7A',
};

export const GRAD = [C.cyan, C.blue, C.violet, C.magenta];
export const GRAD_SOFT = ['rgba(69,212,248,0.9)', 'rgba(140,70,255,0.9)', 'rgba(228,65,255,0.9)'];

export const R = { sm: 12, md: 18, lg: 26, xl: 34, pill: 999 };

export const SPRING = { damping: 18, stiffness: 190, mass: 0.9 };
export const SPRING_SOFT = { damping: 22, stiffness: 140, mass: 1 };

export const T = {
  large: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8, color: C.text },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4, color: C.text },
  head: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2, color: C.text },
  body: { fontSize: 15, fontWeight: '500', color: C.text },
  sub: { fontSize: 13, fontWeight: '500', color: C.dim },
  cap: { fontSize: 11.5, fontWeight: '600', color: C.faint },
  num: { fontVariant: ['tabular-nums'] },
};

export const isAndroid = Platform.OS === 'android';
export const CHROME_SPACE = 178; // room lists leave for tab bar + mini player

export function fmtTime(s) {
  if (!s || !isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return m + ':' + (r < 10 ? '0' : '') + r;
}
