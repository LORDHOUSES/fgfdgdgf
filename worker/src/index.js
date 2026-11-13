// LS music sync API — Cloudflare Worker + R2.
// R2 layout:  users/<username>.json  → { salt, hash, iter, createdAt }
//             data/<username>.json   → { doc, updatedAt }
// Secret:     TOKEN_SECRET (wrangler secret put TOKEN_SECRET)

const ITER = 100000;
const TOKEN_DAYS = 180;
const MAX_BODY = 1024 * 1024;
const enc = new TextEncoder();

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS },
  });
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, PUT, POST, DELETE, OPTIONS',
};
const fail = (status, code) => json({ error: code }, status);

const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function hashPassword(password, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
  return new Uint8Array(bits);
}

function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

async function makeToken(env, username) {
  const payload = b64u(enc.encode(JSON.stringify({ u: username, exp: Date.now() + TOKEN_DAYS * 86400000 })));
  return payload + '.' + b64u(await hmac(env.TOKEN_SECRET, payload));
}

async function readToken(env, request) {
  const h = request.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    if (!same(unb64u(sig), await hmac(env.TOKEN_SECRET, payload))) return null;
    const data = JSON.parse(new TextDecoder().decode(unb64u(payload)));
    return data.exp > Date.now() ? data.u : null;
  } catch (e) {
    return null;
  }
}

async function body(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) return { tooBig: true };
  try {
    return JSON.parse(text) || {};
  } catch (e) {
    return {};
  }
}

const cleanName = (s) => String(s || '').trim().toLowerCase();
const validName = (s) => /^[a-z0-9_.]{3,24}$/.test(s);

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (!env.TOKEN_SECRET) return fail(500, 'server_not_configured');
    const { pathname } = new URL(request.url);
    const route = request.method + ' ' + pathname;

    try {
      if (route === 'GET /') return json({ ok: true, service: 'ls-music-sync' });

      if (route === 'POST /v1/register') {
        const b = await body(request);
        const username = cleanName(b.username);
        const password = String(b.password || '');
        if (!validName(username)) return fail(400, 'bad_username');
        if (password.length < 8 || password.length > 200) return fail(400, 'bad_password');
        const key = 'users/' + username + '.json';
        if (await env.BUCKET.head(key)) return fail(409, 'username_taken');
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const hash = await hashPassword(password, salt, ITER);
        const put = await env.BUCKET.put(key, JSON.stringify({ salt: b64u(salt), hash: b64u(hash), iter: ITER, createdAt: Date.now() }), {
          onlyIf: new Headers({ 'If-None-Match': '*' }),
        });
        if (!put) return fail(409, 'username_taken');
        return json({ username, token: await makeToken(env, username) });
      }

      if (route === 'POST /v1/login') {
        const b = await body(request);
        const username = cleanName(b.username);
        const password = String(b.password || '');
        const obj = validName(username) ? await env.BUCKET.get('users/' + username + '.json') : null;
        // Hash even when the user is missing so both cases take the same time.
        const rec = obj ? await obj.json() : { salt: b64u(new Uint8Array(16)), hash: '', iter: ITER };
        const hash = await hashPassword(password.slice(0, 200), unb64u(rec.salt), rec.iter);
        if (!obj || !same(hash, unb64u(rec.hash))) return fail(401, 'bad_login');
        return json({ username, token: await makeToken(env, username) });
      }

      const user = await readToken(env, request);
      if (!user) return fail(401, 'unauthorized');
      const dataKey = 'data/' + user + '.json';

      if (route === 'GET /v1/sync') {
        const obj = await env.BUCKET.get(dataKey);
        if (!obj) return json({ doc: null, updatedAt: 0 });
        return new Response(obj.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
      }

      if (route === 'PUT /v1/sync') {
        const b = await body(request);
        if (b.tooBig) return fail(413, 'too_large');
        if (!b.doc || typeof b.doc !== 'object') return fail(400, 'bad_doc');
        const updatedAt = Date.now();
        await env.BUCKET.put(dataKey, JSON.stringify({ doc: b.doc, updatedAt }));
        return json({ ok: true, updatedAt });
      }

      if (route === 'DELETE /v1/account') {
        await env.BUCKET.delete([dataKey, 'users/' + user + '.json']);
        return json({ ok: true });
      }

      return fail(404, 'not_found');
    } catch (e) {
      return fail(500, 'server_error');
    }
  },
};
