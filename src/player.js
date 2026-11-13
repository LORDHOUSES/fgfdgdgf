import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useLibrary } from './library';

const PlayerCtx = createContext(null);
const ProgressCtx = createContext({ position: 0, duration: 0, buffering: false });
export const usePlayer = () => useContext(PlayerCtx);
export const useProgress = () => useContext(ProgressCtx);

const KEY = 'ls.session.v1';

export function PlayerProvider({ children, onPlayError }) {
  const lib = useLibrary();
  const libRef = useRef(lib);
  libRef.current = lib;

  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off'); // off | all | one
  const [sleepUntil, setSleepUntil] = useState(null);
  const [progress, setProgress] = useState({ position: 0, duration: 0, buffering: false });

  const s = useRef({ queue: [], index: -1, shuffle: false, repeat: 'off' });
  s.current = { queue, index, shuffle, repeat };

  const playerRef = useRef(null);
  const token = useRef(0);
  const startedAt = useRef(0);
  const finishedFor = useRef(-1);
  const loadedFor = useRef(-1);
  const primed = useRef(false);
  const history = useRef([]);
  const fails = useRef(0);
  const watchdog = useRef(null);
  const sleepTimer = useRef(null);
  const api = useRef({});

  const loadAt = useCallback((q, i, autoplay = true) => {
    const p = playerRef.current;
    const track = q[i];
    if (!p || !track) return;
    const uri = libRef.current.resolveUri(track);
    token.current += 1;
    const my = token.current;
    startedAt.current = Date.now();
    primed.current = true;
    setProgress({ position: 0, duration: track.duration || 0, buffering: true });
    clearTimeout(watchdog.current);
    if (!uri) return api.current.fail(my);
    try {
      p.replace({ uri });
      if (autoplay) p.play();
    } catch (e) {
      return api.current.fail(my);
    }
    try {
      p.setActiveForLockScreen(true, {
        title: track.title,
        artist: track.artist || '',
        albumTitle: track.album || 'LS music',
        artworkUrl: libRef.current.artworkOf(track) || undefined,
      });
    } catch (e) {}
    libRef.current.pushRecent(track);
    watchdog.current = setTimeout(() => {
      if (token.current === my && loadedFor.current !== my) api.current.fail(my);
    }, 20000);
  }, []);

  const advance = useCallback(
    (auto) => {
      const { queue: q, index: i, shuffle: sh, repeat: rp } = s.current;
      if (!q.length) return;
      let j;
      if (sh && q.length > 1) {
        do j = Math.floor(Math.random() * q.length);
        while (j === i);
      } else {
        j = i + 1;
        if (j >= q.length) {
          if (auto && rp !== 'all') {
            try {
              playerRef.current.pause();
            } catch (e) {}
            return;
          }
          j = 0;
        }
      }
      history.current.push(i);
      if (history.current.length > 100) history.current.shift();
      setIndex(j);
      loadAt(q, j);
    },
    [loadAt]
  );

  api.current.fail = (my) => {
    if (my !== token.current) return;
    fails.current += 1;
    onPlayError && onPlayError();
    if (fails.current < 3 && s.current.queue.length > 1) advance(true);
    else {
      try {
        playerRef.current.pause();
      } catch (e) {}
      setProgress((p) => ({ ...p, buffering: false }));
    }
  };

  api.current.ended = () => {
    const p = playerRef.current;
    if (s.current.repeat === 'one') {
      startedAt.current = Date.now();
      finishedFor.current = -1;
      p.seekTo(0).then(() => p.play()).catch(() => {});
      return;
    }
    advance(true);
  };

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});
    const p = createAudioPlayer(null, { updateInterval: 500 });
    playerRef.current = p;
    const sub = p.addListener('playbackStatusUpdate', (st) => {
      const my = token.current;
      const fresh = Date.now() - startedAt.current > 900;
      setPlaying((was) => (was === !!st.playing ? was : !!st.playing));
      if (st.isLoaded && fresh) {
        if (loadedFor.current !== my) {
          loadedFor.current = my;
          fails.current = 0;
          const tr = s.current.queue[s.current.index];
          if (tr && !tr.duration && st.duration > 0) libRef.current.setDuration(tr.id, st.duration);
        }
      }
      if (fresh || !st.didJustFinish) {
        setProgress((prev) => {
          const position = fresh ? st.currentTime || 0 : 0;
          const duration = fresh && st.duration > 0 ? st.duration : prev.duration;
          const buffering = !!st.isBuffering || (!st.isLoaded && primed.current);
          if (Math.abs(prev.position - position) < 0.2 && prev.duration === duration && prev.buffering === buffering) return prev;
          return { position, duration, buffering };
        });
      }
      if (st.error && fresh && loadedFor.current !== my) api.current.fail(my);
      if (st.didJustFinish && fresh && finishedFor.current !== my) {
        finishedFor.current = my;
        api.current.ended();
      }
    });
    return () => {
      sub.remove();
      clearTimeout(watchdog.current);
      clearTimeout(sleepTimer.current);
      try {
        p.clearLockScreenControls();
        p.remove();
      } catch (e) {}
    };
  }, []);

  // Bring back the last queue, paused, so the mini player is there on launch.
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const v = JSON.parse(raw);
        if (v.queue && v.queue.length && s.current.queue.length === 0) {
          setQueue(v.queue);
          setIndex(Math.min(v.index || 0, v.queue.length - 1));
          setShuffle(!!v.shuffle);
          setRepeat(v.repeat || 'off');
        }
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    const id = setTimeout(() => {
      AsyncStorage.setItem(KEY, JSON.stringify({ queue: queue.slice(0, 300), index, shuffle, repeat })).catch(() => {});
    }, 600);
    return () => clearTimeout(id);
  }, [queue, index, shuffle, repeat]);

  const playQueue = useCallback(
    (tracks, start = 0) => {
      if (!tracks || !tracks.length) return;
      const q = tracks.slice();
      history.current = [];
      fails.current = 0;
      setQueue(q);
      setIndex(start);
      loadAt(q, start);
    },
    [loadAt]
  );

  const shufflePlay = useCallback(
    (tracks) => {
      if (!tracks || !tracks.length) return;
      setShuffle(true);
      playQueue(tracks, Math.floor(Math.random() * tracks.length));
    },
    [playQueue]
  );

  const toggle = useCallback(() => {
    const p = playerRef.current;
    const { queue: q, index: i } = s.current;
    if (!p || !q[i]) return;
    if (!primed.current) return loadAt(q, i);
    if (p.playing) p.pause();
    else {
      if (p.duration > 0 && p.currentTime >= p.duration - 0.4) p.seekTo(0).catch(() => {});
      p.play();
    }
  }, [loadAt]);

  const next = useCallback(() => advance(false), [advance]);

  const prev = useCallback(() => {
    const p = playerRef.current;
    const { queue: q, index: i } = s.current;
    if (!p || !q.length) return;
    if (primed.current && p.currentTime > 3) return void p.seekTo(0).catch(() => {});
    const j = history.current.length ? history.current.pop() : Math.max(0, i - 1);
    setIndex(j);
    loadAt(q, j);
  }, [loadAt]);

  const seek = useCallback((sec) => {
    const p = playerRef.current;
    if (!p || !primed.current) return;
    setProgress((pr) => ({ ...pr, position: sec }));
    p.seekTo(sec).catch(() => {});
  }, []);

  const jumpTo = useCallback(
    (i) => {
      const { queue: q, index: cur } = s.current;
      if (!q[i]) return;
      history.current.push(cur);
      setIndex(i);
      loadAt(q, i);
    },
    [loadAt]
  );

  const playNext = useCallback(
    (track) => {
      const { queue: q, index: i } = s.current;
      if (!q.length) return playQueue([track], 0);
      if (q[i] && q[i].id === track.id) return;
      const before = q.slice(0, i + 1).filter((t) => t.id !== track.id);
      const after = q.slice(i + 1).filter((t) => t.id !== track.id);
      setQueue([...before, track, ...after]);
      setIndex(before.length - 1);
    },
    [playQueue]
  );

  const addToQueue = useCallback(
    (track) => {
      const { queue: q } = s.current;
      if (!q.length) return playQueue([track], 0);
      if (q.some((t) => t.id === track.id)) return;
      setQueue([...q, track]);
    },
    [playQueue]
  );

  const cycleRepeat = useCallback(() => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')), []);
  const toggleShuffle = useCallback(() => setShuffle((v) => !v), []);

  const setSleep = useCallback((minutes) => {
    clearTimeout(sleepTimer.current);
    if (!minutes) return setSleepUntil(null);
    setSleepUntil(Date.now() + minutes * 60000);
    sleepTimer.current = setTimeout(() => {
      try {
        playerRef.current.pause();
      } catch (e) {}
      setSleepUntil(null);
    }, minutes * 60000);
  }, []);

  const track = index >= 0 ? queue[index] || null : null;

  const value = useMemo(
    () => ({ queue, index, track, playing, shuffle, repeat, sleepUntil, playQueue, shufflePlay, toggle, next, prev, seek, jumpTo, playNext, addToQueue, cycleRepeat, toggleShuffle, setSleep }),
    [queue, index, track, playing, shuffle, repeat, sleepUntil, playQueue, shufflePlay, toggle, next, prev, seek, jumpTo, playNext, addToQueue, cycleRepeat, toggleShuffle, setSleep]
  );

  return (
    <PlayerCtx.Provider value={value}>
      <ProgressCtx.Provider value={progress}>{children}</ProgressCtx.Provider>
    </PlayerCtx.Provider>
  );
}
