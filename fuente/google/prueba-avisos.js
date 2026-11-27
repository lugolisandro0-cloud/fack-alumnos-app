// Recordatorios de Google Calendar por alumno.
const { crearEntorno } = require("./simulador");
const assert = require("assert");
const g = crearEntorno({ ahora: new Date("2026-11-20T15:00:00Z") });
const P = b => g.post(b);
const D = P({ accion: "crearDueno", nombre: "Felipe", contrasena: "felipe123" });
const ahora = () => new Date().toISOString();
const sync = cambios => { const r = P({ accion: "sync", token: D.token, since: "", cambios }); assert(r.ok, JSON.stringify(r)); return r; };
const al = (id, nombre, curso, grupo, clases, avisar) => ({ col: "alumnos", id, data: { nombre, curso, grupo, cuota: 0, diaPago: 10, inicio: "2026-11", activo: true, clases, ...(avisar ? { avisar } : {}) }, deleted: false, updated_at: ahora() });
const ev = re => Object.values(g.events).filter(e => e.status !== "cancelled" && re.test(e.summary));
const rem = e => (e.reminders.overrides || []).map(o => o.method + o.minutes).join(",");
sync([
  al("yo", "Felipe Chaves (Yo)", "Otro", "", [{ id: "c1", d: 3, h: "10:00", hf: "11:00" }]),
  al("a2", "Beto", "Ensambles", "Boscas", [{ id: "c2", d: 4, h: "19:00", hf: "21:00" }]),
  al("a3", "Caro", "Ensambles", "Boscas", [{ id: "c3", d: 4, h: "19:00", hf: "21:00" }])
]);
sync([{ col: "turnos", id: "t1", data: { alumnoId: "yo", fecha: "2026-11-25", h: "15:00", hf: "16:00", tipo: "Grabación" }, deleted: false, updated_at: ahora() }]);
assert.equal(rem(ev(/Felipe Chaves/)[0]), "", "sin recordatorio de entrada");
const n0 = Object.values(g.events).map(e => e.updated || e._seq).join();
sync([]); // sin cambios no toca nada
assert.equal(Object.values(g.events).map(e => e.updated || e._seq).join(), n0);
sync([al("yo", "Felipe Chaves (Yo)", "Otro", "", [{ id: "c1", d: 3, h: "10:00", hf: "11:00" }], [1440, 60])]);
const yo = ev(/Felipe Chaves/);
assert.equal(yo.length, 2, "clase + turno");
yo.forEach(e => assert.equal(rem(e), "popup1440,popup60", e.summary));
assert.equal(rem(ev(/Boscas/)[0]), "", "el ensamble sigue sin aviso");
sync([al("a2", "Beto", "Ensambles", "Boscas", [{ id: "c2", d: 4, h: "19:00", hf: "21:00" }], [30])]);
assert.equal(rem(ev(/Boscas/)[0]), "popup30", "ensamble toma el aviso de un integrante");
sync([al("yo", "Felipe Chaves (Yo)", "Otro", "", [{ id: "c1", d: 3, h: "10:00", hf: "11:00" }], [])]);
ev(/Felipe Chaves/).forEach(e => assert.equal(rem(e), "", "se puede sacar"));
console.log("AVISOS OK");
