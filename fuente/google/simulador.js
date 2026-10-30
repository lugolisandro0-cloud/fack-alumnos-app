// Simulador de Apps Script + Google Calendar para probar Codigo.gs sin Google.
const fs = require("fs");
const vm = require("vm");

function crearEntorno(opts = {}) {
  let ahora = opts.ahora || new Date("2026-10-27T15:00:00Z");
  const OFF = { "America/Argentina/Buenos_Aires": -180, "UTC": 0 };
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  function formatDate(d, tz, pat) {
    const x = new Date(d.getTime() + OFF[tz] * 60000);
    const map = { yyyy: x.getUTCFullYear(), MM: pad(x.getUTCMonth() + 1), dd: pad(x.getUTCDate()), HH: pad(x.getUTCHours()), mm: pad(x.getUTCMinutes()), ss: pad(x.getUTCSeconds()), u: ((x.getUTCDay() + 6) % 7) + 1 };
    let out = "", i = 0;
    while (i < pat.length) {
      if (pat[i] === "'") { const j = pat.indexOf("'", i + 1); out += pat.slice(i + 1, j); i = j + 1; continue; }
      const tok = ["yyyy", "MM", "dd", "HH", "mm", "ss", "u"].find(t => pat.startsWith(t, i));
      if (tok) { out += map[tok]; i += tok.length; } else { out += pat[i]; i++; }
    }
    return out;
  }
  function parseDate(txt, tz) { // "yyyy-MM-dd HH:mm"
    const [f, h] = txt.split(" "); const [y, m, d] = f.split("-").map(Number); const [hh, mi] = h.split(":").map(Number);
    return new Date(Date.UTC(y, m - 1, d, hh, mi) - OFF[tz] * 60000);
  }
  // ---- Planilla
  const sheets = {};
  function mkSheet(name) {
    const data = []; // filas (arrays)
    const sh = {
      name, data,
      getLastRow: () => { let n = data.length; while (n > 0 && data[n - 1].every(v => v === "" || v == null)) n--; return n; },
      getMaxRows: () => 1000,
      getRange: (r, c, nr = 1, nc = 1) => {
        if (typeof r === "string") return { setNumberFormat() { return this; } };
        return {
          setNumberFormat() { return this; }, setFontWeight() { return this; }, setNote() { return this; },
          setValues(vals) { for (let i = 0; i < nr; i++) { while (data.length < r + i) data.push([]); const row = data[r + i - 1]; for (let j = 0; j < nc; j++) row[c + j - 1] = String(vals[i][j]); } return this; },
          getValues() { const o = []; for (let i = 0; i < nr; i++) { const row = data[r + i - 1] || []; const v = []; for (let j = 0; j < nc; j++) v.push(row[c + j - 1] ?? ""); o.push(v); } return o; },
          clearContent() { for (let i = 0; i < nr; i++) { const row = data[r + i - 1]; if (row) for (let j = 0; j < nc; j++) row[c + j - 1] = ""; } return this; }
        };
      },
      setFrozenRows() { }, clearContents() { data.length = 0; }
    };
    return sh;
  }
  const ss = { getName: () => "Planilla", getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = mkSheet(n)) };
  // ---- Calendar
  let seq = 1, nid = 1;
  const cals = {}, events = {};
  const tocar = ev => { ev._seq = ++seq; };
  const merge = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object") merge(a[k], b[k]); else a[k] = JSON.parse(JSON.stringify(b[k])); } return a; };
  const Calendar = {
    Calendars: {
      get: id => { if (!cals[id]) throw new Error("Not Found"); return cals[id]; },
      insert: c => { const id = "cal" + (nid++); cals[id] = { ...c, id }; return cals[id]; }
    },
    Acl: { insert: () => ({}) },
    Events: {
      insert: (body, calId) => { const id = "ev" + (nid++); const ev = JSON.parse(JSON.stringify({ ...body, id, calId, status: "confirmed" })); events[id] = ev; tocar(ev); return ev; },
      patch: (body, calId, id) => { const ev = events[id]; if (!ev || ev.status === "cancelled") throw new Error("Not Found"); merge(ev, body); tocar(ev); return ev; },
      remove: (calId, id) => { const ev = events[id]; if (!ev || ev.status === "cancelled") throw new Error("Resource has been deleted"); ev.status = "cancelled"; tocar(ev); },
      list: (calId, o) => {
        let items = Object.values(events).filter(e => e.calId === calId);
        if (o.syncToken) items = items.filter(e => e._seq > Number(o.syncToken));
        if (!o.showDeleted && !o.syncToken) items = items.filter(e => e.status !== "cancelled");
        if (o.singleEvents) return { items: expandir(items.filter(e => e.status !== "cancelled"), new Date(o.timeMin), new Date(o.timeMax)) };
        const conOff = x => { if (x && x.dateTime && !/[+-]\d\d:\d\d$|Z$/.test(x.dateTime)) x.dateTime += "-03:00"; };
        const copia = JSON.parse(JSON.stringify(items)); copia.forEach(e => { conOff(e.start); conOff(e.end); });
        return { items: copia, nextSyncToken: String(seq) };
      }
    }
  };
  function expandir(items, t0, t1) {
    const out = [];
    for (const e of items) {
      const s = new Date(e.start.dateTime + "-03:00"), en = new Date(e.end.dateTime + "-03:00");
      const rr = (e.recurrence || [""])[0]; const um = /UNTIL=(\d{8}T\d{6}Z)/.exec(rr);
      const until = um ? new Date(um[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z")) : null;
      for (let k = 0; k < 600; k++) {
        const a = new Date(s.getTime() + k * 7 * 864e5), b = new Date(en.getTime() + k * 7 * 864e5);
        if (until && a > until) break; if (a >= t1) break;
        if (b > t0) out.push({ id: e.id + "_" + k, summary: e.summary, start: { dateTime: a.toISOString() }, end: { dateTime: b.toISOString() }, extendedProperties: e.extendedProperties, status: "confirmed" });
        if (!/WEEKLY/.test(rr)) break;
      }
    }
    return out;
  }
  const props = {};
  const ctx = {
    console,
    SpreadsheetApp: { getActive: () => ss },
    Utilities: { formatDate, parseDate, getUuid: () => require("crypto").randomUUID(), DigestAlgorithm: { SHA_256: "sha256" }, Charset: { UTF_8: "utf8" },
      computeDigest: (alg, txt) => Array.from(require("crypto").createHash("sha256").update(String(txt), "utf8").digest()), base64Encode: b => Buffer.from(b.map(x => x & 255)).toString("base64") },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getProperties: () => ({ ...props }) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() { } }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: t => ({ setMimeType() { return { texto: t }; } }) },
    Calendar
  };
  // Date con "ahora" controlable
  const RealDate = Date;
  class FakeDate extends RealDate { constructor(...a) { if (a.length === 0) super(ahora.getTime()); else super(...a); } static now() { return ahora.getTime(); } }
  ctx.Date = FakeDate;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/Codigo.gs", "utf8"), ctx);
  const api = {
    post: body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).texto),
    events, sheets, props,
    setAhora: d => { ahora = new Date(d); },
    // ediciones "a mano" en Google Calendar
    gcalMover: (id, h, hf, fecha) => { const ev = events[id]; const f = fecha || ev.start.dateTime.slice(0, 10); ev.start.dateTime = f + "T" + h + ":00"; ev.end.dateTime = f + "T" + hf + ":00"; tocar(ev); },
    gcalBorrar: id => { events[id].status = "cancelled"; tocar(events[id]); },
    gcalCrear: (calId, summary, fecha, h, hf, semanal = true) => Calendar.Events.insert({ summary, start: { dateTime: fecha + "T" + h + ":00", timeZone: "America/Argentina/Buenos_Aires" }, end: { dateTime: fecha + "T" + hf + ":00" }, recurrence: semanal ? ["RRULE:FREQ=WEEKLY"] : undefined }, calId),
    gcalPartir: (id, fecha, h, hf) => { // "este y los siguientes"
      const ev = events[id]; const nuevo = Calendar.Events.insert({ summary: ev.summary, start: { dateTime: fecha + "T" + h + ":00", timeZone: "America/Argentina/Buenos_Aires" }, end: { dateTime: fecha + "T" + hf + ":00" }, recurrence: ["RRULE:FREQ=WEEKLY"], extendedProperties: JSON.parse(JSON.stringify(ev.extendedProperties)) }, ev.calId);
      ev.recurrence = ["RRULE:FREQ=WEEKLY;UNTIL=" + fecha.replace(/-/g, "") + "T000000Z"]; tocar(ev); return nuevo;
    },
    activos: () => Object.values(events).filter(e => e.status !== "cancelled")
  };
  return api;
}
module.exports = { crearEntorno };
