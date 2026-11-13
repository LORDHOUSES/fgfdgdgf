import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FS from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as MediaLibrary from 'expo-media-library/legacy';
import { streamUrl } from './audius';
import { fromBase64, parseTags, toBase64 } from './tags';

const KEY = 'ls.library.v1';
const DIR = 'music/';
const ART = 'art/';
const EMPTY = { local: [], favs: [], playlists: [], recents: [], downloads: [] };

const Ctx = createContext(null);
export const useLibrary = () => useContext(Ctx);

const abs = (rel) => FS.documentDirectory + rel;

async function ensureDir(dir = DIR) {
  const info = await FS.getInfoAsync(abs(dir));
  if (!info.exists) await FS.makeDirectoryAsync(abs(dir), { intermediates: true });
}

// ---- cloud sync helpers (pure) ----
const slim = (t) => ({ id: t.id, audiusId: t.audiusId, source: 'audius', title: t.title, artist: t.artist, album: t.album || '', genre: t.genre || '', duration: t.duration || 0, artwork: t.artwork || null, artworkLarge: t.artworkLarge || null });
const isCloud = (t) => t.source === 'audius' && !!t.audiusId;

// What travels between devices: favorites and playlists, online songs only.
export function syncSnapshot(d) {
  return {
    favs: d.favs.filter(isCloud).map(slim),
    playlists: d.playlists.map((p) => ({ id: p.id, name: p.name, tracks: p.tracks.filter(isCloud).map(slim) })),
  };
}

// Lay a synced document over local data, keeping this device's own files where they were.
export function applyDoc(d, doc) {
  const favs = [...(doc.favs || []), ...d.favs.filter((t) => !isCloud(t))];
  const playlists = (doc.playlists || []).map((rp) => {
    const lp = d.playlists.find((x) => x.id === rp.id);
    return { id: rp.id, name: rp.name, tracks: [...(rp.tracks || []), ...(lp ? lp.tracks.filter((t) => !isCloud(t)) : [])] };
  });
  return { ...d, favs, playlists };
}

export function mergeDocs(a, b) {
  const uniq = (list) => {
    const seen = new Set();
    return list.filter((t) => (seen.has(t.id) ? false : seen.add(t.id)));
  };
  const favs = uniq([...(a.favs || []), ...(b.favs || [])]);
  const byId = new Map();
  [...(a.playlists || []), ...(b.playlists || [])].forEach((p) => {
    const cur = byId.get(p.id);
    byId.set(p.id, cur ? { ...cur, tracks: uniq([...cur.tracks, ...(p.tracks || [])]) } : { id: p.id, name: p.name, tracks: p.tracks || [] });
  });
  return { favs, playlists: Array.from(byId.values()) };
}

// "Artist - Title.mp3" → { artist, title }
function parseName(filename) {
  const base = (filename || '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_/g, ' ').trim();
  const cut = base.indexOf(' - ');
  if (cut > 0) return { artist: base.slice(0, cut).trim(), title: base.slice(cut + 3).trim() };
  return { artist: '', title: base || filename };
}

const safe = (s) => String(s).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);

