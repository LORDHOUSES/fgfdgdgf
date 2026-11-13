import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, T, fmtTime } from '../theme';
import { Artwork, Bars, IconBtn, Press } from './ui';

function Ring({ value }) {
  // Tiny download meter: a track that fills left to right.
  return (
    <View style={st.meter}>
      <View style={[st.meterFill, { width: Math.round(value * 100) + '%' }]} />
    </View>
  );
}

function TrackRow({ track, artwork, active, playing, downloaded, progress, onPress, onMore, subtitle, dimmed }) {
  return (
    <Press onPress={onPress} onLongPress={onMore} scaleTo={0.985} style={[st.row, dimmed && { opacity: 0.38 }]}>
      <View>
        <Artwork uri={artwork} size={52} radius={12} />
        {active ? (
          <View style={st.playingVeil}>
            <Bars size={20} active={playing} mono="#fff" />
          </View>
        ) : null}
      </View>
      <View style={st.mid}>
        <Text style={[T.body, { fontWeight: '600' }, active && { color: C.cyan }]} numberOfLines={1}>{track.title}</Text>
        <View style={st.subRow}>
          {downloaded ? <Ionicons name="arrow-down-circle" size={13} color={C.cyan} style={{ marginRight: 5 }} /> : null}
          <Text style={[T.sub, { flexShrink: 1 }]} numberOfLines={1}>{subtitle || track.artist || '—'}</Text>
        </View>
        {progress != null ? <Ring value={progress} /> : null}
      </View>
      {track.duration ? <Text style={[T.cap, T.num, { marginRight: 2 }]}>{fmtTime(track.duration)}</Text> : null}
      <IconBtn name="ellipsis-horizontal" size={19} color={C.dim} onPress={onMore} box={40} />
    </Press>
  );
}

export default memo(TrackRow);

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  mid: { flex: 1, marginLeft: 14, marginRight: 8 },
  subRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  playingVeil: { ...StyleSheet.absoluteFillObject, borderRadius: 12, backgroundColor: 'rgba(4,5,12,0.6)', alignItems: 'center', justifyContent: 'center' },
  meter: { height: 3, borderRadius: 2, backgroundColor: C.glassStrong, marginTop: 7, overflow: 'hidden' },
  meterFill: { height: 3, borderRadius: 2, backgroundColor: C.cyan },
});
