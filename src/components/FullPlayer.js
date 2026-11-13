import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, PanResponder, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, GRAD, R, SPRING, SPRING_SOFT, T, fmtTime } from '../theme';
import { useI18n } from '../i18n';
import { useLibrary } from '../library';
import { usePlayer, useProgress } from '../player';
import { useOnline } from '../net';
import { Artwork, Bars, IconBtn, Press, tap, useUI } from './ui';

function SeekBar() {
  const { position, duration } = useProgress();
  const { seek } = usePlayer();
  const [w, setW] = useState(0);
  const [drag, setDrag] = useState(null);
  const ref = useRef({ w: 0, duration: 0, start: 0 });
  ref.current.w = w;
  ref.current.duration = duration;
  const grow = useSharedValue(0);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const r = ref.current;
          r.start = Math.min(1, Math.max(0, e.nativeEvent.locationX / (r.w || 1)));
          setDrag(r.start);
          grow.value = withSpring(1, SPRING);
          tap();
        },
        onPanResponderMove: (_, g) => {
          const r = ref.current;
          setDrag(Math.min(1, Math.max(0, r.start + g.dx / (r.w || 1))));
        },
        onPanResponderRelease: (_, g) => {
          const r = ref.current;
          const v = Math.min(1, Math.max(0, r.start + g.dx / (r.w || 1)));
          if (r.duration > 0) seek(v * r.duration);
          grow.value = withSpring(0, SPRING);
          setTimeout(() => setDrag(null), 250);
        },
        onPanResponderTerminate: () => {
          grow.value = withSpring(0, SPRING);
          setDrag(null);
        },
      }),
    [seek]
  );

  const frac = drag != null ? drag : duration > 0 ? Math.min(1, position / duration) : 0;
  const shown = drag != null ? drag * duration : position;
  const trackStyle = useAnimatedStyle(() => ({ height: 5 + grow.value * 5, borderRadius: 3 + grow.value * 3 }));

  return (
    <View>
      <View {...pan.panHandlers} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={st.seekHit}>
        <Animated.View pointerEvents="none" style={[st.seekTrack, trackStyle]}>
          <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: frac * 100 + '%', height: '100%' }} />
        </Animated.View>
      </View>
      <View style={st.times}>
        <Text style={[T.cap, T.num, { color: C.dim }]}>{fmtTime(shown)}</Text>
        <Text style={[T.cap, T.num, { color: C.dim }]}>{duration > 0 ? '-' + fmtTime(Math.max(0, duration - shown)) : '--:--'}</Text>
      </View>
    </View>
  );
}

function BigPlay() {
  const { playing, toggle } = usePlayer();
  const { buffering } = useProgress();
  return (
    <Press onPress={toggle} haptic="strong" scaleTo={0.9} accessibilityLabel={playing ? 'Pause' : 'Play'} style={st.bigPlay}>
      <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.08)']} style={StyleSheet.absoluteFill} />
      {buffering && !playing ? <ActivityIndicator color="#fff" size="large" /> : <Ionicons name={playing ? 'pause' : 'play'} size={38} color="#fff" style={playing ? null : { marginLeft: 4 }} />}
    </Press>
  );
}

const SLEEP_STEPS = [0, 15, 30, 60];

