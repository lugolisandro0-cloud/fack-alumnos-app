/**
 * ALUMNOS Y CUOTAS (FACK Music) — cargador del servidor
 *
 * Este archivo se pega UNA sola vez. El código real del servidor se descarga
 * solo del repositorio de la app y se actualiza sin tocar nada acá.
 * Si una versión nueva falla, se sigue usando la última que funcionó.
 */

// ===== Ajustes =====
const AJUSTES = {
  COMPARTIR_CON: "" // mail del administrador para compartirle el calendario (opcional), ej: "licha@gmail.com"
};
const FUENTE = "https://raw.githubusercontent.com/lugolisandro0-cloud/fack-alumnos-app/main/servidor/";

// ===== Entrada (no hace falta tocar nada de acá para abajo) =====
function doGet(e) { return correr_("doGet", [e]); }
function doPost(e) { return correr_("doPost", [e]); }
// Si el dueño se olvida la contraseña: elegí esta función arriba y tocá "Ejecutar".
function reiniciarDueno() { return correr_("reiniciarDueno", []); }
// Ejecutar UNA vez después de pegar este archivo, para dar los permisos.
function autorizar() {
  permisos_();
  const v = buscarVersion_(true);
  Logger.log("Servidor en uso: " + (v || "(sin descargar)"));
}

// ----- carga -----
var SRV_ = null, SRV_VER_ = "";
function correr_(fn, args) {
  const usar = function (cual) { cargar_(cual); return SRV_[fn].apply(null, args); };
  try {
    const r = usar("nueva");
    marcarOk_();
    return r;
  } catch (err) {
    // La versión nueva falló: se vuelve a la última que anduvo.
    const p = PropertiesService.getScriptProperties();
    if (p.getProperty("srv_nueva") && p.getProperty("srv_nueva") !== p.getProperty("srv_ok")) {
      p.setProperty("srv_mala", p.getProperty("srv_nueva"));
      p.deleteProperty("srv_nueva");
      SRV_ = null;
      return usar("ok");
    }
    throw err;
  }
}
function cargar_(cual) {
  if (SRV_) return;
  if (cual === "nueva") { try { buscarVersion_(false); } catch (e) { } }
  const p = PropertiesService.getScriptProperties();
  const ver = (cual === "nueva" && p.getProperty("srv_nueva")) || p.getProperty("srv_ok") || p.getProperty("srv_nueva");
  if (!ver) throw new Error("El servidor todavía no se descargó. Ejecutá la función autorizar.");
  const c = CacheService.getScriptCache();
  let code = c.get("srv_code_" + ver);
  if (!code) { code = leerTrozos_("srv_c_" + ver); if (code.length < 90000) c.put("srv_code_" + ver, code, 21600); }
  SRV_ = new Function("AJUSTES", code + "\n;return {doGet: doGet, doPost: doPost, reiniciarDueno: reiniciarDueno};")(AJUSTES);
  SRV_VER_ = ver;
}
function marcarOk_() {
  const p = PropertiesService.getScriptProperties();
  if (SRV_VER_ && p.getProperty("srv_ok") !== SRV_VER_) {
    const viejo = p.getProperty("srv_ok");
    p.setProperty("srv_ok", SRV_VER_);
    if (viejo && viejo !== SRV_VER_) borrarTrozos_("srv_c_" + viejo);
  }
}
// Mira cada 10 minutos si hay una versión nueva y la guarda.
function buscarVersion_(forzar) {
  const c = CacheService.getScriptCache(), p = PropertiesService.getScriptProperties();
  if (!forzar && c.get("srv_chk")) return p.getProperty("srv_nueva") || p.getProperty("srv_ok");
  c.put("srv_chk", "1", 600);
  const r = UrlFetchApp.fetch(FUENTE + "version.json?t=" + Date.now(), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return p.getProperty("srv_ok");
  const v = JSON.parse(r.getContentText());
  if (!v.version || v.version === p.getProperty("srv_ok") || v.version === p.getProperty("srv_nueva") || v.version === p.getProperty("srv_mala")) return p.getProperty("srv_nueva") || p.getProperty("srv_ok");
  const t = UrlFetchApp.fetch(FUENTE + "Codigo.gs?t=" + Date.now(), { muteHttpExceptions: true });
  if (t.getResponseCode() !== 200) return p.getProperty("srv_ok");
  const code = t.getContentText();
  const sha = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, code, Utilities.Charset.UTF_8).map(function (b) { return ("0" + (b & 255).toString(16)).slice(-2); }).join("");
  if (v.sha256 && sha !== v.sha256) return p.getProperty("srv_ok");
  new Function("AJUSTES", code); // si no compila, no se usa
  guardarTrozos_("srv_c_" + v.version, code);
  const ant = p.getProperty("srv_nueva");
  if (ant && ant !== p.getProperty("srv_ok")) borrarTrozos_("srv_c_" + ant);
  p.setProperty("srv_nueva", v.version);
  return v.version;
}
function guardarTrozos_(k, s) {
  const p = PropertiesService.getScriptProperties(), n = Math.ceil(s.length / 8000), o = {};
  for (let i = 0; i < n; i++) o[k + "_" + i] = s.slice(i * 8000, (i + 1) * 8000);
  o[k + "_n"] = String(n);
  p.setProperties(o);
}
function leerTrozos_(k) {
  const p = PropertiesService.getScriptProperties(), n = Number(p.getProperty(k + "_n")) || 0;
  let s = ""; for (let i = 0; i < n; i++) s += p.getProperty(k + "_" + i) || "";
  return s;
}
function borrarTrozos_(k) {
  const p = PropertiesService.getScriptProperties(), n = Number(p.getProperty(k + "_n")) || 0;
  for (let i = 0; i < n; i++) p.deleteProperty(k + "_" + i);
  p.deleteProperty(k + "_n");
}
// Solo para que Google pida todos los permisos que usa el servidor. No se ejecuta.
function permisos_() {
  if (Date.now() > 0) return;
  SpreadsheetApp.getActiveSpreadsheet(); LockService.getScriptLock(); ContentService.createTextOutput("");
  UrlFetchApp.fetch("https://example.com"); CalendarApp.getDefaultCalendar();
  Calendar.Calendars.insert({}); Calendar.Calendars.get("x"); Calendar.Events.insert({}, "x"); Calendar.Events.list("x"); Calendar.Events.patch({}, "x", "y"); Calendar.Events.remove("x", "y"); Calendar.Acl.insert({}, "x");
}
