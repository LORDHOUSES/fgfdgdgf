import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T } from '../theme';

// iOS-style large title: as the big heading scrolls away, a compact one settles into the top bar.
export function useCollapsing(title) {
  const insets = useSafeAreaInsets();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const bar = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [34, 76], [0, 1], Extrapolation.CLAMP) }));
  const label = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(y.value, [34, 76], [10, 0], Extrapolation.CLAMP) }] }));
  const Bar = (
    <Animated.View pointerEvents="none" style={[st.bar, { height: insets.top + 46, paddingTop: insets.top }, bar]}>
      <LinearGradient colors={['rgba(6,8,18,0.98)', 'rgba(6,8,18,0.9)']} style={StyleSheet.absoluteFill} />
      <Animated.View style={label}>
        <Text style={T.head} numberOfLines={1}>{title}</Text>
      </Animated.View>
    </Animated.View>
  );
  return { onScroll, Bar };
}

const st = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.stroke, overflow: 'hidden', zIndex: 5 },
});
