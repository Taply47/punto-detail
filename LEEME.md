# Punto Detail – cómo ponerlo online

La página es estática (HTML/CSS/JS) + unas funciones de Cloudflare para el panel de administración.
Sin Node, sin build. Subís la carpeta a GitHub y Cloudflare Pages la publica.

## 1. Subir a GitHub
1. Creá un repo nuevo (ej. `punto-detail`).
2. Descomprimí el zip y arrastrá **el contenido** de la carpeta (no la carpeta en sí) a GitHub:
   en la raíz del repo tienen que quedar `index.html`, `functions/`, `admin/`, `assets/`, `lib/`, `_headers`, etc.
3. `functions/` tiene que estar en la raíz, si no el panel no funciona.

## 2. Crear el proyecto en Cloudflare Pages
1. Cloudflare → Workers & Pages → Create → Pages → Connect to Git → elegí el repo.
2. Framework preset: **None**. Build command: vacío. Output directory: `/` (o vacío).
3. Deploy.

(Los nombres de los menús de Cloudflare cambian seguido; si algo no coincide, buscá algo equivalente.)

## 3. Conectar el panel (necesario para poder guardar cambios)
1. Cloudflare → Storage & Databases → KV → Create namespace. Nombre: `punto-detail-catalog`.
2. Proyecto de Pages → Settings → Bindings → Add → KV namespace.
   Variable name: **`CATALOG`** (exacto, en mayúsculas) → elegí el namespace.
3. Settings → Variables and Secrets → Add → **`ADMIN_PASSWORD`** (tipo Secret) con la contraseña que quieras.
4. **Redeploy**: los bindings y variables recién se aplican en un deploy nuevo (Deployments → ⋯ → Retry deployment, o un commit cualquiera).

Hasta que hagas esto, la página pública se ve igual (con los productos de ejemplo del archivo `lib/manifest.js`), pero el panel avisa que no puede guardar.

## 4. Usar el panel
- Entrá a `tu-dominio/admin` (no hay ningún link en la página; es oculto, no secreto: lo que protege es la contraseña).
- Productos y servicios: agregar, quitar, cambiar precio y foto, "En oferta", "Hay stock", "Visible".
- Precio vacío = en la página dice "Consultar precio".
- "Importar lista": pegás un producto por línea (`Nombre | Tamaño | Precio`).
- Ajustes: WhatsApp, Instagram, ciudad, **dirección y horarios** (hasta que los cargues no se muestran).
- Tocá **Guardar cambios** (o Ctrl+S). Las fotos se achican solas antes de subirse.
- Descargá una copia de seguridad de vez en cuando (Ajustes).

## 5. Después de publicar
- En `index.html`, el `og:image` (la vista previa al compartir por WhatsApp) conviene cambiarlo a una URL absoluta: `https://tu-dominio/assets/img/logo-og.jpg`.
- Los textos de Preguntas frecuentes en `index.html` son ejemplos: revisalos con el cliente.
- Los servicios iniciales (en `lib/manifest.js` y editables desde el panel) son ejemplos.
- Para cambiar el WhatsApp por defecto también podés editar `lib/manifest.js`, pero desde el panel es más fácil.
