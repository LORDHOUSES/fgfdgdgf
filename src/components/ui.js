import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInUp, FadeOutUp, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, GRAD, R, SPRING, T, isAndroid } from '../theme';

const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);

export function tap(kind) {
  try {
    if (kind === 'strong') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else Haptics.selectionAsync();
  } catch (e) {}
}

export function UIProvider({ children, blurTarget }) {
  const [toast, setToast] = useState(null);
  const [menu, setMenu] = useState(null); // { track, playlistId }
  const [playerOpen, setPlayerOpen] = useState(false);
  const timer = useRef(null);
  const insets = useSafeAreaInsets();

  const showToast = useCallback((text) => {
    clearTimeout(timer.current);
    setToast({ text, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2400);
  }, []);
  const openMenu = useCallback((track, extra) => {
    tap('strong');
    setMenu({ track, ...(extra || {}) });
  }, []);
  const closeMenu = useCallback(() => setMenu(null), []);

  const value = useMemo(
    () => ({ blurTarget, toast: showToast, menu, openMenu, closeMenu, playerOpen, setPlayerOpen }),
    [blurTarget, showToast, menu, openMenu, closeMenu, playerOpen]
  );

  return (
    <UICtx.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View key={toast.id} entering={FadeInUp.springify().damping(18)} exiting={FadeOutUp.duration(180)} pointerEvents="none" style={[st.toastWrap, { top: insets.top + 10 }]}>
          <View style={st.toast}>
            <Text style={[T.body, { textAlign: 'center' }]} numberOfLines={2}>{toast.text}</Text>
          </View>
        </Animated.View>
      ) : null}
    </UICtx.Provider>
  );
}

// Translucent surface. `floating` surfaces sit above the scrolling content and blur it.
export function Glass({ style, children, floating, radius = R.lg, intensity = 55 }) {
  const ui = useUI();
  return (
    <View style={[st.glass, { borderRadius: radius, backgroundColor: floating ? (isAndroid ? 'rgba(12,14,28,0.62)' : 'rgba(12,14,28,0.3)') : C.glass }, style]}>
      {floating ? (
        <BlurView tint="systemChromeMaterialDark" intensity={intensity} blurTarget={ui && ui.blurTarget} blurMethod="dimezisBlurViewSdk31Plus" style={StyleSheet.absoluteFill} />
      ) : null}
      <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.13)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)']} locations={[0, 0.45, 1]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

const APress = Animated.createAnimatedComponent(Pressable);

// Pressable that sinks slightly under the finger, the way iOS controls do.
export function Press({ children, style, onPress, onLongPress, haptic, scaleTo = 0.96, hitSlop, disabled, accessibilityLabel }) {
  const v = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: v.value }] }));
  return (
    <APress
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => {
        v.value = withSpring(scaleTo, { damping: 20, stiffness: 400 });
      }}
      onPressOut={() => {
        v.value = withSpring(1, SPRING);
      }}
      onPress={() => {
        if (haptic) tap(haptic === true ? 'soft' : haptic);
        onPress && onPress();
      }}
      onLongPress={onLongPress}
      delayLongPress={320}
      style={[style, a]}
    >
      {children}
    </APress>
  );
}

export function IconBtn({ name, size = 22, color = C.text, onPress, style, haptic = true, label, box = 44 }) {
  return (
    <Press onPress={onPress} haptic={haptic} scaleTo={0.86} hitSlop={6} accessibilityLabel={label} style={[{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Ionicons name={name} size={size} color={color} />
    </Press>
  );
}

export function Chip({ label, active, onPress, icon }) {
  return (
    <Press onPress={onPress} haptic scaleTo={0.94} style={[st.chip, active && st.chipOn]}>
      {active ? <LinearGradient colors={[C.blue, C.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
      {icon ? <Ionicons name={icon} size={15} color={C.text} style={{ marginRight: 6 }} /> : null}
      <Text style={[T.sub, { color: active ? '#fff' : C.dim, fontWeight: '600' }]}>{label}</Text>
    </Press>
  );
}

const BAR_H = [0.36, 0.72, 1, 0.72, 0.36];

function Bar({ i, active, width, height, color }) {
  const v = useSharedValue(BAR_H[i]);
  useEffect(() => {
    if (active) {
      const lo = 0.25 + (i % 2) * 0.12;
      v.value = withDelay(
        i * 90,
        withRepeat(withSequence(withTiming(1, { duration: 380 + i * 60, easing: Easing.inOut(Easing.quad) }), withTiming(lo, { duration: 420 + i * 45, easing: Easing.inOut(Easing.quad) })), -1, true)
      );
    } else {
      v.value = withSpring(BAR_H[i], SPRING);
    }
  }, [active]);
  const a = useAnimatedStyle(() => ({ transform: [{ scaleY: v.value }] }));
  return <Animated.View style={[{ width, height, borderRadius: width / 2, backgroundColor: color, marginHorizontal: width * 0.3 }, a]} />;
}

// The five pills from the app mark. Still when idle, dancing while a song plays.
const BAR_COLORS = [C.cyan, '#48A6FB', C.blue, C.violet, C.magenta];
export function Bars({ active, size = 18, mono }) {
  const w = size / 6.2;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: size }}>
      {BAR_H.map((_, i) => (
        <Bar key={i} i={i} active={active} width={w} height={size} color={mono || BAR_COLORS[i]} />
      ))}
    </View>
  );
}

export function Artwork({ uri, size, radius, style }) {
  const r = radius == null ? Math.max(8, size * 0.2) : radius;
  return (
    <View style={[{ width: size, height: size, borderRadius: r, overflow: 'hidden', backgroundColor: C.bg2 }, style]}>
      <LinearGradient colors={['#12204A', '#2A1560', '#4A1466']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Bars size={size * 0.38} />
      </View>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} recyclingKey={uri} /> : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: r, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke }]} />
    </View>
  );
}

export function GradButton({ label, icon, onPress, style, ghost }) {
  return (
    <Press onPress={onPress} haptic="strong" style={[st.btn, ghost && st.btnGhost, style]}>
      {ghost ? null : <LinearGradient colors={GRAD} start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 0.8 }} style={StyleSheet.absoluteFill} />}
      {icon ? <Ionicons name={icon} size={17} color="#fff" style={{ marginRight: 8 }} /> : null}
      <Text style={[T.body, { color: '#fff', fontWeight: '700', flexShrink: 1 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>
    </Press>
  );
}

export function Empty({ icon = 'musical-notes-outline', text, children }) {
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 36, paddingTop: 56 }}>
      <View style={st.emptyIcon}>
        <Ionicons name={icon} size={30} color={C.dim} />
      </View>
      <Text style={[T.body, { color: C.dim, textAlign: 'center', lineHeight: 22, marginTop: 16 }]}>{text}</Text>
      {children ? <View style={{ marginTop: 20, alignSelf: 'stretch' }}>{children}</View> : null}
    </View>
  );
}

const st = StyleSheet.create({
  glass: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: R.pill, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', backgroundColor: C.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: C.strokeSoft, marginRight: 8 },
  chipOn: { borderColor: 'rgba(255,255,255,0.3)' },
  btn: { height: 50, borderRadius: R.pill, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  btnGhost: { backgroundColor: C.glassStrong, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: C.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  toastWrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center', zIndex: 999, elevation: 999 },
  toast: { maxWidth: 420, paddingHorizontal: 18, paddingVertical: 12, borderRadius: R.pill, backgroundColor: 'rgba(22,25,46,0.97)', borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
});
