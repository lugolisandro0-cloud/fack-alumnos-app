/* ---------- cuenta y sesión ---------- */
const COL_DUENO="#D61E8D",COL_ADMIN="#4CA4D7";
const LS_SYNC="alumnos-cuotas-sesion",LS_PERFIL="alumnos-cuotas-perfil";
const esEscritorio=()=>/Electron/i.test(navigator.userAgent||"");
const dispositivo=()=>esEscritorio()?"esta computadora":"este teléfono";
const inicial=n=>(n||"?").trim().charAt(0).toUpperCase();
const ROL_TXT={dueno:"Dueño",admin:"Administrador"};
let perfil={permisos:{},nombres:{dueno:"",admin:""},parte:null,hayAdmin:false};
try{perfil={...perfil,...JSON.parse(localStorage.getItem(LS_PERFIL)||"{}")}}catch(e){}
const guardarPerfil=()=>{try{localStorage.setItem(LS_PERFIL,JSON.stringify(perfil))}catch(e){}};
let yo={id:null,name:"",rol:""};

function esDueno(){return yo.id==="dueno"}
function puede(k){if(esDueno())return true;const p=perfil.permisos||{};if(k==="verMontos"||k==="registrarCobros")return !!(p.verCobros&&p[k]);return !!p[k]}
function permisoGastos(){return esDueno()?"todos":((perfil.permisos||{}).verGastos||"ninguno")}
function nombreAdmin(){return perfil.nombres.admin||"el administrador"}
function quien(id){
  if(!id)return "—";
  const r=id==="felipe"?"dueno":id==="licha"?"admin":id;
  if(r===yo.id)return "Vos";
  return perfil.nombres[r]||ROL_TXT[r]||"—";
}
function resolverNombres(){}
function pintarUsuario(){
  const b=$("#userChip");if(!b)return;
  b.hidden=!yo.id;if(!yo.id)return;
  const col=esDueno()?COL_DUENO:COL_ADMIN;
  b.innerHTML=`<span class="av" style="background:${col}">${esc(inicial(yo.name))}</span><span class="who"><b>${esc(yo.name)}</b><small>${esc(yo.rol)}</small></span>`;
  b.setAttribute("aria-label",`Ajustes. ${yo.name}, ${yo.rol}`);
}
function vaciarDatos(){alumnos=[];pagos={};gastos=[];liquidaciones=[];config={};lsSave()}

