/* ---------- actualizaciones automáticas ---------- */
const UPD_BASE="__UPDBASE__";
const actualizacion=(()=>{
  let estadoTxt="",nueva=null;
  const off=()=>{try{return localStorage.getItem("fack-update-off")==="1"}catch(e){return false}};
  async function sha(t){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
  async function revisar(manual){
    if(!UPD_BASE||UPD_BASE.indexOf("__")===0){estadoTxt="Sin actualizaciones configuradas";return}
    if(off()&&!manual){estadoTxt="Actualizaciones automáticas apagadas";return}
    try{
      const r=await fetch(UPD_BASE+"version.json?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw 0;
      const v=await r.json();
      if(cmpVersion(v.version,APP_VERSION)<=0){estadoTxt=`Tenés la última versión (${APP_VERSION})`;return}
      let mala="";try{mala=localStorage.getItem("fack-update-mala")||""}catch(e){}
      if(mala===v.version){estadoTxt=`La versión ${v.version} no arrancó bien en este dispositivo`;return}
      if(v.base&&cmpVersion(APP_BASE,v.base)<0){nueva={...v,instalar:true};estadoTxt=`Hay una versión ${v.version} que hay que instalar de nuevo`;if(manual||!avisada(v.version))avisoInstalar(v);return}
      if(off()){estadoTxt=`Hay una versión nueva (${v.version})`;nueva=v;return}
      const h=await fetch(UPD_BASE+(v.archivo||"index.html")+"?t="+Date.now(),{cache:"no-store"});if(!h.ok)throw 0;
      const html=await h.text();
      if(v.sha256&&await sha(html)!==v.sha256)throw new Error("archivo incompleto");
      if(html.indexOf('var V="'+v.version+'"')<0)throw new Error("versión no coincide");
      localStorage.setItem("fack-update",JSON.stringify({v:v.version,base:v.base||"",html}));
      nueva=v;estadoTxt=`Versión ${v.version} lista`;
      avisoLista(v);
    }catch(e){estadoTxt="No se pudo buscar actualizaciones";if(manual)console.warn(e)}
  }
  function avisada(v){try{return sessionStorage.getItem("fack-avisada")===v}catch(e){return false}}
  function avisoLista(v){
    try{sessionStorage.setItem("fack-avisada",v.version)}catch(e){}
    const d=document.createElement("div");d.className="updbar";
    d.innerHTML=`<span><b>Nueva versión ${esc(v.version)}</b>${v.notas?" · "+esc(v.notas):""}</span><button class="btn sm" id="updYa">Actualizar ahora</button><button class="btn sm ghost" id="updDesp">Después</button>`;
    document.body.appendChild(d);
    d.querySelector("#updYa").onclick=()=>location.reload();
    d.querySelector("#updDesp").onclick=()=>d.remove();
  }
  function avisoInstalar(v){
    try{sessionStorage.setItem("fack-avisada",v.version)}catch(e){}
    const d=document.createElement("div");d.className="updbar";
    d.innerHTML=`<span><b>Versión ${esc(v.version)}</b>: esta necesita instalar la app de nuevo.${v.descarga?"":" Pedile el archivo a quien administra la app."}</span>${v.descarga?`<button class="btn sm" id="updDl">Descargar</button>`:""}<button class="btn sm ghost" id="updDesp">Cerrar</button>`;
    document.body.appendChild(d);
    if(v.descarga)d.querySelector("#updDl").onclick=()=>window.open(v.descarga,"_blank");
    d.querySelector("#updDesp").onclick=()=>d.remove();
  }
  function arranqueOk(){try{localStorage.removeItem("fack-update-arranque");const u=JSON.parse(localStorage.getItem("fack-update")||"null");if(u&&cmpVersion(u.v,APP_BASE)<=0)localStorage.removeItem("fack-update")}catch(e){}}
  function setOff(v){try{v?localStorage.setItem("fack-update-off","1"):localStorage.removeItem("fack-update-off")}catch(e){}}
  return {revisar,arranqueOk,estado:()=>estadoTxt,off,setOff,hayNueva:()=>nueva};
})();
function panelActualizaciones(){
  const pintar=()=>panel(`<h2 style="font-size:24px">Actualizaciones</h2>
    <div class="card" style="background:var(--head)"><div class="kv"><span>Versión en uso</span><span class="num">${esc(APP_VERSION)}</span></div><div class="kv"><span>Instalada</span><span class="num">${esc(APP_BASE)}</span></div></div>
    <label class="check" style="color:var(--ink)"><input type="checkbox" id="uAuto" ${actualizacion.off()?"":"checked"} style="width:18px;height:18px"> Actualizar automáticamente</label>
    <p class="by" style="margin:0">Las versiones nuevas se descargan solas y se aplican la próxima vez que abrís la app. Tus datos no se tocan.</p>
    <p class="by" id="uEst" style="margin:0;color:var(--paid)">${esc(actualizacion.estado())}</p>
    <div class="actions"><button class="btn ghost" id="uX">Cerrar</button><button class="btn" id="uBus">Buscar ahora</button></div>`);
  pintar();
  const bind=()=>{
    $("#uX").onclick=closePanel;
    $("#uAuto").onchange=e=>{actualizacion.setOff(!e.target.checked);toast(e.target.checked?"Actualizaciones automáticas activadas":"Actualizaciones automáticas apagadas")};
    $("#uBus").onclick=async()=>{const b=$("#uBus");b.disabled=true;b.textContent="Buscando…";await actualizacion.revisar(true);pintar();bind()};
  };bind();
}
