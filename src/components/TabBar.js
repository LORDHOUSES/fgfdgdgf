import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { C, R, SPRING } from '../theme';
import { useI18n } from '../i18n';
import { Glass, Press } from './ui';

export const TABS = [
  { key: 'discover', icon: 'compass' },
  { key: 'search', icon: 'search' },
  { key: 'library', icon: 'albums' },
  { key: 'settings', icon: 'options' },
];

export default function TabBar({ tab, onChange }) {
  const { t } = useI18n();
  const [w, setW] = useState(0);
  const idx = TABS.findIndex((x) => x.key === tab);
  const itemW = w ? (w - 12) / TABS.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(idx * itemW, SPRING);
  }, [idx, itemW]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <Glass floating radius={R.xl} style={st.bar}>
      <View style={st.inner} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {itemW ? <Animated.View style={[st.pill, { width: itemW }, a]} /> : null}
        {TABS.map((it) => {
          const on = it.key === tab;
          return (
            <Press key={it.key} haptic scaleTo={0.9} onPress={() => onChange(it.key)} accessibilityLabel={t(it.key)} style={st.item}>
              <Ionicons name={on ? it.icon : it.icon + '-outline'} size={22} color={on ? C.text : C.dim} />
              <Text style={[st.label, { color: on ? C.text : C.dim }]} numberOfLines={1}>{t(it.key)}</Text>
            </Press>
          );
        })}
      </View>
    </Glass>
  );
}

const st = StyleSheet.create({
  bar: { height: 66 },
  inner: { flex: 1, flexDirection: 'row', paddingHorizontal: 6, alignItems: 'center' },
  pill: { position: 'absolute', left: 6, top: 6, bottom: 6, borderRadius: R.lg, backgroundColor: 'rgba(255,255,255,0.11)', borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  item: { flex: 1, height: 54, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10.5, fontWeight: '600', marginTop: 3 },
});