/* ---------- conexión con Google ---------- */
const sync=(()=>{
  let cfg={url:"",token:"",rol:"",nombre:"",last:"",cola:[]},timer=null,enCurso=false,otraVez=false,ultimo=null,error="",cal=null;
  try{cfg={...cfg,...JSON.parse(localStorage.getItem(LS_SYNC)||"{}")}}catch(e){}
  const save=()=>{try{localStorage.setItem(LS_SYNC,JSON.stringify(cfg))}catch(e){}};
  const activo=()=>!!(cfg.url&&cfg.token);
  const ponerYo=()=>{yo=cfg.token?{id:cfg.rol,name:cfg.nombre||ROL_TXT[cfg.rol],rol:ROL_TXT[cfg.rol]||""}:{id:null,name:"",rol:""}};
  ponerYo();
  async function llamar(body,url){
    const ctrl=typeof AbortController!=="undefined"?new AbortController():null;
    const to=setTimeout(()=>ctrl&&ctrl.abort(),45000);
    try{
      const r=await fetch(url||cfg.url,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({...body,token:body.token===undefined?cfg.token:body.token}),redirect:"follow",signal:ctrl?ctrl.signal:undefined});
      const txt=await r.text();
      let j;try{j=JSON.parse(txt)}catch(e){throw new Error(/<html/i.test(txt)?"Google no devolvió datos. Revisá que la implementación sea \"Aplicación web\" con acceso para \"Cualquier usuario\".":"Respuesta inesperada de Google.")}
      if(j.sesion===false&&cfg.token){sesionVencida(j.error);throw new Error(j.error)}
      if(!j.ok)throw new Error(j.error||"Google devolvió un error.");
      return j;
    }catch(e){if(e.name==="AbortError")throw new Error("Google tardó demasiado en responder.");throw e}
    finally{clearTimeout(to)}
  }
  function push(col,id,data){
    if(!activo())return;
    const {id:_,...rest}=data||{};
    cfg.cola=cfg.cola.filter(x=>!(x.col===col&&x.id===id));
    cfg.cola.push({col,id,data:data?rest:{},deleted:!data});
    save();clearTimeout(timer);timer=setTimeout(ciclo,800);
  }
  function aplicar(filas){
    let cambio=false;
    for(const x of filas){
      if(x.updated_at>cfg.last)cfg.last=x.updated_at;
      if(cfg.cola.some(c=>c.col===x.col&&c.id===x.id))continue;
      const v={id:x.id,...(x.data||{})};
      if(x.col==="alumnos"){alumnos=alumnos.filter(a=>a.id!==x.id);if(!x.deleted)alumnos.push(v)}
      else if(x.col==="pagos"){delete pagos[x.id];if(!x.deleted)pagos[x.id]=v}
      else if(x.col==="gastos"){gastos=gastos.filter(g=>g.id!==x.id);if(!x.deleted)gastos.push(v)}
      else if(x.col==="liquidaciones"){liquidaciones=liquidaciones.filter(g=>g.id!==x.id);if(!x.deleted)liquidaciones.push(v)}
      else if(x.col==="config"){delete config[x.id];if(!x.deleted)config[x.id]={...(x.data||{})}}
      cambio=true;
    }
    return cambio;
  }
  async function ciclo(){
    if(!activo())return;
    if(enCurso){otraVez=true;return}
    enCurso=true;
    try{
      const enviados=cfg.cola.slice(0,300);
      const j=await llamar({accion:"sync",since:cfg.last,cambios:enviados});
      cfg.cola=cfg.cola.filter(x=>!enviados.includes(x));
      const cambio=aplicar(j.filas||[]);
      cal=j.calendario||null;
      const antes=JSON.stringify(perfil);
      perfil.permisos=j.permisos||{};perfil.nombres=j.nombres||perfil.nombres;perfil.parte=j.parte||null;perfil.hayAdmin=!!j.hayAdmin;
      if(j.nombres&&j.nombres[cfg.rol]&&j.nombres[cfg.rol]!==cfg.nombre){cfg.nombre=j.nombres[cfg.rol];ponerYo()}
      guardarPerfil();save();ultimo=new Date();error="";
      if(cambio||enviados.length||antes!==JSON.stringify(perfil)){lsSave();agendarAvisos();gcalInvalidar();safeRender()}
    }catch(e){if(activo())error=navigator.onLine===false?"Sin internet. Se guarda cuando vuelva la conexión.":String(e.message||e)}
    enCurso=false;
    const f=$("#foot");if(f)f.textContent=estado();
    if(activo()&&(otraVez||cfg.cola.length)){otraVez=false;clearTimeout(timer);timer=setTimeout(ciclo,1500)}
  }
  function estado(){
    if(!activo())return "";
    if(error)return "Google: "+error;
    if(cfg.cola.length)return "Guardando "+cfg.cola.length+" cambio"+(cfg.cola.length===1?"":"s")+" en Google…";
    if(cal&&cal.ok===false&&esDueno())return "Datos sincronizados. Google Calendar: "+cal.error;
    return ultimo?"Sincronizado con Google · "+ultimo.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}):"Conectando con Google…";
  }
  // Entrar: crea la cuenta del dueño, se une con invitación o inicia sesión.
  async function entrar(url,body,subirLocal){
    const j=await llamar({...body,token:""},url);
    cfg={url,token:j.token,rol:j.rol,nombre:j.nombre||"",last:"",cola:[]};
    perfil={permisos:{},nombres:{dueno:"",admin:""},parte:null,hayAdmin:false};
    ponerYo();
    if(subirLocal&&j.rol==="dueno"){
      alumnos.forEach(a=>{const {id,aCobrar,cobra,...r}=a;cfg.cola.push({col:"alumnos",id,data:r,deleted:false})});
      Object.values(pagos).forEach(p=>{const {id,...r}=p;cfg.cola.push({col:"pagos",id,data:r,deleted:false})});
      gastos.forEach(g=>{const {id,...r}=g;cfg.cola.push({col:"gastos",id,data:r,deleted:false})});
    }else vaciarDatos();
    save();guardarPerfil();
    while(cfg.cola.length&&!error){await ciclo()}
    if(!cfg.cola.length)await ciclo();
    return j;
  }
  async function salir(){
    try{if(cfg.token)await llamar({accion:"salir"})}catch(e){}
    const url=cfg.url;cfg={url,token:"",rol:"",nombre:"",last:"",cola:[]};save();
    perfil={permisos:{},nombres:{dueno:"",admin:""},parte:null,hayAdmin:false};guardarPerfil();
    ponerYo();vaciarDatos();cancelarAvisos();gcalInvalidar();
  }
  function sesionVencida(msg){
    const url=cfg.url;cfg={url,token:"",rol:"",nombre:"",last:"",cola:[]};save();ponerYo();vaciarDatos();
    setTimeout(()=>pantallaAcceso(msg||"Tu sesión se cerró. Volvé a entrar."),0);
  }
  return {push,ciclo,estado,activo,llamar,entrar,salir,url:()=>cfg.url,pendientes:()=>cfg.cola.length};
})();

