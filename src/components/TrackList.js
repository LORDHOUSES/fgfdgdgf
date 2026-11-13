import React, { useCallback } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CHROME_SPACE } from '../theme';
import { useI18n } from '../i18n';
import { useLibrary } from '../library';
import { usePlayer } from '../player';
import { useOnline } from '../net';
import { useUI } from './ui';
import TrackRow from './TrackRow';
import { useCollapsing } from './Collapsing';

// One list used everywhere: it knows how to play, dim offline-unavailable songs and open the menu.
export default function TrackList({ tracks, header, empty, footer, menuExtra, refreshControl, keyboardDismiss, title }) {
  const { onScroll, Bar } = useCollapsing(title || '');
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const lib = useLibrary();
  const player = usePlayer();
  const online = useOnline();
  const ui = useUI();
  const currentId = player.track ? player.track.id : null;

  const renderItem = useCallback(
    ({ item, index }) => {
      const ok = online || lib.isOfflineReady(item);
      return (
        <TrackRow
          track={item}
          artwork={lib.artworkOf(item)}
          active={item.id === currentId}
          playing={player.playing}
          downloaded={item.source === 'audius' && !!lib.downloadMap[item.id]}
          progress={lib.progress[item.id]}
          dimmed={!ok}
          subtitle={item.artist || (item.source === 'local' ? t('unknownArtist') : '')}
          onPress={() => {
            if (!ok) return ui.toast(t('needNet'));
            if (item.id === currentId) return player.toggle();
            const list = online ? tracks : tracks.filter((x) => lib.isOfflineReady(x));
            player.playQueue(list, Math.max(0, list.findIndex((x) => x.id === item.id)));
          }}
          onMore={() => ui.openMenu(item, menuExtra)}
        />
      );
    },
    [tracks, online, currentId, player.playing, lib.downloadMap, lib.progress, lib.artworkOf, menuExtra, t]
  );

  return (
    <View style={{ flex: 1 }}>
      <Animated.FlatList
        data={tracks}
        keyExtractor={(x) => x.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        refreshControl={refreshControl}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={keyboardDismiss ? 'on-drag' : 'none'}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={9}
        contentContainerStyle={{ paddingBottom: CHROME_SPACE + insets.bottom }}
      />
      {title ? Bar : null}
    </View>
  );
}
