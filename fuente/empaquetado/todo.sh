set -e
cd /tmp/claude-0/eb
node empaquetar.js
for a in arm64 x64; do ~/.cargo/bin/rcodesign sign "out/Alumnos y Cuotas-darwin-$a/Alumnos y Cuotas.app" >/dev/null 2>&1; done
node icono-win.mjs
mkdir -p /home/claude/entregas && rm -f /home/claude/entregas/*.zip
cd out
(cd "Alumnos y Cuotas-darwin-arm64" && zip -qry -X "/home/claude/entregas/Alumnos y Cuotas - Mac (chip Apple M).zip" "Alumnos y Cuotas.app")
(cd "Alumnos y Cuotas-darwin-x64" && zip -qry -X "/home/claude/entregas/Alumnos y Cuotas - Mac (Intel).zip" "Alumnos y Cuotas.app")
mv "Alumnos y Cuotas-win32-x64" "Alumnos y Cuotas" && zip -qry -X "/home/claude/entregas/Alumnos y Cuotas - Windows.zip" "Alumnos y Cuotas"; mv "Alumnos y Cuotas" "Alumnos y Cuotas-win32-x64"
echo LISTO