/* ---------- pantalla de ingreso ---------- */
function pantallaAcceso(aviso){
  closePanel();
  let root=$("#acceso");
  if(!root){root=document.createElement("div");root.id="acceso";document.body.appendChild(root)}
  root.hidden=false;
  const hayLocal=alumnos.length>0;
  let paso="url",est=null,url=sync.url()||"",rolElegido="dueno";
  const pintar=(msg)=>{
    let cuerpo="";
    if(paso==="url")cuerpo=`
      <p class="muted" style="margin:0">Pegá la dirección de la aplicación web de Google (la que termina en <b>/exec</b>). Te la pasa el dueño.</p>
      <div class="field"><label for="acUrl">Dirección</label><input id="acUrl" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(url)}"></div>
      <button class="btn" id="acSig">Seguir</button>
      <div class="lbl" style="margin-top:8px">¿Ya usás la app en otro dispositivo?</div>
      <button class="btn ghost" id="acScan">Escanear QR para vincular</button>
      <p class="foot" style="margin:0">En el otro dispositivo: tocá tu nombre arriba > Vincular otro dispositivo.</p>`;
    else if(paso==="crear")cuerpo=`
      <p class="muted" style="margin:0">Es la primera vez que se usa esta conexión. Creá la cuenta del <b>dueño</b>. Solo la tiene que crear la persona dueña del negocio.</p>
      ${hayLocal?`<p class="by" style="margin:0;color:var(--pend)">Los ${alumnos.length} alumnos que hay en ${dispositivo()} se suben a la cuenta del dueño.</p>`:""}
      <div class="field"><label for="acNom">Tu nombre</label><input id="acNom" autocomplete="name"></div>
      <div class="field"><label for="acP1">Contraseña (mínimo 6 caracteres)</label><input id="acP1" type="password" autocomplete="new-password"></div>
      <div class="field"><label for="acP2">Repetí la contraseña</label><input id="acP2" type="password" autocomplete="new-password"></div>
      <button class="btn" id="acCrear">Crear cuenta de dueño</button>`;
    else if(paso==="elegir")cuerpo=`
      <div class="lbl">¿Quién entra?</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="urow acRol" data-rol="dueno" style="width:100%;background:none;border:1px solid var(--grid);border-radius:10px;padding:12px;text-align:left;color:inherit"><span class="av" style="background:${COL_DUENO}">${esc(inicial(est.nombres.dueno))}</span><div style="flex:1;min-width:0"><b>${esc(est.nombres.dueno||"Dueño")}</b><div class="by" style="color:${COL_DUENO}">Dueño</div></div></button>
        ${est.hayAdmin?`<button class="urow acRol" data-rol="admin" style="width:100%;background:none;border:1px solid var(--grid);border-radius:10px;padding:12px;text-align:left;color:inherit"><span class="av" style="background:${COL_ADMIN}">${esc(inicial(est.nombres.admin))}</span><div style="flex:1;min-width:0"><b>${esc(est.nombres.admin||"Administrador")}</b><div class="by" style="color:${COL_ADMIN}">Administrador</div></div></button>`
        :`<button class="btn ghost" id="acInv">Tengo un código de invitación de administrador</button>`}
      </div>
      <button class="btn ghost" id="acVinc">Tengo un código para vincular</button>
      <button class="btn sm ghost" id="acAtras" style="align-self:flex-start">Cambiar dirección</button>`;
    else if(paso==="vincular")cuerpo=`
      <p class="muted" style="margin:0">En el dispositivo donde ya tenés la sesión abierta: tocá tu nombre arriba > <b>Vincular otro dispositivo</b> y escribí acá el código que aparece.</p>
      <div class="field"><label for="acVcod">Código</label><input id="acVcod" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="ABCD-EFGH" style="font-family:var(--f-num);font-size:22px;letter-spacing:.15em"></div>
      <button class="btn" id="acVok">Vincular</button>
      <button class="btn sm ghost" id="acAtras" style="align-self:flex-start">Volver</button>`;
    else if(paso==="clave")cuerpo=`
      <div class="lbl">${rolElegido==="dueno"?"Dueño":"Administrador"} · ${esc(est.nombres[rolElegido]||"")}</div>
      <div class="field"><label for="acPass">Contraseña</label><input id="acPass" type="password" autocomplete="current-password"></div>
      <button class="btn" id="acEntrar">Entrar</button>
      <button class="btn sm ghost" id="acAtras" style="align-self:flex-start">Volver</button>`;
    else if(paso==="invitacion")cuerpo=`
      <p class="muted" style="margin:0">Poné el código que te pasó el dueño y creá tu propia contraseña. El dueño no la conoce.</p>
      <div class="field"><label for="acCod">Código de invitación</label><input id="acCod" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="ABCD-EFGH"></div>
      <div class="field"><label for="acNom">Tu nombre</label><input id="acNom" autocomplete="name"></div>
      <div class="field"><label for="acP1">Contraseña (mínimo 6 caracteres)</label><input id="acP1" type="password" autocomplete="new-password"></div>
      <div class="field"><label for="acP2">Repetí la contraseña</label><input id="acP2" type="password" autocomplete="new-password"></div>
      <button class="btn" id="acUnirse">Crear mi cuenta</button>
      <button class="btn sm ghost" id="acAtras" style="align-self:flex-start">Volver</button>`;
    root.innerHTML=`<div class="acceso"><div class="acbox">
      <img src="logo.png" alt="FACK Music" style="height:46px;width:auto;align-self:flex-start">
      <h1>Alumnos y <em>Cuotas</em></h1>
      ${msg?`<div class="alert late"><p>${esc(msg)}</p></div>`:""}
      ${cuerpo}</div></div>`;
    bind();
  };
  const ocupado=(id,txt)=>{const b=$("#"+id);if(b){b.disabled=true;b.textContent=txt}};
  const validarNueva=()=>{const n=$("#acNom").value.trim(),p1=$("#acP1").value,p2=$("#acP2").value;
    if(!n)return "Escribí tu nombre.";if(p1.length<6)return "La contraseña tiene que tener al menos 6 caracteres.";if(p1!==p2)return "Las contraseñas no coinciden.";return ""};
  const listo=(j)=>{root.hidden=true;root.innerHTML="";tab="cal";render();toast(`Hola, ${j.nombre||yo.name}`);if(esNativo())activarAvisos(true)};
  function bind(){
    const on=(id,f)=>{const b=$("#"+id);if(b)b.onclick=f};
    on("acSig",async()=>{
      url=$("#acUrl").value.trim();
      if(!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(url)){pintar("La dirección tiene que empezar con https://script.google.com/");return}
      ocupado("acSig","Conectando…");
      try{est=await sync.llamar({accion:"estado",token:""},url);paso=est.hayDueno?"elegir":"crear";pintar()}
      catch(e){pintar("No pude conectar: "+e.message)}
    });
    on("acCrear",async()=>{const err=validarNueva();if(err){pintar(err);return}
      const nombre=$("#acNom").value.trim(),contrasena=$("#acP1").value;ocupado("acCrear","Creando…");
      try{const j=await sync.entrar(url,{accion:"crearDueno",nombre,contrasena},true);listo(j)}catch(e){pintar(e.message)}});
    document.querySelectorAll(".acRol").forEach(b=>b.onclick=()=>{rolElegido=b.dataset.rol;paso="clave";pintar();const i=$("#acPass");if(i)i.focus()});
    on("acInv",()=>{paso="invitacion";pintar()});
    on("acAtras",()=>{paso=paso==="elegir"?"url":"elegir";pintar()});
    on("acScan",()=>escanearQR());
    on("acVinc",()=>{paso="vincular";pintar();const i=$("#acVcod");if(i)i.focus()});
    on("acVok",async()=>{const c=$("#acVcod").value.trim();if(!c){pintar("Escribí el código.");return}ocupado("acVok","Vinculando…");
      const ok=await usarVinculo(url,c);if(!ok&&!sync.activo()){paso="vincular";pintar("El código no es válido o venció. Generá uno nuevo en el otro dispositivo.")}});
    on("acEntrar",async()=>{const contrasena=$("#acPass").value;if(!contrasena){pintar("Escribí la contraseña.");return}
      ocupado("acEntrar","Entrando…");
      try{const j=await sync.entrar(url,{accion:"login",rol:rolElegido,contrasena},false);listo(j)}catch(e){paso="clave";pintar(e.message)}});
    on("acUnirse",async()=>{const err=validarNueva();if(err){pintar(err);return}
      const codigo=$("#acCod").value.trim(),nombre=$("#acNom").value.trim(),contrasena=$("#acP1").value;if(!codigo){pintar("Poné el código de invitación.");return}
      ocupado("acUnirse","Creando…");
      try{const j=await sync.entrar(url,{accion:"unirse",codigo,nombre,contrasena},false);listo(j)}catch(e){pintar(e.message)}});
    const pass=$("#acPass");if(pass)pass.onkeydown=e=>{if(e.key==="Enter")$("#acEntrar").click()};
  }
  pintar(aviso);
}

