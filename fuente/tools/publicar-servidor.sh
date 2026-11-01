#!/bin/bash
# Publica el servidor (Codigo.gs) para que el cargador de Felipe lo tome solo.
# Uso: tools/publicar-servidor.sh 1.6.4
set -e
V="$1"; R=/home/claude/fack-alumnos-app
mkdir -p "$R/servidor"
sed "s/__VERSION_SERVIDOR__/$V/" /home/claude/alumnos-app/google/Codigo.gs > "$R/servidor/Codigo.gs"
cp /home/claude/alumnos-app/google/cargador.gs "$R/servidor/cargador.gs"
python3 - "$V" <<'P'
import hashlib,json,sys
h=open("/home/claude/fack-alumnos-app/servidor/Codigo.gs","rb").read()
json.dump({"version":sys.argv[1],"sha256":hashlib.sha256(h).hexdigest()},open("/home/claude/fack-alumnos-app/servidor/version.json","w"),indent=1)
P
cd "$R" && git add -A && git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -qm "Servidor $V" && git pull -q --rebase origin main && git push -q origin HEAD:main && echo "Servidor $V publicado"
