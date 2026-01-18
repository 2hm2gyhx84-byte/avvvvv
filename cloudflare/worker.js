// Cloudflare Worker API for Aviva-style portal
// Uses Cloudflare D1 for users and JWT cookie for sessions.

function jsonResponse(obj, status = 200, request) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Allow-Credentials', 'true');
  return new Response(JSON.stringify(obj), { status, headers });
}

function base64UrlEncode(b) {
  return btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

async function hmacSign(secret, msg) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return new Uint8Array(sig);
}

async function jwtSign(payloadObj, secret, opts = { expSeconds: 60 * 60 * 4 }) {
  const header = { typ: 'JWT', alg: 'HS256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = Object.assign({ iat: now }, payloadObj);
  if (opts.expSeconds) payload.exp = now + opts.expSeconds;
  const headerB = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const toSign = `${headerB}.${payloadB}`;
  const sigBuf = await hmacSign(secret, toSign);
  const sigB = base64UrlEncode(sigBuf);
  return `${toSign}.${sigB}`;
}

async function jwtVerify(token, secret) {
  try {
    const [headerB, payloadB, sigB] = token.split('.');
    const toSign = `${headerB}.${payloadB}`;
    const expected = base64UrlEncode(await hmacSign(secret, toSign));
    if (expected !== sigB) return null;
    const payloadStr = new TextDecoder().decode(base64UrlDecode(payloadB));
    const payload = JSON.parse(payloadStr);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

async function hashPassword(password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  return { salt: base64UrlEncode(salt.buffer), hash: base64UrlEncode(derived) };
}

async function verifyPassword(password, saltB64, hashB64) {
  const enc = new TextEncoder();
  const saltBuf = base64UrlDecode(saltB64);
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBuf, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  const derivedB64 = base64UrlEncode(derived);
  return derivedB64 === hashB64;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      const headers = new Headers();
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      headers.set('Access-Control-Allow-Credentials', 'true');
      return new Response(null, { status: 204, headers });
    }
    const url = new URL(request.url);
    // Ensure users table exists
    try {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
    } catch (e) {
      // ignore
    }

    if (url.pathname === '/api/me' && request.method === 'GET') {
      const auth = request.headers.get('Authorization') || request.headers.get('authorization') || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!token) return jsonResponse({ user: null });
      const secret = env.JWT_SECRET || 'change_me';
      const payload = await jwtVerify(token, secret);
      if (!payload) return jsonResponse({ user: null });
      return jsonResponse({ user: { id: payload.id, name: payload.name, email: payload.email } });
    }

    if (url.pathname === '/api/register' && request.method === 'POST') {
      const body = await request.json();
      const { name, email, password } = body || {};
      if (!name || !email || !password) return jsonResponse({ error: 'Missing fields' }, 400);
      const lower = email.toLowerCase();
      try {
        const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(lower).first();
        if (existing) return jsonResponse({ error: 'Email already exists' }, 409);
        const { salt, hash } = await hashPassword(password);
        const insert = await env.DB.prepare('INSERT INTO users (name, email, password_hash, salt) VALUES (?, ?, ?, ?)').bind(name, lower, hash, salt).run();
        const id = insert?.lastInsertRowId || null;
        const jwt = await jwtSign({ id, name, email: lower }, env.JWT_SECRET || 'change_me');
        return jsonResponse({ ok: true, token: jwt });
      } catch (e) {
        return jsonResponse({ error: 'DB or server error' }, 500);
      }
    }

    if (url.pathname === '/api/login' && request.method === 'POST') {
      const body = await request.json();
      const { email, password } = body || {};
      if (!email || !password) return jsonResponse({ error: 'Missing fields' }, 400);
      const lower = email.toLowerCase();
      try {
        const row = await env.DB.prepare('SELECT id, name, email, password_hash, salt FROM users WHERE email = ?').bind(lower).first();
        if (!row) return jsonResponse({ error: 'Invalid credentials' }, 401);
        const ok = await verifyPassword(password, row.salt, row.password_hash);
        if (!ok) return jsonResponse({ error: 'Invalid credentials' }, 401);
        const jwt = await jwtSign({ id: row.id, name: row.name, email: row.email }, env.JWT_SECRET || 'change_me');
        return jsonResponse({ ok: true, token: jwt });
      } catch (e) {
        return jsonResponse({ error: 'DB or server error' }, 500);
      }
    }

    if (url.pathname === '/api/logout' && request.method === 'POST') {
      // Token-based logout is a client-side operation (delete token). Return ok for symmetry.
      return jsonResponse({ ok: true });
    }

    // Friendly welcome message for root path
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response('Welcome to the Aviva Portal API Worker!', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    return new Response('Not found', { status: 404 });
  }
};
