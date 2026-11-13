import React, { useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, FlatList, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, CHROME_SPACE, R, T } from '../theme';
import { useI18n } from '../i18n';
import { useLibrary } from '../library';
import { usePlayer } from '../player';
import { useOnline } from '../net';
import { Artwork, Chip, Empty, Glass, GradButton, IconBtn, Press, useUI } from '../components/ui';
import TrackList from '../components/TrackList';

const SEGMENTS = ['songs', 'albums', 'artists', 'playlists', 'downloads', 'favorites'];

function PlayBar({ tracks }) {
  const { t } = useI18n();
  const player = usePlayer();
  const lib = useLibrary();
  const online = useOnline();
  const ui = useUI();
  if (!tracks.length) return null;
  const usable = () => {
    const list = online ? tracks : tracks.filter((x) => lib.isOfflineReady(x));
    if (!list.length) ui.toast(t('needNet'));
    return list;
  };
  return (
    <View style={st.playBar}>
      <GradButton label={t('play')} icon="play" style={{ flex: 1, marginRight: 10 }} onPress={() => player.playQueue(usable(), 0)} />
      <GradButton ghost label={t('shuffleAll')} icon="shuffle" style={{ flex: 1 }} onPress={() => player.shufflePlay(usable())} />
    </View>
  );
}

function RowLink({ icon, title, sub, onPress, onLongPress }) {
  return (
    <Press onPress={onPress} onLongPress={onLongPress} scaleTo={0.985} style={st.link}>
      <View style={st.linkIcon}>
        <Ionicons name={icon} size={22} color={C.text} />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{title}</Text>
        <Text style={[T.sub, { marginTop: 3 }]} numberOfLines={1}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.faint} />
    </Press>
  );
}

function Detail({ title, sub, art, tracks, onBack, menuExtra, onDelete }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, []);
  const header = (
    <View style={{ paddingTop: insets.top + 6 }}>
      <View style={st.detailTop}>
        <IconBtn name="chevron-back" size={26} onPress={onBack} label={t('cancel')} />
        <View style={{ flex: 1 }} />
        {onDelete ? <IconBtn name="trash-outline" size={21} color={C.danger} onPress={onDelete} label={t('deletePlaylist')} /> : null}
      </View>
      {art !== undefined ? (
        <View style={{ alignItems: 'center', marginBottom: 18 }}>
          <Artwork uri={art} size={196} radius={26} />
        </View>
      ) : null}
      <Text style={[T.large, { paddingHorizontal: 20 }]} numberOfLines={2}>{title}</Text>
      <Text style={[T.sub, { paddingHorizontal: 20, marginTop: 6 }]} numberOfLines={1}>{(sub ? sub + '  ·  ' : '') + t('tracksCount', { n: tracks.length })}</Text>
      <PlayBar tracks={tracks} />
    </View>
  );
  return (
    <Animated.View entering={SlideInRight.springify().damping(22).stiffness(220)} style={{ flex: 1 }}>
      <TrackList tracks={tracks} title={title} header={header} menuExtra={menuExtra} empty={<Empty text={t('emptySongs')} />} />
    </Animated.View>
  );
}

