// Autenticación del panel: token firmado (HMAC-SHA256) sin sesiones guardadas.
// Se firma con ADMIN_PASSWORD: si cambiás la contraseña en Cloudflare, se cierran todas las sesiones.

const enc = new TextEncoder();
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

function toB64u(bytes) {
  let s = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64u(str) {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function sign(secret, data) {
  const key = await hmacKey(secret);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

// Comparación en tiempo constante (compara las firmas de ambos valores)
export async function safeEqual(a, b) {
  const [x, y] = await Promise.all([sign("cmp", String(a)), sign("cmp", String(b))]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function makeToken(env) {
  const payload = toB64u(enc.encode(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })));
  const sig = toB64u(await sign(env.ADMIN_PASSWORD, payload));
  return payload + "." + sig;
}

export async function isAuthed(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  try {
    const key = await hmacKey(env.ADMIN_PASSWORD);
    const ok = await crypto.subtle.verify("HMAC", key, fromB64u(parts[1]), enc.encode(parts[0]));
    if (!ok) return false;
    const payload = JSON.parse(new TextDecoder().decode(fromB64u(parts[0])));
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch (_) {
    return false;
  }
}

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }
  });
}
