// Reads title / artist / album / track number / cover from MP3 (ID3v2), M4A (MP4 atoms) and FLAC.
// Pure JS so it also runs inside Expo Go. `read(position, length)` must resolve to a Uint8Array.

const MAX_TAG = 8 * 1024 * 1024;
const MAX_PIC = 5 * 1024 * 1024;

const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u24 = (b, o) => (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];
const synch = (b, o) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
const ascii = (b, o, n) => {
  let s = '';
  for (let i = 0; i < n; i++) s += String.fromCharCode(b[o + i]);
  return s;
};

function utf8(b, start, end) {
  let s = '';
  let i = start;
  while (i < end) {
    const c = b[i++];
    if (c < 0x80) s += String.fromCharCode(c);
    else if (c < 0xe0) s += String.fromCharCode(((c & 0x1f) << 6) | (b[i++] & 0x3f));
    else if (c < 0xf0) {
      s += String.fromCharCode(((c & 0x0f) << 12) | ((b[i] & 0x3f) << 6) | (b[i + 1] & 0x3f));
      i += 2;
    } else {
      const cp = (((c & 0x07) << 18) | ((b[i] & 0x3f) << 12) | ((b[i + 1] & 0x3f) << 6) | (b[i + 2] & 0x3f)) - 0x10000;
      i += 3;
      s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return s;
}

function utf16(b, start, end, big) {
  let s = '';
  for (let i = start; i + 1 < end; i += 2) s += String.fromCharCode(big ? (b[i] << 8) | b[i + 1] : (b[i + 1] << 8) | b[i]);
  return s;
}

function latin1(b, start, end) {
  let s = '';
  for (let i = start; i < end; i++) s += String.fromCharCode(b[i]);
  return s;
}

// ID3 text with its leading encoding byte.
function id3Text(b, start, end) {
  if (end <= start) return '';
  const enc = b[start];
  let s;
  let o = start + 1;
  if (enc === 0) s = latin1(b, o, end);
  else if (enc === 3) s = utf8(b, o, end);
  else if (enc === 2) s = utf16(b, o, end, true);
  else {
    let big = false;
    if (b[o] === 0xfe && b[o + 1] === 0xff) {
      big = true;
      o += 2;
    } else if (b[o] === 0xff && b[o + 1] === 0xfe) o += 2;
    s = utf16(b, o, end, big);
  }
  const z = s.indexOf('\u0000');
  return (z >= 0 ? s.slice(0, z) : s).trim();
}

// Index just past a terminated string in the given ID3 encoding.
function skipString(b, o, end, enc) {
  if (enc === 0 || enc === 3) {
    while (o < end && b[o] !== 0) o++;
    return o + 1;
  }
  while (o + 1 < end && !(b[o] === 0 && b[o + 1] === 0)) o += 2;
  return o + 2;
}

const mimeOf = (b, o) => {
  if (b[o] === 0x89 && b[o + 1] === 0x50) return 'png';
  return 'jpg';
};

function deunsync(b) {
  const out = new Uint8Array(b.length);
  let n = 0;
  for (let i = 0; i < b.length; i++) {
    out[n++] = b[i];
    if (b[i] === 0xff && b[i + 1] === 0x00) i++;
  }
  return out.subarray(0, n);
}

async function parseId3(read, head) {
  const ver = head[3];
  const flags = head[5];
  const size = synch(head, 6);
  if (ver < 2 || ver > 4 || size <= 0 || size > MAX_TAG) return null;
  let b = await read(10, size);
  if (flags & 0x80 && ver < 4) b = deunsync(b);
  const out = {};
  let o = 0;
  if (ver > 2 && flags & 0x40) o += ver === 4 ? synch(b, 0) : u32(b, 0) + 4;
  const idLen = ver === 2 ? 3 : 4;
  const hdr = ver === 2 ? 6 : 10;
  while (o + hdr <= b.length) {
    const id = ascii(b, o, idLen);
    if (b[o] === 0) break;
    const len = ver === 2 ? u24(b, o + 3) : ver === 4 ? synch(b, o + 4) : u32(b, o + 4);
    const start = o + hdr;
    const end = start + len;
    if (len <= 0 || end > b.length) break;
    if (id === 'TIT2' || id === 'TT2') out.title = id3Text(b, start, end);
    else if (id === 'TPE1' || id === 'TP1') out.artist = id3Text(b, start, end);
    else if (id === 'TALB' || id === 'TAL') out.album = id3Text(b, start, end);
    else if (id === 'TRCK' || id === 'TRK') out.trackNo = parseInt(id3Text(b, start, end), 10) || undefined;
    else if ((id === 'APIC' || id === 'PIC') && !out.picture) {
      const enc = b[start];
      let p = start + 1;
      if (id === 'PIC') p += 3;
      else {
        while (p < end && b[p] !== 0) p++;
        p++;
      }
      p++; // picture type
      p = skipString(b, p, end, enc);
      if (p < end && end - p <= MAX_PIC) out.picture = { data: b.slice(p, end), ext: mimeOf(b, p) };
    }
    o = end;
  }
  return out;
}

async function parseFlac(read, size) {
  const out = {};
  let o = 4;
  for (let guard = 0; guard < 40 && o + 4 <= size; guard++) {
    const h = await read(o, 4);
    const last = h[0] & 0x80;
    const type = h[0] & 0x7f;
    const len = u24(h, 1);
    if (type === 4 && len < MAX_TAG) {
      const b = await read(o + 4, len);
      const le = (p) => (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0;
      let p = 4 + le(0);
      const count = le(p);
      p += 4;
      for (let i = 0; i < count && p + 4 <= b.length; i++) {
        const l = le(p);
        p += 4;
        const s = utf8(b, p, Math.min(b.length, p + l));
        p += l;
        const eq = s.indexOf('=');
        if (eq < 0) continue;
        const k = s.slice(0, eq).toUpperCase();
        const v = s.slice(eq + 1).trim();
        if (k === 'TITLE') out.title = v;
        else if (k === 'ARTIST') out.artist = v;
        else if (k === 'ALBUM') out.album = v;
        else if (k === 'TRACKNUMBER') out.trackNo = parseInt(v, 10) || undefined;
      }
    } else if (type === 6 && !out.picture && len <= MAX_PIC + 1024) {
      const b = await read(o + 4, len);
      let p = 4;
      p += 4 + u32(b, p); // mime
      p += 4 + u32(b, p); // description
      p += 16;
      const l = u32(b, p);
      p += 4;
      if (p + l <= b.length) out.picture = { data: b.slice(p, p + l), ext: mimeOf(b, p) };
    }
    o += 4 + len;
    if (last) break;
  }
  return out;
}

// Walk the MP4 atom tree down to moov/udta/meta/ilst without loading the audio data.
async function parseMp4(read, size) {
  const out = {};
  const path = ['moov', 'udta', 'meta', 'ilst'];
  let start = 0;
  let end = size;
  for (let depth = 0; depth < path.length; depth++) {
    let o = start;
    let found = false;
    for (let guard = 0; guard < 400 && o + 8 <= end; guard++) {
      const h = await read(o, 16);
      if (h.length < 8) break;
      let len = u32(h, 0);
      let hdr = 8;
      const name = latin1(h, 4, 8);
      if (len === 1 && h.length >= 16) {
        len = u32(h, 8) * 4294967296 + u32(h, 12);
        hdr = 16;
      } else if (len === 0) len = end - o;
      if (len < 8) break;
      if (name === path[depth]) {
        start = o + hdr + (name === 'meta' ? 4 : 0);
        end = o + len;
        found = true;
        break;
      }
      o += len;
    }
    if (!found) return out;
  }
  if (end - start > MAX_TAG) return out;
  const b = await read(start, end - start);
  let o = 0;
  while (o + 8 <= b.length) {
    const len = u32(b, o);
    if (len < 8) break;
    const name = latin1(b, o + 4, o + 8);
    // first child is the "data" atom: size, 'data', type(4), locale(4), payload
    const ds = o + 8;
    if (ds + 16 <= b.length && latin1(b, ds + 4, ds + 8) === 'data') {
      const dl = u32(b, ds);
      const ps = ds + 16;
      const pe = Math.min(b.length, ds + dl);
      if (name === '\u00a9nam') out.title = utf8(b, ps, pe).trim();
      else if (name === '\u00a9ART') out.artist = utf8(b, ps, pe).trim();
      else if (name === '\u00a9alb') out.album = utf8(b, ps, pe).trim();
      else if (name === 'trkn' && pe - ps >= 4) out.trackNo = (b[ps + 2] << 8) | b[ps + 3] || undefined;
      else if (name === 'covr' && !out.picture && pe - ps <= MAX_PIC) out.picture = { data: b.slice(ps, pe), ext: mimeOf(b, ps) };
    }
    o += len;
  }
  return out;
}

export async function parseTags(read, size) {
  try {
    const head = await read(0, 12);
    if (head.length < 10) return null;
    if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) return await parseId3(read, head);
    if (ascii(head, 0, 4) === 'fLaC') return await parseFlac(read, size);
    if (ascii(head, 4, 4) === 'ftyp') return await parseMp4(read, size);
    return null;
  } catch (e) {
    return null;
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_REV = (() => {
  const t = new Uint8Array(128);
  for (let i = 0; i < 64; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

export function fromBase64(s) {
  let len = s.length;
  while (len > 0 && s.charCodeAt(len - 1) === 61) len--;
  const out = new Uint8Array((len * 3) >> 2);
  let n = 0;
  for (let i = 0; i < len; i += 4) {
    const a = B64_REV[s.charCodeAt(i)];
    const b = B64_REV[s.charCodeAt(i + 1)];
    const c = i + 2 < len ? B64_REV[s.charCodeAt(i + 2)] : 0;
    const d = i + 3 < len ? B64_REV[s.charCodeAt(i + 3)] : 0;
    out[n++] = (a << 2) | (b >> 4);
    if (i + 2 < len) out[n++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < len) out[n++] = ((c & 3) << 6) | d;
  }
  return out;
}

export function toBase64(b) {
  const parts = [];
  for (let i = 0; i < b.length; i += 3) {
    const x = b[i];
    const y = i + 1 < b.length ? b[i + 1] : 0;
    const z = i + 2 < b.length ? b[i + 2] : 0;
    parts.push(B64[x >> 2] + B64[((x & 3) << 4) | (y >> 4)] + (i + 1 < b.length ? B64[((y & 15) << 2) | (z >> 6)] : '=') + (i + 2 < b.length ? B64[z & 63] : '='));
  }
  return parts.join('');
}
