// Validación y limpieza del catálogo antes de guardarlo (nunca confiamos en lo que llega del navegador).

const str = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

function price(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n * 100) / 100 : null;
}

// Solo se aceptan imágenes subidas por este mismo sistema
function image(v) {
  const s = str(v, 120);
  return /^\/api\/img\?id=[A-Za-z0-9-]{8,64}$/.test(s) ? s : "";
}

function cleanId(v, used, prefix) {
  let id = /^[A-Za-z0-9_-]{1,64}$/.test(String(v || "")) ? String(v) : "";
  if (!id || used.has(id)) id = prefix + Math.random().toString(36).slice(2, 10);
  used.add(id);
  return id;
}

export function sanitizeCatalog(input) {
  if (!input || typeof input !== "object") return null;
  if (!Array.isArray(input.products) || !Array.isArray(input.services)) return null;

  const s = input.settings && typeof input.settings === "object" ? input.settings : {};
  const settings = {
    whatsapp: str(s.whatsapp, 20).replace(/\D/g, ""),
    instagram: str(s.instagram, 40).replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, ""),
    city: str(s.city, 60),
    address: str(s.address, 160),
    hours: str(s.hours, 160)
  };
  if (settings.whatsapp && (settings.whatsapp.length < 8 || settings.whatsapp.length > 15)) settings.whatsapp = "";

  const usedP = new Set();
  const products = input.products.slice(0, 500).map((p) => {
    p = p && typeof p === "object" ? p : {};
    const out = {
      id: cleanId(p.id, usedP, "p-"),
      name: str(p.name, 80),
      size: str(p.size, 30),
      category: str(p.category, 40),
      description: str(p.description, 400),
      price: price(p.price),
      offer: p.offer === true,
      offerPrice: price(p.offerPrice),
      inStock: p.inStock !== false,
      visible: p.visible !== false,
      image: image(p.image)
    };
    if (out.offer && out.offerPrice === null) out.offer = false; // una oferta sin precio no tiene sentido
    return out;
  }).filter((p) => p.name);

  const usedS = new Set();
  const services = input.services.slice(0, 100).map((v) => {
    v = v && typeof v === "object" ? v : {};
    return {
      id: cleanId(v.id, usedS, "s-"),
      name: str(v.name, 80),
      description: str(v.description, 300),
      price: price(v.price),
      visible: v.visible !== false
    };
  }).filter((v) => v.name);

  return { settings, services, products, updated: new Date().toISOString() };
}

// Versión pública: sin lo que está oculto
export function publicView(catalog) {
  return {
    seeded: true,
    settings: catalog.settings || {},
    services: (catalog.services || []).filter((x) => x.visible !== false),
    products: (catalog.products || []).filter((x) => x.visible !== false),
    updated: catalog.updated || null
  };
}
