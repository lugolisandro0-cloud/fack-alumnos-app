#!/bin/bash
# Publica una versión nueva para la actualización automática.
# Uso: tools/publicar.sh 1.6.1 "Notas de la versión" [base]
set -e
V="$1"; NOTAS="$2"; BASE="${3:-1.6.0}"
cd /home/claude/alumnos-app
APP_VERSION="$V" UPD_BASE="https://raw.githubusercontent.com/lugolisandro0-cloud/fack-alumnos-app/main/" python3 tools/build_www.py
R=/home/claude/fack-alumnos-app
cp www/index.html "$R/index.html"
python3 - "$V" "$NOTAS" "$BASE" <<'P'
import hashlib,json,sys
h=open("/home/claude/fack-alumnos-app/index.html","rb").read()
json.dump({"version":sys.argv[1],"sha256":hashlib.sha256(h).hexdigest(),"notas":sys.argv[2],"base":sys.argv[3]},open("/home/claude/fack-alumnos-app/version.json","w"),ensure_ascii=False,indent=1)
P
cd "$R" && git fetch -q origin main && git rebase -q origin/main && git add -A && git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -qm "Versión $V: $NOTAS" && git push -q origin HEAD:main && echo "Publicada $V"
