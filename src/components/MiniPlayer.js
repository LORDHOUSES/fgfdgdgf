import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { C, GRAD, T } from '../theme';
import { useI18n } from '../i18n';
import { useLibrary } from '../library';
import { usePlayer, useProgress } from '../player';
import { Artwork, Glass, IconBtn, Press, useUI } from './ui';

function Line() {
  const { position, duration } = useProgress();
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  return (
    <View style={st.line}>
      <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: pct + '%', height: 2.5 }} />
    </View>
  );
}

function PlayButton() {
  const { playing, toggle } = usePlayer();
  const { buffering } = useProgress();
  if (buffering && !playing) return <View style={st.spin}><ActivityIndicator color={C.text} /></View>;
  return <IconBtn name={playing ? 'pause' : 'play'} size={26} onPress={toggle} haptic="strong" />;
}

export default function MiniPlayer() {
  const { track, next } = usePlayer();
  const lib = useLibrary();
  const ui = useUI();
  const { t } = useI18n();
  if (!track) return null;
  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} exiting={FadeOutDown.duration(160)} style={{ marginBottom: 10 }}>
      <Glass floating radius={24} style={st.wrap}>
        <Press scaleTo={0.985} onPress={() => ui.setPlayerOpen(true)} accessibilityLabel={track.title} style={st.left}>
          <Artwork uri={lib.artworkOf(track)} size={46} radius={13} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{track.title}</Text>
            <Text style={[T.sub, { marginTop: 2 }]} numberOfLines={1}>{track.artist || t('unknownArtist')}</Text>
          </View>
        </Press>
        <PlayButton />
        <IconBtn name="play-forward" size={22} onPress={next} />
        <Line />
      </Glass>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: { height: 66, flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 6 },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  spin: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  line: { position: 'absolute', left: 22, right: 22, bottom: 0, height: 2.5, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' },
});
