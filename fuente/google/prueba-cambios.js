// Cambio de día de una sola semana y mover un ensamble entero.
const { crearEntorno } = require("./simulador");
const assert = require("assert");
const g = crearEntorno({ ahora: new Date("2026-11-20T15:00:00Z") }); // viernes 20/11
const P = b => g.post(b);
const D = P({ accion: "crearDueno", nombre: "Felipe", contrasena: "felipe123" });
const ahora = () => new Date().toISOString();
const sync = cambios => { const r = P({ accion: "sync", token: D.token, since: "", cambios }); assert(r.ok, JSON.stringify(r)); return r; };
const al = (id, nombre, curso, grupo, clases) => ({ col: "alumnos", id, data: { nombre, curso, grupo, cuota: 1000, diaPago: 10, inicio: "2026-11", activo: true, clases }, deleted: false, updated_at: ahora() });
const jue = (id, cambios) => ({ id, d: 4, h: "19:00", hf: "21:00", ...(cambios ? { cambios } : {}) });
const MOV = { "2026-11-26": { a: "2026-11-24", h: "19:00", hf: "21:00" } };
sync([
  al("a1", "Beto", "Ensambles", "Los Boscas", [jue("c1")]),
  al("a2", "Caro", "Ensambles", "Los Boscas", [jue("c2")]),
  al("a3", "Ana", "Canto", "", [{ id: "c3", d: 1, h: "18:00", hf: "19:00" }])
]);
const ens = () => g.ver("2026-11-21", "2026-12-12").filter(e => /Los Boscas/.test(e.summary)).map(e => e.start.dateTime.slice(0, 16)).sort();
assert.deepEqual(ens(), ["2026-11-26T22:00", "2026-12-03T22:00", "2026-12-10T22:00"], "ensamble todos los jueves (UTC)");
// Todo el ensamble pasa el jueves 26 al martes 24
sync([al("a1", "Beto", "Ensambles", "Los Boscas", [jue("c1", MOV)]), al("a2", "Caro", "Ensambles", "Los Boscas", [jue("c2", MOV)])]);
assert.deepEqual(ens(), ["2026-11-24T22:00", "2026-12-03T22:00", "2026-12-10T22:00"], "solo esa semana pasa al martes");
assert.equal(Object.values(g.events).filter(e => e.status !== "cancelled" && /Los Boscas/.test(e.summary)).length, 1, "sigue siendo una sola serie");
// Otra sincronización no vuelve a tocar nada
const n0 = g.instCambios.length; sync([]); assert.equal(g.instCambios.length, n0, "no repite el cambio");
// Deshacer: vuelve al jueves
sync([al("a1", "Beto", "Ensambles", "Los Boscas", [jue("c1")]), al("a2", "Caro", "Ensambles", "Los Boscas", [jue("c2")])]);
assert.deepEqual(ens(), ["2026-11-26T22:00", "2026-12-03T22:00", "2026-12-10T22:00"], "deshacer vuelve al jueves");
// Solo Beto cambia: el ensamble queda el jueves y Beto tiene un evento suelto el martes
sync([al("a1", "Beto", "Ensambles", "Los Boscas", [jue("c1", MOV)])]);
assert.deepEqual(ens(), ["2026-11-24T22:00", "2026-11-26T22:00", "2026-12-03T22:00", "2026-12-10T22:00"]);
const suelto = Object.values(g.events).find(e => e.status !== "cancelled" && /cambio de día/.test(e.summary));
assert(suelto && /^Beto/.test(suelto.summary) && suelto.start.dateTime.startsWith("2026-11-24") && !suelto.recurrence.length, "evento suelto de Beto");
sync([al("a1", "Beto", "Ensambles", "Los Boscas", [jue("c1")])]);
assert(!Object.values(g.events).some(e => e.status !== "cancelled" && /cambio de día/.test(e.summary)), "se borra el suelto al deshacer");
// Clase individual: Ana pasa el lunes 23 al miércoles 25 a las 17
sync([al("a3", "Ana", "Canto", "", [{ id: "c3", d: 1, h: "18:00", hf: "19:00", cambios: { "2026-11-23": { a: "2026-11-25", h: "17:00", hf: "18:00" } } }])]);
const ana = g.ver("2026-11-21", "2026-12-08").filter(e => /Ana/.test(e.summary)).map(e => e.start.dateTime.slice(0, 16)).sort();
assert.deepEqual(ana, ["2026-11-25T20:00", "2026-11-30T21:00", "2026-12-07T21:00"], "Ana: miércoles esa semana, después lunes");
// Un cambio con fecha que no es del día de la clase se ignora
sync([al("a3", "Ana", "Canto", "", [{ id: "c3", d: 1, h: "18:00", hf: "19:00", cambios: { "2026-11-24": { a: "2026-11-25", h: "17:00", hf: "18:00" } } }])]);
assert.deepEqual(g.ver("2026-11-21", "2026-12-01").filter(e => /Ana/.test(e.summary)).map(e => e.start.dateTime.slice(0, 16)).sort(), ["2026-11-23T21:00", "2026-11-30T21:00"]);
// Mover el ensamble entero a los martes (horario fijo)
const mar = id => ({ id, d: 2, h: "19:00", hf: "21:00" });
sync([al("a1", "Beto", "Ensambles", "Los Boscas", [mar("c1")]), al("a2", "Caro", "Ensambles", "Los Boscas", [mar("c2")])]);
assert.deepEqual(ens(), ["2026-11-24T22:00", "2026-12-01T22:00", "2026-12-08T22:00"], "ahora todos los martes");
console.log("CAMBIOS OK");
