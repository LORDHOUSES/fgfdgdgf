import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, R, T } from '../theme';
import { useI18n } from '../i18n';
import { useLibrary } from '../library';
import { useOnline } from '../net';
import { searchTracks } from '../audius';
import { Chip, Empty, Glass, IconBtn } from '../components/ui';
import TrackList from '../components/TrackList';

const norm = (s) => (s || '').toLocaleLowerCase();

export default function Search() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const lib = useLibrary();
  const online = useOnline();
  const [text, setText] = useState('');
  const [remote, setRemote] = useState([]);
  const [busy, setBusy] = useState(false);
  const [where, setWhere] = useState('online');
  const ctrl = useRef(null);
  const query = text.trim();

  useEffect(() => {
    if (ctrl.current) ctrl.current.abort();
    if (!online || query.length < 2) {
      setRemote([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    const ac = new AbortController();
    ctrl.current = ac;
    const id = setTimeout(async () => {
      try {
        const data = await searchTracks(query, ac.signal);
        if (!ac.signal.aborted) setRemote(data);
      } catch (e) {
        if (!ac.signal.aborted) setRemote([]);
      } finally {
        if (!ac.signal.aborted) setBusy(false);
      }
    }, 380);
    return () => clearTimeout(id);
  }, [query, online]);

  const mine = useMemo(() => {
    if (query.length < 2) return [];
    const q = norm(query);
    const seen = new Set();
    return [...lib.local, ...lib.downloads, ...lib.favs].filter((x) => {
      if (seen.has(x.id)) return false;
      seen.add(x.id);
      return norm(x.title).includes(q) || norm(x.artist).includes(q);
    });
  }, [query, lib.local, lib.downloads, lib.favs]);

  const tab = online ? where : 'library';
  const tracks = tab === 'online' ? remote : mine;

  const header = (
    <View style={{ paddingTop: insets.top + 18 }}>
      <Text style={[T.large, { paddingHorizontal: 20 }]}>{t('search')}</Text>
      <Glass radius={R.md} style={st.field}>
        <Ionicons name="search" size={19} color={C.dim} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('searchPlaceholder')}
          placeholderTextColor={C.faint}
          style={st.input}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          selectionColor={C.cyan}
          accessibilityLabel={t('searchPlaceholder')}
        />
        {busy ? <ActivityIndicator color={C.cyan} style={{ marginRight: 10 }} /> : text ? <IconBtn name="close-circle" size={19} color={C.dim} onPress={() => setText('')} box={40} /> : null}
      </Glass>
      {query.length >= 2 ? (
        <View style={st.tabs}>
          {online ? <Chip label={t('online') + '  ' + remote.length} active={tab === 'online'} onPress={() => setWhere('online')} /> : null}
          <Chip label={t('inLibrary') + '  ' + mine.length} active={tab === 'library'} onPress={() => setWhere('library')} />
        </View>
      ) : null}
      {!online ? <Text style={[T.sub, { paddingHorizontal: 22, marginTop: 12 }]}>{t('searchOffline')}</Text> : null}
    </View>
  );

  const empty =
    query.length < 2 ? <Empty icon="search-outline" text={t('searchHint')} /> : busy && tab === 'online' ? null : <Empty icon="sad-outline" text={t('noResults')} />;

  return <TrackList tracks={tracks} title={t('search')} header={header} empty={empty} keyboardDismiss />;
}

const st = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', height: 50, marginHorizontal: 20, marginTop: 14, paddingLeft: 14 },
  input: { flex: 1, height: 50, marginLeft: 10, color: C.text, fontSize: 16, fontWeight: '500' },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 14, marginBottom: 4 },
});