export default function Library() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const lib = useLibrary();
  const ui = useUI();
  const [seg, setSeg] = useState('songs');
  const [detail, setDetail] = useState(null); // { type, key }
  const [name, setName] = useState('');

  const artists = useMemo(() => {
    const m = new Map();
    [...lib.local, ...lib.downloads].forEach((x) => {
      const k = x.artist || '';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    });
    return Array.from(m, ([k, tracks]) => ({ key: k, tracks })).sort((a, b) => (a.key || '\uffff').localeCompare(b.key || '\uffff'));
  }, [lib.local, lib.downloads]);

  const { width: W } = useWindowDimensions();
  const albums = useMemo(() => {
    const m = new Map();
    [...lib.local, ...lib.downloads].forEach((x) => {
      if (!x.album) return;
      const k = x.album.toLocaleLowerCase();
      if (!m.has(k)) m.set(k, { key: k, name: x.album, artist: x.artist || '', tracks: [] });
      m.get(k).tracks.push(x);
    });
    const list = Array.from(m.values());
    list.forEach((a) => a.tracks.sort((p, q) => (p.trackNo || 999) - (q.trackNo || 999)));
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [lib.local, lib.downloads]);

  if (detail) {
    if (detail.type === 'album') {
      const a = albums.find((x) => x.key === detail.key);
      return <Detail title={a ? a.name : ''} sub={a ? a.artist : ''} art={a ? lib.artworkOf(a.tracks[0]) : null} tracks={a ? a.tracks : []} onBack={() => setDetail(null)} />;
    }
    if (detail.type === 'artist') {
      const a = artists.find((x) => x.key === detail.key);
      return <Detail title={detail.key || t('unknownArtist')} tracks={a ? a.tracks : []} onBack={() => setDetail(null)} />;
    }
    const p = lib.playlists.find((x) => x.id === detail.key);
    return (
      <Detail
        title={p ? p.name : ''}
        tracks={p ? p.tracks : []}
        menuExtra={{ playlistId: detail.key }}
        onBack={() => setDetail(null)}
        onDelete={() =>
          Alert.alert(t('deletePlaylist'), p ? p.name : '', [
            { text: t('cancel'), style: 'cancel' },
            { text: t('deletePlaylist'), style: 'destructive', onPress: () => {
              lib.deletePlaylist(detail.key);
              setDetail(null);
            } },
          ])
        }
      />
    );
  }

  const scan = async () => {
    const res = await lib.scanDevice();
    if (res.error === 'denied') ui.toast(t('scanDenied'));
    else if (res.error) ui.toast(t('scanLimited'));
    else ui.toast(t('scanDone', { n: res.count }));
  };
  const add = async () => {
    try {
      const res = await lib.importFiles();
      if (res.count) ui.toast(t('filesAdded', { n: res.count }));
    } catch (e) {}
  };

  const tracks = seg === 'songs' ? lib.local : seg === 'downloads' ? lib.downloads : seg === 'favorites' ? lib.favs : [];
  const isTrackSeg = seg === 'songs' || seg === 'downloads' || seg === 'favorites';

  const header = (
    <View style={{ paddingTop: insets.top + 18 }}>
      <Text style={[T.large, { paddingHorizontal: 20 }]}>{t('library')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 }}>
        {SEGMENTS.map((s) => (
          <Chip key={s} label={t(s)} active={seg === s} onPress={() => setSeg(s)} />
        ))}
      </ScrollView>

      {seg === 'songs' ? (
        <View style={st.actions}>
          <GradButton ghost icon="scan-outline" label={lib.scanning ? t('scanning') : t('scan')} style={{ flex: 1, marginRight: 10 }} onPress={lib.scanning ? undefined : scan} />
          <GradButton ghost icon="add" label={t('addFiles')} style={{ flex: 1 }} onPress={add} />
        </View>
      ) : null}

      {seg === 'songs' && lib.tagging ? (
        <Text style={[T.cap, T.num, { paddingHorizontal: 22, marginTop: 12, color: C.cyan }]}>{t('readingTags', { a: lib.tagging.done, b: lib.tagging.total })}</Text>
      ) : null}

      {seg === 'playlists' ? (
        <Glass radius={R.md} style={st.newRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('newPlaylist')}
            placeholderTextColor={C.faint}
            style={st.input}
            selectionColor={C.cyan}
            returnKeyType="done"
            accessibilityLabel={t('newPlaylist')}
            onSubmitEditing={() => {
              if (name.trim()) {
                lib.createPlaylist(name);
                setName('');
              }
            }}
          />
          <Press
            haptic="strong"
            disabled={!name.trim()}
            onPress={() => {
              lib.createPlaylist(name);
              setName('');
            }}
            style={[st.createBtn, !name.trim() && { opacity: 0.4 }]}
          >
            <Text style={[T.body, { fontWeight: '700' }]}>{t('create')}</Text>
          </Press>
        </Glass>
      ) : null}

      {isTrackSeg ? <PlayBar tracks={tracks} /> : null}
    </View>
  );

  if (isTrackSeg) {
    const emptyText = seg === 'songs' ? t('emptySongs') : seg === 'downloads' ? t('emptyDownloads') : t('emptyFavorites');
    const icon = seg === 'downloads' ? 'arrow-down-circle-outline' : seg === 'favorites' ? 'heart-outline' : 'musical-notes-outline';
    return <TrackList tracks={tracks} title={t('library')} header={header} empty={<Empty icon={icon} text={emptyText} />} />;
  }

  if (seg === 'albums') {
    const size = (W - 20 * 2 - 16) / 2;
    return (
      <FlatList
        key="albums"
        data={albums}
        numColumns={2}
        keyExtractor={(x) => 'al:' + x.key}
        ListHeaderComponent={<View style={{ marginBottom: 12 }}>{header}</View>}
        ListEmptyComponent={<Empty icon="disc-outline" text={t('emptyAlbums')} />}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ paddingHorizontal: 20, justifyContent: 'space-between' }}
        contentContainerStyle={{ paddingBottom: CHROME_SPACE + insets.bottom }}
        renderItem={({ item }) => (
          <Press scaleTo={0.96} onPress={() => setDetail({ type: 'album', key: item.key })} style={{ width: size, marginBottom: 20 }}>
            <Artwork uri={lib.artworkOf(item.tracks[0])} size={size} radius={22} />
            <Text style={[T.body, { fontWeight: '600', marginTop: 10 }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[T.sub, { marginTop: 2 }]} numberOfLines={1}>{item.artist || t('tracksCount', { n: item.tracks.length })}</Text>
          </Press>
        )}
      />
    );
  }

  const rows = seg === 'artists' ? artists : lib.playlists;
  return (
    <FlatList
      key="rows"
      data={rows}
      keyExtractor={(x) => 'r:' + (x.id || x.key)}
      ListHeaderComponent={header}
      ListEmptyComponent={<Empty icon={seg === 'artists' ? 'person-outline' : 'list-outline'} text={seg === 'artists' ? t('emptyArtists') : t('emptyPlaylists')} />}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: CHROME_SPACE + insets.bottom }}
      renderItem={({ item }) =>
        seg === 'artists' ? (
          <RowLink icon="person" title={item.key || t('unknownArtist')} sub={t('tracksCount', { n: item.tracks.length })} onPress={() => setDetail({ type: 'artist', key: item.key })} />
        ) : (
          <RowLink icon="list" title={item.name} sub={t('tracksCount', { n: item.tracks.length })} onPress={() => setDetail({ type: 'playlist', key: item.id })} />
        )
      }
    />
  );
}

const st = StyleSheet.create({
  actions: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 12 },
  playBar: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 14, marginBottom: 10 },
  link: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 9 },
  linkIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.glassStrong, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke },
  detailTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 48 },
  newRow: { flexDirection: 'row', alignItems: 'center', height: 52, marginHorizontal: 20, marginTop: 12, marginBottom: 10, paddingLeft: 16, paddingRight: 6 },
  input: { flex: 1, height: 52, color: C.text, fontSize: 16, fontWeight: '500' },
  createBtn: { height: 40, paddingHorizontal: 16, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: C.glassStrong },
});
