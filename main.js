(function () {
  "use strict";

  var B = window.__BRAND__ || { settings: {}, seed: { services: [], products: [] } };
  var CART_KEY = "pd_cart_v1";

  var $ = function (sel, scope) { return (scope || document).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

  var state = { settings: {}, services: [], products: [], cart: {}, cat: "", q: "" };

  /* ---------- Utilidades ---------- */
  function money(n) {
    try { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n); }
    catch (_) { return "$ " + n; }
  }
  function effPrice(p) { return p.offer && p.offerPrice != null ? p.offerPrice : p.price; }
  function waNumber() { var n = String(state.settings.whatsapp || "").replace(/\D/g, ""); return n.length >= 8 ? n : ""; }
  function waLink(text) {
    var n = waNumber();
    return n ? "https://wa.me/" + n + "?text=" + encodeURIComponent(text) : "#contacto";
  }
  var toastTimer;
  function toast(msg) {
    var t = $("[data-toast]");
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- Catálogo: del servidor, o los datos iniciales si no hay ---------- */
  function fetchCatalog() {
    if (location.protocol === "file:" || !window.fetch) return Promise.resolve(null);
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
    return fetch("/api/catalog", { cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { clearTimeout(timer); return d && d.seeded ? d : null; })
      .catch(function () { clearTimeout(timer); return null; });
  }

  function applyCatalog(d) {
    var src = d || { settings: {}, services: B.seed.services, products: B.seed.products };
    var s = {}, def = B.settings || {}, got = src.settings || {};
    Object.keys(def).forEach(function (k) { s[k] = got[k] ? got[k] : def[k]; });
    state.settings = s;
    state.services = (src.services || []).filter(function (x) { return x.visible !== false; });
    state.products = (src.products || []).filter(function (x) { return x.visible !== false; });
  }

  /* ---------- Contacto / datos del negocio ---------- */
  function mountContact() {
    var s = state.settings;
    var link = waLink("Hola Punto Detail! Quería hacer una consulta.");
    $$("[data-wa]").forEach(function (a) { a.href = link; if (waNumber()) { a.target = "_blank"; a.rel = "noopener"; } });
    $$("[data-insta]").forEach(function (a) { if (s.instagram) a.href = "https://www.instagram.com/" + s.instagram + "/"; });

    var addr = $("[data-address]"), hours = $("[data-hours]");
    var city = s.city || "Carmen de Patagones";
    if (addr) addr.textContent = s.address ? s.address + ", " + city : city + ", Buenos Aires";
    if (hours) hours.textContent = s.hours || "Consultanos por WhatsApp";

    var row = $("[data-map-row]"), map = $("[data-map]");
    if (row && map && s.address) {
      map.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(s.address + ", " + city);
      row.hidden = false;
    } else if (row) { row.hidden = true; }

    var y = $("[data-year]"); if (y) y.textContent = new Date().getFullYear();
  }

  /* ---------- Servicios ---------- */
  function renderServices() {
    var box = $("[data-services]");
    if (!box) return;
    box.textContent = "";
    state.services.forEach(function (sv, i) {
      var a = el("article", "svc reveal");
      a.style.setProperty("--d", (Math.min(i, 5) * 0.06) + "s");
      a.appendChild(el("span", "svc-num", String(i + 1).padStart(2, "0")));
      a.appendChild(el("h3", null, sv.name));
      if (sv.description) a.appendChild(el("p", null, sv.description));
      a.appendChild(el("p", "svc-price" + (sv.price == null ? " is-ask" : ""), sv.price == null ? "Consultar precio" : "Desde " + money(sv.price)));
      box.appendChild(a);
    });
    observeReveals(box);
  }

  /* ---------- Productos ---------- */
  function categories() {
    var seen = {}, out = [];
    state.products.forEach(function (p) { if (p.category && !seen[p.category]) { seen[p.category] = 1; out.push(p.category); } });
    return out;
  }
  function renderChips() {
    var box = $("[data-chips]");
    if (!box) return;
    box.textContent = "";
    var cats = categories();
    if (!cats.length) return;
    [""].concat(cats).forEach(function (c) {
      var b = el("button", "chip" + (state.cat === c ? " is-on" : ""), c || "Todos");
      b.type = "button";
      b.addEventListener("click", function () { state.cat = c; renderChips(); renderProducts(); });
      box.appendChild(b);
    });
  }
  function productCard(p) {
    var out = p.inStock === false;
    var card = el("article", "pcard" + (out ? " is-out" : ""));
    card.dataset.id = p.id;

    var media = el("div", "pmedia");
    media.appendChild(el("div", "pph"));
    if (p.image) {
      var img = document.createElement("img");
      img.src = p.image; img.alt = p.name; img.loading = "lazy"; img.decoding = "async";
      img.onerror = function () { img.remove(); };
      media.appendChild(img);
    }
    var ep = effPrice(p);
    if (p.offer && p.offerPrice != null && !out) {
      var pct = p.price != null && p.offerPrice < p.price ? Math.round((1 - p.offerPrice / p.price) * 100) : 0;
      media.appendChild(el("span", "badge", pct ? "Oferta −" + pct + "%" : "Oferta"));
    }
    if (out) media.appendChild(el("span", "out-tag", "Sin stock"));
    card.appendChild(media);

    var body = el("div", "pbody");
    body.appendChild(el("h3", null, p.name));
    if (p.size) body.appendChild(el("span", "psize", p.size));
    if (p.description) body.appendChild(el("p", "pdesc", p.description));

    var price = el("div", "pprice");
    if (ep == null) {
      price.appendChild(el("span", "ask", "Consultar precio"));
    } else {
      price.appendChild(el("strong", null, money(ep)));
      if (p.offer && p.price != null && p.offerPrice != null && p.offerPrice < p.price) price.appendChild(el("s", null, money(p.price)));
    }
    body.appendChild(price);

    var btn = el("button", "padd", out ? "Sin stock" : "Agregar");
    btn.type = "button"; btn.disabled = out;
    btn.setAttribute("aria-label", (out ? "Sin stock: " : "Agregar al carrito: ") + p.name);
    btn.addEventListener("click", function () { addToCart(p.id); });
    body.appendChild(btn);

    card.appendChild(body);
    return card;
  }
  function renderProducts() {
    var box = $("[data-products]"), empty = $("[data-empty]");
    if (!box) return;
    var q = norm(state.q);
    var list = state.products.filter(function (p) {
      if (state.cat && p.category !== state.cat) return false;
      return !q || norm(p.name + " " + p.size + " " + p.category).indexOf(q) !== -1;
    });
    box.textContent = "";
    list.forEach(function (p) { box.appendChild(productCard(p)); });
    if (empty) empty.hidden = list.length > 0;
  }
  function initSearch() {
    var input = $("[data-search]");
    if (!input) return;
    input.addEventListener("input", function () { state.q = input.value; renderProducts(); });
  }

  /* ---------- Carrito ---------- */
  function loadCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      var c = raw ? JSON.parse(raw) : {};
      state.cart = c && typeof c === "object" ? c : {};
    } catch (_) { state.cart = {}; }
  }
  function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch (_) {} }
  function findProduct(id) { for (var i = 0; i < state.products.length; i++) if (state.products[i].id === id) return state.products[i]; return null; }

  function cartItems() {
    var items = [];
    Object.keys(state.cart).forEach(function (id) {
      var p = findProduct(id), qty = parseInt(state.cart[id], 10) || 0;
      if (p && p.inStock !== false && qty > 0) items.push({ p: p, qty: Math.min(qty, 99) });
    });
    return items;
  }
  function cleanCart() {
    var ok = {}, removed = false;
    Object.keys(state.cart).forEach(function (id) {
      var p = findProduct(id);
      if (p && p.inStock !== false && state.cart[id] > 0) ok[id] = state.cart[id]; else removed = true;
    });
    state.cart = ok; saveCart();
    return removed;
  }
  function addToCart(id) {
    var p = findProduct(id);
    if (!p || p.inStock === false) return;
    state.cart[id] = Math.min((parseInt(state.cart[id], 10) || 0) + 1, 99);
    saveCart(); renderCart(true);
    toast(p.name + " agregado al carrito");
  }
  function setQty(id, qty) {
    if (qty <= 0) delete state.cart[id]; else state.cart[id] = Math.min(qty, 99);
    saveCart(); renderCart();
  }

  function totals(items) {
    var sum = 0, priced = 0, unpriced = 0;
    items.forEach(function (it) {
      var ep = effPrice(it.p);
      if (ep == null) unpriced += it.qty; else { sum += ep * it.qty; priced += it.qty; }
    });
    return { sum: sum, priced: priced, unpriced: unpriced };
  }

  function buildMessage(items) {
    var t = totals(items);
    var lines = ["Hola Punto Detail! Quiero hacer este pedido:", ""];
    items.forEach(function (it) {
      var ep = effPrice(it.p);
      lines.push("• " + it.qty + " x " + it.p.name + (it.p.size ? " (" + it.p.size + ")" : "") + " — " + (ep != null ? money(ep) + " c/u" : "precio a consultar"));
    });
    lines.push("");
    if (!t.priced) lines.push("Total: a confirmar");
    else if (t.unpriced) lines.push("Total (sin los productos a consultar): " + money(t.sum));
    else lines.push("Total: " + money(t.sum));
    var name = ($("[data-cart-name]") || {}).value, note = ($("[data-cart-note]") || {}).value;
    if (name && name.trim()) lines.push("Nombre: " + name.trim());
    if (note && note.trim()) lines.push("Aclaraciones: " + note.trim());
    return lines.join("\n");
  }

  function renderCart(bump) {
    var items = cartItems();
    var count = items.reduce(function (n, it) { return n + it.qty; }, 0);

    var badge = $("[data-cart-count]");
    if (badge) {
      badge.textContent = count; badge.hidden = !count;
      if (bump && count) { badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump"); }
    }

    var list = $("[data-cart-list]"), empty = $("[data-cart-empty]"), foot = $("[data-cart-foot]");
    if (!list) return;
    list.textContent = "";
    items.forEach(function (it) {
      var ep = effPrice(it.p);
      var li = el("li", "cart-item");
      var th = el("div", "cart-thumb" + (it.p.image ? "" : " ph"));
      if (it.p.image) th.style.backgroundImage = "url('" + it.p.image + "')";
      li.appendChild(th);

      var info = el("div", "cart-info");
      info.appendChild(el("h4", null, it.p.name));
      if (it.p.size) info.appendChild(el("small", null, it.p.size));
      info.appendChild(el("div", "cp" + (ep == null ? " ask" : ""), ep == null ? "Precio a consultar" : money(ep * it.qty)));
      li.appendChild(info);

      var q = el("div", "qty");
      var minus = el("button", null, "−"); minus.type = "button"; minus.setAttribute("aria-label", "Quitar uno");
      var plus = el("button", null, "+"); plus.type = "button"; plus.setAttribute("aria-label", "Agregar uno");
      minus.addEventListener("click", function () { setQty(it.p.id, it.qty - 1); });
      plus.addEventListener("click", function () { setQty(it.p.id, it.qty + 1); });
      q.appendChild(minus); q.appendChild(el("span", null, String(it.qty))); q.appendChild(plus);
      li.appendChild(q);
      list.appendChild(li);
    });

    if (empty) empty.hidden = items.length > 0;
    if (foot) foot.hidden = items.length === 0;

    var t = totals(items);
    var totalEl = $("[data-total]"), label = $("[data-total-label]"), hint = $("[data-total-hint]");
    if (totalEl) totalEl.textContent = t.priced ? money(t.sum) : "A consultar";
    if (label) label.textContent = t.unpriced && t.priced ? "Total parcial" : "Total";
    if (hint) hint.textContent = t.unpriced ? t.unpriced + (t.unpriced === 1 ? " producto con precio a consultar." : " productos con precio a consultar.") + " Los precios y el stock se confirman por WhatsApp." : "Los precios y el stock se confirman por WhatsApp.";

    var go = $("[data-checkout]");
    if (go) {
      if (items.length) { go.href = waLink(buildMessage(items)); go.removeAttribute("aria-disabled"); }
      else { go.href = "#"; go.setAttribute("aria-disabled", "true"); }
    }
  }

  function initCartUI() {
    var cart = $("[data-cart]"), overlay = $("[data-overlay]");
    if (!cart || !overlay) return;
    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      overlay.hidden = false;
      requestAnimationFrame(function () { overlay.classList.add("is-open"); cart.classList.add("is-open"); });
      cart.setAttribute("aria-hidden", "false");
      document.documentElement.style.overflow = "hidden";
      var c = $("[data-cart-close]", cart); if (c) c.focus();
    }
    function close() {
      overlay.classList.remove("is-open"); cart.classList.remove("is-open");
      cart.setAttribute("aria-hidden", "true");
      document.documentElement.style.overflow = "";
      setTimeout(function () { overlay.hidden = true; }, 300);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    $$("[data-cart-open]").forEach(function (b) { b.addEventListener("click", open); });
    $$("[data-cart-close]").forEach(function (b) { b.addEventListener("click", close); });
    overlay.addEventListener("click", close);
    window.addEventListener("keydown", function (e) { if (e.key === "Escape" && cart.classList.contains("is-open")) close(); });

    var clear = $("[data-cart-clear]");
    if (clear) clear.addEventListener("click", function () { state.cart = {}; saveCart(); renderCart(); });
    ["[data-cart-name]", "[data-cart-note]"].forEach(function (s) {
      var f = $(s); if (f) f.addEventListener("input", function () { renderCart(); });
    });
    var go = $("[data-checkout]");
    if (go) go.addEventListener("click", function (e) {
      if (go.getAttribute("aria-disabled") === "true") { e.preventDefault(); return; }
      if (!waNumber()) { e.preventDefault(); toast("Falta cargar el WhatsApp del negocio."); return; }
      toast("Abriendo WhatsApp…");
    });
  }

  /* ---------- Nav, reveals, brillo del hero ---------- */
  function initNav() {
    var nav = $("[data-nav]");
    if (!nav) return;
    var toggle = $(".nav-toggle", nav);
    var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 40); };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    function setOpen(o) {
      nav.classList.toggle("is-open", o);
      if (toggle) { toggle.setAttribute("aria-expanded", o ? "true" : "false"); toggle.setAttribute("aria-label", o ? "Cerrar menú" : "Abrir menú"); }
      document.documentElement.style.overflow = o ? "hidden" : "";
    }
    if (toggle) toggle.addEventListener("click", function () { setOpen(!nav.classList.contains("is-open")); });
    $$(".nav-links a", nav).forEach(function (a) { a.addEventListener("click", function () { setOpen(false); }); });
    window.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
  }

  var io = null;
  function observeReveals(scope) {
    var els = $$(".reveal:not(.is-visible)", scope || document);
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("is-visible"); }); return; }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } });
      }, { threshold: 0.01, rootMargin: "0px 0px -2% 0px" });
    }
    els.forEach(function (e) { io.observe(e); });
    setTimeout(function () {
      els.forEach(function (e) { if (!e.classList.contains("is-visible") && e.getBoundingClientRect().top < window.innerHeight) e.classList.add("is-visible"); });
    }, 6000);
  }

  function initHeroGlow() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    var hero = $("[data-hero]");
    if (!hero) return;
    hero.addEventListener("mousemove", function (e) {
      var r = hero.getBoundingClientRect();
      hero.style.setProperty("--mx", (e.clientX - r.left) + "px");
      hero.style.setProperty("--my", (e.clientY - r.top) + "px");
    }, { passive: true });
  }

  /* ---------- Arranque: cada init aislado ---------- */
  function safe(fn, name) { try { fn(); } catch (err) { if (window.console) console.warn("[" + name + "] falló:", err); } }

  function boot() {
    safe(initNav, "initNav");
    safe(initHeroGlow, "initHeroGlow");
    safe(initSearch, "initSearch");
    safe(initCartUI, "initCartUI");
    safe(loadCart, "loadCart");
    safe(function () { observeReveals(document); }, "reveals");

    var grid = $("[data-products]");
    if (grid && !grid.children.length) grid.appendChild(el("p", "empty", "Cargando productos…"));

    fetchCatalog().then(function (d) {
      safe(function () { applyCatalog(d); }, "applyCatalog");
      safe(mountContact, "mountContact");
      safe(renderServices, "renderServices");
      safe(renderChips, "renderChips");
      safe(renderProducts, "renderProducts");
      safe(function () { if (cleanCart()) toast("Sacamos del carrito productos que ya no están disponibles."); }, "cleanCart");
      safe(renderCart, "renderCart");
      document.documentElement.classList.add("is-ready");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
