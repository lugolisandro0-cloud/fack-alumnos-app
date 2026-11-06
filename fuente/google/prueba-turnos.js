// Turnos sueltos (clase extra, grabación, sesión de video...): permisos, cobro aparte y Google Calendar.
const { crearEntorno } = require("./simulador");
const assert = require("assert");
const g = crearEntorno({ ahora: new Date("2026-11-06T15:00:00Z") });
const P = b => g.post(b);
const D = P({ accion: "crearDueno", nombre: "Felipe", contrasena: "felipe123" });
const inv = P({ accion: "invitar", token: D.token });
const A = P({ accion: "unirse", codigo: inv.codigo, nombre: "Licha", contrasena: "licha123" });
const sync = (tok, cambios = []) => { const r = P({ accion: "sync", token: tok, since: "", cambios }); assert(r.ok, JSON.stringify(r)); return r; };
const datos = (col, id) => { const f = g.sheets._datos.data.find(x => x[0] === col && x[1] === id); return f && f[3] !== "1" ? JSON.parse(f[2]) : null; };
const vivos = () => Object.values(g.events).filter(e => e.status !== "cancelled");
sync(D.token, [
  { col: "config", id: "parte", data: { tipo: "monto", valor: 20000 } },
  { col: "config", id: "permisos", data: { verCobros: true, verMontos: false, registrarCobros: true, editarAlumnos: true } },
  { col: "alumnos", id: "ana", data: { nombre: "Ana", curso: "Canto", cuota: 50000, diaPago: 10, inicio: "2026-11", activo: true, clases: [{ id: "c1", d: 1, h: "18:00", hf: "19:00" }] } },
  { col: "alumnos", id: "rocio", data: { nombre: "Rocío", curso: "Otro", clases: [], soloTurnos: true, inicio: "2026-11", activo: true } },
  { col: "turnos", id: "t1", data: { alumnoId: "ana", fecha: "2026-11-12", h: "16:00", hf: "18:00", tipo: "Sesión de video", detalle: "Video para redes", cobro: "aparte", monto: 80000, moneda: "ARS", parteAdmin: { tipo: "pct", valor: 25 } } },
  { col: "turnos", id: "t2", data: { alumnoId: "ana", fecha: "2026-11-14", h: "10:00", hf: "11:00", tipo: "Clase extra", cobro: "incluido" } },
  { col: "turnos", id: "t3", data: { alumnoId: "rocio", fecha: "2026-11-20", h: "14:00", hf: "18:00", tipo: "Grabación", cobro: "aparte", monto: 150, moneda: "USD", parteAdmin: null } }
]);
// Google Calendar: un evento único por turno, con el nombre y qué hace
const t1 = vivos().find(e => /Ana · Sesión de video/.test(e.summary));
assert(t1 && t1.start.dateTime.slice(0, 10) === "2026-11-12" && t1.start.dateTime.slice(11, 16) === "16:00", "turno de video el 12 a las 16");
assert.deepEqual(t1.recurrence, [], "el turno no se repite");
assert(/Video para redes/.test(t1.description) && !/80000|80\.000/.test(t1.summary + t1.description), "detalle sin montos");
assert(vivos().find(e => /Rocío · Grabación/.test(e.summary)), "grabación de Rocío");
assert(vivos().find(e => /Ana · Clase extra/.test(e.summary)), "clase extra de Ana");
assert(vivos().some(e => /^Ana · Canto/.test(e.summary) && /WEEKLY/.test(e.recurrence[0])), "la clase semanal sigue igual");
console.log("calendario ok");

// Lo que ve el administrador
let r = sync(A.token);
const fa = id => r.filas.find(f => f.id === id);
assert.equal(fa("t1").data.aCobrar, 20000, "25% de 80.000");
assert(!("monto" in fa("t1").data) && !("parteAdmin" in fa("t1").data), "no ve precio ni porcentaje");
assert.equal(fa("t3").data.aCobrar, 0, "Felipe eligió que no le toca nada");
assert.equal(fa("rocio").data.aCobrar, 0, "una persona solo de turnos no genera parte mensual");
assert.equal(fa("ana").data.aCobrar, 20000, "Ana sigue con el monto fijo general");
console.log("vista admin ok");

// El administrador agenda un turno, cobra uno y trata de cambiar el precio
sync(A.token, [
  { col: "turnos", id: "t4", data: { alumnoId: "ana", fecha: "2026-11-18", h: "19:00", hf: "20:00", tipo: "Producción", cobro: "aparte", monto: 1, parteAdmin: { tipo: "pct", valor: 100 } } },
  { col: "turnos", id: "t1", data: { alumnoId: "ana", fecha: "2026-11-12", h: "16:00", hf: "18:00", tipo: "Sesión de video", detalle: "Video para redes", cobro: "aparte", monto: 1, pago: { fecha: "2026-11-12", medio: "Efectivo", monto: 1 } } }
]);
assert.equal(datos("turnos", "t4").por, "admin"); assert.equal(datos("turnos", "t4").monto, undefined, "sin verMontos no pone precio");
assert.equal(datos("turnos", "t4").parteAdmin, undefined, "no se pone su propio porcentaje");
assert.equal(datos("turnos", "t1").monto, 80000, "no cambia el precio");
assert.equal(datos("turnos", "t1").pago.monto, 80000, "el cobro queda con el precio real");
assert.deepEqual(datos("turnos", "t1").parteAdmin, { tipo: "pct", valor: 25 }, "el porcentaje queda");
assert(vivos().find(e => /Ana · Producción/.test(e.summary)), "el turno del admin va al calendario");
console.log("escritura admin ok");

// Se mueve un turno en Google Calendar (otro día y otro horario) y se borra otro
const ev = vivos().find(e => /Rocío · Grabación/.test(e.summary));
g.gcalMover(ev.id, "15:00", "19:00", "2026-11-27");
sync(D.token);
assert.equal(datos("turnos", "t3").fecha, "2026-11-27", "el turno pasa al 27"); assert.equal(datos("turnos", "t3").h, "15:00");
const ev2 = vivos().find(e => /Rocío · Grabación/.test(e.summary));
g.gcalMover(ev2.id, "15:00", "19:00", "2026-11-26");
sync(D.token);
assert.equal(datos("turnos", "t3").fecha, "2026-11-26", "mismo horario, otro día también se detecta");
g.gcalBorrar(vivos().find(e => /Ana · Producción/.test(e.summary)).id);
g.gcalBorrar(vivos().find(e => /Ana · Sesión de video/.test(e.summary)).id);
sync(D.token);
assert.equal(datos("turnos", "t4"), null, "turno sin pagar borrado en Google se borra en la app");
assert(datos("turnos", "t1"), "el turno ya pagado no se pierde");
assert(vivos().find(e => /Ana · Sesión de video/.test(e.summary)), "y vuelve al calendario");
console.log("cambios desde Google ok");
// Borrar un turno desde la app: se va del calendario
sync(D.token, [{ col: "turnos", id: "t2", deleted: true }]);
assert(!vivos().some(e => /Ana · Clase extra/.test(e.summary)), "turno borrado sale del calendario");
// Hoja legible
const hoja = g.sheets["Turnos y extras"].data; assert.equal(hoja.length, 3, "encabezado + 2 turnos"); assert(hoja.some(f => f[3] === "Ana" && f[9] === "Sí" && f[12] === "20000"), "hoja con el pago y la parte");
console.log("TURNOS OK");
