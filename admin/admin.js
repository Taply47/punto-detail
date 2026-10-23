(function () {
  "use strict";

  var TOKEN_KEY = "pd_admin_token";
  var B = window.__BRAND__ || { settings: {}, seed: { services: [], products: [] } };

  var $ = function (s, scope) { return (scope || document).querySelector(s); };
  var $$ = function (s, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var token = null;
  try { token = sessionStorage.getItem(TOKEN_KEY); } catch (_) {}

  var data = null;          // { settings, services, products }
  var dirty = false;
  var toDelete = [];        // ids de imágenes reemplazadas/borradas (se eliminan al guardar)
  var busyUploads = 0;

  /* ---------- API ---------- */
  function api(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    if (token) headers.Authorization = "Bearer " + token;
    return fetch(path, { method: opts.method || "GET", headers: headers, body: opts.body, cache: "no-store" }).then(function (r) {
      return r.text().then(function (t) {
        var d = null; try { d = t ? JSON.parse(t) : null; } catch (_) {}
        if (r.status === 401 && path !== "/api/login") { logout("Tu sesión venció. Volvé a ingresar."); throw new Error("Sesión vencida"); }
        if (!r.ok) throw new Error((d && d.error) || "Error " + r.status);
        return d;
      });
    });
  }

  /* ---------- Login / sesión ---------- */
  function showLogin(msg) {
    $("[data-app]").hidden = true;
    $("[data-login]").hidden = false;
    $("[data-login-msg]").textContent = msg || "";
    var pw = $("[data-password]"); if (pw) { pw.value = ""; pw.focus(); }
  }
  function logout(msg) {
    token = null;
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (_) {}
    dirty = false;
    showLogin(msg);
  }
  function initLogin() {
    $("[data-login-form]").addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = $("[data-login-msg]"); msg.textContent = "";
      var btn = $("button[type=submit]", e.target); btn.disabled = true;
      fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: $("[data-password]").value }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          btn.disabled = false;
          if (!res.ok) { msg.textContent = res.d.error || "No se pudo ingresar."; return; }
          token = res.d.token;
          try { sessionStorage.setItem(TOKEN_KEY, token); } catch (_) {}
          start();
        })
        .catch(function () {
          btn.disabled = false;
          msg.textContent = "No se pudo conectar. Este panel funciona cuando la página está publicada en Cloudflare.";
        });
    });
    $("[data-logout]").addEventListener("click", function () {
      if (dirty && !confirm("Tenés cambios sin guardar. ¿Salir igual?")) return;
      logout("");
    });
  }

  /* ---------- Carga ---------- */
  function start() {
    api("/api/catalog?all=1").then(function (d) {
      var banner = $("[data-banner]");
      if (d && d.seeded) {
        data = { settings: d.settings || {}, services: d.services || [], products: d.products || [] };
        banner.hidden = true;
      } else {
        data = { settings: clone(B.settings || {}), services: clone(B.seed.services), products: clone(B.seed.products) };
        banner.hidden = false;
        banner.textContent = d && d.reason === "kv-no-conectado"
          ? "Falta conectar el KV al proyecto en Cloudflare (variable CATALOG). Podés mirar el panel, pero todavía no se puede guardar. Mirá el archivo LEEME.md."
          : "Todavía no guardaste nada: estás viendo los datos iniciales. Hacé los cambios que quieras y tocá “Guardar cambios” para publicarlos.";
        setDirty(true);
      }
      $("[data-login]").hidden = true;
      $("[data-app]").hidden = false;
      renderAll();
      if (!(d && d.seeded)) setDirty(true); else setDirty(false);
    }).catch(function (err) {
      if (!token) return;
      showLogin("No se pudo cargar: " + err.message);
    });
  }

  /* ---------- Estado de guardado ---------- */
  function setStatus(text, cls) {
    var s = $("[data-status]");
    s.textContent = text; s.className = "status" + (cls ? " " + cls : "");
  }
  function setDirty(v) {
    dirty = v;
    $("[data-save]").disabled = !v || busyUploads > 0;
    if (v) setStatus("Cambios sin guardar", "is-dirty");
  }
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Precios ---------- */
  function parsePrice(raw) {
    var s = String(raw == null ? "" : raw).replace(/[\s$]/g, "");
    if (!s) return null;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");   // 12.500,50
    else if (/^\d+,\d+$/.test(s)) s = s.replace(",", ".");                                   // 12500,50
    var n = parseFloat(s);
    return isFinite(n) && n >= 0 ? n : null;
  }
  function priceText(n) { return n == null ? "" : String(n); }

  /* ---------- Render ---------- */
  function productHTML(p) {
    var img = p.image ? ' style="background-image:url(\'' + esc(p.image) + '\')"' : "";
    return '' +
      '<article class="item' + (p.offer ? " has-offer is-offer-item" : "") + (p.inStock === false ? " is-out-item" : "") + (p.visible === false ? " is-hidden-item" : "") + '" data-id="' + esc(p.id) + '" data-kind="products">' +
        '<div class="item-media"><button type="button" class="thumb' + (p.image ? "" : " ph") + '" data-act="img" aria-label="Cambiar foto de ' + esc(p.name) + '"' + img + '><span>' + (p.image ? "Cambiar" : "+ Foto") + '</span></button>' +
        '<input type="file" accept="image/*" hidden data-file></div>' +
        '<div class="item-main">' +
          '<div class="row2">' +
            '<label class="field"><span>Nombre</span><input data-f="name" value="' + esc(p.name) + '" maxlength="80"></label>' +
            '<label class="field"><span>Tamaño</span><input data-f="size" value="' + esc(p.size) + '" maxlength="30"></label>' +
          '</div>' +
          '<div class="row2">' +
            '<label class="field"><span>Categoría (opcional)</span><input data-f="category" list="cats" value="' + esc(p.category) + '" maxlength="40"></label>' +
            '<label class="field"><span>Precio ($)</span><input data-f="price" inputmode="decimal" placeholder="Consultar" value="' + esc(priceText(p.price)) + '"></label>' +
          '</div>' +
          '<div class="row-switch">' +
            '<label class="sw"><input type="checkbox" data-f="inStock"' + (p.inStock !== false ? " checked" : "") + '><i></i><span>Hay stock</span></label>' +
            '<label class="sw"><input type="checkbox" data-f="offer"' + (p.offer ? " checked" : "") + '><i></i><span>En oferta</span></label>' +
            '<label class="field offer-wrap"><span>Precio oferta ($)</span><input data-f="offerPrice" inputmode="decimal" value="' + esc(priceText(p.offerPrice)) + '"></label>' +
            '<label class="sw"><input type="checkbox" data-f="visible"' + (p.visible !== false ? " checked" : "") + '><i></i><span>Visible</span></label>' +
          '</div>' +
          '<details class="more"' + (p.description ? " open" : "") + '><summary>Descripción (opcional)</summary><textarea data-f="description" rows="2" maxlength="400">' + esc(p.description) + '</textarea></details>' +
        '</div>' +
        actionsHTML() +
      '</article>';
  }
  function serviceHTML(s) {
    return '' +
      '<article class="item' + (s.visible === false ? " is-hidden-item" : "") + '" data-id="' + esc(s.id) + '" data-kind="services" style="grid-template-columns:1fr auto">' +
        '<div class="item-main">' +
          '<div class="row2">' +
            '<label class="field"><span>Nombre</span><input data-f="name" value="' + esc(s.name) + '" maxlength="80"></label>' +
            '<label class="field"><span>Precio ($)</span><input data-f="price" inputmode="decimal" placeholder="Consultar" value="' + esc(priceText(s.price)) + '"></label>' +
          '</div>' +
          '<label class="field"><span>Descripción</span><input data-f="description" value="' + esc(s.description) + '" maxlength="300"></label>' +
          '<div class="row-switch"><label class="sw"><input type="checkbox" data-f="visible"' + (s.visible !== false ? " checked" : "") + '><i></i><span>Visible</span></label></div>' +
        '</div>' +
        actionsHTML() +
      '</article>';
  }
  function actionsHTML() {
    return '<div class="item-actions"><button type="button" data-act="up" aria-label="Subir">↑</button><button type="button" data-act="down" aria-label="Bajar">↓</button><button type="button" class="danger" data-act="del">Borrar</button></div>';
  }

  function renderList(kind) {
    var box = $('[data-list="' + kind + '"]');
    var items = data[kind];
    box.innerHTML = items.map(kind === "products" ? productHTML : serviceHTML).join("");
    $('[data-empty="' + kind + '"]').hidden = items.length > 0;
    var c = $("[data-count-" + kind + "]"); if (c) c.textContent = items.length ? "(" + items.length + ")" : "";
    applyFilter(kind);
  }
  function renderSettings() {
    $$("[data-s]").forEach(function (i) { i.value = data.settings[i.getAttribute("data-s")] || ""; });
  }
  function renderCats() {
    var seen = {}, html = "";
    data.products.forEach(function (p) { if (p.category && !seen[p.category]) { seen[p.category] = 1; html += '<option value="' + esc(p.category) + '">'; } });
    $("#cats").innerHTML = html;
  }
  function renderAll() { renderList("products"); renderList("services"); renderSettings(); renderCats(); }

  function applyFilter(kind) {
    var input = $('[data-filter="' + kind + '"]');
    var q = (input ? input.value : "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    $$('[data-list="' + kind + '"] .item').forEach(function (it) {
      var obj = find(kind, it.getAttribute("data-id"));
      var hay = obj ? (obj.name + " " + (obj.category || "")).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") : "";
      it.hidden = !!q && hay.indexOf(q) === -1;
    });
  }
  function find(kind, id) {
    for (var i = 0; i < data[kind].length; i++) if (data[kind][i].id === id) return data[kind][i];
    return null;
  }
  function imgId(url) { var m = /[?&]id=([A-Za-z0-9-]+)/.exec(url || ""); return m ? m[1] : null; }

  /* ---------- Edición ---------- */
  function onField(e) {
    var f = e.target.getAttribute && e.target.getAttribute("data-f");
    if (!f) return;
    var item = e.target.closest(".item"); if (!item) return;
    var kind = item.getAttribute("data-kind");
    var obj = find(kind, item.getAttribute("data-id")); if (!obj) return;

    if (e.target.type === "checkbox") obj[f] = e.target.checked;
    else if (f === "price" || f === "offerPrice") obj[f] = parsePrice(e.target.value);
    else obj[f] = e.target.value;

    if (f === "offer") item.classList.toggle("has-offer", obj.offer), item.classList.toggle("is-offer-item", obj.offer);
    if (f === "inStock") item.classList.toggle("is-out-item", obj.inStock === false);
    if (f === "visible") item.classList.toggle("is-hidden-item", obj.visible === false);
    if (f === "category") renderCats();
    setDirty(true);
  }

  function move(kind, id, dir) {
    var arr = data[kind], i = arr.findIndex(function (x) { return x.id === id; }), j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    renderList(kind); setDirty(true);
    var el = $('[data-list="' + kind + '"] .item[data-id="' + id + '"]'); if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function remove(kind, id) {
    var obj = find(kind, id); if (!obj) return;
    if (!confirm("¿Borrar “" + (obj.name || "sin nombre") + "”?")) return;
    if (kind === "products" && imgId(obj.image)) toDelete.push(imgId(obj.image));
    data[kind] = data[kind].filter(function (x) { return x.id !== id; });
    renderList(kind); renderCats(); setDirty(true);
  }
  function add(kind) {
    var obj = kind === "products"
      ? { id: uid("p-"), name: "", size: "", category: "", description: "", price: null, offer: false, offerPrice: null, inStock: true, visible: true, image: "" }
      : { id: uid("s-"), name: "", description: "", price: null, visible: true };
    data[kind].unshift(obj);
    var f = $('[data-filter="' + kind + '"]'); if (f) f.value = "";
    renderList(kind); setDirty(true);
    var input = $('[data-list="' + kind + '"] .item[data-id="' + obj.id + '"] [data-f="name"]');
    if (input) { input.focus(); input.scrollIntoView({ block: "center", behavior: "smooth" }); }
  }

  function onClick(e) {
    var btn = e.target.closest("[data-act]"); if (!btn) return;
    var item = btn.closest(".item"); if (!item) return;
    var kind = item.getAttribute("data-kind"), id = item.getAttribute("data-id");
    var act = btn.getAttribute("data-act");
    if (act === "up") move(kind, id, -1);
    else if (act === "down") move(kind, id, 1);
    else if (act === "del") remove(kind, id);
    else if (act === "img") { var fi = $("[data-file]", item); if (fi) fi.click(); }
  }

  /* ---------- Fotos: se achican en el navegador antes de subir ---------- */
  function loadBitmap(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () { return createImageBitmap(file); });
    }
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject; img.src = url;
    });
  }
  function toBlob(canvas, type, q) { return new Promise(function (r) { canvas.toBlob(r, type, q); }); }
  function resizeImage(file) {
    return loadBitmap(file).then(function (bmp) {
      var w = bmp.width, h = bmp.height, max = 900, k = Math.min(1, max / Math.max(w, h));
      var c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return toBlob(c, "image/webp", 0.82).then(function (b) {
        return b && b.type === "image/webp" ? b : toBlob(c, "image/jpeg", 0.85);
      });
    });
  }
  function onFile(e) {
    if (!e.target.matches || !e.target.matches("[data-file]")) return;
    var file = e.target.files && e.target.files[0]; if (!file) return;
    var item = e.target.closest(".item"), obj = find("products", item.getAttribute("data-id")), thumb = $(".thumb", item);
    if (!obj) return;
    thumb.classList.add("busy"); busyUploads++; setDirty(dirty);
    resizeImage(file).then(function (blob) {
      if (!blob) throw new Error("No se pudo procesar la imagen.");
      return api("/api/image", { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
    }).then(function (res) {
      var old = imgId(obj.image); if (old) toDelete.push(old);
      obj.image = res.url;
      thumb.style.backgroundImage = "url('" + res.url + "')";
      thumb.classList.remove("ph"); $("span", thumb).textContent = "Cambiar";
      setDirty(true);
    }).catch(function (err) { toast(err.message || "No se pudo subir la foto."); })
      .then(function () { busyUploads--; thumb.classList.remove("busy"); e.target.value = ""; setDirty(dirty); });
  }

  /* ---------- Importar lista ---------- */
  function initImport() {
    var dlg = $("[data-import]"), ta = $("[data-import-text]");
    $("[data-open-import]").addEventListener("click", function () { ta.value = ""; dlg.showModal(); ta.focus(); });
    $("[data-import-cancel]").addEventListener("click", function () { dlg.close(); });
    $("[data-import-ok]").addEventListener("click", function () {
      var n = 0;
      ta.value.split(/\r?\n/).forEach(function (line) {
        line = line.trim(); if (!line) return;
        var parts = line.split("|").map(function (s) { return s.trim(); });
        if (!parts[0]) return;
        data.products.push({ id: uid("p-"), name: parts[0].slice(0, 80), size: (parts[1] || "").slice(0, 30), category: "", description: "", price: parsePrice(parts[2]), offer: false, offerPrice: null, inStock: true, visible: true, image: "" });
        n++;
      });
      dlg.close();
      if (n) { renderList("products"); renderCats(); setDirty(true); toast(n + (n === 1 ? " producto agregado" : " productos agregados") + " (abajo de todo)"); }
    });
  }

  /* ---------- Guardar ---------- */
  function validate() {
    for (var i = 0; i < data.products.length; i++) {
      var p = data.products[i];
      if (!p.name.trim()) return { msg: "Hay un producto sin nombre.", id: p.id, kind: "products" };
      if (p.offer && p.offerPrice == null) return { msg: "“" + p.name + "”: poné el precio de oferta o apagá la oferta.", id: p.id, kind: "products" };
    }
    for (var j = 0; j < data.services.length; j++) {
      if (!data.services[j].name.trim()) return { msg: "Hay un servicio sin nombre.", id: data.services[j].id, kind: "services" };
    }
    return null;
  }
  function save() {
    if (busyUploads) return;
    var bad = validate();
    if (bad) {
      setStatus(bad.msg, "is-error");
      switchTab(bad.kind);
      var el = $('[data-list="' + bad.kind + '"] .item[data-id="' + bad.id + '"]');
      if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); var i = $("[data-f=name]", el); if (i) i.focus(); }
      return;
    }
    var btn = $("[data-save]"); btn.disabled = true; setStatus("Guardando…");
    api("/api/catalog", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: data.settings, services: data.services, products: data.products }) })
      .then(function (res) {
        data = { settings: res.settings || {}, services: res.services || [], products: res.products || [] };
        var used = {};
        data.products.forEach(function (p) { var id = imgId(p.image); if (id) used[id] = 1; });
        toDelete.filter(function (id) { return !used[id]; }).forEach(function (id) { api("/api/img?id=" + encodeURIComponent(id), { method: "DELETE" }).catch(function () {}); });
        toDelete = [];
        $("[data-banner]").hidden = true;
        renderAll(); setDirty(false);
        var d = new Date();
        setStatus("Guardado ✓ " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"));
        toast("Cambios guardados. Pueden tardar hasta un minuto en verse en la página.");
      })
      .catch(function (err) { setStatus("No se pudo guardar: " + err.message, "is-error"); btn.disabled = false; });
  }

  /* ---------- Copia de seguridad ---------- */
  function exportBackup() {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "punto-detail-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---------- UI ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $("[data-toast]"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3400);
  }
  function switchTab(name) {
    $$("[data-tab]").forEach(function (s) { s.hidden = s.getAttribute("data-tab") !== name; });
    $$("[data-tab-btn]").forEach(function (b) {
      var on = b.getAttribute("data-tab-btn") === name;
      b.classList.toggle("is-on", on); b.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function init() {
    initLogin(); initImport();
    $$("[data-tab-btn]").forEach(function (b) { b.addEventListener("click", function () { switchTab(b.getAttribute("data-tab-btn")); }); });
    $$("[data-add]").forEach(function (b) { b.addEventListener("click", function () { add(b.getAttribute("data-add")); }); });
    $$("[data-filter]").forEach(function (i) { i.addEventListener("input", function () { applyFilter(i.getAttribute("data-filter")); }); });
    $$("[data-list]").forEach(function (l) {
      l.addEventListener("input", onField); l.addEventListener("change", onField);
      l.addEventListener("click", onClick); l.addEventListener("change", onFile);
    });
    $$("[data-s]").forEach(function (i) {
      i.addEventListener("input", function () { data.settings[i.getAttribute("data-s")] = i.value; setDirty(true); });
    });
    $("[data-save]").addEventListener("click", save);
    $$("[data-export]").forEach(function (b) { b.addEventListener("click", exportBackup); });
    window.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && data) { e.preventDefault(); if (dirty) save(); }
    });

    if (token) start(); else showLogin("");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
