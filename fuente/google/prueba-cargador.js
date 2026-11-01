// Prueba del cargador: descarga, actualización, versión rota y vuelta atrás.
const fs = require("fs"), crypto = require("crypto");
const { crearEntorno } = require("./simulador");
const base = fs.readFileSync(__dirname + "/Codigo.gs", "utf8");
let pub = {};
function publicar(ver, code) { pub = { "version.json": JSON.stringify({ version: ver, sha256: crypto.createHash("sha256").update(code, "utf8").digest("hex") }), "Codigo.gs": code }; }
const fuente = u => { const m = u.match(/servidor\/([^?]+)/); return m ? pub[m[1]] ?? null : null; };
const ok = (c, m) => { if (!c) { console.log("FALLA:", m); process.exit(1); } else console.log("ok -", m); };
publicar("1.0.0", base.replace("__VERSION_SERVIDOR__", "1.0.0"));
const g0 = crearEntorno({ cargador: true, fuente });
// En Apps Script cada pedido arranca de cero: se simula olvidando lo cargado.
const g = new Proxy(g0, { get: (t, k) => { if (k === "post") return b => { t.ctx.SRV_ = null; return t.post(b); }; return t[k]; } });
const doGet = () => { g0.ctx.SRV_ = null; return JSON.parse(g0.ctx.doGet({}).texto); };
g.ctx.autorizar();
ok(g.props.srv_nueva === "1.0.0", "descargó la versión 1.0.0");
let r = g.post({ accion: "estado" }); ok(r.ok, "responde estado con la 1.0.0");
ok(g.props.srv_ok === "1.0.0", "marcó la 1.0.0 como buena");
r = g.post({ accion: "crearDueno", nombre: "Felipe", contrasena: "felipe123" }); ok(r.ok && r.rol === "dueno", "crea el dueño a través del cargador");
// versión nueva: se toma sola después de 10 minutos
publicar("1.0.1", base.replace("__VERSION_SERVIDOR__", "1.0.1").replace('mensaje: "El servidor', 'version: VERSION_SERVIDOR, mensaje: "El servidor'));
delete g.cache.srv_chk;
r = doGet(); ok(r.version === "1.0.1", "tomó la 1.0.1 sola");
ok(g.props.srv_ok === "1.0.1" && !g.props["srv_c_1.0.0_n"], "1.0.1 quedó como buena y se borró la vieja");
// versión rota en tiempo de ejecución
publicar("1.0.2", base.replace("__VERSION_SERVIDOR__", "1.0.2").replace("function doGet() {", "function doGet() { throw new Error('roto');"));
delete g.cache.srv_chk;
r = doGet(); ok(r.version === "1.0.1", "con la 1.0.2 rota sigue andando la 1.0.1");
ok(g.props.srv_mala === "1.0.2", "marcó la 1.0.2 como mala");
delete g.cache.srv_chk; r = doGet(); ok(r.version === "1.0.1", "no vuelve a probar la 1.0.2");
// versión que no compila
publicar("1.0.3", "function doGet( {");
delete g.cache.srv_chk; r = doGet(); ok(r.version === "1.0.1", "una versión que no compila se ignora");
// sin internet
pub = {}; delete g.cache.srv_chk; r = g.post({ accion: "estado" }); ok(r.ok && r.hayDueno, "sin conexión a GitHub sigue andando y conserva los datos");
console.log("CARGADOR OK");
