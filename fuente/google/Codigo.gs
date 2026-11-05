/**
 * ALUMNOS Y CUOTAS (FACK Music) — servidor en Google
 *
 * Guarda alumnos, pagos y gastos en esta planilla y mantiene las clases
 * sincronizadas con el calendario "FACK Music · Clases" de Google Calendar,
 * en los dos sentidos.
 *
 * Instalación: ver LEEME (sección "Conectar con Google").
 */

// ===== Ajustes =====
const VERSION_SERVIDOR = "__VERSION_SERVIDOR__";
const COMPARTIR_CON = (typeof AJUSTES !== "undefined" && AJUSTES && AJUSTES.COMPARTIR_CON) || ""; // mail del administrador para compartirle el calendario (opcional)
const NOMBRE_CALENDARIO = "FACK Music · Clases";
const TZ = "America/Argentina/Buenos_Aires";
const CURSOS_GRUPALES = ["Ensambles"];
// Nombre del grupo de un alumno grupal (ej. "Ensamble 1"). Vacío = se agrupa solo por día y horario.
function grupoDe(a) { return String((a && a.grupo) || "").replace(/\|/g, "/").trim(); }
function claveGrupo(a, c) { const k = ["g", a.curso, c.d, c.h, c.hf]; const g = grupoDe(a); if (g || c.f) k.push(g); if (c.f) k.push(c.f); return k.join("|"); }
// Colores de Google Calendar (1 lavanda, 2 salvia, 3 uva, 4 flamenco, 5 banana, 6 mandarina, 7 pavo real, 8 grafito, 9 arándano, 10 albahaca, 11 tomate)
const COLOR_CURSO = { "Canto": "4", "Guitarra": "7", "Piano": "3", "Batería": "6", "Bajo": "2", "Producción": "5", "Mezcla": "10", "Ensambles": "9", "Mentoría": "1", "Otro": "8" };
const COLECCIONES = ["alumnos", "pagos", "gastos", "liquidaciones", "config"];
const PERMISOS_BASE = { verCobros: false, verMontos: false, registrarCobros: false, editarAlumnos: true, bajasAlumnos: true, verGastos: "marcados", cargarGastos: true };
const PARTE_BASE = { tipo: "pct", valor: 0 };

// Si el dueño se olvida la contraseña: elegí esta función arriba y tocá "Ejecutar".
// Borra la cuenta del dueño; al abrir la app, el dueño la vuelve a crear.
function reiniciarDueno() {
  const u = usuarios(); delete u.dueno; guardarUsuarios(u);
  borrarSesiones("dueno");
}

