const { crearEntorno } = require("./simulador");
const assert = require("assert");
const g = crearEntorno();
const P = b => g.post(b);
// ---- Cuentas
let e = P({ accion: "estado" }); assert(e.ok && !e.hayDueno && !e.hayAdmin);
assert.equal(P({ accion: "sync", token: "x" }).sesion, false, "sin sesión no hay datos");
assert.equal(P({ accion: "crearDueno", nombre: "Felipe", contrasena: "123" }).ok, false, "contraseña corta");
const D = P({ accion: "crearDueno", nombre: "Felipe", contrasena: "felipe123" }); assert(D.ok && D.rol === "dueno");
assert.equal(P({ accion: "crearDueno", nombre: "Otro", contrasena: "otro1234" }).ok, false, "no se puede crear otro dueño");
assert.equal(P({ accion: "unirse", codigo: "AAAA-BBBB", nombre: "X", contrasena: "xxxxxx" }).ok, false, "sin invitación no entra");
assert.equal(P({ accion: "invitar", token: "malo" }).ok, false);
const inv = P({ accion: "invitar", token: D.token }); assert(inv.ok && /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(inv.codigo));
const A = P({ accion: "unirse", codigo: inv.codigo.toLowerCase(), nombre: "Licha", contrasena: "licha123" }); assert(A.ok && A.rol === "admin");
assert.equal(P({ accion: "unirse", codigo: inv.codigo, nombre: "Z", contrasena: "zzzzzz" }).ok, false, "la invitación es de un solo uso");
assert.equal(P({ accion: "invitar", token: A.token }).ok, false, "el admin no invita");
assert.equal(P({ accion: "login", rol: "dueno", contrasena: "licha123" }).ok, false, "la contraseña del admin no abre la cuenta del dueño");
assert.equal(P({ accion: "login", rol: "admin", contrasena: "felipe123" }).ok, false, "la del dueño no abre la del admin");
assert(P({ accion: "login", rol: "admin", contrasena: "licha123" }).ok);
// fuerza bruta
for (let i = 0; i < 8; i++) P({ accion: "login", rol: "dueno", contrasena: "mal" + i });
assert(/intentos/.test(P({ accion: "login", rol: "dueno", contrasena: "felipe123" }).error), "bloqueo tras 8 intentos");
console.log("cuentas ok");

// ---- Datos del dueño
let sinceD = "", sinceA = "";
const syncD = (cambios = []) => { const r = P({ accion: "sync", token: D.token, since: sinceD, cambios }); assert(r.ok, JSON.stringify(r)); r.filas.forEach(f => { if (f.updated_at > sinceD) sinceD = f.updated_at; }); return r; };
const syncA = (cambios = []) => { const r = P({ accion: "sync", token: A.token, since: sinceA, cambios }); assert(r.ok, JSON.stringify(r)); r.filas.forEach(f => { if (f.updated_at > sinceA) sinceA = f.updated_at; }); return r; };
syncD([
  { col: "config", id: "parte", data: { tipo: "pct", valor: 40 } },
  { col: "alumnos", id: "bosca", data: { nombre: "Los Boscas", curso: "Ensambles", cuota: 300000, diaPago: 5, inicio: "2026-10", activo: true, clases: [{ id: "c1", d: 3, h: "19:00", hf: "21:00" }] } },
  { col: "alumnos", id: "ana", data: { nombre: "Ana Pérez", curso: "Canto", cuota: 50000, diaPago: 10, inicio: "2026-10", activo: true, parteAdmin: { tipo: "monto", valor: 15000 }, clases: [{ id: "c2", d: 2, h: "18:00", hf: "19:00" }] } },
  { col: "pagos", id: "ana_2026-10", data: { alumnoId: "ana", mes: "2026-10", monto: 50000, fecha: "2026-10-10" } },
  { col: "gastos", id: "g1", data: { fecha: "2026-10-01", concepto: "Alquiler", categoria: "Alquiler", monto: 200000 } },
  { col: "gastos", id: "g2", data: { fecha: "2026-10-02", concepto: "Cuerdas", categoria: "Insumos", monto: 9000, visibleAdmin: true } },
  { col: "liquidaciones", id: "l1", data: { mes: "2026-10", monto: 60000, fecha: "2026-10-15", nota: "Adelanto" } }
]);

// ---- Lo que recibe el administrador
let r = syncA();
const texto = JSON.stringify(r);
const fila = (col, id) => r.filas.find(f => f.col === col && f.id === id);
assert(!/300000|50000|200000|"cuota"|"parteAdmin"|"valor"/.test(texto), "el admin no recibe cuotas ni montos ajenos: " + texto);
assert.equal(fila("alumnos", "bosca").data.aCobrar, 120000, "40% de 300.000");
assert.equal(fila("alumnos", "ana").data.aCobrar, 15000, "monto fijo de Ana");
assert(!("cuota" in fila("alumnos", "bosca").data) && !("diaPago" in fila("alumnos", "bosca").data));
assert(!fila("pagos", "ana_2026-10") || fila("pagos", "ana_2026-10").deleted, "no ve cobros");
assert(fila("gastos", "g1").deleted, "no ve gastos no marcados");
assert.equal(fila("gastos", "g2").data.monto, 9000, "ve el gasto marcado");
assert.equal(fila("liquidaciones", "l1").data.monto, 60000, "ve lo que le pagaron");
assert(!fila("config", "parte") || fila("config", "parte").deleted, "no ve el porcentaje");
assert.equal(r.parte, undefined); assert.equal(r.rol, "admin");
console.log("filtrado ok:", r.filas.filter(f => !f.deleted).map(f => f.col + ":" + f.id).join(", "));