/* ---------- eventos de Google Calendar en la agenda ---------- */
let gcal={cache:{},pend:{}};
function gcalInvalidar(){gcal.cache={}}
function eventosAgenda(desde,hasta){
  if(!sync.activo())return null;
  const k=iso(desde)+"_"+iso(hasta),c=gcal.cache[k];
  if(!c||Date.now()-c.at>90000)pedirEventos(k,desde,hasta);
  return c?c.ev:null;
}
async function pedirEventos(k,desde,hasta){
  if(gcal.pend[k])return;gcal.pend[k]=1;
  try{const j=await sync.llamar({accion:"eventos",desde:iso(desde),hasta:iso(hasta)});gcal.cache[k]={at:Date.now(),ev:j.eventos||[]};safeRender()}
  catch(e){}finally{delete gcal.pend[k]}
}
function verEventoExterno(id){
  let ev=null;for(const c of Object.values(gcal.cache)){ev=(c.ev||[]).find(x=>x.id===id);if(ev)break}
  if(!ev)return;
  const f=parse(ev.s.slice(0,10)).toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
  panel(`<div class="lbl">Google Calendar</div><h2 style="font-size:24px">${esc(ev.t||"(sin título)")}</h2>
    <p style="margin:0">${esc(f)} · ${esc(ev.s.slice(11,16))}–${esc((ev.e||"").slice(11,16))}</p>
    ${ev.desc?`<p class="muted" style="margin:0;white-space:pre-wrap">${esc(ev.desc)}</p>`:""}
    <p class="muted" style="margin:0;font-size:13.5px">Este evento no es la clase de un alumno: se ve acá porque está en el calendario de las clases. Para cambiarlo, editalo en Google Calendar.</p>
    <div class="actions"><button class="btn" id="geX">Listo</button></div>`);
  $("#geX").onclick=closePanel;
}