// ===== Entrada =====
function doGet() {
  return salida({ ok: true, app: "alumnos-cuotas", mensaje: "El servidor de Alumnos y Cuotas está funcionando." });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return salida({ ok: false, error: "Pedido inválido." }); }
  if (!req) return salida({ ok: false, error: "Pedido inválido." });
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(28000)) return salida({ ok: false, error: "El servidor está ocupado. Probá de nuevo en unos segundos." });
  try {
    if (req.accion === "estado") return salida(estadoCuentas());
    if (req.accion === "crearDueno") return salida(crearDueno(req));
    if (req.accion === "unirse") return salida(unirse(req));
    if (req.accion === "login") return salida(login(req));
    if (req.accion === "vincularUsar") return salida(vincularUsar(req));
    const ses = sesion(req.token);
    if (!ses) return salida({ ok: false, sesion: false, error: "Tu sesión se cerró. Volvé a entrar con tu contraseña." });
    if (req.accion === "sync") return salida(sincronizar(req, ses));
    if (req.accion === "eventos") return salida(eventosEnRango(req));
    if (req.accion === "salir") { cerrarSesion(req.token); return salida({ ok: true }); }
    if (req.accion === "contrasena") return salida(cambiarContrasena(req, ses));
    if (req.accion === "vincularCrear") return salida(vincularCrear(ses));
    if (ses.rol !== "dueno") return salida({ ok: false, error: "Solo el dueño puede hacer esto." });
    if (req.accion === "invitar") return salida(invitar());
    if (req.accion === "reiniciarAdmin") return salida(reiniciarAdmin());
    return salida({ ok: false, error: "Acción desconocida." });
  } catch (err) {
    return salida({ ok: false, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

function salida(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ===== Cuentas =====
// Cada persona tiene su propia contraseña. Se guarda solo una huella (hash): nadie puede leerla.
function props() { return PropertiesService.getScriptProperties(); }
function leerJSON(k, def) { try { const v = props().getProperty(k); return v ? JSON.parse(v) : def; } catch (err) { return def; } }
function usuarios() { return leerJSON("usuarios", {}); }
function guardarUsuarios(u) { props().setProperty("usuarios", JSON.stringify(u)); }
function huella(texto) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(b);
}
function nuevaSal() { return Utilities.getUuid() + Utilities.getUuid(); }
const ROLES = { dueno: "Dueño", admin: "Administrador" };

function estadoCuentas() {
  const u = usuarios();
  let cal = null;
  if (typeof Calendar === "undefined") cal = "Falta agregar el servicio \"Google Calendar API\" en Apps Script (Servicios > +).";
  return { ok: true, hayDueno: !!u.dueno, hayAdmin: !!u.admin, nombres: { dueno: u.dueno ? u.dueno.nombre : "", admin: u.admin ? u.admin.nombre : "" }, calendarioError: cal };
}
function validarNueva(req) {
  const nombre = String(req.nombre || "").trim(), pass = String(req.contrasena || "");
  if (!nombre) return "Escribí tu nombre.";
  if (pass.length < 6) return "La contraseña tiene que tener al menos 6 caracteres.";
  return "";
}
function crearUsuario(rol, req) {
  const u = usuarios(), sal = nuevaSal();
  u[rol] = { nombre: String(req.nombre).trim().slice(0, 40), sal: sal, hash: huella(sal + String(req.contrasena)) };
  guardarUsuarios(u);
  return abrirSesion(rol);
}
function crearDueno(req) {
  if (usuarios().dueno) return { ok: false, error: "La cuenta del dueño ya existe. Entrá con su contraseña." };
  const err = validarNueva(req); if (err) return { ok: false, error: err };
  return crearUsuario("dueno", req);
}
function invitar() {
  if (usuarios().admin) return { ok: false, error: "Ya hay un administrador. Si querés cambiarlo, primero reiniciá su cuenta." };
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let cod = ""; for (let i = 0; i < 8; i++) cod += letras.charAt(Math.floor(Math.random() * letras.length));
  props().setProperty("invitacion", JSON.stringify({ hash: huella(cod), vence: Date.now() + 7 * 864e5 }));
  return { ok: true, codigo: cod.slice(0, 4) + "-" + cod.slice(4) };
}
function unirse(req) {
  if (usuarios().admin) return { ok: false, error: "Ya hay un administrador. Entrá con tu contraseña." };
  const inv = leerJSON("invitacion", null);
  const cod = String(req.codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!inv || inv.vence < Date.now() || huella(cod) !== inv.hash) {
    if (!fallo("invitacion")) return { ok: false, error: "Demasiados intentos. Esperá 15 minutos." };
    return { ok: false, error: "El código de invitación no es válido o venció. Pedile uno nuevo al dueño." };
  }
  const err = validarNueva(req); if (err) return { ok: false, error: err };
  props().deleteProperty("invitacion");
  return crearUsuario("admin", req);
}
function reiniciarAdmin() {
  const u = usuarios(); delete u.admin; guardarUsuarios(u);
  borrarSesiones("admin");
  return { ok: true };
}
// Bloquea 15 minutos después de 8 intentos fallidos.
function fallo(clave) {
  const f = leerJSON("fallas", {});
  const x = f[clave] || { n: 0, hasta: 0 };
  if (x.hasta > Date.now()) return false;
  x.n++; if (x.n >= 8) { x.n = 0; x.hasta = Date.now() + 15 * 60000; }
  f[clave] = x; props().setProperty("fallas", JSON.stringify(f));
  return true;
}
function bloqueado(clave) { const x = leerJSON("fallas", {})[clave]; return !!(x && x.hasta > Date.now()); }
function login(req) {
  const rol = req.rol === "admin" ? "admin" : "dueno";
  if (bloqueado(rol)) return { ok: false, error: "Demasiados intentos. Esperá 15 minutos." };
  const u = usuarios()[rol];
  if (!u) return { ok: false, error: rol === "admin" ? "Todavía no hay administrador. Usá el código de invitación." : "Todavía no hay cuenta de dueño." };
  if (huella(u.sal + String(req.contrasena || "")) !== u.hash) { fallo(rol); return { ok: false, error: "La contraseña no es correcta." }; }
  const f = leerJSON("fallas", {}); delete f[rol]; props().setProperty("fallas", JSON.stringify(f));
  return abrirSesion(rol);
}
function abrirSesion(rol) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  props().setProperty("s_" + huella(token), JSON.stringify({ rol: rol, vence: Date.now() + 365 * 864e5 }));
  const u = usuarios()[rol];
  return { ok: true, token: token, rol: rol, nombre: u ? u.nombre : "" };
}
function sesion(token) {
  if (!token) return null;
  const s = leerJSON("s_" + huella(String(token)), null);
  if (!s || s.vence < Date.now() || !usuarios()[s.rol]) return null;
  return s;
}
function cerrarSesion(token) { props().deleteProperty("s_" + huella(String(token))); }
function borrarSesiones(rol) {
  const p = props(), todo = p.getProperties();
  Object.keys(todo).forEach(function (k) { if (k.indexOf("s_") === 0) { try { if (JSON.parse(todo[k]).rol === rol) p.deleteProperty(k); } catch (err) { } } });
}
// Vincular otro dispositivo con QR o código: sirve una sola vez, vence en 10 minutos
// y abre la misma cuenta que la de quien lo creó.
function vincularCrear(ses) {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let cod = ""; for (let i = 0; i < 8; i++) cod += letras.charAt(Math.floor(Math.random() * letras.length));
  const p = props(), ahora = Date.now();
  Object.keys(p.getProperties()).forEach(function (k) { if (k.indexOf("v_") === 0) { const v = leerJSON(k, null); if (!v || v.vence < ahora) p.deleteProperty(k); } });
  p.setProperty("v_" + huella(cod), JSON.stringify({ rol: ses.rol, vence: ahora + 10 * 60000 }));
  return { ok: true, codigo: cod.slice(0, 4) + "-" + cod.slice(4), vence: ahora + 10 * 60000 };
}
function vincularUsar(req) {
  if (bloqueado("vincular")) return { ok: false, error: "Demasiados intentos. Esperá 15 minutos." };
  const cod = String(req.codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const k = "v_" + huella(cod), v = leerJSON(k, null);
  if (!v || v.vence < Date.now() || !usuarios()[v.rol]) {
    fallo("vincular");
    return { ok: false, error: "El código no es válido o venció. Generá uno nuevo en el otro dispositivo." };
  }
  props().deleteProperty(k);
  return abrirSesion(v.rol);
}

function cambiarContrasena(req, ses) {
  const u = usuarios(), yo = u[ses.rol];
  if (huella(yo.sal + String(req.actual || "")) !== yo.hash) return { ok: false, error: "La contraseña actual no es correcta." };
  if (String(req.nueva || "").length < 6) return { ok: false, error: "La contraseña nueva tiene que tener al menos 6 caracteres." };
  yo.sal = nuevaSal(); yo.hash = huella(yo.sal + String(req.nueva));
  guardarUsuarios(u);
  return { ok: true };
}

// ===== Planilla de datos =====
let ultimoTs = "";
function ts() {
  let t = new Date().toISOString();
  if (t <= ultimoTs) t = new Date(new Date(ultimoTs).getTime() + 1).toISOString();
  ultimoTs = t;
  return t;
}

function hoja(nombre, encabezado) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.getRange(1, 1, sh.getMaxRows(), encabezado.length).setNumberFormat("@");
    sh.getRange(1, 1, 1, encabezado.length).setValues([encabezado]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function abrirStore() {
  const sh = hoja("_datos", ["col", "id", "data", "deleted", "updated_at"]);
  const n = sh.getLastRow();
  const vals = n > 1 ? sh.getRange(2, 1, n - 1, 5).getValues() : [];
  const filas = [];
  const idx = {};
  vals.forEach(function (v, i) {
    if (!v[0]) return;
    let data = {};
    try { data = v[2] ? JSON.parse(v[2]) : {}; } catch (err) { data = {}; }
    const f = { col: String(v[0]), id: String(v[1]), data: data, deleted: String(v[3]) === "1", updated_at: String(v[4]), row: i + 2, sucia: false };
    filas.push(f);
    idx[f.col + "|" + f.id] = f;
  });
  return { sh: sh, filas: filas, idx: idx, huboCambios: false };
}

function guardar(st, col, id, data, borrado) {
  const k = col + "|" + id;
  let f = st.idx[k];
  if (!f) { f = { col: col, id: id, row: null }; st.filas.push(f); st.idx[k] = f; }
  f.data = borrado ? {} : data;
  f.deleted = !!borrado;
  f.updated_at = ts();
  f.sucia = true;
  st.huboCambios = true;
  return f;
}

function escribir(st) {
  const fila = function (f) { return [f.col, f.id, JSON.stringify(f.data || {}), f.deleted ? "1" : "", f.updated_at]; };
  const nuevas = [];
  st.filas.forEach(function (f) {
    if (!f.sucia) return;
    if (f.row) st.sh.getRange(f.row, 1, 1, 5).setValues([fila(f)]);
    else nuevas.push(f);
    f.sucia = false;
  });
  if (nuevas.length) {
    const desde = st.sh.getLastRow() + 1;
    const rango = st.sh.getRange(desde, 1, nuevas.length, 5);
    rango.setNumberFormat("@");
    rango.setValues(nuevas.map(fila));
    nuevas.forEach(function (f, i) { f.row = desde + i; });
  }
}

function alumnosVivos(st) {
  return st.filas.filter(function (f) { return f.col === "alumnos" && !f.deleted; });
}

// ===== Permisos =====
function configDe(st, k) { const f = st.idx["config|" + k]; return f && !f.deleted ? f.data : {}; }
function permisosDe(st) {
  const p = Object.assign({}, PERMISOS_BASE, configDe(st, "permisos"));
  if (!p.verCobros) { p.verMontos = false; p.registrarCobros = false; }
  if (["ninguno", "marcados", "todos"].indexOf(p.verGastos) < 0) p.verGastos = "marcados";
  return p;
}
function parteGeneral(st) { return Object.assign({}, PARTE_BASE, configDe(st, "parte")); }
// Lo que le corresponde al administrador por mes por un alumno.
function parteDe(a, general) {
  const p = a.parteAdmin && (a.parteAdmin.tipo === "pct" || a.parteAdmin.tipo === "monto") ? a.parteAdmin : general;
  const v = Number(p.valor) || 0;
  if (p.tipo === "monto") return Math.max(0, Math.round(v));
  return Math.max(0, Math.round((Number(a.cuota) || 0) * v / 100));
}
// Moneda en la que está expresada esa parte: el monto fijo general es en pesos; lo demás, en la moneda del alumno.
function parteMoneda(a, general) {
  const propia = a.parteAdmin && (a.parteAdmin.tipo === "pct" || a.parteAdmin.tipo === "monto");
  if (!propia && general.tipo === "monto") return "ARS";
  return a.moneda || "ARS";
}
function esDelAdmin(d) { return d && (d.por === "admin" || d.por === "licha"); }

// Qué ve el administrador de cada fila. null = no la ve.
function vistaAdmin(f, perm, general) {
  if (f.deleted) return null;
  const d = f.data || {};
  if (f.col === "alumnos") {
    const o = Object.assign({}, d);
    delete o.cuota; delete o.parteAdmin;
    if (!perm.verCobros) delete o.diaPago;
    else o.cobra = Number(d.cuota) > 0;
    if (perm.verMontos) o.cuota = d.cuota;
    o.aCobrar = parteDe(d, general);
    o.aCobrarMoneda = parteMoneda(d, general);
    return o;
  }
  if (f.col === "pagos") {
    if (!perm.verCobros) return null;
    const o = Object.assign({}, d);
    if (!perm.verMontos) delete o.monto;
    return o;
  }
  if (f.col === "gastos") {
    if (perm.verGastos === "todos" || esDelAdmin(d) || (perm.verGastos === "marcados" && d.visibleAdmin === true)) return d;
    return null;
  }
  if (f.col === "liquidaciones") return d;
  if (f.col === "config") return f.id === "permisos" ? perm : f.id === "cambio" ? d : null;
  return null;
}

// Cambios que manda el administrador: solo se acepta lo que tiene permitido.
function cambioDelAdmin(st, c, perm, forzar) {
  const k = c.col + "|" + c.id, f = st.idx[k], prev = f && !f.deleted ? f.data : null;
  forzar[k] = true; // siempre se le devuelve la versión real
  const d = Object.assign({}, c.data || {}); delete d.aCobrar; delete d.cobra;
  if (c.col === "alumnos") {
    if (c.deleted) return; // eliminar: solo el dueño
    if (!prev) {
      if (!perm.editarAlumnos) return;
      delete d.cuota; delete d.parteAdmin; delete d.diaPago;
      d.por = "admin";
      guardar(st, "alumnos", c.id, d, false);
      return;
    }
    const nuevo = Object.assign({}, prev);
    if (perm.editarAlumnos) ["nombre", "curso", "grupo", "telefono", "clases", "inicio"].forEach(function (x) { if (x in d) nuevo[x] = d[x]; });
    if (perm.bajasAlumnos) ["activo", "fin"].forEach(function (x) { if (x in d) nuevo[x] = d[x]; });
    if (JSON.stringify(nuevo) !== JSON.stringify(prev)) guardar(st, "alumnos", c.id, nuevo, false);
    return;
  }
  if (c.col === "pagos") {
    if (!perm.registrarCobros) return;
    if (c.deleted) { if (prev) guardar(st, "pagos", c.id, {}, true); return; }
    const al = st.idx["alumnos|" + d.alumnoId];
    if (!al || al.deleted) return;
    const monto = perm.verMontos && Number(d.monto) > 0 ? Number(d.monto) : (Number(al.data.cuota) || 0);
    guardar(st, "pagos", c.id, { alumnoId: d.alumnoId, mes: d.mes, fecha: d.fecha, medio: d.medio, monto: monto, moneda: al.data.moneda || "ARS", por: "admin" }, false);
    return;
  }
  if (c.col === "gastos") {
    if (prev && !esDelAdmin(prev)) return;
    if (c.deleted) { if (prev) guardar(st, "gastos", c.id, {}, true); return; }
    if (!prev && !perm.cargarGastos) return;
    delete d.visibleAdmin; d.por = "admin";
    guardar(st, "gastos", c.id, d, false);
    return;
  }
  // liquidaciones y config: solo el dueño
}

// ===== Sincronización con la app =====
function sincronizar(req, ses) {
  const st = abrirStore();
  const esDueno = ses.rol === "dueno";
  const forzar = {};
  const permAntes = permisosDe(st);
  (req.cambios || []).forEach(function (c) {
    if (COLECCIONES.indexOf(c.col) < 0 || !c.id) return;
    if (esDueno) {
      const d = Object.assign({}, c.data || {}); delete d.aCobrar; delete d.cobra;
      guardar(st, c.col, String(c.id), d, !!c.deleted);
    } else cambioDelAdmin(st, { col: c.col, id: String(c.id), data: c.data, deleted: c.deleted }, permAntes, forzar);
  });
  try { actualizarCotizacion(st); } catch (err) { /* sin internet: queda la anterior */ }
  let cal;
  try { cal = sincronizarCalendario(st); }
  catch (err) { cal = { ok: false, error: String((err && err.message) || err) }; }
  escribir(st);
  if (st.huboCambios) { try { actualizarHojasLegibles(st); } catch (err) { /* no frena la sincronización */ } }
  let since = req.since || "";
  const perm = permisosDe(st), general = parteGeneral(st);
  if (!esDueno) {
    // si cambiaron los permisos o el pago general, el administrador recibe todo de nuevo (y se le borra lo que ya no puede ver)
    ["config|permisos", "config|parte"].forEach(function (k) { const f = st.idx[k]; if (f && f.updated_at > since) since = ""; });
  }
  const filas = [];
  st.filas.forEach(function (f) {
    const k = f.col + "|" + f.id;
    if (!(f.updated_at > since) && !forzar[k]) return;
    if (esDueno) { filas.push({ col: f.col, id: f.id, data: f.data, deleted: f.deleted, updated_at: f.updated_at }); return; }
    const v = vistaAdmin(f, perm, general);
    filas.push(v ? { col: f.col, id: f.id, data: v, deleted: false, updated_at: f.updated_at } : { col: f.col, id: f.id, data: {}, deleted: true, updated_at: f.updated_at });
  });
  Object.keys(forzar).forEach(function (k) { if (!st.idx[k]) { const p = k.split("|"); filas.push({ col: p[0], id: p.slice(1).join("|"), data: {}, deleted: true, updated_at: "" }); } });
  const u = usuarios();
  const r = { ok: true, filas: filas, calendario: cal, rol: ses.rol, permisos: perm, nombres: { dueno: u.dueno ? u.dueno.nombre : "", admin: u.admin ? u.admin.nombre : "" } };
  if (esDueno) { r.parte = general; r.hayAdmin = !!u.admin; }
  return r;
}

// ===== Google Calendar =====
function asegurarCalendario() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty("calendarioId");
  if (id) {
    try { Calendar.Calendars.get(id); return id; } catch (err) { id = null; }
  }
  const c = Calendar.Calendars.insert({ summary: NOMBRE_CALENDARIO, timeZone: TZ, description: "Clases de FACK Music. Se sincroniza con la app Alumnos y Cuotas." });
  id = c.id;
  props.setProperty("calendarioId", id);
  props.deleteProperty("syncToken");
  if (COMPARTIR_CON) {
    COMPARTIR_CON.split(",").map(function (x) { return x.trim(); }).filter(String).forEach(function (mail) {
      try { Calendar.Acl.insert({ role: "writer", scope: { type: "user", value: mail } }, id); } catch (err) { }
    });
  }
  return id;
}

function fmt(d, patron) { return Utilities.formatDate(d, TZ, patron); }
function fechaLocal(texto) { return Utilities.parseDate(texto, TZ, "yyyy-MM-dd HH:mm"); }
// Ejecutar UNA vez desde el editor (arriba elegí "autorizarCotizacion" > Ejecutar) para darle permiso a la cotización automática.
function autorizarCotizacion() { const r = UrlFetchApp.fetch("https://api.bluelytics.com.ar/v2/latest"); Logger.log(r.getContentText().slice(0, 200)); }
// Cotización automática del dólar y el euro (venta), una vez por día. Fuente: Bluelytics.
function actualizarCotizacion(st) {
  if (typeof UrlFetchApp === "undefined") return;
  const c = configDe(st, "cambio");
  if (c.auto === false || c.fecha === hoyTxt()) return;
  const tipo = c.tipo === "oficial" ? "oficial" : "blue";
  const r = UrlFetchApp.fetch("https://api.bluelytics.com.ar/v2/latest", { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return;
  const j = JSON.parse(r.getContentText());
  const usd = j[tipo] && Number(j[tipo].value_sell), eur = j[tipo + "_euro"] && Number(j[tipo + "_euro"].value_sell);
  if (!(usd > 0)) return;
  guardar(st, "config", "cambio", { USD: Math.round(usd), EUR: eur > 0 ? Math.round(eur) : (Number(c.EUR) || 0), fecha: hoyTxt(), auto: true, tipo: tipo }, false);
}
function hoyTxt() { return fmt(new Date(), "yyyy-MM-dd"); }
function mesActual() { return fmt(new Date(), "yyyy-MM"); }

// Primera fecha (yyyy-MM-dd) en o después de "desde" (yyyy-MM-dd) que cae en el día d (1 = lunes).
function primeraFecha(desde, d) {
  const base = fechaLocal(desde + " 12:00");
  for (let i = 0; i < 7; i++) {
    const dt = new Date(base.getTime() + i * 864e5);
    if (Number(fmt(dt, "u")) === d) return fmt(dt, "yyyy-MM-dd");
  }
  return desde;
}
// "2026-11" => fin de la última clase posible: 31/10 23:59:59 hora local, en UTC
function untilDeMes(fin) { return untilAntesDe(fin + "-01"); }
function untilAntesDe(fecha) {
  const dt = new Date(fechaLocal(fecha + " 00:00").getTime() - 1000);
  return Utilities.formatDate(dt, "UTC", "yyyyMMdd'T'HHmmss'Z'");
}

function leerMapa() {
  const sh = hoja("_calendario", ["clave", "eventId", "d", "h", "hf", "desde", "sig"]);
  const n = sh.getLastRow();
  const vals = n > 1 ? sh.getRange(2, 1, n - 1, 7).getValues() : [];
  const lista = vals.filter(function (v) { return v[0] && v[1]; }).map(function (v) {
    return { clave: String(v[0]), eventId: String(v[1]), d: Number(v[2]), h: String(v[3]), hf: String(v[4]), desde: String(v[5] || ""), sig: String(v[6] || "") };
  });
  return { sh: sh, lista: lista };
}
function guardarMapa(mapa) {
  const sh = mapa.sh;
  const n = sh.getLastRow();
  if (n > 1) sh.getRange(2, 1, n - 1, 7).clearContent();
  if (mapa.lista.length) {
    const r = sh.getRange(2, 1, mapa.lista.length, 7);
    r.setNumberFormat("@");
    r.setValues(mapa.lista.map(function (m) { return [m.clave, m.eventId, String(m.d), m.h, m.hf, m.desde, m.sig]; }));
  }
}
function porClave(mapa, k) { return mapa.lista.filter(function (m) { return m.clave === k; })[0]; }
function porEvento(mapa, id) { return mapa.lista.filter(function (m) { return m.eventId === id; })[0]; }
function quitarDelMapa(mapa, m) { mapa.lista = mapa.lista.filter(function (x) { return x !== m; }); }

function norm(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim(); }
function nuevoId() { return "c" + Utilities.getUuid().replace(/-/g, "").slice(0, 10); }
function clasesDe(a) {
  return (Array.isArray(a.clases) ? a.clases : []).filter(function (c) { return c && c.d >= 1 && c.d <= 7 && c.h; }).map(function (c) {
    let hf = c.hf;
    if (!hf) { const t = Math.min(23 * 60 + 59, aMin(c.h) + (c.dur || 60)); hf = deMin(t); }
    const f = /^\d{4}-\d{2}-\d{2}$/.test(String(c.f || "")) ? String(c.f) : "";
    return { id: c.id || "", d: Number(c.d), h: c.h, hf: hf, f: f };
  });
}
function aMin(h) { const p = String(h).split(":"); return Number(p[0]) * 60 + Number(p[1] || 0); }
function deMin(m) { return ("0" + Math.floor(m / 60)).slice(-2) + ":" + ("0" + (m % 60)).slice(-2); }

// Cada clase de la app tiene un id estable: lo asigna si falta.
function asegurarIds(st) {
  alumnosVivos(st).forEach(function (f) {
    const cl = Array.isArray(f.data.clases) ? f.data.clases : [];
    let cambio = false;
    cl.forEach(function (c) { if (c && !c.id) { c.id = nuevoId(); cambio = true; } });
    if (cambio) guardar(st, "alumnos", f.id, f.data, false);
  });
}

// Qué eventos tendría que haber en el calendario según la app.
function eventosDeseados(st) {
  const out = {};
  const grupos = {};
  alumnosVivos(st).forEach(function (f) {
    const a = f.data;
    if (a.activo === false && !a.fin) return;
    const inicio = a.inicio || mesActual();
    const fin = a.fin || "";
    if (fin && fin <= inicio) return;
    clasesDe(a).forEach(function (c) {
      if (aMin(c.hf) <= aMin(c.h)) return;
      if (CURSOS_GRUPALES.indexOf(a.curso) >= 0) {
        const k = claveGrupo(a, c);
        const g = grupos[k] || (grupos[k] = { clave: k, curso: a.curso, nombre: grupoDe(a), d: c.d, h: c.h, hf: c.hf, f: c.f, miembros: [] });
        g.miembros.push({ a: a, id: f.id, inicio: inicio, fin: fin });
      } else {
        const k = ["a", f.id, c.id].join("|");
        out[k] = {
          clave: k, d: c.d, h: c.h, hf: c.hf, f: c.f, inicio: inicio, fin: fin, colorId: COLOR_CURSO[a.curso] || COLOR_CURSO.Otro,
          titulo: a.nombre + (a.curso ? " · " + a.curso : ""),
          descripcion: "Alumno de FACK Music" + (a.telefono ? "\nTeléfono: " + a.telefono : "") + "\n\nEsta clase se sincroniza con la app Alumnos y Cuotas."
        };
      }
    });
  });
  Object.keys(grupos).forEach(function (k) {
    const g = grupos[k];
    g.miembros.sort(function (x, y) { return String(x.a.nombre).localeCompare(String(y.a.nombre)); });
    const inicio = g.miembros.map(function (m) { return m.inicio; }).sort()[0];
    const todosConFin = g.miembros.every(function (m) { return m.fin; });
    const fin = todosConFin ? g.miembros.map(function (m) { return m.fin; }).sort().slice(-1)[0] : "";
    out[k] = {
      clave: k, d: g.d, h: g.h, hf: g.hf, f: g.f, inicio: inicio, fin: fin, colorId: COLOR_CURSO[g.curso] || COLOR_CURSO.Otro,
      titulo: (g.nombre ? g.nombre + " (" + g.curso + ")" : g.curso) + " · " + g.miembros.map(function (m) { return String(m.a.nombre); }).join(", "),
      descripcion: "Integrantes:\n" + g.miembros.map(function (m) { return "• " + m.a.nombre + (m.a.telefono ? " (" + m.a.telefono + ")" : ""); }).join("\n") + "\n\nEsta clase se sincroniza con la app Alumnos y Cuotas."
    };
  });
  Object.keys(out).forEach(function (k) {
    const e = out[k];
    e.sig = JSON.stringify([e.d, e.h, e.hf, e.titulo, e.descripcion, e.colorId, e.inicio, e.fin, e.f || ""]);
  });
  return out;
}

function cuerpoEvento(ev, desde) {
  let rrule = "RRULE:FREQ=WEEKLY";
  if (ev.fin) rrule += ";UNTIL=" + untilDeMes(ev.fin);
  if (ev.f) desde = ev.f;
  return {
    summary: ev.titulo,
    description: ev.descripcion,
    colorId: ev.colorId,
    start: { dateTime: desde + "T" + ev.h + ":00", timeZone: TZ },
    end: { dateTime: desde + "T" + ev.hf + ":00", timeZone: TZ },
    recurrence: ev.f ? [] : [rrule],
    reminders: { useDefault: false, overrides: [] },
    extendedProperties: { private: { app: "fack", clave: ev.clave } }
  };
}

// Cierra una serie ayer (queda como historial) o la borra si todavía no empezó.
function esUnica(m) { try { return !!(JSON.parse(m.sig || "[]")[8]); } catch (e) { return false; } }
function cerrarSerie(calId, m) {
  const hoy = hoyTxt();
  try {
    if (m.desde && m.desde < hoy) {
      Calendar.Events.patch({ recurrence: ["RRULE:FREQ=WEEKLY;UNTIL=" + untilAntesDe(hoy)], extendedProperties: { private: { app: "fack-historial", clave: "" } } }, calId, m.eventId);
    } else {
      Calendar.Events.remove(calId, m.eventId);
    }
  } catch (err) { /* ya no existe */ }
}

function horarioDe(it) {
  if (!it.start || !it.start.dateTime || !it.end || !it.end.dateTime) return null;
  const s = new Date(it.start.dateTime), e = new Date(it.end.dateTime);
  let hf = fmt(e, "HH:mm");
  if (fmt(e, "yyyy-MM-dd") !== fmt(s, "yyyy-MM-dd")) hf = "23:59";
  return { d: Number(fmt(s, "u")), h: fmt(s, "HH:mm"), hf: hf, desde: fmt(s, "yyyy-MM-dd") };
}

// Aplica en la planilla un cambio de horario hecho en Google Calendar.
function moverClases(st, m, t) {
  const p = m.clave.split("|");
  if (p[0] === "a") {
    const f = st.idx["alumnos|" + p[1]];
    if (!f || f.deleted) return;
    (f.data.clases || []).forEach(function (c) { if (c.id === p[2]) { c.d = t.d; c.h = t.h; c.hf = t.hf; if (c.f) c.f = t.desde; delete c.dur; } });
    guardar(st, "alumnos", f.id, f.data, false);
  } else if (p[0] === "g") {
    alumnosVivos(st).forEach(function (f) {
      if (f.data.curso !== p[1] || grupoDe(f.data) !== (p[5] || "")) return;
      let cambio = false;
      (f.data.clases || []).forEach(function (c) {
        const n = clasesDe({ clases: [c] })[0];
        if (n && String(n.d) === p[2] && n.h === p[3] && n.hf === p[4] && n.f === (p[6] || "")) { c.d = t.d; c.h = t.h; c.hf = t.hf; if (c.f) c.f = t.desde; delete c.dur; cambio = true; }
      });
      if (cambio) guardar(st, "alumnos", f.id, f.data, false);
    });
    m.clave = ["g", p[1], t.d, t.h, t.hf].concat(p[6] ? [p[5] || "", t.desde] : p[5] ? [p[5]] : []).join("|");
  }
}

// Quita de la planilla las clases de un evento borrado en Google Calendar.
function quitarClases(st, m) {
  const p = m.clave.split("|");
  alumnosVivos(st).forEach(function (f) {
    if (p[0] === "a" && f.id !== p[1]) return;
    if (p[0] === "g" && (f.data.curso !== p[1] || grupoDe(f.data) !== (p[5] || ""))) return;
    const antes = (f.data.clases || []).length;
    f.data.clases = (f.data.clases || []).filter(function (c) {
      if (p[0] === "a") return c.id !== p[2];
      const n = clasesDe({ clases: [c] })[0];
      return !(n && String(n.d) === p[2] && n.h === p[3] && n.hf === p[4] && (p[0] !== "g" || n.f === (p[6] || "")));
    });
    if (f.data.clases.length !== antes) guardar(st, "alumnos", f.id, f.data, false);
  });
}

function leerCambiosDeGoogle(calId) {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty("syncToken");
  let items = [], page = null;
  while (true) {
    const opts = { showDeleted: true, singleEvents: false, maxResults: 250 };
    if (token) opts.syncToken = token;
    if (page) opts.pageToken = page;
    let r;
    try { r = Calendar.Events.list(calId, opts); }
    catch (err) {
      if (token && /410|sync token|fullSyncRequired|invalid/i.test(String(err))) { token = null; page = null; items = []; props.deleteProperty("syncToken"); continue; }
      throw err;
    }
    (r.items || []).forEach(function (x) { items.push(x); });
    page = r.nextPageToken || null;
    if (!page) { if (r.nextSyncToken) props.setProperty("syncToken", r.nextSyncToken); break; }
  }
  return items;
}

function sincronizarCalendario(st) {
  if (typeof Calendar === "undefined") return { ok: false, error: "Falta agregar el servicio \"Google Calendar API\" en Apps Script (Servicios > +)." };
  const calId = asegurarCalendario();
  asegurarIds(st);
  const mapa = leerMapa();
  const r = { ok: true, desdeGoogle: 0, creados: 0, actualizados: 0, cerrados: 0, errores: 0 };
  try {

  // 1) Cambios hechos en Google Calendar
  leerCambiosDeGoogle(calId).forEach(function (it) {
    if (it.recurringEventId) return; // cambio de una sola fecha: se ve tal cual en la agenda
    const priv = (it.extendedProperties && it.extendedProperties.private) || {};
    let m = porEvento(mapa, it.id);
    if (it.status === "cancelled") {
      if (m) { quitarClases(st, m); quitarDelMapa(mapa, m); r.desdeGoogle++; }
      return;
    }
    if (!m && priv.app && priv.app !== "fack") return; // series viejas que quedaron como historial
    const t = horarioDe(it);
    if (!t) return;
    if (m) {
      if (t.d !== m.d || t.h !== m.h || t.hf !== m.hf) {
        moverClases(st, m, t);
        m.d = t.d; m.h = t.h; m.hf = t.hf; m.desde = t.desde;
        const otro = mapa.lista.filter(function (x) { return x !== m && x.clave === m.clave; })[0];
        if (otro) { try { Calendar.Events.remove(calId, it.id); } catch (err) { } quitarDelMapa(mapa, m); }
        r.desdeGoogle++;
      }
      return;
    }
    if (priv.app === "fack" && priv.clave) {
      // Google partió la serie ("este y los siguientes"): la nueva parte pasa a ser la clase actual.
      const viejo = porClave(mapa, priv.clave);
      if (viejo) {
        if (viejo.eventId !== it.id) {
          try { Calendar.Events.patch({ extendedProperties: { private: { app: "fack-historial", clave: "" } } }, calId, viejo.eventId); } catch (err) { }
        }
        moverClases(st, viejo, t);
        viejo.eventId = it.id; viejo.d = t.d; viejo.h = t.h; viejo.hf = t.hf; viejo.desde = t.desde; viejo.sig = "";
        r.desdeGoogle++;
      } else {
        mapa.lista.push({ clave: priv.clave, eventId: it.id, d: t.d, h: t.h, hf: t.hf, desde: t.desde, sig: "" });
      }
      return;
    }
    // Evento nuevo creado a mano en el calendario: si es semanal y el título es el nombre de un alumno, se suma como clase.
    const semanal = (it.recurrence || []).some(function (x) { return /FREQ=WEEKLY/.test(x); });
    if (!semanal) return;
    const titulo = norm(String(it.summary || "").split(/ · | - |·/)[0]);
    const f = alumnosVivos(st).filter(function (x) { return norm(x.data.nombre) === titulo; })[0];
    if (!f) return;
    const id = nuevoId();
    f.data.clases = (f.data.clases || []).concat([{ id: id, d: t.d, h: t.h, hf: t.hf }]);
    guardar(st, "alumnos", f.id, f.data, false);
    const grupal = CURSOS_GRUPALES.indexOf(f.data.curso) >= 0;
    const clave = grupal ? claveGrupo(f.data, t) : ["a", f.id, id].join("|");
    if (grupal && porClave(mapa, clave)) { try { Calendar.Events.remove(calId, it.id); } catch (err) { } }
    else mapa.lista.push({ clave: clave, eventId: it.id, d: t.d, h: t.h, hf: t.hf, desde: t.desde, sig: "" });
    r.desdeGoogle++;
  });

  // 2) Llevar a Google Calendar lo que hay en la app
  const deseados = eventosDeseados(st);
  const hoy = hoyTxt();
  Object.keys(deseados).forEach(function (k) {
    try { llevarEvento(k); } catch (err) { r.errores++; r.ultimoError = String((err && err.message) || err); }
  });
  function llevarEvento(k) {
    const ev = deseados[k];
    const m = porClave(mapa, k);
    const desdeInicio = ev.f || primeraFecha(ev.inicio + "-01", ev.d);
    if (!m) {
      const res = Calendar.Events.insert(cuerpoEvento(ev, desdeInicio), calId);
      mapa.lista.push({ clave: k, eventId: res.id, d: ev.d, h: ev.h, hf: ev.hf, desde: desdeInicio, sig: ev.sig });
      r.creados++;
      return;
    }
    if (m.sig === ev.sig) return;
    const cambioHorario = m.d !== ev.d || m.h !== ev.h || m.hf !== ev.hf;
    if (!ev.f && !esUnica(m) && cambioHorario && m.desde && m.desde < hoy) {
      // Cambió el horario desde la app: la serie vieja queda como historial y arranca una nueva desde hoy.
      cerrarSerie(calId, m);
      let desde = primeraFecha(hoy, ev.d);
      if (desdeInicio > desde) desde = desdeInicio;
      const res = Calendar.Events.insert(cuerpoEvento(ev, desde), calId);
      m.eventId = res.id; m.desde = desde;
    } else {
      const desde = cambioHorario ? desdeInicio : (m.desde || desdeInicio);
      if (!ev.f && ev.fin && untilDeMes(ev.fin) < desde.replace(/-/g, "") + "T000000Z") {
        try { Calendar.Events.remove(calId, m.eventId); } catch (err) { }
        quitarDelMapa(mapa, m); r.cerrados++; return;
      }
      try { Calendar.Events.patch(cuerpoEvento(ev, desde), calId, m.eventId); }
      catch (err) { const res = Calendar.Events.insert(cuerpoEvento(ev, desde), calId); m.eventId = res.id; }
      m.desde = desde;
    }
    m.d = ev.d; m.h = ev.h; m.hf = ev.hf; m.sig = ev.sig;
    r.actualizados++;
  }
  mapa.lista.slice().forEach(function (m) {
    if (deseados[m.clave]) return;
    const p = m.clave.split("|");
    const existe = p[0] === "g" ? true : !!(st.idx["alumnos|" + p[1]] && !st.idx["alumnos|" + p[1]].deleted);
    if (esUnica(m)) { if (!(m.desde && m.desde < hoy)) { try { Calendar.Events.remove(calId, m.eventId); } catch (err) { } } }
    else if (existe) cerrarSerie(calId, m);
    else { try { Calendar.Events.remove(calId, m.eventId); } catch (err) { } }
    quitarDelMapa(mapa, m);
    r.cerrados++;
  });
  } finally {
    guardarMapa(mapa);
  }
  return r;
}

// Eventos reales del calendario (con cambios de una sola fecha) para mostrar en la agenda.
function eventosEnRango(req) {
  if (typeof Calendar === "undefined") return { ok: false, error: "Falta agregar el servicio \"Google Calendar API\" en Apps Script (Servicios > +)." };
  const calId = asegurarCalendario();
  const desde = fechaLocal(req.desde + " 00:00"), hasta = fechaLocal(req.hasta + " 00:00");
  const out = [];
  let page = null;
  do {
    const opts = { timeMin: desde.toISOString(), timeMax: hasta.toISOString(), singleEvents: true, orderBy: "startTime", maxResults: 2500 };
    if (page) opts.pageToken = page;
    const r = Calendar.Events.list(calId, opts);
    (r.items || []).forEach(function (it) {
      if (it.status === "cancelled") return;
      const priv = (it.extendedProperties && it.extendedProperties.private) || {};
      const todoDia = !!(it.start && it.start.date);
      out.push({
        id: it.id,
        t: it.summary || "",
        s: todoDia ? it.start.date : fmt(new Date(it.start.dateTime), "yyyy-MM-dd'T'HH:mm"),
        e: todoDia ? it.end.date : fmt(new Date(it.end.dateTime), "yyyy-MM-dd'T'HH:mm"),
        todoDia: todoDia,
        clave: priv.app === "fack" ? (priv.clave || "") : "",
        desc: it.description || ""
      });
    });
    page = r.nextPageToken || null;
  } while (page);
  return { ok: true, eventos: out };
}

// ===== Hojas para leer (se regeneran solas, no las edites) =====
function actualizarHojasLegibles(st) {
  const vivos = function (col) { return st.filas.filter(function (f) { return f.col === col && !f.deleted; }).map(function (f) { return f.data && Object.assign({ id: f.id }, f.data); }); };
  const alumnos = vivos("alumnos");
  const nombres = {};
  alumnos.forEach(function (a) { nombres[a.id] = a.nombre; });
  const u = usuarios();
  const nombresUsuarios = { dueno: u.dueno ? u.dueno.nombre : "Dueño", admin: u.admin ? u.admin.nombre : "Administrador", felipe: "Felipe", licha: "Licha" };
  const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const general = parteGeneral(st);
  escribirHoja("Alumnos", ["Nombre", "Curso", "Clases", "Cuota", "Moneda", "Paga el día", "Teléfono", "Estado", "Parte del administrador", "Moneda de la parte"],
    alumnos.sort(function (x, y) { return String(x.nombre).localeCompare(String(y.nombre)); }).map(function (a) {
      return [a.nombre || "", (a.curso || "") + (grupoDe(a) ? " · " + grupoDe(a) : ""), clasesDe(a).map(function (c) { return DIAS[c.d - 1] + " " + c.h + "–" + c.hf; }).join(" · "), a.cuota || 0, a.moneda || "ARS", a.diaPago || "", a.telefono || "",
        a.activo === false ? "De baja" + (a.fin ? " desde " + a.fin : "") : "Activo", parteDe(a, general), parteMoneda(a, general)];
    }));
  escribirHoja("Pagos", ["Mes", "Alumno", "Monto", "Moneda", "Fecha", "Medio", "Registró"],
    vivos("pagos").sort(function (x, y) { return String(y.fecha).localeCompare(String(x.fecha)); }).map(function (p) {
      return [p.mes || "", nombres[p.alumnoId] || "(alumno borrado)", p.monto || 0, p.moneda || "ARS", p.fecha || "", p.medio || "", nombresUsuarios[p.por] || ""];
    }));
  escribirHoja("Gastos", ["Fecha", "Concepto", "Categoría", "Monto", "Registró"],
    vivos("gastos").sort(function (x, y) { return String(y.fecha).localeCompare(String(x.fecha)); }).map(function (g) {
      return [g.fecha || "", g.concepto || "", g.categoria || "", g.monto || 0, nombresUsuarios[g.por] || ""];
    }));
  escribirHoja("Pagos al administrador", ["Mes", "Fecha", "Monto", "Nota"],
    vivos("liquidaciones").sort(function (x, y) { return String(y.fecha).localeCompare(String(x.fecha)); }).map(function (l) {
      return [l.mes || "", l.fecha || "", l.monto || 0, l.nota || ""];
    }));
}

function escribirHoja(nombre, encabezado, filas) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.setFrozenRows(1);
  }
  sh.clearContents();
  sh.getRange(1, 1, 1, encabezado.length).setValues([encabezado]).setFontWeight("bold");
  sh.getRange(1, 1).setNote("Esta hoja se arma sola desde la app Alumnos y Cuotas. Los cambios que hagas acá se pierden: cargalos desde la app.");
  if (filas.length) sh.getRange(2, 1, filas.length, encabezado.length).setValues(filas);
}