// ---- Lo que intenta hacer el administrador
r = syncA([
  { col: "alumnos", id: "ana", data: { nombre: "Ana Pérez", curso: "Canto", cuota: 1, telefono: "11 5555", inicio: "2026-10", activo: true, clases: [{ id: "c2", d: 2, h: "18:30", hf: "19:30" }] } },
  { col: "alumnos", id: "nuevo", data: { nombre: "Nuevo", curso: "Piano", cuota: 999, clases: [] } },
  { col: "alumnos", id: "bosca", deleted: true },
  { col: "pagos", id: "bosca_2026-10", data: { alumnoId: "bosca", mes: "2026-10", monto: 1 } },
  { col: "gastos", id: "g1", data: { concepto: "hackeo", monto: 1 } },
  { col: "gastos", id: "g3", data: { fecha: "2026-10-20", concepto: "Púas", categoria: "Insumos", monto: 3000 } },
  { col: "liquidaciones", id: "l2", data: { mes: "2026-10", monto: 999999 } },
  { col: "config", id: "permisos", data: { verCobros: true, verMontos: true } }
]);
const datos = (col, id) => { const f = g.sheets._datos.data.find(x => x[0] === col && x[1] === id); return f && f[3] !== "1" ? JSON.parse(f[2]) : null; };
assert.equal(datos("alumnos", "ana").cuota, 50000, "no cambia la cuota");
assert.equal(datos("alumnos", "ana").telefono, "11 5555", "sí edita el teléfono");
assert.equal(datos("alumnos", "ana").clases[0].h, "18:30", "sí edita el horario");
assert.equal(datos("alumnos", "nuevo").cuota, undefined, "alumno nuevo sin cuota");
assert(datos("alumnos", "bosca"), "no puede eliminar");
assert.equal(datos("pagos", "bosca_2026-10"), null, "no registra cobros sin permiso");
assert.equal(datos("gastos", "g1").concepto, "Alquiler", "no edita gastos del dueño");
assert.equal(datos("gastos", "g3").por, "admin", "carga sus gastos");
assert.equal(datos("liquidaciones", "l2"), null); assert.equal(datos("config", "permisos"), null, "no cambia permisos");
assert(r.filas.find(f => f.id === "l2").deleted && r.filas.find(f => f.id === "bosca" && !f.deleted), "la app del admin se corrige sola");
console.log("permisos de escritura ok");

// ---- El dueño da permisos: ver cobros sin montos y todos los gastos
syncD([{ col: "config", id: "permisos", data: { verCobros: true, verMontos: false, registrarCobros: true, verGastos: "todos" } }]);
r = syncA();
assert(r.filas.find(f => f.id === "ana_2026-10" && !f.deleted && !("monto" in f.data)), "ve el cobro sin monto");
assert(r.filas.find(f => f.id === "g1" && !f.deleted), "ahora ve todos los gastos");
assert.equal(r.filas.find(f => f.id === "bosca").data.diaPago, 5, "ve el día de pago");
r = syncA([{ col: "pagos", id: "bosca_2026-10", data: { alumnoId: "bosca", mes: "2026-10", fecha: "2026-10-28", medio: "Efectivo" } }]);
assert.equal(datos("pagos", "bosca_2026-10").monto, 300000, "el cobro del admin se registra con la cuota real");
assert(!("monto" in r.filas.find(f => f.id === "bosca_2026-10").data));
// le quitan permisos: se le borra lo que ya no puede ver
syncD([{ col: "config", id: "permisos", data: { verCobros: false, verGastos: "ninguno" } }]);
r = syncA();
assert(r.filas.find(f => f.id === "ana_2026-10").deleted && r.filas.find(f => f.id === "g1").deleted && r.filas.find(f => f.id === "g2").deleted);
assert(!r.filas.find(f => f.id === "g3").deleted, "sus propios gastos los sigue viendo");
console.log("cambio de permisos ok");

// ---- Reiniciar admin cierra su sesión
assert(P({ accion: "reiniciarAdmin", token: D.token }).ok);
assert.equal(P({ accion: "sync", token: A.token }).sesion, false);
console.log("reinicio admin ok");
// calendario sigue funcionando
assert(g.activos().length >= 2); console.log("eventos:", g.activos().map(e => e.summary).join(" | "));
assert(!g.activos().some(e => /300|50\.000|50000/.test(e.summary + e.description)), "el calendario no muestra montos");
console.log("TODAS LAS PRUEBAS OK");

