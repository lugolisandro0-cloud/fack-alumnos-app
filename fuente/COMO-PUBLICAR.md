# Cómo publicar una versión nueva

1. Editar `caja.html` (app base) y/o `tools/*` (partes nativas: sincronización, acceso, actualizaciones).
2. Copiar esta carpeta a `/home/claude/alumnos-app` (con `caja.html` en `/home/claude/caja.html`), instalar dependencias del proyecto Capacitor si hace falta (`npm i qrcode-generator jsqr`).
3. `tools/publicar.sh 1.6.1 "Qué cambió"` → arma `index.html`, calcula el `sha256`, actualiza `version.json` y hace push a `main`.
4. Las apps instaladas (1.6.0 o más) lo descargan solas al abrirse.

- Si el cambio necesita reinstalar la app (permisos o plugins nativos nuevos), subir `base` al número nuevo y compilar APK/escritorio de nuevo.
- Si el cambio toca el servidor (`google/Codigo.gs`), Felipe tiene que pegarlo en su Apps Script (Implementar › Administrar implementaciones › Editar › Nueva versión).
- Pruebas: `google/prueba.js`, `google/prueba-vincular.js` (servidor simulado).

## Servidor
- El dueño tiene pegado `google/cargador.gs` en Apps Script; baja `servidor/Codigo.gs` de este repo.
- Para publicar un cambio del servidor: `tools/publicar-servidor.sh 1.6.4` (reemplaza `__VERSION_SERVIDOR__`, calcula el sha256, actualiza `servidor/version.json` y hace push). El cargador lo toma en ≤10 min; si falla, vuelve a la última versión que anduvo.
- Probar antes: `node google/prueba.js`, `node google/prueba-cargador.js`.
