import { json, makeToken, safeEqual } from "../_lib/auth.js";

// POST /api/login  { password }  ->  { token }
export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) {
    return json({ error: "Falta configurar la contraseña (variable ADMIN_PASSWORD en Cloudflare)." }, 500);
  }

  // Límite de intentos por IP (8 cada 15 minutos). Si no hay KV conectado, se omite.
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const rlKey = "rl:" + ip;
  let tries = 0;
  if (env.CATALOG) {
    tries = parseInt((await env.CATALOG.get(rlKey)) || "0", 10) || 0;
    if (tries >= 8) return json({ error: "Demasiados intentos. Probá de nuevo en 15 minutos." }, 429);
  }

  let body = {};
  try { body = await request.json(); } catch (_) {}
  const ok = await safeEqual(String(body.password || ""), env.ADMIN_PASSWORD);

  if (!ok) {
    if (env.CATALOG) await env.CATALOG.put(rlKey, String(tries + 1), { expirationTtl: 900 });
    await new Promise((r) => setTimeout(r, 500));
    return json({ error: "Contraseña incorrecta." }, 401);
  }
  if (env.CATALOG && tries) await env.CATALOG.delete(rlKey);
  return json({ token: await makeToken(env) });
}