/* ---------- avisos (notificaciones del teléfono) ---------- */
const esNativo=()=>!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform());
const LN=()=>esNativo()&&Capacitor.Plugins&&Capacitor.Plugins.LocalNotifications;
const LS_AV="alumnos-cuotas-avisos";
let avisosOn=(()=>{try{return localStorage.getItem(LS_AV)!=="off"}catch(e){return true}})();
let permisoAvisos="?";
function avisosTxt(){
  if(!puede("verCobros"))return "Avisos de cobro: solo para el dueño";
  if(esEscritorio())return "Avisos: llegan al celular";
  if(!esNativo())return "Avisos: solo en la app instalada";
  if(permisoAvisos==="denied")return "Avisos bloqueados · activalos en Ajustes del teléfono";
  return avisosOn&&permisoAvisos==="granted"?"Avisos activados · 9 h":"Activar avisos de cobro";
}
async function activarAvisos(silencioso){
  if(!puede("verCobros")){if(!silencioso)toast("Los avisos de cobro son para quien ve los cobros.");return}
  const L=LN();if(!L){if(!silencioso)toast(esEscritorio()?"Los avisos de cobro llegan al celular. En la compu se ven en el calendario.":"Los avisos funcionan en la app instalada en el teléfono.");return}
  try{
    if(silencioso&&!avisosOn)return;
    const yaActivos=avisosOn&&permisoAvisos==="granted";
    if(!silencioso&&yaActivos){
      avisosOn=false;try{localStorage.setItem(LS_AV,"off")}catch(e){}
      await cancelarAvisos();toast("Avisos desactivados");safeRender();return}
    let p=await L.checkPermissions();
    if(p.display!=="granted")p=await L.requestPermissions();
    permisoAvisos=p.display;
    if(p.display!=="granted"){if(!silencioso)toast("Activá las notificaciones en Ajustes > Alumnos y Cuotas.");safeRender();return}
    avisosOn=true;try{localStorage.setItem(LS_AV,"on")}catch(e){}
    await agendarAvisosYa();if(!silencioso)toast("Listo: te aviso el día antes y el mismo día a las 9");safeRender();
  }catch(e){if(!silencioso)toast("No se pudieron activar los avisos.")}
}
async function cancelarAvisos(){const L=LN();if(!L)return;try{const p=await L.getPending();if(p.notifications&&p.notifications.length)await L.cancel({notifications:p.notifications.map(n=>({id:n.id}))})}catch(e){}}
let avTimer=null;
function agendarAvisos(){clearTimeout(avTimer);avTimer=setTimeout(agendarAvisosYa,1200)}
async function agendarAvisosYa(){
  const L=LN();if(!L)return;
  if(!puede("verCobros")||!avisosOn||permisoAvisos!=="granted"){await cancelarAvisos();return}
  await cancelarAvisos();
  const ahora=new Date(),t=today(),notifs=[],vm=puede("verMontos");let nid=1000;
  const lista=arr=>arr.map(a=>vm?`${a.nombre} (${fmt(a.cuota)})`:a.nombre).join(", ");
  for(let k=0;k<=30&&notifs.length<60;k++){
    const d=new Date(t.getFullYear(),t.getMonth(),t.getDate()+k),y=d.getFullYear(),m=d.getMonth();
    const vence=alumnos.filter(a=>activoEn(a,y,m)&&tieneCuota(a)&&!pagoDe(a,y,m)&&diaVence(a,y,m)===d.getDate());
    if(!vence.length)continue;
    const total=vence.reduce((s,a)=>s+(a.cuota||0),0),cuanto=vm?fmt(total):`${vence.length} cuota${vence.length===1?"":"s"}`;
    const antes=new Date(y,m,d.getDate()-1,9,0),hoy=new Date(y,m,d.getDate(),9,0);
    if(antes>ahora)notifs.push({id:nid++,title:`Mañana se cobran ${cuanto}`,body:lista(vence),schedule:{at:antes,allowWhileIdle:true}});
    if(hoy>ahora)notifs.push({id:nid++,title:`Hoy se cobran ${cuanto}`,body:lista(vence),schedule:{at:hoy,allowWhileIdle:true}});
  }
  if(notifs.length)try{await L.schedule({notifications:notifs.slice(0,60)})}catch(e){}
}

