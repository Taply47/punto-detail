import { json, isAuthed } from "../_lib/auth.js";

const ID = /^[A-Za-z0-9-]{8,64}$/;
const ALLOWED = { "image/webp": 1, "image/jpeg": 1, "image/png": 1 };

// GET /api/img?id=...  -> la imagen (pública, con caché larga: cada subida tiene un id nuevo)
export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!ID.test(id) || !env.CATALOG) return new Response("Not found", { status: 404 });

  const { value, metadata } = await env.CATALOG.getWithMetadata("img:" + id, { type: "arrayBuffer" });
  if (!value) return new Response("Not found", { status: 404 });

  const type = metadata && ALLOWED[metadata.type] ? metadata.type : "application/octet-stream";
  return new Response(value, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

// DELETE /api/img?id=...  (requiere sesión) -> borra una imagen que ya no se usa
export async function onRequestDelete({ request, env }) {
  if (!(await isAuthed(request, env))) return json({ error: "No autorizado." }, 401);
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!ID.test(id) || !env.CATALOG) return json({ error: "Id inválido." }, 400);
  await env.CATALOG.delete("img:" + id);
  return json({ ok: true });
}
