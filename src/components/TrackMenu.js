import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, T } from '../theme';
import { useI18n } from '../i18n';
import { useLibrary } from '../library';
import { usePlayer } from '../player';
import { useOnline } from '../net';
import { Artwork, Press, useUI } from './ui';

function Item({ icon, label, onPress, danger }) {
  return (
    <Press onPress={onPress} haptic scaleTo={0.98} style={st.item}>
      <Ionicons name={icon} size={21} color={danger ? C.danger : C.text} style={{ width: 34 }} />
      <Text style={[T.head, { fontWeight: '500', flex: 1 }, danger && { color: C.danger }]} numberOfLines={1}>{label}</Text>
    </Press>
  );
}

export default function TrackMenu() {
  const ui = useUI();
  const { t } = useI18n();
  const lib = useLibrary();
  const player = usePlayer();
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const [picking, setPicking] = useState(false);
  const m = ui.menu;
  useEffect(() => {
    if (!m) setPicking(false);
  }, [m]);
  if (!m) return null;
  const tr = m.track;
  const fav = lib.favSet.has(tr.id);
  const isAudius = tr.source === 'audius';
  const downloaded = !!lib.downloadMap[tr.id];
  const run = (fn) => () => {
    ui.closeMenu();
    fn();
  };

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={ui.closeMenu}>
      <Animated.View entering={FadeIn.duration(160)} style={st.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={ui.closeMenu} accessibilityLabel={t('cancel')} />
        <Animated.View entering={SlideInDown.springify().damping(20).stiffness(210)} style={[st.sheet, { paddingBottom: insets.bottom + 14 }]}>
          <View style={st.grab} />
          <View style={st.head}>
            <Artwork uri={lib.artworkOf(tr)} size={54} radius={12} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={T.head} numberOfLines={1}>{tr.title}</Text>
              <Text style={[T.sub, { marginTop: 3 }]} numberOfLines={1}>{tr.artist || t('unknownArtist')}</Text>
            </View>
          </View>
          <View style={st.rule} />
          {picking ? (
            <ScrollView style={{ maxHeight: 320 }}>
              {lib.playlists.length === 0 ? <Text style={[T.sub, { padding: 22, textAlign: 'center' }]}>{t('emptyPlaylists')}</Text> : null}
              {lib.playlists.map((p) => (
                <Item key={p.id} icon="list" label={p.name} onPress={run(() => {
                  lib.addToPlaylist(p.id, tr);
                  ui.toast(t('addedTo', { name: p.name }));
                })} />
              ))}
            </ScrollView>
          ) : (
            <View>
              <Item icon="play-skip-forward-outline" label={t('playNext')} onPress={run(() => player.playNext(tr))} />
              <Item icon="add-circle-outline" label={t('addQueue')} onPress={run(() => {
                player.addToQueue(tr);
                ui.toast(t('added'));
              })} />
              <Item icon={fav ? 'heart' : 'heart-outline'} label={fav ? t('removeFav') : t('addFav')} onPress={run(() => lib.toggleFav(tr))} />
              <Item icon="list-outline" label={t('addToPlaylist')} onPress={() => setPicking(true)} />
              {isAudius && !downloaded ? (
                <Item icon="arrow-down-circle-outline" label={t('download')} onPress={run(async () => {
                  if (!online) return ui.toast(t('needNet'));
                  ui.toast(t('downloading'));
                  const ok = await lib.download(tr);
                  ui.toast(ok ? t('downloaded') : t('downloadFail'));
                })} />
              ) : null}
              {isAudius && downloaded ? <Item icon="trash-outline" danger label={t('removeDownload')} onPress={run(() => lib.removeDownload(tr))} /> : null}
              {m.playlistId ? <Item icon="remove-circle-outline" danger label={t('removeFromPlaylist')} onPress={run(() => lib.removeFromPlaylist(m.playlistId, tr.id))} /> : null}
              {tr.source === 'local' && !m.playlistId ? (
                <Item icon="trash-outline" danger label={t('removeFromLibrary')} onPress={run(() => {
                  lib.removeLocal(tr);
                  ui.toast(t('removed'));
                })} />
              ) : null}
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const st = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(2,3,8,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: 'rgba(17,19,36,0.985)', borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: C.stroke, paddingTop: 8 },
  grab: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: C.faint, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: C.stroke, marginHorizontal: 20, marginBottom: 6 },
  item: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 22 },
});
