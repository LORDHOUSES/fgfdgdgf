import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../theme';
import { useI18n } from '../i18n';
import { useLibrary } from '../library';
import { usePlayer } from '../player';
import { useOnline } from '../net';
import { GENRES, trending } from '../audius';
import { Artwork, Bars, Chip, Empty, Glass, GradButton, Press, useUI } from '../components/ui';
import TrackList from '../components/TrackList';

function Card({ track, size, onPress, onMore, art, dimmed }) {
  return (
    <Press onPress={onPress} onLongPress={onMore} scaleTo={0.95} style={[{ width: size, marginRight: 14 }, dimmed && { opacity: 0.38 }]}>
      <Artwork uri={art} size={size} radius={size > 150 ? 24 : 18} />
      <Text style={[T.body, { fontWeight: '600', marginTop: 10 }]} numberOfLines={1}>{track.title}</Text>
      <Text style={[T.sub, { marginTop: 2 }]} numberOfLines={1}>{track.artist}</Text>
    </Press>
  );
}

// Placeholder shapes that breathe while the trending list loads.
function Skeleton() {
  const v = useSharedValue(0.35);
  useEffect(() => {
    v.value = withRepeat(withTiming(0.8, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, []);
  const a = useAnimatedStyle(() => ({ opacity: v.value }));
  const block = { backgroundColor: C.glassStrong, borderRadius: 12 };
  return (
    <Animated.View style={[{ paddingHorizontal: 20, paddingTop: 16 }, a]}>
      <View style={{ flexDirection: 'row' }}>
        <View style={[block, { width: 184, height: 184, borderRadius: 24, marginRight: 14 }]} />
        <View style={[block, { width: 184, height: 184, borderRadius: 24 }]} />
      </View>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 22 }}>
          <View style={[block, { width: 52, height: 52 }]} />
          <View style={{ marginLeft: 14, flex: 1 }}>
            <View style={[block, { height: 13, width: '62%', borderRadius: 7 }]} />
            <View style={[block, { height: 11, width: '38%', borderRadius: 6, marginTop: 9 }]} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

export default function Discover({ goLibrary }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const lib = useLibrary();
  const player = usePlayer();
  const online = useOnline();
  const ui = useUI();
  const [genre, setGenre] = useState('');
  const [tracks, setTracks] = useState([]);
  const [state, setState] = useState('loading'); // loading | ok | error
  const [refreshing, setRefreshing] = useState(false);
  const cache = useRef({});

  const load = useCallback(
    async (g, force) => {
      if (!force && cache.current[g]) {
        setTracks(cache.current[g]);
        setState('ok');
        return;
      }
      setState((s) => (cache.current[g] ? s : 'loading'));
      try {
        const data = await trending(g);
        cache.current[g] = data;
        setTracks(data);
        setState('ok');
      } catch (e) {
        setState(cache.current[g] ? 'ok' : 'error');
      }
    },
    []
  );

  useEffect(() => {
    if (online) load(genre);
  }, [genre, online]);

  const playFrom = (list, item) => {
    if (!online && !lib.isOfflineReady(item)) return ui.toast(t('needNet'));
    const usable = online ? list : list.filter((x) => lib.isOfflineReady(x));
    player.playQueue(usable, Math.max(0, usable.findIndex((x) => x.id === item.id)));
  };

  const hero = online && state === 'ok' ? tracks.slice(0, 8) : [];
  const rest = online && state === 'ok' ? tracks.slice(8) : [];

  const header = (
    <View>
      <View style={[st.head, { paddingTop: insets.top + 18 }]}>
        <Text style={T.large}>{t('discover')}</Text>
        <Bars size={26} active={player.playing} />
      </View>

      {!online ? (
        <Glass style={st.notice}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="cloud-offline-outline" size={22} color={C.cyan} />
            <Text style={[T.head, { marginLeft: 10 }]}>{t('offlineTitle')}</Text>
          </View>
          <Text style={[T.sub, { marginTop: 8, lineHeight: 19 }]}>{t('offlineBody')}</Text>
          <GradButton label={t('openLibrary')} icon="albums" onPress={goLibrary} style={{ marginTop: 16 }} />
        </Glass>
      ) : null}

      {lib.recents.length ? (
        <View>
          <Text style={st.section}>{t('recent')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {lib.recents.slice(0, 12).map((x) => (
              <Card key={x.id} track={x} size={124} art={lib.artworkOf(x)} dimmed={!online && !lib.isOfflineReady(x)} onPress={() => playFrom(lib.recents, x)} onMore={() => ui.openMenu(x)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {online ? (
        <View>
          <Text style={st.section}>{t('trending')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 6 }}>
            {GENRES.map((g) => (
              <Chip key={g.key} label={g.label || t('allGenres')} active={g.key === genre} onPress={() => setGenre(g.key)} />
            ))}
          </ScrollView>
          {state === 'loading' ? <Skeleton /> : null}
          {state === 'error' ? (
            <Empty icon="cloud-offline-outline" text={t('loadError')}>
              <GradButton ghost label={t('retry')} icon="refresh" onPress={() => load(genre, true)} />
            </Empty>
          ) : null}
          {hero.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={198} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 }}>
              {hero.map((x) => (
                <Card key={x.id} track={x} size={184} art={lib.artworkOf(x)} onPress={() => playFrom(tracks, x)} onMore={() => ui.openMenu(x)} />
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <TrackList
      tracks={rest}
      title={t('discover')}
      header={header}
      refreshControl={
        <RefreshControl
          tintColor={C.cyan}
          colors={[C.cyan]}
          progressBackgroundColor={C.bg2}
          progressViewOffset={insets.top}
          refreshing={refreshing}
          onRefresh={async () => {
            if (!online) return;
            setRefreshing(true);
            await load(genre, true);
            setRefreshing(false);
          }}
        />
      }
    />
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 6 },
  section: { ...T.title, paddingHorizontal: 20, marginTop: 26, marginBottom: 14 },
  notice: { marginHorizontal: 20, marginTop: 16, padding: 20, borderRadius: R.lg },
});
