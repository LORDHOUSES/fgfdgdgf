// Audius public API. Free plan: 10 req/s. If you create an API key at audius.co/developers,
// put it in API_KEY and it is sent with every request.
const BASE = 'https://api.audius.co/v1';
const APP = 'lsmusic';
const API_KEY = '';

function q(params) {
  const p = { app_name: APP, ...params };
  if (API_KEY) p.api_key = API_KEY;
  return Object.keys(p)
    .filter((k) => p[k] !== undefined && p[k] !== null && p[k] !== '')
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(p[k]))
    .join('&');
}

async function get(path, params, signal) {
  const res = await fetch(BASE + path + '?' + q(params), { signal });
  if (!res.ok) throw new Error('audius ' + res.status);
  const json = await res.json();
  return json.data || [];
}

export function streamUrl(audiusId) {
  return BASE + '/tracks/' + audiusId + '/stream?' + q({});
}

function map(t) {
  const art = t.artwork || {};
  return {
    id: 'audius:' + t.id,
    audiusId: t.id,
    source: 'audius',
    title: (t.title || '').trim(),
    artist: (t.user && t.user.name) || '',
    album: (t.album_backlink && t.album_backlink.playlist_name) || '',
    genre: t.genre || '',
    duration: t.duration || 0,
    artwork: art['480x480'] || art['150x150'] || null,
    artworkLarge: art['1000x1000'] || art['480x480'] || null,
    plays: t.play_count || 0,
  };
}

const playable = (t) => t.is_streamable !== false && !t.is_stream_gated && !t.is_delete;

export async function trending(genre, signal) {
  const data = await get('/tracks/trending', { genre, limit: 40 }, signal);
  return data.filter(playable).map(map);
}

export async function searchTracks(query, signal) {
  const data = await get('/tracks/search', { query, limit: 40 }, signal);
  return data.filter(playable).map(map);
}

export const GENRES = [
  { key: '', label: null },
  { key: 'Electronic', label: 'Electronic' },
  { key: 'Hip-Hop/Rap', label: 'Hip-Hop' },
  { key: 'Pop', label: 'Pop' },
  { key: 'Rock', label: 'Rock' },
  { key: 'Lo-Fi', label: 'Lo-Fi' },
  { key: 'House', label: 'House' },
  { key: 'R&B/Soul', label: 'R&B' },
  { key: 'Jazz', label: 'Jazz' },
  { key: 'Ambient', label: 'Ambient' },
  { key: 'Alternative', label: 'Alternative' },
  { key: 'Latin', label: 'Latin' },
];
