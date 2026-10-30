const { crearEntorno } = require("./simulador");
const assert = require("assert");
const g = crearEntorno(); const P = b => g.post(b);
const D = P({ accion: "crearDueno", nombre: "Felipe", contrasena: "felipe123" });
const inv = P({ accion: "invitar", token: D.token });
const A = P({ accion: "unirse", codigo: inv.codigo, nombre: "Licha", contrasena: "licha123" });
assert.equal(P({ accion: "vincularCrear", token: "malo" }).sesion, false, "sin sesión no se crea código");
const cA = P({ accion: "vincularCrear", token: A.token }); assert(cA.ok && /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cA.codigo));
const nuevoA = P({ accion: "vincularUsar", codigo: cA.codigo.toLowerCase() });
assert(nuevoA.ok && nuevoA.rol === "admin" && nuevoA.token !== A.token, "el código del admin abre la cuenta del admin");
assert.equal(P({ accion: "vincularUsar", codigo: cA.codigo }).ok, false, "un solo uso");
const cD = P({ accion: "vincularCrear", token: D.token });
assert.equal(P({ accion: "vincularUsar", codigo: cD.codigo }).rol, "dueno", "el del dueño abre la del dueño");
const cV = P({ accion: "vincularCrear", token: D.token });
g.setAhora(new Date(Date.now() + 11 * 60000));
assert.equal(P({ accion: "vincularUsar", codigo: cV.codigo }).ok, false, "vence a los 10 minutos");
// la sesión nueva sincroniza igual que la vieja
assert(P({ accion: "sync", token: nuevoA.token, since: "" }).ok);
// fuerza bruta
g.setAhora(new Date(Date.now() + 60 * 60000));
for (let i = 0; i < 8; i++) P({ accion: "vincularUsar", codigo: "XXXX-XXX" + i });
const c2 = P({ accion: "vincularCrear", token: D.token });
assert(/intentos/.test(P({ accion: "vincularUsar", codigo: c2.codigo }).error), "bloqueo por intentos");
console.log("VINCULAR OK");