export default function FullPlayer() {
  const ui = useUI();
  const { t } = useI18n();
  const lib = useLibrary();
  const player = usePlayer();
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const [showQueue, setShowQueue] = useState(false);
  const open = ui.playerOpen;
  const y = useSharedValue(H);
  const artScale = useSharedValue(1);
  const artX = useSharedValue(0);
  const nav = useRef({});
  nav.current = { next: player.next, prev: player.prev, W };

  useEffect(() => {
    y.value = withSpring(open ? 0 : H + 40, SPRING_SOFT);
    if (!open) setShowQueue(false);
  }, [open, H]);

  useEffect(() => {
    artScale.value = withSpring(player.playing ? 1 : 0.84, SPRING);
  }, [player.playing]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      ui.setPlayerOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [open]);

  const close = () => ui.setPlayerOpen(false);
  const closeRef = useRef(close);
  closeRef.current = close;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.4,
        onPanResponderMove: (_, g) => {
          y.value = Math.max(0, g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 130 || g.vy > 0.9) closeRef.current();
          else y.value = withSpring(0, SPRING);
        },
        onPanResponderTerminate: () => {
          y.value = withSpring(0, SPRING);
        },
      }),
    []
  );

  // On the artwork: drag down to close, flick sideways to change song.
  const artPan = useMemo(() => {
    let axis = null;
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 || g.dy > 10,
      onPanResponderGrant: () => {
        axis = null;
      },
      onPanResponderMove: (_, g) => {
        if (!axis) axis = Math.abs(g.dx) > Math.abs(g.dy) ? 'x' : 'y';
        if (axis === 'x') artX.value = g.dx;
        else y.value = Math.max(0, g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (axis === 'x') {
          const far = Math.abs(g.dx) > 90 || Math.abs(g.vx) > 0.8;
          if (far) {
            tap('strong');
            if (g.dx < 0) nav.current.next();
            else nav.current.prev();
            artX.value = (g.dx < 0 ? 1 : -1) * nav.current.W * 0.7;
          }
          artX.value = withSpring(0, SPRING);
        } else if (g.dy > 130 || g.vy > 0.9) closeRef.current();
        else y.value = withSpring(0, SPRING);
      },
      onPanResponderTerminate: () => {
        artX.value = withSpring(0, SPRING);
        y.value = withSpring(0, SPRING);
      },
    });
  }, []);

  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    borderTopLeftRadius: Math.min(R.xl, y.value / 4),
    borderTopRightRadius: Math.min(R.xl, y.value / 4),
  }));
  const art = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(0.6, Math.abs(artX.value) / 420),
    transform: [{ translateX: artX.value }, { rotate: artX.value / 40 + 'deg' }, { scale: artScale.value }],
  }));

  const tr = player.track;
  if (!tr) return null;
  const uri = lib.artworkOf(tr);
  const big = lib.downloadMap[tr.id] ? uri : tr.artworkLarge || uri;
  const fav = lib.favSet.has(tr.id);
  const isAudius = tr.source === 'audius';
  const downloaded = !!lib.downloadMap[tr.id];
  const dl = lib.progress[tr.id];
  const artSize = Math.min(W - 64, H * 0.4);
  const sourceLabel = isAudius ? (downloaded ? t('sourceDownloaded') : t('sourceOnline')) : t('sourceLocal');
  const sleepMin = player.sleepUntil ? Math.max(1, Math.round((player.sleepUntil - Date.now()) / 60000)) : 0;

  const cycleSleep = () => {
    const cur = SLEEP_STEPS.findIndex((m) => m >= sleepMin);
    const nextStep = SLEEP_STEPS[(Math.max(0, cur) + 1) % SLEEP_STEPS.length];
    player.setSleep(nextStep);
    ui.toast(nextStep ? t('sleepSet', { n: nextStep }) : t('sleepCleared'));
  };

  const onDownload = async () => {
    if (downloaded) return lib.removeDownload(tr);
    if (!online) return ui.toast(t('needNet'));
    const ok = await lib.download(tr);
    ui.toast(ok ? t('downloaded') : t('downloadFail'));
  };

  return (
    <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, st.sheet, sheet]}>
      {big ? <Image source={{ uri: big }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={70} transition={500} /> : null}
      <LinearGradient colors={big ? ['rgba(4,5,12,0.45)', 'rgba(4,5,12,0.72)', 'rgba(4,5,12,0.94)'] : ['#0C1B40', '#1B0F45', C.bg]} style={StyleSheet.absoluteFill} />

      <View style={{ flex: 1, paddingTop: insets.top + 6, paddingBottom: insets.bottom + 14 }}>
        <View {...pan.panHandlers}>
          <View style={st.grab} />
          <View style={st.top}>
            <IconBtn name="chevron-down" size={26} onPress={close} label={t('cancel')} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={T.cap}>{showQueue ? t('queue') : sourceLabel}</Text>
            </View>
            <IconBtn name="ellipsis-horizontal" size={22} onPress={() => ui.openMenu(tr)} />
          </View>
        </View>

        {showQueue ? (
          <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1 }}>
            <FlatList
              data={player.queue}
              keyExtractor={(x, i) => x.id + ':' + i}
              initialScrollIndex={Math.max(0, Math.min(player.index, player.queue.length - 1))}
              getItemLayout={(_, i) => ({ length: 62, offset: 62 * i, index: i })}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8 }}
              renderItem={({ item, index }) => {
                const on = index === player.index;
                return (
                  <Press scaleTo={0.985} onPress={() => (on ? player.toggle() : player.jumpTo(index))} style={[st.qRow, on && st.qRowOn]}>
                    <Artwork uri={lib.artworkOf(item)} size={44} radius={10} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[T.body, { fontWeight: '600' }, on && { color: C.cyan }]} numberOfLines={1}>{item.title}</Text>
                      <Text style={[T.sub, { marginTop: 2 }]} numberOfLines={1}>{item.artist || t('unknownArtist')}</Text>
                    </View>
                    {on ? <Bars size={18} active={player.playing} /> : <Text style={[T.cap, T.num]}>{fmtTime(item.duration)}</Text>}
                  </Press>
                );
              }}
            />
          </Animated.View>
        ) : (
          <View {...artPan.panHandlers} style={st.artZone}>
            <Animated.View style={[st.artShadow, art]}>
              <Artwork uri={big} size={artSize} radius={28} />
            </Animated.View>
          </View>
        )}

        <View style={{ paddingHorizontal: 28 }}>
          <View style={st.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[T.title, { fontSize: 24 }]} numberOfLines={1}>{tr.title}</Text>
              <Text style={[T.head, { color: C.dim, fontWeight: '500', marginTop: 4 }]} numberOfLines={1}>{tr.artist || t('unknownArtist')}</Text>
            </View>
            <IconBtn name={fav ? 'heart' : 'heart-outline'} size={26} color={fav ? C.magenta : C.text} haptic="strong" onPress={() => lib.toggleFav(tr)} label={fav ? t('removeFav') : t('addFav')} />
          </View>

          <SeekBar />

          <View style={st.controls}>
            <IconBtn name="shuffle" size={23} color={player.shuffle ? C.cyan : C.dim} onPress={player.toggleShuffle} />
            <IconBtn name="play-back" size={32} onPress={player.prev} haptic="strong" box={60} />
            <BigPlay />
            <IconBtn name="play-forward" size={32} onPress={player.next} haptic="strong" box={60} />
            <View>
              <IconBtn name="repeat" size={23} color={player.repeat !== 'off' ? C.cyan : C.dim} onPress={player.cycleRepeat} />
              {player.repeat === 'one' ? <Text style={st.one}>1</Text> : null}
            </View>
          </View>

          <View style={st.bottom}>
            <Press onPress={cycleSleep} haptic style={st.bottomBtn} accessibilityLabel={t('sleep')}>
              <Ionicons name={sleepMin ? 'moon' : 'moon-outline'} size={20} color={sleepMin ? C.cyan : C.dim} />
              {sleepMin ? <Text style={[T.cap, T.num, { color: C.cyan, marginLeft: 5 }]}>{t('minutes', { n: sleepMin })}</Text> : null}
            </Press>
            {isAudius ? (
              <Press onPress={onDownload} haptic style={st.bottomBtn} accessibilityLabel={downloaded ? t('removeDownload') : t('download')}>
                {dl != null ? <Text style={[T.cap, T.num, { color: C.cyan }]}>{Math.round(dl * 100)}%</Text> : <Ionicons name={downloaded ? 'arrow-down-circle' : 'arrow-down-circle-outline'} size={22} color={downloaded ? C.cyan : C.dim} />}
              </Press>
            ) : (
              <View style={st.bottomBtn} />
            )}
            <Press onPress={() => setShowQueue((v) => !v)} haptic style={st.bottomBtn} accessibilityLabel={t('queue')}>
              <Ionicons name="list" size={22} color={showQueue ? C.cyan : C.dim} />
            </Press>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  sheet: { backgroundColor: C.bg, overflow: 'hidden', zIndex: 50, elevation: 50 },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 52 },
  artZone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  artShadow: { shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 24, borderRadius: 28 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  seekHit: { height: 30, justifyContent: 'center' },
  seekTrack: { backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  bigPlay: { width: 78, height: 78, borderRadius: 39, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.35)' },
  one: { position: 'absolute', right: 6, top: 6, fontSize: 9, fontWeight: '800', color: C.cyan },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  bottomBtn: { height: 44, minWidth: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  qRow: { height: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginHorizontal: 12, borderRadius: 16 },
  qRowOn: { backgroundColor: 'rgba(255,255,255,0.1)' },
});