export function LibraryProvider({ children }) {
  const [data, setData] = useState(EMPTY);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState({}); // id -> 0..1 while downloading
  const [scanning, setScanning] = useState(false);
  const [tagging, setTagging] = useState(null); // { done, total } while reading tags
  const tagBusy = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setData({ ...EMPTY, ...JSON.parse(raw) }))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => AsyncStorage.setItem(KEY, JSON.stringify(data)).catch(() => {}), 350);
    return () => clearTimeout(id);
  }, [data, ready]);

  const downloadMap = useMemo(() => {
    const m = {};
    data.downloads.forEach((t) => (m[t.id] = t));
    return m;
  }, [data.downloads]);
  const favSet = useMemo(() => new Set(data.favs.map((t) => t.id)), [data.favs]);
  const localMap = useMemo(() => {
    const m = {};
    data.local.forEach((t) => (m[t.id] = t));
    return m;
  }, [data.local]);

  // Where the audio for a track actually lives right now.
  const resolveUri = useCallback((track) => {
    if (!track) return null;
    const d = dataRef.current.downloads.find((x) => x.id === track.id);
    if (d && d.file) return abs(d.file);
    if (track.file) return abs(track.file);
    if (track.uri) return track.uri;
    if (track.audiusId) return streamUrl(track.audiusId);
    return null;
  }, []);

  const artworkOf = useCallback(
    (track) => {
      if (!track) return null;
      const d = downloadMap[track.id];
      if (d && d.artFile) return abs(d.artFile);
      const l = localMap[track.id];
      if (l && l.artFile) return abs(l.artFile);
      return track.artwork || null;
    },
    [downloadMap, localMap]
  );

  const isOfflineReady = useCallback((track) => !!track && (track.source !== 'audius' || !!downloadMap[track.id]), [downloadMap]);

  // Read embedded tags and covers for songs that still only have a filename. Runs quietly in the background.
  const readTags = useCallback(async () => {
    if (tagBusy.current) return;
    const todo = dataRef.current.local.filter((t) => !t.tagged);
    if (!todo.length) return;
    tagBusy.current = true;
    setTagging({ done: 0, total: todo.length });
    let patch = {};
    const flush = () => {
      const p = patch;
      patch = {};
      if (!Object.keys(p).length) return;
      const fix = (t) => (p[t.id] ? { ...t, ...p[t.id] } : t);
      setData((d) => ({
        ...d,
        local: d.local.map(fix),
        favs: d.favs.map(fix),
        recents: d.recents.map(fix),
        playlists: d.playlists.map((pl) => ({ ...pl, tracks: pl.tracks.map(fix) })),
      }));
    };
    try {
      await ensureDir(ART);
      for (let i = 0; i < todo.length; i++) {
        const t = todo[i];
        const uri = t.file ? abs(t.file) : t.uri;
        const upd = { tagged: true };
        try {
          const info = await FS.getInfoAsync(uri);
          const read = async (position, length) => fromBase64(await FS.readAsStringAsync(uri, { encoding: 'base64', position, length }));
          const tags = info.exists ? await parseTags(read, info.size || 0) : null;
          if (tags) {
            if (tags.title) upd.title = tags.title;
            if (tags.artist) upd.artist = tags.artist;
            if (tags.album) upd.album = tags.album;
            if (tags.trackNo) upd.trackNo = tags.trackNo;
            if (tags.picture) {
              // One cover file per album instead of one per song.
              const rel = ART + safe((tags.album || t.id) + '_' + tags.picture.data.length) + '.' + tags.picture.ext;
              const have = await FS.getInfoAsync(abs(rel));
              if (!have.exists) await FS.writeAsStringAsync(abs(rel), toBase64(tags.picture.data), { encoding: 'base64' });
              upd.artFile = rel;
            }
          }
        } catch (e) {}
        patch[t.id] = upd;
        if (i % 12 === 11) {
          flush();
          setTagging({ done: i + 1, total: todo.length });
        }
      }
    } finally {
      flush();
      setTagging(null);
      tagBusy.current = false;
    }
  }, []);

  useEffect(() => {
    if (ready) readTags();
  }, [ready]);

  const replaceSynced = useCallback((favs, playlists) => setData((d) => ({ ...d, favs, playlists })), []);

  const scanDevice = useCallback(async () => {
    setScanning(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(false, ['audio']);
      if (!perm.granted) return { error: 'denied' };
      const found = [];
      let after;
      for (let page = 0; page < 60; page++) {
        const res = await MediaLibrary.getAssetsAsync({ mediaType: 'audio', first: 200, after });
        res.assets.forEach((a) => {
          if (a.duration && a.duration < 25) return; // skip ringtones and voice notes
          const n = parseName(a.filename);
          found.push({ id: 'device:' + a.id, source: 'local', uri: a.uri, title: n.title, artist: n.artist, duration: a.duration || 0, addedAt: a.modificationTime || 0 });
        });
        if (!res.hasNextPage) break;
        after = res.endCursor;
      }
      // Keep what we already learned about songs that are still on the device.
      const known = {};
      dataRef.current.local.forEach((t) => (known[t.id] = t));
      const merged = found.map((t) => (known[t.id] ? { ...t, ...known[t.id], uri: t.uri } : t));
      setData((d) => ({ ...d, local: [...d.local.filter((t) => !t.id.startsWith('device:')), ...merged] }));
      setTimeout(readTags, 400);
      return { count: found.length };
    } catch (e) {
      return { error: 'limited' };
    } finally {
      setScanning(false);
    }
  }, [readTags]);

  const importFiles = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: true, copyToCacheDirectory: true });
    if (res.canceled) return { count: 0 };
    await ensureDir();
    const added = [];
    for (const a of res.assets) {
      const id = 'file:' + safe(a.name) + ':' + (a.size || 0);
      if (dataRef.current.local.some((t) => t.id === id)) continue;
      const rel = DIR + Date.now() + '_' + safe(a.name);
      try {
        await FS.copyAsync({ from: a.uri, to: abs(rel) });
        const n = parseName(a.name);
        added.push({ id, source: 'local', file: rel, title: n.title, artist: n.artist, duration: 0, addedAt: Date.now() });
      } catch (e) {}
    }
    if (added.length) {
      setData((d) => ({ ...d, local: [...added, ...d.local] }));
      setTimeout(readTags, 400);
    }
    return { count: added.length };
  }, [readTags]);

  const removeLocal = useCallback((track) => {
    if (track.file) FS.deleteAsync(abs(track.file), { idempotent: true }).catch(() => {});
    setData((d) => ({ ...d, local: d.local.filter((t) => t.id !== track.id) }));
  }, []);

  const toggleFav = useCallback((track) => {
    setData((d) => {
      const has = d.favs.some((t) => t.id === track.id);
      return { ...d, favs: has ? d.favs.filter((t) => t.id !== track.id) : [track, ...d.favs] };
    });
  }, []);

  const pushRecent = useCallback((track) => {
    setData((d) => ({ ...d, recents: [track, ...d.recents.filter((t) => t.id !== track.id)].slice(0, 30) }));
  }, []);

  const setDuration = useCallback((id, duration) => {
    setData((d) => {
      const i = d.local.findIndex((t) => t.id === id);
      if (i < 0 || d.local[i].duration) return d;
      const local = d.local.slice();
      local[i] = { ...local[i], duration };
      return { ...d, local };
    });
  }, []);

  const createPlaylist = useCallback((name) => {
    const p = { id: 'pl:' + Date.now(), name: name.trim(), tracks: [] };
    setData((d) => ({ ...d, playlists: [p, ...d.playlists] }));
    return p;
  }, []);
  const deletePlaylist = useCallback((id) => setData((d) => ({ ...d, playlists: d.playlists.filter((p) => p.id !== id) })), []);
  const addToPlaylist = useCallback((id, track) => {
    setData((d) => ({
      ...d,
      playlists: d.playlists.map((p) => (p.id !== id || p.tracks.some((t) => t.id === track.id) ? p : { ...p, tracks: [...p.tracks, track] })),
    }));
  }, []);
  const removeFromPlaylist = useCallback((id, trackId) => {
    setData((d) => ({ ...d, playlists: d.playlists.map((p) => (p.id !== id ? p : { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) })) }));
  }, []);

  const download = useCallback(async (track) => {
    if (!track.audiusId || dataRef.current.downloads.some((t) => t.id === track.id)) return true;
    await ensureDir();
    const rel = DIR + 'a_' + safe(track.audiusId) + '.mp3';
    const artRel = DIR + 'a_' + safe(track.audiusId) + '.jpg';
    setProgress((p) => ({ ...p, [track.id]: 0.01 }));
    try {
      const job = FS.createDownloadResumable(streamUrl(track.audiusId), abs(rel), {}, (ev) => {
        const total = ev.totalBytesExpectedToWrite;
        if (total > 0) setProgress((p) => ({ ...p, [track.id]: Math.max(0.01, ev.totalBytesWritten / total) }));
      });
      const out = await job.downloadAsync();
      if (!out || (out.status && out.status >= 400)) throw new Error('status');
      let artFile = null;
      if (track.artwork) {
        try {
          await FS.downloadAsync(track.artwork, abs(artRel));
          artFile = artRel;
        } catch (e) {}
      }
      setData((d) => ({ ...d, downloads: [{ ...track, file: rel, artFile, downloadedAt: Date.now() }, ...d.downloads] }));
      return true;
    } catch (e) {
      FS.deleteAsync(abs(rel), { idempotent: true }).catch(() => {});
      return false;
    } finally {
      setProgress((p) => {
        const n = { ...p };
        delete n[track.id];
        return n;
      });
    }
  }, []);

  const removeDownload = useCallback((track) => {
    const d = dataRef.current.downloads.find((t) => t.id === track.id);
    if (d) {
      if (d.file) FS.deleteAsync(abs(d.file), { idempotent: true }).catch(() => {});
      if (d.artFile) FS.deleteAsync(abs(d.artFile), { idempotent: true }).catch(() => {});
    }
    setData((s) => ({ ...s, downloads: s.downloads.filter((t) => t.id !== track.id) }));
  }, []);

  const clearDownloads = useCallback(() => {
    dataRef.current.downloads.forEach((d) => {
      if (d.file) FS.deleteAsync(abs(d.file), { idempotent: true }).catch(() => {});
      if (d.artFile) FS.deleteAsync(abs(d.artFile), { idempotent: true }).catch(() => {});
    });
    setData((s) => ({ ...s, downloads: [] }));
  }, []);

  const value = useMemo(
    () => ({
      ...data, data, ready, progress, scanning, tagging, favSet, downloadMap, replaceSynced,
      resolveUri, artworkOf, isOfflineReady, scanDevice, importFiles, removeLocal, toggleFav, pushRecent, setDuration,
      createPlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist, download, removeDownload, clearDownloads,
    }),
    [data, ready, progress, scanning, tagging, favSet, downloadMap, replaceSynced, resolveUri, artworkOf, isOfflineReady, scanDevice, importFiles, removeLocal,
      toggleFav, pushRecent, setDuration, createPlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist, download, removeDownload, clearDownloads]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
