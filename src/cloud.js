import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { SYNC_URL } from './config';
import { applyDoc, mergeDocs, syncSnapshot, useLibrary } from './library';
import { useOnline } from './net';

const Ctx = createContext(null);
export const useCloud = () => useContext(Ctx);

const K_TOKEN = 'ls.token';
const K_USER = 'ls.user';
const K_SYNC = 'ls.synced.v1'; // { json, at } — what this device last agreed on with the server

async function call(path, method, token, body) {
  let res;
  try {
    res = await fetch(SYNC_URL + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('network');
  }
  let data = null;
  try {
    data = await res.json();
  } catch (e) {}
  if (!res.ok) throw new Error((data && data.error) || 'server_error');
  return data;
}

export function CloudProvider({ children }) {
  const lib = useLibrary();
  const libRef = useRef(lib);
  libRef.current = lib;
  const online = useOnline();
  const enabled = !!SYNC_URL;

  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | syncing | error
  const [lastSync, setLastSync] = useState(0);
  const token = useRef(null);
  const synced = useRef({ json: null, at: 0 });
  const busy = useRef(false);
  const again = useRef(false);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    (async () => {
      try {
        const [t, u, s] = await Promise.all([SecureStore.getItemAsync(K_TOKEN), SecureStore.getItemAsync(K_USER), AsyncStorage.getItem(K_SYNC)]);
        if (s) synced.current = JSON.parse(s);
        if (t && u) {
          token.current = t;
          setUser(u);
        }
      } catch (e) {}
      setBooted(true);
    })();
  }, []);

  const remember = (json, at) => {
    synced.current = { json, at };
    AsyncStorage.setItem(K_SYNC, JSON.stringify(synced.current)).catch(() => {});
    setLastSync(Date.now());
  };

  const forget = useCallback(async () => {
    token.current = null;
    synced.current = { json: null, at: 0 };
    setUser(null);
    setStatus('idle');
    setLastSync(0);
    await Promise.all([SecureStore.deleteItemAsync(K_TOKEN), SecureStore.deleteItemAsync(K_USER), AsyncStorage.removeItem(K_SYNC)]).catch(() => {});
  }, []);

  const sync = useCallback(async () => {
    if (!enabled || !token.current || !libRef.current.ready) return;
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    setStatus('syncing');
    try {
      const remote = await call('/v1/sync', 'GET', token.current);
      const data = libRef.current.data;
      const localJson = JSON.stringify(syncSnapshot(data));
      const dirty = localJson !== synced.current.json;
      const remoteChanged = !!remote.doc && remote.updatedAt !== synced.current.at;

      if (!remote.doc || (dirty && !remoteChanged)) {
        // Server is empty or unchanged since we last talked: our copy wins.
        const out = await call('/v1/sync', 'PUT', token.current, { doc: JSON.parse(localJson) });
        remember(localJson, out.updatedAt);
      } else if (!dirty && remoteChanged) {
        // Another device changed things and we did not: take theirs.
        const next = applyDoc(data, remote.doc);
        libRef.current.replaceSynced(next.favs, next.playlists);
        remember(JSON.stringify(syncSnapshot(next)), remote.updatedAt);
      } else if (dirty && remoteChanged) {
        // Both sides changed: keep everything from both.
        const next = applyDoc(data, mergeDocs(JSON.parse(localJson), remote.doc));
        const doc = syncSnapshot(next);
        const out = await call('/v1/sync', 'PUT', token.current, { doc });
        libRef.current.replaceSynced(next.favs, next.playlists);
        remember(JSON.stringify(doc), out.updatedAt);
      } else {
        setLastSync(Date.now());
      }
      setStatus('idle');
    } catch (e) {
      if (e.message === 'unauthorized') await forget();
      else setStatus('error');
    } finally {
      busy.current = false;
      if (again.current) {
        again.current = false;
        setTimeout(sync, 300);
      }
    }
  }, [forget]);

  // Sync when signed in, when the library finishes loading, when the network returns.
  useEffect(() => {
    if (booted && user && lib.ready && online) sync();
  }, [booted, user, lib.ready, online]);

  // ...when the app comes back to the foreground...
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') sync();
    });
    return () => sub.remove();
  }, [sync]);

  // ...and a moment after favorites or playlists change.
  useEffect(() => {
    if (!user || !lib.ready || !online) return;
    const id = setTimeout(() => {
      if (JSON.stringify(syncSnapshot(libRef.current.data)) !== synced.current.json) sync();
    }, 2500);
    return () => clearTimeout(id);
  }, [lib.favs, lib.playlists, user, online]);

  const enter = useCallback(
    async (kind, username, password) => {
      const out = await call(kind === 'register' ? '/v1/register' : '/v1/login', 'POST', null, { username, password });
      token.current = out.token;
      synced.current = { json: null, at: 0 };
      await Promise.all([SecureStore.setItemAsync(K_TOKEN, out.token), SecureStore.setItemAsync(K_USER, out.username), AsyncStorage.removeItem(K_SYNC)]).catch(() => {});
      setUser(out.username);
    },
    []
  );

  const deleteAccount = useCallback(async () => {
    await call('/v1/account', 'DELETE', token.current);
    await forget();
  }, [forget]);

  const value = useMemo(
    () => ({ enabled, user, status, lastSync, sync, signIn: (u, p) => enter('login', u, p), signUp: (u, p) => enter('register', u, p), signOut: forget, deleteAccount }),
    [enabled, user, status, lastSync, sync, enter, forget, deleteAccount]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
