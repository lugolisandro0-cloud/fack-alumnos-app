// Clases de un solo día: no se repiten y van a Google Calendar como evento único.
const { crearEntorno } = require("./simulador");
const assert = require("assert");
const g = crearEntorno({ ahora: new Date("2026-11-05T15:00:00Z") });
const P = b => g.post(b);
const D = P({ accion: "crearDueno", nombre: "Felipe", contrasena: "felipe123" });
const ahora = () => new Date().toISOString();
const sync = cambios => { const r = P({ accion: "sync", token: D.token, since: "", cambios }); assert(r.ok, JSON.stringify(r)); return r; };
const al = (id, nombre, curso, grupo, clases) => ({ col: "alumnos", id, data: { nombre, curso, grupo, cuota: 1000, diaPago: 10, inicio: "2026-11", activo: true, clases }, deleted: false, updated_at: ahora() });
sync([
  al("a1", "Ana", "Canto", "", [{ id: "c1", d: 1, h: "18:00", hf: "19:00" }]),
  al("a2", "Beto", "Ensambles", "Ensamble Sábado", [{ id: "c2", d: 6, h: "15:00", hf: "17:00", f: "2026-11-28" }]),
  al("a3", "Caro", "Ensambles", "Ensamble Sábado", [{ id: "c3", d: 6, h: "15:00", hf: "17:00", f: "2026-11-28" }]),
  al("a4", "Dani", "Guitarra", "", [{ id: "c4", d: 6, h: "10:00", hf: "11:00", f: "2026-11-14" }])
]);
const evs = Object.values(g.events).filter(e => e.status !== "cancelled");
const ens = evs.filter(e => /Ensamble Sábado/.test(e.summary));
assert.equal(ens.length, 1, "un solo evento para el ensamble");
assert.equal(ens[0].start.dateTime.slice(0, 10), "2026-11-28", "el ensamble es el 28");
assert.deepEqual(ens[0].recurrence, [], "el ensamble no se repite");
assert(/Beto, Caro/.test(ens[0].summary), "con los dos integrantes");
const dani = evs.find(e => /Dani/.test(e.summary));
assert.equal(dani.start.dateTime.slice(0, 10), "2026-11-14"); assert.deepEqual(dani.recurrence, []);
const ana = evs.find(e => /Ana/.test(e.summary));
assert(/FREQ=WEEKLY/.test(ana.recurrence[0]), "la clase semanal sigue siendo semanal");
// mover el ensamble al 29 desde la app
sync([al("a2", "Beto", "Ensambles", "Ensamble Sábado", [{ id: "c2", d: 7, h: "15:00", hf: "17:00", f: "2026-11-29" }]), al("a3", "Caro", "Ensambles", "Ensamble Sábado", [{ id: "c3", d: 7, h: "15:00", hf: "17:00", f: "2026-11-29" }])]);
const ens2 = Object.values(g.events).filter(e => e.status !== "cancelled" && /Ensamble Sábado/.test(e.summary));
assert.equal(ens2.length, 1, "sigue habiendo un solo evento"); assert.equal(ens2[0].start.dateTime.slice(0, 10), "2026-11-29");
// borrar la clase de Dani (futura): desaparece del calendario
sync([al("a4", "Dani", "Guitarra", "", [])]);
assert(!Object.values(g.events).some(e => e.status !== "cancelled" && /Dani/.test(e.summary)), "la clase única futura se borra");
console.log("UNICA OK");
