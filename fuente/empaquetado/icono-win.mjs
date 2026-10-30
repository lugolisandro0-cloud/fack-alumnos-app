import * as ResEdit from "resedit";
import * as PELibrary from "pe-library";
import fs from "fs";
const exe = "/tmp/claude-0/eb/out/Alumnos y Cuotas-win32-x64/Alumnos y Cuotas.exe";
const data = fs.readFileSync(exe);
const pe = PELibrary.NtExecutable.from(data, { ignoreCert: true });
const res = PELibrary.NtExecutableResource.from(pe);
const ico = ResEdit.Data.IconFile.from(fs.readFileSync("/home/claude/escritorio/icono.ico"));
const grupos = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const id = grupos.length ? grupos[0].id : 1, lang = grupos.length ? grupos[0].lang : 1033;
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, lang, ico.icons.map(i => i.data));
const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
if (vi) {
  vi.setStringValues({ lang: 1033, codepage: 1200 }, { ProductName: "Alumnos y Cuotas", FileDescription: "Alumnos y Cuotas", CompanyName: "FACK Music", OriginalFilename: "Alumnos y Cuotas.exe", InternalName: "Alumnos y Cuotas" });
  vi.setFileVersion(1, 6, 0, 0, 1033); vi.setProductVersion(1, 6, 0, 0, 1033);
  vi.outputToResourceEntries(res.entries);
}
res.outputResource(pe);
fs.writeFileSync(exe, Buffer.from(pe.generate()));
console.log("icono de Windows listo");