/* ---------- ajustes ---------- */
function panelAjustes(){
  const col=esDueno()?COL_DUENO:COL_ADMIN;
  panel(`<div class="urow" style="border:0;padding:0"><span class="av" style="background:${col}">${esc(inicial(yo.name))}</span><div style="flex:1;min-width:0"><b style="font-size:18px">${esc(yo.name)}</b><div class="by" style="color:${col}">${esc(yo.rol)}</div></div></div>
    ${esDueno()?`<button class="btn" id="sAdm">${perfil.hayAdmin?esc(nombreAdmin())+": permisos y pago":"Invitar al administrador"}</button>`:""}
    <div class="lbl" style="margin-top:6px">Dispositivos</div>
    <button class="btn ghost" id="sVin">Vincular otro dispositivo (QR)</button>
    ${esEscritorio()?"":`<button class="btn ghost" id="sScan">Escanear QR de otra cuenta</button>`}
    <button class="btn ghost" id="sSync">Sincronizar ahora</button>
    <div class="lbl" style="margin-top:6px">Avisos</div>
    <button class="btn ghost" id="sAv">${avisosTxt()}</button>
    <div class="lbl" style="margin-top:6px">App</div>
    <button class="btn ghost" id="sUpd">Actualizaciones · versión ${esc(APP_VERSION)}</button>
    <div class="lbl" style="margin-top:6px">Cuenta</div>
    <button class="btn ghost" id="sPass">Cambiar mi contraseña</button>
    <button class="btn ghost" id="sSalir" style="color:var(--late);border-color:var(--late)">Cerrar sesión en ${dispositivo()}</button>
    <p class="by" style="margin:0">${esc(sync.estado())}</p>
    <div class="actions"><button class="btn ghost" id="sX">Cerrar</button></div>`);
  if($("#sAdm"))$("#sAdm").onclick=panelPermisos;
  $("#sVin").onclick=panelVincular;
  if($("#sScan"))$("#sScan").onclick=()=>{closePanel();escanearQR()};
  $("#sSync").onclick=async()=>{const b=$("#sSync");b.disabled=true;b.textContent="Sincronizando…";gcalInvalidar();await sync.ciclo();closePanel();toast(sync.estado());safeRender()};
  $("#sAv").onclick=async()=>{await activarAvisos();const b=$("#sAv");if(b)b.textContent=avisosTxt()};
  $("#sX").onclick=closePanel;
  $("#sPass").onclick=panelContrasena;
  $("#sUpd").onclick=panelActualizaciones;
  $("#sSalir").onclick=()=>{
    panel(`<h2>¿Cerrar sesión?</h2><p class="muted" style="margin:0">Se borran de ${dispositivo()} los datos guardados. Para volver a entrar vas a necesitar tu contraseña.</p>
      ${sync.pendientes()?`<div class="alert late"><p>Hay ${sync.pendientes()} cambios que todavía no se guardaron en Google. Esperá a tener internet antes de salir.</p></div>`:""}
      <div class="actions"><button class="btn ghost" id="cX">Cancelar</button><button class="btn" id="cOk" style="background:var(--late)">Cerrar sesión</button></div>`);
    $("#cX").onclick=closePanel;
    $("#cOk").onclick=async()=>{closePanel();await sync.salir();pantallaAcceso()};
  };
}
function panelUsuarios(){panelAjustes()}
function panelContrasena(){
  panel(`<h2 style="font-size:24px">Cambiar contraseña</h2>
    <div class="field"><label for="cpA">Contraseña actual</label><input id="cpA" type="password" autocomplete="current-password"></div>
    <div class="field"><label for="cpN">Contraseña nueva (mínimo 6)</label><input id="cpN" type="password" autocomplete="new-password"></div>
    <div class="field"><label for="cpR">Repetí la nueva</label><input id="cpR" type="password" autocomplete="new-password"></div>
    <p class="by" id="cpMsg" style="margin:0"></p>
    <div class="actions"><button class="btn ghost" id="cpX">Cancelar</button><button class="btn" id="cpOk">Cambiar</button></div>`);
  $("#cpX").onclick=closePanel;
  $("#cpOk").onclick=async()=>{const a=$("#cpA").value,n=$("#cpN").value,r=$("#cpR").value,msg=$("#cpMsg");
    if(n.length<6){msg.textContent="La nueva tiene que tener al menos 6 caracteres.";return}if(n!==r){msg.textContent="Las contraseñas nuevas no coinciden.";return}
    try{await sync.llamar({accion:"contrasena",actual:a,nueva:n});closePanel();toast("Contraseña cambiada")}catch(e){msg.textContent=e.message;msg.style.color="var(--late)"}};
}
// Sección de la cuenta del administrador dentro de "Permisos" (solo el dueño)
function adminCuentaHTML(){
  if(!esDueno())return "";
  return perfil.hayAdmin
    ?`<div class="card" style="background:var(--head)"><div class="kv"><span>Cuenta</span><span>${esc(nombreAdmin())} · Administrador</span></div>
       <p class="foot" style="margin:0">Tiene su propia contraseña: vos no la conocés y él no conoce la tuya.</p>
       <button class="btn sm ghost" id="admReset" style="align-self:flex-start;color:var(--late);border-color:var(--late)">Quitar acceso al administrador</button></div>`
    :`<div class="card" style="background:var(--head)"><div class="kv"><span>Cuenta</span><span>Todavía no hay administrador</span></div>
       <p class="foot" style="margin:0">Creá un código de invitación y pasáselo junto con la dirección de Google. Con eso crea su cuenta y su propia contraseña. El código sirve una sola vez y vence en 7 días.</p>
       <div id="admCod"></div>
       <button class="btn sm" id="admInv" style="align-self:flex-start">Crear código de invitación</button></div>`;
}
function adminCuentaBind(){
  const inv=$("#admInv");
  if(inv)inv.onclick=async()=>{inv.disabled=true;inv.textContent="Creando…";
    try{const j=await sync.llamar({accion:"invitar"});
      $("#admCod").innerHTML=`<div class="field"><label for="admCodTxt">Código (pasáselo al administrador)</label><input id="admCodTxt" readonly value="${esc(j.codigo)}" style="font-family:var(--f-num);font-size:22px;letter-spacing:.15em"></div>
        <div class="field"><label for="admUrlTxt">Dirección de Google</label><input id="admUrlTxt" readonly value="${esc(sync.url())}"></div>`;
      inv.textContent="Crear otro código";inv.disabled=false;
      const t=$("#admCodTxt");t.onclick=()=>t.select();const u=$("#admUrlTxt");u.onclick=()=>u.select();
    }catch(e){toast(e.message);inv.disabled=false;inv.textContent="Crear código de invitación"}};
  const rs=$("#admReset");
  if(rs)rs.onclick=()=>{
    panel(`<h2>¿Quitar acceso a ${esc(nombreAdmin())}?</h2><p class="muted" style="margin:0">Se cierra su sesión en todos sus dispositivos y su contraseña deja de funcionar. Para que vuelva a entrar, le creás una invitación nueva y crea otra contraseña.</p>
      <div class="actions"><button class="btn ghost" id="rX">Cancelar</button><button class="btn" id="rOk" style="background:var(--late)">Quitar acceso</button></div>`);
    $("#rX").onclick=closePanel;
    $("#rOk").onclick=async()=>{try{await sync.llamar({accion:"reiniciarAdmin"});perfil.hayAdmin=false;guardarPerfil();closePanel();toast("Acceso quitado");sync.ciclo()}catch(e){toast(e.message)}};
  };
}

