import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, SPRING_SOFT, T } from './src/theme';
import { I18nProvider, useI18n } from './src/i18n';
import { LibraryProvider } from './src/library';
import { PlayerProvider } from './src/player';
import { CloudProvider } from './src/cloud';
import { Bars, UIProvider, useUI } from './src/components/ui';
import TabBar from './src/components/TabBar';
import MiniPlayer from './src/components/MiniPlayer';
import FullPlayer from './src/components/FullPlayer';
import TrackMenu from './src/components/TrackMenu';
import Discover from './src/screens/Discover';
import Search from './src/screens/Search';
import Library from './src/screens/Library';
import Settings from './src/screens/Settings';

// Keeps every tab mounted (scroll position survives) and eases the active one in.
function Scene({ active, children }) {
  const v = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    v.value = active ? withTiming(1, { duration: 240 }) : 0;
  }, [active]);
  const a = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.985 + v.value * 0.015 }] }));
  return (
    <Animated.View pointerEvents={active ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, a, !active && { display: 'none' }]}>
      {children}
    </Animated.View>
  );
}

// Launch moment: the mark's five bars come alive, the name follows, then the app is revealed.
function Intro() {
  const [gone, setGone] = useState(false);
  const [alive, setAlive] = useState(false);
  const fade = useSharedValue(1);
  const scale = useSharedValue(0.7);
  const word = useSharedValue(0);
  useEffect(() => {
    scale.value = withSpring(1, SPRING_SOFT);
    word.value = withDelay(380, withTiming(1, { duration: 420 }));
    const a = setTimeout(() => setAlive(true), 150);
    const b = setTimeout(() => {
      fade.value = withTiming(0, { duration: 420 });
    }, 1500);
    const c = setTimeout(() => setGone(true), 1960);
    return () => [a, b, c].forEach(clearTimeout);
  }, []);
  const wrap = useAnimatedStyle(() => ({ opacity: fade.value }));
  const mark = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const name = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateY: (1 - word.value) * 12 }] }));
  if (gone) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, st.intro, wrap]}>
      <Animated.View style={mark}>
        <Bars size={92} active={alive} />
      </Animated.View>
      <Animated.View style={[{ marginTop: 26 }, name]}>
        <Text style={[T.title, { fontSize: 24, letterSpacing: 0.2 }]}>LS music</Text>
      </Animated.View>
    </Animated.View>
  );
}

function Shell({ blurTarget }) {
  const [tab, setTab] = useState('discover');
  const insets = useSafeAreaInsets();
  return (
    <View style={st.root}>
      <BlurTargetView ref={blurTarget} style={st.root}>
        <LinearGradient colors={['#0A1838', C.bg, C.bg, '#200A33']} locations={[0, 0.32, 0.7, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Scene active={tab === 'discover'}><Discover goLibrary={() => setTab('library')} /></Scene>
        <Scene active={tab === 'search'}><Search /></Scene>
        <Scene active={tab === 'library'}><Library /></Scene>
        <Scene active={tab === 'settings'}><Settings /></Scene>
        <LinearGradient pointerEvents="none" colors={['rgba(4,5,12,0.92)', 'rgba(4,5,12,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 14 }} />
      </BlurTargetView>
      <View pointerEvents="box-none" style={[st.chrome, { bottom: Math.max(insets.bottom, 10) + 6 }]}>
        <MiniPlayer />
        <TabBar tab={tab} onChange={setTab} />
      </View>
      <FullPlayer />
      <TrackMenu />
      <Intro />
    </View>
  );
}

function Providers() {
  const blurTarget = useRef(null);
  return (
    <UIProvider blurTarget={blurTarget}>
      <LibraryProvider>
        <CloudProvider>
          <PlayerBridge>
            <Shell blurTarget={blurTarget} />
          </PlayerBridge>
        </CloudProvider>
      </LibraryProvider>
    </UIProvider>
  );
}

function PlayerBridge({ children }) {
  const ui = useUI();
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const onErr = useRef(() => ui.toast(tRef.current('playFail'))).current;
  return <PlayerProvider onPlayError={onErr}>{children}</PlayerProvider>;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <StatusBar style="light" />
        <Providers />
      </I18nProvider>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  chrome: { position: 'absolute', left: 14, right: 14 },
  intro: { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 100 },
});
