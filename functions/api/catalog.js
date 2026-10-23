import { json, isAuthed } from "../_lib/auth.js";
import { sanitizeCatalog, publicView } from "../_lib/catalog.js";

const KEY = "catalog";

// GET /api/catalog          -> catálogo público (sin productos/servicios ocultos)
// GET /api/catalog?all=1    -> catálogo completo (requiere sesión del panel)
export async function onRequestGet({ request, env }) {
  const wantAll = new URL(request.url).searchParams.get("all") === "1";
  if (wantAll && !(await isAuthed(request, env))) return json({ error: "No autorizado." }, 401);

  if (!env.CATALOG) return json({ seeded: false, reason: "kv-no-conectado" });

  const raw = await env.CATALOG.get(KEY);
  if (!raw) return json({ seeded: false });

  let catalog;
  try { catalog = JSON.parse(raw); } catch (_) { return json({ seeded: false, reason: "catalogo-corrupto" }); }

  if (wantAll) return json({ seeded: true, ...catalog });
  return json(publicView(catalog));
}

// PUT /api/catalog  { settings, services, products }  (requiere sesión)
export async function onRequestPut({ request, env }) {
  if (!(await isAuthed(request, env))) return json({ error: "No autorizado." }, 401);
  if (!env.CATALOG) return json({ error: "Falta conectar el KV (variable CATALOG) al proyecto en Cloudflare." }, 500);

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "Datos inválidos." }, 400); }

  const clean = sanitizeCatalog(body);
  if (!clean) return json({ error: "Datos inválidos." }, 400);

  await env.CATALOG.put(KEY, JSON.stringify(clean));
  return json({ seeded: true, ...clean });
}