/* ---------- vincular otro dispositivo (QR o código) ---------- */
const ESQUEMA="fackalumnos://vincular";
function linkVincular(codigo){return `${ESQUEMA}?u=${encodeURIComponent(sync.url())}&c=${encodeURIComponent(codigo)}`}
function leerLinkVincular(txt){
  try{const t=String(txt||"").trim();if(!t.toLowerCase().startsWith(ESQUEMA))return null;
    const q=new URLSearchParams(t.slice(t.indexOf("?")+1));const u=q.get("u"),c=q.get("c");
    if(!u||!c||!/^https:\/\/script\.google(usercontent)?\.com\//.test(u))return null;return {u,c}}catch(e){return null}
}
async function panelVincular(){
  panel(`<h2 style="font-size:24px">Vincular otro dispositivo</h2><p class="muted" style="margin:0">Generando código…</p>`);
  let j;try{j=await sync.llamar({accion:"vincularCrear"})}catch(e){panel(`<h2>No se pudo generar el código</h2><p class="muted" style="margin:0">${esc(e.message)}</p><div class="actions"><button class="btn" id="vX">Cerrar</button></div>`);$("#vX").onclick=closePanel;return}
  let svg="";
  try{const q=qrcode(0,"M");q.addData(linkVincular(j.codigo));q.make();svg=q.createSvgTag({cellSize:6,margin:3,scalable:true})}catch(e){}
  panel(`<div class="lbl">Tu cuenta: ${esc(yo.name)} · ${esc(yo.rol)}</div><h2 style="font-size:24px">Vincular otro dispositivo</h2>
    <div class="qrbox" aria-label="Código QR para vincular">${svg}</div>
    <div style="text-align:center"><div class="by">o escribí este código</div><div class="num" style="font-size:30px;letter-spacing:.18em">${esc(j.codigo)}</div><div class="by" id="vT"></div></div>
    <ol class="pasos">
      <li><b>En el celular:</b> abrí la app y tocá <b>Escanear QR</b> (en la pantalla de ingreso, o en Ajustes si ya hay otra sesión).</li>
      <li><b>En otra computadora:</b> en la pantalla de ingreso pegá la dirección de Google y tocá <b>Tengo un código para vincular</b>.</li>
    </ol>
    <p class="foot" style="margin:0">Abre tu misma cuenta, sin contraseña. Sirve una sola vez y vence en 10 minutos. No lo compartas con otra persona.</p>
    <div class="actions"><button class="btn ghost" id="vOtro">Generar otro</button><button class="btn" id="vX">Listo</button></div>`);
  $("#vX").onclick=closePanel;$("#vOtro").onclick=panelVincular;
  const t=setInterval(()=>{const el=$("#vT");if(!el){clearInterval(t);return}const s=Math.max(0,Math.round((j.vence-Date.now())/1000));el.textContent=s?`Vence en ${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`:"Venció: generá otro";if(!s)clearInterval(t)},1000);
}
async function usarVinculo(u,c){
  const root=$("#acceso");
  try{const j=await sync.entrar(u,{accion:"vincularUsar",codigo:c},false);
    if(root){root.hidden=true;root.innerHTML=""}closePanel();tab="cal";render();toast(`Vinculado: ${j.nombre||yo.name}`);if(esNativo())activarAvisos(true);return true}
  catch(e){if(!sync.activo())pantallaAcceso(e.message);else toast(e.message);return false}
}
async function procesarVinculo(txt){
  const v=leerLinkVincular(txt);if(!v){toast("Ese QR no es de Alumnos y Cuotas.");return}
  if(sync.activo()){
    panel(`<h2>¿Cambiar de cuenta?</h2><p class="muted" style="margin:0">En ${dispositivo()} ya está abierta la sesión de ${esc(yo.name)}. Si seguís, se cierra y se abre la cuenta del QR.</p>
      <div class="actions"><button class="btn ghost" id="vcX">Cancelar</button><button class="btn" id="vcOk">Cambiar</button></div>`);
    $("#vcX").onclick=closePanel;
    $("#vcOk").onclick=async()=>{closePanel();await sync.salir();usarVinculo(v.u,v.c)};
    return;
  }
  usarVinculo(v.u,v.c);
}
// Escáner con la cámara (celular o compu)
let escaneo=null;
async function escanearQR(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||typeof jsQR!=="function"){toast("Este dispositivo no deja usar la cámara acá. Usá el código.");return}
  const div=document.createElement("div");div.className="scan";div.innerHTML=`<div class="scanbox"><video playsinline muted></video><div class="scanmarco"></div></div><p>Apuntá la cámara al QR que muestra la otra pantalla.</p><button class="btn ghost" id="scX">Cancelar</button>`;
  document.body.appendChild(div);
  const video=div.querySelector("video"),canvas=document.createElement("canvas"),ctx=canvas.getContext("2d",{willReadFrequently:true});
  let stream=null,vivo=true;
  const cerrar=()=>{vivo=false;if(stream)stream.getTracks().forEach(t=>t.stop());div.remove();escaneo=null};
  escaneo=cerrar;$("#scX").onclick=cerrar;
  try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});video.srcObject=stream;await video.play()}
  catch(e){cerrar();toast("No pude abrir la cámara. Dale permiso a la app o usá el código.");return}
  const leer=()=>{if(!vivo)return;
    if(video.readyState>=2&&video.videoWidth){const w=Math.min(640,video.videoWidth),h=Math.round(video.videoHeight*w/video.videoWidth);canvas.width=w;canvas.height=h;ctx.drawImage(video,0,0,w,h);
      const r=jsQR(ctx.getImageData(0,0,w,h).data,w,h,{inversionAttempts:"dontInvert"});
      if(r&&r.data){if(leerLinkVincular(r.data)){cerrar();procesarVinculo(r.data);return}}}
    requestAnimationFrame(leer)};
  leer();
}
// Abrir la app desde la cámara del teléfono (fackalumnos://vincular?...)
(function enlaces(){
  try{
    const A=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.App;if(!A)return;
    A.addListener("appUrlOpen",e=>{if(e&&e.url)setTimeout(()=>procesarVinculo(e.url),300)});
    A.getLaunchUrl&&A.getLaunchUrl().then(r=>{if(r&&r.url&&leerLinkVincular(r.url))setTimeout(()=>procesarVinculo(r.url),600)}).catch(()=>{});
  }catch(e){}
})();
