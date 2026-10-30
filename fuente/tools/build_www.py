import re,sys,os
VERSION=os.environ.get('APP_VERSION','1.6.0');UPDBASE=os.environ.get('UPD_BASE','')
src=open('/home/claude/caja.html').read()
s=src

def rep(a,b,count=1):
    global s
    assert s.count(a)==count,(s.count(a),a[:80])
    s=s.replace(a,b)

# fuentes locales
rep('<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700&display=swap">\n','')
ff="".join(f'@font-face{{font-family:"{fam}";font-weight:{w};font-style:normal;font-display:swap;src:url("fonts/{f}-latin-{w}-normal.woff2") format("woff2")}}\n' for fam,f,ws in [("Anton","anton",[400]),("Barlow","barlow",[400,500,600,700]),("Barlow Condensed","barlow-condensed",[500,600,700])] for w in ws)
rep('<style>\n','<style>\n'+ff+'html,body{margin:0;-webkit-tap-highlight-color:transparent;-webkit-text-size-adjust:100%}\n[hidden]{display:none!important}\nimg{max-width:100%}\n:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}\nbody{overscroll-behavior-y:none}\n',1)
rep('<meta name="claude:viewport-fit-sides" content="cover">\n','')
s=s.replace('</style>',open('/home/claude/alumnos-app/tools/acceso.css').read()+'</style>',1)
rep('src="/_blob/3306c5ac001a6e5f6f7a8a37408bf09c"','src="logo.png"')

# guardar: local + sincronización
rep('  if(cols){try{const {id:_,...rest}=data;await cols[col].doc(id).set(rest)}catch(e){toast("No se pudo guardar. Revisá la conexión.")}}else lsSave();',
    '  lsSave();sync.push(col,id,data);agendarAvisos();')
rep('  if(cols){try{await cols[col].doc(id).delete()}catch(e){toast("No se pudo borrar.")}}else lsSave();',
    '  lsSave();sync.push(col,id,null);agendarAvisos();')

# botón de avisos
rep('<button class="btn sm ghost" id="icsBtn">Avisos en el calendario del teléfono</button>','<button class="btn sm ghost" id="icsBtn">${avisosTxt()}</button>',2)
rep('if(T.id==="icsBtn"){bajarICS();return}','if(T.id==="icsBtn"){activarAvisos();return}')
rep('pintarUsuario();$("#foot").textContent=cols?"Guardado en tu cuenta: lo ves igual en el celular y en la compu.":"Guardado solo en este dispositivo.";',
    'pintarUsuario();$("#foot").textContent=sync.estado();')

# reemplazar desde "calendario del teléfono" hasta el toast
i=s.index('/* ---------- calendario del teléfono ---------- */');j=s.index('let tt;function toast(m)')
s=s[:i]+open('/home/claude/alumnos-app/tools/nativo.js').read()+'\n'+open('/home/claude/alumnos-app/tools/actualizar.js').read().replace('__UPDBASE__',UPDBASE)+'\n'+s[j:]
# arranque
i=s.index('/* ---------- arranque ---------- */');j=s.rindex('})();\n</script>')
s=s[:i]+open('/home/claude/alumnos-app/tools/arranque.js').read()+'\n'+s[j:]
rep('$("#userChip").onclick=panelUsuarios;','$("#userChip").onclick=panelAjustes;')

head='''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0B0B12">
<script>'''+open('/home/claude/alumnos-app/tools/cargador.js').read().replace('__VERSION__',VERSION)+'''</script>
<script src="qrcode.js"></script>
<script src="jsQR.js"></script>
'''
s=head+s.replace('<title>Alumnos y Cuotas</title>\n','<title>Alumnos y Cuotas</title>\n</head>\n<body>\n',1)+'\n</body>\n</html>\n'
open('/home/claude/alumnos-app/www/index.html','w').write(s)
import shutil
shutil.copy('/home/claude/alumnos-app/node_modules/qrcode-generator/dist/qrcode.js','/home/claude/alumnos-app/www/qrcode.js')
shutil.copy('/home/claude/alumnos-app/node_modules/jsqr/dist/jsQR.js','/home/claude/alumnos-app/www/jsQR.js')
print("ok",len(s))
