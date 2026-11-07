// Asistencias: el dueño y el administrador marcan; el administrador sin permiso no puede; hoja legible.
const { crearEntorno } = require("./simulador");
const assert = require("assert");
const g = crearEntorno({ ahora: new Date("2026-11-07T15:00:00Z") });
const P = b => g.post(b);
const D = P({ accion: "crearDueno", nombre: "Felipe", contrasena: "felipe123" });
const inv = P({ accion: "invitar", token: D.token });
const A = P({ accion: "unirse", codigo: inv.codigo, nombre: "Licha", contrasena: "licha123" });
const sync = (tok, cambios = []) => { const r = P({ accion: "sync", token: tok, since: "", cambios }); assert(r.ok, JSON.stringify(r)); return r; };
const datos = (col, id) => { const f = g.sheets._datos.data.find(x => x[0] === col && x[1] === id); return f && f[3] !== "1" ? JSON.parse(f[2]) : null; };
sync(D.token, [
  { col: "alumnos", id: "ana", data: { nombre: "Ana", curso: "Canto", cuota: 50000, diaPago: 10, inicio: "2026-11", activo: true, clases: [{ id: "c1", d: 1, h: "18:00", hf: "19:00" }] } },
  { col: "asistencias", id: "ana_2026-11-02_c1", data: { alumnoId: "ana", fecha: "2026-11-02", h: "18:00", hf: "19:00", clase: "c1", estado: "vino", por: "dueno" } }
]);
assert.equal(datos("asistencias", "ana_2026-11-02_c1").estado, "vino", "el dueño marca");
// el administrador la ve y puede marcar (permiso por defecto)
let r = sync(A.token);
assert(r.permisos.asistencias === true, "permiso por defecto");
assert(r.filas.some(f => f.col === "asistencias" && f.id === "ana_2026-11-02_c1" && !f.deleted && f.data.estado === "vino"), "admin ve la marca");
sync(A.token, [{ col: "asistencias", id: "ana_2026-11-09_c1", data: { alumnoId: "ana", fecha: "2026-11-09", h: "18:00", hf: "19:00", clase: "c1", estado: "aviso", nota: "x", extra: 1 } }]);
const m = datos("asistencias", "ana_2026-11-09_c1");
assert(m && m.estado === "aviso" && m.por === "admin" && !("extra" in m), "admin marca (solo campos válidos)");
// valores inválidos o alumno inexistente: se rechazan
sync(A.token, [{ col: "asistencias", id: "x1", data: { alumnoId: "nadie", fecha: "2026-11-09", estado: "vino" } }, { col: "asistencias", id: "x2", data: { alumnoId: "ana", fecha: "2026-11-09", estado: "otra" } }]);
assert(!datos("asistencias", "x1") && !datos("asistencias", "x2"), "rechaza inválidos");
// borrar
sync(A.token, [{ col: "asistencias", id: "ana_2026-11-09_c1", deleted: true }]);
assert(!datos("asistencias", "ana_2026-11-09_c1"), "admin borra marca");
// sin permiso: no puede
sync(D.token, [{ col: "config", id: "permisos", data: { asistencias: false, editarAlumnos: true } }]);
r = sync(A.token, [{ col: "asistencias", id: "ana_2026-11-16_c1", data: { alumnoId: "ana", fecha: "2026-11-16", estado: "vino" } }]);
assert(!datos("asistencias", "ana_2026-11-16_c1"), "sin permiso no guarda");
assert(r.filas.some(f => f.col === "asistencias" && f.id === "ana_2026-11-16_c1" && f.deleted), "se le borra lo que intentó");
assert(r.filas.some(f => f.col === "asistencias" && f.id === "ana_2026-11-02_c1" && !f.deleted), "igual las ve");
// hoja legible
const h = g.sheets.Asistencias;
assert(h && h.data.some(row => row[3] === "Ana" && row[5] === "Vino" && row[6] === "Felipe"), "hoja Asistencias: " + JSON.stringify(h && h.data));
console.log("asistencias ok");
