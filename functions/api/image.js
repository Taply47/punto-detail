import { json, isAuthed } from "../_lib/auth.js";

const ALLOWED = { "image/webp": 1, "image/jpeg": 1, "image/png": 1 };
const MAX_BYTES = 1.5 * 1024 * 1024; // el panel ya las achica; esto es solo un tope de seguridad

// POST /api/image  (cuerpo = la imagen, Content-Type = image/webp|jpeg|png)  ->  { url }
export async function onRequestPost({ request, env }) {
  if (!(await isAuthed(request, env))) return json({ error: "No autorizado." }, 401);
  if (!env.CATALOG) return json({ error: "Falta conectar el KV (variable CATALOG) al proyecto en Cloudflare." }, 500);

  const type = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED[type]) return json({ error: "Formato no permitido. Usá JPG, PNG o WebP." }, 415);

  const buf = await request.arrayBuffer();
  if (!buf.byteLength) return json({ error: "Imagen vacía." }, 400);
  if (buf.byteLength > MAX_BYTES) return json({ error: "La imagen es demasiado pesada." }, 413);

  const id = crypto.randomUUID();
  await env.CATALOG.put("img:" + id, buf, { metadata: { type } });
  return json({ url: "/api/img?id=" + id });
}
