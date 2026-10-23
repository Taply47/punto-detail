(function () {
  "use strict";
  /* ------------------------------------------------------------------
     DATOS INICIALES de Punto Detail.
     - Mientras el panel /admin no guardó nada, la página usa estos datos.
     - Cuando se guarda por primera vez desde el panel, pasan a mandar los
       del panel (se guardan en Cloudflare KV) y esto queda de respaldo.
     - Precios vacíos (null) = "Consultar".
     ------------------------------------------------------------------ */
  var P = function (id, name, size) {
    return { id: id, name: name, size: size, category: "", description: "", price: null, offer: false, offerPrice: null, inStock: true, visible: true, image: "" };
  };
  var S = function (id, name, description) {
    return { id: id, name: name, description: description, price: null, visible: true };
  };

  window.__BRAND__ = {
    name: "Punto Detail",
    settings: {
      whatsapp: "5492920218871",
      instagram: "punt0.detail",
      city: "Carmen de Patagones",
      address: "",   // la carga el cliente desde /admin → Ajustes
      hours: ""
    },
    seed: {
      services: [
        S("s-completo", "Lavado completo", "Todo lo que necesite tu vehículo, por dentro y por fuera."),
        S("s-exterior", "Lavado exterior", "Carrocería, vidrios, llantas y neumáticos."),
        S("s-interior", "Lavado interior", "Aspirado, tablero, puertas, plásticos y vidrios."),
        S("s-tapizados", "Tapizados y cuero", "Limpieza profunda de asientos, alfombras y cuero."),
        S("s-motor", "Motor", "Lavado y acondicionado del motor."),
        S("s-motos", "Motos", "Lavado y limpieza detallada para tu moto.")
      ],
      products: [
        P("p-alumax", "Alumax", "5 L"),
        P("p-blend-spray", "Blend spray", "500 ml"),
        P("p-blend-metal", "Blend metal polish", "150 g"),
        P("p-focus", "Focus", "240 ml"),
        P("p-glazy", "Glazy anti fog", "500 ml"),
        P("p-hydrox", "Hydrox fast", "500 ml"),
        P("p-hidracouro", "Hidracouro", "500 ml"),
        P("p-higicouro", "Higicouro", "500 ml"),
        P("p-izer", "Izer", "500 ml"),
        P("p-impact", "Impact", "1,5 L"),
        P("p-removex", "Removex", "1,5 L"),
        P("p-restaurax", "Restaurax", "240 ml"),
        P("p-revox", "Revox", "500 ml"),
        P("p-shiny", "Shiny", "240 ml"),
        P("p-strike", "Strike", "500 ml"),
        P("p-sintra", "Sintra", "500 ml"),
        P("p-tok-final", "Tok final", "500 ml"),
        P("p-2v-floc", "2V-floc", "500 ml"),
        P("p-v-mol", "V-mol", "500 ml"),
        P("p-moto-v", "Moto-v", "500 ml")
      ]
    }
  };
})();
